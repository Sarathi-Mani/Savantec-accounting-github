import sys
sys.path.insert(0, '.')

from app.database.connection import engine, Base
from app.database.models import Brand, Category

def create_brand_category_tables():
    print("=" * 60)
    print("Creating ONLY Brand & Category tables")
    print("=" * 60)

    # Create only selected tables
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Brand.__table__,
            Category.__table__
        ]
    )

    print("✅ Brand & Category tables created (if not already exists)")
    print("=" * 60)

if __name__ == "__main__":
    create_brand_category_tables()
