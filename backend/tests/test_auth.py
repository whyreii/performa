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


def test_verify_password_handles_malformed_hash():
    """verify_password returns False gracefully on malformed or empty hash inputs."""
    assert verify_password("anything", "not-a-valid-hash") is False
    assert verify_password("anything", "") is False
