"""Authentication, password hashing, JWT handling, and RBAC for Performa.

Security primitives are centralised here so routers and dependencies can share
a single source of truth:

* Password hashing via :mod:`passlib` (bcrypt).
* Signed JWT bearer tokens via :mod:`jwt` (PyJWT).
* ``get_current_user`` resolves and validates the active DB-backed user.
* ``require_role`` is a factory producing role-gated dependencies.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt as _bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import DEFAULT_SECRET_KEY, get_settings
from .database import get_db
from .models import User, UserRole

logger = logging.getLogger(__name__)

_settings = get_settings()
SECRET_KEY = _settings.secret_key
ALGORITHM = _settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = _settings.access_token_expire_minutes

if SECRET_KEY == DEFAULT_SECRET_KEY:
    logger.warning(
        "SECRET_KEY is using the insecure development default. "
        "Set the SECRET_KEY environment variable before deploying."
    )

# ---------------------------------------------------------------------------
# bcrypt compatibility shim
# ---------------------------------------------------------------------------
# passlib 1.7.x reads ``bcrypt.__about__.__version__`` and probes the backend
# with a >72 byte secret. bcrypt >= 4.1 removed ``__about__`` and bcrypt >= 5
# raises instead of silently truncating at 72 bytes, both of which break
# passlib's backend detection. Supplying the missing attribute and restoring
# the historical truncation behaviour keeps the required CryptContext API
# functional across bcrypt versions.
if not hasattr(_bcrypt, "__about__"):

    class _BcryptAbout:
        __version__ = getattr(_bcrypt, "__version__", "unknown")

    _bcrypt.__about__ = _BcryptAbout()  # type: ignore[attr-defined]

_bcrypt_hashpw = _bcrypt.hashpw


def _hashpw_truncating(password: bytes, salt: bytes) -> bytes:
    """bcrypt only consumes the first 72 bytes; truncate explicitly."""
    return _bcrypt_hashpw(password[:72], salt)


_bcrypt.hashpw = _hashpw_truncating  # type: ignore[assignment]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ACCESS_TOKEN_COOKIE = "access_token"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return ``True`` when ``plain_password`` matches ``hashed_password``."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Malformed/unknown hash formats must never authenticate.
        return False


def get_password_hash(password: str) -> str:
    """Hash ``password`` with bcrypt and return the encoded digest."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Encode ``data`` as a signed JWT with an expiry claim."""
    to_encode = dict(data)
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta is not None else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode the bearer token (or auth cookie) and return the active user.

    The token is accepted from the ``Authorization: Bearer`` header or, for
    browser clients, from the httpOnly ``access_token`` cookie. Any missing,
    malformed, expired, unknown, or inactive user raises ``401``.
    """
    if not token:
        token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise _credentials_exception()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise _credentials_exception()

    subject = payload.get("sub")
    if not subject:
        raise _credentials_exception()

    user: Optional[User] = None

    try:
        user_id = uuid.UUID(str(subject))
    except (ValueError, TypeError, AttributeError):
        user_id = None

    if user_id is not None:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    if user is None:
        email = payload.get("email") or subject
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise _credentials_exception()

    return user


def require_role(*allowed_roles: UserRole):
    """Build a dependency that only permits the given roles."""

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for current role",
            )
        return current_user

    return role_checker


__all__ = [
    "SECRET_KEY",
    "ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "pwd_context",
    "oauth2_scheme",
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "get_current_user",
    "require_role",
]
