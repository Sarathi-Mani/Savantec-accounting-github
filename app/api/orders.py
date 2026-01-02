"""Orders API - Sales and Purchase order endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import User, Company, OrderStatus
from app.services.order_service import OrderService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/orders", tags=["Orders"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ============== Schemas ==============

class OrderItemInput(BaseModel):
    product_id: Optional[str] = None  # Unified Product model
    description: str
    quantity: Decimal
    unit: str = "Nos"
    rate: Decimal
    gst_rate: Decimal = Decimal("18")


class SalesOrderCreate(BaseModel):
    customer_id: str
    items: List[OrderItemInput]
    order_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    items: List[OrderItemInput]
    order_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None


class DeliveryNoteItemInput(BaseModel):
    product_id: Optional[str] = None  # Unified Product model
    description: str
    quantity: Decimal
    unit: str = "Nos"


class DeliveryNoteCreate(BaseModel):
    sales_order_id: Optional[str] = None
    customer_id: str
    items: List[DeliveryNoteItemInput]
    godown_id: Optional[str] = None
    delivery_date: Optional[datetime] = None
    transporter_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    notes: Optional[str] = None


class ReceiptNoteItemInput(BaseModel):
    product_id: Optional[str] = None  # Unified Product model
    description: str
    quantity: Decimal
    unit: str = "Nos"
    rate: Decimal = Decimal("0")
    rejected_quantity: Decimal = Decimal("0")
    rejection_reason: Optional[str] = None


class ReceiptNoteCreate(BaseModel):
    purchase_order_id: Optional[str] = None
    vendor_id: str
    items: List[ReceiptNoteItemInput]
    godown_id: Optional[str] = None
    receipt_date: Optional[datetime] = None
    vendor_invoice_number: Optional[str] = None
    vendor_invoice_date: Optional[datetime] = None
    notes: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: str
    description: str
    quantity: Decimal
    unit: Optional[str]
    rate: Decimal
    gst_rate: Optional[Decimal]
    tax_amount: Optional[Decimal]
    total_amount: Optional[Decimal]

    class Config:
        from_attributes = True


class SalesOrderResponse(BaseModel):
    id: str
    order_number: str
    order_date: datetime
    expected_delivery_date: Optional[datetime]
    customer_id: Optional[str]
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    quantity_ordered: Optional[Decimal]
    quantity_delivered: Optional[Decimal]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderResponse(BaseModel):
    id: str
    order_number: str
    order_date: datetime
    expected_date: Optional[datetime]
    vendor_id: Optional[str]
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    quantity_ordered: Optional[Decimal]
    quantity_received: Optional[Decimal]
    notes: Optional[str]
    terms: Optional[str] = None
    created_at: datetime
    items: Optional[List[OrderItemResponse]] = None

    class Config:
        from_attributes = True


class PurchaseOrderUpdate(BaseModel):
    vendor_id: Optional[str] = None
    items: Optional[List[OrderItemInput]] = None
    order_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None


class DeliveryNoteResponse(BaseModel):
    id: str
    delivery_number: str
    delivery_date: datetime
    customer_id: Optional[str]
    sales_order_id: Optional[str]
    transporter_name: Optional[str]
    vehicle_number: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReceiptNoteResponse(BaseModel):
    id: str
    receipt_number: str
    receipt_date: datetime
    vendor_id: Optional[str]
    purchase_order_id: Optional[str]
    vendor_invoice_number: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Sales Order Endpoints ==============

@router.post("/sales", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    company_id: str,
    data: SalesOrderCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new sales order."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.create_sales_order(
        company=company,
        customer_id=data.customer_id,
        items=[i.model_dump() for i in data.items],
        order_date=data.order_date,
        expected_delivery_date=data.expected_delivery_date,
        notes=data.notes,
        terms=data.terms,
    )
    
    return SalesOrderResponse(
        id=order.id,
        order_number=order.order_number,
        order_date=order.order_date,
        expected_delivery_date=order.expected_delivery_date,
        customer_id=order.customer_id,
        status=order.status.value,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        total_amount=order.total_amount,
        quantity_ordered=order.quantity_ordered,
        quantity_delivered=order.quantity_delivered,
        notes=order.notes,
        created_at=order.created_at,
    )


@router.get("/sales", response_model=List[SalesOrderResponse])
async def list_sales_orders(
    company_id: str,
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List sales orders."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order_status = None
    if status:
        try:
            order_status = OrderStatus(status)
        except ValueError:
            pass
    
    orders = service.get_sales_orders(company, customer_id, order_status)
    
    return [
        SalesOrderResponse(
            id=o.id,
            order_number=o.order_number,
            order_date=o.order_date,
            expected_delivery_date=o.expected_delivery_date,
            customer_id=o.customer_id,
            status=o.status.value,
            subtotal=o.subtotal or Decimal("0"),
            tax_amount=o.tax_amount or Decimal("0"),
            total_amount=o.total_amount or Decimal("0"),
            quantity_ordered=o.quantity_ordered,
            quantity_delivered=o.quantity_delivered,
            notes=o.notes,
            created_at=o.created_at,
        )
        for o in orders
    ]


@router.get("/sales/{order_id}", response_model=SalesOrderResponse)
async def get_sales_order(
    company_id: str,
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a sales order by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.get_sales_order(order_id, company)
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    return SalesOrderResponse(
        id=order.id,
        order_number=order.order_number,
        order_date=order.order_date,
        expected_delivery_date=order.expected_delivery_date,
        customer_id=order.customer_id,
        status=order.status.value,
        subtotal=order.subtotal or Decimal("0"),
        tax_amount=order.tax_amount or Decimal("0"),
        total_amount=order.total_amount or Decimal("0"),
        quantity_ordered=order.quantity_ordered,
        quantity_delivered=order.quantity_delivered,
        notes=order.notes,
        created_at=order.created_at,
    )


@router.post("/sales/{order_id}/confirm")
async def confirm_sales_order(
    company_id: str,
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Confirm a sales order."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.get_sales_order(order_id, company)
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    service.confirm_sales_order(order)
    return {"message": "Sales order confirmed"}


@router.post("/sales/{order_id}/cancel")
async def cancel_sales_order(
    company_id: str,
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a sales order."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.get_sales_order(order_id, company)
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    service.cancel_sales_order(order)
    return {"message": "Sales order cancelled"}


# ============== Purchase Order Endpoints ==============

@router.post("/purchase", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    company_id: str,
    data: PurchaseOrderCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new purchase order."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.create_purchase_order(
        company=company,
        vendor_id=data.vendor_id,
        items=[i.model_dump() for i in data.items],
        order_date=data.order_date,
        expected_date=data.expected_date,
        notes=data.notes,
        terms=data.terms,
    )
    
    return PurchaseOrderResponse(
        id=order.id,
        order_number=order.order_number,
        order_date=order.order_date,
        expected_date=order.expected_date,
        vendor_id=order.vendor_id,
        status=order.status.value,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        total_amount=order.total_amount,
        quantity_ordered=order.quantity_ordered,
        quantity_received=order.quantity_received,
        notes=order.notes,
        created_at=order.created_at,
    )


@router.get("/purchase", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
    company_id: str,
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List purchase orders."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order_status = None
    if status:
        try:
            order_status = OrderStatus(status)
        except ValueError:
            pass
    
    orders = service.get_purchase_orders(company, vendor_id, order_status)
    
    return [
        PurchaseOrderResponse(
            id=o.id,
            order_number=o.order_number,
            order_date=o.order_date,
            expected_date=o.expected_date,
            vendor_id=o.vendor_id,
            status=o.status.value,
            subtotal=o.subtotal or Decimal("0"),
            tax_amount=o.tax_amount or Decimal("0"),
            total_amount=o.total_amount or Decimal("0"),
            quantity_ordered=o.quantity_ordered,
            quantity_received=o.quantity_received,
            notes=o.notes,
            created_at=o.created_at,
        )
        for o in orders
    ]


@router.get("/purchase/{order_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    company_id: str,
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a purchase order by ID with items."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.get_purchase_order_with_items(order_id, company)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Build items list
    items_response = [
        OrderItemResponse(
            id=item.id,
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            rate=item.rate,
            gst_rate=item.gst_rate,
            tax_amount=item.tax_amount,
            total_amount=item.total_amount,
        )
        for item in order.items
    ]
    
    return PurchaseOrderResponse(
        id=order.id,
        order_number=order.order_number,
        order_date=order.order_date,
        expected_date=order.expected_date,
        vendor_id=order.vendor_id,
        status=order.status.value,
        subtotal=order.subtotal or Decimal("0"),
        tax_amount=order.tax_amount or Decimal("0"),
        total_amount=order.total_amount or Decimal("0"),
        quantity_ordered=order.quantity_ordered,
        quantity_received=order.quantity_received,
        notes=order.notes,
        terms=order.terms,
        created_at=order.created_at,
        items=items_response,
    )


@router.put("/purchase/{order_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    company_id: str,
    order_id: str,
    data: PurchaseOrderUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a purchase order (only draft orders can be updated)."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.get_purchase_order(order_id, company)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if order.status != OrderStatus.DRAFT:
        raise HTTPException(
            status_code=400, 
            detail="Only draft orders can be updated"
        )
    
    updated_order = service.update_purchase_order(
        order=order,
        vendor_id=data.vendor_id,
        items=[i.model_dump() for i in data.items] if data.items else None,
        order_date=data.order_date,
        expected_date=data.expected_date,
        notes=data.notes,
        terms=data.terms,
    )
    
    # Build items list for response
    items_response = [
        OrderItemResponse(
            id=item.id,
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            rate=item.rate,
            gst_rate=item.gst_rate,
            tax_amount=item.tax_amount,
            total_amount=item.total_amount,
        )
        for item in updated_order.items
    ]
    
    return PurchaseOrderResponse(
        id=updated_order.id,
        order_number=updated_order.order_number,
        order_date=updated_order.order_date,
        expected_date=updated_order.expected_date,
        vendor_id=updated_order.vendor_id,
        status=updated_order.status.value,
        subtotal=updated_order.subtotal or Decimal("0"),
        tax_amount=updated_order.tax_amount or Decimal("0"),
        total_amount=updated_order.total_amount or Decimal("0"),
        quantity_ordered=updated_order.quantity_ordered,
        quantity_received=updated_order.quantity_received,
        notes=updated_order.notes,
        terms=updated_order.terms,
        created_at=updated_order.created_at,
        items=items_response,
    )


@router.post("/purchase/{order_id}/confirm")
async def confirm_purchase_order(
    company_id: str,
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Confirm a purchase order."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.get_purchase_order(order_id, company)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    service.confirm_purchase_order(order)
    return {"message": "Purchase order confirmed"}


@router.post("/purchase/{order_id}/cancel")
async def cancel_purchase_order(
    company_id: str,
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a purchase order."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    order = service.get_purchase_order(order_id, company)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    service.cancel_purchase_order(order)
    return {"message": "Purchase order cancelled"}


# ============== Delivery Note Endpoints ==============

@router.post("/delivery-notes", response_model=DeliveryNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery_note(
    company_id: str,
    data: DeliveryNoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a delivery note (goods dispatched)."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    try:
        note = service.create_delivery_note(
            company=company,
            sales_order_id=data.sales_order_id,
            customer_id=data.customer_id,
            items=[i.model_dump() for i in data.items],
            godown_id=data.godown_id,
            delivery_date=data.delivery_date,
            transporter_name=data.transporter_name,
            vehicle_number=data.vehicle_number,
            notes=data.notes,
        )
        
        return DeliveryNoteResponse(
            id=note.id,
            delivery_number=note.delivery_number,
            delivery_date=note.delivery_date,
            customer_id=note.customer_id,
            sales_order_id=note.sales_order_id,
            transporter_name=note.transporter_name,
            vehicle_number=note.vehicle_number,
            notes=note.notes,
            created_at=note.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/delivery-notes", response_model=List[DeliveryNoteResponse])
async def list_delivery_notes(
    company_id: str,
    sales_order_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List delivery notes."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    notes = service.get_delivery_notes(company, sales_order_id)
    
    return [
        DeliveryNoteResponse(
            id=n.id,
            delivery_number=n.delivery_number,
            delivery_date=n.delivery_date,
            customer_id=n.customer_id,
            sales_order_id=n.sales_order_id,
            transporter_name=n.transporter_name,
            vehicle_number=n.vehicle_number,
            notes=n.notes,
            created_at=n.created_at,
        )
        for n in notes
    ]


@router.get("/delivery-notes/{note_id}", response_model=DeliveryNoteResponse)
async def get_delivery_note(
    company_id: str,
    note_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a delivery note by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    from app.database.models import DeliveryNote
    note = db.query(DeliveryNote).filter(
        DeliveryNote.id == note_id,
        DeliveryNote.company_id == company.id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Delivery note not found")
    
    return DeliveryNoteResponse(
        id=note.id,
        delivery_number=note.delivery_number,
        delivery_date=note.delivery_date,
        customer_id=note.customer_id,
        sales_order_id=note.sales_order_id,
        transporter_name=note.transporter_name,
        vehicle_number=note.vehicle_number,
        notes=note.notes,
        created_at=note.created_at,
    )


@router.delete("/delivery-notes/{note_id}")
async def delete_delivery_note(
    company_id: str,
    note_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a delivery note (reverses stock movement)."""
    company = get_company_or_404(company_id, current_user, db)
    
    from app.database.models import DeliveryNote, DeliveryNoteItem
    note = db.query(DeliveryNote).filter(
        DeliveryNote.id == note_id,
        DeliveryNote.company_id == company.id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Delivery note not found")
    
    # Reverse stock movements
    service = OrderService(db)
    for item in note.items:
        if item.product_id:
            service.inventory_service.record_stock_in(
                company=company,
                product_id=item.product_id,
                quantity=item.quantity,
                godown_id=note.godown_id,
                reference_type="delivery_note_reversal",
                reference_id=note.id,
                reference_number=f"{note.delivery_number}-REV",
            )
    
    db.delete(note)
    db.commit()
    
    return {"message": "Delivery note deleted successfully"}


# ============== Receipt Note Endpoints ==============

@router.post("/receipt-notes", response_model=ReceiptNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt_note(
    company_id: str,
    data: ReceiptNoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a receipt note (goods received)."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    try:
        note = service.create_receipt_note(
            company=company,
            purchase_order_id=data.purchase_order_id,
            vendor_id=data.vendor_id,
            items=[i.model_dump() for i in data.items],
            godown_id=data.godown_id,
            receipt_date=data.receipt_date,
            vendor_invoice_number=data.vendor_invoice_number,
            vendor_invoice_date=data.vendor_invoice_date,
            notes=data.notes,
        )
        
        return ReceiptNoteResponse(
            id=note.id,
            receipt_number=note.receipt_number,
            receipt_date=note.receipt_date,
            vendor_id=note.vendor_id,
            purchase_order_id=note.purchase_order_id,
            vendor_invoice_number=note.vendor_invoice_number,
            notes=note.notes,
            created_at=note.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/receipt-notes", response_model=List[ReceiptNoteResponse])
async def list_receipt_notes(
    company_id: str,
    purchase_order_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List receipt notes."""
    company = get_company_or_404(company_id, current_user, db)
    service = OrderService(db)
    
    notes = service.get_receipt_notes(company, purchase_order_id)
    
    return [
        ReceiptNoteResponse(
            id=n.id,
            receipt_number=n.receipt_number,
            receipt_date=n.receipt_date,
            vendor_id=n.vendor_id,
            purchase_order_id=n.purchase_order_id,
            vendor_invoice_number=n.vendor_invoice_number,
            notes=n.notes,
            created_at=n.created_at,
        )
        for n in notes
    ]


@router.get("/receipt-notes/{note_id}", response_model=ReceiptNoteResponse)
async def get_receipt_note(
    company_id: str,
    note_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a receipt note by ID."""
    company = get_company_or_404(company_id, current_user, db)
    
    from app.database.models import ReceiptNote
    note = db.query(ReceiptNote).filter(
        ReceiptNote.id == note_id,
        ReceiptNote.company_id == company.id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Receipt note not found")
    
    return ReceiptNoteResponse(
        id=note.id,
        receipt_number=note.receipt_number,
        receipt_date=note.receipt_date,
        vendor_id=note.vendor_id,
        purchase_order_id=note.purchase_order_id,
        vendor_invoice_number=note.vendor_invoice_number,
        notes=note.notes,
        created_at=note.created_at,
    )


@router.delete("/receipt-notes/{note_id}")
async def delete_receipt_note(
    company_id: str,
    note_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a receipt note (reverses stock movement)."""
    company = get_company_or_404(company_id, current_user, db)
    
    from app.database.models import ReceiptNote, ReceiptNoteItem
    note = db.query(ReceiptNote).filter(
        ReceiptNote.id == note_id,
        ReceiptNote.company_id == company.id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Receipt note not found")
    
    # Reverse stock movements
    service = OrderService(db)
    for item in note.items:
        if item.product_id and item.accepted_quantity:
            service.inventory_service.record_stock_out(
                company=company,
                product_id=item.product_id,
                quantity=item.accepted_quantity,
                godown_id=note.godown_id,
                reference_type="receipt_note_reversal",
                reference_id=note.id,
                reference_number=f"{note.receipt_number}-REV",
            )
    
    db.delete(note)
    db.commit()
    
    return {"message": "Receipt note deleted successfully"}
