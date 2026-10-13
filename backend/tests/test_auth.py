"""Authentication, authorization, session, and credential tests."""
from __future__ import annotations

import pytest

from backend.auth import verify_password
from backend.tests.helpers import (
    DEFAULT_PASSWORD,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    login_user,
)


@pytest.mark.asyncio
async def test_health_reports_database(client):
    """Health check endpoint verifies active database connectivity."""
    response = await client.get("/health")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "ok"


@pytest.mark.asyncio
async def test_cookie_auth_and_logout(client):
    """Login issues an httpOnly cookie, which authenticates requests and is cleared by logout."""
    login_resp = await client.post(
        "/api/auth/login",
        data={"username": EMPLOYER_EMAIL, "password": DEFAULT_PASSWORD},
    )
    assert login_resp.status_code == 200, login_resp.text
    assert "access_token" in login_resp.cookies

    me_resp = await client.get("/api/auth/me")
    assert me_resp.status_code == 200, me_resp.text
    assert me_resp.json()["email"] == EMPLOYER_EMAIL

    logout_resp = await client.post("/api/auth/logout")
    assert logout_resp.status_code == 200, logout_resp.text

    after_resp = await client.get("/api/auth/me")
    assert after_resp.status_code == 401, after_resp.text


@pytest.mark.asyncio
async def test_change_password_flow(client):
    """Users can update their password, which invalidates the old credentials."""
    login_resp = await client.post(
        "/api/auth/login",
        data={"username": SUPERVISOR_EMAIL, "password": DEFAULT_PASSWORD},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    wrong_old = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": "WrongPassword!", "new_password": "NewPassword123!"},
    )
    assert wrong_old.status_code == 400

    too_short = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": DEFAULT_PASSWORD, "new_password": "short"},
    )
    assert too_short.status_code == 422

    success = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": DEFAULT_PASSWORD, "new_password": "NewPassword123!"},
    )
    assert success.status_code == 200

    old_login = await client.post(
        "/api/auth/login",
        data={"username": SUPERVISOR_EMAIL, "password": DEFAULT_PASSWORD},
    )
    assert old_login.status_code == 401

    new_login = await client.post(
        "/api/auth/login",
        data={"username": SUPERVISOR_EMAIL, "password": "NewPassword123!"},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_profile_self_update(client):
    """A user can update their full_name on /api/auth/me."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    update_resp = await client.patch(
        "/api/auth/me",
        headers=supervisor,
        json={"full_name": "Supervisor Juan Updated"},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["full_name"] == "Supervisor Juan Updated"

    me = await client.get("/api/auth/me", headers=supervisor)
    assert me.status_code == 200
    assert me.json()["full_name"] == "Supervisor Juan Updated"


@pytest.mark.asyncio
async def test_register_provisions_new_tenant_and_signs_in(client):
    """Self-registration creates a new tenant + Employer and returns a session."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "full_name": "Nadia Founder",
            "email": "founder@brightco.test",
            "organization_name": "Bright Co. Philippines",
            "password": "Password123!",
        },
    )
    assert resp.status_code == 201, resp.text
    assert "access_token" in resp.cookies

    me = await client.get("/api/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "founder@brightco.test"
    assert me.json()["role"] == "employer"
    assert me.json()["organization_name"] == "Bright Co. Philippines"


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email(client):
    """A duplicate email (case-insensitive) is a 409, not a silent merge."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "full_name": "Impostor",
            "email": EMPLOYER_EMAIL.upper(),
            "organization_name": "Fresh Tenant",
            "password": "Password123!",
        },
    )
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_register_rejects_duplicate_organization_name(client):
    """A tenant name already in use is rejected; the registrant is not attached."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "full_name": "Someone Else",
            "email": "owner@fresh.test",
            "organization_name": "Acme Philippines Corp.",
            "password": "Password123!",
        },
    )
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_register_rejects_short_password(client):
    """Registration enforces the same 8-character password floor as the rest of auth."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "full_name": "Shorty",
            "email": "shorty@fresh.test",
            "organization_name": "Shorty LLC",
            "password": "short",
        },
    )
    assert resp.status_code == 422, resp.text


def test_verify_password_handles_malformed_hash():
    """verify_password returns False gracefully on malformed or empty hash inputs."""
    assert verify_password("anything", "not-a-valid-hash") is False
    assert verify_password("anything", "") is False


def test_login_throttle_blocks_after_max_failures():
    """The per-email throttle blocks once the failure window is saturated."""
    from backend.routers import auth as auth_routes

    store = auth_routes._FAILED_ATTEMPTS
    store.clear()
    try:
        key = "blocked@example.com"
        for _ in range(auth_routes._MAX_FAILED_ATTEMPTS):
            assert auth_routes._is_rate_limited(key) is False
            auth_routes._record_failure(key)
        assert auth_routes._is_rate_limited(key) is True

        auth_routes._clear_failures(key)
        assert auth_routes._is_rate_limited(key) is False
    finally:
        store.clear()


def test_login_throttle_evicts_oldest_not_all(monkeypatch):
    """At capacity, a new failure evicts only the oldest key.

    A rotating attacker must not be able to flush every existing throttle in
    one shot (the previous `store.clear()` behaviour).
    """
    from backend.routers import auth as auth_routes

    monkeypatch.setattr(auth_routes, "_MAX_TRACKED_KEYS", 3)
    store = auth_routes._FAILED_ATTEMPTS
    store.clear()
    try:
        for key in ("a", "b", "c"):
            auth_routes._record_failure(key)
        assert list(store) == ["a", "b", "c"]

        auth_routes._record_failure("d")
        # Only the oldest was evicted; the others survive alongside the new key.
        assert list(store) == ["b", "c", "d"]
    finally:
        store.clear()
