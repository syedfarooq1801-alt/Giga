"""Generates the LoRA fine-tuning distillation dataset: for each persona,
runs a diverse prompt pool through the SAME production pipeline /chat uses
(get_personality_context + get_groq_response + the real cleaning
functions), so the small model being trained later learns to imitate the
actual production output shape, not a reimplementation of it.

Output: api/finetune/data/{persona_id}.jsonl, one {"prompt", "response"}
object per line.

Usage:
    python finetune/generate_data.py --dry-run            # 3 prompts/persona, sanity check
    python finetune/generate_data.py                       # full run, all personas
    python finetune/generate_data.py --personas ceo_bhai   # just one persona
    python finetune/generate_data.py --per-persona 200      # cap examples per persona

Requires GROQ_API_KEY (same env as the main app). This is a standalone
script, not behind slowapi -- a full run across 5 personas is 1500+ Groq
calls, relying on get_groq_response()'s own internal 429 backoff.
"""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from personalities import PERSONALITIES, get_personality_context  # noqa: E402
from groq_handler import get_groq_response  # noqa: E402
from eval.run_eval import clean_pipeline_output  # noqa: E402

from finetune.topics import build_prompt_pool  # noqa: E402

DATA_DIR = Path(__file__).parent / "data"


async def generate_for_persona(persona_id: str, prompts: list, out_path: Path) -> int:
    written = 0
    with out_path.open("w", encoding="utf-8") as f:
        for i, prompt in enumerate(prompts, 1):
            messages = get_personality_context(persona_id) + [{"role": "user", "content": prompt}]
            raw = await get_groq_response(messages)
            cleaned = clean_pipeline_output(raw, prompt, persona_id)
            f.write(json.dumps({"prompt": prompt, "response": cleaned}, ensure_ascii=False) + "\n")
            written += 1
            print(f"  [{i}/{len(prompts)}] {persona_id}: {prompt[:60]!r}", flush=True)
    return written


async def main(args) -> None:
    pool = build_prompt_pool()
    if args.dry_run:
        args.per_persona = 3

    personas = args.personas.split(",") if args.personas else list(PERSONALITIES.keys())
    for pid in personas:
        if pid not in PERSONALITIES:
            print(f"Skipping unknown persona: {pid}")
            continue

    prompts = pool[: args.per_persona] if args.per_persona else pool

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    total_start = time.monotonic()
    total_written = 0
    for pid in personas:
        if pid not in PERSONALITIES:
            continue
        out_path = DATA_DIR / f"{pid}.jsonl"
        print(f"\n=== {pid}: generating {len(prompts)} examples -> {out_path} ===")
        written = await generate_for_persona(pid, prompts, out_path)
        total_written += written

    elapsed = time.monotonic() - total_start
    print(f"\nDone: {total_written} examples across {len(personas)} persona(s) in {elapsed:.1f}s.")
    print(f"Output directory: {DATA_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate the fine-tuning distillation dataset via Groq.")
    parser.add_argument("--personas", type=str, default=None, help="Comma-separated persona ids (default: all).")
    parser.add_argument("--per-persona", type=int, default=350, help="Max prompts per persona from the pool.")
    parser.add_argument("--dry-run", action="store_true", help="Only 3 prompts/persona, for a quick sanity check.")
    parsed_args = parser.parse_args()
    asyncio.run(main(parsed_args))
