"""API endpoints for managing sales tickets."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal

from app.database.connection import get_db
from app.database.models import (
    SalesTicket, SalesTicketStatus, SalesTicketStage,
    SalesTicketLog, SalesTicketLogAction,
    Company
)
from app.services.sales_ticket_service import SalesTicketService

router = APIRouter(prefix="/api/companies/{company_id}", tags=["sales-tickets"])


class TicketCreate(BaseModel):
    customer_id: Optional[str] = None
    contact_id: Optional[str] = None
    sales_person_id: Optional[str] = None
    expected_value: Decimal = Decimal("0")
    expected_close_date: Optional[datetime] = None
    notes: Optional[str] = None


class TicketUpdate(BaseModel):
    customer_id: Optional[str] = None
    contact_id: Optional[str] = None
    sales_person_id: Optional[str] = None
    expected_value: Optional[Decimal] = None
    expected_close_date: Optional[datetime] = None
    win_probability: Optional[int] = None
    notes: Optional[str] = None


class TicketStageUpdate(BaseModel):
    stage: SalesTicketStage


class TicketWon(BaseModel):
    actual_value: Optional[Decimal] = None


class TicketLost(BaseModel):
    loss_reason: Optional[str] = None
    competitor_name: Optional[str] = None


class NoteAdd(BaseModel):
    note: str


class TicketLogResponse(BaseModel):
    id: str
    sales_ticket_id: str
    action_type: SalesTicketLogAction
    action_description: str
    old_value: Optional[str]
    new_value: Optional[str]
    related_document_type: Optional[str]
    related_document_id: Optional[str]
    created_by: Optional[str]
    created_by_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    id: str
    company_id: str
    ticket_number: str
    customer_id: Optional[str]
    contact_id: Optional[str]
    sales_person_id: Optional[str]
    status: SalesTicketStatus
    current_stage: SalesTicketStage
    expected_value: Decimal
    actual_value: Optional[Decimal]
    created_date: datetime
    expected_close_date: Optional[datetime]
    actual_close_date: Optional[datetime]
    win_probability: int
    loss_reason: Optional[str]
    competitor_name: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Related data
    customer_name: Optional[str] = None
    contact_name: Optional[str] = None
    sales_person_name: Optional[str] = None

    class Config:
        from_attributes = True


class TicketFlowResponse(BaseModel):
    ticket: TicketResponse
    customer: Optional[Dict[str, Any]] = None
    contact: Optional[Dict[str, Any]] = None
    sales_person: Optional[Dict[str, Any]] = None
    enquiries: List[Dict[str, Any]] = []
    quotations: List[Dict[str, Any]] = []
    sales_orders: List[Dict[str, Any]] = []
    delivery_challans: List[Dict[str, Any]] = []
    invoices: List[Dict[str, Any]] = []
    timeline: List[TicketLogResponse] = []
    summary: Dict[str, Any] = {}


def get_company(db: Session, company_id: str) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def enrich_ticket(ticket: SalesTicket, db: Session) -> TicketResponse:
    """Add related names to ticket response."""
    response = TicketResponse.model_validate(ticket)
    
    if ticket.customer:
        response.customer_name = ticket.customer.name
    if ticket.contact:
        response.contact_name = ticket.contact.name
    if ticket.sales_person:
        response.sales_person_name = f"{ticket.sales_person.first_name} {ticket.sales_person.last_name}"
    
    return response


@router.post("/sales-tickets", response_model=TicketResponse)
def create_ticket(
    company_id: str,
    data: TicketCreate,
    db: Session = Depends(get_db),
):
    """Create a new sales ticket."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.create_ticket(
        company_id=company_id,
        **data.model_dump()
    )
    
    return enrich_ticket(ticket, db)


@router.get("/sales-tickets", response_model=List[TicketResponse])
def list_tickets(
    company_id: str,
    status: Optional[SalesTicketStatus] = Query(None),
    stage: Optional[SalesTicketStage] = Query(None),
    customer_id: Optional[str] = Query(None),
    sales_person_id: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List tickets with filters."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    tickets = service.list_tickets(
        company_id=company_id,
        status=status,
        stage=stage,
        customer_id=customer_id,
        sales_person_id=sales_person_id,
        from_date=from_date,
        to_date=to_date,
        search=search,
        skip=skip,
        limit=limit,
    )
    
    return [enrich_ticket(t, db) for t in tickets]


@router.get("/sales-tickets/by-stage")
def get_tickets_by_stage(
    company_id: str,
    db: Session = Depends(get_db),
):
    """Get tickets grouped by stage (for pipeline view)."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    result = service.get_tickets_by_stage(company_id)
    
    # Enrich each ticket
    enriched = {}
    for stage, tickets in result.items():
        enriched[stage] = [enrich_ticket(t, db).model_dump() for t in tickets]
    
    return enriched


@router.get("/sales-tickets/pipeline-summary")
def get_pipeline_summary(
    company_id: str,
    db: Session = Depends(get_db),
):
    """Get pipeline summary statistics."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    return service.get_pipeline_summary(company_id)


