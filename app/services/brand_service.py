"""Brand service."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.models import Brand, Product, Company
from app.schemas.brand import BrandCreate, BrandUpdate


class BrandService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_brand(self, company: Company, data: BrandCreate, user_id: str) -> Brand:
        """Create a new brand."""
        # Check if brand with same name already exists
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
    
    def get_brands(self, company: Company, page: int = 1, page_size: int = 20, search: str = None):
        """Get brands for a company."""
        query = self.db.query(Brand).filter(
            Brand.company_id == company.id,
            Brand.deleted_at.is_(None)
        )
        
        if search:
            query = query.filter(Brand.name.ilike(f"%{search}%"))
        
        # Count total
        total = query.count()
        
        # Apply pagination
        brands = query.order_by(Brand.name).offset((page - 1) * page_size).limit(page_size).all()
        
        # Get product counts for each brand
        for brand in brands:
            brand.product_count = self.db.query(func.count(Product.id)).filter(
                Product.brand_id == brand.id,
                Product.deleted_at.is_(None)
            ).scalar() or 0
        
        return brands, total
    
    def get_brand(self, brand_id: str, company: Company) -> Brand:
        """Get a brand by ID."""
        brand = self.db.query(Brand).filter(
            Brand.id == brand_id,
            Brand.company_id == company.id,
            Brand.deleted_at.is_(None)
        ).first()
        
        if brand:
            # Get product count
            brand.product_count = self.db.query(func.count(Product.id)).filter(
                Product.brand_id == brand.id,
                Product.deleted_at.is_(None)
            ).scalar() or 0
        
        return brand
    
    def update_brand(self, brand: Brand, data: BrandUpdate) -> Brand:
        """Update a brand."""
        if data.name is not None:
            brand.name = data.name
        if data.description is not None:
            brand.description = data.description
        
        self.db.commit()
        self.db.refresh(brand)
        return brand
    
    def delete_brand(self, brand: Brand):
        """Soft delete a brand."""
        # Check if brand has products
        product_count = self.db.query(func.count(Product.id)).filter(
            Product.brand_id == brand.id,
            Product.deleted_at.is_(None)
        ).scalar() or 0
        
        if product_count > 0:
            raise ValueError("Cannot delete brand with associated products")
        
        brand.deleted_at = func.now()
        self.db.commit()