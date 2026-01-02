"""GST Reconciliation API - GSTR-2A/2B import and ITC matching."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import json

from app.database.connection import get_db
from app.database.models import User, Company
from app.auth.dependencies import get_current_active_user
from app.services.gst_reconciliation_service import GSTReconciliationService, GSTR2Record

router = APIRouter(prefix="/companies/{company_id}/gst-reconciliation", tags=["GST Reconciliation"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


class GSTR2BImportRequest(BaseModel):
    return_period: str  # MMYYYY format
    json_data: dict


@router.post("/import-gstr2b")
async def import_gstr2b(
    company_id: str,
    data: GSTR2BImportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Import GSTR-2B data from JSON."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = GSTReconciliationService(db)
    
    try:
        result = service.import_gstr2b(
            company_id=company.id,
            return_period=data.return_period,
            json_data=data.json_data,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload-gstr2b")
async def upload_gstr2b_file(
    company_id: str,
    return_period: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload GSTR-2B JSON file."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Read and parse JSON file
    try:
        content = await file.read()
        json_data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    service = GSTReconciliationService(db)
    
    try:
        result = service.import_gstr2b(
            company_id=company.id,
            return_period=return_period,
            json_data=json_data,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reconcile")
async def reconcile_gstr2b(
    company_id: str,
    data: GSTR2BImportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reconcile GSTR-2B data with purchase invoices."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = GSTReconciliationService(db)
    
    try:
        # Parse records
        records = service.parse_gstr2b_json(data.json_data)
        
        # Reconcile
        result = service.reconcile_period(company.id, records)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/itc-summary")
async def get_itc_summary(
    company_id: str,
    data: GSTR2BImportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get ITC reconciliation summary."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = GSTReconciliationService(db)
    
    try:
        # Parse records
        records = service.parse_gstr2b_json(data.json_data)
        
        # Get ITC summary
        result = service.get_itc_reconciliation_summary(
            company.id,
            data.return_period,
            records,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/unmatched-invoices")
async def get_unmatched_invoices(
    company_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get purchase invoices not matched with GSTR-2B."""
    company = get_company_or_404(company_id, current_user, db)
    
    # This would return invoices that haven't been reconciled
    # For now, return all purchase invoices in the period
    from app.database.models import PurchaseInvoice
    
    query = db.query(PurchaseInvoice).filter(PurchaseInvoice.company_id == company.id)
    
    if from_date:
        query = query.filter(PurchaseInvoice.invoice_date >= from_date)
    if to_date:
        query = query.filter(PurchaseInvoice.invoice_date <= to_date)
    
    invoices = query.order_by(PurchaseInvoice.invoice_date.desc()).all()
    
    return [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "vendor_gstin": inv.vendor_gstin,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "total_amount": float(inv.total_amount or 0),
            "cgst": float(inv.cgst_amount or 0),
            "sgst": float(inv.sgst_amount or 0),
            "igst": float(inv.igst_amount or 0),
        }
        for inv in invoices
    ]
