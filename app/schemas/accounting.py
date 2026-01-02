"""Pydantic schemas for accounting module."""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class AccountType(str, Enum):
    """Account type enumeration."""
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class TransactionStatus(str, Enum):
    """Transaction status enumeration."""
    DRAFT = "draft"
    POSTED = "posted"
    REVERSED = "reversed"


class ReferenceType(str, Enum):
    """Reference type for transactions."""
    INVOICE = "invoice"
    PAYMENT = "payment"
    MANUAL = "manual"
    BANK_IMPORT = "bank_import"
    OPENING_BALANCE = "opening_balance"
    TRANSFER = "transfer"
    CHEQUE = "cheque"


class BankImportStatus(str, Enum):
    """Bank import status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class BankImportRowStatus(str, Enum):
    """Bank import row status."""
    PENDING = "pending"
    MATCHED = "matched"
    CREATED = "created"
    IGNORED = "ignored"


# ============== Account Schemas ==============

class AccountCreate(BaseModel):
    """Schema for creating an account."""
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    account_type: AccountType
    parent_id: Optional[str] = None
    opening_balance: Decimal = Decimal("0")
    bank_account_id: Optional[str] = None


class AccountUpdate(BaseModel):
    """Schema for updating an account."""
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[str] = None
    opening_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None
    bank_account_id: Optional[str] = None


class AccountResponse(BaseModel):
    """Schema for account response."""
    id: str
    company_id: str
    code: str
    name: str
    description: Optional[str] = None
    account_type: AccountType
    parent_id: Optional[str] = None
    current_balance: Decimal = Decimal("0")  # Calculated from transaction entries
    is_system: bool
    is_active: bool
    bank_account_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccountWithChildren(AccountResponse):
    """Account with nested children."""
    children: List["AccountWithChildren"] = []


class AccountLedgerEntry(BaseModel):
    """Single entry in account ledger."""
    transaction_id: str
    transaction_number: str
    transaction_date: datetime
    description: Optional[str] = None
    debit_amount: Decimal
    credit_amount: Decimal
    balance: Decimal
    reference_type: ReferenceType
    reference_id: Optional[str] = None
    is_reconciled: bool


class AccountLedgerResponse(BaseModel):
    """Account ledger response."""
    account: AccountResponse
    entries: List[AccountLedgerEntry]
    opening_balance: Decimal
    closing_balance: Decimal
    total_debit: Decimal
    total_credit: Decimal


# ============== Transaction Schemas ==============

class TransactionEntryCreate(BaseModel):
    """Schema for creating a transaction entry."""
    account_id: str
    description: Optional[str] = None
    debit_amount: Decimal = Decimal("0")
    credit_amount: Decimal = Decimal("0")

    @field_validator("debit_amount", "credit_amount")
    @classmethod
    def validate_amounts(cls, v):
        if v < 0:
            raise ValueError("Amount cannot be negative")
        return v


class TransactionEntryResponse(BaseModel):
    """Schema for transaction entry response."""
    id: str
    transaction_id: str
    account_id: str
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    description: Optional[str] = None
    debit_amount: Decimal
    credit_amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionCreate(BaseModel):
    """Schema for creating a transaction (journal entry)."""
    transaction_date: datetime
    description: Optional[str] = None
    reference_type: ReferenceType = ReferenceType.MANUAL
    reference_id: Optional[str] = None
    entries: List[TransactionEntryCreate]

    @field_validator("entries")
    @classmethod
    def validate_entries(cls, v):
        if len(v) < 2:
            raise ValueError("Transaction must have at least 2 entries")
        
        total_debit = sum(e.debit_amount for e in v)
        total_credit = sum(e.credit_amount for e in v)
        
        if total_debit != total_credit:
            raise ValueError(f"Debits ({total_debit}) must equal credits ({total_credit})")
        
        if total_debit == 0:
            raise ValueError("Transaction total cannot be zero")
        
        return v


class TransactionResponse(BaseModel):
    """Schema for transaction response."""
    id: str
    company_id: str
    transaction_number: str
    transaction_date: datetime
    description: Optional[str] = None
    reference_type: ReferenceType
    reference_id: Optional[str] = None
    status: TransactionStatus
    is_reconciled: bool
    reconciled_at: Optional[datetime] = None
    total_debit: Decimal
    total_credit: Decimal
    reversed_by_id: Optional[str] = None
    reverses_id: Optional[str] = None
    entries: List[TransactionEntryResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    """Schema for transaction list response."""
    transactions: List[TransactionResponse]
    total: int
    page: int
    page_size: int


# ============== Bank Import Schemas ==============

class BankImportCreate(BaseModel):
    """Schema for creating a bank import."""
    bank_account_id: Optional[str] = None
    bank_name: Optional[str] = None  # Auto-detected if not provided


class BankImportRowResponse(BaseModel):
    """Schema for bank import row response."""
    id: str
    import_id: str
    row_number: int
    transaction_date: Optional[datetime] = None
    value_date: Optional[datetime] = None
    description: Optional[str] = None
    reference_number: Optional[str] = None
    debit_amount: Decimal
    credit_amount: Decimal
    balance: Optional[Decimal] = None
    status: BankImportRowStatus
    transaction_id: Optional[str] = None
    mapped_account_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BankImportResponse(BaseModel):
    """Schema for bank import response."""
    id: str
    company_id: str
    bank_account_id: Optional[str] = None
    file_name: str
    bank_name: Optional[str] = None
    status: BankImportStatus
    total_rows: int
    processed_rows: int
    matched_rows: int
    created_rows: int
    ignored_rows: int
    error_message: Optional[str] = None
    import_date: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BankImportDetailResponse(BankImportResponse):
    """Bank import with rows."""
    rows: List[BankImportRowResponse] = []


class BankImportRowMapping(BaseModel):
    """Schema for mapping a bank import row to an account."""
    row_id: str
    account_id: str
    action: str = "create"  # "create", "match", "ignore"
    transaction_id: Optional[str] = None  # For matching existing


class BankImportProcessRequest(BaseModel):
    """Schema for processing bank import rows."""
    mappings: List[BankImportRowMapping]


# ============== Report Schemas ==============

class TrialBalanceEntry(BaseModel):
    """Single entry in trial balance."""
    account_id: str
    account_code: str
    account_name: str
    account_type: AccountType
    debit_balance: Decimal
    credit_balance: Decimal


class TrialBalanceResponse(BaseModel):
    """Trial balance report response."""
    as_of_date: datetime
    entries: List[TrialBalanceEntry]
    total_debit: Decimal
    total_credit: Decimal
    is_balanced: bool


class ProfitLossSection(BaseModel):
    """Section in P&L report."""
    name: str
    accounts: List[dict]  # {account_id, account_name, amount}
    total: Decimal


class ProfitLossResponse(BaseModel):
    """Profit & Loss report response."""
    from_date: datetime
    to_date: datetime
    revenue: ProfitLossSection
    expenses: ProfitLossSection
    gross_profit: Decimal
    net_profit: Decimal


class BalanceSheetSection(BaseModel):
    """Section in Balance Sheet."""
    name: str
    accounts: List[dict]  # {account_id, account_name, amount}
    total: Decimal


class BalanceSheetResponse(BaseModel):
    """Balance Sheet report response."""
    as_of_date: datetime
    assets: BalanceSheetSection
    liabilities: BalanceSheetSection
    equity: BalanceSheetSection
    total_assets: Decimal
    total_liabilities_equity: Decimal
    is_balanced: bool


class CashFlowEntry(BaseModel):
    """Cash flow entry."""
    description: str
    amount: Decimal


class CashFlowSection(BaseModel):
    """Section in Cash Flow statement."""
    name: str
    entries: List[CashFlowEntry]
    total: Decimal


class CashFlowResponse(BaseModel):
    """Cash Flow statement response."""
    from_date: datetime
    to_date: datetime
    operating_activities: CashFlowSection
    investing_activities: CashFlowSection
    financing_activities: CashFlowSection
    net_cash_change: Decimal
    opening_cash: Decimal
    closing_cash: Decimal


# ============== Default Chart of Accounts ==============

DEFAULT_CHART_OF_ACCOUNTS = [
    # Assets (1xxx)
    {"code": "1000", "name": "Cash", "type": AccountType.ASSET, "is_system": True},
    {"code": "1010", "name": "Bank Accounts", "type": AccountType.ASSET, "is_system": True},
    {"code": "1100", "name": "Accounts Receivable", "type": AccountType.ASSET, "is_system": True},
    {"code": "1120", "name": "Cheques in Hand", "type": AccountType.ASSET, "is_system": True},
    {"code": "1200", "name": "Inventory", "type": AccountType.ASSET, "is_system": False},
    {"code": "1300", "name": "Prepaid Expenses", "type": AccountType.ASSET, "is_system": False},
    {"code": "1500", "name": "Fixed Assets", "type": AccountType.ASSET, "is_system": False},
    
    # Liabilities (2xxx)
    {"code": "2000", "name": "Accounts Payable", "type": AccountType.LIABILITY, "is_system": True},
    {"code": "2100", "name": "GST Payable", "type": AccountType.LIABILITY, "is_system": True},
    {"code": "2110", "name": "CGST Payable", "type": AccountType.LIABILITY, "is_system": True, "parent": "2100"},
    {"code": "2120", "name": "SGST Payable", "type": AccountType.LIABILITY, "is_system": True, "parent": "2100"},
    {"code": "2130", "name": "IGST Payable", "type": AccountType.LIABILITY, "is_system": True, "parent": "2100"},
    {"code": "2200", "name": "TDS Payable", "type": AccountType.LIABILITY, "is_system": False},
    {"code": "2300", "name": "Loans Payable", "type": AccountType.LIABILITY, "is_system": False},
    
    # Equity (3xxx)
    {"code": "3000", "name": "Owner's Equity", "type": AccountType.EQUITY, "is_system": True},
    {"code": "3100", "name": "Retained Earnings", "type": AccountType.EQUITY, "is_system": True},
    {"code": "3200", "name": "Owner's Drawings", "type": AccountType.EQUITY, "is_system": False},
    
    # Revenue (4xxx)
    {"code": "4000", "name": "Sales Revenue", "type": AccountType.REVENUE, "is_system": True},
    {"code": "4100", "name": "Service Revenue", "type": AccountType.REVENUE, "is_system": True},
    {"code": "4200", "name": "Interest Income", "type": AccountType.REVENUE, "is_system": False},
    {"code": "4300", "name": "Other Income", "type": AccountType.REVENUE, "is_system": False},
    
    # Expenses (5xxx - COGS, 6xxx - Operating)
    {"code": "5000", "name": "Cost of Goods Sold", "type": AccountType.EXPENSE, "is_system": True},
    {"code": "5100", "name": "Purchases", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6000", "name": "Operating Expenses", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6100", "name": "Salaries & Wages", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6200", "name": "Rent Expense", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6300", "name": "Utilities", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6400", "name": "Office Supplies", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6500", "name": "Professional Fees", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6600", "name": "Bank Charges", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6700", "name": "Depreciation", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6800", "name": "Insurance", "type": AccountType.EXPENSE, "is_system": False},
    {"code": "6900", "name": "Miscellaneous Expenses", "type": AccountType.EXPENSE, "is_system": False},
]
