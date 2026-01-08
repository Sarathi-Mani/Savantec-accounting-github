"""API endpoints for managing enquiries."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Form, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
import json
from pathlib import Path
import os

from app.database.connection import get_db
from app.database.models import (
    Enquiry, EnquiryStatus, EnquirySource, EnquiryItem,
    Company, Customer, Contact, Product, SalesTicket,
    SalesTicketLog, SalesTicketLogAction, SalesTicketStage
)
from app.database.payroll_models import Employee

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


# Add this new model after your existing models
class EnquiryEditUpdate(BaseModel):
    status: Optional[str] = None
    pending_remarks: Optional[str] = None
    quotation_no: Optional[str] = None
    quotation_date: Optional[date] = None
    items: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        from_attributes = True



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


class EnquiryItemCreate(BaseModel):
    product_id: Optional[str] = None
    description: str
    quantity: int = 1
    image_url: Optional[str] = None
    notes: Optional[str] = None


class EnquiryItemResponse(BaseModel):
    id: str
    enquiry_id: str
    product_id: Optional[str]
    description: str
    quantity: int
    image_url: Optional[str]
    notes: Optional[str]
    created_at: datetime
    
    # Product details if available
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    
    class Config:
        from_attributes = True


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
    items: Optional[List[EnquiryItemResponse]] = None

    class Config:
        from_attributes = True


class ConvertToQuotationRequest(BaseModel):
    validity_days: int = 30
    notes: Optional[str] = None
    terms: Optional[str] = None


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
    
    # Add enquiry items
    response.items = []
    for item in enquiry.items:
        item_response = EnquiryItemResponse.model_validate(item)
        if item.product:
            item_response.product_name = item.product.name
            item_response.product_sku = item.product.sku
        response.items.append(item_response)
    
    return response


# Simple EnquiryService implementation since the import might fail
class SimpleEnquiryService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_enquiry(self, company_id: str, **kwargs):
        """Create a new enquiry."""
        today = datetime.utcnow()
        year_month = today.strftime("%Y%m")
        
        # Count enquiries this month
        count = self.db.query(Enquiry).filter(
            Enquiry.company_id == company_id,
            Enquiry.enquiry_date >= date(today.year, today.month, 1)
        ).count()
        
        enquiry_number = kwargs.get('enquiry_number', f"ENQ-{year_month}-{count + 1:04d}")
        
        enquiry = Enquiry(
            id=os.urandom(16).hex(),
            company_id=company_id,
            enquiry_number=enquiry_number,
            enquiry_date=kwargs.get('enquiry_date', today),
            subject=kwargs.get('subject', 'New Enquiry'),
            customer_id=kwargs.get('customer_id'),
            contact_id=kwargs.get('contact_id'),
            sales_person_id=kwargs.get('sales_person_id'),
            prospect_name=kwargs.get('prospect_name'),
            prospect_email=kwargs.get('prospect_email'),
            prospect_phone=kwargs.get('prospect_phone'),
            prospect_company=kwargs.get('prospect_company'),
            source=kwargs.get('source', EnquirySource.OTHER),
            source_details=kwargs.get('source_details'),
            description=kwargs.get('description'),
            requirements=kwargs.get('requirements'),
            products_interested=kwargs.get('products_interested'),
            expected_value=kwargs.get('expected_value', Decimal("0")),
            expected_quantity=kwargs.get('expected_quantity'),
            expected_close_date=kwargs.get('expected_close_date'),
            priority=kwargs.get('priority', 'medium'),
            notes=kwargs.get('notes'),
            status=kwargs.get('status', EnquiryStatus.PENDING),
            created_at=today,
            updated_at=today
        )
        
        self.db.add(enquiry)
        self.db.commit()
        self.db.refresh(enquiry)
        
        return enquiry
    
    def get_enquiry(self, enquiry_id: str):
        return self.db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    
    def list_enquiries(self, company_id: str, **kwargs):
        query = self.db.query(Enquiry).filter(Enquiry.company_id == company_id)
        
        if kwargs.get('status'):
            query = query.filter(Enquiry.status == kwargs['status'])
        if kwargs.get('source'):
            query = query.filter(Enquiry.source == kwargs['source'])
        if kwargs.get('customer_id'):
            query = query.filter(Enquiry.customer_id == kwargs['customer_id'])
        if kwargs.get('sales_person_id'):
            query = query.filter(Enquiry.sales_person_id == kwargs['sales_person_id'])
        
        return query.order_by(Enquiry.enquiry_date.desc()).offset(kwargs.get('skip', 0)).limit(kwargs.get('limit', 50)).all()
    
    def count_enquiries(self, company_id: str, **kwargs):
        query = self.db.query(Enquiry).filter(Enquiry.company_id == company_id)
        
        if kwargs.get('status'):
            query = query.filter(Enquiry.status == kwargs['status'])
        if kwargs.get('source'):
            query = query.filter(Enquiry.source == kwargs['source'])
        if kwargs.get('customer_id'):
            query = query.filter(Enquiry.customer_id == kwargs['customer_id'])
        if kwargs.get('sales_person_id'):
            query = query.filter(Enquiry.sales_person_id == kwargs['sales_person_id'])
        
        return query.count()
    
    def update_enquiry(self, enquiry_id: str, **kwargs):
        enquiry = self.get_enquiry(enquiry_id)
        if not enquiry:
            return None
        
        for key, value in kwargs.items():
            if hasattr(enquiry, key) and value is not None:
                setattr(enquiry, key, value)
        
        enquiry.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(enquiry)
        
        return enquiry
    
    def update_enquiry_status(self, enquiry_id: str, status: EnquiryStatus, **kwargs):
        enquiry = self.get_enquiry(enquiry_id)
        if not enquiry:
            return None
        
        enquiry.status = status
        if status == EnquiryStatus.LOST:
            enquiry.lost_reason = kwargs.get('lost_reason')
            enquiry.lost_to_competitor = kwargs.get('lost_to_competitor')
        
        enquiry.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(enquiry)
        
        return enquiry
    
    def schedule_follow_up(self, enquiry_id: str, follow_up_date: datetime, notes: str = None):
        enquiry = self.get_enquiry(enquiry_id)
        if not enquiry:
            return None
        
        enquiry.follow_up_date = follow_up_date
        if notes:
            enquiry.notes = f"{enquiry.notes or ''}\nFollow-up scheduled for {follow_up_date}: {notes}"
        
        enquiry.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(enquiry)
        
        return enquiry
    
    def log_contact(self, enquiry_id: str, notes: str = None):
        enquiry = self.get_enquiry(enquiry_id)
        if not enquiry:
            return None
        
        enquiry.last_contact_date = datetime.utcnow()
        if notes:
            enquiry.notes = f"{enquiry.notes or ''}\nContact on {datetime.utcnow().date()}: {notes}"
        
        enquiry.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(enquiry)
        
        return enquiry
    
    def delete_enquiry(self, enquiry_id: str):
        enquiry = self.get_enquiry(enquiry_id)
        if not enquiry:
            return
        
        self.db.delete(enquiry)
        self.db.commit()


@router.post("/enquiries", response_model=EnquiryResponse)
def create_enquiry(
    company_id: str,
    data: EnquiryCreate,
    db: Session = Depends(get_db),
):
    """Create a new enquiry."""
    get_company(db, company_id)
    
    service = SimpleEnquiryService(db)
    enquiry = service.create_enquiry(
        company_id=company_id,
        **data.model_dump()
    )
    
    return enrich_enquiry(enquiry, db)
@router.post("/enquiries/formdata", response_model=EnquiryResponse)
async def create_enquiry_formdata(
    company_id: str,
    enquiry_no: str = Form(...),
    enquiry_date: date = Form(...),
    customer_id: str = Form(...),  # This is actually customer_id
    kind_attn: Optional[str] = Form(None),
    mail_id: Optional[str] = Form(None),
    phone_no: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    salesman_id: Optional[str] = Form(None), 
    status: str = Form("pending"),
    items: str = Form("[]"),  # JSON string of items
    files: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
):
    """Create enquiry from FormData (for frontend compatibility)."""
    company = get_company(db, company_id)
    
    # Parse items JSON
    try:
        items_data = json.loads(items)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid items JSON")
    
    # Create enquiry data from form
    enquiry_data = {
        "subject": remarks or f"Enquiry {enquiry_no}",
        "customer_id": customer_id if customer_id != company_id else None,
        "sales_person_id": salesman_id,  # Use the salesman_id from form data, not hardcoded "1"
        "prospect_name": kind_attn,
        "prospect_email": mail_id,
        "prospect_phone": phone_no,
        "description": remarks,
        "notes": remarks,
        "expected_value": Decimal("0"),
        "priority": "medium",
        "source": EnquirySource.WEBSITE,
        "enquiry_date": datetime.combine(enquiry_date, datetime.min.time())
    }
    
    # Create the enquiry
    service = SimpleEnquiryService(db)
    enquiry = service.create_enquiry(
        company_id=company_id,
        **enquiry_data
    )
    
   
    enquiry.enquiry_number = enquiry_no
    
    # Create upload directory
    upload_dir = Path("uploads") / "enquiries" / enquiry.id
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    uploaded_files = []
    enquiry_items_list = []
    
    # Process items and save images
    for index, item_data in enumerate(items_data):
        product_id = item_data.get("product_id")
        if not product_id or product_id.strip() == "":
            product_id = None
        
        # Get image for this item from files (assuming files are in order)
        image_url = None
        if index < len(files) and files[index].filename:
            file = files[index]
            
            # Generate safe filename
            safe_filename = f"{enquiry.id}_{index}_{file.filename.replace(' ', '_')}"
            file_path = upload_dir / safe_filename
            
            # Save file
            content = await file.read()
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            image_url = f"/uploads/enquiries/{enquiry.id}/{safe_filename}"
            uploaded_files.append(image_url)
        
        # Create enquiry item
        item = EnquiryItem(
            id=os.urandom(16).hex(),
            enquiry_id=enquiry.id,
            product_id=product_id,
            description=item_data.get("description", ""),
            quantity=item_data.get("quantity", 1),
            image_url=image_url,  # Save image URL here
            notes=item_data.get("notes"),
            created_at=datetime.utcnow()
        )
        db.add(item)
        enquiry_items_list.append(item)
    
    # Update products_interested with item data including image URLs
    enriched_items_data = []
    for i, item_data in enumerate(items_data):
        enriched_item = {
            "product_id": item_data.get("product_id"),
            "description": item_data.get("description", ""),
            "quantity": item_data.get("quantity", 1),
            "notes": item_data.get("notes"),
            "image_url": enquiry_items_list[i].image_url if i < len(enquiry_items_list) else None
        }
        enriched_items_data.append(enriched_item)
    
    enquiry.products_interested = enriched_items_data
    
    # Add uploaded files info to notes
    if uploaded_files:
        existing_notes = enquiry.notes or ""
        files_list = "\n".join([f"- {url}" for url in uploaded_files])
        enquiry.notes = existing_notes
    
    db.commit()
    db.refresh(enquiry)
    
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
    
    service = SimpleEnquiryService(db)
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
    
    service = SimpleEnquiryService(db)
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
    
    service = SimpleEnquiryService(db)
    enquiries = service.list_enquiries(
        company_id=company_id,
        sales_person_id=sales_person_id,
    )
    
    # Filter for pending follow-ups
    pending = []
    today = datetime.utcnow()
    future_date = date(today.year, today.month, today.day + days_ahead)
    
    for enquiry in enquiries:
        if enquiry.follow_up_date and enquiry.follow_up_date.date() <= future_date:
            pending.append(enquiry)
    
    return [enrich_enquiry(e, db) for e in pending]


@router.get("/enquiries/{enquiry_id}", response_model=EnquiryResponse)
def get_enquiry(
    company_id: str,
    enquiry_id: str,
    db: Session = Depends(get_db),
):
    """Get an enquiry by ID."""
    get_company(db, company_id)
    
    service = SimpleEnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    return enrich_enquiry(enquiry, db)

@router.put("/enquiries/{enquiry_id}/edit", response_model=EnquiryResponse)
def update_enquiry_edit(
    company_id: str,
    enquiry_id: str,
    data: EnquiryEditUpdate,
    db: Session = Depends(get_db),
):
    """Update enquiry with edit page data."""
    print(f"DEBUG: Received update request for enquiry {enquiry_id}")
    print(f"DEBUG: Request data: {data.model_dump()}")
    
    get_company(db, company_id)
    
    service = SimpleEnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    # Update basic fields
    update_data = {}
    
    if data.status is not None:
        try:
            update_data['status'] = EnquiryStatus(data.status)
            print(f"DEBUG: Setting status to {data.status}")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    
    if data.pending_remarks is not None:
        enquiry.pending_remarks = data.pending_remarks
        print(f"DEBUG: Setting pending_remarks to {data.pending_remarks}")
    
    if data.quotation_no is not None:
        enquiry.quotation_no = data.quotation_no
        print(f"DEBUG: Setting quotation_no to {data.quotation_no}")
    
    if data.quotation_date is not None:
        enquiry.quotation_date = data.quotation_date
        print(f"DEBUG: Setting quotation_date to {data.quotation_date}")
    
    # Update enquiry items if provided
    if data.items is not None:
        print(f"DEBUG: Processing {len(data.items)} items")
        
        # First, delete existing items
        db.query(EnquiryItem).filter(EnquiryItem.enquiry_id == enquiry_id).delete()
        
        # Then create new items WITHOUT the fields that don't exist in EnquiryItem
        for index, item_data in enumerate(data.items):
            print(f"DEBUG: Creating item {index}: {item_data}")
            item = EnquiryItem(
                id=os.urandom(16).hex(),
                enquiry_id=enquiry_id,
                product_id=item_data.get('product_id'),
                description=item_data.get('description', ''),
                quantity=item_data.get('quantity', 1),
                image_url=item_data.get('existing_image'),
                notes=item_data.get('notes', f'Item {index + 1}'),
                # DON'T include suitable_item, purchase_price, sales_price here
                # These fields don't exist in EnquiryItem model
                created_at=datetime.utcnow()
            )
            db.add(item)
        
        # Update products_interested in enquiry with ALL data including prices
        products_interested = []
        for item_data in data.items:
            products_interested.append({
                "product_id": item_data.get('product_id'),
                "description": item_data.get('description', ''),
                "quantity": item_data.get('quantity', 1),
                "notes": item_data.get('notes', ''),
                "suitable_item": item_data.get('suitable_item', ''),
                "purchase_price": item_data.get('purchase_price', 0),
                "sales_price": item_data.get('sales_price', 0),
                "image_url": item_data.get('existing_image')
            })
        enquiry.products_interested = products_interested
    
    # Update the enquiry
    if update_data:
        enquiry = service.update_enquiry(enquiry_id, **update_data)
    
    enquiry.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(enquiry)
    
    print(f"DEBUG: Enquiry updated successfully")
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
    
    service = SimpleEnquiryService(db)
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
    
    service = SimpleEnquiryService(db)
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
    
    service = SimpleEnquiryService(db)
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
    
    service = SimpleEnquiryService(db)
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
    
    service = SimpleEnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
    if not enquiry or enquiry.company_id != company_id:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    
    service.delete_enquiry(enquiry_id)
    
    return {"message": "Enquiry deleted"}


@router.post("/enquiries/{enquiry_id}/convert-to-quotation")
def convert_enquiry_to_quotation(
    company_id: str,
    enquiry_id: str,
    data: ConvertToQuotationRequest,
    db: Session = Depends(get_db),
):
    """Convert an enquiry to a draft quotation."""
    company = get_company(db, company_id)
    
    service = SimpleEnquiryService(db)
    enquiry = service.get_enquiry(enquiry_id)
    
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
    
    # Simple quotation creation
    try:
        # Import quotation service if available, otherwise create simple quotation
        try:
            from app.services.quotation_service import QuotationService
            quotation_service = QuotationService(db)
            quotation = quotation_service.create_quotation(
                company=company,
                customer_id=enquiry.customer_id,
                items=items if items else [{"description": enquiry.subject, "quantity": 1, "unit_price": float(enquiry.expected_value or 0), "gst_rate": 18}],
                validity_days=data.validity_days,
                subject=enquiry.subject,
                notes=data.notes or enquiry.description,
                terms=data.terms,
            )
        except ImportError:
            # Create simple quotation directly
            from app.database.models import Quotation, QuotationStatus
            from datetime import timedelta
            
            # Generate quotation number
            today = datetime.utcnow()
            year_month = today.strftime("%Y%m")
            count = db.query(Quotation).filter(
                Quotation.company_id == company_id,
                Quotation.quotation_date >= date(today.year, today.month, 1)
            ).count()
            
            quotation = Quotation(
                id=os.urandom(16).hex(),
                company_id=company_id,
                quotation_number=f"QTN-{year_month}-{count + 1:04d}",
                quotation_date=today,
                validity_date=today + timedelta(days=data.validity_days),
                customer_id=enquiry.customer_id,
                sales_ticket_id=enquiry.sales_ticket_id,
                contact_id=enquiry.contact_id,
                sales_person_id=enquiry.sales_person_id,
                subject=enquiry.subject,
                notes=data.notes or enquiry.description,
                terms=data.terms,
                status=QuotationStatus.DRAFT,
                created_at=today,
                updated_at=today
            )
            db.add(quotation)
        
        # Update enquiry
        enquiry.status = EnquiryStatus.PROPOSAL_SENT
        enquiry.converted_quotation_id = quotation.id
        enquiry.converted_at = datetime.utcnow()
        
        # Update sales ticket stage if exists
        if enquiry.sales_ticket:
            enquiry.sales_ticket.current_stage = SalesTicketStage.QUOTATION
            
            # Log the conversion
            log = SalesTicketLog(
                id=os.urandom(16).hex(),
                sales_ticket_id=enquiry.sales_ticket_id,
                action_type=SalesTicketLogAction.QUOTATION_CREATED,
                action_description=f"Quotation {quotation.quotation_number} created from enquiry {enquiry.enquiry_number}",
                related_document_type="quotation",
                related_document_id=quotation.id,
                created_at=datetime.utcnow()
            )
            db.add(log)
            
            # Log stage change
            stage_log = SalesTicketLog(
                id=os.urandom(16).hex(),
                sales_ticket_id=enquiry.sales_ticket_id,
                action_type=SalesTicketLogAction.STAGE_CHANGED,
                action_description="Pipeline stage advanced to Quotation",
                old_value="enquiry",
                new_value="quotation",
                created_at=datetime.utcnow()
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