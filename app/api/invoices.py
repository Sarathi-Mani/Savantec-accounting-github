"""Invoice API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from decimal import Decimal
from app.database.connection import get_db
from app.database.models import User, Company, InvoiceStatus
from app.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    InvoiceItemCreate, InvoiceItemResponse,
    InvoiceListResponse, PaymentCreate, PaymentResponse,
    UPIQRResponse, StatusChangeRequest
)
from app.services.invoice_service import InvoiceService
from app.services.payment_service import PaymentService
from app.services.customer_service import CustomerService
from app.services.company_service import CompanyService
from app.services.pdf_service import PDFService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/invoices", tags=["Invoices"])


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


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    company_id: str,
    data: InvoiceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Get customer if provided
    customer = None
    if data.customer_id:
        customer_service = CustomerService(db)
        customer = customer_service.get_customer(data.customer_id, company)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.create_invoice(company, data, customer)
    
    # Build response with customer details
    response = InvoiceResponse.model_validate(invoice)
    if customer:
        response.customer_name = customer.name
        response.customer_gstin = customer.gstin
        response.customer_email = customer.email
        response.customer_phone = customer.phone
    
    return response


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List invoices for a company."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoices, total, summary = invoice_service.get_invoices(
        company, page, page_size, status, customer_id, from_date, to_date, search
    )
    
    invoice_responses = []
    for invoice in invoices:
        response = InvoiceResponse.model_validate(invoice)
        if invoice.customer:
            response.customer_name = invoice.customer.name
            response.customer_gstin = invoice.customer.gstin
            response.customer_email = invoice.customer.email
            response.customer_phone = invoice.customer.phone
        invoice_responses.append(response)
    
    return InvoiceListResponse(
        invoices=invoice_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_amount=summary["total_amount"],
        total_paid=summary["total_paid"],
        total_pending=summary["total_pending"]
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get an invoice by ID."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    # Enrich response with godown names in warehouse allocation
    response = InvoiceResponse.model_validate(invoice)
    if invoice.customer:
        response.customer_name = invoice.customer.name
        response.customer_gstin = invoice.customer.gstin
        response.customer_email = invoice.customer.email
        response.customer_phone = invoice.customer.phone
    
    # Add godown names to warehouse allocations
    from app.database.models import Godown
    for item in response.items:
        if item.warehouse_allocation:
            enriched_allocation = []
            for alloc in item.warehouse_allocation:
                godown_id = alloc.get("godown_id")
                enriched_alloc = dict(alloc)
                
                if godown_id:
                    godown = db.query(Godown).filter(Godown.id == godown_id).first()
                    enriched_alloc["godown_name"] = godown.name if godown else "Unknown"
                else:
                    enriched_alloc["godown_name"] = "Main Location"
                
                enriched_allocation.append(enriched_alloc)
            item.warehouse_allocation = enriched_allocation
    
    return response


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    company_id: str,
    invoice_id: str,
    data: InvoiceUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    if invoice.status not in [InvoiceStatus.DRAFT]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft invoices can be updated"
        )
    
    updated_invoice = invoice_service.update_invoice(invoice, data)
    return InvoiceResponse.model_validate(updated_invoice)


@router.post("/{invoice_id}/finalize", response_model=InvoiceResponse)
async def finalize_invoice(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Finalize a draft invoice (make it pending)."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        finalized_invoice = invoice_service.finalize_invoice(invoice)
        return InvoiceResponse.model_validate(finalized_invoice)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{invoice_id}/allocate-stock")
async def allocate_stock_for_invoice(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Allocate stock for an existing invoice that wasn't tracked before.
    Used for legacy invoices or invoices created with auto_reduce_stock disabled.
    """
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    from app.services.stock_allocation_service import StockAllocationService
    stock_service = StockAllocationService(db)
    
    result = stock_service.allocate_existing_invoice(invoice)
    
    if result.get("already_tracked"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice already has stock tracking"
        )
    
    return result


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    company_id: str,
    invoice_id: str,
    data: Optional[StatusChangeRequest] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        reason = data.reason if data else None
        cancelled_invoice = invoice_service.cancel_invoice(invoice, reason)
        return InvoiceResponse.model_validate(cancelled_invoice)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{invoice_id}")
