"""API endpoints for managing enquiries."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal

from app.database.connection import get_db
from app.database.models import (
    Enquiry, EnquiryStatus, EnquirySource,
    Company, Customer, Contact, Product
)
from app.database.payroll_models import Employee
from app.services.enquiry_service import EnquiryService
from app.services.quotation_service import QuotationService

router = APIRouter(prefix="/api/companies/{company_id}", tags=["enquiries"])


class EnquiryCreate(BaseModel):
    subject: str
    customer_id: Optional[str] = None
    contact_id: Optional[str] = None
    sales_person_id: Optional[str] = None
    prospect_name: Optional[str] = None
    prospect_email: Optional[str] = None
    prospect_phone: Optional[str] = None
    prospect_company: Optional[str] = None
    source: EnquirySource = EnquirySource.OTHER
    source_details: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    products_interested: Optional[List[Dict]] = None
    expected_value: Decimal = Decimal("0")
    expected_quantity: Optional[Decimal] = None
    expected_close_date: Optional[datetime] = None
    priority: str = "medium"
    notes: Optional[str] = None


class EnquiryUpdate(BaseModel):
    subject: Optional[str] = None
    customer_id: Optional[str] = None
    contact_id: Optional[str] = None
    sales_person_id: Optional[str] = None
    prospect_name: Optional[str] = None
    prospect_email: Optional[str] = None
    prospect_phone: Optional[str] = None
    prospect_company: Optional[str] = None
    source: Optional[EnquirySource] = None
    source_details: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    products_interested: Optional[List[Dict]] = None
    expected_value: Optional[Decimal] = None
    expected_quantity: Optional[Decimal] = None
    expected_close_date: Optional[datetime] = None
    follow_up_date: Optional[datetime] = None
    priority: Optional[str] = None
    notes: Optional[str] = None


class EnquiryStatusUpdate(BaseModel):
    status: EnquiryStatus
    lost_reason: Optional[str] = None
    lost_to_competitor: Optional[str] = None


class FollowUpSchedule(BaseModel):
    follow_up_date: datetime
    notes: Optional[str] = None


class EnquiryResponse(BaseModel):
    id: str
    company_id: str
    enquiry_number: str
    enquiry_date: datetime
    sales_ticket_id: Optional[str]
    customer_id: Optional[str]
    contact_id: Optional[str]
    sales_person_id: Optional[str]
    prospect_name: Optional[str]
    prospect_email: Optional[str]
    prospect_phone: Optional[str]
    prospect_company: Optional[str]
    source: EnquirySource
    source_details: Optional[str]
    subject: str
    description: Optional[str]
    requirements: Optional[str]
    products_interested: Optional[List[Dict]]
    expected_value: Decimal
    expected_quantity: Optional[Decimal]
    expected_close_date: Optional[datetime]
    follow_up_date: Optional[datetime]
    last_contact_date: Optional[datetime]
    status: EnquiryStatus
    priority: str
    converted_quotation_id: Optional[str]
    converted_at: Optional[datetime]
    lost_reason: Optional[str]
    lost_to_competitor: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Related data
    customer_name: Optional[str] = None
    contact_name: Optional[str] = None
    sales_person_name: Optional[str] = None
    ticket_number: Optional[str] = None

    class Config:
        from_attributes = True


def get_company(db: Session, company_id: str) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def enrich_enquiry(enquiry: Enquiry, db: Session) -> EnquiryResponse:
    """Add related names to enquiry response."""
    response = EnquiryResponse.model_validate(enquiry)
    
    if enquiry.customer:
        response.customer_name = enquiry.customer.name
    if enquiry.contact:
        response.contact_name = enquiry.contact.name
    if enquiry.sales_person:
        response.sales_person_name = f"{enquiry.sales_person.first_name} {enquiry.sales_person.last_name}"
    if enquiry.sales_ticket:
        response.ticket_number = enquiry.sales_ticket.ticket_number
    
    return response


@router.post("/enquiries", response_model=EnquiryResponse)
def create_enquiry(
    company_id: str,
    data: EnquiryCreate,
    db: Session = Depends(get_db),
):
    """Create a new enquiry."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiry = service.create_enquiry(
        company_id=company_id,
        **data.model_dump()
    )
    
    return enrich_enquiry(enquiry, db)


