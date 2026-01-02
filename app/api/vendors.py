"""Vendor API routes - Vendors are stored in Customer model with vendor_type."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database.connection import get_db
from app.database.models import User, Company
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse
from app.services.customer_service import CustomerService
from app.services.company_service import CompanyService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/vendors", tags=["Vendors"])


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


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    company_id: str,
    data: CustomerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new vendor.
    
    Vendors are stored in the Customer model but are used for purchase invoices.
    The customer_type field can be used to distinguish vendors if needed.
    """
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    
    # Create vendor (same as customer, but semantically a vendor)
    vendor = service.create_customer(company, data)
    return CustomerResponse.model_validate(vendor)


@router.get("", response_model=CustomerListResponse)
async def list_vendors(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List vendors for a company.
    
    Note: Currently vendors and customers share the same table.
    You can filter by customer_type if you set a specific type for vendors.
    """
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    
    # List all customers (vendors are just customers used in purchase invoices)
    # You can add filtering logic here if you want to distinguish vendors
    customers, total = service.get_customers(
        company, page, page_size, search, customer_type=None
    )
    
    return CustomerListResponse(
        customers=[CustomerResponse.model_validate(c) for c in customers],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/search")
async def search_vendors(
    company_id: str,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Quick search for vendors (autocomplete)."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    vendors = service.search_customers(company, q, limit)
    return [CustomerResponse.model_validate(v) for v in vendors]


@router.get("/{vendor_id}", response_model=CustomerResponse)
async def get_vendor(
    company_id: str,
    vendor_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a vendor by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    vendor = service.get_customer(vendor_id, company)
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    return CustomerResponse.model_validate(vendor)


@router.put("/{vendor_id}", response_model=CustomerResponse)
async def update_vendor(
    company_id: str,
    vendor_id: str,
    data: CustomerUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a vendor."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    vendor = service.get_customer(vendor_id, company)
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    vendor = service.update_customer(vendor, data)
    return CustomerResponse.model_validate(vendor)


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    company_id: str,
    vendor_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a vendor."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    vendor = service.get_customer(vendor_id, company)
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    service.delete_customer(vendor)
