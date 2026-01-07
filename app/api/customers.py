"""Customer API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database.connection import get_db
from app.database.models import User, Company
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse
from app.services.customer_service import CustomerService
from app.services.company_service import CompanyService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/customers", tags=["Customers"])


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
async def create_customer(
    company_id: str,
    data: CustomerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new customer."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    customer = service.create_customer(company, data)
    return CustomerResponse.model_validate(customer)


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    customer_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List customers for a company."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    customers, total = service.get_customers(
        company, page, page_size, search, customer_type
    )
    
    return CustomerListResponse(
        customers=[CustomerResponse.model_validate(c) for c in customers],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/search")
async def search_customers(
    company_id: str,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Quick search for customers (autocomplete)."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    customers = service.search_customers(company, q, limit)
    return [CustomerResponse.model_validate(c) for c in customers]


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    company_id: str,
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a customer by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    customer = service.get_customer(customer_id, company)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    return CustomerResponse.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    company_id: str,
    customer_id: str,
    data: CustomerUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a customer."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    customer = service.get_customer(customer_id, company)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    updated_customer = service.update_customer(customer, data)
    return CustomerResponse.model_validate(updated_customer)


@router.delete("/{customer_id}")
async def delete_customer(
    company_id: str,
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a customer (soft delete)."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    customer = service.get_customer(customer_id, company)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    service.delete_customer(customer)
    return {"message": "Customer deleted successfully"}


# Export/Import routes
@router.post("/import")
async def import_customers(
    company_id: str,
    customers_data: List[dict],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Import multiple customers."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    
    imported = 0
    errors = []
    
    for idx, customer_data in enumerate(customers_data):
        try:
            # Convert to CustomerCreate schema
            customer_create = CustomerCreate(**customer_data)
            service.create_customer(company, customer_create)
            imported += 1
        except Exception as e:
            errors.append({
                "row": idx + 1,
                "error": str(e),
                "data": customer_data
            })
    
    return {
        "imported": imported,
        "errors": errors,
        "total": len(customers_data)
    }


@router.get("/export")
async def export_customers(
    company_id: str,
    format: str = Query("csv", pattern="^(csv|json|excel)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export customers."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    
    # Get all customers for the company
    customers, _ = service.get_customers(company, page=1, page_size=10000)
    
    # Format data based on requested format
    if format == "json":
        return [CustomerResponse.model_validate(c).dict() for c in customers]
    elif format == "csv":
        # Generate CSV
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "Name", "Contact", "Email", "Mobile", "PAN Number", 
            "GST Number", "GST Type", "Vendor Code", "Opening Balance",
            "Opening Balance Type", "Credit Limit", "Credit Days",
            "Billing Address", "Billing City", "Billing State",
            "Billing Country", "Billing ZIP", "Shipping Address",
            "Shipping City", "Shipping State", "Shipping Country",
            "Shipping ZIP"
        ])
        
        # Write data
        for customer in customers:
            writer.writerow([
                customer.name,
                customer.contact,
                customer.email or "",
                customer.mobile or "",
                customer.pan_number or "",
                customer.tax_number or "",
                customer.gst_registration_type or "",
                customer.vendor_code or "",
                customer.opening_balance or 0,
                customer.opening_balance_type or "",
                customer.credit_limit or 0,
                customer.credit_days or 0,
                customer.billing_address or "",
                customer.billing_city or "",
                customer.billing_state or "",
                customer.billing_country or "",
                customer.billing_zip or "",
                customer.shipping_address or "",
                customer.shipping_city or "",
                customer.shipping_state or "",
                customer.shipping_country or "",
                customer.shipping_zip or ""
            ])
        
        output.seek(0)
        return output.getvalue()
    else:
        # Excel format would require additional libraries like openpyxl
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Excel export not yet implemented"
        )


# Statistics and reports
@router.get("/statistics/summary")
async def get_customers_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get customers summary statistics."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    
    total_customers = service.get_customer_count(company)
    total_outstanding = service.get_total_outstanding(company)
    total_advance = service.get_total_advance(company)
    recent_customers = service.get_recent_customers(company, limit=5)
    
    return {
        "total_customers": total_customers,
        "total_outstanding": total_outstanding,
        "total_advance": total_advance,
        "net_balance": total_outstanding - total_advance,
        "recent_customers": [
            CustomerResponse.model_validate(c).dict() for c in recent_customers
        ]
    }


@router.get("/statistics/by-state")
async def get_customers_by_state(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get customers grouped by state."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    
    return service.get_customers_by_state(company)


@router.get("/statistics/top-customers")
async def get_top_customers(
    company_id: str,
    limit: int = Query(10, ge=1, le=50),
    period: str = Query("all", pattern="^(day|week|month|quarter|year|all)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get top customers by transaction volume/value."""
    company = get_company_or_404(company_id, current_user, db)
    service = CustomerService(db)
    
    return service.get_top_customers(company, limit, period)