"""Quotation API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import User, Company, Customer, QuotationStatus
from app.auth.dependencies import get_current_active_user
from app.services.quotation_service import QuotationService

router = APIRouter(tags=["Quotations"])


def get_company_or_404(company_id: str, user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ==================== SCHEMAS ====================

class QuotationItemCreate(BaseModel):
    product_id: Optional[str] = None
    description: Optional[str] = None
    hsn_code: Optional[str] = None
    quantity: float
    unit: Optional[str] = "unit"
    unit_price: float
    discount_percent: float = 0
    gst_rate: float = 18


class QuotationCreate(BaseModel):
    customer_id: Optional[str] = None
    quotation_date: Optional[datetime] = None
    validity_days: int = 30
    place_of_supply: Optional[str] = None
    subject: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[QuotationItemCreate]


class QuotationUpdate(BaseModel):
    validity_days: Optional[int] = None
    subject: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: Optional[List[QuotationItemCreate]] = None


class QuotationItemResponse(BaseModel):
    id: str
    product_id: Optional[str]
    description: str
    hsn_code: Optional[str]
    quantity: float
    unit: str
    unit_price: float
    discount_percent: float
    discount_amount: float
    gst_rate: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    taxable_amount: float
    total_amount: float

    class Config:
        from_attributes = True


class QuotationResponse(BaseModel):
    id: str
    quotation_number: str
    quotation_date: datetime
    validity_date: Optional[datetime]
    customer_id: Optional[str]
    customer_name: Optional[str] = None
    status: str
    subject: Optional[str]
    place_of_supply: Optional[str]
    place_of_supply_name: Optional[str]
    subtotal: float
    discount_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_tax: float
    total_amount: float
    notes: Optional[str]
    terms: Optional[str]
    email_sent_at: Optional[datetime]
    approved_at: Optional[datetime]
    converted_invoice_id: Optional[str]
    created_at: datetime
    items: Optional[List[QuotationItemResponse]] = None

    class Config:
        from_attributes = True


class QuotationListResponse(BaseModel):
    items: List[QuotationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ConvertToInvoiceRequest(BaseModel):
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None


class SendRequest(BaseModel):
    email: Optional[str] = None


class ApprovalRequest(BaseModel):
    approved_by: Optional[str] = None


class RejectionRequest(BaseModel):
    reason: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.post("/companies/{company_id}/quotations", response_model=QuotationResponse)
async def create_quotation(
    company_id: str,
    data: QuotationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new quotation."""
    company = get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    try:
        items = [item.model_dump() for item in data.items]
        quotation = service.create_quotation(
            company=company,
            customer_id=data.customer_id,
            items=items,
            quotation_date=data.quotation_date,
            validity_days=data.validity_days,
            place_of_supply=data.place_of_supply,
            subject=data.subject,
            notes=data.notes,
            terms=data.terms,
        )
        
        return _quotation_to_response(quotation, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/companies/{company_id}/quotations", response_model=QuotationListResponse)
async def list_quotations(
    company_id: str,
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List quotations with filters."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    # Parse status
    status_enum = None
    if status:
        try:
            status_enum = QuotationStatus(status)
        except ValueError:
            pass
    
    # Parse dates
    from_dt = datetime.fromisoformat(from_date).date() if from_date else None
    to_dt = datetime.fromisoformat(to_date).date() if to_date else None
    
    result = service.list_quotations(
        company_id=company_id,
        status=status_enum,
        customer_id=customer_id,
        from_date=from_dt,
        to_date=to_dt,
        page=page,
        page_size=page_size,
    )
    
    return {
        "items": [_quotation_to_response(q, db, include_items=False) for q in result["items"]],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
    }


@router.get("/companies/{company_id}/quotations/{quotation_id}", response_model=QuotationResponse)
async def get_quotation(
    company_id: str,
    quotation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a single quotation by ID."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    return _quotation_to_response(quotation, db)


@router.put("/companies/{company_id}/quotations/{quotation_id}", response_model=QuotationResponse)
async def update_quotation(
    company_id: str,
    quotation_id: str,
    data: QuotationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a quotation (only DRAFT status)."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    try:
        items = [item.model_dump() for item in data.items] if data.items else None
        
        quotation = service.update_quotation(
            quotation=quotation,
            items=items,
            validity_days=data.validity_days,
            subject=data.subject,
            notes=data.notes,
            terms=data.terms,
        )
        
        return _quotation_to_response(quotation, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/companies/{company_id}/quotations/{quotation_id}")
async def delete_quotation(
    company_id: str,
    quotation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a quotation (only DRAFT status)."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    try:
        service.delete_quotation(quotation)
        return {"message": "Quotation deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/quotations/{quotation_id}/send", response_model=QuotationResponse)
async def send_quotation(
    company_id: str,
    quotation_id: str,
    data: SendRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark quotation as sent to customer."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    try:
        quotation = service.send_to_customer(quotation, email=data.email)
        return _quotation_to_response(quotation, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/quotations/{quotation_id}/approve", response_model=QuotationResponse)
async def approve_quotation(
    company_id: str,
    quotation_id: str,
    data: ApprovalRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark quotation as approved by customer."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    try:
        quotation = service.mark_approved(quotation, approved_by=data.approved_by)
        return _quotation_to_response(quotation, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/quotations/{quotation_id}/reject", response_model=QuotationResponse)
async def reject_quotation(
    company_id: str,
    quotation_id: str,
    data: RejectionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark quotation as rejected by customer."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    try:
        quotation = service.mark_rejected(quotation, rejection_reason=data.reason)
        return _quotation_to_response(quotation, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/quotations/{quotation_id}/convert")
async def convert_to_invoice(
    company_id: str,
    quotation_id: str,
    data: ConvertToInvoiceRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Convert quotation to invoice."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    try:
        invoice = service.convert_to_invoice(
            quotation=quotation,
            invoice_date=data.invoice_date,
            due_date=data.due_date,
        )
        
        return {
            "message": "Quotation converted to invoice successfully",
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/quotations/{quotation_id}/revise", response_model=QuotationResponse)
async def revise_quotation(
    company_id: str,
    quotation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a revised version of a quotation."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    quotation = service.get_quotation(company_id, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    new_quotation = service.revise_quotation(quotation)
    return _quotation_to_response(new_quotation, db)


@router.post("/companies/{company_id}/quotations/check-expired")
async def check_expired_quotations(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check and mark expired quotations."""
    get_company_or_404(company_id, current_user, db)
    service = QuotationService(db)
    
    count = service.check_expired_quotations(company_id)
    return {"expired_count": count}


# ==================== HELPER FUNCTIONS ====================

def _quotation_to_response(quotation, db: Session, include_items: bool = True) -> dict:
    """Convert quotation model to response dict."""
    customer_name = None
    if quotation.customer_id:
        customer = db.query(Customer).filter(Customer.id == quotation.customer_id).first()
        if customer:
            customer_name = customer.name
    
    response = {
        "id": quotation.id,
        "quotation_number": quotation.quotation_number,
        "quotation_date": quotation.quotation_date,
        "validity_date": quotation.validity_date,
        "customer_id": quotation.customer_id,
        "customer_name": customer_name,
        "status": quotation.status.value if quotation.status else "draft",
        "subject": quotation.subject,
        "place_of_supply": quotation.place_of_supply,
        "place_of_supply_name": quotation.place_of_supply_name,
        "subtotal": float(quotation.subtotal or 0),
        "discount_amount": float(quotation.discount_amount or 0),
        "cgst_amount": float(quotation.cgst_amount or 0),
        "sgst_amount": float(quotation.sgst_amount or 0),
        "igst_amount": float(quotation.igst_amount or 0),
        "total_tax": float(quotation.total_tax or 0),
        "total_amount": float(quotation.total_amount or 0),
        "notes": quotation.notes,
        "terms": quotation.terms,
        "email_sent_at": quotation.email_sent_at,
        "approved_at": quotation.approved_at,
        "converted_invoice_id": quotation.converted_invoice_id,
        "created_at": quotation.created_at,
    }
    
    if include_items:
        response["items"] = [
            {
                "id": item.id,
                "product_id": item.product_id,
                "description": item.description,
                "hsn_code": item.hsn_code,
                "quantity": float(item.quantity),
                "unit": item.unit,
                "unit_price": float(item.unit_price),
                "discount_percent": float(item.discount_percent or 0),
                "discount_amount": float(item.discount_amount or 0),
                "gst_rate": float(item.gst_rate),
                "cgst_amount": float(item.cgst_amount or 0),
                "sgst_amount": float(item.sgst_amount or 0),
                "igst_amount": float(item.igst_amount or 0),
                "taxable_amount": float(item.taxable_amount),
                "total_amount": float(item.total_amount),
            }
            for item in quotation.items
        ]
    
    return response

