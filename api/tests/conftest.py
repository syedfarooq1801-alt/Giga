import json
import sys
import os
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _fake_service_account_json() -> str:
    """A syntactically valid but throwaway service account credential.

    firebase_admin.initialize_app() parses and holds this at import time
    but never contacts Google with it unless something actually calls
    auth.verify_id_token()/Firestore -- both of which every test here
    either bypasses (get_current_user override) or mocks (mock_db
    fixture). Without this, importing `main` below fails before any
    fixture gets a chance to run, since firebase_auth.py calls
    initialize_firebase() eagerly at module load, and the real
    FIREBASE_SERVICE_ACCOUNT_JSON env var is never set in CI/a fresh
    checkout -- generated fresh each run so the suite never depends on a
    committed fake secret.
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    return json.dumps({
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test-key-id",
        "private_key": private_key_pem,
        "client_email": "test@test-project.iam.gserviceaccount.com",
        "client_id": "000000000000000000000",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com",
    })


os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", _fake_service_account_json())
os.environ.setdefault("FIREBASE_STORAGE_BUCKET", "test-project.appspot.com")

from starlette.testclient import TestClient

import main as main_module
import firebase_memory_manager
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
    """Patches every module-level `db` with the same MagicMock so tests
    never touch real Firestore. main.py and firebase_memory_manager.py
    each call firestore.client() independently at import time and hold
    their own separate reference -- patching only main.db left the real
    business logic (which lives in firebase_memory_manager.py) still
    hitting live Firestore with test-fixture credentials, silently
    slow-failing auth on every call instead of using the mock."""
    mock = MagicMock()
    monkeypatch.setattr(main_module, "db", mock)
    monkeypatch.setattr(firebase_memory_manager, "db", mock)
    return mock
