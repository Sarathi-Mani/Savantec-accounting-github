"""Authentication dependencies for FastAPI."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from typing import Optional
from app.database.connection import get_db
from app.database.models import User
from app.config import settings
from app.auth.supabase_client import auth_helper

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)


async def get_token_from_header(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """Extract token from Authorization header."""
    if credentials:
        return credentials.credentials
    return None


async def verify_supabase_token(token: str) -> Optional[dict]:
    """Verify Supabase JWT token."""
    try:
        # For Supabase, we can verify the token using their API
        user = await auth_helper.get_user(token)
        return user
    except Exception:
        return None


async def get_current_user(
    token: Optional[str] = Depends(get_token_from_header),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
    
    # For development without Supabase
    if token == "mock-access-token" or not settings.SUPABASE_URL:
        # Try to find mock user or create one
        user = db.query(User).filter(User.email == "test@example.com").first()
        if not user:
            user = User(
                email="test@example.com",
                full_name="Test User",
                supabase_id="mock-user-id",
                is_verified=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    
    # Verify token with Supabase
    supabase_user = await verify_supabase_token(token)
    if not supabase_user:
        raise credentials_exception
    
    # Get or create local user
    user = db.query(User).filter(User.supabase_id == supabase_user.get("id")).first()
    
    if not user:
        # Create user from Supabase data
        user = User(
            supabase_id=supabase_user.get("id"),
            email=supabase_user.get("email"),
            full_name=supabase_user.get("user_metadata", {}).get("full_name", ""),
            is_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_optional_user(
    token: Optional[str] = Depends(get_token_from_header),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise None."""
    if not token:
        return None
    
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None

