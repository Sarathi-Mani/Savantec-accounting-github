"""Purchase Invoice API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import User, Company, PurchaseInvoiceStatus
from app.services.purchase_service import PurchaseService
from app.services.tds_service import TDSService
from app.services.company_service import CompanyService
from app.services.customer_service import CustomerService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/purchases", tags=["Purchase Invoices"])


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


# ==================== SCHEMAS ====================

class PurchaseItemCreate(BaseModel):
    """Schema for creating a purchase invoice item."""
    product_id: Optional[str] = None
    description: str
    hsn_code: Optional[str] = None
    quantity: float
    unit: str = "unit"
    unit_price: float
    gst_rate: float = 18
    discount_percent: float = 0
    itc_eligible: bool = True


class PurchaseInvoiceCreate(BaseModel):
    """Schema for creating a purchase invoice."""
    vendor_id: str
    vendor_invoice_number: Optional[str] = None
    vendor_invoice_date: Optional[datetime] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    place_of_supply: Optional[str] = None
    is_reverse_charge: bool = False
    tds_section_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    receipt_note_id: Optional[str] = None
    notes: Optional[str] = None
    auto_receive_stock: bool = False
    godown_id: Optional[str] = None
    items: List[PurchaseItemCreate]


class PurchaseItemResponse(BaseModel):
    """Schema for purchase invoice item response."""
    id: str
    product_id: Optional[str] = None
    description: str
    hsn_code: Optional[str] = None
    quantity: float
    unit: str
    unit_price: float
    gst_rate: float
    cgst_rate: float
    sgst_rate: float
    igst_rate: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    taxable_amount: float
    total_amount: float
    itc_eligible: bool
    stock_received: bool

    class Config:
        from_attributes = True


class PurchaseInvoiceResponse(BaseModel):
    """Schema for purchase invoice response."""
    id: str
    company_id: str
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    invoice_number: str
    vendor_invoice_number: Optional[str] = None
    invoice_date: datetime
    vendor_invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    place_of_supply: Optional[str] = None
    place_of_supply_name: Optional[str] = None
    is_reverse_charge: bool
    subtotal: float
    discount_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_tax: float
    total_amount: float
    tds_applicable: bool
    tds_rate: float
    tds_amount: float
    net_payable: float
    amount_paid: float
    balance_due: float
    status: str
    itc_eligible: bool
    notes: Optional[str] = None
    created_at: datetime
    items: List[PurchaseItemResponse] = []

    class Config:
        from_attributes = True


class PurchaseListResponse(BaseModel):
    """Schema for paginated purchase invoice list."""
    items: List[PurchaseInvoiceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaymentCreate(BaseModel):
    """Schema for creating a purchase payment."""
    amount: float
    payment_date: Optional[datetime] = None
    payment_mode: str = "bank_transfer"
    reference_number: Optional[str] = None
    bank_account_id: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    """Schema for payment response."""
    id: str
    amount: float
    payment_date: datetime
    payment_mode: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InputGSTSummaryResponse(BaseModel):
    """Schema for input GST summary."""
    period: dict
    total_invoices: int
    total_taxable_value: float
    cgst_input: float
    sgst_input: float
    igst_input: float
    total_itc_available: float


# ==================== PURCHASE INVOICE ENDPOINTS ====================

@router.post("", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_invoice(
    company_id: str,
    data: PurchaseInvoiceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new purchase invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Validate vendor
    customer_service = CustomerService(db)
    vendor = customer_service.get_customer(data.vendor_id, company)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Convert items to dict format
    items = [item.model_dump() for item in data.items]
    
    purchase_service = PurchaseService(db)
    invoice = purchase_service.create_purchase_invoice(
        company=company,
        vendor_id=data.vendor_id,
        items=items,
        vendor_invoice_number=data.vendor_invoice_number,
        vendor_invoice_date=data.vendor_invoice_date,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        place_of_supply=data.place_of_supply,
        is_reverse_charge=data.is_reverse_charge,
        tds_section_id=data.tds_section_id,
        purchase_order_id=data.purchase_order_id,
        receipt_note_id=data.receipt_note_id,
        notes=data.notes,
        auto_receive_stock=data.auto_receive_stock,
        godown_id=data.godown_id,
    )
    
    response = _build_purchase_response(invoice)
    return response


@router.get("", response_model=PurchaseListResponse)
async def list_purchase_invoices(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List purchase invoices for a company."""
    company = get_company_or_404(company_id, current_user, db)
    
    purchase_service = PurchaseService(db)
    
    status_enum = None
    if status:
        try:
            status_enum = PurchaseInvoiceStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status}"
            )
    
    invoices, total = purchase_service.get_purchase_invoices(
        company=company,
        vendor_id=vendor_id,
        status=status_enum,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
    )
    
    items = [_build_purchase_response(inv) for inv in invoices]
    total_pages = (total + page_size - 1) // page_size
    
    return PurchaseListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{invoice_id}", response_model=PurchaseInvoiceResponse)
