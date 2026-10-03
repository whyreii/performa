"""Shared test helper utilities for Performa test suites."""
from __future__ import annotations

DEFAULT_PASSWORD = "Password123!"
ADMIN_EMAIL = "admin@acme.com"
EMPLOYER_EMAIL = "employer@acme.com"
SUPERVISOR_EMAIL = "supervisor@acme.com"
EMP1_EMAIL = "emp1@acme.com"


async def login_user(client, email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
    """Authenticate and return an Authorization Bearer header dictionary."""
    response = await client.post(
        "/api/auth/login", data={"username": email, "password": password}
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def find_employee_id(client, headers: dict[str, str], full_name: str) -> str:
    """Look up an employee profile UUID by their full name."""
    response = await client.get("/api/employees/", headers=headers)
    assert response.status_code == 200, response.text
    return next(
        emp["id"] for emp in response.json() if emp["user"]["full_name"] == full_name
    )


async def find_employee_by_email(client, headers: dict[str, str], email: str) -> str:
    """Look up an employee profile UUID by their user email address."""
    response = await client.get("/api/employees/", headers=headers)
    assert response.status_code == 200, response.text
    return next(
        emp["id"] for emp in response.json() if emp["user"]["email"] == email
    )