@router.get("/enquiries", response_model=List[EnquiryResponse])
def list_enquiries(
    company_id: str,
    status: Optional[EnquiryStatus] = Query(None),
    source: Optional[EnquirySource] = Query(None),
    customer_id: Optional[str] = Query(None),
    sales_person_id: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List enquiries with filters."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiries = service.list_enquiries(
        company_id=company_id,
        status=status,
        source=source,
        customer_id=customer_id,
        sales_person_id=sales_person_id,
        from_date=from_date,
        to_date=to_date,
        priority=priority,
        search=search,
        skip=skip,
        limit=limit,
    )
    
    return [enrich_enquiry(e, db) for e in enquiries]


@router.get("/enquiries/count")
def count_enquiries(
    company_id: str,
    status: Optional[EnquiryStatus] = Query(None),
    source: Optional[EnquirySource] = Query(None),
    customer_id: Optional[str] = Query(None),
    sales_person_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get count of enquiries."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    count = service.count_enquiries(
        company_id=company_id,
        status=status,
        source=source,
        customer_id=customer_id,
        sales_person_id=sales_person_id,
    )
    
    return {"count": count}


@router.get("/enquiries/pending-followups", response_model=List[EnquiryResponse])
def get_pending_followups(
    company_id: str,
    sales_person_id: Optional[str] = Query(None),
    days_ahead: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Get enquiries with follow-ups due soon."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiries = service.get_pending_follow_ups(
        company_id=company_id,
        sales_person_id=sales_person_id,
        days_ahead=days_ahead,
    )
    
    return [enrich_enquiry(e, db) for e in enquiries]


@router.get("/enquiries/{enquiry_id}", response_model=EnquiryResponse)
def get_enquiry(
    company_id: str,
    enquiry_id: str,
    db: Session = Depends(get_db),
):
    """Get an enquiry by ID."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    return enrich_enquiry(enquiry, db)


@router.put("/enquiries/{enquiry_id}", response_model=EnquiryResponse)
def update_enquiry(
    company_id: str,
    enquiry_id: str,
    data: EnquiryUpdate,
    db: Session = Depends(get_db),
):
    """Update an enquiry."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    enquiry = service.update_enquiry(
        enquiry_id=enquiry_id,
        **data.model_dump(exclude_unset=True)
    )
    
    return enrich_enquiry(enquiry, db)


@router.put("/enquiries/{enquiry_id}/status", response_model=EnquiryResponse)
def update_enquiry_status(
    company_id: str,
    enquiry_id: str,
    data: EnquiryStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update enquiry status."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    enquiry = service.update_enquiry_status(
        enquiry_id=enquiry_id,
        status=data.status,
        lost_reason=data.lost_reason,
        lost_to_competitor=data.lost_to_competitor,
    )
    
    return enrich_enquiry(enquiry, db)


