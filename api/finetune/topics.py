"""Builds the shared prompt pool used to generate the fine-tuning
distillation dataset. Combinatorial (template x topic), not hand-authored
one-by-one -- gives genuine topic/phrasing variety without needing
hundreds of manually written lines, and stays fully deterministic (no
randomness) so a re-run reproduces the same pool.
"""

TOPICS = [
    "cooking", "cricket", "startups", "relationships", "coding", "movies", "fitness",
    "travel", "money", "college", "family", "friendship", "music", "gaming", "fashion",
    "sleep", "productivity", "job interviews", "breakups", "festivals", "artificial intelligence",
    "monsoon season", "traffic", "exams", "internships", "startup funding", "social media",
    "cricket matches", "cooking for beginners", "long-distance friendships", "public speaking",
    "time management", "online shopping", "street food", "college placements",
]

TEMPLATES = [
    "What do you think about {topic}?",
    "Give me some advice about {topic}.",
    "I'm really stressed about {topic}, what should I do?",
    "Tell me something interesting about {topic}.",
    "Can you help me get better at {topic}?",
    "What's your honest opinion on {topic}?",
    "I need motivation to deal with {topic} today.",
    "Explain {topic} to me like I'm five.",
    "What's a good way to start with {topic}?",
    "Roast me about my {topic} habits.",
    "Give me 3 quick tips for {topic}.",
    "I just had a rough day because of {topic}, cheer me up.",
    "What's the biggest mistake people make with {topic}?",
    "How do I know if I'm doing {topic} right?",
    "Any jugaad or hack for {topic}?",
]


def build_prompt_pool() -> list:
    """Every (template, topic) combination, in a fixed order -- 15 templates
    x 34 topics = 510 unique prompts, no randomness involved."""
    return [template.format(topic=topic) for template in TEMPLATES for topic in TOPICS]
