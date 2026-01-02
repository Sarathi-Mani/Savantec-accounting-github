"""Company API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.database.models import User, Company
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    BankAccountCreate, BankAccountUpdate, BankAccountResponse
)
from app.services.company_service import CompanyService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    data: CompanyCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new company/business profile."""
    service = CompanyService(db)
    company = service.create_company(current_user, data)
    return CompanyResponse.model_validate(company)


@router.get("", response_model=List[CompanyResponse])
async def list_companies(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all companies for the current user."""
    service = CompanyService(db)
    companies = service.get_companies(current_user)
    return [CompanyResponse.model_validate(c) for c in companies]


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a company by ID."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    return CompanyResponse.model_validate(company)


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    data: CompanyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a company."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    updated_company = service.update_company(company, data)
    return CompanyResponse.model_validate(updated_company)


@router.delete("/{company_id}")
async def delete_company(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a company (soft delete)."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    service.delete_company(company)
    return {"message": "Company deleted successfully"}


# Bank Account routes
@router.post("/{company_id}/bank-accounts", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def add_bank_account(
    company_id: str,
    data: BankAccountCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a bank account to a company (also creates linked Chart of Accounts entry)."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    bank_account = service.add_bank_account(company, data)
    return service.get_bank_account_with_balance(bank_account)


@router.get("/{company_id}/bank-accounts", response_model=List[BankAccountResponse])
async def list_bank_accounts(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all bank accounts for a company with balance info."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    bank_accounts = service.get_bank_accounts(company)
    return [service.get_bank_account_with_balance(b) for b in bank_accounts]


@router.get("/{company_id}/bank-accounts/{bank_account_id}", response_model=BankAccountResponse)
async def get_bank_account(
    company_id: str,
    bank_account_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a bank account by ID with balance info."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    bank_account = service.get_bank_account(bank_account_id, company)
    
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )
    
    return service.get_bank_account_with_balance(bank_account)


@router.put("/{company_id}/bank-accounts/{bank_account_id}", response_model=BankAccountResponse)
async def update_bank_account(
    company_id: str,
    bank_account_id: str,
    data: BankAccountUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a bank account (including opening balance)."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    bank_account = service.get_bank_account(bank_account_id, company)
    
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )
    
    updated_bank_account = service.update_bank_account(bank_account, data, company)
    return service.get_bank_account_with_balance(updated_bank_account)


@router.delete("/{company_id}/bank-accounts/{bank_account_id}")
async def delete_bank_account(
    company_id: str,
    bank_account_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a bank account."""
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    bank_account = service.get_bank_account(bank_account_id, company)
    
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )
    
    service.delete_bank_account(bank_account)
    return {"message": "Bank account deleted successfully"}


@router.post("/{company_id}/dev-reset")
async def dev_reset_company_data(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    [DEV ONLY] Reset all business data for a company.
    Keeps: User data, Company profile, Bank accounts, Authentication
    Deletes: Invoices, Customers, Products, Payments, Transactions, Accounts, Bank Imports
    """
    from app.database.models import (
        Invoice, Customer, Product, Payment, InvoiceItem,
        Transaction, TransactionEntry, Account, BankImport, BankImportRow
    )
    
    service = CompanyService(db)
    company = service.get_company(company_id, current_user)
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    deleted_counts = {}
    
    try:
        # Delete in order respecting foreign key constraints
        
        # 1. Delete invoice items first (depends on invoices)
        invoice_items_deleted = db.query(InvoiceItem).filter(
            InvoiceItem.invoice_id.in_(
                db.query(Invoice.id).filter(Invoice.company_id == company_id)
            )
        ).delete(synchronize_session=False)
        deleted_counts["invoice_items"] = invoice_items_deleted
        
        # 2. Delete payments (depends on invoices)
        payments_deleted = db.query(Payment).filter(
            Payment.invoice_id.in_(
                db.query(Invoice.id).filter(Invoice.company_id == company_id)
            )
        ).delete(synchronize_session=False)
        deleted_counts["payments"] = payments_deleted
        
        # 3. Delete invoices
        invoices_deleted = db.query(Invoice).filter(Invoice.company_id == company_id).delete(synchronize_session=False)
        deleted_counts["invoices"] = invoices_deleted
        
        # 4. Delete customers
        customers_deleted = db.query(Customer).filter(Customer.company_id == company_id).delete(synchronize_session=False)
        deleted_counts["customers"] = customers_deleted
        
        # 5. Delete products
        products_deleted = db.query(Product).filter(Product.company_id == company_id).delete(synchronize_session=False)
        deleted_counts["products"] = products_deleted
        
        # 6. Delete bank import rows (depends on bank imports)
        bank_import_rows_deleted = db.query(BankImportRow).filter(
            BankImportRow.import_id.in_(
                db.query(BankImport.id).filter(BankImport.company_id == company_id)
            )
        ).delete(synchronize_session=False)
        deleted_counts["bank_import_rows"] = bank_import_rows_deleted
        
        # 7. Delete bank imports
        bank_imports_deleted = db.query(BankImport).filter(BankImport.company_id == company_id).delete(synchronize_session=False)
        deleted_counts["bank_imports"] = bank_imports_deleted
        
        # 8. Delete transaction entries (depends on transactions)
        transaction_entries_deleted = db.query(TransactionEntry).filter(
            TransactionEntry.transaction_id.in_(
                db.query(Transaction.id).filter(Transaction.company_id == company_id)
            )
        ).delete(synchronize_session=False)
        deleted_counts["transaction_entries"] = transaction_entries_deleted
        
        # 9. Delete transactions
        transactions_deleted = db.query(Transaction).filter(Transaction.company_id == company_id).delete(synchronize_session=False)
        deleted_counts["transactions"] = transactions_deleted
        
        # 10. Delete accounts (need to handle parent_id self-reference)
        # First set all parent_ids to null, then delete
        db.query(Account).filter(Account.company_id == company_id).update({"parent_id": None}, synchronize_session=False)
        accounts_deleted = db.query(Account).filter(Account.company_id == company_id).delete(synchronize_session=False)
        deleted_counts["accounts"] = accounts_deleted
        
        db.commit()
        
        return {
            "message": "All business data has been reset",
            "deleted": deleted_counts,
            "preserved": ["user", "company_profile", "bank_accounts", "authentication"]
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset data: {str(e)}"
        )

