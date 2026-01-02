"""GST Integration API - E-Invoice, E-Way Bill, ITC endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import User, Company, Invoice
from app.services.gst_integration_service import GSTIntegrationService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/gst", tags=["GST Integration"])


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

class EInvoiceRequest(BaseModel):
    invoice_id: str


class EWayBillRequest(BaseModel):
    invoice_id: str
    transporter_id: Optional[str] = None
    transporter_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_type: str = "R"
    transport_mode: str = "1"
    distance_km: int = 0


class ITCReconcileRequest(BaseModel):
    gstr2a_data: List[dict] = []


# ============== E-Invoice Endpoints ==============

@router.post("/e-invoice/generate")
async def generate_einvoice(
    company_id: str,
    data: EInvoiceRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate E-Invoice (IRN) for an invoice.
    
    Note: This is a simulation. Actual integration requires GST portal credentials.
    """
    company = get_company_or_404(company_id, current_user, db)
    
    invoice = db.query(Invoice).filter(
        Invoice.id == data.invoice_id,
        Invoice.company_id == company.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.irn:
        return {
            "success": False,
            "message": "E-Invoice already generated for this invoice",
            "irn": invoice.irn,
        }
    
    service = GSTIntegrationService(db)
    result = service.submit_einvoice(invoice)
    
    return result


@router.post("/e-invoice/cancel")
async def cancel_einvoice(
    company_id: str,
    data: EInvoiceRequest,
    reason: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel an E-Invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice = db.query(Invoice).filter(
        Invoice.id == data.invoice_id,
        Invoice.company_id == company.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    service = GSTIntegrationService(db)
    result = service.cancel_einvoice(invoice, reason)
    
    return result


@router.get("/e-invoice/{invoice_id}")
async def get_einvoice_details(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get E-Invoice details for an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    service = GSTIntegrationService(db)
    
    return {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "has_irn": bool(invoice.irn),
        "irn": invoice.irn,
        "ack_number": invoice.ack_number,
        "ack_date": invoice.ack_date.isoformat() if invoice.ack_date else None,
        "signed_qr": invoice.signed_qr,
        "einvoice_data": service.generate_irn_data(invoice) if not invoice.irn else None,
    }


# ============== E-Way Bill Endpoints ==============

@router.post("/eway-bill/generate")
async def generate_eway_bill(
    company_id: str,
    data: EWayBillRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate E-Way Bill for an invoice.
    
    Note: This is a simulation. Actual integration requires E-Way Bill portal credentials.
    """
    company = get_company_or_404(company_id, current_user, db)
    
    invoice = db.query(Invoice).filter(
        Invoice.id == data.invoice_id,
        Invoice.company_id == company.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    service = GSTIntegrationService(db)
    result = service.generate_eway_bill(
        invoice=invoice,
        transporter_id=data.transporter_id,
        transporter_name=data.transporter_name,
        vehicle_number=data.vehicle_number,
        distance_km=data.distance_km,
    )
    
    return result


@router.get("/eway-bill/check/{invoice_id}")
async def check_eway_bill_required(
    company_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if E-Way Bill is required for an invoice."""
    company = get_company_or_404(company_id, current_user, db)
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company.id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    service = GSTIntegrationService(db)
    
    return {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "total_value": float(invoice.total_amount or 0),
        "eway_bill_required": service.check_eway_bill_required(invoice),
        "threshold": 50000,
    }


# ============== ITC Reconciliation Endpoints ==============

@router.get("/itc/summary")
async def get_itc_summary(
    company_id: str,
    from_date: date,
    to_date: date,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get ITC summary for a period."""
    company = get_company_or_404(company_id, current_user, db)
    service = GSTIntegrationService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time())
    to_dt = datetime.combine(to_date, datetime.max.time())
    
    return service.get_itc_summary(company, from_dt, to_dt)


@router.post("/itc/reconcile")
async def reconcile_itc(
    company_id: str,
    data: ITCReconcileRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reconcile ITC with GSTR-2A data."""
    company = get_company_or_404(company_id, current_user, db)
    service = GSTIntegrationService(db)
    
    result = service.reconcile_itc(company, data.gstr2a_data)
    
    return result


# ============== GSTR-1 Summary ==============

@router.get("/gstr1/summary")
async def get_gstr1_summary(
    company_id: str,
    from_date: date,
    to_date: date,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get GSTR-1 summary for a period."""
    company = get_company_or_404(company_id, current_user, db)
    service = GSTIntegrationService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time())
    to_dt = datetime.combine(to_date, datetime.max.time())
    
    return service.get_gstr1_summary(company, from_dt, to_dt)
