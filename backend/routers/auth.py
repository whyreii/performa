"""Authentication routes: form-based login and current-user introspection."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import create_access_token, get_current_user, verify_password
from ..database import get_db
from ..models import User
from ..schemas import Token, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=Token, summary="Authenticate and issue a JWT")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Validate credentials and return a bearer access token."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "organization_id": user.organization_id,
        }
    )
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse, summary="Return the authenticated user")
async def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    """Return the profile of the currently authenticated user."""
    return current_user


__all__ = ["router"]
