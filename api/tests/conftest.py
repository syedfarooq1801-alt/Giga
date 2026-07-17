import sys
import os
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from starlette.testclient import TestClient

import main as main_module
from main import app, api_app, get_current_user

FAKE_USER = {"uid": "test-uid", "profile_id": "test-uid_password", "email": "test@example.com"}


@pytest.fixture
def client():
    api_app.dependency_overrides[get_current_user] = lambda: FAKE_USER
    yield TestClient(app)
    api_app.dependency_overrides.clear()


@pytest.fixture
def fake_uid():
    return FAKE_USER["uid"]


@pytest.fixture
def fake_profile_id():
    return FAKE_USER["profile_id"]


@pytest.fixture
def mock_db(monkeypatch):
    """Patches main.db with a MagicMock so tests never touch real Firestore."""
    mock = MagicMock()
    monkeypatch.setattr(main_module, "db", mock)
    return mock
