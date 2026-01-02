"""Accounting API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from app.database.connection import get_db
from app.database.models import User, Company, Account, Transaction, BankImport, AccountMapping, PayrollAccountConfig, AccountMappingType
from app.auth.dependencies import get_current_user, get_current_active_user
from app.services.accounting_service import AccountingService
from app.services.bank_import_service import BankImportService
from app.services.report_service import ReportService
from app.schemas.accounting import (
    AccountCreate, AccountUpdate, AccountResponse, AccountWithChildren, AccountLedgerResponse,
    TransactionCreate, TransactionResponse, TransactionListResponse, TransactionEntryResponse,
    BankImportResponse, BankImportDetailResponse, BankImportProcessRequest,
    TrialBalanceResponse, ProfitLossResponse, BalanceSheetResponse, CashFlowResponse,
    AccountType, TransactionStatus, ReferenceType, BankImportRowStatus
)


router = APIRouter(prefix="/companies/{company_id}", tags=["Accounting"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    return company


# ============== Account Endpoints ==============

@router.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(
    company_id: str,
    account_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all accounts for a company with calculated balances."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    # Initialize chart of accounts if needed
    service.initialize_chart_of_accounts(company)
    
    acc_type = None
    if account_type:
        try:
            from app.database.models import AccountType as DBAccountType
            acc_type = DBAccountType(account_type)
        except ValueError:
            pass
    
    accounts = service.get_accounts(company, acc_type)
    
    # Get balances for all accounts efficiently
    account_ids = [acc.id for acc in accounts]
    balances = service.get_multiple_account_balances(account_ids)
    
    # Build response with calculated balances
    result = []
    for acc in accounts:
        result.append(AccountResponse(
            id=acc.id,
            company_id=acc.company_id,
            code=acc.code,
            name=acc.name,
            description=acc.description,
            account_type=AccountType(acc.account_type.value),
            parent_id=acc.parent_id,
            current_balance=balances.get(acc.id, 0),
            is_system=acc.is_system,
            is_active=acc.is_active,
            bank_account_id=acc.bank_account_id,
            created_at=acc.created_at,
            updated_at=acc.updated_at,
        ))
    return result


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    company_id: str,
    data: AccountCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new account."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    try:
        account = service.create_account(company, data)
        balance = service.get_account_balance(account.id)
        return AccountResponse(
            id=account.id,
            company_id=account.company_id,
            code=account.code,
            name=account.name,
            description=account.description,
            account_type=AccountType(account.account_type.value),
            parent_id=account.parent_id,
            current_balance=balance,
            is_system=account.is_system,
            is_active=account.is_active,
            bank_account_id=account.bank_account_id,
            created_at=account.created_at,
            updated_at=account.updated_at,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(
    company_id: str,
    account_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get an account by ID with calculated balance."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    account = service.get_account(account_id, company)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    balance = service.get_account_balance(account.id)
    return AccountResponse(
        id=account.id,
        company_id=account.company_id,
        code=account.code,
        name=account.name,
        description=account.description,
        account_type=AccountType(account.account_type.value),
        parent_id=account.parent_id,
        current_balance=balance,
        is_system=account.is_system,
        is_active=account.is_active,
        bank_account_id=account.bank_account_id,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


@router.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    company_id: str,
    account_id: str,
    data: AccountUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an account."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    account = service.get_account(account_id, company)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    try:
        updated = service.update_account(account, data)
        balance = service.get_account_balance(updated.id)
        return AccountResponse(
            id=updated.id,
            company_id=updated.company_id,
            code=updated.code,
            name=updated.name,
            description=updated.description,
            account_type=AccountType(updated.account_type.value),
            parent_id=updated.parent_id,
            current_balance=balance,
            is_system=updated.is_system,
            is_active=updated.is_active,
            bank_account_id=updated.bank_account_id,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/accounts/{account_id}")
async def delete_account(
    company_id: str,
    account_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an account."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    account = service.get_account(account_id, company)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    try:
        service.delete_account(account)
        return {"message": "Account deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/accounts/{account_id}/opening-balance")
async def set_opening_balance(
    company_id: str,
    account_id: str,
    amount: float,
    balance_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Set opening balance for an account by creating an opening balance transaction."""
    from decimal import Decimal
    
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    account = service.get_account(account_id, company)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    try:
        transaction = service.create_opening_balance_transaction(
            company=company,
            account_id=account_id,
            amount=Decimal(str(amount)),
            balance_date=balance_date,
        )
        return {
            "message": "Opening balance set successfully",
            "transaction_id": transaction.id,
            "new_balance": float(service.get_account_balance(account_id)),
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/accounts/{account_id}/ledger")
async def get_account_ledger(
    company_id: str,
    account_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get account ledger with transaction history."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    account = service.get_account(account_id, company)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    from_dt = datetime.combine(from_date, datetime.min.time()) if from_date else None
    to_dt = datetime.combine(to_date, datetime.max.time()) if to_date else None
    
    ledger = service.get_account_ledger(account, from_dt, to_dt)
    
    return {
        "account": AccountResponse.model_validate(ledger["account"]),
        "entries": ledger["entries"],
        "opening_balance": ledger["opening_balance"],
        "closing_balance": ledger["closing_balance"],
        "total_debit": ledger["total_debit"],
        "total_credit": ledger["total_credit"],
    }


# ============== Transaction Endpoints ==============

@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    limit: Optional[int] = Query(None, ge=1, le=1000),
    account_id: Optional[str] = None,
    reference_type: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    status: Optional[str] = None,
    is_reconciled: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List transactions with filters."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    ref_type = None
    if reference_type:
        try:
            from app.database.models import ReferenceType as DBRefType
            ref_type = DBRefType(reference_type)
        except ValueError:
            pass
    
    txn_status = None
    if status:
        try:
            from app.database.models import TransactionStatus as DBTxnStatus
            txn_status = DBTxnStatus(status)
        except ValueError:
            pass
    
    from_dt = datetime.combine(from_date, datetime.min.time()) if from_date else None
    to_dt = datetime.combine(to_date, datetime.max.time()) if to_date else None
    
    transactions, total = service.get_transactions(
        company,
        page=page,
        page_size=page_size,
        account_id=account_id,
        reference_type=ref_type,
        from_date=from_dt,
        to_date=to_dt,
        status=txn_status,
        is_reconciled=is_reconciled,
        limit=limit,
    )
    
    # Build response with entries
    txn_responses = []
    for txn in transactions:
        txn_dict = {
            "id": txn.id,
            "company_id": txn.company_id,
            "transaction_number": txn.transaction_number,
            "transaction_date": txn.transaction_date,
            "description": txn.description,
            "reference_type": txn.reference_type.value,
            "reference_id": txn.reference_id,
            "status": txn.status.value,
            "is_reconciled": txn.is_reconciled,
            "reconciled_at": txn.reconciled_at,
            "total_debit": txn.total_debit,
            "total_credit": txn.total_credit,
            "reversed_by_id": txn.reversed_by_id,
            "reverses_id": txn.reverses_id,
            "created_at": txn.created_at,
            "updated_at": txn.updated_at,
            "entries": [
                {
                    "id": e.id,
                    "transaction_id": e.transaction_id,
                    "account_id": e.account_id,
                    "account_code": e.account.code if e.account else None,
                    "account_name": e.account.name if e.account else None,
                    "description": e.description,
                    "debit_amount": e.debit_amount,
                    "credit_amount": e.credit_amount,
                    "created_at": e.created_at,
                }
                for e in txn.entries
            ]
        }
        txn_responses.append(txn_dict)
    
    return {
        "transactions": txn_responses,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    company_id: str,
    data: TransactionCreate,
    auto_post: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new journal entry."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    # Initialize chart of accounts if needed
    service.initialize_chart_of_accounts(company)
    
    try:
        transaction = service.create_journal_entry(company, data, auto_post=auto_post)
        
        # Build response
        return {
            "id": transaction.id,
            "company_id": transaction.company_id,
            "transaction_number": transaction.transaction_number,
            "transaction_date": transaction.transaction_date,
            "description": transaction.description,
            "reference_type": transaction.reference_type.value,
            "reference_id": transaction.reference_id,
            "status": transaction.status.value,
            "is_reconciled": transaction.is_reconciled,
            "reconciled_at": transaction.reconciled_at,
            "total_debit": transaction.total_debit,
            "total_credit": transaction.total_credit,
            "reversed_by_id": transaction.reversed_by_id,
            "reverses_id": transaction.reverses_id,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
            "entries": [
                {
                    "id": e.id,
                    "transaction_id": e.transaction_id,
                    "account_id": e.account_id,
                    "account_code": e.account.code if e.account else None,
                    "account_name": e.account.name if e.account else None,
                    "description": e.description,
                    "debit_amount": e.debit_amount,
                    "credit_amount": e.credit_amount,
                    "created_at": e.created_at,
                }
                for e in transaction.entries
            ]
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    company_id: str,
    transaction_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a transaction by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    transaction = service.get_transaction(transaction_id, company)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    return {
        "id": transaction.id,
        "company_id": transaction.company_id,
        "transaction_number": transaction.transaction_number,
        "transaction_date": transaction.transaction_date,
        "description": transaction.description,
        "reference_type": transaction.reference_type.value,
        "reference_id": transaction.reference_id,
        "status": transaction.status.value,
        "is_reconciled": transaction.is_reconciled,
        "reconciled_at": transaction.reconciled_at,
        "total_debit": transaction.total_debit,
        "total_credit": transaction.total_credit,
        "reversed_by_id": transaction.reversed_by_id,
        "reverses_id": transaction.reverses_id,
        "created_at": transaction.created_at,
        "updated_at": transaction.updated_at,
        "entries": [
            {
                "id": e.id,
                "transaction_id": e.transaction_id,
                "account_id": e.account_id,
                "account_code": e.account.code if e.account else None,
                "account_name": e.account.name if e.account else None,
                "description": e.description,
                "debit_amount": e.debit_amount,
                "credit_amount": e.credit_amount,
                "created_at": e.created_at,
            }
            for e in transaction.entries
        ]
    }


@router.post("/transactions/{transaction_id}/post", response_model=TransactionResponse)
async def post_transaction(
    company_id: str,
    transaction_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Post a draft transaction."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    transaction = service.get_transaction(transaction_id, company)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    try:
        posted = service.post_transaction(transaction)
        return {
            "id": posted.id,
            "company_id": posted.company_id,
            "transaction_number": posted.transaction_number,
            "transaction_date": posted.transaction_date,
            "description": posted.description,
            "reference_type": posted.reference_type.value,
            "reference_id": posted.reference_id,
            "status": posted.status.value,
            "is_reconciled": posted.is_reconciled,
            "reconciled_at": posted.reconciled_at,
            "total_debit": posted.total_debit,
            "total_credit": posted.total_credit,
            "reversed_by_id": posted.reversed_by_id,
            "reverses_id": posted.reverses_id,
            "created_at": posted.created_at,
            "updated_at": posted.updated_at,
            "entries": []
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/transactions/{transaction_id}/reverse", response_model=TransactionResponse)
async def reverse_transaction(
    company_id: str,
    transaction_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reverse a posted transaction."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    transaction = service.get_transaction(transaction_id, company)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    try:
        reversal = service.reverse_transaction(transaction, reason)
        return {
            "id": reversal.id,
            "company_id": reversal.company_id,
            "transaction_number": reversal.transaction_number,
            "transaction_date": reversal.transaction_date,
            "description": reversal.description,
            "reference_type": reversal.reference_type.value,
            "reference_id": reversal.reference_id,
            "status": reversal.status.value,
            "is_reconciled": reversal.is_reconciled,
            "reconciled_at": reversal.reconciled_at,
            "total_debit": reversal.total_debit,
            "total_credit": reversal.total_credit,
            "reversed_by_id": reversal.reversed_by_id,
            "reverses_id": reversal.reverses_id,
            "created_at": reversal.created_at,
            "updated_at": reversal.updated_at,
            "entries": []
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/transactions/{transaction_id}/reconcile")
async def reconcile_transaction(
    company_id: str,
    transaction_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark a transaction as reconciled."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    transaction = service.get_transaction(transaction_id, company)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    service.reconcile_transaction(transaction)
    return {"message": "Transaction reconciled successfully"}


# ============== Bank Import Endpoints ==============

@router.post("/bank-import/preview")
async def preview_bank_statement(
    company_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Preview a bank statement CSV and return headers for mapping."""
    company = get_company_or_404(company_id, current_user, db)
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported"
        )
    
    try:
        content = await file.read()
        # Try different encodings
        content_str = None
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                content_str = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if content_str is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode CSV file"
            )
        
        service = BankImportService(db)
        preview = service.preview_csv(content_str)
        
        return {
            "filename": file.filename,
            "headers": preview['headers'],
            "sample_rows": preview['sample_rows'],
            "detected_bank": preview['detected_bank'],
            "row_count": preview['row_count'],
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/bank-import", response_model=BankImportResponse, status_code=status.HTTP_201_CREATED)
async def upload_bank_statement(
    company_id: str,
    file: UploadFile = File(...),
    bank_account_id: Optional[str] = None,
    bank_name: Optional[str] = None,
    date_column: Optional[str] = None,
    description_column: Optional[str] = None,
    debit_column: Optional[str] = None,
    credit_column: Optional[str] = None,
    reference_column: Optional[str] = None,
    balance_column: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload and parse a bank statement CSV with optional column mapping."""
    company = get_company_or_404(company_id, current_user, db)
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported"
        )
    
    try:
        content = await file.read()
        # Try different encodings
        content_str = None
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                content_str = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if content_str is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode CSV file"
            )
        
        # Build column mapping if provided
        column_mapping = None
        if description_column:  # At minimum, description is required
            column_mapping = {
                'description': description_column,
            }
            if date_column:
                column_mapping['date'] = date_column
            if debit_column:
                column_mapping['debit'] = debit_column
            if credit_column:
                column_mapping['credit'] = credit_column
            if reference_column:
                column_mapping['reference'] = reference_column
            if balance_column:
                column_mapping['balance'] = balance_column
        
        service = BankImportService(db)
        bank_import = service.create_import(
            company,
            file.filename,
            content_str,
            bank_account_id,
            bank_name,
            column_mapping
        )
        
        return BankImportResponse.model_validate(bank_import)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/bank-imports", response_model=List[BankImportResponse])
async def list_bank_imports(
    company_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all bank imports."""
    company = get_company_or_404(company_id, current_user, db)
    service = BankImportService(db)
    
    imports, total = service.get_imports(company, page, page_size)
    return [BankImportResponse.model_validate(imp) for imp in imports]


@router.get("/bank-imports/{import_id}", response_model=BankImportDetailResponse)
async def get_bank_import(
    company_id: str,
    import_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a bank import with rows."""
    company = get_company_or_404(company_id, current_user, db)
    service = BankImportService(db)
    
    bank_import = service.get_import(import_id, company)
    if not bank_import:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank import not found"
        )
    
    rows = service.get_import_rows(bank_import)
    
    return {
        **BankImportResponse.model_validate(bank_import).model_dump(),
        "rows": [
            {
                "id": r.id,
                "import_id": r.import_id,
                "row_number": r.row_number,
                "transaction_date": r.transaction_date,
                "value_date": r.value_date,
                "description": r.description,
                "reference_number": r.reference_number,
                "debit_amount": r.debit_amount,
                "credit_amount": r.credit_amount,
                "balance": r.balance,
                "status": r.status.value,
                "transaction_id": r.transaction_id,
                "mapped_account_id": r.mapped_account_id,
                "created_at": r.created_at,
            }
            for r in rows
        ]
    }


@router.post("/bank-imports/{import_id}/process")
async def process_bank_import(
    company_id: str,
    import_id: str,
    data: BankImportProcessRequest,
    bank_account_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Process bank import rows with account mappings."""
    company = get_company_or_404(company_id, current_user, db)
    service = BankImportService(db)
    
    bank_import = service.get_import(import_id, company)
    if not bank_import:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank import not found"
        )
    
    mappings = [m.model_dump() for m in data.mappings]
    created, matched, ignored = service.process_rows(
        bank_import, 
        mappings, 
        company,
        bank_account_id
    )
    
    return {
        "message": "Import processed successfully",
        "created": created,
        "matched": matched,
        "ignored": ignored,
    }


@router.delete("/bank-imports/{import_id}")
async def delete_bank_import(
    company_id: str,
    import_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a bank import."""
    company = get_company_or_404(company_id, current_user, db)
    service = BankImportService(db)
    
    bank_import = service.get_import(import_id, company)
    if not bank_import:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank import not found"
        )
    
    service.delete_import(bank_import)
    return {"message": "Bank import deleted successfully"}


# ============== Report Endpoints ==============

@router.get("/reports/trial-balance")
async def get_trial_balance(
    company_id: str,
    as_of_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate trial balance report."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Initialize chart of accounts if needed
    accounting_service = AccountingService(db)
    accounting_service.initialize_chart_of_accounts(company)
    
    service = ReportService(db)
    
    as_of_dt = datetime.combine(as_of_date, datetime.max.time()) if as_of_date else None
    report = service.get_trial_balance(company, as_of_dt)
    
    return report


@router.get("/reports/profit-loss")
async def get_profit_loss(
    company_id: str,
    from_date: date,
    to_date: date,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate Profit & Loss statement."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Initialize chart of accounts if needed
    accounting_service = AccountingService(db)
    accounting_service.initialize_chart_of_accounts(company)
    
    service = ReportService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time())
    to_dt = datetime.combine(to_date, datetime.max.time())
    
    report = service.get_profit_loss(company, from_dt, to_dt)
    return report


@router.get("/reports/balance-sheet")
async def get_balance_sheet(
    company_id: str,
    as_of_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate Balance Sheet."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Initialize chart of accounts if needed
    accounting_service = AccountingService(db)
    accounting_service.initialize_chart_of_accounts(company)
    
    service = ReportService(db)
    
    as_of_dt = datetime.combine(as_of_date, datetime.max.time()) if as_of_date else None
    report = service.get_balance_sheet(company, as_of_dt)
    
    return report


@router.get("/reports/cash-flow")
async def get_cash_flow(
    company_id: str,
    from_date: date,
    to_date: date,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate Cash Flow statement."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Initialize chart of accounts if needed
    accounting_service = AccountingService(db)
    accounting_service.initialize_chart_of_accounts(company)
    
    service = ReportService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time())
    to_dt = datetime.combine(to_date, datetime.max.time())
    
    report = service.get_cash_flow(company, from_dt, to_dt)
    return report


@router.get("/reports/account-summary")
async def get_account_summary(
    company_id: str,
    as_of_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get summary of account balances."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Initialize chart of accounts if needed
    accounting_service = AccountingService(db)
    accounting_service.initialize_chart_of_accounts(company)
    
    service = ReportService(db)
    
    as_of_dt = datetime.combine(as_of_date, datetime.max.time()) if as_of_date else None
    summary = service.get_account_summary(company, as_of_dt)
    
    return summary


@router.get("/reports/outstanding-receivables")
async def get_outstanding_receivables(
    company_id: str,
    as_of_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get outstanding receivables (who owes you money)."""
    company = get_company_or_404(company_id, current_user, db)
    service = ReportService(db)
    
    as_of_dt = datetime.combine(as_of_date, datetime.max.time()) if as_of_date else None
    return service.get_outstanding_receivables(company, as_of_dt)


@router.get("/reports/outstanding-payables")
async def get_outstanding_payables(
    company_id: str,
    as_of_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get outstanding payables (who you owe money to)."""
    company = get_company_or_404(company_id, current_user, db)
    service = ReportService(db)
    
    as_of_dt = datetime.combine(as_of_date, datetime.max.time()) if as_of_date else None
    return service.get_outstanding_payables(company, as_of_dt)


@router.get("/reports/aging")
async def get_aging_report(
    company_id: str,
    report_type: str = Query("receivables", pattern="^(receivables|payables)$"),
    as_of_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get aging analysis of receivables or payables."""
    company = get_company_or_404(company_id, current_user, db)
    service = ReportService(db)
    
    as_of_dt = datetime.combine(as_of_date, datetime.max.time()) if as_of_date else None
    return service.get_aging_report(company, report_type, as_of_dt)


@router.get("/reports/party-statement/{party_id}")
async def get_party_statement(
    company_id: str,
    party_id: str,
    party_type: str = Query("customer", pattern="^(customer|vendor)$"),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get statement for a specific party (customer/vendor)."""
    company = get_company_or_404(company_id, current_user, db)
    service = ReportService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time()) if from_date else None
    to_dt = datetime.combine(to_date, datetime.max.time()) if to_date else None
    
    return service.get_party_statement(company, party_id, party_type, from_dt, to_dt)


@router.get("/reports/day-book")
async def get_day_book(
    company_id: str,
    date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get day book - all transactions for a specific day."""
    company = get_company_or_404(company_id, current_user, db)
    service = ReportService(db)
    
    target_date = datetime.combine(date, datetime.min.time()) if date else None
    return service.get_day_book(company, target_date)


# ============== Account Mapping Endpoints ==============

@router.get("/account-mappings")
async def list_account_mappings(
    company_id: str,
    mapping_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all account mappings for a company."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    # Initialize chart of accounts and mappings if needed
    service.initialize_chart_of_accounts(company)
    service.initialize_account_mappings(company)
    
    mappings = service.get_all_account_mappings(company)
    
    # Filter by type if provided
    if mapping_type:
        try:
            m_type = AccountMappingType(mapping_type)
            mappings = [m for m in mappings if m.mapping_type == m_type]
        except ValueError:
            pass
    
    return [
        {
            "id": m.id,
            "company_id": m.company_id,
            "mapping_type": m.mapping_type.value,
            "category": m.category,
            "name": m.name,
            "debit_account_id": m.debit_account_id,
            "debit_account_code": m.debit_account.code if m.debit_account else None,
            "debit_account_name": m.debit_account.name if m.debit_account else None,
            "credit_account_id": m.credit_account_id,
            "credit_account_code": m.credit_account.code if m.credit_account else None,
            "credit_account_name": m.credit_account.name if m.credit_account else None,
            "is_system": m.is_system,
            "is_active": m.is_active,
        }
        for m in mappings
    ]


@router.get("/account-mappings/{mapping_id}")
async def get_account_mapping(
    company_id: str,
    mapping_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific account mapping."""
    company = get_company_or_404(company_id, current_user, db)
    
    mapping = db.query(AccountMapping).filter(
        AccountMapping.id == mapping_id,
        AccountMapping.company_id == company.id
    ).first()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account mapping not found"
        )
    
    return {
        "id": mapping.id,
        "company_id": mapping.company_id,
        "mapping_type": mapping.mapping_type.value,
        "category": mapping.category,
        "name": mapping.name,
        "debit_account_id": mapping.debit_account_id,
        "debit_account_code": mapping.debit_account.code if mapping.debit_account else None,
        "debit_account_name": mapping.debit_account.name if mapping.debit_account else None,
        "credit_account_id": mapping.credit_account_id,
        "credit_account_code": mapping.credit_account.code if mapping.credit_account else None,
        "credit_account_name": mapping.credit_account.name if mapping.credit_account else None,
        "is_system": mapping.is_system,
        "is_active": mapping.is_active,
    }


from pydantic import BaseModel

class AccountMappingUpdate(BaseModel):
    debit_account_id: Optional[str] = None
    credit_account_id: Optional[str] = None
    is_active: Optional[bool] = None


@router.put("/account-mappings/{mapping_id}")
async def update_account_mapping(
    company_id: str,
    mapping_id: str,
    data: AccountMappingUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an account mapping."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    mapping = db.query(AccountMapping).filter(
        AccountMapping.id == mapping_id,
        AccountMapping.company_id == company.id
    ).first()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account mapping not found"
        )
    
    # Validate accounts exist
    if data.debit_account_id:
        debit_acc = service.get_account(data.debit_account_id, company)
        if not debit_acc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debit account not found"
            )
    
    if data.credit_account_id:
        credit_acc = service.get_account(data.credit_account_id, company)
        if not credit_acc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Credit account not found"
            )
    
    # Update
    if data.debit_account_id is not None:
        mapping.debit_account_id = data.debit_account_id
    if data.credit_account_id is not None:
        mapping.credit_account_id = data.credit_account_id
    if data.is_active is not None:
        mapping.is_active = data.is_active
    
    db.commit()
    db.refresh(mapping)
    
    return {
        "id": mapping.id,
        "company_id": mapping.company_id,
        "mapping_type": mapping.mapping_type.value,
        "category": mapping.category,
        "name": mapping.name,
        "debit_account_id": mapping.debit_account_id,
        "debit_account_code": mapping.debit_account.code if mapping.debit_account else None,
        "debit_account_name": mapping.debit_account.name if mapping.debit_account else None,
        "credit_account_id": mapping.credit_account_id,
        "credit_account_code": mapping.credit_account.code if mapping.credit_account else None,
        "credit_account_name": mapping.credit_account.name if mapping.credit_account else None,
        "is_system": mapping.is_system,
        "is_active": mapping.is_active,
    }


@router.post("/account-mappings/reset")
async def reset_account_mappings(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reset account mappings to defaults."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    mappings = service.reset_account_mappings(company)
    
    return {
        "message": "Account mappings reset to defaults",
        "count": len(mappings)
    }


# ============== Payroll Account Config Endpoints ==============

@router.get("/payroll-account-configs")
async def list_payroll_account_configs(
    company_id: str,
    component_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all payroll account configurations."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    # Initialize if needed
    service.initialize_chart_of_accounts(company)
    service.initialize_payroll_account_configs(company)
    
    configs = service.get_all_payroll_account_configs(company)
    
    # Filter by type if provided
    if component_type:
        configs = [c for c in configs if c.component_type == component_type]
    
    return [
        {
            "id": c.id,
            "company_id": c.company_id,
            "salary_component_id": c.salary_component_id,
            "component_type": c.component_type,
            "component_name": c.component_name,
            "account_id": c.account_id,
            "account_code": c.account.code if c.account else None,
            "account_name": c.account.name if c.account else None,
            "is_debit": c.is_debit,
            "contra_account_id": c.contra_account_id,
            "contra_account_code": c.contra_account.code if c.contra_account else None,
            "contra_account_name": c.contra_account.name if c.contra_account else None,
            "is_active": c.is_active,
        }
        for c in configs
    ]


class PayrollAccountConfigUpdate(BaseModel):
    account_id: Optional[str] = None
    contra_account_id: Optional[str] = None
    is_active: Optional[bool] = None


@router.put("/payroll-account-configs/{config_id}")
async def update_payroll_account_config(
    company_id: str,
    config_id: str,
    data: PayrollAccountConfigUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a payroll account configuration."""
    company = get_company_or_404(company_id, current_user, db)
    service = AccountingService(db)
    
    config = db.query(PayrollAccountConfig).filter(
        PayrollAccountConfig.id == config_id,
        PayrollAccountConfig.company_id == company.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll account config not found"
        )
    
    # Validate accounts exist
    if data.account_id:
        acc = service.get_account(data.account_id, company)
        if not acc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account not found"
            )
    
    if data.contra_account_id:
        contra_acc = service.get_account(data.contra_account_id, company)
        if not contra_acc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contra account not found"
            )
    
    # Update
    if data.account_id is not None:
        config.account_id = data.account_id
    if data.contra_account_id is not None:
        config.contra_account_id = data.contra_account_id
    if data.is_active is not None:
        config.is_active = data.is_active
    
    db.commit()
    db.refresh(config)
    
    return {
        "id": config.id,
        "company_id": config.company_id,
        "salary_component_id": config.salary_component_id,
        "component_type": config.component_type,
        "component_name": config.component_name,
        "account_id": config.account_id,
        "account_code": config.account.code if config.account else None,
        "account_name": config.account.name if config.account else None,
        "is_debit": config.is_debit,
        "contra_account_id": config.contra_account_id,
        "contra_account_code": config.contra_account.code if config.contra_account else None,
        "contra_account_name": config.contra_account.name if config.contra_account else None,
        "is_active": config.is_active,
    }
