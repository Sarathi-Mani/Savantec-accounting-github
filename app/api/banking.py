"""
Banking API - Cheques, PDC, Bank Reconciliation, Recurring Transactions
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import User, Company, ChequeType, ChequeStatus
from app.auth.dependencies import get_current_active_user
from app.services.cheque_service import ChequeService
from app.services.pdc_service import PDCService
from app.services.bank_reconciliation_service import BankReconciliationService
from app.services.recurring_transaction_service import RecurringTransactionService
from app.services.cash_flow_forecast_service import CashFlowForecastService
from app.services.bank_statement_import_service import BankStatementImportService

router = APIRouter(tags=["Banking"])


def get_company_or_404(company_id: str, user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ==================== CHEQUE BOOK SCHEMAS ====================

class ChequeBookCreate(BaseModel):
    bank_account_id: str
    cheque_series_from: str
    cheque_series_to: str
    book_name: Optional[str] = None
    received_date: Optional[datetime] = None


class ChequeIssue(BaseModel):
    cheque_book_id: str
    cheque_date: datetime
    amount: float
    payee_name: str
    party_id: Optional[str] = None
    party_type: Optional[str] = None
    invoice_id: Optional[str] = None
    invoice_type: Optional[str] = None
    notes: Optional[str] = None


class ChequeReceive(BaseModel):
    cheque_number: str
    cheque_date: datetime
    amount: float
    drawer_name: str
    drawn_on_bank: Optional[str] = None
    drawn_on_branch: Optional[str] = None
    party_id: Optional[str] = None
    party_type: Optional[str] = None
    notes: Optional[str] = None


# ==================== CHEQUE ENDPOINTS ====================

@router.post("/companies/{company_id}/cheque-books")
async def create_cheque_book(
    company_id: str,
    data: ChequeBookCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    book = service.create_cheque_book(
        company_id=company_id,
        bank_account_id=data.bank_account_id,
        cheque_series_from=data.cheque_series_from,
        cheque_series_to=data.cheque_series_to,
        book_name=data.book_name,
        received_date=data.received_date,
    )
    
    return {"id": book.id, "message": "Cheque book created"}


@router.get("/companies/{company_id}/cheque-books")
async def list_cheque_books(
    company_id: str,
    bank_account_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    books = service.list_cheque_books(company_id, bank_account_id)
    
    return [{
        "id": b.id,
        "bank_account_id": b.bank_account_id,
        "book_name": b.book_name,
        "cheque_series_from": b.cheque_series_from,
        "cheque_series_to": b.cheque_series_to,
        "current_cheque": b.current_cheque,
        "total_leaves": b.total_leaves,
        "used_leaves": b.used_leaves,
        "is_active": b.is_active,
    } for b in books]


@router.post("/companies/{company_id}/cheques/issue")
async def issue_cheque(
    company_id: str,
    data: ChequeIssue,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.issue_cheque(
        company_id=company_id,
        cheque_book_id=data.cheque_book_id,
        cheque_date=data.cheque_date,
        amount=Decimal(str(data.amount)),
        payee_name=data.payee_name,
        party_id=data.party_id,
        party_type=data.party_type,
        invoice_id=data.invoice_id,
        invoice_type=data.invoice_type,
        notes=data.notes,
    )
    
    return {"id": cheque.id, "cheque_number": cheque.cheque_number}


@router.post("/companies/{company_id}/cheques/receive")
async def receive_cheque(
    company_id: str,
    data: ChequeReceive,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.receive_cheque(
        company_id=company_id,
        cheque_number=data.cheque_number,
        cheque_date=data.cheque_date,
        amount=Decimal(str(data.amount)),
        drawer_name=data.drawer_name,
        drawn_on_bank=data.drawn_on_bank,
        drawn_on_branch=data.drawn_on_branch,
        party_id=data.party_id,
        party_type=data.party_type,
        notes=data.notes,
    )
    
    return {"id": cheque.id}


@router.get("/companies/{company_id}/cheques")
async def list_cheques(
    company_id: str,
    cheque_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    ct = ChequeType(cheque_type) if cheque_type else None
    st = ChequeStatus(status) if status else None
    
    cheques = service.list_cheques(company_id, ct, st)
    
    return [{
        "id": c.id,
        "cheque_type": c.cheque_type.value,
        "cheque_number": c.cheque_number,
        "cheque_date": c.cheque_date.isoformat() if c.cheque_date else None,
        "amount": float(c.amount),
        "payee_name": c.payee_name,
        "drawer_name": c.drawer_name,
        "drawn_on_bank": c.drawn_on_bank,
        "drawn_on_branch": c.drawn_on_branch,
        "party_id": c.party_id,
        "party_type": c.party_type,
        "status": c.status.value,
        "notes": c.notes,
        "deposit_date": c.deposit_date.isoformat() if c.deposit_date else None,
        "clearing_date": c.clearing_date.isoformat() if c.clearing_date else None,
        "bounce_date": c.bounce_date.isoformat() if c.bounce_date else None,
        "bounce_reason": c.bounce_reason,
        "bounce_charges": float(c.bounce_charges) if c.bounce_charges else None,
        "transaction_id": c.transaction_id,
    } for c in cheques]


@router.post("/companies/{company_id}/cheques/{cheque_id}/deposit")
async def deposit_cheque(
    company_id: str,
    cheque_id: str,
    bank_account_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.deposit_cheque(cheque_id, bank_account_id)
    return {"status": cheque.status.value}


@router.post("/companies/{company_id}/cheques/{cheque_id}/clear")
async def clear_cheque(
    company_id: str,
    cheque_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.clear_cheque(cheque_id)
    return {"status": cheque.status.value}


@router.post("/companies/{company_id}/cheques/{cheque_id}/bounce")
async def bounce_cheque(
    company_id: str,
    cheque_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark a cheque as bounced."""
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.bounce_cheque(cheque_id, reason)
    return {"status": cheque.status.value, "message": "Cheque marked as bounced"}


