"""Check the __init__.py file."""
import sys
sys.path.insert(0, '.')

try:
    from app.api import brands_router, categories_router
    print("✅ Successfully imported brands_router and categories_router")
except ImportError as e:
    print(f"❌ Import error: {e}")
    
    # Check what's actually in __init__.py
    print("\nChecking app/api/__init__.py content:")
    with open('app/api/__init__.py', 'r') as f:
        content = f.read()
        print(content)