"""Accounting service for double-entry bookkeeping."""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from app.database.models import (
    Account, Transaction, TransactionEntry, Company, Invoice, Payment,
    AccountType, TransactionStatus, ReferenceType, BankAccount,
    AccountMapping, AccountMappingType, PayrollAccountConfig
)
from app.database.payroll_models import SalaryComponent
from app.schemas.accounting import (
    AccountCreate, AccountUpdate, TransactionCreate, TransactionEntryCreate,
    DEFAULT_CHART_OF_ACCOUNTS, AccountType as SchemaAccountType
)


class AccountingService:
    """Service for accounting operations with double-entry bookkeeping."""
    
    def __init__(self, db: Session):
        self.db = db
        self._transaction_counter_cache = {}
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round amount to 2 decimal places."""
        return Decimal(amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ============== Balance Calculation (Single Source of Truth) ==============
    
    def get_account_balance(
        self, 
        account_id: str, 
        as_of_date: Optional[datetime] = None
    ) -> Decimal:
        """
        Calculate account balance from transaction entries.
        This is the ONLY source of truth for account balances.
        
        For Assets and Expenses: Debits increase, Credits decrease
        For Liabilities, Equity, Revenue: Credits increase, Debits decrease
        """
        account = self.db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return Decimal("0")
        
        query = self.db.query(
            func.coalesce(func.sum(TransactionEntry.debit_amount), 0).label('total_debit'),
            func.coalesce(func.sum(TransactionEntry.credit_amount), 0).label('total_credit')
        ).join(Transaction).filter(
            TransactionEntry.account_id == account_id,
            Transaction.status == TransactionStatus.POSTED
        )
        
        if as_of_date:
            query = query.filter(Transaction.transaction_date <= as_of_date)
        
        result = query.first()
        total_debit = Decimal(str(result.total_debit or 0))
        total_credit = Decimal(str(result.total_credit or 0))
        
        # Assets and Expenses have debit-normal balances
        # Liabilities, Equity, Revenue have credit-normal balances
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return total_debit - total_credit
        else:
            return total_credit - total_debit
    
    def get_account_balance_between(
        self,
        account_id: str,
        from_date: datetime,
        to_date: datetime
    ) -> Decimal:
        """Calculate account activity (movement) for a specific period."""
        account = self.db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return Decimal("0")
        
        result = self.db.query(
            func.coalesce(func.sum(TransactionEntry.debit_amount), 0).label('total_debit'),
            func.coalesce(func.sum(TransactionEntry.credit_amount), 0).label('total_credit')
        ).join(Transaction).filter(
            TransactionEntry.account_id == account_id,
            Transaction.status == TransactionStatus.POSTED,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date
        ).first()
        
        total_debit = Decimal(str(result.total_debit or 0))
        total_credit = Decimal(str(result.total_credit or 0))
        
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return total_debit - total_credit
        else:
            return total_credit - total_debit
    
    def get_multiple_account_balances(
        self,
        account_ids: List[str],
        as_of_date: Optional[datetime] = None
    ) -> dict:
        """
        Efficiently calculate balances for multiple accounts in one query.
        Returns dict: {account_id: balance}
        """
        if not account_ids:
            return {}
        
        # Get account types
        accounts = self.db.query(Account).filter(Account.id.in_(account_ids)).all()
        account_types = {a.id: a.account_type for a in accounts}
        
        # Query all balances at once
        query = self.db.query(
            TransactionEntry.account_id,
            func.coalesce(func.sum(TransactionEntry.debit_amount), 0).label('total_debit'),
            func.coalesce(func.sum(TransactionEntry.credit_amount), 0).label('total_credit')
        ).join(Transaction).filter(
            TransactionEntry.account_id.in_(account_ids),
            Transaction.status == TransactionStatus.POSTED
        )
        
        if as_of_date:
            query = query.filter(Transaction.transaction_date <= as_of_date)
        
        results = query.group_by(TransactionEntry.account_id).all()
        
        balances = {}
        for account_id in account_ids:
            balances[account_id] = Decimal("0")
        
        for row in results:
            account_id = row.account_id
            total_debit = Decimal(str(row.total_debit or 0))
            total_credit = Decimal(str(row.total_credit or 0))
            
            if account_types.get(account_id) in [AccountType.ASSET, AccountType.EXPENSE]:
                balances[account_id] = total_debit - total_credit
            else:
                balances[account_id] = total_credit - total_debit
        
        return balances
    
    def create_opening_balance_transaction(
        self,
        company: Company,
        account_id: str,
        amount: Decimal,
        balance_date: Optional[datetime] = None
    ) -> Transaction:
        """
        Create an opening balance as a journal entry transaction.
        Opening balances are just transactions with reference_type='opening_balance'.
        
        For assets/expenses: Debit the account, Credit Retained Earnings/Opening Balance Equity
        For liabilities/equity/revenue: Credit the account, Debit Retained Earnings/Opening Balance Equity
        """
        account = self.db.query(Account).filter(
            Account.id == account_id,
            Account.company_id == company.id
        ).first()
        
        if not account:
            raise ValueError(f"Account {account_id} not found")
        
        balance_date = balance_date or datetime.utcnow()
        
        # Get or create Opening Balance Equity account
        equity_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "3900"  # Opening Balance Equity
        ).first()
        
        if not equity_account:
            equity_account = Account(
                company_id=company.id,
                code="3900",
                name="Opening Balance Equity",
                account_type=AccountType.EQUITY,
                is_system=True,
            )
            self.db.add(equity_account)
            self.db.flush()
        
        # Create the transaction
        transaction = Transaction(
            company_id=company.id,
            transaction_number=self._get_next_transaction_number(company),
            transaction_date=balance_date,
            voucher_type="journal",
            description=f"Opening Balance - {account.name}",
            reference_type=ReferenceType.OPENING_BALANCE,
            status=TransactionStatus.POSTED,
            total_debit=abs(amount),
            total_credit=abs(amount),
        )
        self.db.add(transaction)
        self.db.flush()
        
        # Create entries based on account type
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            # Debit the account (positive balance)
            if amount >= 0:
                debit_account_id = account_id
                credit_account_id = equity_account.id
            else:
                debit_account_id = equity_account.id
                credit_account_id = account_id
        else:
            # Credit the account (positive balance for liab/equity/revenue)
            if amount >= 0:
                debit_account_id = equity_account.id
                credit_account_id = account_id
            else:
                debit_account_id = account_id
                credit_account_id = equity_account.id
        
        # Debit entry
        debit_entry = TransactionEntry(
            transaction_id=transaction.id,
            account_id=debit_account_id,
            debit_amount=abs(amount),
            credit_amount=Decimal("0"),
            description=f"Opening Balance",
        )
        self.db.add(debit_entry)
        
        # Credit entry
        credit_entry = TransactionEntry(
            transaction_id=transaction.id,
            account_id=credit_account_id,
            debit_amount=Decimal("0"),
            credit_amount=abs(amount),
            description=f"Opening Balance",
        )
        self.db.add(credit_entry)
        
        self.db.commit()
        return transaction
    
    # ============== Account Operations ==============
    
    def initialize_chart_of_accounts(self, company: Company) -> List[Account]:
        """Initialize default chart of accounts for a company."""
        # Check if already initialized
        existing = self.db.query(Account).filter(Account.company_id == company.id).first()
        if existing:
            return self.get_accounts(company)
        
        accounts = []
        code_to_id = {}
        
        # First pass: create accounts without parents
        for acc_data in DEFAULT_CHART_OF_ACCOUNTS:
            if "parent" not in acc_data:
                account = Account(
                    company_id=company.id,
                    code=acc_data["code"],
                    name=acc_data["name"],
                    account_type=AccountType(acc_data["type"].value),
                    is_system=acc_data.get("is_system", False),
                )
                self.db.add(account)
                self.db.flush()
                accounts.append(account)
                code_to_id[acc_data["code"]] = account.id
        
        # Second pass: create accounts with parents
        for acc_data in DEFAULT_CHART_OF_ACCOUNTS:
            if "parent" in acc_data:
                parent_id = code_to_id.get(acc_data["parent"])
                account = Account(
                    company_id=company.id,
                    code=acc_data["code"],
                    name=acc_data["name"],
                    account_type=AccountType(acc_data["type"].value),
                    parent_id=parent_id,
                    is_system=acc_data.get("is_system", False),
                )
                self.db.add(account)
                accounts.append(account)
        
        self.db.commit()
        return accounts
    
    def initialize_account_mappings(self, company: Company) -> List[AccountMapping]:
        """Initialize default account mappings for recurring transactions and payroll."""
        # Check if already initialized
        existing = self.db.query(AccountMapping).filter(
            AccountMapping.company_id == company.id
        ).first()
        if existing:
            return self.db.query(AccountMapping).filter(
                AccountMapping.company_id == company.id
            ).all()
        
        # Default account mappings for recurring expenses
        recurring_expense_mappings = [
            {"category": "rent", "name": "Rent/Lease Payment", "debit_code": "6200", "credit_code": "1010"},
            {"category": "utilities", "name": "Utilities (Electricity, Water, Gas)", "debit_code": "6300", "credit_code": "1010"},
            {"category": "internet", "name": "Internet/Telecom", "debit_code": "6500", "credit_code": "1010"},
            {"category": "insurance", "name": "Insurance Premium", "debit_code": "6400", "credit_code": "1010"},
            {"category": "loan_repayment", "name": "Loan Repayment", "debit_code": "2300", "credit_code": "1010"},
            {"category": "salary", "name": "Salary Payment", "debit_code": "6100", "credit_code": "1010"},
            {"category": "subscription", "name": "Software Subscription", "debit_code": "6500", "credit_code": "1010"},
            {"category": "maintenance", "name": "Maintenance Fee", "debit_code": "6700", "credit_code": "1010"},
            {"category": "other_expense", "name": "Other Recurring Expense", "debit_code": "6900", "credit_code": "1010"},
        ]
        
        # Default account mappings for recurring income
        recurring_income_mappings = [
            {"category": "subscription_income", "name": "Subscription Income", "debit_code": "1010", "credit_code": "4100"},
            {"category": "rental_income", "name": "Rental Income", "debit_code": "1010", "credit_code": "4200"},
            {"category": "service_income", "name": "Service Income", "debit_code": "1010", "credit_code": "4100"},
            {"category": "interest_income", "name": "Interest Income", "debit_code": "1010", "credit_code": "4300"},
            {"category": "other_income", "name": "Other Recurring Income", "debit_code": "1010", "credit_code": "4900"},
        ]
        
        mappings = []
        
        # Create recurring expense mappings
        for mapping_data in recurring_expense_mappings:
            debit_account = self.get_account_by_code(mapping_data["debit_code"], company)
            credit_account = self.get_account_by_code(mapping_data["credit_code"], company)
            
            mapping = AccountMapping(
                company_id=company.id,
                mapping_type=AccountMappingType.RECURRING_EXPENSE,
                category=mapping_data["category"],
                name=mapping_data["name"],
                debit_account_id=debit_account.id if debit_account else None,
                credit_account_id=credit_account.id if credit_account else None,
                is_system=True,
                is_active=True,
            )
            self.db.add(mapping)
            mappings.append(mapping)
        
        # Create recurring income mappings
        for mapping_data in recurring_income_mappings:
            debit_account = self.get_account_by_code(mapping_data["debit_code"], company)
            credit_account = self.get_account_by_code(mapping_data["credit_code"], company)
            
            mapping = AccountMapping(
                company_id=company.id,
                mapping_type=AccountMappingType.RECURRING_INCOME,
                category=mapping_data["category"],
                name=mapping_data["name"],
                debit_account_id=debit_account.id if debit_account else None,
                credit_account_id=credit_account.id if credit_account else None,
                is_system=True,
                is_active=True,
            )
            self.db.add(mapping)
            mappings.append(mapping)
        
        self.db.commit()
        return mappings
    
    def initialize_payroll_account_configs(self, company: Company) -> List[PayrollAccountConfig]:
        """Initialize default payroll account configurations."""
        # Check if already initialized
        existing = self.db.query(PayrollAccountConfig).filter(
            PayrollAccountConfig.company_id == company.id
        ).first()
        if existing:
            return self.db.query(PayrollAccountConfig).filter(
                PayrollAccountConfig.company_id == company.id
            ).all()
        
        # Default payroll account configurations
        # Format: component_type, component_name, account_code, is_debit, contra_account_code
        payroll_configs = [
            # Earnings - Debit Expense accounts
            {"type": "earning", "name": "Basic Salary", "code": "6100", "is_debit": True, "contra": None},
            {"type": "earning", "name": "House Rent Allowance", "code": "6100", "is_debit": True, "contra": None},
            {"type": "earning", "name": "Dearness Allowance", "code": "6100", "is_debit": True, "contra": None},
            {"type": "earning", "name": "Conveyance Allowance", "code": "6100", "is_debit": True, "contra": None},
            {"type": "earning", "name": "Medical Allowance", "code": "6100", "is_debit": True, "contra": None},
            {"type": "earning", "name": "Special Allowance", "code": "6100", "is_debit": True, "contra": None},
            {"type": "earning", "name": "Bonus", "code": "6102", "is_debit": True, "contra": None},
            {"type": "earning", "name": "Overtime", "code": "6103", "is_debit": True, "contra": None},
            
            # Deductions - Credit Liability accounts (reduce net pay)
            {"type": "deduction", "name": "TDS/Income Tax", "code": "2200", "is_debit": False, "contra": None},
            {"type": "deduction", "name": "Provident Fund (Employee)", "code": "2410", "is_debit": False, "contra": None},
            {"type": "deduction", "name": "ESI (Employee)", "code": "2420", "is_debit": False, "contra": None},
            {"type": "deduction", "name": "Professional Tax", "code": "2430", "is_debit": False, "contra": None},
            {"type": "deduction", "name": "Loan Recovery", "code": "1130", "is_debit": False, "contra": None},
            
            # Employer Contributions - Debit Expense, Credit Liability
            {"type": "employer_contribution", "name": "Provident Fund (Employer)", "code": "6101", "is_debit": True, "contra": "2410"},
            {"type": "employer_contribution", "name": "ESI (Employer)", "code": "6104", "is_debit": True, "contra": "2420"},
            {"type": "employer_contribution", "name": "Gratuity", "code": "6105", "is_debit": True, "contra": "2440"},
            
            # Net Pay - Credit Salary Payable
            {"type": "net_pay", "name": "Net Salary Payable", "code": "2400", "is_debit": False, "contra": None},
        ]
        
        configs = []
        for config_data in payroll_configs:
            account = self.get_account_by_code(config_data["code"], company)
            contra_account = None
            if config_data["contra"]:
                contra_account = self.get_account_by_code(config_data["contra"], company)
            
            config = PayrollAccountConfig(
                company_id=company.id,
                component_type=config_data["type"],
                component_name=config_data["name"],
                account_id=account.id if account else None,
                is_debit=config_data["is_debit"],
                contra_account_id=contra_account.id if contra_account else None,
                is_active=True,
            )
            self.db.add(config)
            configs.append(config)
        
        self.db.commit()
        return configs
    
    def get_account_mapping(
        self, 
        company: Company, 
        mapping_type: AccountMappingType, 
        category: str
    ) -> Optional[AccountMapping]:
        """Get an account mapping by type and category."""
        return self.db.query(AccountMapping).filter(
            AccountMapping.company_id == company.id,
            AccountMapping.mapping_type == mapping_type,
            AccountMapping.category == category,
            AccountMapping.is_active == True
        ).first()
    
    def get_all_account_mappings(self, company: Company) -> List[AccountMapping]:
        """Get all account mappings for a company."""
        return self.db.query(AccountMapping).filter(
            AccountMapping.company_id == company.id
        ).order_by(AccountMapping.mapping_type, AccountMapping.category).all()
    
    def update_account_mapping(
        self, 
        mapping: AccountMapping, 
        debit_account_id: Optional[str] = None, 
        credit_account_id: Optional[str] = None
    ) -> AccountMapping:
        """Update an account mapping."""
        if debit_account_id is not None:
            mapping.debit_account_id = debit_account_id
        if credit_account_id is not None:
            mapping.credit_account_id = credit_account_id
        
        self.db.commit()
        self.db.refresh(mapping)
        return mapping
    
    def reset_account_mappings(self, company: Company) -> List[AccountMapping]:
        """Reset account mappings to defaults."""
        # Delete existing
        self.db.query(AccountMapping).filter(
            AccountMapping.company_id == company.id
        ).delete()
        self.db.commit()
        
        # Re-initialize
        return self.initialize_account_mappings(company)
    
    def get_payroll_account_config(
        self, 
        company: Company, 
        component_name: str = None,
        component_type: str = None,
        salary_component_id: str = None
    ) -> Optional[PayrollAccountConfig]:
        """Get payroll account configuration."""
        query = self.db.query(PayrollAccountConfig).filter(
            PayrollAccountConfig.company_id == company.id,
            PayrollAccountConfig.is_active == True
        )
        
        if salary_component_id:
            query = query.filter(PayrollAccountConfig.salary_component_id == salary_component_id)
        elif component_name:
            query = query.filter(PayrollAccountConfig.component_name == component_name)
        elif component_type:
            query = query.filter(PayrollAccountConfig.component_type == component_type)
        
        return query.first()
    
    def get_all_payroll_account_configs(self, company: Company) -> List[PayrollAccountConfig]:
        """Get all payroll account configurations for a company."""
        return self.db.query(PayrollAccountConfig).filter(
            PayrollAccountConfig.company_id == company.id
        ).order_by(PayrollAccountConfig.component_type, PayrollAccountConfig.component_name).all()
    
    def update_payroll_account_config(
        self,
        config: PayrollAccountConfig,
        account_id: Optional[str] = None,
        contra_account_id: Optional[str] = None
    ) -> PayrollAccountConfig:
        """Update payroll account configuration."""
        if account_id is not None:
            config.account_id = account_id
        if contra_account_id is not None:
            config.contra_account_id = contra_account_id
        
        self.db.commit()
        self.db.refresh(config)
        return config
    
    def create_account(self, company: Company, data: AccountCreate) -> Account:
        """Create a new account."""
        # Validate unique code
        existing = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == data.code
        ).first()
        if existing:
            raise ValueError(f"Account code {data.code} already exists")
        
        # Validate parent if provided
        if data.parent_id:
            parent = self.db.query(Account).filter(
                Account.id == data.parent_id,
                Account.company_id == company.id
            ).first()
            if not parent:
                raise ValueError("Parent account not found")
        
        account = Account(
            company_id=company.id,
            code=data.code,
            name=data.name,
            description=data.description,
            account_type=AccountType(data.account_type.value),
            parent_id=data.parent_id,
            bank_account_id=data.bank_account_id,
            is_system=False,
        )
        
        self.db.add(account)
        self.db.flush()
        
        # If opening balance provided, create opening balance transaction
        if data.opening_balance and data.opening_balance != Decimal("0"):
            self.create_opening_balance_transaction(
                company=company,
                account_id=account.id,
                amount=data.opening_balance,
            )
        
        self.db.commit()
        self.db.refresh(account)
        return account
    
    def update_account(self, account: Account, data: AccountUpdate) -> Account:
        """Update an account."""
        if account.is_system and data.code and data.code != account.code:
            raise ValueError("Cannot change code of system account")
        
        update_data = data.model_dump(exclude_unset=True)
        
        if "code" in update_data:
            existing = self.db.query(Account).filter(
                Account.company_id == account.company_id,
                Account.code == update_data["code"],
                Account.id != account.id
            ).first()
            if existing:
                raise ValueError(f"Account code {update_data['code']} already exists")
        
        for field, value in update_data.items():
            if value is not None:
                setattr(account, field, value)
        
        self.db.commit()
        self.db.refresh(account)
        return account
    
    def get_account(self, account_id: str, company: Company) -> Optional[Account]:
        """Get an account by ID."""
        return self.db.query(Account).filter(
            Account.id == account_id,
            Account.company_id == company.id
        ).first()
    
    def get_account_by_code(self, code: str, company: Company) -> Optional[Account]:
        """Get an account by code."""
        return self.db.query(Account).filter(
            Account.code == code,
            Account.company_id == company.id
        ).first()
    
    def get_accounts(self, company: Company, account_type: Optional[AccountType] = None) -> List[Account]:
        """Get all accounts for a company."""
        query = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.is_active == True
        )
        
        if account_type:
            query = query.filter(Account.account_type == account_type)
        
        return query.order_by(Account.code).all()
    
    def delete_account(self, account: Account) -> bool:
        """Delete an account (only if no transactions)."""
        if account.is_system:
            raise ValueError("Cannot delete system account")
        
        # Check for transactions
        has_entries = self.db.query(TransactionEntry).filter(
            TransactionEntry.account_id == account.id
        ).first()
        if has_entries:
            raise ValueError("Cannot delete account with transactions")
        
        self.db.delete(account)
        self.db.commit()
        return True
    
    # ============== Transaction Operations ==============
    
    def _get_next_transaction_number(self, company: Company) -> str:
        """Get next transaction number for a company."""
        # Get the max transaction number
        result = self.db.query(func.max(Transaction.transaction_number)).filter(
            Transaction.company_id == company.id
        ).scalar()
        
        if result:
            # Extract number and increment
            try:
                num = int(result.replace("JE-", ""))
                return f"JE-{num + 1:06d}"
            except ValueError:
                pass
        
        return "JE-000001"
    
    def create_journal_entry(
        self,
        company: Company,
        data: TransactionCreate,
        auto_post: bool = False
    ) -> Transaction:
        """Create a journal entry (transaction)."""
        # Validate that debits equal credits
        total_debit = sum(e.debit_amount for e in data.entries)
        total_credit = sum(e.credit_amount for e in data.entries)
        
        if total_debit != total_credit:
            raise ValueError(f"Debits ({total_debit}) must equal credits ({total_credit})")
        
        if total_debit == 0:
            raise ValueError("Transaction total cannot be zero")
        
        # Validate accounts exist
        for entry in data.entries:
            account = self.get_account(entry.account_id, company)
            if not account:
                raise ValueError(f"Account {entry.account_id} not found")
        
        # Create transaction
        transaction = Transaction(
            company_id=company.id,
            transaction_number=self._get_next_transaction_number(company),
            transaction_date=data.transaction_date,
            description=data.description,
            reference_type=ReferenceType(data.reference_type.value),
            reference_id=data.reference_id,
            status=TransactionStatus.DRAFT,
            total_debit=total_debit,
            total_credit=total_credit,
        )
        
        self.db.add(transaction)
        self.db.flush()
        
        # Create entries
        for entry_data in data.entries:
            entry = TransactionEntry(
                transaction_id=transaction.id,
                account_id=entry_data.account_id,
                description=entry_data.description,
                debit_amount=entry_data.debit_amount,
                credit_amount=entry_data.credit_amount,
            )
            self.db.add(entry)
        
        self.db.commit()
        self.db.refresh(transaction)
        
        if auto_post:
            self.post_transaction(transaction)
        
        return transaction
    
    def post_transaction(self, transaction: Transaction) -> Transaction:
        """Post a transaction. Balances are calculated from transactions, not stored."""
        if transaction.status != TransactionStatus.DRAFT:
            raise ValueError("Only draft transactions can be posted")
        
        # No need to update account balances - they are calculated from transaction entries
        transaction.status = TransactionStatus.POSTED
        self.db.commit()
        self.db.refresh(transaction)
        return transaction
    
    def reverse_transaction(self, transaction: Transaction, reason: str = None) -> Transaction:
        """Create a reversing entry for a transaction."""
        if transaction.status != TransactionStatus.POSTED:
            raise ValueError("Only posted transactions can be reversed")
        
        if transaction.reversed_by_id:
            raise ValueError("Transaction already reversed")
        
        # Create reversing entries (swap debits and credits)
        entries = []
        for entry in transaction.entries:
            entries.append(TransactionEntryCreate(
                account_id=entry.account_id,
                description=f"Reversal: {entry.description or ''}",
                debit_amount=entry.credit_amount,
                credit_amount=entry.debit_amount,
            ))
        
        reversal_data = TransactionCreate(
            transaction_date=datetime.utcnow(),
            description=f"Reversal of {transaction.transaction_number}" + (f": {reason}" if reason else ""),
            reference_type=transaction.reference_type,
            reference_id=transaction.reference_id,
            entries=entries,
        )
        
        reversal = self.create_journal_entry(
            transaction.company,
            reversal_data,
            auto_post=True
        )
        
        # Link transactions
        transaction.status = TransactionStatus.REVERSED
        transaction.reversed_by_id = reversal.id
        reversal.reverses_id = transaction.id
        
        self.db.commit()
        return reversal
    
    def get_transaction(self, transaction_id: str, company: Company) -> Optional[Transaction]:
        """Get a transaction by ID."""
        return self.db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.company_id == company.id
        ).first()
    
    def get_transactions(
        self,
        company: Company,
        page: int = 1,
        page_size: int = 20,
        account_id: Optional[str] = None,
        reference_type: Optional[ReferenceType] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        status: Optional[TransactionStatus] = None,
        is_reconciled: Optional[bool] = None,
        limit: Optional[int] = None,
    ) -> Tuple[List[Transaction], int]:
        """Get transactions with filters."""
        query = self.db.query(Transaction).filter(Transaction.company_id == company.id)
        
        if account_id:
            query = query.join(TransactionEntry).filter(TransactionEntry.account_id == account_id)
        
        if reference_type:
            query = query.filter(Transaction.reference_type == reference_type)
        
        if from_date:
            query = query.filter(Transaction.transaction_date >= from_date)
        
        if to_date:
            query = query.filter(Transaction.transaction_date <= to_date)
        
        if status:
            query = query.filter(Transaction.status == status)
        
        if is_reconciled is not None:
            query = query.filter(Transaction.is_reconciled == is_reconciled)
        
        total = query.count()
        
        # Support limit parameter for simple queries
        if limit:
            transactions = query.order_by(Transaction.transaction_date.desc()).limit(limit).all()
        else:
            offset = (page - 1) * page_size
            transactions = query.order_by(Transaction.transaction_date.desc()).offset(offset).limit(page_size).all()
        
        return transactions, total
    
    def reconcile_transaction(self, transaction: Transaction) -> Transaction:
        """Mark a transaction as reconciled."""
        transaction.is_reconciled = True
        transaction.reconciled_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(transaction)
        return transaction
    
    # ============== Account Ledger Operations ==============
    
    def get_account_ledger(
        self,
        account: Account,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> dict:
        """Get account ledger with running balance."""
        query = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == TransactionStatus.POSTED
        )
        
        if from_date:
            query = query.filter(Transaction.transaction_date >= from_date)
        
        if to_date:
            query = query.filter(Transaction.transaction_date <= to_date)
        
        entries = query.order_by(Transaction.transaction_date).all()
        
        # Calculate opening balance (before from_date)
        if from_date:
            # Get balance up to the day before from_date
            opening_balance = self.get_account_balance(
                account.id,
                datetime.combine(from_date, datetime.min.time()) - timedelta(days=1)
            )
        else:
            # No from_date means we want all transactions, so opening is 0
            opening_balance = Decimal("0")
        
        # Build ledger with running balance
        ledger_entries = []
        running_balance = opening_balance
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        
        for entry in entries:
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                running_balance += entry.debit_amount - entry.credit_amount
            else:
                running_balance += entry.credit_amount - entry.debit_amount
            
            total_debit += entry.debit_amount
            total_credit += entry.credit_amount
            
            ledger_entries.append({
                "transaction_id": entry.transaction.id,
                "transaction_number": entry.transaction.transaction_number,
                "transaction_date": entry.transaction.transaction_date,
                "description": entry.description or entry.transaction.description,
                "debit_amount": entry.debit_amount,
                "credit_amount": entry.credit_amount,
                "balance": running_balance,
                "reference_type": entry.transaction.reference_type,
                "reference_id": entry.transaction.reference_id,
                "is_reconciled": entry.transaction.is_reconciled,
            })
        
        return {
            "account": account,
            "entries": ledger_entries,
            "opening_balance": opening_balance,
            "closing_balance": running_balance,
            "total_debit": total_debit,
            "total_credit": total_credit,
        }
    
    # ============== Auto Journal Entries ==============
    
    def create_invoice_entries(self, invoice: Invoice) -> Optional[Transaction]:
        """Create journal entries when an invoice is finalized."""
        company = invoice.company
        
        # Initialize chart of accounts if needed
        self.initialize_chart_of_accounts(company)
        
        # Get required accounts
        ar_account = self.get_account_by_code("1100", company)  # Accounts Receivable
        sales_account = self.get_account_by_code("4000", company)  # Sales Revenue
        cgst_account = self.get_account_by_code("2110", company)  # CGST Payable
        sgst_account = self.get_account_by_code("2120", company)  # SGST Payable
        igst_account = self.get_account_by_code("2130", company)  # IGST Payable
        
        if not all([ar_account, sales_account]):
            raise ValueError("Required accounts not found. Please initialize chart of accounts.")
        
        entries = []
        
        # Debit: Accounts Receivable for total amount
        entries.append(TransactionEntryCreate(
            account_id=ar_account.id,
            description=f"Invoice {invoice.invoice_number} - {invoice.customer.name if invoice.customer else 'Walk-in'}",
            debit_amount=invoice.total_amount,
            credit_amount=Decimal("0"),
        ))
        
        # Credit: Sales Revenue for subtotal (taxable amount)
        entries.append(TransactionEntryCreate(
            account_id=sales_account.id,
            description=f"Sales - Invoice {invoice.invoice_number}",
            debit_amount=Decimal("0"),
            credit_amount=invoice.subtotal,
        ))
        
        # Credit: GST accounts for tax amounts
        if invoice.cgst_amount > 0 and cgst_account:
            entries.append(TransactionEntryCreate(
                account_id=cgst_account.id,
                description=f"CGST - Invoice {invoice.invoice_number}",
                debit_amount=Decimal("0"),
                credit_amount=invoice.cgst_amount,
            ))
        
        if invoice.sgst_amount > 0 and sgst_account:
            entries.append(TransactionEntryCreate(
                account_id=sgst_account.id,
                description=f"SGST - Invoice {invoice.invoice_number}",
                debit_amount=Decimal("0"),
                credit_amount=invoice.sgst_amount,
            ))
        
        if invoice.igst_amount > 0 and igst_account:
            entries.append(TransactionEntryCreate(
                account_id=igst_account.id,
                description=f"IGST - Invoice {invoice.invoice_number}",
                debit_amount=Decimal("0"),
                credit_amount=invoice.igst_amount,
            ))
        
        # Create the transaction
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=invoice.invoice_date,
            description=f"Invoice {invoice.invoice_number} - {invoice.customer.name if invoice.customer else 'Walk-in Customer'}",
            reference_type=SchemaReferenceType.INVOICE,
            reference_id=invoice.id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    def create_payment_entries(self, payment: Payment, bank_account: Optional[BankAccount] = None) -> Optional[Transaction]:
        """Create journal entries when a payment is recorded."""
        invoice = payment.invoice
        company = invoice.company
        
        # Get required accounts
        ar_account = self.get_account_by_code("1100", company)  # Accounts Receivable
        
        # Find bank/cash account
        if bank_account:
            # Find linked account
            bank_acc = self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.bank_account_id == bank_account.id
            ).first()
            
            if not bank_acc:
                # Use default bank account
                bank_acc = self.get_account_by_code("1010", company)
        elif payment.payment_mode.value == "cash":
            bank_acc = self.get_account_by_code("1000", company)  # Cash
        else:
            bank_acc = self.get_account_by_code("1010", company)  # Bank Accounts
        
        if not all([ar_account, bank_acc]):
            raise ValueError("Required accounts not found")
        
        entries = [
            # Debit: Bank/Cash Account
            TransactionEntryCreate(
                account_id=bank_acc.id,
                description=f"Payment for Invoice {invoice.invoice_number}",
                debit_amount=payment.amount,
                credit_amount=Decimal("0"),
            ),
            # Credit: Accounts Receivable
            TransactionEntryCreate(
                account_id=ar_account.id,
                description=f"Payment received - Invoice {invoice.invoice_number}",
                debit_amount=Decimal("0"),
                credit_amount=payment.amount,
            ),
        ]
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=payment.payment_date,
            description=f"Payment for Invoice {invoice.invoice_number} via {payment.payment_mode.value}",
            reference_type=SchemaReferenceType.PAYMENT,
            reference_id=payment.id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    def link_bank_account_to_account(self, bank_account: BankAccount, account: Account) -> Account:
        """Link a bank account to a chart of accounts entry."""
        account.bank_account_id = bank_account.id
        self.db.commit()
        self.db.refresh(account)
        return account
    
    def create_bank_sub_account(self, company: Company, bank_account: BankAccount) -> Account:
        """Create a sub-account for a specific bank account."""
        parent = self.get_account_by_code("1010", company)  # Bank Accounts
        if not parent:
            self.initialize_chart_of_accounts(company)
            parent = self.get_account_by_code("1010", company)
        
        # Generate a unique code
        code = f"1010-{bank_account.account_number[-4:]}"
        
        # Check if already exists
        existing = self.get_account_by_code(code, company)
        if existing:
            return existing
        
        account = Account(
            company_id=company.id,
            code=code,
            name=f"{bank_account.bank_name} - {bank_account.account_number[-4:]}",
            account_type=AccountType.ASSET,
            parent_id=parent.id if parent else None,
            bank_account_id=bank_account.id,
            is_system=False,
        )
        
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account
    
    # ============== Stock/Inventory Accounting ==============
    
    def create_stock_reduction_entries(
        self, 
        invoice: Invoice, 
        stock_entries: list
    ) -> Optional[Transaction]:
        """
        Create COGS journal entries when stock is reduced (invoice paid).
        
        Dr: Cost of Goods Sold (5000) - cost value of goods sold
        Cr: Inventory (1200) - reduce inventory asset
        
        Args:
            invoice: The invoice being paid
            stock_entries: List of StockEntry objects created during stock reduction
        
        Returns:
            Transaction if created, None if no entries needed
        """
        from app.database.models import Product
        
        company = invoice.company
        
        # Initialize chart of accounts if needed
        self.initialize_chart_of_accounts(company)
        
        # Get required accounts
        cogs_account = self.get_account_by_code("5000", company)  # Cost of Goods Sold
        inventory_account = self.get_account_by_code("1200", company)  # Inventory
        
        if not all([cogs_account, inventory_account]):
            print(f"Warning: COGS or Inventory account not found for company {company.id}")
            return None
        
        # Calculate total cost value from stock entries
        total_cost = Decimal("0")
        
        for entry in stock_entries:
            # Get product for cost calculation
            product = self.db.query(Product).filter(Product.id == entry.product_id).first()
            if not product:
                continue
            
            # Use standard_cost if available, otherwise fall back to unit_price
            cost_per_unit = product.standard_cost or product.unit_price or Decimal("0")
            
            # Stock entries have negative quantity for reductions, use absolute value
            qty = abs(entry.quantity)
            item_cost = cost_per_unit * qty
            total_cost += item_cost
        
        if total_cost <= 0:
            return None
        
        # Create journal entries
        entries = [
            # Debit: COGS (expense increases)
            TransactionEntryCreate(
                account_id=cogs_account.id,
                description=f"Cost of goods sold - Invoice {invoice.invoice_number}",
                debit_amount=self._round_amount(total_cost),
                credit_amount=Decimal("0"),
            ),
            # Credit: Inventory (asset decreases)
            TransactionEntryCreate(
                account_id=inventory_account.id,
                description=f"Inventory reduction - Invoice {invoice.invoice_number}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(total_cost),
            ),
        ]
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=invoice.invoice_date,
            description=f"COGS for Invoice {invoice.invoice_number} - Stock Reduction",
            reference_type=SchemaReferenceType.INVOICE,
            reference_id=invoice.id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    def reverse_stock_reduction_entries(
        self, 
        invoice: Invoice,
        reason: str = None
    ) -> Optional[Transaction]:
        """
        Reverse COGS entries when stock is restored (invoice cancelled/refunded).
        
        Dr: Inventory (1200) - restore inventory asset
        Cr: Cost of Goods Sold (5000) - reverse COGS
        
        Args:
            invoice: The invoice being cancelled/refunded
            reason: Optional reason for the reversal
        
        Returns:
            Transaction if created, None if no entries needed
        """
        from app.database.models import Product
        
        company = invoice.company
        
        # Get required accounts
        cogs_account = self.get_account_by_code("5000", company)
        inventory_account = self.get_account_by_code("1200", company)
        
        if not all([cogs_account, inventory_account]):
            return None
        
        # Calculate total cost value from invoice items that had stock reduced
        total_cost = Decimal("0")
        
        for item in invoice.items:
            if not item.stock_reduced or not item.warehouse_allocation:
                continue
            
            # Get product for cost calculation
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                continue
            
            # Use standard_cost if available, otherwise fall back to unit_price
            cost_per_unit = product.standard_cost or product.unit_price or Decimal("0")
            item_cost = cost_per_unit * item.quantity
            total_cost += item_cost
        
        if total_cost <= 0:
            return None
        
        # Create reversal journal entries
        reason_text = f" - {reason}" if reason else ""
        entries = [
            # Debit: Inventory (asset increases - restore stock)
            TransactionEntryCreate(
                account_id=inventory_account.id,
                description=f"Inventory restored - Invoice {invoice.invoice_number}{reason_text}",
                debit_amount=self._round_amount(total_cost),
                credit_amount=Decimal("0"),
            ),
            # Credit: COGS (expense decreases - reverse COGS)
            TransactionEntryCreate(
                account_id=cogs_account.id,
                description=f"COGS reversal - Invoice {invoice.invoice_number}{reason_text}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(total_cost),
            ),
        ]
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=datetime.utcnow(),
            description=f"COGS Reversal for Invoice {invoice.invoice_number} - {invoice.status.value.title()}{reason_text}",
            reference_type=SchemaReferenceType.INVOICE,
            reference_id=invoice.id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    # ============== Cheque Accounting Entries ==============
    
    def create_cheque_receive_entries(
        self,
        company: Company,
        cheque_id: str,
        amount: Decimal,
        cheque_number: str,
        drawer_name: str,
        cheque_date: datetime,
    ) -> Optional[Transaction]:
        """
        Create journal entries when receiving a cheque from a customer.
        
        Dr. Cheques in Hand (1120) - We have the cheque as an asset
        Cr. Accounts Receivable (1100) - Customer's debt is reduced
        
        Args:
            company: The company receiving the cheque
            cheque_id: ID of the cheque record
            amount: Cheque amount
            cheque_number: Cheque number for reference
            drawer_name: Name of the person who issued the cheque
            cheque_date: Date on the cheque
        
        Returns:
            Transaction if created successfully
        """
        # Initialize chart of accounts if needed
        self.initialize_chart_of_accounts(company)
        
        # Get required accounts
        cheques_in_hand = self.get_account_by_code("1120", company)  # Cheques in Hand
        ar_account = self.get_account_by_code("1100", company)  # Accounts Receivable
        
        if not cheques_in_hand or not ar_account:
            raise ValueError("Required accounts not found. Please initialize chart of accounts.")
        
        entries = [
            # Debit: Cheques in Hand (asset increases)
            TransactionEntryCreate(
                account_id=cheques_in_hand.id,
                description=f"Cheque #{cheque_number} received from {drawer_name}",
                debit_amount=self._round_amount(amount),
                credit_amount=Decimal("0"),
            ),
            # Credit: Accounts Receivable (asset decreases - customer owes less)
            TransactionEntryCreate(
                account_id=ar_account.id,
                description=f"Cheque #{cheque_number} from {drawer_name}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(amount),
            ),
        ]
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=cheque_date,
            description=f"Cheque #{cheque_number} received from {drawer_name}",
            reference_type=SchemaReferenceType.CHEQUE,
            reference_id=cheque_id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    def create_cheque_deposit_entries(
        self,
        company: Company,
        cheque_id: str,
        amount: Decimal,
        cheque_number: str,
        drawer_name: str,
        bank_account: Optional[BankAccount] = None,
        deposit_date: datetime = None,
    ) -> Optional[Transaction]:
        """
        Create journal entries when depositing a received cheque to bank.
        
        Dr. Bank (1010) - Money coming into bank
        Cr. Cheques in Hand (1120) - Cheque asset is converted to bank balance
        
        Args:
            company: The company depositing the cheque
            cheque_id: ID of the cheque record
            amount: Cheque amount
            cheque_number: Cheque number for reference
            drawer_name: Name of drawer
            bank_account: Optional specific bank account
            deposit_date: Date of deposit
        
        Returns:
            Transaction if created successfully
        """
        # Get required accounts
        cheques_in_hand = self.get_account_by_code("1120", company)
        
        # Find bank account
        if bank_account:
            bank_acc = self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.bank_account_id == bank_account.id
            ).first()
            if not bank_acc:
                bank_acc = self.get_account_by_code("1010", company)
        else:
            bank_acc = self.get_account_by_code("1010", company)
        
        if not cheques_in_hand or not bank_acc:
            raise ValueError("Required accounts not found")
        
        entries = [
            # Debit: Bank (asset increases)
            TransactionEntryCreate(
                account_id=bank_acc.id,
                description=f"Cheque #{cheque_number} deposited - {drawer_name}",
                debit_amount=self._round_amount(amount),
                credit_amount=Decimal("0"),
            ),
            # Credit: Cheques in Hand (asset decreases)
            TransactionEntryCreate(
                account_id=cheques_in_hand.id,
                description=f"Cheque #{cheque_number} deposited to bank",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(amount),
            ),
        ]
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=deposit_date or datetime.utcnow(),
            description=f"Cheque #{cheque_number} deposited to bank - {drawer_name}",
            reference_type=SchemaReferenceType.CHEQUE,
            reference_id=cheque_id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    def create_cheque_bounce_entries(
        self,
        company: Company,
        cheque_id: str,
        amount: Decimal,
        cheque_number: str,
        drawer_name: str,
        bounce_charges: Decimal = Decimal("0"),
        bounce_date: datetime = None,
        bank_account: Optional[BankAccount] = None,
    ) -> Optional[Transaction]:
        """
        Create journal entries when a deposited cheque bounces.
        
        Dr. Accounts Receivable (1100) - Customer owes us again
        Cr. Bank (1010) - Money reversed from bank
        
        Optional: Dr. Bank Charges (6600), Cr. Bank (1010) for bounce charges
        
        Args:
            company: The company
            cheque_id: ID of the cheque record
            amount: Cheque amount
            cheque_number: Cheque number
            drawer_name: Name of drawer
            bounce_charges: Bank charges for bounced cheque
            bounce_date: Date of bounce
            bank_account: Optional specific bank account
        
        Returns:
            Transaction if created successfully
        """
        ar_account = self.get_account_by_code("1100", company)
        
        # Find bank account
        if bank_account:
            bank_acc = self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.bank_account_id == bank_account.id
            ).first()
            if not bank_acc:
                bank_acc = self.get_account_by_code("1010", company)
        else:
            bank_acc = self.get_account_by_code("1010", company)
        
        if not ar_account or not bank_acc:
            raise ValueError("Required accounts not found")
        
        entries = [
            # Debit: Accounts Receivable (customer owes us again)
            TransactionEntryCreate(
                account_id=ar_account.id,
                description=f"Cheque #{cheque_number} bounced - {drawer_name}",
                debit_amount=self._round_amount(amount),
                credit_amount=Decimal("0"),
            ),
            # Credit: Bank (reverse the deposit)
            TransactionEntryCreate(
                account_id=bank_acc.id,
                description=f"Cheque #{cheque_number} bounced",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(amount),
            ),
        ]
        
        # Add bounce charges if any
        if bounce_charges > 0:
            bank_charges_acc = self.get_account_by_code("6600", company)
            if bank_charges_acc:
                entries.append(TransactionEntryCreate(
                    account_id=bank_charges_acc.id,
                    description=f"Bounce charges for cheque #{cheque_number}",
                    debit_amount=self._round_amount(bounce_charges),
                    credit_amount=Decimal("0"),
                ))
                entries.append(TransactionEntryCreate(
                    account_id=bank_acc.id,
                    description=f"Bounce charges deducted",
                    debit_amount=Decimal("0"),
                    credit_amount=self._round_amount(bounce_charges),
                ))
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=bounce_date or datetime.utcnow(),
            description=f"Cheque #{cheque_number} bounced - {drawer_name}",
            reference_type=SchemaReferenceType.CHEQUE,
            reference_id=cheque_id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    def create_cheque_issue_entries(
        self,
        company: Company,
        cheque_id: str,
        amount: Decimal,
        cheque_number: str,
        payee_name: str,
        cheque_date: datetime,
        bank_account: Optional[BankAccount] = None,
    ) -> Optional[Transaction]:
        """
        Create journal entries when issuing a cheque to a vendor.
        
        Dr. Accounts Payable (2000) - We owe less to vendor
        Cr. Bank (1010) - Money going out of bank
        
        Args:
            company: The company issuing the cheque
            cheque_id: ID of the cheque record
            amount: Cheque amount
            cheque_number: Cheque number
            payee_name: Name of the payee
            cheque_date: Date on the cheque
            bank_account: Optional specific bank account
        
        Returns:
            Transaction if created successfully
        """
        self.initialize_chart_of_accounts(company)
        
        ap_account = self.get_account_by_code("2000", company)  # Accounts Payable
        
        # Find bank account
        if bank_account:
            bank_acc = self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.bank_account_id == bank_account.id
            ).first()
            if not bank_acc:
                bank_acc = self.get_account_by_code("1010", company)
        else:
            bank_acc = self.get_account_by_code("1010", company)
        
        if not ap_account or not bank_acc:
            raise ValueError("Required accounts not found")
        
        entries = [
            # Debit: Accounts Payable (liability decreases - we owe less)
            TransactionEntryCreate(
                account_id=ap_account.id,
                description=f"Cheque #{cheque_number} issued to {payee_name}",
                debit_amount=self._round_amount(amount),
                credit_amount=Decimal("0"),
            ),
            # Credit: Bank (asset decreases)
            TransactionEntryCreate(
                account_id=bank_acc.id,
                description=f"Cheque #{cheque_number} to {payee_name}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(amount),
            ),
        ]
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=cheque_date,
            description=f"Cheque #{cheque_number} issued to {payee_name}",
            reference_type=SchemaReferenceType.CHEQUE,
            reference_id=cheque_id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)
    
    def create_cheque_stop_entries(
        self,
        company: Company,
        cheque_id: str,
        amount: Decimal,
        cheque_number: str,
        payee_name: str,
        stop_date: datetime = None,
        bank_account: Optional[BankAccount] = None,
    ) -> Optional[Transaction]:
        """
        Create journal entries when stopping payment on an issued cheque.
        This reverses the original issue entry.
        
        Dr. Bank (1010) - Money back in bank
        Cr. Accounts Payable (2000) - We owe the vendor again
        
        Args:
            company: The company
            cheque_id: ID of the cheque record
            amount: Cheque amount
            cheque_number: Cheque number
            payee_name: Name of the payee
            stop_date: Date of stop payment
            bank_account: Optional specific bank account
        
        Returns:
            Transaction if created successfully
        """
        ap_account = self.get_account_by_code("2000", company)
        
        # Find bank account
        if bank_account:
            bank_acc = self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.bank_account_id == bank_account.id
            ).first()
            if not bank_acc:
                bank_acc = self.get_account_by_code("1010", company)
        else:
            bank_acc = self.get_account_by_code("1010", company)
        
        if not ap_account or not bank_acc:
            raise ValueError("Required accounts not found")
        
        entries = [
            # Debit: Bank (asset increases - money back)
            TransactionEntryCreate(
                account_id=bank_acc.id,
                description=f"Stop payment - Cheque #{cheque_number} to {payee_name}",
                debit_amount=self._round_amount(amount),
                credit_amount=Decimal("0"),
            ),
            # Credit: Accounts Payable (liability increases - we owe again)
            TransactionEntryCreate(
                account_id=ap_account.id,
                description=f"Stop payment reversal - Cheque #{cheque_number}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(amount),
            ),
        ]
        
        from app.schemas.accounting import ReferenceType as SchemaReferenceType
        transaction_data = TransactionCreate(
            transaction_date=stop_date or datetime.utcnow(),
            description=f"Stop payment on Cheque #{cheque_number} to {payee_name}",
            reference_type=SchemaReferenceType.CHEQUE,
            reference_id=cheque_id,
            entries=entries,
        )
        
        return self.create_journal_entry(company, transaction_data, auto_post=True)