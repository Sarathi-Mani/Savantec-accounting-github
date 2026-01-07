"""Category service."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.models import Category, Product, Company
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_category(self, company: Company, data: CategoryCreate, user_id: str) -> Category:
        """Create a new category."""
        # Check if category with same name already exists
        existing = self.db.query(Category).filter(
            Category.company_id == company.id,
            Category.name == data.name,
            Category.deleted_at.is_(None)
        ).first()
        
        if existing:
            return existing
        
        category = Category(
            name=data.name,
            description=data.description,
            company_id=company.id,
            created_by=user_id
        )
        
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category
    
    def get_categories(self, company: Company, page: int = 1, page_size: int = 20, search: str = None):
        """Get categories for a company."""
        query = self.db.query(Category).filter(
            Category.company_id == company.id,
            Category.deleted_at.is_(None)
        )
        
        if search:
            query = query.filter(Category.name.ilike(f"%{search}%"))
        
        # Count total
        total = query.count()
        
        # Apply pagination
        categories = query.order_by(Category.name).offset((page - 1) * page_size).limit(page_size).all()
        
        # Get product counts for each category
        for category in categories:
            category.product_count = self.db.query(func.count(Product.id)).filter(
                Product.category_id == category.id,
                Product.deleted_at.is_(None)
            ).scalar() or 0
        
        return categories, total
    
    def get_category(self, category_id: str, company: Company) -> Category:
        """Get a category by ID."""
        category = self.db.query(Category).filter(
            Category.id == category_id,
            Category.company_id == company.id,
            Category.deleted_at.is_(None)
        ).first()
        
        if category:
            # Get product count
            category.product_count = self.db.query(func.count(Product.id)).filter(
                Product.category_id == category.id,
                Product.deleted_at.is_(None)
            ).scalar() or 0
        
        return category
    
    def update_category(self, category: Category, data: CategoryUpdate) -> Category:
        """Update a category."""
        if data.name is not None:
            category.name = data.name
        if data.description is not None:
            category.description = data.description
        
        self.db.commit()
        self.db.refresh(category)
        return category
    
    def delete_category(self, category: Category):
        """Soft delete a category."""
        # Check if category has products
        product_count = self.db.query(func.count(Product.id)).filter(
            Product.category_id == category.id,
            Product.deleted_at.is_(None)
        ).scalar() or 0
        
        if product_count > 0:
            raise ValueError("Cannot delete category with associated products")
        
        category.deleted_at = func.now()
        self.db.commit()