@router.post("/enquiries/{enquiry_id}/follow-up", response_model=EnquiryResponse)
def schedule_follow_up(
    company_id: str,
    enquiry_id: str,
    data: FollowUpSchedule,
    db: Session = Depends(get_db),
):
    """Schedule a follow-up for an enquiry."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    enquiry = service.schedule_follow_up(
        enquiry_id=enquiry_id,
        follow_up_date=data.follow_up_date,
        notes=data.notes,
    )
    
    return enrich_enquiry(enquiry, db)


@router.post("/enquiries/{enquiry_id}/log-contact", response_model=EnquiryResponse)
def log_contact(
    company_id: str,
    enquiry_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Log a contact/interaction with the prospect."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    enquiry = service.log_contact(
        enquiry_id=enquiry_id,
        notes=notes,
    )
    
    return enrich_enquiry(enquiry, db)


@router.delete("/enquiries/{enquiry_id}")
def delete_enquiry(
    company_id: str,
    enquiry_id: str,
    db: Session = Depends(get_db),
):
    """Delete an enquiry."""
    get_company(db, company_id)
    
    service = EnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    service.delete_enquiry(enquiry_id)
    
    return {"message": "Enquiry deleted"}


class ConvertToQuotationRequest(BaseModel):
    validity_days: int = 30
    notes: Optional[str] = None
    terms: Optional[str] = None


@router.post("/enquiries/{enquiry_id}/convert-to-quotation")
def convert_enquiry_to_quotation(
    company_id: str,
    enquiry_id: str,
    data: ConvertToQuotationRequest,
    db: Session = Depends(get_db),
):
    """Convert an enquiry to a draft quotation."""
    company = get_company(db, company_id)
    
    enquiry_service = EnquiryService(db)
    enquiry = enquiry_service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    # Check if already converted
    if enquiry.converted_quotation_id:
        raise HTTPException(
            status_code=400, 
            detail="Enquiry has already been converted to a quotation"
        )
    
    # Build quotation items from products_interested
    items = []
    if enquiry.products_interested:
        for prod_info in enquiry.products_interested:
            product_id = prod_info.get("product_id")
            quantity = float(prod_info.get("quantity", 1))
            notes = prod_info.get("notes", "")
            
            # Try to get product details
            if product_id:
                product = db.query(Product).filter(
                    Product.id == product_id,
                    Product.company_id == company_id
                ).first()
                
                if product:
                    items.append({
                        "product_id": product_id,
                        "description": f"{product.name}" + (f" - {notes}" if notes else ""),
                        "hsn_code": product.hsn_code,
                        "quantity": quantity,
                        "unit": product.unit or "unit",
                        "unit_price": float(product.sale_price or 0),
                        "discount_percent": 0,
                        "gst_rate": float(product.gst_rate or 18),
                    })
                else:
                    # Product not found, add with description only
                    items.append({
                        "product_id": None,
                        "description": prod_info.get("product_name", "Product") + (f" - {notes}" if notes else ""),
                        "hsn_code": None,
                        "quantity": quantity,
                        "unit": "unit",
                        "unit_price": 0,
                        "discount_percent": 0,
                        "gst_rate": 18,
                    })
            else:
                # No product_id, use description
                items.append({
                    "product_id": None,
                    "description": prod_info.get("product_name", "Product") + (f" - {notes}" if notes else ""),
                    "hsn_code": None,
                    "quantity": quantity,
                    "unit": "unit",
                    "unit_price": 0,
                    "discount_percent": 0,
                    "gst_rate": 18,
                })
    
    # Create quotation
    quotation_service = QuotationService(db)
    
    try:
        quotation = quotation_service.create_quotation(
            company=company,
            customer_id=enquiry.customer_id,
            items=items if items else [{"description": enquiry.subject, "quantity": 1, "unit_price": float(enquiry.expected_value or 0), "gst_rate": 18}],
            validity_days=data.validity_days,
            subject=enquiry.subject,
            notes=data.notes or enquiry.description,
            terms=data.terms,
        )
        
        # Update quotation with sales ticket and other fields
        quotation.sales_ticket_id = enquiry.sales_ticket_id
        quotation.contact_id = enquiry.contact_id
        quotation.sales_person_id = enquiry.sales_person_id
        
        # Update enquiry
        enquiry.status = EnquiryStatus.PROPOSAL_SENT
        enquiry.converted_quotation_id = quotation.id
        enquiry.converted_at = datetime.utcnow()
        
        # Update sales ticket stage if exists
        if enquiry.sales_ticket:
            from app.database.models import SalesTicketStage, SalesTicketLog, SalesTicketLogAction
            enquiry.sales_ticket.current_stage = SalesTicketStage.QUOTATION
            
            # Log the conversion
            log = SalesTicketLog(
                sales_ticket_id=enquiry.sales_ticket_id,
                action_type=SalesTicketLogAction.QUOTATION_CREATED,
                action_description=f"Quotation {quotation.quotation_number} created from enquiry {enquiry.enquiry_number}",
                related_document_type="quotation",
                related_document_id=quotation.id,
            )
            db.add(log)
            
            # Log stage change
            stage_log = SalesTicketLog(
                sales_ticket_id=enquiry.sales_ticket_id,
                action_type=SalesTicketLogAction.STAGE_CHANGED,
                action_description="Pipeline stage advanced to Quotation",
                old_value="enquiry",
                new_value="quotation",
            )
            db.add(stage_log)
        
        db.commit()
        
        return {
            "message": "Enquiry converted to quotation successfully",
            "quotation_id": quotation.id,
            "quotation_number": quotation.quotation_number,
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

