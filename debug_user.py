# debug_user.py
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database.connection import engine
from app.database.models import User

# Create session
with Session(engine) as db:
    # Check if user exists
    email = "krithikvijayakumar11@gmail.com"
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        print(f"✓ User found: {user.email}")
        print(f"  Full Name: {user.full_name}")
        print(f"  Is Active: {user.is_active}")
        print(f"  Is Verified: {user.is_verified}")
        print(f"  Created At: {user.created_at}")
        
        # Check if there are any users in the database
        all_users = db.query(User).all()
        print(f"\nTotal users in database: {len(all_users)}")
        for u in all_users:
            print(f"  - {u.email} ({'active' if u.is_active else 'inactive'})")
    else:
        print(f"✗ User '{email}' not found in database")
        
        # List all tables to check if users table exists
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"\nAvailable tables: {tables}")
        
        if 'users' in tables:
            print("✓ 'users' table exists")
        else:
            print("✗ 'users' table does not exist!")