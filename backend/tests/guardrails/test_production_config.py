"""Guardrail: a real deployment must not boot with the development secret.

The app used to start with ``SECRET_KEY`` at its development default, so a
deployed instance would sign JWTs with a public, known key. ``Settings`` now
refuses to construct when the environment is not a dev/test value and the
secret is still the default.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.config import DEFAULT_SECRET_KEY, Settings


def test_default_secret_is_rejected_in_production():
    with pytest.raises(ValidationError):
        Settings(environment="production", secret_key=DEFAULT_SECRET_KEY)


def test_default_secret_is_rejected_in_staging():
    with pytest.raises(ValidationError):
        Settings(environment="staging", secret_key=DEFAULT_SECRET_KEY)


def test_default_secret_is_allowed_in_development():
    settings = Settings(environment="development", secret_key=DEFAULT_SECRET_KEY)
    assert settings.secret_key == DEFAULT_SECRET_KEY


def test_a_real_secret_is_allowed_in_production():
    settings = Settings(environment="production", secret_key="a-strong-random-secret-value")
    assert settings.secret_key == "a-strong-random-secret-value"
