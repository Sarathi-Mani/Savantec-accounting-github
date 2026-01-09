"""Brand service."""
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime
from typing import Optional, Tuple, List
from app.database.models import Brand, Company
from app.schemas.brand import BrandCreate, BrandUpdate


class BrandService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_brand(self, company: Company, data: BrandCreate, user_id: str) -> Brand:
        """Create a new brand."""
        # Check if brand with same name already exists (non-deleted)
        existing = self.db.query(Brand).filter(
            Brand.company_id == company.id,
            Brand.name == data.name,
            Brand.deleted_at.is_(None)
        ).first()
        
        if existing:
            return existing
        
        brand = Brand(
            name=data.name,
            description=data.description,
            company_id=company.id,
            created_by=user_id
        )
        
        self.db.add(brand)
        self.db.commit()
        self.db.refresh(brand)
        return brand
    
    def get_brands(self, company: Company, page: int = 1, page_size: int = 20, search: str = None) -> Tuple[List[Brand], int]:
        """Get brands for a company with pagination and search - only name and description."""
        query = self.db.query(Brand).filter(
            Brand.company_id == company.id,
            Brand.deleted_at.is_(None)
        )
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Brand.name.ilike(search_term),
                    Brand.description.ilike(search_term)
                )
            )
        
        # Count total before pagination
        total = query.count()
        
        # Apply pagination
        brands = query.order_by(Brand.name)\
            .offset((page - 1) * page_size)\
            .limit(page_size)\
            .all()
        
        return brands, total
    
    def search_brands(self, company: Company, q: str, limit: int = 10) -> List[Brand]:
        """Search brands by name - for dropdown autocomplete."""
        query = self.db.query(Brand).filter(
            Brand.company_id == company.id,
            Brand.deleted_at.is_(None),
            Brand.name.ilike(f"%{q}%")
        ).order_by(Brand.name).limit(limit).all()
        
        return query
    
    def get_brand(self, brand_id: str, company: Company) -> Optional[Brand]:
        """Get a brand by ID."""
        brand = self.db.query(Brand).filter(
            Brand.id == brand_id,
            Brand.company_id == company.id,
            Brand.deleted_at.is_(None)
        ).first()
        
        return brand
    
    def update_brand(self, brand: Brand, data: BrandUpdate) -> Brand:
        """Update a brand."""
        update_data = {}
        
        if data.name is not None:
            update_data["name"] = data.name
        if data.description is not None:
            update_data["description"] = data.description
        
        if update_data:
            # Check if new name conflicts with existing brand
            if "name" in update_data and update_data["name"] != brand.name:
                existing = self.db.query(Brand).filter(
                    Brand.company_id == brand.company_id,
                    Brand.name == update_data["name"],
                    Brand.deleted_at.is_(None),
                    Brand.id != brand.id
                ).first()
                
                if existing:
                    raise ValueError(f"Brand with name '{update_data['name']}' already exists")
            
            for key, value in update_data.items():
                setattr(brand, key, value)
            
            brand.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(brand)
        
        return brand
    
    def delete_brand(self, brand: Brand) -> bool:
        """Soft delete a brand."""
        brand.deleted_at = datetime.utcnow()
        brand.updated_at = datetime.utcnow()
        self.db.commit()
        return True