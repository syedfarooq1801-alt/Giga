from unittest.mock import MagicMock, AsyncMock, patch

import main as main_module


def test_regenerate_overwrites_same_message_id(client, mock_db, fake_uid, fake_profile_id):
    """Regenerating should call update_message_response with the SAME
    message_id it was given -- not create a new doc."""
    fake_doc = MagicMock()
    fake_doc.exists = True
    fake_doc.to_dict.return_value = {"message": "hello bhai", "personality": "swag_bhai"}
    mock_db.collection.return_value.document.return_value.collection.return_value \
        .document.return_value.collection.return_value.document.return_value.get.return_value = fake_doc

    with patch.object(main_module, "_build_chat_messages", new=AsyncMock(return_value=([], fake_uid, fake_profile_id))), \
         patch.object(main_module, "get_groq_response", new=AsyncMock(return_value="Namaste! 😎")), \
         patch.object(main_module, "update_message_response", new=AsyncMock(return_value=True)) as mock_update:

        res = client.post(
            "/api/conversations/some-chat-id/regenerate",
            json={"message_id": "turn-doc-123"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["message_id"] == "turn-doc-123"

    # The key assertion: overwrite targeted the same doc id, not a new one.
    mock_update.assert_called_once()
    call_args = mock_update.call_args
    assert call_args.args[1] == "turn-doc-123" or call_args.kwargs.get("message_doc_id") == "turn-doc-123"


def test_regenerate_404s_on_missing_message(client, mock_db):
    fake_doc = MagicMock()
    fake_doc.exists = False
    mock_db.collection.return_value.document.return_value.collection.return_value \
        .document.return_value.collection.return_value.document.return_value.get.return_value = fake_doc

    res = client.post("/api/conversations/some-chat-id/regenerate", json={"message_id": "nope"})
    assert res.status_code == 404


def test_update_message_response_targets_same_doc_id():
    """Lower-level check on firebase_memory_manager.update_message_response
    itself: it must call .document(message_doc_id) -- an explicit id --
    never .document() with no args (which would mint a new doc)."""
    import asyncio
    import firebase_memory_manager as fmm

    mock_db = MagicMock()
    fake_doc = MagicMock()
    fake_doc.exists = True

    messages_collection = MagicMock()
    messages_collection.document.return_value.get.return_value = fake_doc
    mock_db.collection.return_value.document.return_value.collection.return_value \
        .document.return_value.collection.return_value = messages_collection

    with patch.object(fmm, "db", mock_db):
        result = asyncio.get_event_loop().run_until_complete(
            fmm.update_message_response("chat-1", "turn-doc-123", "uid", "profile-id", "new response text")
        )

    assert result is True
    messages_collection.document.assert_called_with("turn-doc-123")
