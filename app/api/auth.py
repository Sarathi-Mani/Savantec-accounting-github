"""Authentication API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import User
from app.schemas.auth import UserCreate, UserLogin, UserResponse, TokenResponse, UserUpdate, PasswordChange
from app.auth.supabase_client import auth_helper
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    try:
        # Register with Supabase
        result = await auth_helper.sign_up(data.email, data.password, data.full_name)
        
        # Extract user info
        user_info = result.get("user") or {}
        session_info = result.get("session") or {}
        
        # Create local user
        user = User(
            email=data.email,
            full_name=data.full_name,
            phone=data.phone,
            supabase_id=user_info.get("id", "") if isinstance(user_info, dict) else "",
            is_verified=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Get token from result
        access_token = session_info.get("access_token", "pending-verification") if isinstance(session_info, dict) else "pending-verification"
        refresh_token = session_info.get("refresh_token") if isinstance(session_info, dict) else None
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=86400,
            user=UserResponse.model_validate(user)
        )
    except Exception as e:
        print(f"Registration error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    """Login a user."""
    try:
        # Login with Supabase
        result = await auth_helper.sign_in(data.email, data.password)
        
        # Extract info
        user_info = result.get("user") or {}
        session_info = result.get("session") or {}
        
        if not session_info or not session_info.get("access_token"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Get or create local user
        user = db.query(User).filter(User.email == data.email).first()
        
        if not user:
            user_metadata = user_info.get("user_metadata", {}) if isinstance(user_info, dict) else {}
            user = User(
                email=data.email,
                full_name=user_metadata.get("full_name", data.email.split("@")[0]),
                supabase_id=user_info.get("id", "") if isinstance(user_info, dict) else "",
                is_verified=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Get token from result
        access_token = session_info.get("access_token")
        refresh_token = session_info.get("refresh_token")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=86400,
            user=UserResponse.model_validate(user)
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout the current user."""
    # With Supabase, logout is handled client-side
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
async def forgot_password(email: str):
    """Send password reset email."""
    try:
        await auth_helper.reset_password(email)
        return {"message": "Password reset email sent if account exists"}
    except Exception:
        # Don't reveal if email exists
        return {"message": "Password reset email sent if account exists"}


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile."""
    update_data = data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if value is not None:
            setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user's password."""
    try:
        # Verify current password by attempting to sign in
        await auth_helper.sign_in(current_user.email, data.current_password)
        
        # Update password in Supabase
        await auth_helper.update_password(data.new_password)
        
        return {"message": "Password updated successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
