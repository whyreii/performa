"""Authentication routes: form-based login and current-user introspection."""
from __future__ import annotations

import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Response, status
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
from ..emailer import send_password_reset_email, send_verification_email
from ..models import EmailVerificationToken, Organization, PasswordResetToken, User, UserRole
from ..schemas import (
    ForgotPasswordRequest,
    PasswordChange,
    ProfileUpdate,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    Token,
    UserResponse,
    VerifyEmailRequest,
)

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
    # without limit. Evict the oldest key (FIFO) rather than clearing the whole
    # store: a rotating attacker must not be able to flush every existing
    # throttle in one shot (coarse eviction; use a shared store in production).
    if len(_FAILED_ATTEMPTS) >= _MAX_TRACKED_KEYS and key not in _FAILED_ATTEMPTS:
        oldest = next(iter(_FAILED_ATTEMPTS), None)
        if oldest is not None:
            _FAILED_ATTEMPTS.pop(oldest, None)
    _FAILED_ATTEMPTS[key].append(time.monotonic())


def _clear_failures(key: str) -> None:
    _FAILED_ATTEMPTS.pop(key, None)


def _issue_session(response: Response, user: User, remember_me: bool = True) -> Token:
    """Issue a bearer token, set the httpOnly cookie, and return the Token.

    ``remember_me=False`` makes the cookie a browser-session cookie (no Max-Age),
    so the browser discards it when closed. The token itself still expires after
    ACCESS_TOKEN_EXPIRE_MINUTES.
    """
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
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60 if remember_me else None,
        path="/",
    )
    return Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=Token, summary="Authenticate and issue a JWT")
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
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

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before signing in.",
        )

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
    return _issue_session(response, user, remember_me=remember_me)


@router.post(
    "/register",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Self-register an Employer and provision a new tenant",
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Create a new tenant and its first Employer, then email a verification link.

    Public endpoint (no authentication): the registrant becomes the Employer
    owner of a brand-new organization. The account starts **unverified** and
    cannot sign in until the emailed link is followed. A duplicate email, or a
    tenant name already in use, is rejected rather than silently attaching the
    account to an existing workspace.
    """
    # Function-local import breaks the auth <-> admin import cycle (admin
    # imports auth's role helpers at module load time).
    from .admin import _slugify, _unique_slug

    email = payload.email.strip().lower()
    existing_user = (
        await db.execute(select(User.id).where(User.email == email))
    ).scalar_one_or_none()
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        )

    org_name = payload.organization_name.strip()
    existing_org = (
        await db.execute(select(Organization.id).where(Organization.name == org_name))
    ).scalar_one_or_none()
    if existing_org is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That organization name is already in use.",
        )

    slug = await _unique_slug(db, _slugify(org_name))
    organization = Organization(name=org_name, slug=slug)
    db.add(organization)
    await db.flush()

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        role=UserRole.EMPLOYER,
        organization_id=slug,
        is_active=True,
        email_verified=False,
        privacy_consented_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()

    record_activity(
        db,
        organization_id=slug,
        actor=user,
        action="auth.register",
        entity_type="organization",
        entity_id=organization.id,
        detail=f"{org_name} <{email}>",
    )
    record_activity(
        db,
        organization_id=slug,
        actor=user,
        action="auth.consent",
        entity_type="user",
        entity_id=user.id,
        detail="Data Privacy notice (RA 10173)",
    )
    await db.commit()

    await _send_verification_link(db, user)
    return {"status": "verification_sent"}


def _hash_token(token: str) -> str:
    """SHA-256 of a single-use token — only the hash is stored."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _expired(expires_at: datetime, now: datetime) -> bool:
    """True if ``expires_at`` is at/before ``now`` (SQLite drops tzinfo)."""
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now


async def _send_verification_link(db: AsyncSession, user: User) -> None:
    """Issue and email a single-use verification link for ``user``."""
    settings = get_settings()
    ttl_minutes = max(1, settings.email_verification_ttl_minutes)
    raw_token = secrets.token_urlsafe(32)
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        )
    )
    await db.commit()

    base = (settings.app_base_url or "").rstrip("/")
    link = f"{base}/verify-email?token={raw_token}"
    await send_verification_email(
        user.email, user.full_name, link, max(1, ttl_minutes // 60)
    )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request a password-reset link",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Email a reset link when the account exists.

    Always returns 202 so the endpoint cannot be used to enumerate accounts.
    """
    email = payload.email.strip().lower()
    settings = get_settings()

    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()

    if user is not None and user.is_active:
        raw_token = secrets.token_urlsafe(32)
        ttl = max(1, settings.password_reset_ttl_minutes)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash_token(raw_token),
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl),
            )
        )
        record_activity(
            db,
            organization_id=user.organization_id,
            actor=user,
            action="auth.password_reset_requested",
            entity_type="user",
            entity_id=user.id,
            detail=user.email,
        )
        await db.commit()

        base = (settings.app_base_url or "").rstrip("/")
        reset_link = f"{base}/reset-password?token={raw_token}"
        await send_password_reset_email(user.email, user.full_name, reset_link, ttl)

    return {"status": "accepted"}


@router.post(
    "/reset-password",
    response_model=Token,
    summary="Reset a password with a valid token",
)
async def reset_password(
    response: Response,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Consume a single-use reset token, set the new password, and sign in."""
    row = (
        await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == _hash_token(payload.token)
            )
        )
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired.",
    )
    if row is None or row.used_at is not None or _expired(row.expires_at, now):
        raise invalid

    user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise invalid

    user.hashed_password = get_password_hash(payload.new_password)
    row.used_at = now
    record_activity(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="auth.password_reset",
        entity_type="user",
        entity_id=user.id,
        detail=user.email,
    )
    await db.commit()
    return _issue_session(response, user)


@router.post(
    "/verify-email",
    response_model=Token,
    summary="Verify an email address with a token",
)
async def verify_email(
    response: Response,
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Consume a single-use token, mark the account verified, and sign in."""
    row = (
        await db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == _hash_token(payload.token)
            )
        )
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This verification link is invalid or has expired.",
    )
    if row is None or row.used_at is not None or _expired(row.expires_at, now):
        raise invalid

    user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise invalid

    user.email_verified = True
    row.used_at = now
    record_activity(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="auth.email_verified",
        entity_type="user",
        entity_id=user.id,
        detail=user.email,
    )
    await db.commit()
    return _issue_session(response, user)


@router.post(
    "/resend-verification",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Resend the email-verification link",
)
async def resend_verification(
    payload: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Re-send a verification link for an unverified account (always 202)."""
    email = payload.email.strip().lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is not None and user.is_active and not user.email_verified:
        await _send_verification_link(db, user)
    return {"status": "accepted"}


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