@router.get("/sales-tickets/lookup")
def lookup_ticket(
    company_id: str,
    ticket_number: str = Query(...),
    db: Session = Depends(get_db),
):
    """Lookup a ticket by number."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket_by_number(company_id, ticket_number)
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return enrich_ticket(ticket, db)


@router.get("/sales-tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    company_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
):
    """Get a ticket by ID."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return enrich_ticket(ticket, db)


@router.get("/sales-tickets/{ticket_id}/flow")
def get_ticket_flow(
    company_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
):
    """Get the complete flow of documents for a ticket."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    flow = service.get_full_flow(ticket_id)
    
    # Convert to response format
    return {
        "ticket": enrich_ticket(flow["ticket"], db).model_dump(),
        "customer": {
            "id": flow["customer"].id,
            "name": flow["customer"].name,
            "email": flow["customer"].email,
            "phone": flow["customer"].phone,
        } if flow["customer"] else None,
        "contact": {
            "id": flow["contact"].id,
            "name": flow["contact"].name,
            "email": flow["contact"].email,
            "phone": flow["contact"].phone,
            "designation": flow["contact"].designation,
        } if flow["contact"] else None,
        "sales_person": {
            "id": flow["sales_person"].id,
            "name": f"{flow['sales_person'].first_name} {flow['sales_person'].last_name}",
            "email": flow["sales_person"].email,
        } if flow["sales_person"] else None,
        "enquiries": [
            {
                "id": e.id,
                "enquiry_number": e.enquiry_number,
                "enquiry_date": e.enquiry_date.isoformat(),
                "subject": e.subject,
                "status": e.status.value,
                "expected_value": float(e.expected_value or 0),
            }
            for e in flow["enquiries"]
        ],
        "quotations": [
            {
                "id": q.id,
                "quotation_number": q.quotation_number,
                "quotation_date": q.quotation_date.isoformat(),
                "status": q.status.value,
                "total_amount": float(q.total_amount or 0),
            }
            for q in flow["quotations"]
        ],
        "sales_orders": [
            {
                "id": so.id,
                "order_number": so.order_number,
                "order_date": so.order_date.isoformat(),
                "status": so.status.value,
                "total_amount": float(so.total_amount or 0),
            }
            for so in flow["sales_orders"]
        ],
        "delivery_challans": [
            {
                "id": dc.id,
                "dc_number": dc.dc_number,
                "dc_date": dc.dc_date.isoformat(),
                "status": dc.status.value,
                "dc_type": dc.dc_type.value,
            }
            for dc in flow["delivery_challans"]
        ],
        "invoices": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date.isoformat(),
                "status": inv.status.value,
                "total_amount": float(inv.total_amount or 0),
                "amount_paid": float(inv.amount_paid or 0),
            }
            for inv in flow["invoices"]
        ],
        "timeline": [
            TicketLogResponse.model_validate(log).model_dump()
            for log in flow["timeline"]
        ],
        "summary": flow["summary"],
    }


@router.get("/sales-tickets/{ticket_id}/timeline", response_model=List[TicketLogResponse])
def get_ticket_timeline(
    company_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
):
    """Get the activity timeline for a ticket."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    timeline = service.get_timeline(ticket_id)
    
    return [TicketLogResponse.model_validate(log) for log in timeline]


@router.put("/sales-tickets/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    company_id: str,
    ticket_id: str,
    data: TicketUpdate,
    db: Session = Depends(get_db),
):
    """Update a ticket."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = service.update_ticket(
        ticket_id=ticket_id,
        **data.model_dump(exclude_unset=True)
    )
    
    return enrich_ticket(ticket, db)


@router.put("/sales-tickets/{ticket_id}/stage", response_model=TicketResponse)
def update_ticket_stage(
    company_id: str,
    ticket_id: str,
    data: TicketStageUpdate,
    db: Session = Depends(get_db),
):
    """Update ticket stage."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = service.update_stage(
        ticket_id=ticket_id,
        stage=data.stage,
    )
    
    return enrich_ticket(ticket, db)


@router.post("/sales-tickets/{ticket_id}/won", response_model=TicketResponse)
def mark_ticket_won(
    company_id: str,
    ticket_id: str,
    data: TicketWon,
    db: Session = Depends(get_db),
):
    """Mark a ticket as won."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = service.mark_won(
        ticket_id=ticket_id,
        actual_value=data.actual_value,
    )
    
    return enrich_ticket(ticket, db)


@router.post("/sales-tickets/{ticket_id}/lost", response_model=TicketResponse)
def mark_ticket_lost(
    company_id: str,
    ticket_id: str,
    data: TicketLost,
    db: Session = Depends(get_db),
):
    """Mark a ticket as lost."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = service.mark_lost(
        ticket_id=ticket_id,
        loss_reason=data.loss_reason,
        competitor_name=data.competitor_name,
    )
    
    return enrich_ticket(ticket, db)


@router.post("/sales-tickets/{ticket_id}/notes", response_model=TicketLogResponse)
def add_ticket_note(
    company_id: str,
    ticket_id: str,
    data: NoteAdd,
    db: Session = Depends(get_db),
):
    """Add a note to a ticket."""
    get_company(db, company_id)
    
    service = SalesTicketService(db)
    ticket = service.get_ticket(ticket_id)
    
    if not ticket or ticket.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    log = service.add_note(
        ticket_id=ticket_id,
        note=data.note,
    )
    
    return TicketLogResponse.model_validate(log)

