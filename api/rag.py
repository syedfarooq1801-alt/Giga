"""Local-embedding RAG over user-uploaded documents, backed by Qdrant Cloud.

Embeddings run locally (sentence-transformers, CPU -- this keeps GPU VRAM
free for the fine-tuned model in api/local_llm.py, and means this module
works identically on a GPU-less deploy). Qdrant is the ONLY place vectors
live; Firestore (api/firebase_memory_manager.py) separately tracks "what
did this user upload" as plain metadata, since Qdrant isn't a good
system-of-record for that.

Every function that runs inside the live chat request path
(search_context) MUST degrade gracefully -- if Qdrant is unreachable, or
its free-tier cluster has paused from inactivity, a chat message should
still get a normal (non-RAG) reply, not a 500. Upload/delete are explicit
user actions, not silent background augmentation, so those DO raise -- the
user should know if their upload actually failed.
"""

import asyncio
import io
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

logger = logging.getLogger("rag")

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
COLLECTION_NAME = "documents"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
TOP_K = 3

_embedding_model = None
_qdrant_client: Optional[QdrantClient] = None
_qdrant_unavailable = False  # sticky after first failed connect, avoids retrying every request


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        # Force offline/local-cache-only: with the model already cached
        # (first run downloads it), there's no reason a chat-serving process
        # should ever make a network call to HuggingFace Hub just to check
        # for updates. That check has been observed to hang for a long time
        # under network contention (e.g. a concurrent batch job also making
        # heavy outbound calls) -- offline mode removes the network call
        # entirely rather than just hoping it's fast.
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device="cpu")
    return _embedding_model


def _ensure_collection(client: QdrantClient) -> None:
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=qmodels.VectorParams(size=EMBEDDING_DIM, distance=qmodels.Distance.COSINE),
        )
    # Qdrant requires an explicit payload index before a field can be used
    # in a query filter (analogous to Firestore needing a composite index
    # for collection-group queries) -- every search here filters on
    # profile_id, so this must exist. create_payload_index is idempotent:
    # safe to call even if the index is already there.
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="profile_id",
        field_schema=qmodels.PayloadSchemaType.KEYWORD,
    )
    # delete_document_vectors() filters on doc_id too (alongside profile_id)
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="doc_id",
        field_schema=qmodels.PayloadSchemaType.KEYWORD,
    )


def _get_client() -> Optional[QdrantClient]:
    global _qdrant_client, _qdrant_unavailable
    if not QDRANT_URL or not QDRANT_API_KEY:
        return None
    if _qdrant_unavailable:
        return None
    if _qdrant_client is None:
        try:
            _qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=10)
            _ensure_collection(_qdrant_client)
        except Exception as e:
            logger.error(f"Qdrant unavailable, RAG will degrade to no-op for this process lifetime: {e}")
            _qdrant_client = None
            _qdrant_unavailable = True
            return None
    return _qdrant_client


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Fixed-size character chunking with overlap -- no semantic chunking
    for v1, this is enough to make retrieval useful without the complexity
    of sentence/paragraph-aware splitting."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return chunks


def extract_text(filename: str, content: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return content.decode("utf-8", errors="ignore")


# qdrant-client's REST client and sentence-transformers' model.encode() are
# both plain synchronous/blocking calls (network I/O + CPU inference)."
# Calling them directly inside an `async def` blocks FastAPI's single event
# loop for the entire duration -- not just slow, but capable of stalling
# every other in-flight request on the server. Every function below does
# its real work in a `_sync_*` helper and hands it to a worker thread via
# asyncio.to_thread(), which is the standard fix for wrapping sync-only
# libraries in an async app.

def _sync_upload_document(profile_id: str, filename: str, content: bytes) -> Dict[str, Any]:
    client = _get_client()
    if client is None:
        raise RuntimeError("Document storage (Qdrant) is not configured or unreachable right now.")

    text = extract_text(filename, content)
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No extractable text found in this document.")

    model = _get_embedding_model()
    embeddings = model.encode(chunks, show_progress_bar=False)

    doc_id = str(uuid.uuid4())
    points = [
        qmodels.PointStruct(
            id=str(uuid.uuid4()),
            vector=embeddings[i].tolist(),
            payload={
                "profile_id": profile_id,
                "doc_id": doc_id,
                "filename": filename,
                "chunk_index": i,
                "text": chunks[i],
            },
        )
        for i in range(len(chunks))
    ]
    client.upsert(collection_name=COLLECTION_NAME, points=points)
    return {"doc_id": doc_id, "chunk_count": len(chunks)}


async def upload_document(profile_id: str, filename: str, content: bytes) -> Dict[str, Any]:
    """Chunk, embed, and upsert a document into Qdrant. Returns
    {doc_id, chunk_count} for the caller to mirror into Firestore metadata.
    Raises RuntimeError/ValueError on failure -- an upload the user
    explicitly requested should surface a real error, not silently no-op."""
    return await asyncio.to_thread(_sync_upload_document, profile_id, filename, content)


def _sync_delete_document_vectors(profile_id: str, doc_id: str) -> None:
    client = _get_client()
    if client is None:
        raise RuntimeError("Document storage (Qdrant) is not configured or unreachable right now.")
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(key="profile_id", match=qmodels.MatchValue(value=profile_id)),
                    qmodels.FieldCondition(key="doc_id", match=qmodels.MatchValue(value=doc_id)),
                ]
            )
        ),
    )


async def delete_document_vectors(profile_id: str, doc_id: str) -> None:
    await asyncio.to_thread(_sync_delete_document_vectors, profile_id, doc_id)


def _sync_search_context(profile_id: str, query_text: str, top_k: int) -> List[str]:
    client = _get_client()
    if client is None:
        return []
    try:
        model = _get_embedding_model()
        query_vector = model.encode([query_text])[0].tolist()
        # qdrant-client >=1.10 deprecated .search() in favor of
        # .query_points() -- same idea (vector + filter -> ranked hits),
        # response is a QueryResponse wrapping .points instead of a bare list.
        response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=qmodels.Filter(
                must=[qmodels.FieldCondition(key="profile_id", match=qmodels.MatchValue(value=profile_id))]
            ),
            limit=top_k,
        )
        return [r.payload["text"] for r in response.points if r.payload and "text" in r.payload]
    except Exception as e:
        logger.warning(f"RAG search failed, degrading gracefully (no context injected): {e}")
        return []


async def search_context(profile_id: str, query: str, top_k: int = TOP_K) -> List[str]:
    """Top-k relevant chunk texts for this user's query. ALWAYS returns a
    list (empty on any failure) -- never raises. Callers in the live chat
    path treat an empty list as "skip augmentation", not an error."""
    return await asyncio.to_thread(_sync_search_context, profile_id, query, top_k)
