"""In-process serving for the fine-tuned persona LoRA adapters trained by
api/finetune/train_lora.py.

Gated behind LOCAL_MODEL_PATH (unset = feature fully inactive, zero risk to
existing Groq-only deploys -- this is exactly how api/rag.py degrades when
Qdrant/sentence-transformers aren't available). transformers/torch/peft are
all lazy-imported inside functions, never at module level, so importing
this module never forces a GPU/model load and never breaks a deploy that
doesn't have these packages installed (e.g. Vercel, which will never set
LOCAL_MODEL_PATH anyway since it has no GPU).

One base model stays resident in VRAM; adapters are small (tens of MB) and
hot-swapped per persona via peft's set_adapter(). Swapping + generating is
NOT thread-safe against a different persona's request racing in in the
middle -- both would share the one "active adapter" pointer -- so every
generation call holds a single asyncio.Lock for its full duration. That
serializes concurrent local-model requests (acceptable for a personal
project's traffic; the alternative, N resident model copies, doesn't fit
in 6GB VRAM for even two personas at once).
"""

import asyncio
import logging
import os
from pathlib import Path
from typing import List, Dict, Optional

logger = logging.getLogger("local_llm")

BASE_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"
LOCAL_MODEL_PATH = os.environ.get("LOCAL_MODEL_PATH")  # directory containing one subfolder per persona adapter
MAX_NEW_TOKENS = 300

_model = None
_tokenizer = None
_loaded_adapters: set = set()
_generation_lock = asyncio.Lock()
_unavailable = False  # sticky after first failed load, avoids retrying every request


def is_configured() -> bool:
    return bool(LOCAL_MODEL_PATH)


def _load_base_model():
    """Loads the base model once, lazily, on first real use. Raises on
    failure -- callers decide whether that's fatal (explicit test/serving
    setup) or something to degrade from (mid-chat use)."""
    global _model, _tokenizer
    if _model is not None:
        return
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel

    logger.info(f"Loading base model {BASE_MODEL} for local fine-tuned serving...")
    _tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    if _tokenizer.pad_token is None:
        _tokenizer.pad_token = _tokenizer.eos_token

    base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16)
    if torch.cuda.is_available():
        base = base.to("cuda")

    # Wrap with the first available persona adapter just to get a PeftModel
    # instance -- load_adapter()/set_adapter() handle every persona
    # (including this first one) uniformly from here on.
    personas_dir = Path(LOCAL_MODEL_PATH)
    available = sorted(p.name for p in personas_dir.iterdir() if p.is_dir())
    if not available:
        raise FileNotFoundError(f"No trained adapters found under {LOCAL_MODEL_PATH}")

    first = available[0]
    _model = PeftModel.from_pretrained(base, str(personas_dir / first), adapter_name=first)
    _loaded_adapters.add(first)
    for persona_id in available[1:]:
        _model.load_adapter(str(personas_dir / persona_id), adapter_name=persona_id)
        _loaded_adapters.add(persona_id)
    _model.eval()
    logger.info(f"Loaded base model with adapters: {sorted(_loaded_adapters)}")


def _sync_generate(persona_id: str, messages: List[Dict[str, str]]) -> str:
    import torch

    _load_base_model()
    if persona_id not in _loaded_adapters:
        raise ValueError(f"No trained adapter for persona '{persona_id}'. Available: {sorted(_loaded_adapters)}")

    _model.set_adapter(persona_id)
    prompt_text = _tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = _tokenizer(prompt_text, return_tensors="pt").to(_model.device)

    with torch.no_grad():
        output_ids = _model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            pad_token_id=_tokenizer.pad_token_id,
        )
    generated = output_ids[0][inputs["input_ids"].shape[1]:]
    return _tokenizer.decode(generated, skip_special_tokens=True).strip()


async def generate_finetuned_response(persona_id: str, messages: List[Dict[str, str]]) -> Optional[str]:
    """Returns the fine-tuned model's reply, or None if local serving isn't
    configured/available -- callers (main.py's /chat) should fall back to
    Groq on None, exactly like RAG falling back to no-context on failure.

    _unavailable only latches on a base-model LOAD failure (missing files,
    import error, OOM at load time -- a real "this isn't going to work"
    signal). A single generation-time failure (bad persona id, a transient
    OOM under memory pressure) returns None for just that call without
    poisoning every later request for the rest of the process lifetime."""
    global _unavailable
    if not is_configured() or _unavailable:
        return None
    try:
        async with _generation_lock:
            return await asyncio.to_thread(_sync_generate, persona_id, messages)
    except FileNotFoundError as e:
        logger.error(f"Local model adapters not found, disabling local serving for this process: {e}")
        _unavailable = True
        return None
    except ImportError as e:
        logger.error(f"Local model serving deps not installed, disabling local serving for this process: {e}")
        _unavailable = True
        return None
    except Exception as e:
        logger.warning(f"Local fine-tuned generation failed for this request, falling back to Groq: {e}")
        return None
