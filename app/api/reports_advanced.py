"""
Advanced Reports API - Ledger, Aging, Ratios, Day Book
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date
from io import BytesIO

from app.database.connection import get_db
from app.database.models import User, Company
from app.auth.dependencies import get_current_active_user
from app.services.ledger_report_service import LedgerReportService
from app.services.aging_report_service import AgingReportService
from app.services.ratio_analysis_service import RatioAnalysisService
from app.services.excel_service import ExcelService

router = APIRouter(tags=["Reports"])


def get_company_or_404(company_id: str, user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ==================== LEDGER ====================

@router.get("/companies/{company_id}/reports/ledger/{account_id}")
async def get_ledger(
    company_id: str,
    account_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get account ledger report."""
    get_company_or_404(company_id, current_user, db)
    service = LedgerReportService(db)
    
    # Parse date strings
    fd = None
    td = None
    if from_date:
        try:
            fd = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        except:
            try:
                fd = datetime.strptime(from_date, '%Y-%m-%d')
            except:
                pass
    
    if to_date:
        try:
            td = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
        except:
            try:
                td = datetime.strptime(to_date, '%Y-%m-%d')
            except:
                pass
    
    result = service.get_account_ledger(company_id, account_id, fd, td)
    
    # Ensure entries have the format expected by frontend
    if 'entries' in result:
        formatted_entries = []
        for entry in result['entries']:
            formatted_entries.append({
                'date': entry.get('date', ''),
                'voucher_number': entry.get('voucher_number', ''),
                'voucher_type': entry.get('voucher_type', ''),
                'particulars': entry.get('description', entry.get('particulars', '')),
                'debit': entry.get('debit', 0),
                'credit': entry.get('credit', 0),
                'balance': entry.get('balance', 0),
            })
        result['entries'] = formatted_entries
    
    return result


@router.get("/companies/{company_id}/reports/day-book")
async def get_day_book(
    company_id: str,
    date: str,
    voucher_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = LedgerReportService(db)
    
    report_date = datetime.fromisoformat(date)
    
    return service.get_day_book(company_id, report_date, voucher_type)


@router.get("/companies/{company_id}/reports/voucher-register")
async def get_voucher_register(
    company_id: str,
    from_date: str,
    to_date: str,
    voucher_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = LedgerReportService(db)
    
    fd = datetime.fromisoformat(from_date)
    td = datetime.fromisoformat(to_date)
    
    return service.get_voucher_register(company_id, fd, td, voucher_type)


@router.get("/companies/{company_id}/reports/cash-bank-book")
async def get_cash_bank_book(
    company_id: str,
    from_date: str,
    to_date: str,
    book_type: str = "cash",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = LedgerReportService(db)
    
    fd = datetime.fromisoformat(from_date)
    td = datetime.fromisoformat(to_date)
    
    return service.get_cash_bank_book(company_id, fd, td, book_type)


# ==================== AGING ====================

@router.get("/companies/{company_id}/reports/aging/receivables")
async def get_receivables_aging(
    company_id: str,
    as_of_date: Optional[str] = None,
    customer_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = AgingReportService(db)
    
    aod = datetime.fromisoformat(as_of_date) if as_of_date else None
    
    return service.get_receivables_aging(company_id, aod, customer_id)


@router.get("/companies/{company_id}/reports/aging/payables")
async def get_payables_aging(
    company_id: str,
    as_of_date: Optional[str] = None,
    vendor_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = AgingReportService(db)
    
    aod = datetime.fromisoformat(as_of_date) if as_of_date else None
    
    return service.get_payables_aging(company_id, aod, vendor_id)


# ==================== RATIOS ====================

@router.get("/companies/{company_id}/reports/ratios")
async def get_ratio_analysis(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = RatioAnalysisService(db)
    
    return service.get_all_ratios(company_id)


# ==================== EXCEL EXPORT ====================

@router.get("/companies/{company_id}/reports/export/ledger/{account_id}")
async def export_ledger_excel(
    company_id: str,
    account_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    
    ledger_service = LedgerReportService(db)
    excel_service = ExcelService(db)
    
    fd = datetime.fromisoformat(from_date) if from_date else None
    td = datetime.fromisoformat(to_date) if to_date else None
    
    data = ledger_service.get_account_ledger(company_id, account_id, fd, td)
    excel_data = excel_service.export_report(data, 'ledger')
    
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=ledger_{account_id}.xlsx"}
    )


@router.get("/companies/{company_id}/reports/export/aging")
async def export_aging_excel(
    company_id: str,
    report_type: str = "receivables",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    
    aging_service = AgingReportService(db)
    excel_service = ExcelService(db)
    
    if report_type == "receivables":
        data = aging_service.get_receivables_aging(company_id)
    else:
        data = aging_service.get_payables_aging(company_id)
    
    excel_data = excel_service.export_report(data, 'aging')
    
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={report_type}_aging.xlsx"}
    )
