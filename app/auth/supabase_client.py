"""Supabase client setup."""
from supabase import create_client, Client
from app.config import settings
from functools import lru_cache
from typing import Optional


@lru_cache()
def get_supabase_client() -> Optional[Client]:
    """Get cached Supabase client instance."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        print("Warning: Supabase credentials not configured. Using mock authentication.")
        return None
    
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# Global supabase client instance
supabase = get_supabase_client()


class SupabaseAuth:
    """Supabase authentication helper class."""
    
    def __init__(self, client: Optional[Client] = None):
        self.client = client or get_supabase_client()
    
    async def sign_up(self, email: str, password: str, full_name: str) -> dict:
        """Register a new user."""
        if not self.client:
            # Mock signup for development
            return {
                "user": {
                    "id": "mock-user-id",
                    "email": email,
                    "user_metadata": {"full_name": full_name}
                },
                "session": {
                    "access_token": "mock-access-token",
                    "refresh_token": "mock-refresh-token",
                }
            }
        
        response = self.client.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": full_name
                }
            }
        })
        
        # Convert AuthResponse to dict
        user_data = None
        session_data = None
        
        if response.user:
            user_data = {
                "id": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata or {}
            }
        
        if response.session:
            session_data = {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
            }
        
        return {
            "user": user_data,
            "session": session_data
        }
    
    async def sign_in(self, email: str, password: str) -> dict:
        """Sign in a user."""
        if not self.client:
            # Mock signin for development
            return {
                "user": {
                    "id": "mock-user-id",
                    "email": email,
                    "user_metadata": {}
                },
                "session": {
                    "access_token": "mock-access-token",
                    "refresh_token": "mock-refresh-token",
                }
            }
        
        response = self.client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        # Convert AuthResponse to dict
        user_data = None
        session_data = None
        
        if response.user:
            user_data = {
                "id": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata or {}
            }
        
        if response.session:
            session_data = {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
            }
        
        return {
            "user": user_data,
            "session": session_data
        }
    
    async def sign_out(self, access_token: str) -> bool:
        """Sign out a user."""
        if not self.client:
            return True
        
        try:
            self.client.auth.sign_out()
            return True
        except Exception:
            return False
    
    async def get_user(self, access_token: str) -> Optional[dict]:
        """Get user from access token."""
        if not self.client:
            # Mock user for development
            return {
                "id": "mock-user-id",
                "email": "test@example.com",
                "user_metadata": {"full_name": "Test User"}
            }
        
        try:
            response = self.client.auth.get_user(access_token)
            if response.user:
                return {
                    "id": response.user.id,
                    "email": response.user.email,
                    "user_metadata": response.user.user_metadata or {}
                }
            return None
        except Exception:
            return None
    
    async def reset_password(self, email: str) -> bool:
        """Send password reset email."""
        if not self.client:
            return True
        
        try:
            self.client.auth.reset_password_email(email)
            return True
        except Exception:
            return False

    async def update_password(self, new_password: str) -> bool:
        """Update user's password."""
        if not self.client:
            # Mock for development
            return True
        
        try:
            self.client.auth.update_user({"password": new_password})
            return True
        except Exception as e:
            raise Exception(f"Failed to update password: {e}")


# Global auth helper instance
auth_helper = SupabaseAuth()
