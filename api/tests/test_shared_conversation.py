from unittest.mock import MagicMock, AsyncMock, patch

import main as main_module


def test_share_and_fetch_no_auth_required(client, mock_db, fake_uid, fake_profile_id):
    """Minting a share token (authenticated) then fetching it (NO auth
    header) must both succeed -- /shared/{token} is the one deliberately
    public endpoint."""
    fake_chat_doc = MagicMock()
    fake_chat_doc.exists = True
    mock_db.collection.return_value.document.return_value.collection.return_value \
        .document.return_value.get.return_value = fake_chat_doc

    with patch.object(main_module, "create_share_token", new=AsyncMock(return_value="tok_abc123")):
        share_res = client.post("/api/conversations/chat-1/share")
    assert share_res.status_code == 200
    assert share_res.json()["token"] == "tok_abc123"

    fake_turns = [{"id": "m1", "message": "hi", "response": "hey there", "personality": "swag_bhai", "timestamp": None}]
    with patch.object(
        main_module, "get_share",
        new=AsyncMock(return_value={"owner_uid": fake_uid, "profile_id": fake_profile_id, "chat_id": "chat-1", "revoked": False}),
    ), patch.object(main_module, "get_chat_messages", new=AsyncMock(return_value=fake_turns)):
        # No Authorization header at all -- this is the point of the test.
        shared_res = client.get("/api/shared/tok_abc123")

    assert shared_res.status_code == 200
    body = shared_res.json()
    assert body["success"] is True
    assert len(body["messages"]) == 2  # one user + one assistant entry per turn


def test_revoked_share_returns_404(client):
    with patch.object(
        main_module, "get_share",
        new=AsyncMock(return_value={"owner_uid": "x", "profile_id": "x", "chat_id": "chat-1", "revoked": True}),
    ):
        res = client.get("/api/shared/tok_revoked")
    assert res.status_code == 404


def test_unknown_share_token_returns_404(client):
    with patch.object(main_module, "get_share", new=AsyncMock(return_value=None)):
        res = client.get("/api/shared/does-not-exist")
    assert res.status_code == 404
