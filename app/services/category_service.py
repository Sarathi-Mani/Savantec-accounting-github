"""Category service."""
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime
from typing import Optional, Tuple, List
from app.database.models import Category, Company
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_category(self, company: Company, data: CategoryCreate, user_id: str) -> Category:
        """Create a new category."""
        # Check if category with same name already exists (non-deleted)
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
    
    def get_categories(self, company: Company, page: int = 1, page_size: int = 20, search: str = None) -> Tuple[List[Category], int]:
        """Get categories for a company with pagination and search - only name and description."""
        query = self.db.query(Category).filter(
            Category.company_id == company.id,
            Category.deleted_at.is_(None)
        )
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Category.name.ilike(search_term),
                    Category.description.ilike(search_term)
                )
            )
        
        # Count total before pagination
        total = query.count()
        
        # Apply pagination
        categories = query.order_by(Category.name)\
            .offset((page - 1) * page_size)\
            .limit(page_size)\
            .all()
        
        return categories, total
    
    def search_categories(self, company: Company, q: str, limit: int = 10) -> List[Category]:
        """Search categories by name - for dropdown autocomplete."""
        query = self.db.query(Category).filter(
            Category.company_id == company.id,
            Category.deleted_at.is_(None),
            Category.name.ilike(f"%{q}%")
        ).order_by(Category.name).limit(limit).all()
        
        return query
    
    def get_category(self, category_id: str, company: Company) -> Optional[Category]:
        """Get a category by ID."""
        category = self.db.query(Category).filter(
            Category.id == category_id,
            Category.company_id == company.id,
            Category.deleted_at.is_(None)
        ).first()
        
        return category
    
    def update_category(self, category: Category, data: CategoryUpdate) -> Category:
        """Update a category."""
        update_data = {}
        
        if data.name is not None:
            update_data["name"] = data.name
        if data.description is not None:
            update_data["description"] = data.description
        
        if update_data:
            # Check if new name conflicts with existing category
            if "name" in update_data and update_data["name"] != category.name:
                existing = self.db.query(Category).filter(
                    Category.company_id == category.company_id,
                    Category.name == update_data["name"],
                    Category.deleted_at.is_(None),
                    Category.id != category.id
                ).first()
                
                if existing:
                    raise ValueError(f"Category with name '{update_data['name']}' already exists")
            
            for key, value in update_data.items():
                setattr(category, key, value)
            
            category.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(category)
        
        return category
    
    def delete_category(self, category: Category) -> bool:
        """Soft delete a category."""
        category.deleted_at = datetime.utcnow()
        category.updated_at = datetime.utcnow()
        self.db.commit()
        return True