"""Unit tests for security utilities."""

import pytest
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_token_pair,
    hash_password,
    verify_access_token,
    verify_password,
    verify_refresh_token,
)


def test_password_hash_and_verify():
    plain = "mysecretpassword"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_access_token_creation_and_verification():
    user_id = "test-user-id-123"
    email = "test@example.com"
    role = "admin"

    token = create_access_token(user_id, email, role)
    assert isinstance(token, str)
    assert len(token) > 0

    payload = verify_access_token(token)
    assert payload is not None
    assert payload.sub == user_id
    assert payload.email == email
    assert payload.role == role
    assert payload.type == "access"


def test_refresh_token_creation_and_verification():
    user_id = "test-user-id-456"
    email = "test2@example.com"
    role = "user"

    token = create_refresh_token(user_id, email, role)
    payload = verify_refresh_token(token)

    assert payload is not None
    assert payload.type == "refresh"
    assert payload.sub == user_id


def test_access_token_rejected_as_refresh():
    token = create_access_token("uid", "e@e.com", "user")
    assert verify_refresh_token(token) is None


def test_refresh_token_rejected_as_access():
    token = create_refresh_token("uid", "e@e.com", "user")
    assert verify_access_token(token) is None


def test_invalid_token_returns_none():
    assert verify_access_token("not.a.valid.token") is None
    assert verify_refresh_token("garbage") is None


def test_token_pair():
    pair = create_token_pair("uid-789", "pair@test.com", "manager")
    assert pair.access_token
    assert pair.refresh_token
    assert pair.token_type == "bearer"
    assert pair.expires_in > 0

    access_payload = verify_access_token(pair.access_token)
    assert access_payload is not None
    assert access_payload.sub == "uid-789"
