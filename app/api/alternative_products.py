"""API endpoints for Alternative Products."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.alternative_product_service import AlternativeProductService
from app.schemas.alternative_product import (
    AlternativeProductCreate,
    AlternativeProductUpdate,
    AlternativeProductResponse,
    AlternativeProductListResponse,
    ProductMappingCreate,
    ProductMappingResponse,
    MappedProductResponse,
    AlternativeForProductResponse,
)

router = APIRouter(prefix="/companies/{company_id}", tags=["alternative-products"])


def get_service(db: Session = Depends(get_db)) -> AlternativeProductService:
    """Get alternative product service instance."""
    return AlternativeProductService(db)


@router.post("/alternative-products", response_model=AlternativeProductResponse)
def create_alternative_product(
    company_id: str,
    data: AlternativeProductCreate,
    service: AlternativeProductService = Depends(get_service),
):
    """Create a new alternative product."""
    alt_product = service.create_alternative_product(company_id, data)
    return AlternativeProductResponse(
        id=alt_product.id,
        company_id=alt_product.company_id,
        name=alt_product.name,
        manufacturer=alt_product.manufacturer,
        model_number=alt_product.model_number,
        description=alt_product.description,
        category=alt_product.category,
        specifications=alt_product.specifications,
        reference_url=alt_product.reference_url,
        reference_price=alt_product.reference_price,
        is_active=alt_product.is_active,
        created_at=alt_product.created_at,
        updated_at=alt_product.updated_at,
        mapped_products_count=0,
    )


@router.get("/alternative-products", response_model=AlternativeProductListResponse)
def list_alternative_products(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    manufacturer: Optional[str] = None,
    is_active: Optional[bool] = None,
    service: AlternativeProductService = Depends(get_service),
):
    """List alternative products with pagination and filters."""
    products, total = service.list_alternative_products(
        company_id=company_id,
        page=page,
        page_size=page_size,
        search=search,
        category=category,
        manufacturer=manufacturer,
        is_active=is_active,
    )

    return AlternativeProductListResponse(
        alternative_products=[
            AlternativeProductResponse(
                id=p.id,
                company_id=p.company_id,
                name=p.name,
                manufacturer=p.manufacturer,
                model_number=p.model_number,
                description=p.description,
                category=p.category,
                specifications=p.specifications,
                reference_url=p.reference_url,
                reference_price=p.reference_price,
                is_active=p.is_active,
                created_at=p.created_at,
                updated_at=p.updated_at,
                mapped_products_count=service.get_mapped_products_count(p.id),
            )
            for p in products
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/alternative-products/categories", response_model=List[str])
def get_categories(
    company_id: str,
    service: AlternativeProductService = Depends(get_service),
):
    """Get distinct categories for filtering."""
    return service.get_categories(company_id)


@router.get("/alternative-products/manufacturers", response_model=List[str])
def get_manufacturers(
    company_id: str,
    service: AlternativeProductService = Depends(get_service),
):
    """Get distinct manufacturers for filtering."""
    return service.get_manufacturers(company_id)


@router.get("/alternative-products/{alternative_product_id}", response_model=AlternativeProductResponse)
def get_alternative_product(
    company_id: str,
    alternative_product_id: str,
    service: AlternativeProductService = Depends(get_service),
):
    """Get an alternative product by ID."""
    alt_product = service.get_alternative_product(company_id, alternative_product_id)
    if not alt_product:
        raise HTTPException(status_code=404, detail="Alternative product not found")

    return AlternativeProductResponse(
        id=alt_product.id,
        company_id=alt_product.company_id,
        name=alt_product.name,
        manufacturer=alt_product.manufacturer,
        model_number=alt_product.model_number,
        description=alt_product.description,
        category=alt_product.category,
        specifications=alt_product.specifications,
        reference_url=alt_product.reference_url,
        reference_price=alt_product.reference_price,
        is_active=alt_product.is_active,
        created_at=alt_product.created_at,
        updated_at=alt_product.updated_at,
        mapped_products_count=service.get_mapped_products_count(alt_product.id),
    )


@router.put("/alternative-products/{alternative_product_id}", response_model=AlternativeProductResponse)
def update_alternative_product(
    company_id: str,
    alternative_product_id: str,
    data: AlternativeProductUpdate,
    service: AlternativeProductService = Depends(get_service),
):
    """Update an alternative product."""
    alt_product = service.update_alternative_product(
        company_id, alternative_product_id, data
    )
    if not alt_product:
        raise HTTPException(status_code=404, detail="Alternative product not found")

    return AlternativeProductResponse(
        id=alt_product.id,
        company_id=alt_product.company_id,
        name=alt_product.name,
        manufacturer=alt_product.manufacturer,
        model_number=alt_product.model_number,
        description=alt_product.description,
        category=alt_product.category,
        specifications=alt_product.specifications,
        reference_url=alt_product.reference_url,
        reference_price=alt_product.reference_price,
        is_active=alt_product.is_active,
        created_at=alt_product.created_at,
        updated_at=alt_product.updated_at,
        mapped_products_count=service.get_mapped_products_count(alt_product.id),
    )


@router.delete("/alternative-products/{alternative_product_id}")
def delete_alternative_product(
    company_id: str,
    alternative_product_id: str,
    hard_delete: bool = Query(False),
    service: AlternativeProductService = Depends(get_service),
):
    """Delete an alternative product (soft delete by default)."""
    success = service.delete_alternative_product(
        company_id, alternative_product_id, soft_delete=not hard_delete
    )
    if not success:
        raise HTTPException(status_code=404, detail="Alternative product not found")

    return {"message": "Alternative product deleted successfully"}


@router.post(
    "/alternative-products/{alternative_product_id}/map-product",
    response_model=ProductMappingResponse,
)
def map_product(
    company_id: str,
    alternative_product_id: str,
    data: ProductMappingCreate,
    service: AlternativeProductService = Depends(get_service),
):
    """Map a company product to an alternative product."""
    mapping = service.map_product(
        company_id, alternative_product_id, data
    )
    if not mapping:
        raise HTTPException(
            status_code=404,
            detail="Alternative product or company product not found",
        )

    return ProductMappingResponse(
        id=mapping.id,
        product_id=mapping.product_id,
        alternative_product_id=mapping.alternative_product_id,
        notes=mapping.notes,
        priority=mapping.priority,
        comparison_notes=mapping.comparison_notes,
        created_at=mapping.created_at,
    )


@router.delete("/alternative-products/{alternative_product_id}/map-product/{product_id}")
def unmap_product(
    company_id: str,
    alternative_product_id: str,
    product_id: str,
    service: AlternativeProductService = Depends(get_service),
):
    """Remove a product mapping."""
    success = service.unmap_product(company_id, alternative_product_id, product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mapping not found")

    return {"message": "Product mapping removed successfully"}


@router.get(
    "/alternative-products/{alternative_product_id}/mapped-products",
    response_model=List[MappedProductResponse],
)
def get_mapped_products(
    company_id: str,
    alternative_product_id: str,
    service: AlternativeProductService = Depends(get_service),
):
    """Get all products mapped to an alternative product."""
    mapped = service.get_mapped_products(company_id, alternative_product_id)
    return [MappedProductResponse(**m) for m in mapped]


@router.get(
    "/products/{product_id}/alternatives",
    response_model=List[AlternativeForProductResponse],
)
def get_alternatives_for_product(
    company_id: str,
    product_id: str,
    service: AlternativeProductService = Depends(get_service),
):
    """Get all alternative products for a company product."""
    alternatives = service.get_alternatives_for_product(company_id, product_id)
    return [AlternativeForProductResponse(**a) for a in alternatives]

