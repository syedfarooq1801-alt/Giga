from unittest.mock import AsyncMock, patch

import main as main_module


def test_chat_rate_limited_after_20_per_minute(client):
    """/chat is limited to 20/minute per bearer token; the 21st request
    within the window should get a 429, not another 200."""
    headers = {"Authorization": "Bearer fake-token-for-rate-limit-test"}

    with patch.object(main_module, "_build_chat_messages", new=AsyncMock(return_value=([], "uid", "profile"))), \
         patch.object(main_module, "get_groq_response", new=AsyncMock(return_value="ok")), \
         patch.object(main_module, "store_message", new=AsyncMock(return_value=("chat-1", "msg-1"))):

        statuses = []
        for _ in range(21):
            res = client.post("/api/chat", json={"message": "hi", "personality": "swag_bhai"}, headers=headers)
            statuses.append(res.status_code)

    assert statuses[:20] == [200] * 20
    assert statuses[20] == 429
