"""Company service for business logic."""
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from app.database.models import Company, BankAccount, User, Account, AccountType
from app.schemas.company import CompanyCreate, CompanyUpdate, BankAccountCreate, BankAccountUpdate


class CompanyService:
    """Service for company operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_company(self, user: User, data: CompanyCreate) -> Company:
        """Create a new company for a user."""
        company = Company(
            user_id=user.id,
            name=data.name,
            trade_name=data.trade_name,
            gstin=data.gstin,
            pan=data.pan,
            cin=data.cin,
            email=data.email,
            phone=data.phone,
            website=data.website,
            address_line1=data.address_line1,
            address_line2=data.address_line2,
            city=data.city,
            state=data.state,
            state_code=data.state_code,
            pincode=data.pincode,
            country=data.country,
            business_type=data.business_type,
            invoice_prefix=data.invoice_prefix,
            invoice_terms=data.invoice_terms,
            invoice_notes=data.invoice_notes,
        )
        
        # Extract state code from GSTIN if not provided
        if data.gstin and not data.state_code:
            company.state_code = data.gstin[:2]
        
        self.db.add(company)
        self.db.commit()
        self.db.refresh(company)
        return company
    
    def get_company(self, company_id: str, user: User) -> Optional[Company]:
        """Get a company by ID (must belong to user)."""
        return self.db.query(Company).filter(
            Company.id == company_id,
            Company.user_id == user.id
        ).first()
    
    def get_companies(self, user: User) -> List[Company]:
        """Get all companies for a user."""
        return self.db.query(Company).filter(
            Company.user_id == user.id,
            Company.is_active == True
        ).all()
    
    def update_company(self, company: Company, data: CompanyUpdate) -> Company:
        """Update a company."""
        update_data = data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(company, field, value)
        
        # Update state code from GSTIN if GSTIN changed
        if data.gstin and not data.state_code:
            company.state_code = data.gstin[:2]
        
        self.db.commit()
        self.db.refresh(company)
        return company
    
    def delete_company(self, company: Company) -> bool:
        """Soft delete a company."""
        company.is_active = False
        self.db.commit()
        return True
    
    def add_bank_account(self, company: Company, data: BankAccountCreate) -> BankAccount:
        """Add a bank account to a company and create linked Chart of Accounts entry."""
        bank_account = BankAccount(
            company_id=company.id,
            bank_name=data.bank_name,
            account_name=data.account_name,
            account_number=data.account_number,
            ifsc_code=data.ifsc_code,
            branch=data.branch,
            upi_id=data.upi_id,
            is_default=data.is_default,
        )
        
        # If this is the default, unset other defaults
        if data.is_default:
            self.db.query(BankAccount).filter(
                BankAccount.company_id == company.id,
                BankAccount.is_default == True
            ).update({"is_default": False})
        
        self.db.add(bank_account)
        self.db.flush()  # Get ID without committing
        
        # Create linked Chart of Accounts entry for this bank
        # Find the next available bank account code (1010, 1011, 1012, etc.)
        existing_bank_codes = self.db.query(Account.code).filter(
            Account.company_id == company.id,
            Account.code.like("101%")
        ).all()
        existing_codes = [c[0] for c in existing_bank_codes]
        
        next_code = 1010
        while f"{next_code}" in existing_codes:
            next_code += 1
        
        # Get short bank name (first 4 chars)
        short_bank = data.bank_name.upper()[:4] if data.bank_name else "BANK"
        account_name = f"Bank - {data.bank_name} (...{data.account_number[-4:]})"
        
        chart_account = Account(
            company_id=company.id,
            code=str(next_code),
            name=account_name,
            description=f"{data.bank_name} - {data.account_number}",
            account_type=AccountType.ASSET,
            is_system=False,
            bank_account_id=bank_account.id,
        )
        self.db.add(chart_account)
        self.db.flush()
        
        # Create opening balance transaction if provided
        if data.opening_balance and Decimal(str(data.opening_balance)) != Decimal("0"):
            from app.services.accounting_service import AccountingService
            accounting_service = AccountingService(self.db)
            accounting_service.create_opening_balance_transaction(
                company=company,
                account_id=chart_account.id,
                amount=Decimal(str(data.opening_balance)),
            )
        
        self.db.commit()
        self.db.refresh(bank_account)
        
        # Update company's default bank if this is default
        if data.is_default:
            company.default_bank_id = bank_account.id
            self.db.commit()
        
        return bank_account
    
    def get_bank_accounts(self, company: Company) -> List[BankAccount]:
        """Get all bank accounts for a company."""
        return self.db.query(BankAccount).filter(
            BankAccount.company_id == company.id,
            BankAccount.is_active == True
        ).all()
    
    def get_bank_account(self, bank_account_id: str, company: Company) -> Optional[BankAccount]:
        """Get a bank account by ID (must belong to company)."""
        return self.db.query(BankAccount).filter(
            BankAccount.id == bank_account_id,
            BankAccount.company_id == company.id,
            BankAccount.is_active == True
        ).first()
    
    def update_bank_account(self, bank_account: BankAccount, data: BankAccountUpdate, company: Company) -> BankAccount:
        """Update a bank account and its linked Chart of Accounts entry."""
        update_data = data.model_dump(exclude_unset=True)
        
        # Handle is_default separately
        if "is_default" in update_data and update_data["is_default"]:
            # Unset other defaults
            self.db.query(BankAccount).filter(
                BankAccount.company_id == company.id,
                BankAccount.is_default == True,
                BankAccount.id != bank_account.id
            ).update({"is_default": False})
            
            # Update company's default bank
            company.default_bank_id = bank_account.id
        
        # Handle opening_balance update - create adjustment transaction
        if "opening_balance" in update_data and update_data["opening_balance"] is not None:
            linked_account = self.db.query(Account).filter(
                Account.bank_account_id == bank_account.id
            ).first()
            
            if linked_account:
                from app.services.accounting_service import AccountingService
                accounting_service = AccountingService(self.db)
                current_balance = accounting_service.get_account_balance(linked_account.id)
                new_balance = Decimal(str(update_data["opening_balance"]))
                diff = new_balance - current_balance
                
                if diff != Decimal("0"):
                    # Create adjustment transaction
                    accounting_service.create_opening_balance_transaction(
                        company=company,
                        account_id=linked_account.id,
                        amount=diff,
                    )
            
            # Remove from update_data as it's not a field on BankAccount
            del update_data["opening_balance"]
        
        for field, value in update_data.items():
            if value is not None and hasattr(bank_account, field):
                setattr(bank_account, field, value)
        
        self.db.commit()
        self.db.refresh(bank_account)
        return bank_account
    
    def delete_bank_account(self, bank_account: BankAccount) -> bool:
        """Soft delete a bank account."""
        bank_account.is_active = False
        self.db.commit()
        return True
    
    def get_bank_account_with_balance(self, bank_account: BankAccount) -> dict:
        """Get bank account with balance info calculated from transactions."""
        linked_account = self.db.query(Account).filter(
            Account.bank_account_id == bank_account.id
        ).first()
        
        current_balance = Decimal("0")
        if linked_account:
            from app.services.accounting_service import AccountingService
            accounting_service = AccountingService(self.db)
            current_balance = accounting_service.get_account_balance(linked_account.id)
        
        return {
            "id": bank_account.id,
            "bank_name": bank_account.bank_name,
            "account_name": bank_account.account_name,
            "account_number": bank_account.account_number,
            "ifsc_code": bank_account.ifsc_code,
            "branch": bank_account.branch,
            "upi_id": bank_account.upi_id,
            "is_default": bank_account.is_default,
            "is_active": bank_account.is_active,
            "created_at": bank_account.created_at,
            "current_balance": float(current_balance),
            "linked_account_id": linked_account.id if linked_account else None,
        }
    
    def get_next_invoice_number(self, company: Company) -> str:
        """Get the next invoice number for a company."""
        counter = company.invoice_counter
        invoice_number = f"{company.invoice_prefix}-{counter:05d}"
        
        # Increment counter
        company.invoice_counter = counter + 1
        self.db.commit()
        
        return invoice_number

