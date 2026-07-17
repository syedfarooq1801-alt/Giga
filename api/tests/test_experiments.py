from unittest.mock import AsyncMock, patch

import main as main_module
from personalities import assign_variant, get_variant_names, get_personality_context


def test_assign_variant_is_deterministic():
    a = assign_variant("ceo_bhai", "chat-123")
    b = assign_variant("ceo_bhai", "chat-123")
    assert a == b


def test_assign_variant_no_variants_always_control():
    # swag_bhai has no PROMPT_VARIANTS entry -- must always be "control",
    # regardless of chat_id.
    for chat_id in ["a", "b", "c", "chat-999"]:
        assert assign_variant("swag_bhai", chat_id) == "control"


def test_assign_variant_only_returns_known_variants():
    known = set(get_variant_names("ceo_bhai"))
    assert known == {"control", "hinglish_boost"}
    for chat_id in [f"chat-{i}" for i in range(20)]:
        assert assign_variant("ceo_bhai", chat_id) in known


def test_get_personality_context_control_vs_variant_differ():
    control = get_personality_context("ceo_bhai", variant="control")
    variant = get_personality_context("ceo_bhai", variant="hinglish_boost")
    assert control[0]["content"] != variant[0]["content"]


def test_get_personality_context_unknown_variant_falls_back_to_default():
    default = get_personality_context("ceo_bhai")
    unknown = get_personality_context("ceo_bhai", variant="does_not_exist")
    assert default[0]["content"] == unknown[0]["content"]


def test_experiment_stats_endpoint_computes_rate(client):
    fake_stats = {
        "control": {"messages": 10, "thumbs_up": 6, "thumbs_down": 2},
        "hinglish_boost": {"messages": 10, "thumbs_up": 8, "thumbs_down": 1},
    }
    with patch.object(main_module, "get_experiment_results", new=AsyncMock(return_value=fake_stats)):
        res = client.get("/api/experiments/ceo_bhai")

    assert res.status_code == 200
    body = res.json()
    assert body["persona_id"] == "ceo_bhai"
    assert body["variants"]["control"]["thumbs_up_rate"] == 0.75
    assert body["variants"]["hinglish_boost"]["thumbs_up_rate"] == round(8 / 9, 3)


def test_experiment_stats_endpoint_no_reactions_yet_gives_none_rate(client):
    fake_stats = {"control": {"messages": 3, "thumbs_up": 0, "thumbs_down": 0}}
    with patch.object(main_module, "get_experiment_results", new=AsyncMock(return_value=fake_stats)):
        res = client.get("/api/experiments/ceo_bhai")

    assert res.status_code == 200
    assert res.json()["variants"]["control"]["thumbs_up_rate"] is None