async def get_purchase_invoice(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a purchase invoice by ID."""
    company = get_company_or_404(company_id, current_user, db)
    
    purchase_service = PurchaseService(db)
    invoice = purchase_service.get_purchase_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found"
        )
    
    return _build_purchase_response(invoice)


@router.post("/{invoice_id}/approve", response_model=PurchaseInvoiceResponse)
async def approve_purchase_invoice(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Approve a draft purchase invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    purchase_service = PurchaseService(db)
    invoice = purchase_service.get_purchase_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found"
        )
    
    try:
        invoice = purchase_service.approve_purchase_invoice(invoice)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return _build_purchase_response(invoice)


@router.post("/{invoice_id}/payments", response_model=PaymentResponse)
async def record_payment(
    company_id: str,
    invoice_id: str,
    data: PaymentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Record a payment against a purchase invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    purchase_service = PurchaseService(db)
    invoice = purchase_service.get_purchase_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found"
        )
    
    from app.database.models import PaymentMode
    try:
        payment_mode = PaymentMode(data.payment_mode)
    except ValueError:
        payment_mode = PaymentMode.BANK_TRANSFER
    
    try:
        payment = purchase_service.record_payment(
            invoice=invoice,
            amount=Decimal(str(data.amount)),
            payment_date=data.payment_date,
            payment_mode=payment_mode,
            reference_number=data.reference_number,
            bank_account_id=data.bank_account_id,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return PaymentResponse(
        id=payment.id,
        amount=float(payment.amount),
        payment_date=payment.payment_date,
        payment_mode=payment.payment_mode.value,
        reference_number=payment.reference_number,
        notes=payment.notes,
        created_at=payment.created_at,
    )


@router.post("/{invoice_id}/receive-stock")
async def receive_stock(
    company_id: str,
    invoice_id: str,
    godown_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Receive stock for a purchase invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    purchase_service = PurchaseService(db)
    invoice = purchase_service.get_purchase_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found"
        )
    
    entries = purchase_service.receive_stock_for_invoice(invoice, godown_id)
    
    return {
        "message": f"Stock received for {len(entries)} items",
        "entries_created": len(entries),
    }


@router.post("/{invoice_id}/cancel", response_model=PurchaseInvoiceResponse)
async def cancel_purchase_invoice(
    company_id: str,
    invoice_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a purchase invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    purchase_service = PurchaseService(db)
    invoice = purchase_service.get_purchase_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found"
        )
    
    try:
        invoice = purchase_service.cancel_purchase_invoice(invoice, reason)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return _build_purchase_response(invoice)


@router.get("/reports/input-gst", response_model=InputGSTSummaryResponse)
async def get_input_gst_summary(
    company_id: str,
    from_date: date,
    to_date: date,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get Input GST summary for GST returns."""
    company = get_company_or_404(company_id, current_user, db)
    
    purchase_service = PurchaseService(db)
    summary = purchase_service.get_input_gst_summary(company, from_date, to_date)
    
    return InputGSTSummaryResponse(**summary)


# ==================== HELPER FUNCTIONS ====================

def _build_purchase_response(invoice) -> PurchaseInvoiceResponse:
    """Build purchase invoice response with vendor details."""
    items = [
        PurchaseItemResponse(
            id=item.id,
            product_id=item.product_id,
            description=item.description,
            hsn_code=item.hsn_code,
            quantity=float(item.quantity),
            unit=item.unit,
            unit_price=float(item.unit_price),
            gst_rate=float(item.gst_rate),
            cgst_rate=float(item.cgst_rate),
            sgst_rate=float(item.sgst_rate),
            igst_rate=float(item.igst_rate),
            cgst_amount=float(item.cgst_amount),
            sgst_amount=float(item.sgst_amount),
            igst_amount=float(item.igst_amount),
            taxable_amount=float(item.taxable_amount),
            total_amount=float(item.total_amount),
            itc_eligible=item.itc_eligible,
            stock_received=item.stock_received,
        )
        for item in invoice.items
    ]
    
    return PurchaseInvoiceResponse(
        id=invoice.id,
        company_id=invoice.company_id,
        vendor_id=invoice.vendor_id,
        vendor_name=invoice.vendor.name if invoice.vendor else None,
        vendor_gstin=invoice.vendor.gstin if invoice.vendor else None,
        invoice_number=invoice.invoice_number,
        vendor_invoice_number=invoice.vendor_invoice_number,
        invoice_date=invoice.invoice_date,
        vendor_invoice_date=invoice.vendor_invoice_date,
        due_date=invoice.due_date,
        place_of_supply=invoice.place_of_supply,
        place_of_supply_name=invoice.place_of_supply_name,
        is_reverse_charge=invoice.is_reverse_charge,
        subtotal=float(invoice.subtotal),
        discount_amount=float(invoice.discount_amount),
        cgst_amount=float(invoice.cgst_amount),
        sgst_amount=float(invoice.sgst_amount),
        igst_amount=float(invoice.igst_amount),
        total_tax=float(invoice.total_tax),
        total_amount=float(invoice.total_amount),
        tds_applicable=invoice.tds_applicable,
        tds_rate=float(invoice.tds_rate),
        tds_amount=float(invoice.tds_amount),
        net_payable=float(invoice.net_payable),
        amount_paid=float(invoice.amount_paid),
        balance_due=float(invoice.balance_due),
        status=invoice.status.value,
        itc_eligible=invoice.itc_eligible,
        notes=invoice.notes,
        created_at=invoice.created_at,
        items=items,
    )
