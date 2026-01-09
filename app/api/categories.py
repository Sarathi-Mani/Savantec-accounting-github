"""Category API endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import User, Company
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse, CategoryListResponse
from app.services.category_service import CategoryService
from app.services.company_service import CompanyService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/categories", tags=["categories"])


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


@router.get("/", response_model=CategoryListResponse)
async def list_categories(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all categories for a company - showing only name and description."""
    company = get_company_or_404(company_id, current_user, db)
    service = CategoryService(db)
    categories, total = service.get_categories(company, page, page_size, search)
    
    return CategoryListResponse(
        categories=categories,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/search", response_model=list[CategoryResponse])
async def search_categories(
    company_id: str,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Search categories by name - for dropdown autocomplete."""
    company = get_company_or_404(company_id, current_user, db)
    service = CategoryService(db)
    categories = service.search_categories(company, q, limit)
    
    return categories


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    company_id: str,
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new category."""
    company = get_company_or_404(company_id, current_user, db)
    service = CategoryService(db)
    try:
        category = service.create_category(company, category_data, current_user.id)
        return category
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    company_id: str,
    category_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a category by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = CategoryService(db)
    category = service.get_category(category_id, company)
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    company_id: str,
    category_id: str,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a category."""
    company = get_company_or_404(company_id, current_user, db)
    service = CategoryService(db)
    category = service.get_category(category_id, company)
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    try:
        updated_category = service.update_category(category, category_data)
        return updated_category
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    company_id: str,
    category_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a category."""
    company = get_company_or_404(company_id, current_user, db)
    service = CategoryService(db)
    category = service.get_category(category_id, company)
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    try:
        service.delete_category(category)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))