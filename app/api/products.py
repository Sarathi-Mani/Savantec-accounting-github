"""Product API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database.connection import get_db
from app.database.models import User, Company
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListResponse
from app.services.product_service import ProductService
from app.services.company_service import CompanyService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/products", tags=["Products"])


def get_company_or_404(company_id: str, user: User, db: Session) -> Company:
    """Helper to get company or raise 404."""
    service = CompanyService(db)
    company = service.get_company(company_id, user)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    return company


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    company_id: str,
    data: ProductCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new product/service."""
    company = get_company_or_404(company_id, current_user, db)
    service = ProductService(db)
    product = service.create_product(company, data)
    return ProductResponse.model_validate(product)


@router.get("", response_model=ProductListResponse)
async def list_products(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_service: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List products for a company."""
    company = get_company_or_404(company_id, current_user, db)
    service = ProductService(db)
    products, total = service.get_products(
        company, page, page_size, search, is_service
    )
    
    # Products now include stock information directly
    product_responses = []
    for product in products:
        product_dict = ProductResponse.model_validate(product).model_dump()
        product_dict["current_stock"] = float(product.current_stock) if not product.is_service else None
        product_dict["min_stock_level"] = float(product.min_stock_level) if not product.is_service else None
        product_responses.append(ProductResponse(**product_dict))
    
    return ProductListResponse(
        products=product_responses,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/search")
async def search_products(
    company_id: str,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Quick search for products (autocomplete)."""
    company = get_company_or_404(company_id, current_user, db)
    service = ProductService(db)
    products = service.search_products(company, q, limit)
    
    # Products now include stock information directly
    product_responses = []
    for product in products:
        product_dict = ProductResponse.model_validate(product).model_dump()
        product_dict["current_stock"] = float(product.current_stock) if not product.is_service else None
        product_dict["min_stock_level"] = float(product.min_stock_level) if not product.is_service else None
        product_responses.append(ProductResponse(**product_dict))
    
    return product_responses


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    company_id: str,
    product_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a product by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = ProductService(db)
    product = service.get_product(product_id, company)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Product now includes stock information directly
    product_dict = ProductResponse.model_validate(product).model_dump()
    product_dict["current_stock"] = float(product.current_stock) if not product.is_service else None
    product_dict["min_stock_level"] = float(product.min_stock_level) if not product.is_service else None
    return ProductResponse(**product_dict)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    company_id: str,
    product_id: str,
    data: ProductUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a product."""
    company = get_company_or_404(company_id, current_user, db)
    service = ProductService(db)
    product = service.get_product(product_id, company)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    updated_product = service.update_product(product, data)
    
    # Product now includes stock information directly
    product_dict = ProductResponse.model_validate(updated_product).model_dump()
    product_dict["current_stock"] = float(updated_product.current_stock) if not updated_product.is_service else None
    product_dict["min_stock_level"] = float(updated_product.min_stock_level) if not updated_product.is_service else None
    return ProductResponse(**product_dict)


@router.delete("/{product_id}")
async def delete_product(
    company_id: str,
    product_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a product (soft delete)."""
    company = get_company_or_404(company_id, current_user, db)
    service = ProductService(db)
    product = service.get_product(product_id, company)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    service.delete_product(product)
    return {"message": "Product deleted successfully"}