async def delete_invoice(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an invoice permanently. Only draft invoices can be deleted."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        invoice_service.delete_invoice(invoice)
        return {"message": "Invoice deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{invoice_id}/refund", response_model=InvoiceResponse)
async def refund_invoice(
    company_id: str,
    invoice_id: str,
    data: Optional[StatusChangeRequest] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark an invoice as refunded."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        reason = data.reason if data else None
        refund_amount = data.refund_amount if data else None
        refunded_invoice = invoice_service.refund_invoice(invoice, reason, refund_amount)
        return InvoiceResponse.model_validate(refunded_invoice)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{invoice_id}/void", response_model=InvoiceResponse)
async def void_invoice(
    company_id: str,
    invoice_id: str,
    data: Optional[StatusChangeRequest] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Void an invoice (for accounting purposes, invoice remains in records)."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        reason = data.reason if data else None
        voided_invoice = invoice_service.void_invoice(invoice, reason)
        return InvoiceResponse.model_validate(voided_invoice)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{invoice_id}/write-off", response_model=InvoiceResponse)
async def write_off_invoice(
    company_id: str,
    invoice_id: str,
    data: Optional[StatusChangeRequest] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Write off an invoice as uncollectible."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        reason = data.reason if data else None
        written_off_invoice = invoice_service.write_off_invoice(invoice, reason)
        return InvoiceResponse.model_validate(written_off_invoice)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Item routes
@router.post("/{invoice_id}/items", response_model=InvoiceItemResponse, status_code=status.HTTP_201_CREATED)
async def add_invoice_item(
    company_id: str,
    invoice_id: str,
    data: InvoiceItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add an item to an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        item = invoice_service.add_item_to_invoice(invoice, data, company)
        return InvoiceItemResponse.model_validate(item)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{invoice_id}/items/{item_id}")
async def remove_invoice_item(
    company_id: str,
    invoice_id: str,
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove an item from an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    try:
        success = invoice_service.remove_item_from_invoice(invoice, item_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        return {"message": "Item removed successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Payment routes
@router.post("/{invoice_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    company_id: str,
    invoice_id: str,
    data: PaymentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Record a payment for an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    payment_service = PaymentService(db)
    try:
        payment = payment_service.record_payment(invoice, data)
        return PaymentResponse.model_validate(payment)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{invoice_id}/payments")
async def list_payments(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List payments for an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    payment_service = PaymentService(db)
    payments = payment_service.get_payments(invoice)
    return [PaymentResponse.model_validate(p) for p in payments]


# PDF and QR routes
@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download invoice as PDF."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    pdf_service = PDFService()
    pdf_buffer = pdf_service.generate_invoice_pdf(invoice, company, invoice.customer)
    
    filename = f"Invoice_{invoice.invoice_number}.pdf"
    
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{invoice_id}/qr", response_model=UPIQRResponse)
async def get_invoice_qr(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get UPI QR code for an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    if not invoice.upi_qr_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No UPI payment configured for this invoice"
        )
    
    qr_image = invoice_service.generate_upi_qr_image(invoice)
    
    return UPIQRResponse(
        qr_data=invoice.upi_qr_data,
        qr_image_base64=qr_image,
        upi_link=invoice.payment_link or "",
        amount=invoice.balance_due,
        invoice_number=invoice.invoice_number
    )


# Mark paid via UPI webhook (simplified)
@router.post("/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    company_id: str,
    invoice_id: str,
    upi_transaction_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Manually mark an invoice as paid."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice(invoice_id, company)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    if invoice.balance_due <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already fully paid"
        )
    
    payment_service = PaymentService(db)
    payment = payment_service.auto_mark_paid_from_upi(
        invoice,
        upi_transaction_id or "MANUAL",
        invoice.balance_due
    )
    
    return {
        "message": "Invoice marked as paid",
        "payment_id": payment.id,
        "amount": payment.amount
    }

