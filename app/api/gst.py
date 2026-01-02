"""GST Report API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from datetime import datetime
import json
from app.database.connection import get_db
from app.database.models import User, Company
from app.schemas.gst import GSTR1Response, GSTR3BResponse, GSTSummary
from app.services.gst_service import GSTService
from app.services.company_service import CompanyService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/gst", tags=["GST Reports"])


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


@router.get("/summary", response_model=GSTSummary)
async def get_gst_summary(
    company_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get GST summary for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    gst_service = GSTService(db)
    summary = gst_service.get_gst_summary(company, month, year)
    
    return summary


@router.get("/gstr1", response_model=GSTR1Response)
async def get_gstr1_report(
    company_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get GSTR-1 report for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    if not company.gstin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company GSTIN is required for GST reports"
        )
    
    gst_service = GSTService(db)
    report = gst_service.generate_gstr1(company, month, year)
    
    return report


@router.get("/gstr1/download")
async def download_gstr1_json(
    company_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download GSTR-1 report as JSON file."""
    company = get_company_or_404(company_id, current_user, db)
    
    if not company.gstin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company GSTIN is required for GST reports"
        )
    
    gst_service = GSTService(db)
    report = gst_service.generate_gstr1(company, month, year)
    
    # Convert to JSON format compatible with GST portal
    json_data = report.model_dump()
    
    # Convert Decimal to float for JSON serialization
    def convert_decimals(obj):
        if isinstance(obj, dict):
            return {k: convert_decimals(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_decimals(item) for item in obj]
        elif hasattr(obj, '__float__'):
            return float(obj)
        return obj
    
    json_data = convert_decimals(json_data)
    
    filename = f"GSTR1_{company.gstin}_{month:02d}{year}.json"
    
    return Response(
        content=json.dumps(json_data, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/gstr3b", response_model=GSTR3BResponse)
async def get_gstr3b_report(
    company_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get GSTR-3B report for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    if not company.gstin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company GSTIN is required for GST reports"
        )
    
    gst_service = GSTService(db)
    report = gst_service.generate_gstr3b(company, month, year)
    
    return report


@router.get("/gstr3b/download")
async def download_gstr3b_json(
    company_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download GSTR-3B report as JSON file."""
    company = get_company_or_404(company_id, current_user, db)
    
    if not company.gstin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company GSTIN is required for GST reports"
        )
    
    gst_service = GSTService(db)
    report = gst_service.generate_gstr3b(company, month, year)
    
    # Convert to JSON format
    json_data = report.model_dump()
    
    def convert_decimals(obj):
        if isinstance(obj, dict):
            return {k: convert_decimals(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_decimals(item) for item in obj]
        elif hasattr(obj, '__float__'):
            return float(obj)
        return obj
    
    json_data = convert_decimals(json_data)
    
    filename = f"GSTR3B_{company.gstin}_{month:02d}{year}.json"
    
    return Response(
        content=json.dumps(json_data, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/state-codes")
async def get_state_codes():
    """Get list of Indian state codes for GST."""
    from app.database.models import INDIAN_STATE_CODES
    return [
        {"code": code, "name": name}
        for code, name in sorted(INDIAN_STATE_CODES.items())
    ]

