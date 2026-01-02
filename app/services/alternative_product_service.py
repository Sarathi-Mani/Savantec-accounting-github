"""Service for managing Alternative Products and product mappings."""
from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database.models import (
    AlternativeProduct,
    ProductAlternativeMapping,
    Product,
)
from app.schemas.alternative_product import (
    AlternativeProductCreate,
    AlternativeProductUpdate,
    ProductMappingCreate,
)


class AlternativeProductService:
    """Service class for Alternative Product operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_alternative_product(
        self,
        company_id: str,
        data: AlternativeProductCreate,
    ) -> AlternativeProduct:
        """Create a new alternative product."""
        alt_product = AlternativeProduct(
            company_id=company_id,
            name=data.name,
            manufacturer=data.manufacturer,
            model_number=data.model_number,
            description=data.description,
            category=data.category,
            specifications=data.specifications,
            reference_url=data.reference_url,
            reference_price=data.reference_price,
        )
        self.db.add(alt_product)
        self.db.commit()
        self.db.refresh(alt_product)
        return alt_product

    def get_alternative_product(
        self,
        company_id: str,
        alternative_product_id: str,
    ) -> Optional[AlternativeProduct]:
        """Get an alternative product by ID."""
        return (
            self.db.query(AlternativeProduct)
            .filter(
                AlternativeProduct.id == alternative_product_id,
                AlternativeProduct.company_id == company_id,
            )
            .first()
        )

    def list_alternative_products(
        self,
        company_id: str,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        category: Optional[str] = None,
        manufacturer: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[AlternativeProduct], int]:
        """List alternative products with pagination and filters."""
        query = self.db.query(AlternativeProduct).filter(
            AlternativeProduct.company_id == company_id
        )

        # Apply filters
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    AlternativeProduct.name.ilike(search_term),
                    AlternativeProduct.manufacturer.ilike(search_term),
                    AlternativeProduct.model_number.ilike(search_term),
                    AlternativeProduct.description.ilike(search_term),
                )
            )

        if category:
            query = query.filter(AlternativeProduct.category == category)

        if manufacturer:
            query = query.filter(AlternativeProduct.manufacturer == manufacturer)

        if is_active is not None:
            query = query.filter(AlternativeProduct.is_active == is_active)

        # Get total count
        total = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        products = (
            query
            .order_by(AlternativeProduct.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        return products, total

    def update_alternative_product(
        self,
        company_id: str,
        alternative_product_id: str,
        data: AlternativeProductUpdate,
    ) -> Optional[AlternativeProduct]:
        """Update an alternative product."""
        alt_product = self.get_alternative_product(company_id, alternative_product_id)
        if not alt_product:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(alt_product, key, value)

        alt_product.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(alt_product)
        return alt_product

    def delete_alternative_product(
        self,
        company_id: str,
        alternative_product_id: str,
        soft_delete: bool = True,
    ) -> bool:
        """Delete an alternative product (soft delete by default)."""
        alt_product = self.get_alternative_product(company_id, alternative_product_id)
        if not alt_product:
            return False

        if soft_delete:
            alt_product.is_active = False
            alt_product.updated_at = datetime.utcnow()
        else:
            self.db.delete(alt_product)

        self.db.commit()
        return True

    def map_product(
        self,
        company_id: str,
        alternative_product_id: str,
        data: ProductMappingCreate,
        created_by: Optional[str] = None,
    ) -> Optional[ProductAlternativeMapping]:
        """Map a company product to an alternative product."""
        # Verify alternative product exists and belongs to company
        alt_product = self.get_alternative_product(company_id, alternative_product_id)
        if not alt_product:
            return None

        # Verify product exists and belongs to company
        product = (
            self.db.query(Product)
            .filter(
                Product.id == data.product_id,
                Product.company_id == company_id,
            )
            .first()
        )
        if not product:
            return None

        # Check if mapping already exists
        existing = (
            self.db.query(ProductAlternativeMapping)
            .filter(
                ProductAlternativeMapping.product_id == data.product_id,
                ProductAlternativeMapping.alternative_product_id == alternative_product_id,
            )
            .first()
        )
        if existing:
            # Update existing mapping
            existing.notes = data.notes
            existing.priority = data.priority or 0
            existing.comparison_notes = data.comparison_notes
            self.db.commit()
            self.db.refresh(existing)
            return existing

        # Create new mapping
        mapping = ProductAlternativeMapping(
            product_id=data.product_id,
            alternative_product_id=alternative_product_id,
            notes=data.notes,
            priority=data.priority or 0,
            comparison_notes=data.comparison_notes,
            created_by=created_by,
        )
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def unmap_product(
        self,
        company_id: str,
        alternative_product_id: str,
        product_id: str,
    ) -> bool:
        """Remove a product mapping."""
        # Verify alternative product exists and belongs to company
        alt_product = self.get_alternative_product(company_id, alternative_product_id)
        if not alt_product:
            return False

        mapping = (
            self.db.query(ProductAlternativeMapping)
            .filter(
                ProductAlternativeMapping.product_id == product_id,
                ProductAlternativeMapping.alternative_product_id == alternative_product_id,
            )
            .first()
        )
        if not mapping:
            return False

        self.db.delete(mapping)
        self.db.commit()
        return True

    def get_mapped_products(
        self,
        company_id: str,
        alternative_product_id: str,
    ) -> List[dict]:
        """Get all products mapped to an alternative product."""
        alt_product = self.get_alternative_product(company_id, alternative_product_id)
        if not alt_product:
            return []

        mappings = (
            self.db.query(ProductAlternativeMapping, Product)
            .join(Product, ProductAlternativeMapping.product_id == Product.id)
            .filter(
                ProductAlternativeMapping.alternative_product_id == alternative_product_id
            )
            .order_by(ProductAlternativeMapping.priority, Product.name)
            .all()
        )

        result = []
        for mapping, product in mappings:
            result.append({
                "mapping_id": mapping.id,
                "product_id": product.id,
                "product_name": product.name,
                "product_sku": product.sku,
                "product_unit_price": product.unit_price,
                "notes": mapping.notes,
                "priority": mapping.priority,
                "comparison_notes": mapping.comparison_notes,
                "created_at": mapping.created_at,
            })

        return result

    def get_alternatives_for_product(
        self,
        company_id: str,
        product_id: str,
    ) -> List[dict]:
        """Get all alternative products for a company product."""
        # Verify product belongs to company
        product = (
            self.db.query(Product)
            .filter(
                Product.id == product_id,
                Product.company_id == company_id,
            )
            .first()
        )
        if not product:
            return []

        mappings = (
            self.db.query(ProductAlternativeMapping, AlternativeProduct)
            .join(
                AlternativeProduct,
                ProductAlternativeMapping.alternative_product_id == AlternativeProduct.id,
            )
            .filter(
                ProductAlternativeMapping.product_id == product_id,
                AlternativeProduct.is_active == True,
            )
            .order_by(ProductAlternativeMapping.priority, AlternativeProduct.name)
            .all()
        )

        result = []
        for mapping, alt_product in mappings:
            result.append({
                "mapping_id": mapping.id,
                "alternative_id": alt_product.id,
                "alternative_name": alt_product.name,
                "manufacturer": alt_product.manufacturer,
                "model_number": alt_product.model_number,
                "reference_price": alt_product.reference_price,
                "notes": mapping.notes,
                "priority": mapping.priority,
                "comparison_notes": mapping.comparison_notes,
            })

        return result

    def get_mapped_products_count(
        self,
        alternative_product_id: str,
    ) -> int:
        """Get count of products mapped to an alternative product."""
        return (
            self.db.query(func.count(ProductAlternativeMapping.id))
            .filter(
                ProductAlternativeMapping.alternative_product_id == alternative_product_id
            )
            .scalar()
            or 0
        )

    def get_categories(self, company_id: str) -> List[str]:
        """Get distinct categories for alternative products."""
        result = (
            self.db.query(AlternativeProduct.category)
            .filter(
                AlternativeProduct.company_id == company_id,
                AlternativeProduct.category.isnot(None),
            )
            .distinct()
            .all()
        )
        return [r[0] for r in result if r[0]]

    def get_manufacturers(self, company_id: str) -> List[str]:
        """Get distinct manufacturers for alternative products."""
        result = (
            self.db.query(AlternativeProduct.manufacturer)
            .filter(
                AlternativeProduct.company_id == company_id,
                AlternativeProduct.manufacturer.isnot(None),
            )
            .distinct()
            .all()
        )
        return [r[0] for r in result if r[0]]

