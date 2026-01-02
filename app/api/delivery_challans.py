"""Delivery Challan API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import (
    User, Company, Customer, Invoice, DeliveryChallanType, DeliveryChallanStatus
)
from app.auth.dependencies import get_current_active_user
from app.services.delivery_challan_service import DeliveryChallanService

router = APIRouter(tags=["Delivery Challans"])


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

class DeliveryAddress(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class DCItemCreate(BaseModel):
    product_id: Optional[str] = None
    invoice_item_id: Optional[str] = None
    batch_id: Optional[str] = None
    description: Optional[str] = None
    hsn_code: Optional[str] = None
    quantity: float
    unit: Optional[str] = "unit"
    unit_price: float = 0
    godown_id: Optional[str] = None
    serial_numbers: Optional[List[str]] = None
    notes: Optional[str] = None


class DCOutCreate(BaseModel):
    customer_id: Optional[str] = None
    invoice_id: Optional[str] = None
    quotation_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    dc_date: Optional[datetime] = None
    from_godown_id: Optional[str] = None
    transporter_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    eway_bill_number: Optional[str] = None
    delivery_address: Optional[DeliveryAddress] = None
    notes: Optional[str] = None
    auto_update_stock: bool = True
    items: List[DCItemCreate]


class DCInCreate(BaseModel):
    customer_id: Optional[str] = None
    original_dc_id: Optional[str] = None
    invoice_id: Optional[str] = None
    dc_date: Optional[datetime] = None
    to_godown_id: Optional[str] = None
    return_reason: Optional[str] = None
    notes: Optional[str] = None
    auto_update_stock: bool = True
    items: List[DCItemCreate]


class CreateFromInvoiceRequest(BaseModel):
    from_godown_id: Optional[str] = None
    items: Optional[List[DCItemCreate]] = None
    partial_dispatch: bool = False


class LinkToInvoiceRequest(BaseModel):
    invoice_id: str


class MarkDispatchedRequest(BaseModel):
    pass


class MarkInTransitRequest(BaseModel):
    vehicle_number: Optional[str] = None
    lr_number: Optional[str] = None


class MarkDeliveredRequest(BaseModel):
    delivered_at: Optional[datetime] = None
    received_by: Optional[str] = None


class CancelRequest(BaseModel):
    reason: Optional[str] = None


class DCItemResponse(BaseModel):
    id: str
    product_id: Optional[str]
    description: str
    hsn_code: Optional[str]
    quantity: float
    unit: str
    unit_price: float
    godown_id: Optional[str]
    serial_numbers: Optional[List[str]]
    notes: Optional[str]

    class Config:
        from_attributes = True


class DCResponse(BaseModel):
    id: str
    dc_number: str
    dc_date: datetime
    dc_type: str
    status: str
    customer_id: Optional[str]
    customer_name: Optional[str] = None
    invoice_id: Optional[str]
    invoice_number: Optional[str] = None
    quotation_id: Optional[str]
    original_dc_id: Optional[str]
    return_reason: Optional[str]
    from_godown_id: Optional[str]
    to_godown_id: Optional[str]
    transporter_name: Optional[str]
    vehicle_number: Optional[str]
    eway_bill_number: Optional[str]
    delivery_to_address: Optional[str]
    delivery_to_city: Optional[str]
    delivery_to_state: Optional[str]
    delivery_to_pincode: Optional[str]
    stock_updated: bool
    delivered_at: Optional[datetime]
    received_by: Optional[str]
    notes: Optional[str]
    created_at: datetime
    items: Optional[List[DCItemResponse]] = None

    class Config:
        from_attributes = True


class DCListResponse(BaseModel):
    items: List[DCResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PendingDispatchResponse(BaseModel):
    id: str
    invoice_number: str
    invoice_date: datetime
    customer_id: Optional[str]
    customer_name: Optional[str]
    total_amount: float


# ==================== ENDPOINTS ====================

@router.post("/companies/{company_id}/delivery-challans/dc-out", response_model=DCResponse)
async def create_dc_out(
    company_id: str,
    data: DCOutCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a DC Out (goods dispatch)."""
    company = get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    try:
        items = [item.model_dump() for item in data.items]
        delivery_address = data.delivery_address.model_dump() if data.delivery_address else None
        
        dc = service.create_dc_out(
            company=company,
            items=items,
            customer_id=data.customer_id,
            invoice_id=data.invoice_id,
            quotation_id=data.quotation_id,
            sales_order_id=data.sales_order_id,
            dc_date=data.dc_date,
            from_godown_id=data.from_godown_id,
            transporter_name=data.transporter_name,
            vehicle_number=data.vehicle_number,
            eway_bill_number=data.eway_bill_number,
            delivery_address=delivery_address,
            notes=data.notes,
            auto_update_stock=data.auto_update_stock,
        )
        
        return _dc_to_response(dc, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/delivery-challans/dc-in", response_model=DCResponse)
async def create_dc_in(
    company_id: str,
    data: DCInCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a DC In (goods return)."""
    company = get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    try:
        items = [item.model_dump() for item in data.items]
        
        dc = service.create_dc_in(
            company=company,
            items=items,
            customer_id=data.customer_id,
            original_dc_id=data.original_dc_id,
            invoice_id=data.invoice_id,
            dc_date=data.dc_date,
            to_godown_id=data.to_godown_id,
            return_reason=data.return_reason,
            notes=data.notes,
            auto_update_stock=data.auto_update_stock,
        )
        
        return _dc_to_response(dc, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/invoices/{invoice_id}/create-dc", response_model=DCResponse)
async def create_dc_from_invoice(
    company_id: str,
    invoice_id: str,
    data: CreateFromInvoiceRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a DC Out from an invoice."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    try:
        items = [item.model_dump() for item in data.items] if data.items else None
        
        dc = service.create_dc_from_invoice(
            invoice=invoice,
            from_godown_id=data.from_godown_id,
            items=items,
            partial_dispatch=data.partial_dispatch,
        )
        
        return _dc_to_response(dc, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/companies/{company_id}/delivery-challans", response_model=DCListResponse)
async def list_delivery_challans(
    company_id: str,
    dc_type: Optional[str] = None,
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List delivery challans with filters."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    # Parse enums
    dc_type_enum = None
    if dc_type:
        try:
            dc_type_enum = DeliveryChallanType(dc_type)
        except ValueError:
            pass
    
    status_enum = None
    if status:
        try:
            status_enum = DeliveryChallanStatus(status)
        except ValueError:
            pass
    
    # Parse dates
    from_dt = datetime.fromisoformat(from_date).date() if from_date else None
    to_dt = datetime.fromisoformat(to_date).date() if to_date else None
    
    result = service.list_delivery_challans(
        company_id=company_id,
        dc_type=dc_type_enum,
        status=status_enum,
        customer_id=customer_id,
        invoice_id=invoice_id,
        from_date=from_dt,
        to_date=to_dt,
        page=page,
        page_size=page_size,
    )
    
    return {
        "items": [_dc_to_response(dc, db, include_items=False) for dc in result["items"]],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
    }


@router.get("/companies/{company_id}/delivery-challans/{dc_id}", response_model=DCResponse)
async def get_delivery_challan(
    company_id: str,
    dc_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a single delivery challan by ID."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dc = service.get_delivery_challan(company_id, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    return _dc_to_response(dc, db)


@router.post("/companies/{company_id}/delivery-challans/{dc_id}/dispatch", response_model=DCResponse)
async def dispatch_dc(
    company_id: str,
    dc_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark DC as dispatched."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dc = service.get_delivery_challan(company_id, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    try:
        dc = service.mark_dispatched(dc)
        return _dc_to_response(dc, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/delivery-challans/{dc_id}/in-transit", response_model=DCResponse)
async def mark_in_transit(
    company_id: str,
    dc_id: str,
    data: MarkInTransitRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark DC as in transit."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dc = service.get_delivery_challan(company_id, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    dc = service.mark_in_transit(dc, vehicle_number=data.vehicle_number, lr_number=data.lr_number)
    return _dc_to_response(dc, db)


@router.post("/companies/{company_id}/delivery-challans/{dc_id}/delivered", response_model=DCResponse)
async def mark_delivered(
    company_id: str,
    dc_id: str,
    data: MarkDeliveredRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark DC as delivered."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dc = service.get_delivery_challan(company_id, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    dc = service.mark_delivered(dc, delivered_at=data.delivered_at, received_by=data.received_by)
    return _dc_to_response(dc, db)


@router.post("/companies/{company_id}/delivery-challans/{dc_id}/link-invoice", response_model=DCResponse)
async def link_dc_to_invoice(
    company_id: str,
    dc_id: str,
    data: LinkToInvoiceRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Link a standalone DC to an invoice."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dc = service.get_delivery_challan(company_id, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    # Verify invoice exists
    invoice = db.query(Invoice).filter(
        Invoice.id == data.invoice_id,
        Invoice.company_id == company_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    dc = service.link_to_invoice(dc, data.invoice_id)
    return _dc_to_response(dc, db)


@router.post("/companies/{company_id}/delivery-challans/{dc_id}/cancel", response_model=DCResponse)
async def cancel_dc(
    company_id: str,
    dc_id: str,
    data: CancelRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a delivery challan."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dc = service.get_delivery_challan(company_id, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    try:
        dc = service.cancel_dc(dc, reason=data.reason)
        return _dc_to_response(dc, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/companies/{company_id}/delivery-challans/{dc_id}")
async def delete_dc(
    company_id: str,
    dc_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a delivery challan (only DRAFT status)."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dc = service.get_delivery_challan(company_id, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    try:
        service.delete_dc(dc)
        return {"message": "Delivery challan deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/companies/{company_id}/pending-dispatches", response_model=List[PendingDispatchResponse])
async def get_pending_dispatches(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get invoices that don't have associated DCs yet."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    invoices = service.get_pending_dispatches(company_id)
    
    result = []
    for inv in invoices:
        customer_name = None
        if inv.customer_id:
            customer = db.query(Customer).filter(Customer.id == inv.customer_id).first()
            if customer:
                customer_name = customer.name
        
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date,
            "customer_id": inv.customer_id,
            "customer_name": customer_name,
            "total_amount": float(inv.total_amount or 0),
        })
    
    return result


@router.get("/companies/{company_id}/invoices/{invoice_id}/delivery-challans", response_model=List[DCResponse])
async def get_dcs_for_invoice(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all DCs linked to an invoice."""
    get_company_or_404(company_id, current_user, db)
    service = DeliveryChallanService(db)
    
    dcs = service.get_dcs_for_invoice(invoice_id)
    return [_dc_to_response(dc, db, include_items=False) for dc in dcs]


# ==================== HELPER FUNCTIONS ====================

def _dc_to_response(dc, db: Session, include_items: bool = True) -> dict:
    """Convert delivery challan model to response dict."""
    customer_name = None
    if dc.customer_id:
        customer = db.query(Customer).filter(Customer.id == dc.customer_id).first()
        if customer:
            customer_name = customer.name
    
    invoice_number = None
    if dc.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == dc.invoice_id).first()
        if invoice:
            invoice_number = invoice.invoice_number
    
    response = {
        "id": dc.id,
        "dc_number": dc.dc_number,
        "dc_date": dc.dc_date,
        "dc_type": dc.dc_type.value if dc.dc_type else "dc_out",
        "status": dc.status.value if dc.status else "draft",
        "customer_id": dc.customer_id,
        "customer_name": customer_name,
        "invoice_id": dc.invoice_id,
        "invoice_number": invoice_number,
        "quotation_id": dc.quotation_id,
        "original_dc_id": dc.original_dc_id,
        "return_reason": dc.return_reason,
        "from_godown_id": dc.from_godown_id,
        "to_godown_id": dc.to_godown_id,
        "transporter_name": dc.transporter_name,
        "vehicle_number": dc.vehicle_number,
        "eway_bill_number": dc.eway_bill_number,
        "delivery_to_address": dc.delivery_to_address,
        "delivery_to_city": dc.delivery_to_city,
        "delivery_to_state": dc.delivery_to_state,
        "delivery_to_pincode": dc.delivery_to_pincode,
        "stock_updated": dc.stock_updated or False,
        "delivered_at": dc.delivered_at,
        "received_by": dc.received_by,
        "notes": dc.notes,
        "created_at": dc.created_at,
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
                "unit_price": float(item.unit_price or 0),
                "godown_id": item.godown_id,
                "serial_numbers": item.serial_numbers,
                "notes": item.notes,
            }
            for item in dc.items
        ]
    
    return response

