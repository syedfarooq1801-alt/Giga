# Giga BhAI

A full-stack Hinglish AI chatbot — Expo/React Native frontend (web-first) + FastAPI backend, deployed as a single Vercel project. Five personas, streaming replies, and a set of features that go beyond a plain LLM wrapper: RAG over your own documents, an eval harness, A/B-tested prompts, and a fine-tuned local persona model.

## Features

- 🎭 5 personas (Swag Bhai, CEO Bhai, Roast Bhai, Vidhyarthi Bhai, Jugadu Bhai), each with distinct system prompts and accent theming
- 💬 Streaming replies, markdown/code rendering, thumbs up/down + regenerate-in-place
- 🔗 Shareable read-only conversation links, with "continue this chat" (forks into the viewer's own account)
- 📎 Upload a PDF/text doc and chat with it (RAG: local embeddings + Qdrant Cloud)
- 🖼️ Real image understanding — attach a photo and ask about it (Groq vision model)
- 🧪 Eval harness (`api/eval/`) — scripted persona test suite, LLM-judge scored, regression-gated against a tracked baseline
- 🔬 A/B prompt experiments — deterministic variant assignment, results viewable in Settings
- 🧠 Fine-tuned persona voice — per-persona LoRA adapters trained on Qwen2.5-1.5B-Instruct via distillation from the production model (`api/finetune/`), served in-process (`api/local_llm.py`)
- 🔒 Firestore security rules scoped per-user, rate-limited API, auth-gated everywhere it matters

## Architecture

Single Vercel-deployable monorepo:

```
api/                  FastAPI backend, mounted under /api
  main.py             Routes: /chat, /chat/stream, /conversations, /documents, /experiments, /shared, ...
  firebase_memory_manager.py   All Firestore access
  groq_handler.py      Groq LLM calls (chat + streaming + vision)
  personalities.py     Persona system prompts + A/B prompt variants
  rag.py                Local embeddings + Qdrant Cloud (documents feature)
  local_llm.py          In-process serving for fine-tuned LoRA adapters
  eval/                 Persona eval harness
  finetune/              Synthetic data generation + LoRA training scripts
  tests/                 pytest suite

src/                  Expo/React Native frontend (web-first)
  screens/             ChatScreen, SettingsScreen, AuthScreen, SharedConversationScreen
  components/          MessageBubble, ChatHeader, PersonaSwitcher, ...
  services/             API clients (streaming chat, documents, ...)
  theme/                 "Saaf Baat" design token system
```

## Prerequisites

- Node.js 18+, npm
- Python 3.11
- A Firebase project (Auth + Firestore) — service account JSON for the backend, web config for the frontend
- A Groq API key
- (Optional, for the documents/RAG feature) A Qdrant Cloud account

## Local setup

**Frontend:**
```bash
npm install
npm run build   # or: npx expo start --web
```

**Backend:**
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

Copy `api/.env.example`-style vars into `api/.env` (never committed — see `.gitignore`):
```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON=./serviceAccountKey.json
GROQ_API_KEY=...
QDRANT_URL=...       # optional, for RAG
QDRANT_API_KEY=...   # optional, for RAG
```

Place your Firebase service account JSON at `api/serviceAccountKey.json` (gitignored).

For full-stack local testing against the production build, use `npm run preview` (proxies `/api` to the backend, mirrors the Vercel routing).

## RAG and fine-tuning (optional, local-dev only)

`sentence-transformers`/`torch`/`peft` are deliberately **not** in `api/requirements.txt` — they're too large for a serverless bundle. Install them separately if you want these features working locally:
```bash
pip install sentence-transformers peft
```
Fine-tuning training itself runs in an isolated venv (`api/finetune/.venv`) so it can't disturb the main app's environment — see comments in `api/finetune/train_lora.py`.

## Testing

```bash
npm test              # frontend (jest-expo)
cd api && pytest -v   # backend
```

CI runs both on push (`.github/workflows/ci.yml`); the eval harness runs separately on a schedule/manual trigger (`.github/workflows/eval.yml`) since it costs real API calls.

## Deploying

This repo deploys as a single Vercel project — `vercel.json` routes `/api/*` to the FastAPI backend and everything else to the static Expo web export. Set the same environment variables listed above in the Vercel dashboard (Project Settings → Environment Variables) before deploying.
