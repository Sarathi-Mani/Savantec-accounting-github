"""Product service for business logic - Unified product with inventory."""
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Tuple, Dict, Any
from decimal import Decimal
from app.database.models import Product, Company
from app.schemas.product import ProductCreate, ProductUpdate


class ProductService:
    """Service for product operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_product(self, company: Company, data: ProductCreate) -> Product:
        """Create a new product for a company (unified with inventory)."""
        product = Product(
            company_id=company.id,
            name=data.name,
            description=data.description,
            sku=data.sku,
            hsn_code=data.hsn_code,
            unit_price=data.unit_price,
            unit=data.unit,
            primary_unit=data.unit or "unit",
            standard_selling_price=data.unit_price,
            gst_rate=data.gst_rate,
            is_inclusive=data.is_inclusive,
            is_service=data.is_service,
            # Stock fields default to 0 for services
            opening_stock=Decimal("0"),
            current_stock=Decimal("0"),
            min_stock_level=Decimal("0"),
        )
        
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product
    
    def get_product(self, product_id: str, company: Company) -> Optional[Product]:
        """Get a product by ID (must belong to company)."""
        return self.db.query(Product).filter(
            Product.id == product_id,
            Product.company_id == company.id
        ).first()
    
    def get_products(
        self,
        company: Company,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        is_service: Optional[bool] = None
    ) -> Tuple[List[Product], int]:
        """Get all products for a company with pagination. Includes stock info."""
        query = self.db.query(Product).filter(
            Product.company_id == company.id,
            Product.is_active == True
        )
        
        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                (Product.name.ilike(search_filter)) |
                (Product.sku.ilike(search_filter)) |
                (Product.hsn_code.ilike(search_filter))
            )
        
        # Service filter
        if is_service is not None:
            query = query.filter(Product.is_service == is_service)
        
        # Get total count
        total = query.count()
        
        # Pagination
        offset = (page - 1) * page_size
        products = query.order_by(Product.name).offset(offset).limit(page_size).all()
        
        return products, total
    
    def get_product_with_stock(self, product: Product) -> Dict[str, Any]:
        """Get product with stock information (unified model)."""
        return {
            "id": product.id,
            "company_id": product.company_id,
            "name": product.name,
            "description": product.description,
            "sku": product.sku,
            "hsn_code": product.hsn_code,
            "unit_price": product.unit_price,
            "unit": product.unit,
            "gst_rate": product.gst_rate,
            "is_inclusive": product.is_inclusive,
            "is_service": product.is_service,
            "is_active": product.is_active,
            "created_at": product.created_at,
            "updated_at": product.updated_at,
            "current_stock": float(product.current_stock) if not product.is_service else None,
            "min_stock_level": float(product.min_stock_level) if not product.is_service else None,
        }
    
    def update_product(self, product: Product, data: ProductUpdate) -> Product:
        """Update a product (unified with inventory)."""
        update_data = data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(product, field, value)
        
        # Sync unit and primary_unit
        if 'unit' in update_data:
            product.primary_unit = product.unit or "unit"
        if 'unit_price' in update_data:
            product.standard_selling_price = product.unit_price
        
        self.db.commit()
        self.db.refresh(product)
        return product
    
    def delete_product(self, product: Product) -> bool:
        """Soft delete a product."""
        product.is_active = False
        self.db.commit()
        return True
    
    def search_products(self, company: Company, query: str, limit: int = 10) -> List[Product]:
        """Quick search for products (for autocomplete)."""
        search_filter = f"%{query}%"
        return self.db.query(Product).filter(
            Product.company_id == company.id,
            Product.is_active == True,
            (Product.name.ilike(search_filter)) |
            (Product.sku.ilike(search_filter)) |
            (Product.hsn_code.ilike(search_filter))
        ).limit(limit).all()

