"""TDS API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import User, Company
from app.services.tds_service import TDSService
from app.services.company_service import CompanyService
from app.services.customer_service import CustomerService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/tds", tags=["TDS"])


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

class TDSSectionCreate(BaseModel):
    """Schema for creating a TDS section."""
    section_code: str
    description: str
    rate_individual: float
    rate_company: float
    rate_no_pan: float = 20
    threshold_single: float = 0
    threshold_annual: float = 0
    nature_of_payment: Optional[str] = None


class TDSSectionResponse(BaseModel):
    """Schema for TDS section response."""
    id: str
    section_code: str
    description: str
    rate_individual: float
    rate_company: float
    rate_no_pan: float
    threshold_single: float
    threshold_annual: float
    nature_of_payment: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class TDSCalculateRequest(BaseModel):
    """Schema for TDS calculation request."""
    vendor_id: str
    section_id: str
    amount: float
    check_threshold: bool = True


class TDSCalculationResponse(BaseModel):
    """Schema for TDS calculation response."""
    tds_applicable: bool
    section_code: Optional[str] = None
    section_description: Optional[str] = None
    gross_amount: Optional[float] = None
    tds_rate: Optional[float] = None
    tds_amount: Optional[float] = None
    net_payable: Optional[float] = None
    pan_status: Optional[str] = None
    reason: Optional[str] = None


class TDSEntryCreate(BaseModel):
    """Schema for creating a TDS entry manually."""
    vendor_id: str
    section_id: str
    gross_amount: float
    deduction_date: datetime
    purchase_invoice_id: Optional[str] = None
    notes: Optional[str] = None


class TDSEntryResponse(BaseModel):
    """Schema for TDS entry response."""
    id: str
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_pan: Optional[str] = None
    section_code: str
    gross_amount: float
    tds_rate: float
    tds_amount: float
    deduction_date: datetime
    financial_year: str
    quarter: str
    is_deposited: bool
    challan_number: Optional[str] = None
    challan_date: Optional[datetime] = None
    deposit_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class TDSDepositRequest(BaseModel):
    """Schema for recording TDS deposit."""
    entry_ids: List[str]
    challan_number: str
    challan_date: datetime
    bsr_code: str
    deposit_date: Optional[datetime] = None


class TDSSummaryResponse(BaseModel):
    """Schema for TDS summary."""
    financial_year: str
    quarter: Optional[str] = None
    total_entries: int
    total_deducted: float
    total_deposited: float
    total_pending: float
    section_wise: List[dict]


class VendorTDSStatementResponse(BaseModel):
    """Schema for vendor TDS statement."""
    vendor: dict
    financial_year: str
    entries: List[dict]
    total_gross_amount: float
    total_tds_deducted: float


class PendingDepositResponse(BaseModel):
    """Schema for pending TDS deposits."""
    financial_year: str
    quarter: str
    due_date: Optional[str] = None
    total_amount: float
    entry_count: int
    entry_ids: List[str]


# ==================== TDS SECTION ENDPOINTS ====================

@router.post("/sections/initialize", response_model=List[TDSSectionResponse])
async def initialize_tds_sections(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Initialize default TDS sections for the company."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    sections = tds_service.initialize_tds_sections(company)
    
    return [_build_section_response(s) for s in sections]


@router.get("/sections", response_model=List[TDSSectionResponse])
async def list_tds_sections(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all TDS sections for the company."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    sections = tds_service.get_tds_sections(company)
    
    return [_build_section_response(s) for s in sections]


@router.post("/sections", response_model=TDSSectionResponse, status_code=status.HTTP_201_CREATED)
async def create_tds_section(
    company_id: str,
    data: TDSSectionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a custom TDS section."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    section = tds_service.create_tds_section(
        company=company,
        section_code=data.section_code,
        description=data.description,
        rate_individual=Decimal(str(data.rate_individual)),
        rate_company=Decimal(str(data.rate_company)),
        threshold_single=Decimal(str(data.threshold_single)),
        threshold_annual=Decimal(str(data.threshold_annual)),
        nature_of_payment=data.nature_of_payment,
    )
    
    return _build_section_response(section)


@router.get("/sections/{section_id}", response_model=TDSSectionResponse)
async def get_tds_section(
    company_id: str,
    section_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a TDS section by ID."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    section = tds_service.get_tds_section(section_id, company)
    
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TDS section not found"
        )
    
    return _build_section_response(section)


# ==================== TDS CALCULATION ENDPOINTS ====================

@router.post("/calculate", response_model=TDSCalculationResponse)
async def calculate_tds(
    company_id: str,
    data: TDSCalculateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Calculate TDS for a payment."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Get vendor
    customer_service = CustomerService(db)
    vendor = customer_service.get_customer(data.vendor_id, company)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    tds_service = TDSService(db)
    result = tds_service.calculate_tds(
        company=company,
        vendor=vendor,
        section_id=data.section_id,
        amount=Decimal(str(data.amount)),
        check_threshold=data.check_threshold,
    )
    
    return TDSCalculationResponse(**result)


# ==================== TDS ENTRY ENDPOINTS ====================

@router.post("/entries", response_model=TDSEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_tds_entry(
    company_id: str,
    data: TDSEntryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a TDS entry manually."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    
    try:
        entry = tds_service.create_tds_entry(
            company=company,
            vendor_id=data.vendor_id,
            section_id=data.section_id,
            gross_amount=Decimal(str(data.gross_amount)),
            deduction_date=data.deduction_date,
            purchase_invoice_id=data.purchase_invoice_id,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return _build_entry_response(entry)


@router.get("/entries", response_model=List[TDSEntryResponse])
async def list_tds_entries(
    company_id: str,
    vendor_id: Optional[str] = None,
    section_code: Optional[str] = None,
    financial_year: Optional[str] = None,
    quarter: Optional[str] = None,
    is_deposited: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List TDS entries with filters."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    entries = tds_service.get_tds_entries(
        company=company,
        vendor_id=vendor_id,
        section_code=section_code,
        financial_year=financial_year,
        quarter=quarter,
        is_deposited=is_deposited,
    )
    
    return [_build_entry_response(e) for e in entries]


# ==================== TDS DEPOSIT ENDPOINTS ====================

@router.post("/deposit", response_model=List[TDSEntryResponse])
async def record_tds_deposit(
    company_id: str,
    data: TDSDepositRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Record TDS deposit (payment to government)."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    
    try:
        entries = tds_service.record_tds_deposit(
            company=company,
            entry_ids=data.entry_ids,
            challan_number=data.challan_number,
            challan_date=data.challan_date,
            bsr_code=data.bsr_code,
            deposit_date=data.deposit_date,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return [_build_entry_response(e) for e in entries]


@router.get("/pending-deposits", response_model=List[PendingDepositResponse])
async def get_pending_deposits(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all pending TDS deposits grouped by quarter."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    pending = tds_service.get_pending_tds_deposits(company)
    
    return [PendingDepositResponse(**p) for p in pending]


# ==================== TDS REPORTS ====================

@router.get("/summary", response_model=TDSSummaryResponse)
async def get_tds_summary(
    company_id: str,
    financial_year: str,
    quarter: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get TDS summary for returns filing."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    summary = tds_service.get_tds_summary(company, financial_year, quarter)
    
    return TDSSummaryResponse(**summary)


@router.get("/vendor-statement/{vendor_id}", response_model=VendorTDSStatementResponse)
async def get_vendor_tds_statement(
    company_id: str,
    vendor_id: str,
    financial_year: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get TDS statement for a vendor (Form 16A data)."""
    company = get_company_or_404(company_id, current_user, db)
    
    tds_service = TDSService(db)
    
    try:
        statement = tds_service.get_vendor_tds_statement(company, vendor_id, financial_year)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    
    return VendorTDSStatementResponse(**statement)


