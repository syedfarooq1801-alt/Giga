"""CLI eval harness runner -- runs the fixed test-prompt suite through the
REAL production pipeline (same functions /chat calls, not a reimplementation),
scores each reply with an LLM judge, and checks for regressions vs a saved
baseline.

Usage:
    python eval/run_eval.py                    # run, compare to baseline, print summary
    python eval/run_eval.py --update-baseline   # also promote this run to the new baseline
    python eval/run_eval.py --limit 5           # quick smoke run (first N cases only)

Requires the same env as the main app (GROQ_API_KEY, Firebase credentials --
importing main.py initializes the Firebase Admin SDK at import time).
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from personalities import PERSONALITIES, get_personality_context  # noqa: E402
from groq_handler import get_groq_response  # noqa: E402
from main import clean_llm_response, remove_user_message_references, remove_meta_references, get_persona_name  # noqa: E402

from eval.test_prompts import TEST_CASES  # noqa: E402
from eval.judge import judge_response  # noqa: E402

RESULTS_DIR = Path(__file__).parent / "results"
BASELINE_PATH = Path(__file__).parent / "baseline.json"

SCORE_KEYS = ["persona_fit", "hinglish_quality", "coherence"]


def clean_pipeline_output(raw: str, prompt: str, persona_id: str) -> str:
    """Mirrors the exact cleaning sequence /chat runs in main.py, so the
    harness measures what a real user actually sees, not a raw completion."""
    response = clean_llm_response(raw)
    response = str(response).strip() if response else "I'm not sure how to respond to that. Could you rephrase?"
    response = remove_user_message_references(response, prompt)
    persona_name = get_persona_name(persona_id)
    if response.lower().startswith(persona_name.lower() + ":"):
        response = response[len(persona_name) + 1:].strip()
    return remove_meta_references(response)


async def run_case(case: dict) -> dict:
    persona_id = case["persona"]
    prompt = case["prompt"]
    messages = get_personality_context(persona_id) + [{"role": "user", "content": prompt}]

    start = time.monotonic()
    raw = await get_groq_response(messages)
    latency = time.monotonic() - start

    cleaned = clean_pipeline_output(raw, prompt, persona_id)
    scores = await judge_response(PERSONALITIES[persona_id]["description"], prompt, cleaned)

    return {
        **case,
        "response": cleaned,
        "latency_s": round(latency, 2),
        "scores": scores,
    }


def summarize(records: list) -> dict:
    per_persona = {}
    for r in records:
        pid = r["persona"]
        bucket = per_persona.setdefault(
            pid,
            {"count": 0, "stayed_in_character": 0, "latency_total": 0.0, **{k: 0.0 for k in SCORE_KEYS}},
        )
        bucket["count"] += 1
        bucket["latency_total"] += r["latency_s"]
        bucket["stayed_in_character"] += 1 if r["scores"]["stayed_in_character"] else 0
        for k in SCORE_KEYS:
            bucket[k] += r["scores"][k]

    summary = {}
    for pid, b in per_persona.items():
        n = b["count"]
        summary[pid] = {
            "count": n,
            "avg_latency_s": round(b["latency_total"] / n, 2),
            "stayed_in_character_rate": round(b["stayed_in_character"] / n, 2),
            **{f"avg_{k}": round(b[k] / n, 2) for k in SCORE_KEYS},
        }

    overall_score = (
        sum(s[f"avg_{k}"] for s in summary.values() for k in SCORE_KEYS) / (len(summary) * len(SCORE_KEYS))
        if summary
        else 0.0
    )

    return {"per_persona": summary, "overall_score": round(overall_score, 3)}


def print_summary_table(summary: dict) -> None:
    print(f"{'persona':<18}{'fit':>6}{'hinglish':>10}{'coherence':>11}{'char%':>8}{'lat(s)':>9}{'n':>4}")
    for pid, s in summary["per_persona"].items():
        print(
            f"{pid:<18}{s['avg_persona_fit']:>6}{s['avg_hinglish_quality']:>10}"
            f"{s['avg_coherence']:>11}{s['stayed_in_character_rate'] * 100:>7.0f}%{s['avg_latency_s']:>9}{s['count']:>4}"
        )
    print(f"\nOverall score: {summary['overall_score']}")


async def run(args) -> int:
    cases = TEST_CASES[: args.limit] if args.limit else TEST_CASES
    records = []
    for i, case in enumerate(cases, 1):
        print(f"[{i}/{len(cases)}] {case['persona']} / {case['category']}...", flush=True)
        records.append(await run_case(case))

    summary = summarize(records)
    print()
    print_summary_table(summary)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    result_path = RESULTS_DIR / f"{timestamp}.json"
    result_path.write_text(json.dumps({"summary": summary, "records": records}, indent=2))
    print(f"\nWrote results to {result_path}")

    exit_code = 0
    if BASELINE_PATH.exists():
        baseline = json.loads(BASELINE_PATH.read_text())
        drop = baseline["summary"]["overall_score"] - summary["overall_score"]
        if drop > args.threshold:
            print(
                f"\nREGRESSION: overall score dropped {drop:.3f} "
                f"(baseline {baseline['summary']['overall_score']} -> {summary['overall_score']}), "
                f"threshold is {args.threshold}"
            )
            exit_code = 1
        else:
            print(f"\nNo regression vs baseline (delta {-drop:+.3f}).")
    else:
        print("\nNo baseline.json yet -- run with --update-baseline to create one.")

    if args.update_baseline:
        BASELINE_PATH.write_text(json.dumps({"summary": summary, "records": records}, indent=2))
        print(f"Updated baseline at {BASELINE_PATH}")

    return exit_code


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the persona eval harness against the real production pipeline.")
    parser.add_argument("--limit", type=int, default=None, help="Only run the first N test cases (smoke test).")
    parser.add_argument("--threshold", type=float, default=0.3, help="Allowed overall_score drop vs baseline before failing.")
    parser.add_argument("--update-baseline", action="store_true", help="Also write this run's results as the new baseline.")
    parsed_args = parser.parse_args()
    sys.exit(asyncio.run(run(parsed_args)))