@router.post("/companies/{company_id}/cheques/{cheque_id}/cancel")
async def cancel_cheque(
    company_id: str,
    cheque_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a cheque."""
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.cancel_cheque(cheque_id, reason)
    return {"status": cheque.status.value, "message": "Cheque cancelled"}


@router.get("/companies/{company_id}/cheques/{cheque_id}")
async def get_cheque(
    company_id: str,
    cheque_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a single cheque by ID."""
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.get_cheque(cheque_id)
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque not found")
    
    return {
        "id": cheque.id,
        "cheque_type": cheque.cheque_type.value,
        "cheque_number": cheque.cheque_number,
        "cheque_date": cheque.cheque_date.isoformat() if cheque.cheque_date else None,
        "amount": float(cheque.amount),
        "payee_name": cheque.payee_name,
        "drawer_name": cheque.drawer_name,
        "drawn_on_bank": cheque.drawn_on_bank,
        "drawn_on_branch": cheque.drawn_on_branch,
        "status": cheque.status.value,
        "party_id": cheque.party_id,
        "party_type": cheque.party_type,
        "invoice_id": cheque.invoice_id,
        "invoice_type": cheque.invoice_type,
        "notes": cheque.notes,
        "deposit_date": cheque.deposit_date.isoformat() if cheque.deposit_date else None,
        "clearing_date": cheque.clearing_date.isoformat() if cheque.clearing_date else None,
        "bounce_date": cheque.bounce_date.isoformat() if cheque.bounce_date else None,
        "bounce_reason": cheque.bounce_reason,
        "bounce_charges": float(cheque.bounce_charges) if cheque.bounce_charges else None,
        "transaction_id": cheque.transaction_id,
    }


class ChequeUpdate(BaseModel):
    cheque_date: Optional[datetime] = None
    amount: Optional[float] = None
    payee_name: Optional[str] = None
    drawer_name: Optional[str] = None
    drawn_on_bank: Optional[str] = None
    drawn_on_branch: Optional[str] = None
    party_id: Optional[str] = None
    party_type: Optional[str] = None
    notes: Optional[str] = None


@router.put("/companies/{company_id}/cheques/{cheque_id}")
async def update_cheque(
    company_id: str,
    cheque_id: str,
    data: ChequeUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update cheque details (only for pending/received cheques)."""
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.get_cheque(cheque_id)
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque not found")
    
    # Only allow updates for cheques that haven't been processed
    if cheque.status in [ChequeStatus.CLEARED, ChequeStatus.DEPOSITED]:
        raise HTTPException(status_code=400, detail="Cannot update cheque after it has been deposited or cleared")
    
    # Update fields directly on the cheque object
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "amount" and value is not None:
            setattr(cheque, key, Decimal(str(value)))
        elif value is not None:
            setattr(cheque, key, value)
    
    db.commit()
    db.refresh(cheque)
    
    return {"id": cheque.id, "message": "Cheque updated successfully"}


@router.delete("/companies/{company_id}/cheques/{cheque_id}")
async def delete_cheque(
    company_id: str,
    cheque_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a cheque (only for cheques not yet cleared/deposited)."""
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    cheque = service.get_cheque(cheque_id)
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque not found")
    
    # Cannot delete cheques that have been deposited or cleared
    if cheque.status in [ChequeStatus.CLEARED, ChequeStatus.DEPOSITED]:
        raise HTTPException(status_code=400, detail="Cannot delete cheque that has been deposited or cleared")
    
    service.delete_cheque(cheque_id)
    return {"message": "Cheque deleted successfully"}


@router.get("/companies/{company_id}/cheques/summary")
async def cheque_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = ChequeService(db)
    
    return service.get_cheque_summary(company_id)


# ==================== PDC ENDPOINTS ====================

class PDCCreate(BaseModel):
    pdc_type: str
    cheque_number: str
    cheque_date: datetime
    amount: float
    bank_name: str
    branch_name: Optional[str] = None
    party_id: Optional[str] = None
    party_type: Optional[str] = None
    party_name: Optional[str] = None
    notes: Optional[str] = None


@router.post("/companies/{company_id}/pdc")
async def create_pdc(
    company_id: str,
    data: PDCCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = PDCService(db)
    
    pdc = service.create_pdc(
        company_id=company_id,
        pdc_type=data.pdc_type,
        cheque_number=data.cheque_number,
        cheque_date=data.cheque_date,
        amount=Decimal(str(data.amount)),
        bank_name=data.bank_name,
        branch_name=data.branch_name,
        party_id=data.party_id,
        party_type=data.party_type,
        party_name=data.party_name,
        notes=data.notes,
    )
    
    return {"id": pdc.id}


@router.get("/companies/{company_id}/pdc")
async def list_pdc(
    company_id: str,
    pdc_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = PDCService(db)
    
    pdcs = service.list_pdcs(company_id, pdc_type, status)
    
    return [{
        "id": p.id,
        "pdc_type": p.pdc_type,
        "cheque_number": p.cheque_number,
        "cheque_date": p.cheque_date.isoformat() if p.cheque_date else None,
        "amount": float(p.amount),
        "bank_name": p.bank_name,
        "party_name": p.party_name,
        "status": p.status,
    } for p in pdcs]


@router.get("/companies/{company_id}/pdc/maturing")
async def maturing_pdc(
    company_id: str,
    days: int = 7,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = PDCService(db)
    
    pdcs = service.get_maturing_pdcs(company_id, days)
    
    return [{
        "id": p.id,
        "cheque_number": p.cheque_number,
        "cheque_date": p.cheque_date.isoformat() if p.cheque_date else None,
        "amount": float(p.amount),
        "party_name": p.party_name,
    } for p in pdcs]


@router.get("/companies/{company_id}/pdc/summary")
async def pdc_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = PDCService(db)
    
    return service.get_pdc_summary(company_id)


# ==================== BANK RECONCILIATION (Tally-Style) ====================

class ReconciliationCreate(BaseModel):
    bank_account_id: str
    period_from: datetime
    period_to: datetime
    opening_balance_bank: float
    closing_balance_bank: Optional[float] = None


class SetBankDateRequest(BaseModel):
    bank_date: str  # ISO date string


class BulkBankDateRequest(BaseModel):
    entries: List[dict]  # [{"entry_id": "xxx", "bank_date": "2024-01-15"}, ...]


# ==================== TALLY-STYLE BRS ENDPOINTS ====================

@router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/unreconciled")
async def get_unreconciled_entries(
    company_id: str,
    bank_account_id: str,
    as_of_date: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all unreconciled bank entries (Tally's main BRS view).
    Shows entries where bank_date has not been set.
    """
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    date_obj = None
    if as_of_date:
        date_obj = datetime.fromisoformat(as_of_date).date()
    
    return service.get_unreconciled_entries(company_id, bank_account_id, date_obj)


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/entries/{entry_id}/set-bank-date")
async def set_entry_bank_date(
    company_id: str,
    bank_account_id: str,
    entry_id: str,
    data: SetBankDateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Set bank date for an entry (Tally's core reconciliation action).
    When user sees entry in bank statement, they enter the bank date.
    """
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    bank_date = datetime.fromisoformat(data.bank_date).date()
    return service.set_bank_date(entry_id, bank_date)


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/entries/{entry_id}/clear-bank-date")
async def clear_entry_bank_date(
    company_id: str,
    bank_account_id: str,
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Un-reconcile an entry by clearing its bank date."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    return service.clear_bank_date(entry_id)


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/bulk-reconcile")
async def bulk_set_bank_dates(
    company_id: str,
    bank_account_id: str,
    data: BulkBankDateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Bulk set bank dates for multiple entries."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    return service.bulk_set_bank_dates(data.entries)


@router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/brs")
async def get_brs_report(
    company_id: str,
    bank_account_id: str,
    as_of_date: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate Bank Reconciliation Statement (Tally format).
    
    Shows:
    - Balance as per Books
    - Add: Cheques issued but not presented
    - Less: Cheques deposited but not credited
    - = Balance as per Bank Statement
    """
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    date_obj = datetime.fromisoformat(as_of_date).date()
    return service.generate_brs(company_id, bank_account_id, date_obj)


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/auto-reconcile")
async def auto_reconcile_entries(
    company_id: str,
    bank_account_id: str,
    as_of_date: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Auto-reconcile: Set bank_date = transaction_date for all unreconciled entries.
    This assumes all entries have cleared in the bank by their transaction date.
    """
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    date_obj = None
    if as_of_date:
        date_obj = datetime.fromisoformat(as_of_date).date()
    
    return service.auto_reconcile(company_id, bank_account_id, date_obj)


# ==================== TALLY-STYLE BANK STATEMENT IMPORT ====================

class ImportStatementRequest(BaseModel):
    """Request to import bank statement from CSV content."""
    content: str
    file_name: Optional[str] = "import.csv"
    bank_name: Optional[str] = None
    auto_match: bool = True
    column_mapping: Optional[dict] = None  # Custom column mapping


class CreateTransactionFromEntryRequest(BaseModel):
    """Request to create transaction from bank statement entry."""
    category_account_id: str
    description: Optional[str] = None


class ManualMatchRequest(BaseModel):
    """Request to manually match bank and book entries."""
    book_entry_id: str


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/import-statement")
async def import_bank_statement(
    company_id: str,
    bank_account_id: str,
    data: ImportStatementRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Import bank statement to BankStatementEntry table (Tally-style).
    
    This is the primary import endpoint. It:
    1. Parses the CSV content
    2. Stores entries in BankStatementEntry (NOT as transactions)
    3. Auto-matches with existing book entries if enabled
    4. Returns summary of imported/matched/pending
    """
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    try:
        result = service.import_statement(
            company_id=company_id,
            bank_account_id=bank_account_id,
            content=data.content,
            file_name=data.file_name or "import.csv",
            bank_name=data.bank_name,
            column_mapping=data.column_mapping,
            auto_match=data.auto_match,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-entries")
async def get_statement_entries(
    company_id: str,
    bank_account_id: str,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get bank statement entries with optional filters.
    
    Status can be: pending, matched, unmatched, disputed
    """
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    from_dt = datetime.fromisoformat(from_date).date() if from_date else None
    to_dt = datetime.fromisoformat(to_date).date() if to_date else None
    
    return service.get_statement_entries(
        company_id=company_id,
        bank_account_id=bank_account_id,
        status=status,
        from_date=from_dt,
        to_date=to_dt,
    )


@router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/reconciliation-summary")
async def get_reconciliation_summary(
    company_id: str,
    bank_account_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get summary of reconciliation status for a bank account."""
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    return service.get_reconciliation_summary(company_id, bank_account_id)


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-entries/{entry_id}/create-transaction")
async def create_transaction_from_entry(
    company_id: str,
    bank_account_id: str,
    entry_id: str,
    data: CreateTransactionFromEntryRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a transaction from an unmatched bank statement entry.
    
    This is called when user categorizes an unmatched bank entry.
    The category_account_id determines what type of transaction:
    - Revenue account = income received
    - Expense account = payment made
    """
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    try:
        return service.create_transaction_from_entry(
            company_id=company_id,
            bank_account_id=bank_account_id,
            entry_id=entry_id,
            category_account_id=data.category_account_id,
            description=data.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-entries/{entry_id}/mark-as-charges")
async def mark_entry_as_charges(
    company_id: str,
    bank_account_id: str,
    entry_id: str,
    charge_type: str = "bank_charges",  # bank_charges, interest_received, interest_paid
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mark a bank statement entry as bank charges or interest.
    
    This is a convenience endpoint that:
    1. Creates a transaction with the appropriate account
    2. Marks the entry as matched
    
    charge_type can be: bank_charges, interest_received, interest_paid
    """
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    try:
        return service.mark_as_bank_charges(
            company_id=company_id,
            bank_account_id=bank_account_id,
            entry_id=entry_id,
            charge_type=charge_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-entries/{entry_id}/manual-match")
async def manual_match_entries(
    company_id: str,
    bank_account_id: str,
    entry_id: str,
    data: ManualMatchRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Manually match a bank statement entry with a book entry.
    
    Used when auto-match fails but user knows they should be matched.
    """
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    try:
        return service.manual_match(
            bank_entry_id=entry_id,
            book_entry_id=data.book_entry_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-entries/{entry_id}/unmatch")
async def unmatch_statement_entry(
    company_id: str,
    bank_account_id: str,
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unmatch a previously matched bank statement entry."""
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    try:
        return service.unmatch_entry(entry_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-entries/{entry_id}")
async def delete_statement_entry(
    company_id: str,
    bank_account_id: str,
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a bank statement entry (only if not matched)."""
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    try:
        return service.delete_entry(entry_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/auto-match-statement")
async def auto_match_statement_entries(
    company_id: str,
    bank_account_id: str,
    tolerance_days: int = 3,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Auto-match bank statement entries with book entries.
    
    Returns detailed results including matched pairs and unmatched entries.
    """
    get_company_or_404(company_id, current_user, db)
    service = BankStatementImportService(db)
    
    return service.auto_match_entries(
        company_id=company_id,
        bank_account_id=bank_account_id,
        tolerance_days=tolerance_days,
    )


# ==================== MONTHLY BANK RECONCILIATION ====================

class MonthlyReconciliationUpdate(BaseModel):
    opening_balance_bank: Optional[float] = None
    closing_balance_bank: Optional[float] = None
    cheques_issued_not_cleared: Optional[float] = None
    cheques_deposited_not_credited: Optional[float] = None
    bank_charges_not_booked: Optional[float] = None
    interest_not_booked: Optional[float] = None
    other_differences: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None


@router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/monthly-reconciliation/{year}/{month}")
async def get_monthly_reconciliation(
    company_id: str,
    bank_account_id: str,
    year: int,
    month: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get monthly bank reconciliation.
    
    Shows:
    - Opening balance (from bank statement)
    - Your book entries for the month
    - Closing balance (from bank statement)
    - Difference to investigate
    """
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    return service.get_monthly_reconciliation(company_id, bank_account_id, year, month)


@router.put("/companies/{company_id}/bank-accounts/{bank_account_id}/monthly-reconciliation/{recon_id}")
async def update_monthly_reconciliation(
    company_id: str,
    bank_account_id: str,
    recon_id: str,
    data: MonthlyReconciliationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update monthly reconciliation with bank statement balances."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    return service.update_monthly_reconciliation(recon_id, data.model_dump(exclude_unset=True))


@router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/monthly-reconciliation/{recon_id}/close")
async def close_monthly_reconciliation(
    company_id: str,
    bank_account_id: str,
    recon_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Close/finalize a monthly reconciliation."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    return service.close_monthly_reconciliation(recon_id, current_user.id)


# ==================== LEGACY SESSION-BASED ENDPOINTS ====================

@router.get("/companies/{company_id}/bank-reconciliations")
async def list_reconciliations(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all bank reconciliations for the company."""
    get_company_or_404(company_id, current_user, db)
    
    from app.database.models import BankReconciliation
    
    reconciliations = db.query(BankReconciliation).filter(
        BankReconciliation.company_id == company_id
    ).order_by(BankReconciliation.created_at.desc()).all()
    
    return [
        {
            "id": r.id,
            "bank_account_id": r.bank_account_id,
            "period_from": r.period_from.isoformat() if r.period_from else None,
            "period_to": r.period_to.isoformat() if r.period_to else None,
            "opening_balance_book": float(r.opening_balance_book or 0),
            "closing_balance_book": float(r.closing_balance_book or 0),
            "opening_balance_bank": float(r.opening_balance_bank or 0),
            "closing_balance_bank": float(r.closing_balance_bank or 0),
            "total_entries": r.total_entries or 0,
            "matched_entries": r.matched_entries or 0,
            "unmatched_entries": r.unmatched_entries or 0,
            "status": r.status,
            "reconciliation_date": r.reconciliation_date.isoformat() if r.reconciliation_date else None,
        }
        for r in reconciliations
    ]


@router.post("/companies/{company_id}/bank-reconciliation")
async def create_reconciliation(
    company_id: str,
    data: ReconciliationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new bank reconciliation session."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    recon = service.create_reconciliation(
        company_id=company_id,
        bank_account_id=data.bank_account_id,
        period_from=data.period_from,
        period_to=data.period_to,
        opening_balance_bank=Decimal(str(data.opening_balance_bank)),
        closing_balance_bank=Decimal(str(data.closing_balance_bank)) if data.closing_balance_bank else None,
    )
    
    return {
        "id": recon.id,
        "bank_account_id": recon.bank_account_id,
        "period_from": recon.period_from.isoformat() if recon.period_from else None,
        "period_to": recon.period_to.isoformat() if recon.period_to else None,
        "opening_balance_book": float(recon.opening_balance_book or 0),
        "closing_balance_book": float(recon.closing_balance_book or 0),
        "opening_balance_bank": float(recon.opening_balance_bank or 0),
        "closing_balance_bank": float(recon.closing_balance_bank or 0),
        "total_entries": recon.total_entries or 0,
        "matched_entries": recon.matched_entries or 0,
        "unmatched_entries": recon.unmatched_entries or 0,
        "status": recon.status,
    }


@router.get("/companies/{company_id}/bank-reconciliation/{recon_id}/entries")
async def get_reconciliation_entries(
    company_id: str,
    recon_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all entries for a reconciliation session."""
    get_company_or_404(company_id, current_user, db)
    
    from app.database.models import ReconciliationEntry
    
    entries = db.query(ReconciliationEntry).filter(
        ReconciliationEntry.reconciliation_id == recon_id
    ).all()
    
    return [
        {
            "id": e.id,
            "book_date": e.book_date.isoformat() if e.book_date else None,
            "book_amount": float(e.book_amount) if e.book_amount else None,
            "book_reference": e.book_reference,
            "bank_date": e.bank_date.isoformat() if e.bank_date else None,
            "bank_amount": float(e.bank_amount) if e.bank_amount else None,
            "bank_reference": e.bank_reference,
            "bank_description": e.bank_description,
            "is_matched": e.is_matched,
            "match_type": e.match_type,
            "difference": float(e.difference) if e.difference else None,
            "transaction_entry_id": e.transaction_entry_id,
        }
        for e in entries
    ]


# Legacy import-statement endpoint removed - use Tally-style reconciliation instead
# Mark bank dates via /bank-accounts/{id}/entries/{id}/set-bank-date


@router.post("/companies/{company_id}/bank-reconciliation/{recon_id}/auto-match")
async def auto_match_reconciliation(
    company_id: str,
    recon_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Auto-match book entries with bank entries."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    result = service.auto_match(recon_id)
    return {"matched_count": result.get("auto_matched", 0), **result}


# Legacy manual-match endpoint removed - use Tally-style reconciliation instead
# Mark bank dates via /bank-accounts/{id}/entries/{id}/set-bank-date


@router.post("/companies/{company_id}/bank-reconciliation/{recon_id}/reconcile-entry/{entry_id}")
async def reconcile_entry(
    company_id: str,
    recon_id: str,
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark an entry as reconciled without bank match."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    entry = service.mark_reconciled(entry_id)
    
    return {
        "message": "Entry reconciled",
        "entry_id": entry.id,
    }


@router.post("/companies/{company_id}/bank-reconciliation/{recon_id}/finalize")
async def finalize_reconciliation(
    company_id: str,
    recon_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Finalize and complete a reconciliation session."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    recon = service.complete_reconciliation(recon_id, completed_by=current_user.id)
    
    return {
        "message": "Reconciliation completed",
        "id": recon.id,
        "status": recon.status,
    }


@router.get("/companies/{company_id}/bank-reconciliation/{recon_id}/report")
async def reconciliation_report(
    company_id: str,
    recon_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get bank reconciliation statement report."""
    get_company_or_404(company_id, current_user, db)
    service = BankReconciliationService(db)
    
    report = service.get_reconciliation_report(recon_id)
    
    # Transform to frontend-expected format
    if "reconciliation_statement" in report:
        stmt = report["reconciliation_statement"]
        return {
            "balance_as_per_books": report["balances"]["closing_book"],
            "add_items": [
                {"description": "Cheques deposited not yet cleared", "amount": stmt.get("add_cheques_deposited_not_cleared", 0)}
            ] if stmt.get("add_cheques_deposited_not_cleared", 0) > 0 else [],
            "less_items": [
                {"description": "Cheques issued not yet presented", "amount": stmt.get("less_cheques_issued_not_presented", 0)}
            ] if stmt.get("less_cheques_issued_not_presented", 0) > 0 else [],
            "balance_as_per_bank": report["balances"]["closing_bank"],
            "difference": report["balances"]["closing_book"] - report["balances"]["closing_bank"],
            "is_reconciled": abs(report["balances"]["closing_book"] - report["balances"]["closing_bank"]) < 0.01,
        }
    
    return report


# ==================== CASH FLOW FORECAST ====================

@router.get("/companies/{company_id}/cash-forecast")
async def cash_flow_forecast(
    company_id: str,
    days: int = 30,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = CashFlowForecastService(db)
    
    return service.generate_forecast(company_id, days)


@router.get("/companies/{company_id}/cash-forecast/weekly")
async def weekly_cash_forecast(
    company_id: str,
    weeks: int = 4,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    get_company_or_404(company_id, current_user, db)
    service = CashFlowForecastService(db)
    
    return service.get_weekly_summary(company_id, weeks)
