"""Brand API endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import User, Company
from app.schemas.brand import BrandCreate, BrandUpdate, BrandResponse, BrandListResponse
from app.services.brand_service import BrandService
from app.services.company_service import CompanyService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/brands", tags=["brands"])


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


@router.get("/", response_model=BrandListResponse)
async def list_brands(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all brands for a company - showing only name and description."""
    company = get_company_or_404(company_id, current_user, db)
    service = BrandService(db)
    brands, total = service.get_brands(company, page, page_size, search)
    
    return BrandListResponse(
        brands=brands,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/search", response_model=list[BrandResponse])
async def search_brands(
    company_id: str,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Search brands by name - for dropdown autocomplete."""
    company = get_company_or_404(company_id, current_user, db)
    service = BrandService(db)
    brands = service.search_brands(company, q, limit)
    
    return brands


@router.post("/", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    company_id: str,
    brand_data: BrandCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new brand."""
    company = get_company_or_404(company_id, current_user, db)
    service = BrandService(db)
    try:
        brand = service.create_brand(company, brand_data, current_user.id)
        return brand
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(
    company_id: str,
    brand_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a brand by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = BrandService(db)
    brand = service.get_brand(brand_id, company)
    
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    return brand


@router.put("/{brand_id}", response_model=BrandResponse)
async def update_brand(
    company_id: str,
    brand_id: str,
    brand_data: BrandUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a brand."""
    company = get_company_or_404(company_id, current_user, db)
    service = BrandService(db)
    brand = service.get_brand(brand_id, company)
    
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    try:
        updated_brand = service.update_brand(brand, brand_data)
        return updated_brand
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    company_id: str,
    brand_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a brand."""
    company = get_company_or_404(company_id, current_user, db)
    service = BrandService(db)
    brand = service.get_brand(brand_id, company)
    
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    try:
        service.delete_brand(brand)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))