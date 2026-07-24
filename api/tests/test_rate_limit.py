from unittest.mock import AsyncMock, patch

import main as main_module


def test_chat_rate_limited_after_20_per_minute(client, mock_db):
    """/chat is limited to 20/minute per bearer token; the 21st request
    within the window should get a 429, not another 200.

    Needs mock_db (previously missing here) -- /chat's post-response
    "summarize and store compressed memory" step (main.py, after
    store_message) imports and calls firebase_memory_manager functions
    directly, which is a separate unmocked path from store_message even
    though both live in the same module. Without mock_db those hit a
    real (test-fixture-credentialed) Firestore client on every one of
    the 21 requests below, which was silently turning this test into a
    multi-minute hang instead of a fast unit test. summarize_chat_memory
    (real Groq call, same post-processing step) is patched directly for
    the same reason -- it's a local import inside main.py's try block,
    so patching main_module doesn't reach it.
    """
    headers = {"Authorization": "Bearer fake-token-for-rate-limit-test"}

    with patch.object(main_module, "_build_chat_messages", new=AsyncMock(return_value=([], "uid", "profile"))), \
         patch.object(main_module, "get_groq_response", new=AsyncMock(return_value="ok")), \
         patch.object(main_module, "store_message", new=AsyncMock(return_value=("chat-1", "msg-1"))), \
         patch("groq_memory.summarize_chat_memory", new=AsyncMock(return_value="")):

        statuses = []
        for _ in range(21):
            res = client.post("/api/chat", json={"message": "hi", "personality": "swag_bhai"}, headers=headers)
            statuses.append(res.status_code)

    assert statuses[:20] == [200] * 20
    assert statuses[20] == 429