# ==================== HELPER FUNCTIONS ====================

def _build_section_response(section) -> TDSSectionResponse:
    """Build TDS section response."""
    return TDSSectionResponse(
        id=section.id,
        section_code=section.section_code,
        description=section.description,
        rate_individual=float(section.rate_individual),
        rate_company=float(section.rate_company),
        rate_no_pan=float(section.rate_no_pan),
        threshold_single=float(section.threshold_single),
        threshold_annual=float(section.threshold_annual),
        nature_of_payment=section.nature_of_payment,
        is_active=section.is_active,
    )


def _build_entry_response(entry) -> TDSEntryResponse:
    """Build TDS entry response."""
    return TDSEntryResponse(
        id=entry.id,
        vendor_id=entry.vendor_id,
        vendor_name=entry.vendor_name,
        vendor_pan=entry.vendor_pan,
        section_code=entry.section_code,
        gross_amount=float(entry.gross_amount),
        tds_rate=float(entry.tds_rate),
        tds_amount=float(entry.tds_amount),
        deduction_date=entry.deduction_date,
        financial_year=entry.financial_year,
        quarter=entry.quarter,
        is_deposited=entry.is_deposited,
        challan_number=entry.challan_number,
        challan_date=entry.challan_date,
        deposit_date=entry.deposit_date,
    )
