"""Authentication routes: form-based login and current-user introspection."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import (
    ACCESS_TOKEN_COOKIE,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from ..audit import record_activity
from ..config import get_settings
from ..database import get_db
from ..models import Organization, User
from ..schemas import PasswordChange, ProfileUpdate, Token, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Lightweight in-process login throttle (per email). For multi-worker
# deployments this should be backed by a shared store (e.g. Redis).
_FAILED_ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)
_MAX_FAILED_ATTEMPTS = 5
_FAILED_WINDOW_SECONDS = 300
_MAX_TRACKED_KEYS = 5000


def _is_rate_limited(key: str) -> bool:
    now = time.monotonic()
    # .get() (not defaultdict access) so probing unknown usernames never
    # creates unbounded entries in the throttle store.
    attempts = _FAILED_ATTEMPTS.get(key)
    if not attempts:
        return False
    while attempts and now - attempts[0] > _FAILED_WINDOW_SECONDS:
        attempts.popleft()
    if not attempts:
        _FAILED_ATTEMPTS.pop(key, None)
        return False
    return len(attempts) >= _MAX_FAILED_ATTEMPTS


def _record_failure(key: str) -> None:
    # Bound the store so a flood of distinct failing usernames cannot grow it
    # without limit (coarse eviction; use a shared store in production).
    if len(_FAILED_ATTEMPTS) >= _MAX_TRACKED_KEYS and key not in _FAILED_ATTEMPTS:
        _FAILED_ATTEMPTS.clear()
    _FAILED_ATTEMPTS[key].append(time.monotonic())


def _clear_failures(key: str) -> None:
    _FAILED_ATTEMPTS.pop(key, None)


@router.post("/login", response_model=Token, summary="Authenticate and issue a JWT")
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Validate credentials and return a bearer access token."""
    attempt_key = form_data.username.strip().lower()
    if _is_rate_limited(attempt_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
        )

    result = await db.execute(select(User).where(User.email == attempt_key))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(form_data.password, user.hashed_password):
        _record_failure(attempt_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _clear_failures(attempt_key)
    record_activity(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="auth.login",
        entity_type="user",
        entity_id=user.id,
        detail=user.email,
    )
    await db.commit()
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "organization_id": user.organization_id,
        }
    )
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return Token(access_token=access_token, token_type="bearer")


async def _with_organization_name(user: User, db: AsyncSession) -> UserResponse:
    """Serialize a user, enriching the response with the tenant's display name."""
    response = UserResponse.model_validate(user)
    org = (
        await db.execute(
            select(Organization).where(Organization.slug == user.organization_id)
        )
    ).scalar_one_or_none()
    if org is not None:
        response.organization_name = org.name
    return response


@router.get("/me", response_model=UserResponse, summary="Return the authenticated user")
async def read_current_user(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return await _with_organization_name(current_user, db)


@router.post("/logout", summary="Clear the authentication cookie")
async def logout(response: Response) -> dict[str, str]:
    """Clear the httpOnly authentication cookie."""
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    return {"status": "success", "message": "Signed out"}


@router.patch("/me", response_model=UserResponse, summary="Update the authenticated user's profile")
async def update_current_user(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Allow a user to update their own full name and email."""
    if payload.email is not None and payload.email != current_user.email:
        existing = await db.execute(select(User.id).where(User.email == payload.email))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That email address is already in use.",
            )
        current_user.email = payload.email

    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email address is already in use.",
        )
    await db.refresh(current_user)
    return await _with_organization_name(current_user, db)


@router.post("/change-password", summary="Change the current user's password")
async def change_password(
    payload: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Verify the current password and replace it with the new one."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from the current password",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return {"status": "success", "message": "Password updated successfully"}


__all__ = ["router"]
