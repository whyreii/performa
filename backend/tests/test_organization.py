"""Organization (tenant) rename tests.

The tenant display name is editable in-app (Admin/Employer) so it is never a
hardcoded placeholder; it resolves to every user through ``/api/auth/me``.
"""
from __future__ import annotations

import pytest

from backend.tests.helpers import (
    ADMIN_EMAIL,
    EMPLOYER_EMAIL,
    SUPERVISOR_EMAIL,
    login_user,
)


@pytest.mark.asyncio
async def test_admin_and_employer_can_rename_organization(client):
    """Admin/Employer rename the tenant; the new name flows to /api/auth/me."""
    for email in (ADMIN_EMAIL, EMPLOYER_EMAIL):
        headers = await login_user(client, email)
        response = await client.patch(
            "/api/organization",
            headers=headers,
            json={"name": "Bagong Pangalan Corp."},
        )
        assert response.status_code == 200, response.text
        assert response.json()["name"] == "Bagong Pangalan Corp."

        me = await client.get("/api/auth/me", headers=headers)
        assert me.json()["organization_name"] == "Bagong Pangalan Corp."


@pytest.mark.asyncio
async def test_supervisor_cannot_rename_organization(client):
    """Supervisors are not permitted to rename the tenant."""
    supervisor = await login_user(client, SUPERVISOR_EMAIL)
    response = await client.patch(
        "/api/organization",
        headers=supervisor,
        json={"name": "Hijacked Corp."},
    )
    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_blank_organization_name_is_rejected(client):
    """A whitespace-only name passes schema validation but is rejected server-side."""
    admin = await login_user(client, ADMIN_EMAIL)
    response = await client.patch(
        "/api/organization", headers=admin, json={"name": "   "}
    )
    assert response.status_code == 400, response.text
