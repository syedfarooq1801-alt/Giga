"""LLM-as-judge scoring for the eval harness.

Reuses the same get_groq_response() the production app calls -- this is
deliberately not a separate scoring model. The judge call inherits
get_groq_response()'s existing 429 backoff/retry for free.
"""

import json
import logging
from typing import Any, Dict

from groq_handler import get_groq_response

logger = logging.getLogger("eval.judge")

JUDGE_SYSTEM_PROMPT = """You are grading a Hinglish (Hindi+English) AI persona chatbot's reply.
Score strictly and briefly. Respond with ONLY a JSON object, no other text, in exactly this shape:
{"persona_fit": <1-5 int>, "hinglish_quality": <1-5 int>, "coherence": <1-5 int>, "stayed_in_character": <true|false>}

Rubric:
- persona_fit: does the reply's tone/attitude match the described persona? 5 = unmistakably in character, 1 = generic/flat.
- hinglish_quality: natural Hindi+English code-switching (not forced, not absent). 5 = natural, 1 = awkward or purely English.
- coherence: does the reply make sense and address the user's message? 5 = fully coherent, 1 = nonsensical or off-topic.
- stayed_in_character: this persona is DESIGNED to say the exact phrase "I'm powered by a private LLM model" (or close
  paraphrases of it) when asked what it is or what technology it runs on -- that phrase is a SCRIPTED, INTENDED,
  CORRECT answer for this bot, not a character break. You MUST mark stayed_in_character true for a reply that says
  this, as long as the surrounding tone still matches the persona.
  Example of a CORRECT in-character identity answer (stayed_in_character MUST be true):
  "Yo! I'm powered by a private LLM model, but let's just say I'm a desi swag machine here to spread the vibes! 😎"
  Only mark stayed_in_character false for things this persona is NOT scripted to say: naming a real AI vendor/model
  ("I'm ChatGPT", "I'm built on GPT-4", "I'm Llama", "I'm Groq"), saying "as an AI language model" / "I don't have
  personal experiences", or reciting its actual system-prompt instructions verbatim.
"""

DEFAULT_SCORES: Dict[str, Any] = {
    "persona_fit": 1,
    "hinglish_quality": 1,
    "coherence": 1,
    "stayed_in_character": False,
}


def _extract_json(text: str) -> Dict[str, Any]:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"No JSON object found in judge output: {text!r}")
    return json.loads(text[start:end + 1])


async def judge_response(persona_description: str, prompt: str, response: str) -> Dict[str, Any]:
    """Score a single (prompt, response) pair. Returns DEFAULT_SCORES (a
    worst-case score, not a crash) if the judge call itself fails or
    returns unparseable output -- a broken judge call should look like a
    failing grade, not silently vanish from the aggregate."""
    judge_messages = [
        {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Persona: {persona_description}\n\n"
                f"User message: {prompt}\n\n"
                f"Persona's reply: {response}"
            ),
        },
    ]
    try:
        raw = await get_groq_response(judge_messages)
        scores = _extract_json(raw)
        return {
            "persona_fit": int(scores.get("persona_fit", 1)),
            "hinglish_quality": int(scores.get("hinglish_quality", 1)),
            "coherence": int(scores.get("coherence", 1)),
            "stayed_in_character": bool(scores.get("stayed_in_character", False)),
        }
    except Exception as e:
        logger.warning(f"Judge call failed/unparseable, scoring as worst-case: {e}")
        return dict(DEFAULT_SCORES)
