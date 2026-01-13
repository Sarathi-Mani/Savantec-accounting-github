"""Authentication API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.database.connection import get_db
from app.database.payroll_models import  Employee, Designation
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
                is_verified=True,
                is_active=True  # Add this
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Ensure user has is_active field
            if not hasattr(user, 'is_active'):
                user.is_active = True
            db.commit()
        
        # NEW: Check employees table for role/designation information
        employee = db.query(Employee).filter(
            (Employee.email == data.email) | 
            (Employee.official_email == data.email) |
            (Employee.personal_email == data.email)
        ).first()
        
        # Check employee status if exists
        employee_status = None
        if employee:
            # Get employee status
            employee_status = getattr(employee, 'status', None)
            
            # Update user's is_active based on employee status
            if employee_status and employee_status.lower() == 'inactive':
                user.is_active = False
                db.commit()
            elif employee_status and employee_status.lower() == 'active':
                user.is_active = True
                db.commit()
        
        # Prepare user response with employee/role info
        user_response = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "is_active": user.is_active,  # Make sure this is included
            "is_verified": user.is_verified,
            "created_at": user.created_at,
            # Add employee info if exists
            "employee_id": employee.id if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "department_id": employee.department_id if employee else None,
            "designation_id": employee.designation_id if employee else None,
            "status": employee_status,  # Add employee status
            # Get designation name if exists
            "designation": None,
            "role": None,
            "permissions": []
        }
        
        # If employee has designation, get designation details
        if employee and employee.designation_id:
            designation = db.query(Designation).filter(
                Designation.id == employee.designation_id
            ).first()
            
            if designation:
                user_response["designation"] = designation.name
                user_response["role"] = designation.name  # Use designation as role
                
                # If designations have permissions stored, include them
                if hasattr(designation, 'permissions') and designation.permissions:
                    user_response["permissions"] = designation.permissions
        
        # Get token from result
        access_token = session_info.get("access_token")
        refresh_token = session_info.get("refresh_token")
        
        # Validate the response before returning
        try:
            token_response = TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_in=86400,
                user=user_response  # Use enhanced user response
            )
            return token_response
        except Exception as validation_error:
            print(f"Validation error in login: {validation_error}")
            print(f"User response data: {user_response}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error processing user data"
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


# NEW ENDPOINT: Get user permissions from employee designation
@router.get("/permissions")
async def get_user_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's permissions based on employee designation."""
    
    # Check employees table for this user
    employee = db.query(Employee).filter(
        (Employee.email == current_user.email) | 
        (Employee.official_email == current_user.email) |
        (Employee.personal_email == current_user.email)
    ).first()
    
    if not employee:
        return {"permissions": []}
    
    # Get designation
    if not employee.designation_id:
        return {"permissions": []}
    
    designation = db.query(Designation).filter(
        Designation.id == employee.designation_id
    ).first()
    
    if not designation:
        return {"permissions": []}
    
    # Extract permissions from designation
    # Assuming permissions are stored in designation.permissions JSON field
    permissions = []
    
    if hasattr(designation, 'permissions') and designation.permissions:
        permissions = designation.permissions
    elif hasattr(designation, 'role_permissions'):
        # If you have a separate role_permissions field
        permissions = designation.role_permissions
    
    return {
        "permissions": permissions,
        "employee_id": employee.id,
        "employee_code": employee.employee_code,
        "designation": designation.name,
        "designation_id": designation.id
    }