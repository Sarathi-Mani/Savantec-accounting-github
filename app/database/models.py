"""SQLAlchemy database models for GST Invoice application."""
from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Numeric,
    Boolean,
    ForeignKey,
    Enum,
    JSON,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database.connection import Base
import uuid


discount_type_enum = Enum('percentage', 'fixed', name='discount_type_enum', create_type=False)

def generate_uuid():
    """Generate a UUID string."""
    return str(uuid.uuid4())


class InvoiceStatus(str, PyEnum):
    """Invoice status enumeration."""
    DRAFT = "draft"
    PENDING = "pending"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    VOID = "void"
    WRITE_OFF = "write_off"


class InvoiceType(str, PyEnum):
    """Invoice type enumeration for GST."""
    B2B = "b2b"  # Business to Business
    B2C = "b2c"  # Business to Consumer
    B2CL = "b2cl"  # B2C Large (>2.5L)
    EXPORT = "export"
    SEZ = "sez"  # Special Economic Zone
    DEEMED_EXPORT = "deemed_export"


class GSTRate(str, PyEnum):
    """GST rate enumeration."""
    EXEMPT = "0"
    GST_5 = "5"
    GST_12 = "12"
    GST_18 = "18"
    GST_28 = "28"


class PaymentMode(str, PyEnum):
    """Payment mode enumeration."""
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    CHEQUE = "cheque"
    CARD = "card"
    OTHER = "other"


class AccountType(str, PyEnum):
    """Account type enumeration for Chart of Accounts."""
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class TransactionStatus(str, PyEnum):
    """Transaction status enumeration."""
    DRAFT = "draft"
    POSTED = "posted"
    REVERSED = "reversed"


class BankImportStatus(str, PyEnum):
    """Bank import batch status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class BankImportRowStatus(str, PyEnum):
    """Bank import row status."""
    PENDING = "pending"
    MATCHED = "matched"
    CREATED = "created"
    IGNORED = "ignored"


class ReferenceType(str, PyEnum):
    """Reference type for transactions."""
    INVOICE = "invoice"
    PAYMENT = "payment"
    MANUAL = "manual"
    BANK_IMPORT = "bank_import"
    OPENING_BALANCE = "opening_balance"
    TRANSFER = "transfer"
    PURCHASE_ORDER = "purchase_order"
    SALES_ORDER = "sales_order"
    PURCHASE_INVOICE = "purchase_invoice"
    CHEQUE = "cheque"


class VoucherType(str, PyEnum):
    """Tally-style voucher types for easy entry."""
    PAYMENT = "payment"          # Money going out
    RECEIPT = "receipt"          # Money coming in
    CONTRA = "contra"            # Bank to Cash transfer
    JOURNAL = "journal"          # General journal entry
    SALES = "sales"              # Sales with/without inventory
    PURCHASE = "purchase"        # Purchase with/without inventory
    DEBIT_NOTE = "debit_note"    # Return to supplier
    CREDIT_NOTE = "credit_note"  # Return from customer
    STOCK_JOURNAL = "stock_journal"  # Stock transfer between godowns


class EntryType(str, PyEnum):
    """Simple entry types for Quick Entry UI."""
    MONEY_IN = "money_in"
    MONEY_OUT = "money_out"
    TRANSFER = "transfer"


class OrderStatus(str, PyEnum):
    """Order status for sales/purchase orders."""
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PARTIALLY_FULFILLED = "partially_fulfilled"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class StockMovementType(str, PyEnum):
    """Type of stock movement."""
    PURCHASE = "purchase"        # Stock received from purchase
    SALE = "sale"                # Stock issued for sale
    TRANSFER_IN = "transfer_in"  # Received from another godown
    TRANSFER_OUT = "transfer_out"  # Sent to another godown
    ADJUSTMENT_IN = "adjustment_in"  # Manual adjustment increase
    ADJUSTMENT_OUT = "adjustment_out"  # Manual adjustment decrease
    MANUFACTURING_IN = "manufacturing_in"  # Finished goods from production
    MANUFACTURING_OUT = "manufacturing_out"  # Raw materials consumed


class ExchangeRateSource(str, PyEnum):
    """Source of exchange rate."""
    MANUAL = "manual"
    RBI = "rbi"
    OANDA = "oanda"
    XE = "xe"


# ==================== MULTI-CURRENCY MODELS ====================

class Currency(Base):
    """Currency master for multi-currency support."""
    __tablename__ = "currencies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    code = Column(String(3), nullable=False)  # ISO 4217 code: USD, EUR, GBP, etc.
    name = Column(String(100), nullable=False)  # US Dollar, Euro, etc.
    symbol = Column(String(10))  # $, €, £, etc.
    decimal_places = Column(Integer, default=2)
    
    is_base_currency = Column(Boolean, default=False)  # Only INR should be True for Indian companies
    is_active = Column(Boolean, default=True)
    
    # Display settings
    symbol_position = Column(String(10), default="before")  # before or after amount
    thousand_separator = Column(String(1), default=",")
    decimal_separator = Column(String(1), default=".")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_currency_company", "company_id"),
        Index("idx_currency_code", "company_id", "code", unique=True),
    )

    def __repr__(self):
        return f"<Currency {self.code}>"


class ExchangeRate(Base):
    """Exchange rates for currency conversion."""
    __tablename__ = "exchange_rates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    from_currency_id = Column(String(36), ForeignKey("currencies.id", ondelete="CASCADE"), nullable=False)
    to_currency_id = Column(String(36), ForeignKey("currencies.id", ondelete="CASCADE"), nullable=False)
    
    rate = Column(Numeric(18, 8), nullable=False)  # 1 from_currency = rate to_currency
    rate_date = Column(DateTime, nullable=False)  # Effective date
    
    source = Column(Enum(ExchangeRateSource), default=ExchangeRateSource.MANUAL)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    from_currency = relationship("Currency", foreign_keys=[from_currency_id])
    to_currency = relationship("Currency", foreign_keys=[to_currency_id])

    __table_args__ = (
        Index("idx_exchange_rate_company", "company_id"),
        Index("idx_exchange_rate_date", "rate_date"),
        Index("idx_exchange_rate_pair", "from_currency_id", "to_currency_id", "rate_date"),
    )

    def __repr__(self):
        return f"<ExchangeRate {self.from_currency_id}->{self.to_currency_id}: {self.rate}>"


class ForexGainLoss(Base):
    """Track realized and unrealized forex gain/loss."""
    __tablename__ = "forex_gain_loss"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Reference to original transaction
    reference_type = Column(String(50))  # invoice, purchase_invoice, etc.
    reference_id = Column(String(36))
    
    currency_id = Column(String(36), ForeignKey("currencies.id", ondelete="SET NULL"))
    
    # Original transaction details
    original_amount = Column(Numeric(14, 2), nullable=False)  # In foreign currency
    original_rate = Column(Numeric(18, 8), nullable=False)
    original_base_amount = Column(Numeric(14, 2), nullable=False)  # In INR
    
    # Settlement/Revaluation details
    settlement_amount = Column(Numeric(14, 2))  # In foreign currency
    settlement_rate = Column(Numeric(18, 8))
    settlement_base_amount = Column(Numeric(14, 2))  # In INR
    
    # Gain/Loss
    gain_loss_amount = Column(Numeric(14, 2), nullable=False)  # Positive = gain, Negative = loss
    is_realized = Column(Boolean, default=False)  # True if from actual payment, False if from revaluation
    
    gain_loss_date = Column(DateTime, nullable=False)
    
    # Link to accounting entry
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_forex_company", "company_id"),
        Index("idx_forex_reference", "reference_type", "reference_id"),
    )


# ==================== COST CENTER & BUDGET MODELS ====================

class CostCenterAllocationType(str, PyEnum):
    """How cost is allocated to cost center."""
    AMOUNT = "amount"
    PERCENTAGE = "percentage"
    QUANTITY = "quantity"


class BudgetStatus(str, PyEnum):
    """Budget status."""
    DRAFT = "draft"
    APPROVED = "approved"
    ACTIVE = "active"
    CLOSED = "closed"


class BudgetPeriod(str, PyEnum):
    """Budget period type."""
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class CostCenter(Base):
    """Cost Center for expense tracking and allocation."""
    __tablename__ = "cost_centers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    code = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Hierarchy
    parent_id = Column(String(36), ForeignKey("cost_centers.id", ondelete="SET NULL"))
    level = Column(Integer, default=0)  # 0 = root, 1 = child, etc.
    
    # Optional: Link to department
    department_id = Column(String(36))
    
    # Settings
    is_active = Column(Boolean, default=True)
    allow_direct_posting = Column(Boolean, default=True)  # Can transactions be posted directly?
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent = relationship("CostCenter", remote_side=[id], backref="children")

    __table_args__ = (
        Index("idx_cost_center_company", "company_id"),
        Index("idx_cost_center_code", "company_id", "code", unique=True),
    )

    def __repr__(self):
        return f"<CostCenter {self.code} - {self.name}>"


class CostCategory(Base):
    """Cost Category for grouping expenses (e.g., Direct, Indirect, Administrative)."""
    __tablename__ = "cost_categories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    code = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    allocation_type = Column(Enum(CostCenterAllocationType), default=CostCenterAllocationType.AMOUNT)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_cost_category_company", "company_id"),
        Index("idx_cost_category_code", "company_id", "code", unique=True),
    )

    def __repr__(self):
        return f"<CostCategory {self.code} - {self.name}>"


class BudgetMaster(Base):
    """Budget master for tracking planned vs actual expenses."""
    __tablename__ = "budget_masters"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    financial_year = Column(String(9), nullable=False)  # e.g., "2024-2025"
    
    from_date = Column(DateTime, nullable=False)
    to_date = Column(DateTime, nullable=False)
    
    period_type = Column(Enum(BudgetPeriod), default=BudgetPeriod.MONTHLY)
    status = Column(Enum(BudgetStatus), default=BudgetStatus.DRAFT)
    
    # Totals (computed)
    total_budgeted = Column(Numeric(14, 2), default=0)
    total_actual = Column(Numeric(14, 2), default=0)
    total_variance = Column(Numeric(14, 2), default=0)
    
    # Workflow
    created_by = Column(String(36))
    approved_by = Column(String(36))
    approved_at = Column(DateTime)
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    lines = relationship("BudgetLine", back_populates="budget", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_budget_company", "company_id"),
        Index("idx_budget_fy", "financial_year"),
    )

    def __repr__(self):
        return f"<Budget {self.name} - {self.financial_year}>"


class BudgetLine(Base):
    """Individual budget line items by account and cost center."""
    __tablename__ = "budget_lines"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    budget_id = Column(String(36), ForeignKey("budget_masters.id", ondelete="CASCADE"), nullable=False)
    
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    cost_center_id = Column(String(36), ForeignKey("cost_centers.id", ondelete="SET NULL"))
    
    # Period details (for monthly/quarterly breakdowns)
    period_month = Column(Integer)  # 1-12 for monthly
    period_quarter = Column(Integer)  # 1-4 for quarterly
    
    budgeted_amount = Column(Numeric(14, 2), nullable=False, default=0)
    actual_amount = Column(Numeric(14, 2), default=0)  # Computed from transactions
    variance_amount = Column(Numeric(14, 2), default=0)  # budgeted - actual
    variance_percentage = Column(Numeric(8, 2), default=0)  # (variance / budgeted) * 100
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    budget = relationship("BudgetMaster", back_populates="lines")

    __table_args__ = (
        Index("idx_budget_line_budget", "budget_id"),
        Index("idx_budget_line_account", "account_id"),
        Index("idx_budget_line_cost_center", "cost_center_id"),
    )


class User(Base):
    """User model - represents a tenant in the multi-tenant system."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    supabase_id = Column(String(255), unique=True, index=True)  # Supabase auth user ID
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("Product", back_populates="creator")
    taxes = relationship("Tax", back_populates="creator")
    brands = relationship("Brand", back_populates="creator")
    categories = relationship("Category", back_populates="creator")
    companies = relationship("Company", back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"


class Brand(Base):
    """Brand model for items."""
    __tablename__ = "brands"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    status = Column(Boolean, default=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<Brand(id={self.id}, name='{self.name}')>"


class Category(Base):
    """Category model for items."""
    __tablename__ = "categories"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    status = Column(Boolean, default=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    creator = relationship("User")
    
    def __repr__(self):
        return f"<Category(id={self.id}, name='{self.name}')>"


class Tax(Base):
    """Tax model for items."""
    __tablename__ = "taxes"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(50), nullable=False)
    rate = Column(Numeric(5, 2), nullable=False)  # Tax rate percentage
    created_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    items = relationship("Product", back_populates="tax")
    creator = relationship("User", back_populates="taxes")
    
    def __repr__(self):
        return f"<Tax(id={self.id}, name='{self.name}', rate={self.rate})>"


class Company(Base):
    """Company model - represents a business entity for invoicing."""
    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Business details
    name = Column(String(255), nullable=False)
    trade_name = Column(String(255))  # Trading name if different
    gstin = Column(String(15), index=True)  # GST Identification Number
    pan = Column(String(10))  # PAN Number
    cin = Column(String(21))  # Company Identification Number (optional)
    
    # Contact details
    email = Column(String(255))
    phone = Column(String(20))
    website = Column(String(255))
    
    # Address
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    state_code = Column(String(2))  # GST state code (e.g., "27" for Maharashtra)
    pincode = Column(String(10))
    country = Column(String(100), default="India")
    
    # Business info
    business_type = Column(String(50))  # Pvt Ltd, LLP, Proprietorship, etc.
    
    # Branding
    logo_url = Column(String(500))
    signature_url = Column(String(500))
    
    # Invoice settings
    invoice_prefix = Column(String(20), default="INV")
    invoice_counter = Column(Integer, default=1)
    invoice_terms = Column(Text)  # Default terms and conditions
    invoice_notes = Column(Text)  # Default notes
    
    # Bank details for invoices
    default_bank_id = Column(String(36))
    
    # Inventory automation settings
    auto_reduce_stock = Column(Boolean, default=True)
    warehouse_priorities = Column(JSON)  # {"priority_order": ["godown_id1", "godown_id2", "main"]}
    
    # Inventory settings (NEW)
    negative_stock_allowed = Column(Boolean, default=True)
    default_valuation_method = Column(String(20), default="weighted_avg")  # fifo, lifo, weighted_avg
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="companies")
    customers = relationship("Customer", back_populates="company", cascade="all, delete-orphan")
    items = relationship("Product", back_populates="company", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="company", cascade="all, delete-orphan")
    bank_accounts = relationship("BankAccount", back_populates="company", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="company", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="company", cascade="all, delete-orphan")
    bank_imports = relationship("BankImport", back_populates="company", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_company_user", "user_id"),
        Index("idx_company_gstin", "gstin"),
    )

    def __repr__(self):
        return f"<Company {self.name}>"


class Customer(Base):
    """Customer model - clients/customers of a company."""
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Customer details
    name = Column(String(255), nullable=False)
    trade_name = Column(String(255))
    gstin = Column(String(15), index=True)  # Customer's GSTIN (for B2B)
    pan = Column(String(10))
    
    # Contact
    email = Column(String(255))
    phone = Column(String(20))
    contact_person = Column(String(255))
    
    # Billing Address
    billing_address_line1 = Column(String(255))
    billing_address_line2 = Column(String(255))
    billing_city = Column(String(100))
    billing_state = Column(String(100))
    billing_state_code = Column(String(2))
    billing_pincode = Column(String(10))
    billing_country = Column(String(100), default="India")
    
    # Shipping Address (if different)
    shipping_address_line1 = Column(String(255))
    shipping_address_line2 = Column(String(255))
    shipping_city = Column(String(100))
    shipping_state = Column(String(100))
    shipping_state_code = Column(String(2))
    shipping_pincode = Column(String(10))
    shipping_country = Column(String(100), default="India")
    
    # Customer type
    customer_type = Column(String(20), default="b2c")  # b2b, b2c, export
    
    # Credit management (NEW)
    credit_limit = Column(Numeric(15, 2))
    credit_days = Column(Integer, default=30)
    block_on_credit_exceed = Column(Boolean, default=False)
    price_level_id = Column(String(36), ForeignKey("price_levels.id", ondelete="SET NULL"))
    
    # Interest on overdue (NEW)
    interest_rate = Column(Numeric(5, 2))  # Annual interest rate %
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="customers")
    invoices = relationship("Invoice", back_populates="customer")
    price_level = relationship("PriceLevel")
    contacts = relationship("Contact", back_populates="customer", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_customer_company", "company_id"),
    )

    def __repr__(self):
        return f"<Customer {self.name}>"


class Product(Base):
    """Product/Service model - Unified product with inventory tracking."""
    __tablename__ = "items"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(191), nullable=False, index=True)
    item_group = Column(String(200), default="single")
    hsn = Column(String(50), nullable=True)
    barcode = Column(String(100), nullable=True, index=True)
    brand = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=True)
    alert_quantity = Column(Integer, default=0)
    category = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    discount_type = Column(discount_type_enum, default='percentage')
    discount = Column(Numeric(15, 2), default=0.00)
    price = Column(Numeric(15, 2), default=0.00)
    tax_type = Column(String(100), nullable=True)
    mrp = Column(Numeric(15, 2), default=0.00)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    tax_id = Column(String(36), ForeignKey("taxes.id"), nullable=True, index=True)
    profit_margin = Column(Numeric(8, 2), default=0.00)
    sku = Column(String(100), nullable=True, index=True)
    seller_points = Column(Integer, default=0)
    purchase_price = Column(Numeric(15, 2), default=0.00)
    sales_price = Column(Numeric(15, 2), default=0.00)
    opening_stock = Column(Integer, default=0)
    quantity = Column(Integer, default=0)
    image = Column(String(191), nullable=True)
    additional_image = Column(String(191), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False, index=True) 
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # ADD this column if not present
    stock_group_id = Column(String(36), ForeignKey("stock_groups.id", ondelete="SET NULL"), index=True)
    
    # Relationships - FIXED
    company = relationship("Company", back_populates="items")
    tax = relationship("Tax", back_populates="items")
    creator = relationship("User", back_populates="items")
    stock_group = relationship("StockGroup", back_populates="items")
    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan")
    bom_components = relationship("BOMComponent", back_populates="component_product", cascade="all, delete-orphan")
    
    # Add the missing relationship for stock_entries
    stock_entries = relationship("StockEntry", back_populates="product", cascade="all, delete-orphan")
    alternative_mappings = relationship("ProductAlternativeMapping", back_populates="product", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Item(id={self.id}, name='{self.name}', sku='{self.sku}')>"


class AlternativeProduct(Base):
    """Alternative/Competitor Product model - Reference only, no inventory tracking."""
    __tablename__ = "alternative_products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Product details
    name = Column(String(255), nullable=False)
    manufacturer = Column(String(255))  # Manufacturer/brand name
    model_number = Column(String(100))  # Model/part number
    description = Column(Text)
    category = Column(String(100))  # Product category
    specifications = Column(JSON)  # Additional specs as JSON
    
    # Reference info
    reference_url = Column(String(500))  # Link to product page
    reference_price = Column(Numeric(14, 2))  # Estimated/known price
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", backref="alternative_products")
    product_mappings = relationship("ProductAlternativeMapping", back_populates="alternative_product", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_alt_product_company", "company_id"),
        Index("idx_alt_product_manufacturer", "manufacturer"),
        Index("idx_alt_product_model", "model_number"),
    )

    def __repr__(self):
        return f"<AlternativeProduct {self.name}>"


class ProductAlternativeMapping(Base):
    """Mapping table for Product to AlternativeProduct (many-to-many)."""
    __tablename__ = "product_alternative_mappings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    alternative_product_id = Column(String(36), ForeignKey("alternative_products.id", ondelete="CASCADE"), nullable=False)
    
    # Mapping details
    notes = Column(Text)  # Mapping-specific notes
    priority = Column(Integer, default=0)  # Ranking/preference (lower = higher priority)
    comparison_notes = Column(Text)  # How they compare
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))

    # Relationships
    product = relationship("Product", back_populates="alternative_mappings")
    alternative_product = relationship("AlternativeProduct", back_populates="product_mappings")

    __table_args__ = (
        UniqueConstraint("product_id", "alternative_product_id", name="uq_product_alternative"),
        Index("idx_mapping_product", "product_id"),
        Index("idx_mapping_alternative", "alternative_product_id"),
    )

    def __repr__(self):
        return f"<ProductAlternativeMapping {self.product_id} -> {self.alternative_product_id}>"


class Invoice(Base):
    """Invoice model - GST compliant invoice."""
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Sales pipeline tracking
    sales_ticket_id = Column(String(36), ForeignKey("sales_tickets.id", ondelete="SET NULL"))
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"))
    
    # Invoice identification
    invoice_number = Column(String(50), nullable=False, index=True)
    invoice_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    due_date = Column(DateTime)
    
    # Invoice type for GST
    invoice_type = Column(Enum(InvoiceType, name='invoice_type_enum'), default=InvoiceType.B2C)
 
    # Place of supply (State code for GST)
    place_of_supply = Column(String(2))  # State code
    place_of_supply_name = Column(String(100))
    
    # Reverse charge
    is_reverse_charge = Column(Boolean, default=False)
    
    # Amounts (all in INR)
    subtotal = Column(Numeric(14, 2), default=0)  # Total before tax
    discount_amount = Column(Numeric(14, 2), default=0)
    
    # GST breakup
    cgst_amount = Column(Numeric(14, 2), default=0)  # Central GST
    sgst_amount = Column(Numeric(14, 2), default=0)  # State GST
    igst_amount = Column(Numeric(14, 2), default=0)  # Integrated GST
    cess_amount = Column(Numeric(14, 2), default=0)  # Cess if applicable
    
    total_tax = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)  # Final amount
    
    # Payment tracking
    amount_paid = Column(Numeric(14, 2), default=0)
    balance_due = Column(Numeric(14, 2), default=0)
    outstanding_amount = Column(Numeric(14, 2), default=0)  # NEW: For bill-wise tracking
    
    # Status
    status = Column(Enum(InvoiceStatus, name='invoice_status_enum'), default=InvoiceStatus.DRAFT)
    # Payment link
    payment_link = Column(String(500))
    upi_qr_data = Column(Text)  # UPI QR code data
    
    # Additional info
    notes = Column(Text)
    terms = Column(Text)
    
    # E-Invoice fields (for future GST compliance)
    irn = Column(String(64))  # Invoice Reference Number
    ack_number = Column(String(50))
    ack_date = Column(DateTime)
    signed_qr = Column(Text)
    
    # PDF storage
    pdf_url = Column(String(500))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    sales_ticket = relationship("SalesTicket")
    contact = relationship("Contact")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_invoice_company", "company_id"),
        Index("idx_invoice_customer", "customer_id"),
        Index("idx_invoice_date", "invoice_date"),
        Index("idx_invoice_status", "status"),
        Index("idx_invoice_ticket", "sales_ticket_id"),
    )

    def __repr__(self):
        return f"<Invoice {self.invoice_number}>"


class InvoiceItem(Base):
    """Invoice line item model."""
    __tablename__ = "invoice_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    
    # Item details
    description = Column(String(500), nullable=False)
    hsn_code = Column(String(8))
    
    # Quantity and pricing
    quantity = Column(Numeric(10, 3), nullable=False)
    unit = Column(String(20), default="unit")
    unit_price = Column(Numeric(12, 2), nullable=False)
    
    # Discount
    discount_percent = Column(Numeric(5, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    
    # Tax
    gst_rate = Column(Numeric(5, 2), nullable=False)  # GST rate percentage
    cgst_rate = Column(Numeric(5, 2), default=0)
    sgst_rate = Column(Numeric(5, 2), default=0)
    igst_rate = Column(Numeric(5, 2), default=0)
    
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)
    cess_amount = Column(Numeric(12, 2), default=0)
    
    # Totals
    taxable_amount = Column(Numeric(14, 2), nullable=False)  # After discount, before tax
    total_amount = Column(Numeric(14, 2), nullable=False)  # Including tax
    
    # Warehouse allocation tracking
    warehouse_allocation = Column(JSON)  # [{"godown_id": "xxx", "quantity": 10}, {"godown_id": null, "quantity": 5}]
    stock_reserved = Column(Boolean, default=False)  # Reserved on invoice create
    stock_reduced = Column(Boolean, default=False)   # Finalized on PAID
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")

    __table_args__ = (
        Index("idx_item_invoice", "invoice_id"),
    )

    def __repr__(self):
        return f"<InvoiceItem {self.description[:30]}>"


class Payment(Base):
    """Payment model - tracks payments against invoices."""
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    
    # Payment details
    amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    payment_mode = Column(Enum(PaymentMode, name='payment_mode_enum'), default=PaymentMode.UPI)
    # Reference
    reference_number = Column(String(100))  # Transaction ID, Cheque number, etc.
    upi_transaction_id = Column(String(100))
    
    # Notes
    notes = Column(Text)
    
    # Status
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")

    __table_args__ = (
        Index("idx_payment_invoice", "invoice_id"),
        Index("idx_payment_date", "payment_date"),
    )

    def __repr__(self):
        return f"<Payment {self.amount} for Invoice {self.invoice_id}>"


class BankAccount(Base):
    """Bank account model - for displaying bank details on invoices."""
    __tablename__ = "bank_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Bank details
    bank_name = Column(String(255), nullable=False)
    account_name = Column(String(255), nullable=False)
    account_number = Column(String(50), nullable=False)
    ifsc_code = Column(String(11), nullable=False)
    branch = Column(String(255))
    
    # UPI
    upi_id = Column(String(100))
    
    # Settings
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="bank_accounts")

    __table_args__ = (
        Index("idx_bank_company", "company_id"),
    )

    def __repr__(self):
        return f"<BankAccount {self.bank_name} - {self.account_number[-4:]}>"


class Account(Base):
    """Chart of Accounts model - accounting accounts for double-entry bookkeeping."""
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Account identification
    code = Column(String(20), nullable=False)  # e.g., "1000", "1010"
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Account type
    account_type = Column(Enum(AccountType, name='account_type_enum'), nullable=False)
    # Hierarchy (for sub-accounts)
    parent_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    
    # Note: Balances are calculated from transaction entries, not stored
    # Use AccountingService.get_account_balance() to get balance
    
    # System account flag (protected, cannot be deleted)
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Link to bank account (for bank type accounts)
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="accounts")
    parent = relationship("Account", remote_side=[id], backref="children")
    bank_account = relationship("BankAccount")
    transaction_entries = relationship("TransactionEntry", back_populates="account")

    __table_args__ = (
        Index("idx_account_company", "company_id"),
        Index("idx_account_code", "company_id", "code", unique=True),
        Index("idx_account_type", "account_type"),
    )

    def __repr__(self):
        return f"<Account {self.code} - {self.name}>"


class Transaction(Base):
    """Transaction model - Journal entry header for double-entry bookkeeping."""
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Transaction identification
    transaction_number = Column(String(50), nullable=False)
    transaction_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Voucher type (Tally-style)
    voucher_type = Column(Enum(VoucherType, name='voucher_type_enum'), default=VoucherType.JOURNAL)

    # Description
    description = Column(Text)
    
    # Party reference (customer/vendor for receivables/payables)
    party_id = Column(String(36))  # Customer or Vendor ID
    party_type = Column(String(20))  # 'customer' or 'vendor'
    
    # Reference to source document
    reference_type = Column(Enum(ReferenceType, name='reference_type_enum'), default=ReferenceType.MANUAL)
    reference_id = Column(String(36))  # ID of invoice, payment, etc.
    
    # Status
    status = Column(Enum(TransactionStatus, name='transaction_status_enum'), default=TransactionStatus.DRAFT)
    # Reconciliation
    is_reconciled = Column(Boolean, default=False)
    reconciled_at = Column(DateTime)
    
    # Totals (for validation - debits must equal credits)
    total_debit = Column(Numeric(14, 2), default=0)
    total_credit = Column(Numeric(14, 2), default=0)
    
    # Reversal reference
    reversed_by_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    reverses_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    # Optional/Memorandum vouchers (NEW)
    is_optional = Column(Boolean, default=False)
    converted_from_optional_id = Column(String(36))
    
    # Auto-reversing journals (NEW)
    auto_reverse_date = Column(DateTime)
    
    # Scenario reference (NEW)
    scenario_id = Column(String(36), ForeignKey("scenarios.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="transactions")
    entries = relationship("TransactionEntry", back_populates="transaction", cascade="all, delete-orphan")
    reversed_by = relationship("Transaction", foreign_keys=[reversed_by_id], remote_side=[id])
    reverses = relationship("Transaction", foreign_keys=[reverses_id], remote_side=[id])
    scenario = relationship("Scenario")

    __table_args__ = (
        Index("idx_transaction_company", "company_id"),
        Index("idx_transaction_date", "transaction_date"),
        Index("idx_transaction_reference", "reference_type", "reference_id"),
        Index("idx_transaction_status", "status"),
    )

    def __repr__(self):
        return f"<Transaction {self.transaction_number}>"


class TransactionEntry(Base):
    """Transaction entry model - Individual debit/credit line in a journal entry."""
    __tablename__ = "transaction_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    
    # Entry details
    description = Column(String(500))
    
    # Amounts (one must be zero)
    debit_amount = Column(Numeric(14, 2), default=0)
    credit_amount = Column(Numeric(14, 2), default=0)
    
    # Bank reconciliation fields (NEW)
    bank_date = Column(DateTime)  # Date as per bank statement
    is_reconciled = Column(Boolean, default=False)
    reconciliation_date = Column(DateTime)
    bank_reference = Column(String(100))
    cheque_id = Column(String(36), ForeignKey("cheques.id", ondelete="SET NULL"))
    
    # Cost center allocation (NEW)
    cost_center_id = Column(String(36), ForeignKey("cost_centers.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    transaction = relationship("Transaction", back_populates="entries")
    account = relationship("Account", back_populates="transaction_entries")
    cost_center = relationship("CostCenter")
    cheque = relationship("Cheque")

    __table_args__ = (
        Index("idx_entry_transaction", "transaction_id"),
        Index("idx_entry_account", "account_id"),
    )

    def __repr__(self):
        return f"<TransactionEntry {self.debit_amount or self.credit_amount}>"


class BankImport(Base):
    """Bank import model - Tracks CSV import batches."""
    __tablename__ = "bank_imports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    
    # Import details
    file_name = Column(String(255), nullable=False)
    bank_name = Column(String(100))  # Detected bank: HDFC, ICICI, SBI, Axis
    
    # Status
    status = Column(Enum(BankImportStatus), default=BankImportStatus.PENDING)
    
    # Statistics
    total_rows = Column(Integer, default=0)
    processed_rows = Column(Integer, default=0)
    matched_rows = Column(Integer, default=0)
    created_rows = Column(Integer, default=0)
    ignored_rows = Column(Integer, default=0)
    
    # Error tracking
    error_message = Column(Text)
    
    import_date = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="bank_imports")
    bank_account = relationship("BankAccount")
    rows = relationship("BankImportRow", back_populates="bank_import", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_bank_import_company", "company_id"),
        Index("idx_bank_import_status", "status"),
    )

    def __repr__(self):
        return f"<BankImport {self.file_name}>"


class BankImportRow(Base):
    """Bank import row model - Individual parsed row from CSV."""
    __tablename__ = "bank_import_rows"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    import_id = Column(String(36), ForeignKey("bank_imports.id", ondelete="CASCADE"), nullable=False)
    
    # Row details
    row_number = Column(Integer, nullable=False)
    transaction_date = Column(DateTime)
    value_date = Column(DateTime)
    
    # Transaction details from CSV
    description = Column(Text)
    reference_number = Column(String(100))
    
    # Amounts
    debit_amount = Column(Numeric(14, 2), default=0)
    credit_amount = Column(Numeric(14, 2), default=0)
    balance = Column(Numeric(14, 2))
    
    # Status
    status = Column(Enum(BankImportRowStatus), default=BankImportRowStatus.PENDING)
    
    # Linked transaction (if created or matched)
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    # Account mapping (for creating transaction)
    mapped_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    
    # Raw data for debugging
    raw_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bank_import = relationship("BankImport", back_populates="rows")
    transaction = relationship("Transaction")
    mapped_account = relationship("Account")

    __table_args__ = (
        Index("idx_import_row_import", "import_id"),
        Index("idx_import_row_status", "status"),
    )

    def __repr__(self):
        return f"<BankImportRow {self.row_number}>"


# ============== INVENTORY MODELS ==============

class StockGroup(Base):
    """Stock Group model - Like Tally's Stock Groups for categorization."""
    __tablename__ = "stock_groups"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    parent_id = Column(String(36), ForeignKey("stock_groups.id", ondelete="SET NULL"))
    description = Column(Text)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent = relationship("StockGroup", remote_side=[id], backref="children")
    items = relationship("Product", back_populates="stock_group")

    __table_args__ = (
        Index("idx_stock_group_company", "company_id"),
    )

    def __repr__(self):
        return f"<StockGroup {self.name}>"


class Godown(Base):
    """Godown/Warehouse model - Location for stock storage."""
    __tablename__ = "godowns"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    code = Column(String(50))
    address = Column(Text)
    
    # Parent for sub-locations
    parent_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    parent = relationship("Godown", remote_side=[id], backref="sub_locations")
    stock_entries = relationship("StockEntry", back_populates="godown", foreign_keys="[StockEntry.godown_id]")
    from_stock_entries = relationship("StockEntry", foreign_keys="[StockEntry.from_godown_id]", back_populates="from_godown")
    to_stock_entries = relationship("StockEntry", foreign_keys="[StockEntry.to_godown_id]", back_populates="to_godown")

    __table_args__ = (
        Index("idx_godown_company", "company_id"),
    )

    def __repr__(self):
        return f"<Godown {self.name}>"


class Batch(Base):
    """Batch/Lot model - For batch-wise stock tracking."""
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    
    batch_number = Column(String(100), nullable=False)
    manufacturing_date = Column(DateTime)
    expiry_date = Column(DateTime)
    
    # Quantity in this batch
    quantity = Column(Numeric(14, 3), default=0)
    cost_price = Column(Numeric(14, 2), default=0)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="batches")

    __table_args__ = (
        Index("idx_batch_item", "product_id"),
        Index("idx_batch_expiry", "expiry_date"),
    )

    def __repr__(self):
        return f"<Batch {self.batch_number}>"


class StockEntry(Base):
    """Stock Entry model - Individual stock movement record."""
    __tablename__ = "stock_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="SET NULL"))
    
    # Movement details
    entry_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    movement_type = Column(Enum(StockMovementType), nullable=False)
    
    # Quantity (positive for in, negative for out)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit = Column(String(20))
    rate = Column(Numeric(14, 2), default=0)
    value = Column(Numeric(14, 2), default=0)
    
    # Reference
    reference_type = Column(String(50))  # invoice, purchase_order, stock_journal, etc.
    reference_id = Column(String(36))
    reference_number = Column(String(100))
    
    # For transfers
    from_godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    to_godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="stock_entries", foreign_keys=[product_id])
    godown = relationship("Godown", back_populates="stock_entries", foreign_keys=[godown_id])
    batch = relationship("Batch")
    from_godown = relationship("Godown", foreign_keys=[from_godown_id], back_populates="from_stock_entries")
    to_godown = relationship("Godown", foreign_keys=[to_godown_id], back_populates="to_stock_entries")

    __table_args__ = (
        Index("idx_stock_entry_company", "company_id"),
        Index("idx_stock_entry_item", "product_id"),
        Index("idx_stock_entry_date", "entry_date"),
    )

    def __repr__(self):
        return f"<StockEntry {self.movement_type} - {self.quantity}>"


class BillOfMaterial(Base):
    """Bill of Material (BOM) model - For manufacturing/assembly."""
    __tablename__ = "bills_of_material"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Finished product
    finished_item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Quantity produced per BOM
    output_quantity = Column(Numeric(14, 3), default=1)
    output_unit = Column(String(20))
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    finished_item = relationship("Product", foreign_keys=[finished_item_id])
    components = relationship("BOMComponent", back_populates="bom", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_bom_company", "company_id"),
    )

    def __repr__(self):
        return f"<BillOfMaterial {self.name}>"


class BOMComponent(Base):
    """BOM Component model - Raw materials needed for production."""
    __tablename__ = "bom_components"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bom_id = Column(String(36), ForeignKey("bills_of_material.id", ondelete="CASCADE"), nullable=False)
    component_item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    
    quantity = Column(Numeric(14, 3), nullable=False)
    unit = Column(String(20))
    
    # Waste/scrap allowance
    waste_percentage = Column(Numeric(5, 2), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bom = relationship("BillOfMaterial", back_populates="components")
    component_product = relationship("Product", back_populates="bom_components", foreign_keys=[component_item_id])

    __table_args__ = (
        Index("idx_bom_component_bom", "bom_id"),
    )

    def __repr__(self):
        return f"<BOMComponent {self.quantity} x {self.component_product.name if self.component_product else 'Unknown'}>"


# ============== ORDER MODELS ==============

class SalesOrder(Base):
    """Sales Order model - Customer orders before invoicing."""
    __tablename__ = "sales_orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Sales pipeline tracking
    sales_ticket_id = Column(String(36), ForeignKey("sales_tickets.id", ondelete="SET NULL"))
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"))
    sales_person_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    
    # Order identification
    order_number = Column(String(50), nullable=False)
    order_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    expected_delivery_date = Column(DateTime)
    
    # Status
    status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT)
    
    # Amounts
    subtotal = Column(Numeric(14, 2), default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    
    # Fulfillment tracking
    quantity_ordered = Column(Numeric(14, 3), default=0)
    quantity_delivered = Column(Numeric(14, 3), default=0)
    
    # Reference to invoice (when converted)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    terms = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer")
    sales_ticket = relationship("SalesTicket")
    contact = relationship("Contact")
    sales_person = relationship("Employee")
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")
    delivery_notes = relationship("DeliveryNote", back_populates="sales_order")
    invoice = relationship("Invoice", foreign_keys=[invoice_id])

    __table_args__ = (
        Index("idx_sales_order_company", "company_id"),
        Index("idx_sales_order_customer", "customer_id"),
        Index("idx_sales_order_status", "status"),
        Index("idx_sales_order_ticket", "sales_ticket_id"),
    )

    def __repr__(self):
        return f"<SalesOrder {self.order_number}>"


class SalesOrderItem(Base):
    """Sales Order Item model."""
    __tablename__ = "sales_order_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit = Column(String(20))
    rate = Column(Numeric(14, 2), nullable=False)
    
    # Fulfillment
    quantity_delivered = Column(Numeric(14, 3), default=0)
    quantity_pending = Column(Numeric(14, 3), default=0)
    
    # Tax
    gst_rate = Column(Numeric(5, 2), default=18)
    tax_amount = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        Index("idx_so_item_order", "order_id"),
    )

    def __repr__(self):
        return f"<SalesOrderItem {self.description[:30]}>"


class PurchaseOrder(Base):
    """Purchase Order model - Orders to vendors/suppliers."""
    __tablename__ = "purchase_orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Vendor (stored in Customer table with customer_type='vendor')
    vendor_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Order identification
    order_number = Column(String(50), nullable=False)
    order_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    expected_date = Column(DateTime)
    
    # Status
    status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT)
    
    # Amounts
    subtotal = Column(Numeric(14, 2), default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    
    # Receipt tracking
    quantity_ordered = Column(Numeric(14, 3), default=0)
    quantity_received = Column(Numeric(14, 3), default=0)
    
    notes = Column(Text)
    terms = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    vendor = relationship("Customer")
    items = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")
    receipt_notes = relationship("ReceiptNote", back_populates="purchase_order")

    __table_args__ = (
        Index("idx_purchase_order_company", "company_id"),
        Index("idx_purchase_order_vendor", "vendor_id"),
        Index("idx_purchase_order_status", "status"),
    )

    def __repr__(self):
        return f"<PurchaseOrder {self.order_number}>"


class PurchaseOrderItem(Base):
    """Purchase Order Item model."""
    __tablename__ = "purchase_order_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit = Column(String(20))
    rate = Column(Numeric(14, 2), nullable=False)
    
    # Receipt tracking
    quantity_received = Column(Numeric(14, 3), default=0)
    quantity_pending = Column(Numeric(14, 3), default=0)
    
    # Tax
    gst_rate = Column(Numeric(5, 2), default=18)
    tax_amount = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        Index("idx_po_item_order", "order_id"),
    )

    def __repr__(self):
        return f"<PurchaseOrderItem {self.description[:30]}>"


class DeliveryNote(Base):
    """Delivery Note model - Goods sent to customer."""
    __tablename__ = "delivery_notes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    sales_order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="SET NULL"))
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Delivery identification
    delivery_number = Column(String(50), nullable=False)
    delivery_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # E-Way Bill (for goods > 50K)
    eway_bill_number = Column(String(20))
    eway_bill_date = Column(DateTime)
    
    # Transport details
    transporter_name = Column(String(255))
    transporter_id = Column(String(20))  # GSTIN of transporter
    vehicle_number = Column(String(20))
    
    # From godown
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sales_order = relationship("SalesOrder", back_populates="delivery_notes")
    customer = relationship("Customer")
    godown = relationship("Godown")
    items = relationship("DeliveryNoteItem", back_populates="delivery_note", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_delivery_note_company", "company_id"),
        Index("idx_delivery_note_order", "sales_order_id"),
    )

    def __repr__(self):
        return f"<DeliveryNote {self.delivery_number}>"


class DeliveryNoteItem(Base):
    """Delivery Note Item model."""
    __tablename__ = "delivery_note_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    delivery_note_id = Column(String(36), ForeignKey("delivery_notes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="SET NULL"))
    
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit = Column(String(20))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    delivery_note = relationship("DeliveryNote", back_populates="items")
    product = relationship("Product")
    batch = relationship("Batch")

    __table_args__ = (
        Index("idx_dn_item_note", "delivery_note_id"),
    )

    def __repr__(self):
        return f"<DeliveryNoteItem {self.description[:30]}>"


class ReceiptNote(Base):
    """Receipt Note model - Goods received from vendor."""
    __tablename__ = "receipt_notes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    purchase_order_id = Column(String(36), ForeignKey("purchase_orders.id", ondelete="SET NULL"))
    vendor_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Receipt identification
    receipt_number = Column(String(50), nullable=False)
    receipt_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Vendor invoice reference
    vendor_invoice_number = Column(String(100))
    vendor_invoice_date = Column(DateTime)
    
    # Into godown
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="receipt_notes")
    vendor = relationship("Customer")
    godown = relationship("Godown")
    items = relationship("ReceiptNoteItem", back_populates="receipt_note", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_receipt_note_company", "company_id"),
        Index("idx_receipt_note_order", "purchase_order_id"),
    )

    def __repr__(self):
        return f"<ReceiptNote {self.receipt_number}>"


class ReceiptNoteItem(Base):
    """Receipt Note Item model."""
    __tablename__ = "receipt_note_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    receipt_note_id = Column(String(36), ForeignKey("receipt_notes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="SET NULL"))
    
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit = Column(String(20))
    rate = Column(Numeric(14, 2), default=0)
    
    # Quality check
    accepted_quantity = Column(Numeric(14, 3))
    rejected_quantity = Column(Numeric(14, 3), default=0)
    rejection_reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    receipt_note = relationship("ReceiptNote", back_populates="items")
    product = relationship("Product")
    batch = relationship("Batch")

    __table_args__ = (
        Index("idx_rn_item_note", "receipt_note_id"),
    )

    def __repr__(self):
        return f"<ReceiptNoteItem {self.description[:30]}>"


# ============== QUICK ENTRY MODEL ==============

class QuickEntry(Base):
    """Quick Entry model - Simplified entry for non-accountants."""
    __tablename__ = "quick_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Entry type
    entry_type = Column(Enum(EntryType), nullable=False)
    entry_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Amount
    amount = Column(Numeric(14, 2), nullable=False)
    
    # Party (optional)
    party_id = Column(String(36))  # Customer or Vendor ID
    party_type = Column(String(20))  # 'customer' or 'vendor'
    party_name = Column(String(255))  # For display
    
    # Category
    category = Column(String(100))  # Sale, Purchase, Salary, Rent, etc.
    
    # Payment account
    payment_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    payment_mode = Column(Enum(PaymentMode))
    
    # For transfers
    from_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    to_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    
    # Description
    description = Column(Text)
    reference_number = Column(String(100))
    
    # GST (auto-calculated if applicable)
    is_gst_applicable = Column(Boolean, default=False)
    gst_rate = Column(Numeric(5, 2))
    gst_amount = Column(Numeric(14, 2), default=0)
    
    # Linked transaction (auto-created)
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    # Linked invoice (if applicable)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payment_account = relationship("Account", foreign_keys=[payment_account_id])
    from_account = relationship("Account", foreign_keys=[from_account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])
    transaction = relationship("Transaction")
    invoice = relationship("Invoice")

    __table_args__ = (
        Index("idx_quick_entry_company", "company_id"),
        Index("idx_quick_entry_date", "entry_date"),
        Index("idx_quick_entry_type", "entry_type"),
    )

    def __repr__(self):
        return f"<QuickEntry {self.entry_type} - {self.amount}>"


# ============== PURCHASE INVOICE MODELS ==============

class PurchaseInvoiceStatus(str, PyEnum):
    """Purchase Invoice status enumeration."""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    CANCELLED = "cancelled"


class TDSSection(Base):
    """TDS Section configuration - Rates as per Income Tax Act."""
    __tablename__ = "tds_sections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Section details
    section_code = Column(String(20), nullable=False)  # e.g., "194C", "194J", "194H"
    description = Column(String(255), nullable=False)
    
    # TDS Rates
    rate_individual = Column(Numeric(5, 2), nullable=False)  # Rate for individuals
    rate_company = Column(Numeric(5, 2), nullable=False)  # Rate for companies
    rate_no_pan = Column(Numeric(5, 2), default=20)  # Rate if no PAN provided
    
    # Thresholds
    threshold_single = Column(Numeric(14, 2), default=0)  # Single payment threshold
    threshold_annual = Column(Numeric(14, 2), default=0)  # Annual threshold
    
    # Applicable for
    nature_of_payment = Column(String(255))  # e.g., "Contract", "Professional fees"
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_tds_section_company", "company_id"),
        Index("idx_tds_section_code", "section_code"),
    )

    def __repr__(self):
        return f"<TDSSection {self.section_code}>"


class PurchaseInvoice(Base):
    """Purchase Invoice model - Bills received from vendors with GST Input Credit."""
    __tablename__ = "purchase_invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Invoice identification
    invoice_number = Column(String(50), nullable=False, index=True)
    vendor_invoice_number = Column(String(100))
    invoice_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    vendor_invoice_date = Column(DateTime)
    due_date = Column(DateTime)
    
    # Linked documents
    purchase_order_id = Column(String(36), ForeignKey("purchase_orders.id", ondelete="SET NULL"))
    receipt_note_id = Column(String(36), ForeignKey("receipt_notes.id", ondelete="SET NULL"))
    
    # Place of supply (State code for GST)
    place_of_supply = Column(String(2))
    place_of_supply_name = Column(String(100))
    
    # Reverse charge mechanism
    is_reverse_charge = Column(Boolean, default=False)
    
    # Amounts (all in INR)
    subtotal = Column(Numeric(14, 2), default=0)
    discount_amount = Column(Numeric(14, 2), default=0)
    
    # GST breakup - Input Credit
    cgst_amount = Column(Numeric(14, 2), default=0)
    sgst_amount = Column(Numeric(14, 2), default=0)
    igst_amount = Column(Numeric(14, 2), default=0)
    cess_amount = Column(Numeric(14, 2), default=0)
    
    total_tax = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    
    # TDS (Tax Deducted at Source)
    tds_applicable = Column(Boolean, default=False)
    tds_section_id = Column(String(36), ForeignKey("tds_sections.id", ondelete="SET NULL"))
    tds_rate = Column(Numeric(5, 2), default=0)
    tds_amount = Column(Numeric(14, 2), default=0)
    
    # Net payable (after TDS deduction)
    net_payable = Column(Numeric(14, 2), default=0)
    
    # Payment tracking
    amount_paid = Column(Numeric(14, 2), default=0)
    balance_due = Column(Numeric(14, 2), default=0)
    outstanding_amount = Column(Numeric(14, 2), default=0)
    
    # Status
    status = Column(Enum(PurchaseInvoiceStatus), default=PurchaseInvoiceStatus.DRAFT)
    
    # GST eligibility for input credit
    itc_eligible = Column(Boolean, default=True)
    itc_claimed = Column(Boolean, default=False)
    
    # Additional info
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company")
    vendor = relationship("Customer")
    purchase_order = relationship("PurchaseOrder")
    receipt_note = relationship("ReceiptNote")
    tds_section = relationship("TDSSection")
    items = relationship("PurchaseInvoiceItem", back_populates="purchase_invoice", cascade="all, delete-orphan")
    payments = relationship("PurchasePayment", back_populates="purchase_invoice", cascade="all, delete-orphan")
    tds_entries = relationship("TDSEntry", back_populates="purchase_invoice", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_purchase_invoice_company", "company_id"),
        Index("idx_purchase_invoice_vendor", "vendor_id"),
        Index("idx_purchase_invoice_date", "invoice_date"),
        Index("idx_purchase_invoice_status", "status"),
    )

    def __repr__(self):
        return f"<PurchaseInvoice {self.invoice_number}>"


class PurchaseInvoiceItem(Base):
    """Purchase Invoice line item model."""
    __tablename__ = "purchase_invoice_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    purchase_invoice_id = Column(String(36), ForeignKey("purchase_invoices.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    
    # Item details
    description = Column(String(500), nullable=False)
    hsn_code = Column(String(8))
    
    # Quantity and pricing
    quantity = Column(Numeric(10, 3), nullable=False)
    unit = Column(String(20), default="unit")
    unit_price = Column(Numeric(12, 2), nullable=False)
    
    # Discount
    discount_percent = Column(Numeric(5, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    
    # Tax
    gst_rate = Column(Numeric(5, 2), nullable=False)
    cgst_rate = Column(Numeric(5, 2), default=0)
    sgst_rate = Column(Numeric(5, 2), default=0)
    igst_rate = Column(Numeric(5, 2), default=0)
    
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)
    cess_amount = Column(Numeric(12, 2), default=0)
    
    # Totals
    taxable_amount = Column(Numeric(14, 2), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    
    # ITC eligibility for this item
    itc_eligible = Column(Boolean, default=True)
    
    # Stock tracking
    stock_received = Column(Boolean, default=False)
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    purchase_invoice = relationship("PurchaseInvoice", back_populates="items")
    product = relationship("Product")
    godown = relationship("Godown")

    __table_args__ = (
        Index("idx_purchase_item_invoice", "purchase_invoice_id"),
    )

    def __repr__(self):
        return f"<PurchaseInvoiceItem {self.description[:30]}>"


class PurchasePayment(Base):
    """Payment model for purchase invoices."""
    __tablename__ = "purchase_payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    purchase_invoice_id = Column(String(36), ForeignKey("purchase_invoices.id", ondelete="CASCADE"), nullable=False)
    
    # Payment details
    amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    payment_mode = Column(Enum(PaymentMode), nullable=False)
    
    # Reference
    reference_number = Column(String(100))
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    
    # Transaction linking
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    purchase_invoice = relationship("PurchaseInvoice", back_populates="payments")
    bank_account = relationship("BankAccount")
    transaction = relationship("Transaction")

    __table_args__ = (
        Index("idx_purchase_payment_invoice", "purchase_invoice_id"),
        Index("idx_purchase_payment_date", "payment_date"),
    )

    def __repr__(self):
        return f"<PurchasePayment {self.amount} for PI {self.purchase_invoice_id}>"


class TDSEntry(Base):
    """TDS Entry model - Tracks TDS deductions."""
    __tablename__ = "tds_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Linked purchase invoice
    purchase_invoice_id = Column(String(36), ForeignKey("purchase_invoices.id", ondelete="CASCADE"))
    
    # Deductee (Vendor) details
    vendor_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    vendor_name = Column(String(255))
    vendor_pan = Column(String(10))
    
    # TDS details
    tds_section_id = Column(String(36), ForeignKey("tds_sections.id", ondelete="SET NULL"))
    section_code = Column(String(20))
    
    # Financial details
    gross_amount = Column(Numeric(14, 2), nullable=False)
    tds_rate = Column(Numeric(5, 2), nullable=False)
    tds_amount = Column(Numeric(14, 2), nullable=False)
    
    # Deduction date
    deduction_date = Column(DateTime, nullable=False)
    
    # Challan details (when TDS is deposited)
    challan_number = Column(String(50))
    challan_date = Column(DateTime)
    bsr_code = Column(String(10))
    
    # Status
    is_deposited = Column(Boolean, default=False)
    deposit_date = Column(DateTime)
    
    # Quarter (for TDS return filing)
    financial_year = Column(String(9))
    quarter = Column(String(2))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company")
    purchase_invoice = relationship("PurchaseInvoice", back_populates="tds_entries")
    vendor = relationship("Customer")
    tds_section = relationship("TDSSection")

    __table_args__ = (
        Index("idx_tds_entry_company", "company_id"),
        Index("idx_tds_entry_vendor", "vendor_id"),
        Index("idx_tds_entry_date", "deduction_date"),
        Index("idx_tds_entry_quarter", "financial_year", "quarter"),
    )

    def __repr__(self):
        return f"<TDSEntry {self.section_code} - {self.tds_amount}>"


# ============== NEW TALLY PARITY MODELS ==============

# ============== INVENTORY ENHANCEMENTS ==============

class ProductUnit(Base):
    """Alternate units of measure with conversion factors."""
    __tablename__ = "product_units"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    
    unit_name = Column(String(50), nullable=False)
    symbol = Column(String(20))
    conversion_factor = Column(Numeric(15, 6), nullable=False)
    is_primary = Column(Boolean, default=False)
    
    # For purchases vs sales
    is_purchase_unit = Column(Boolean, default=True)
    is_sales_unit = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_product_unit_product", "product_id"),
    )

    def __repr__(self):
        return f"<ProductUnit {self.unit_name}>"


class PriceLevel(Base):
    """Price levels like MRP, Retail, Wholesale, Dealer."""
    __tablename__ = "price_levels"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(100), nullable=False)
    code = Column(String(20))
    description = Column(Text)
    
    # Discount from MRP
    discount_percentage = Column(Numeric(5, 2), default=0)
    
    # Priority (lower = higher priority)
    priority = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_price_level_company", "company_id"),
    )

    def __repr__(self):
        return f"<PriceLevel {self.name}>"


class ProductPrice(Base):
    """Product prices by price level with effective dates."""
    __tablename__ = "product_prices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    price_level_id = Column(String(36), ForeignKey("price_levels.id", ondelete="CASCADE"), nullable=False)
    
    price = Column(Numeric(15, 2), nullable=False)
    effective_from = Column(DateTime, nullable=False)
    effective_to = Column(DateTime)
    
    # Optional: price per unit
    unit_id = Column(String(36), ForeignKey("product_units.id", ondelete="SET NULL"))
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_product_price_product", "product_id"),
        Index("idx_product_price_level", "price_level_id"),
        Index("idx_product_price_date", "effective_from"),
    )

    def __repr__(self):
        return f"<ProductPrice {self.price} from {self.effective_from}>"


class SerialNumberStatus(str, PyEnum):
    """Serial number status."""
    AVAILABLE = "available"
    SOLD = "sold"
    DAMAGED = "damaged"
    RETURNED = "returned"
    RESERVED = "reserved"


class SerialNumber(Base):
    """Serial/IMEI number tracking for items."""
    __tablename__ = "serial_numbers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    
    serial_number = Column(String(100), nullable=False)
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="SET NULL"))
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    status = Column(Enum(SerialNumberStatus), default=SerialNumberStatus.AVAILABLE)
    
    # Purchase reference
    purchase_invoice_id = Column(String(36), ForeignKey("purchase_invoices.id", ondelete="SET NULL"))
    purchase_date = Column(DateTime)
    purchase_rate = Column(Numeric(14, 2))
    
    # Sales reference
    sales_invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"))
    sales_date = Column(DateTime)
    sales_rate = Column(Numeric(14, 2))
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Warranty
    warranty_start_date = Column(DateTime)
    warranty_expiry_date = Column(DateTime)
    warranty_terms = Column(Text)
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_serial_company", "company_id"),
        Index("idx_serial_product", "product_id"),
        Index("idx_serial_number_unique", "company_id", "serial_number", unique=True),
        Index("idx_serial_status", "status"),
    )

    def __repr__(self):
        return f"<SerialNumber {self.serial_number}>"


class StockAdjustmentStatus(str, PyEnum):
    """Stock adjustment status."""
    DRAFT = "draft"
    VERIFIED = "verified"
    APPROVED = "approved"
    POSTED = "posted"


class StockAdjustment(Base):
    """Physical stock verification and adjustment."""
    __tablename__ = "stock_adjustments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    adjustment_number = Column(String(50), nullable=False)
    adjustment_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    status = Column(Enum(StockAdjustmentStatus), default=StockAdjustmentStatus.DRAFT)
    
    # Totals
    total_items = Column(Integer, default=0)
    total_variance_value = Column(Numeric(14, 2), default=0)
    
    # Workflow
    verified_by = Column(String(36))
    verified_at = Column(DateTime)
    approved_by = Column(String(36))
    approved_at = Column(DateTime)
    
    # Linked transaction (for accounting entry)
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    reason = Column(Text)
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("StockAdjustmentItem", back_populates="adjustment", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_stock_adj_company", "company_id"),
        Index("idx_stock_adj_date", "adjustment_date"),
    )

    def __repr__(self):
        return f"<StockAdjustment {self.adjustment_number}>"


class StockAdjustmentItem(Base):
    """Individual items in stock adjustment."""
    __tablename__ = "stock_adjustment_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    adjustment_id = Column(String(36), ForeignKey("stock_adjustments.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="SET NULL"))
    
    # Quantities
    book_quantity = Column(Numeric(14, 3), nullable=False)
    physical_quantity = Column(Numeric(14, 3), nullable=False)
    variance_quantity = Column(Numeric(14, 3), nullable=False)
    
    # Values
    rate = Column(Numeric(14, 2), default=0)
    variance_value = Column(Numeric(14, 2), default=0)
    
    reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    adjustment = relationship("StockAdjustment", back_populates="items")

    __table_args__ = (
        Index("idx_stock_adj_item_adj", "adjustment_id"),
    )

    def __repr__(self):
        return f"<StockAdjustmentItem {self.variance_quantity}>"


class DiscountType(str, PyEnum):
    """Discount type."""
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    QUANTITY_BASED = "quantity_based"
    BUY_X_GET_Y = "buy_x_get_y"


class DiscountRule(Base):
    """Item-wise and category-wise discount rules."""
    __tablename__ = "discount_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    discount_type = Column(Enum(DiscountType), nullable=False)
    
    # Applicability
    applies_to = Column(String(20), default="all")
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"))
    stock_group_id = Column(String(36), ForeignKey("stock_groups.id", ondelete="CASCADE"))
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"))
    price_level_id = Column(String(36), ForeignKey("price_levels.id", ondelete="CASCADE"))
    
    # Discount values
    discount_value = Column(Numeric(10, 2), nullable=False)
    
    # Quantity-based rules
    min_quantity = Column(Numeric(14, 3))
    max_quantity = Column(Numeric(14, 3))
    
    # Buy X Get Y
    buy_quantity = Column(Numeric(14, 3))
    free_quantity = Column(Numeric(14, 3))
    
    # Validity
    effective_from = Column(DateTime)
    effective_to = Column(DateTime)
    
    # Limits
    max_discount_amount = Column(Numeric(14, 2))
    usage_limit = Column(Integer)
    usage_count = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_discount_rule_company", "company_id"),
        Index("idx_discount_rule_product", "product_id"),
    )

    def __repr__(self):
        return f"<DiscountRule {self.name}>"


class ManufacturingOrderStatus(str, PyEnum):
    """Manufacturing order status."""
    DRAFT = "draft"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ManufacturingOrder(Base):
    """Manufacturing/Production order (Stock Journal)."""
    __tablename__ = "manufacturing_orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    order_number = Column(String(50), nullable=False)
    order_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # BOM reference
    bom_id = Column(String(36), ForeignKey("bills_of_material.id", ondelete="SET NULL"))
    
    # Finished product
    finished_product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    planned_quantity = Column(Numeric(14, 3), nullable=False)
    produced_quantity = Column(Numeric(14, 3), default=0)
    
    # Godowns
    production_godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    finished_goods_godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    status = Column(Enum(ManufacturingOrderStatus), default=ManufacturingOrderStatus.DRAFT)
    
    # Dates
    planned_start_date = Column(DateTime)
    planned_end_date = Column(DateTime)
    actual_start_date = Column(DateTime)
    actual_end_date = Column(DateTime)
    
    # Costs
    estimated_cost = Column(Numeric(14, 2), default=0)
    actual_cost = Column(Numeric(14, 2), default=0)
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    consumption_items = relationship("ManufacturingConsumption", back_populates="order", cascade="all, delete-orphan")
    byproducts = relationship("ManufacturingByproduct", back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_mfg_order_company", "company_id"),
        Index("idx_mfg_order_date", "order_date"),
        Index("idx_mfg_order_status", "status"),
    )

    def __repr__(self):
        return f"<ManufacturingOrder {self.order_number}>"


class ManufacturingConsumption(Base):
    """Raw materials consumed in manufacturing."""
    __tablename__ = "manufacturing_consumption"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("manufacturing_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="SET NULL"))
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    planned_quantity = Column(Numeric(14, 3), nullable=False)
    actual_quantity = Column(Numeric(14, 3), default=0)
    
    rate = Column(Numeric(14, 2), default=0)
    value = Column(Numeric(14, 2), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("ManufacturingOrder", back_populates="consumption_items")

    __table_args__ = (
        Index("idx_mfg_consumption_order", "order_id"),
    )

    def __repr__(self):
        return f"<ManufacturingConsumption {self.product_id}>"


class ManufacturingByproduct(Base):
    """Byproducts from manufacturing."""
    __tablename__ = "manufacturing_byproducts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("manufacturing_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    quantity = Column(Numeric(14, 3), nullable=False)
    rate = Column(Numeric(14, 2), default=0)
    value = Column(Numeric(14, 2), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("ManufacturingOrder", back_populates="byproducts")

    __table_args__ = (
        Index("idx_mfg_byproduct_order", "order_id"),
    )

    def __repr__(self):
        return f"<ManufacturingByproduct {self.product_id}>"


# ============== BANKING MODELS ==============

class ChequeBook(Base):
    """Cheque book register."""
    __tablename__ = "cheque_books"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    
    book_name = Column(String(100))
    cheque_series_from = Column(String(20), nullable=False)
    cheque_series_to = Column(String(20), nullable=False)
    current_cheque = Column(String(20))
    
    total_leaves = Column(Integer, nullable=False)
    used_leaves = Column(Integer, default=0)
    
    received_date = Column(DateTime)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cheques = relationship("Cheque", back_populates="cheque_book", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_cheque_book_company", "company_id"),
        Index("idx_cheque_book_bank", "bank_account_id"),
    )

    def __repr__(self):
        return f"<ChequeBook {self.cheque_series_from}-{self.cheque_series_to}>"


class ChequeStatus(str, PyEnum):
    """Cheque status."""
    BLANK = "blank"
    ISSUED = "issued"
    RECEIVED = "received"
    DEPOSITED = "deposited"
    CLEARED = "cleared"
    BOUNCED = "bounced"
    CANCELLED = "cancelled"
    STOPPED = "stopped"


class ChequeType(str, PyEnum):
    """Cheque type."""
    ISSUED = "issued"
    RECEIVED = "received"


class Cheque(Base):
    """Individual cheque records."""
    __tablename__ = "cheques"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    cheque_book_id = Column(String(36), ForeignKey("cheque_books.id", ondelete="SET NULL"))
    
    cheque_type = Column(Enum(ChequeType), nullable=False)
    cheque_number = Column(String(20), nullable=False)
    cheque_date = Column(DateTime, nullable=False)
    
    # For issued cheques
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    
    # For received cheques
    drawn_on_bank = Column(String(255))
    drawn_on_branch = Column(String(255))
    
    amount = Column(Numeric(14, 2), nullable=False)
    payee_name = Column(String(255))
    drawer_name = Column(String(255))
    
    # Party reference
    party_id = Column(String(36))
    party_type = Column(String(20))
    
    status = Column(Enum(ChequeStatus), default=ChequeStatus.BLANK)
    
    # Dates
    issue_date = Column(DateTime)
    deposit_date = Column(DateTime)
    clearing_date = Column(DateTime)
    
    # Bounce details
    bounce_date = Column(DateTime)
    bounce_reason = Column(Text)
    bounce_charges = Column(Numeric(10, 2), default=0)
    
    # Stop payment
    stop_date = Column(DateTime)
    stop_reason = Column(Text)
    
    # Transaction reference
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    # Invoice reference
    invoice_id = Column(String(36))
    invoice_type = Column(String(20))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cheque_book = relationship("ChequeBook", back_populates="cheques")

    __table_args__ = (
        Index("idx_cheque_company", "company_id"),
        Index("idx_cheque_number", "company_id", "cheque_number"),
        Index("idx_cheque_status", "status"),
        Index("idx_cheque_date", "cheque_date"),
    )

    def __repr__(self):
        return f"<Cheque {self.cheque_number}>"


class PostDatedCheque(Base):
    """Post-dated cheques (PDC) tracking."""
    __tablename__ = "post_dated_cheques"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    pdc_type = Column(String(20), nullable=False)
    
    # Party
    party_id = Column(String(36))
    party_type = Column(String(20))
    party_name = Column(String(255))
    
    # Cheque details
    cheque_number = Column(String(20), nullable=False)
    cheque_date = Column(DateTime, nullable=False)
    bank_name = Column(String(255))
    branch_name = Column(String(255))
    
    amount = Column(Numeric(14, 2), nullable=False)
    
    status = Column(String(20), default="pending")
    
    # Dates
    received_date = Column(DateTime)
    deposit_date = Column(DateTime)
    clearing_date = Column(DateTime)
    
    # Reference
    invoice_id = Column(String(36))
    invoice_type = Column(String(20))
    
    # Linked to actual cheque when deposited
    cheque_id = Column(String(36), ForeignKey("cheques.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_pdc_company", "company_id"),
        Index("idx_pdc_date", "cheque_date"),
        Index("idx_pdc_status", "status"),
    )

    def __repr__(self):
        return f"<PostDatedCheque {self.cheque_number}>"


class BankReconciliation(Base):
    """Bank reconciliation statement header."""
    __tablename__ = "bank_reconciliations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    
    reconciliation_date = Column(DateTime, nullable=False)
    period_from = Column(DateTime, nullable=False)
    period_to = Column(DateTime, nullable=False)
    
    # Balances
    opening_balance_book = Column(Numeric(14, 2), default=0)
    closing_balance_book = Column(Numeric(14, 2), default=0)
    opening_balance_bank = Column(Numeric(14, 2), default=0)
    closing_balance_bank = Column(Numeric(14, 2), default=0)
    
    # Counts
    total_entries = Column(Integer, default=0)
    matched_entries = Column(Integer, default=0)
    unmatched_entries = Column(Integer, default=0)
    
    # Differences
    cheques_issued_not_presented = Column(Numeric(14, 2), default=0)
    cheques_deposited_not_cleared = Column(Numeric(14, 2), default=0)
    bank_charges_not_recorded = Column(Numeric(14, 2), default=0)
    interest_not_recorded = Column(Numeric(14, 2), default=0)
    other_differences = Column(Numeric(14, 2), default=0)
    
    status = Column(String(20), default="draft")
    
    completed_by = Column(String(36))
    completed_at = Column(DateTime)
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    entries = relationship("ReconciliationEntry", back_populates="reconciliation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_brs_company", "company_id"),
        Index("idx_brs_bank", "bank_account_id"),
        Index("idx_brs_date", "reconciliation_date"),
    )

    def __repr__(self):
        return f"<BankReconciliation {self.reconciliation_date}>"


class ReconciliationEntry(Base):
    """Individual reconciliation entries."""
    __tablename__ = "reconciliation_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    reconciliation_id = Column(String(36), ForeignKey("bank_reconciliations.id", ondelete="CASCADE"), nullable=False)
    
    # Book entry
    transaction_entry_id = Column(String(36), ForeignKey("transaction_entries.id", ondelete="SET NULL"))
    book_date = Column(DateTime)
    book_amount = Column(Numeric(14, 2))
    book_reference = Column(String(100))
    
    # Bank statement entry
    bank_date = Column(DateTime)
    bank_amount = Column(Numeric(14, 2))
    bank_reference = Column(String(100))
    bank_description = Column(Text)
    
    # Matching
    is_matched = Column(Boolean, default=False)
    match_type = Column(String(20))
    match_confidence = Column(Numeric(5, 2))
    
    difference = Column(Numeric(14, 2), default=0)
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    reconciliation = relationship("BankReconciliation", back_populates="entries")

    __table_args__ = (
        Index("idx_recon_entry_recon", "reconciliation_id"),
    )

    def __repr__(self):
        return f"<ReconciliationEntry {self.is_matched}>"


class RecurringFrequency(str, PyEnum):
    """Recurring transaction frequency."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    HALF_YEARLY = "half_yearly"
    YEARLY = "yearly"


class RecurringTransaction(Base):
    """Recurring/Standing transactions."""
    __tablename__ = "recurring_transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Template transaction
    voucher_type = Column(Enum(VoucherType), nullable=False)
    template_data = Column(JSON)
    
    # Party
    party_id = Column(String(36))
    party_type = Column(String(20))
    
    # Amount
    amount = Column(Numeric(14, 2), nullable=False)
    
    # Account mapping for journal entries
    debit_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    credit_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    category = Column(String(100))
    
    # Schedule
    frequency = Column(Enum(RecurringFrequency), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    next_date = Column(DateTime, nullable=False)
    
    # Day of month/week
    day_of_month = Column(Integer)
    day_of_week = Column(Integer)
    
    # Limits
    total_occurrences = Column(Integer)
    occurrences_created = Column(Integer, default=0)
    
    # Settings
    auto_create = Column(Boolean, default=True)
    reminder_days = Column(Integer, default=3)
    
    is_active = Column(Boolean, default=True)
    
    last_created_at = Column(DateTime)
    last_transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    # Relationships
    debit_account = relationship("Account", foreign_keys=[debit_account_id])
    credit_account = relationship("Account", foreign_keys=[credit_account_id])
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_recurring_company", "company_id"),
        Index("idx_recurring_next", "next_date"),
        Index("idx_recurring_active", "is_active"),
    )

    def __repr__(self):
        return f"<RecurringTransaction {self.name}>"


# ============== ACCOUNTING MODELS ==============

class BillAllocationType(str, PyEnum):
    """Bill allocation type."""
    AGAINST_REFERENCE = "against_ref"
    NEW_REFERENCE = "new_ref"
    ADVANCE = "advance"
    ON_ACCOUNT = "on_account"


class BillAllocation(Base):
    """Bill-wise payment allocation."""
    __tablename__ = "bill_allocations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Payment transaction
    payment_transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    
    # Invoice reference
    invoice_id = Column(String(36), nullable=False)
    invoice_type = Column(String(20), nullable=False)
    invoice_number = Column(String(50))
    
    # Allocation
    allocation_type = Column(Enum(BillAllocationType), nullable=False)
    allocated_amount = Column(Numeric(14, 2), nullable=False)
    allocation_date = Column(DateTime, nullable=False)
    
    # Party
    party_id = Column(String(36))
    party_type = Column(String(20))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_bill_alloc_company", "company_id"),
        Index("idx_bill_alloc_payment", "payment_transaction_id"),
        Index("idx_bill_alloc_invoice", "invoice_id", "invoice_type"),
    )

    def __repr__(self):
        return f"<BillAllocation {self.allocated_amount}>"


class AccountMappingType(str, PyEnum):
    """Account mapping type for different transaction categories."""
    RECURRING_EXPENSE = "recurring_expense"
    RECURRING_INCOME = "recurring_income"
    PAYROLL = "payroll"
    INVENTORY = "inventory"
    TAX = "tax"


class AccountMapping(Base):
    """Default account mappings for different transaction types."""
    __tablename__ = "account_mappings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Mapping type
    mapping_type = Column(Enum(AccountMappingType), nullable=False)
    
    # Category within type (e.g., 'rent', 'utilities', 'salary', 'pf')
    category = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    
    # Account mapping
    debit_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    credit_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    
    # For payroll: single account mapping per component
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    is_debit = Column(Boolean, default=True)
    
    # Settings
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    debit_account = relationship("Account", foreign_keys=[debit_account_id])
    credit_account = relationship("Account", foreign_keys=[credit_account_id])
    account = relationship("Account", foreign_keys=[account_id])

    __table_args__ = (
        Index("idx_acc_mapping_company", "company_id"),
        Index("idx_acc_mapping_type", "mapping_type", "category"),
        UniqueConstraint("company_id", "mapping_type", "category", name="uq_account_mapping"),
    )

    def __repr__(self):
        return f"<AccountMapping {self.name}>"


class PayrollAccountConfig(Base):
    """Payroll-specific account configuration for salary components."""
    __tablename__ = "payroll_account_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Salary component reference
    salary_component_id = Column(String(36), ForeignKey("salary_components.id", ondelete="CASCADE"))
    component_type = Column(String(50))
    component_name = Column(String(100))
    
    # Account mapping
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    is_debit = Column(Boolean, default=True)
    
    # For employer contributions, we may need both sides
    contra_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"))
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    salary_component = relationship("SalaryComponent")
    account = relationship("Account", foreign_keys=[account_id])
    contra_account = relationship("Account", foreign_keys=[contra_account_id])

    __table_args__ = (
        Index("idx_payroll_acc_company", "company_id"),
        Index("idx_payroll_acc_component", "salary_component_id"),
    )

    def __repr__(self):
        return f"<PayrollAccountConfig {self.component_name}>"


class PeriodLock(Base):
    """Period locking to prevent backdated entries."""
    __tablename__ = "period_locks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    locked_from = Column(DateTime, nullable=False)
    locked_to = Column(DateTime, nullable=False)
    
    # Specific voucher types (null = all)
    voucher_types = Column(JSON)
    
    reason = Column(Text)
    
    locked_by = Column(String(36))
    locked_at = Column(DateTime, default=datetime.utcnow)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_period_lock_company", "company_id"),
        Index("idx_period_lock_dates", "locked_from", "locked_to"),
    )

    def __repr__(self):
        return f"<PeriodLock {self.locked_from} to {self.locked_to}>"


class AuditLog(Base):
    """Audit trail for all changes."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # What was changed
    table_name = Column(String(100), nullable=False)
    record_id = Column(String(36), nullable=False)
    
    # Action
    action = Column(String(20), nullable=False)
    
    # Values
    old_values = Column(JSON)
    new_values = Column(JSON)
    
    # Changes summary
    changed_fields = Column(JSON)
    
    # Who changed
    changed_by = Column(String(36))
    changed_by_name = Column(String(255))
    
    # When
    changed_at = Column(DateTime, default=datetime.utcnow)
    
    # Context
    ip_address = Column(String(45))
    user_agent = Column(Text)
    
    # Session
    session_id = Column(String(100))

    __table_args__ = (
        Index("idx_audit_company", "company_id"),
        Index("idx_audit_table", "table_name", "record_id"),
        Index("idx_audit_date", "changed_at"),
        Index("idx_audit_user", "changed_by"),
    )

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.table_name}>"


# ============== MISSING MODEL DEFINITIONS ==============


class NarrationTemplate(Base):
    """Narration templates per voucher type."""
    __tablename__ = "narration_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    voucher_type = Column(Enum(VoucherType), nullable=False)
    
    # Template with placeholders
    # e.g., "Being payment to {{party_name}} against {{invoice_number}} dated {{invoice_date}}"
    template_text = Column(Text, nullable=False)
    
    # Available placeholders for this template
    placeholders = Column(JSON)  # ["party_name", "invoice_number", "amount"]
    
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_narration_company", "company_id"),
        Index("idx_narration_voucher", "voucher_type"),
    )

    def __repr__(self):
        return f"<NarrationTemplate {self.name}>"


class Scenario(Base):
    """What-if scenario management."""
    __tablename__ = "scenarios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Include optional vouchers in this scenario
    include_optional_vouchers = Column(Boolean, default=False)
    
    # Filters
    from_date = Column(DateTime)
    to_date = Column(DateTime)
    voucher_types = Column(JSON)  # Filter by voucher types
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_scenario_company", "company_id"),
    )

    def __repr__(self):
        return f"<Scenario {self.name}>"


# ============== MISCELLANEOUS MODELS ==============

class Attachment(Base):
    """Document attachments to any entity."""
    __tablename__ = "attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Reference to any entity
    entity_type = Column(String(50), nullable=False)  # voucher, customer, product, invoice
    entity_id = Column(String(36), nullable=False)
    
    # File details
    file_name = Column(String(255), nullable=False)
    original_name = Column(String(255))
    file_type = Column(String(50))  # pdf, jpg, png, xlsx
    mime_type = Column(String(100))
    file_size = Column(Integer)  # bytes
    
    # Storage
    file_url = Column(Text)  # S3 URL or local path
    thumbnail_url = Column(Text)  # For images
    
    # Metadata
    description = Column(Text)
    tags = Column(JSON)  # ["invoice", "receipt"]
    
    uploaded_by = Column(String(36))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_attachment_company", "company_id"),
        Index("idx_attachment_entity", "entity_type", "entity_id"),
    )

    def __repr__(self):
        return f"<Attachment {self.file_name}>"


class NotificationType(str, PyEnum):
    """Notification type."""
    PAYMENT_DUE = "payment_due"
    PAYMENT_RECEIVED = "payment_received"
    LOW_STOCK = "low_stock"
    CHEQUE_MATURITY = "cheque_maturity"
    GST_FILING = "gst_filing"
    INVOICE_OVERDUE = "invoice_overdue"
    APPROVAL_PENDING = "approval_pending"
    SYSTEM = "system"


class Notification(Base):
    """In-app notifications."""
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    
    notification_type = Column(Enum(NotificationType), nullable=False)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Reference to related entity
    entity_type = Column(String(50))
    entity_id = Column(String(36))
    
    # Action URL
    action_url = Column(String(500))
    
    # Priority
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    
    # Status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime)
    
    # Scheduling
    scheduled_for = Column(DateTime)  # For future notifications
    
    expires_at = Column(DateTime)  # Auto-expire old notifications
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_notification_company", "company_id"),
        Index("idx_notification_user", "user_id"),
        Index("idx_notification_read", "is_read"),
        Index("idx_notification_type", "notification_type"),
    )

    def __repr__(self):
        return f"<Notification {self.title}>"


class DashboardWidget(Base):
    """Dashboard widget configuration per user."""
    __tablename__ = "dashboard_widgets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    
    widget_type = Column(String(50), nullable=False)  # sales_summary, cash_flow, receivables, etc.
    
    # Position
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=1)  # Grid units
    height = Column(Integer, default=1)
    
    # Configuration
    config = Column(JSON)  # Widget-specific settings
    
    is_visible = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_widget_company", "company_id"),
        Index("idx_widget_user", "user_id"),
    )

    def __repr__(self):
        return f"<DashboardWidget {self.widget_type}>"


class ExportLog(Base):
    """Track data exports."""
    __tablename__ = "export_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    
    export_type = Column(String(50), nullable=False)  # excel, pdf, csv
    report_name = Column(String(255), nullable=False)
    
    # Filters used
    filters = Column(JSON)
    
    # Result
    file_name = Column(String(255))
    file_url = Column(Text)
    file_size = Column(Integer)
    row_count = Column(Integer)
    
    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    error_message = Column(Text)
    
    # Access
    ip_address = Column(String(45))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_export_company", "company_id"),
        Index("idx_export_user", "user_id"),
        Index("idx_export_date", "created_at"),
    )

    def __repr__(self):
        return f"<ExportLog {self.report_name}>"


# ============== ADD NEW COLUMNS TO EXISTING TABLES ==============
# Note: These are handled via the model definitions above and will be 
# added when the database is reset. The columns are:
#
# Products: reorder_level, reorder_quantity, maximum_stock_level, 
#           track_serial_numbers, default_discount_percent
#
# Customers: credit_limit, credit_days, block_on_credit_exceed,
#            price_level_id, interest_rate
#
# Invoices: outstanding_amount
# PurchaseInvoices: outstanding_amount
#
# Transactions: is_optional, auto_reverse_date, scenario_id
#
# TransactionEntries: bank_date, is_reconciled, reconciliation_date,
#                     bank_reference, cheque_id
#
# Accounts: parent_id, level (already present)
#
# Companies: negative_stock_allowed, default_valuation_method


# ============== QUOTATION MODELS ==============

class QuotationStatus(str, PyEnum):
    """Quotation status enumeration."""
    DRAFT = "draft"
    SENT = "sent"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CONVERTED = "converted"


class Quotation(Base):
    """Quotation model - Pre-invoice document sent to customers for approval."""
    __tablename__ = "quotations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Sales pipeline tracking
    sales_ticket_id = Column(String(36), ForeignKey("sales_tickets.id", ondelete="SET NULL"))
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"))
    sales_person_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    
    # Quotation identification
    quotation_number = Column(String(50), nullable=False, index=True)
    quotation_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    validity_date = Column(DateTime)  # Quote expires after this date
    
    # Reference to original document if revised
    revised_from_id = Column(String(36), ForeignKey("quotations.id", ondelete="SET NULL"))
    revision_number = Column(Integer, default=0)
    
    # Place of supply (State code for GST)
    place_of_supply = Column(String(2))
    place_of_supply_name = Column(String(100))
    
    # Amounts (all in INR)
    subtotal = Column(Numeric(14, 2), default=0)
    discount_amount = Column(Numeric(14, 2), default=0)
    
    # GST breakup
    cgst_amount = Column(Numeric(14, 2), default=0)
    sgst_amount = Column(Numeric(14, 2), default=0)
    igst_amount = Column(Numeric(14, 2), default=0)
    cess_amount = Column(Numeric(14, 2), default=0)
    
    total_tax = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    
    # Status
    status = Column(Enum(QuotationStatus), default=QuotationStatus.DRAFT)
    
    # Customer approval tracking
    email_sent_at = Column(DateTime)
    email_sent_to = Column(String(255))
    viewed_at = Column(DateTime)
    approved_at = Column(DateTime)
    approved_by = Column(String(255))  # Customer name/email who approved
    rejected_at = Column(DateTime)
    rejection_reason = Column(Text)
    
    # Conversion tracking
    converted_invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"))
    converted_at = Column(DateTime)
    
    # Additional info
    subject = Column(String(255))  # Quote subject/title
    notes = Column(Text)
    terms = Column(Text)
    
    # PDF storage
    pdf_url = Column(String(500))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer")
    sales_ticket = relationship("SalesTicket")
    contact = relationship("Contact")
    sales_person = relationship("Employee")
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")
    converted_invoice = relationship("Invoice", foreign_keys=[converted_invoice_id])
    revised_from = relationship("Quotation", remote_side=[id])

    __table_args__ = (
        Index("idx_quotation_company", "company_id"),
        Index("idx_quotation_customer", "customer_id"),
        Index("idx_quotation_date", "quotation_date"),
        Index("idx_quotation_status", "status"),
        Index("idx_quotation_ticket", "sales_ticket_id"),
    )

    def __repr__(self):
        return f"<Quotation {self.quotation_number}>"


class QuotationItem(Base):
    """Quotation line item model."""
    __tablename__ = "quotation_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    quotation_id = Column(String(36), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    
    # Item details
    description = Column(String(500), nullable=False)
    hsn_code = Column(String(8))
    
    # Quantity and pricing
    quantity = Column(Numeric(10, 3), nullable=False)
    unit = Column(String(20), default="unit")
    unit_price = Column(Numeric(12, 2), nullable=False)
    
    # Discount
    discount_percent = Column(Numeric(5, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    
    # Tax
    gst_rate = Column(Numeric(5, 2), nullable=False)
    cgst_rate = Column(Numeric(5, 2), default=0)
    sgst_rate = Column(Numeric(5, 2), default=0)
    igst_rate = Column(Numeric(5, 2), default=0)
    
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)
    cess_amount = Column(Numeric(12, 2), default=0)
    
    # Totals
    taxable_amount = Column(Numeric(14, 2), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    quotation = relationship("Quotation", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        Index("idx_quotation_item_quotation", "quotation_id"),
    )

    def __repr__(self):
        return f"<QuotationItem {self.description[:30]}>"


# ============== DELIVERY CHALLAN MODELS ==============

class DeliveryChallanType(str, PyEnum):
    """Delivery Challan type enumeration."""
    DC_OUT = "dc_out"  # Goods dispatched to customer
    DC_IN = "dc_in"    # Goods returned by customer


class DeliveryChallanStatus(str, PyEnum):
    """Delivery Challan status enumeration."""
    DRAFT = "draft"
    DISPATCHED = "dispatched"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    PARTIALLY_RETURNED = "partially_returned"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class DeliveryChallan(Base):
    """Delivery Challan model - Document for goods dispatch (DC Out) and returns (DC In)."""
    __tablename__ = "delivery_challans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    
    # Sales pipeline tracking
    sales_ticket_id = Column(String(36), ForeignKey("sales_tickets.id", ondelete="SET NULL"))
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"))
    
    # DC identification
    dc_number = Column(String(50), nullable=False, index=True)
    dc_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    dc_type = Column(Enum(DeliveryChallanType), nullable=False, default=DeliveryChallanType.DC_OUT)
    
    # Status
    status = Column(Enum(DeliveryChallanStatus), default=DeliveryChallanStatus.DRAFT)
    
    # Linked documents
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"))
    quotation_id = Column(String(36), ForeignKey("quotations.id", ondelete="SET NULL"))
    sales_order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="SET NULL"))
    
    # For DC In (returns), reference to original DC Out
    original_dc_id = Column(String(36), ForeignKey("delivery_challans.id", ondelete="SET NULL"))
    
    # Return reason (for DC In)
    return_reason = Column(Text)
    
    # E-Way Bill (for goods > 50K)
    eway_bill_number = Column(String(20))
    eway_bill_date = Column(DateTime)
    eway_bill_valid_until = Column(DateTime)
    
    # Transport details
    transporter_name = Column(String(255))
    transporter_id = Column(String(20))  # GSTIN of transporter
    transport_mode = Column(String(20))  # road, rail, air, ship
    vehicle_number = Column(String(20))
    vehicle_type = Column(String(50))
    lr_number = Column(String(50))  # Lorry Receipt / Consignment Note
    lr_date = Column(DateTime)
    
    # Dispatch/Delivery addresses
    dispatch_from_address = Column(Text)
    dispatch_from_city = Column(String(100))
    dispatch_from_state = Column(String(100))
    dispatch_from_pincode = Column(String(10))
    
    delivery_to_address = Column(Text)
    delivery_to_city = Column(String(100))
    delivery_to_state = Column(String(100))
    delivery_to_pincode = Column(String(10))
    
    # From/To godown
    from_godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    to_godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    # Stock tracking
    stock_updated = Column(Boolean, default=False)
    stock_updated_at = Column(DateTime)
    
    # Delivery confirmation
    delivered_at = Column(DateTime)
    received_by = Column(String(255))
    receiver_signature_url = Column(String(500))
    
    notes = Column(Text)
    
    # PDF storage
    pdf_url = Column(String(500))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer")
    sales_ticket = relationship("SalesTicket")
    contact = relationship("Contact")
    invoice = relationship("Invoice")
    quotation = relationship("Quotation")
    sales_order = relationship("SalesOrder")
    original_dc = relationship("DeliveryChallan", remote_side=[id])
    from_godown = relationship("Godown", foreign_keys=[from_godown_id])
    to_godown = relationship("Godown", foreign_keys=[to_godown_id])
    items = relationship("DeliveryChallanItem", back_populates="delivery_challan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_dc_company", "company_id"),
        Index("idx_dc_customer", "customer_id"),
        Index("idx_dc_type", "dc_type"),
        Index("idx_dc_date", "dc_date"),
        Index("idx_dc_invoice", "invoice_id"),
        Index("idx_dc_status", "status"),
        Index("idx_dc_ticket", "sales_ticket_id"),
    )

    def __repr__(self):
        return f"<DeliveryChallan {self.dc_number} ({self.dc_type.value})>"


class DeliveryChallanItem(Base):
    """Delivery Challan line item model."""
    __tablename__ = "delivery_challan_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    delivery_challan_id = Column(String(36), ForeignKey("delivery_challans.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="SET NULL"))
    
    # Invoice item reference (if created from invoice)
    invoice_item_id = Column(String(36), ForeignKey("invoice_items.id", ondelete="SET NULL"))
    
    # Item details
    description = Column(String(500), nullable=False)
    hsn_code = Column(String(8))
    
    # Quantity
    quantity = Column(Numeric(14, 3), nullable=False)
    unit = Column(String(20), default="unit")
    
    # For partial dispatch tracking
    pending_quantity = Column(Numeric(14, 3), default=0)  # Remaining to dispatch
    
    # Unit price (for valuation purposes, not charged separately in DC)
    unit_price = Column(Numeric(12, 2), default=0)
    
    # Serial numbers (if tracked)
    serial_numbers = Column(JSON)  # List of serial numbers
    
    # Godown allocation for this item
    godown_id = Column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"))
    
    # Stock movement reference
    stock_movement_id = Column(String(36), ForeignKey("stock_entries.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    delivery_challan = relationship("DeliveryChallan", back_populates="items")
    product = relationship("Product")
    batch = relationship("Batch")
    invoice_item = relationship("InvoiceItem")
    godown = relationship("Godown")
    stock_entry = relationship("StockEntry")

    __table_args__ = (
        Index("idx_dc_item_dc", "delivery_challan_id"),
        Index("idx_dc_item_product", "product_id"),
    )

    def __repr__(self):
        return f"<DeliveryChallanItem {self.description[:30]}>"


# ============== SALES PIPELINE MODELS ==============

class Contact(Base):
    """Contact model - Contact persons at customer organizations."""
    __tablename__ = "contacts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    
    # Contact details
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    mobile = Column(String(20))
    
    # Role/Position
    designation = Column(String(100))  # e.g., "Manager", "Director"
    department = Column(String(100))   # e.g., "Procurement", "Finance"
    
    # Primary contact flag
    is_primary = Column(Boolean, default=False)
    is_decision_maker = Column(Boolean, default=False)
    
    # Notes
    notes = Column(Text)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer", back_populates="contacts")

    __table_args__ = (
        Index("idx_contact_company", "company_id"),
        Index("idx_contact_customer", "customer_id"),
    )

    def __repr__(self):
        return f"<Contact {self.name}>"


class EnquirySource(str, PyEnum):
    """Enquiry source enumeration."""
    WEBSITE = "website"
    PHONE_CALL = "phone_call"
    EMAIL = "email"
    REFERRAL = "referral"
    WALK_IN = "walk_in"
    TRADE_SHOW = "trade_show"
    SOCIAL_MEDIA = "social_media"
    ADVERTISEMENT = "advertisement"
    OTHER = "other"


class EnquiryStatus(str, PyEnum):
    """Enquiry status enumeration."""
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL_SENT = "proposal_sent"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"
    ON_HOLD = "on_hold"


class SalesTicketStatus(str, PyEnum):
    """Sales ticket status enumeration."""
    OPEN = "open"
    WON = "won"
    LOST = "lost"
    CANCELLED = "cancelled"


class SalesTicketStage(str, PyEnum):
    """Sales ticket stage enumeration."""
    ENQUIRY = "enquiry"
    QUOTATION = "quotation"
    SALES_ORDER = "sales_order"
    DELIVERY = "delivery"
    INVOICED = "invoiced"
    PAID = "paid"


class SalesTicket(Base):
    """Sales Ticket model - Master tracking entity for sales pipeline."""
    __tablename__ = "sales_tickets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Ticket identification
    ticket_number = Column(String(50), nullable=False, unique=True, index=True)  # TKT-YYYYMM-XXXX
    
    # Customer and contact
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"))
    
    # Sales person (from Employee model)
    sales_person_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    
    # Status and stage
    status = Column(Enum(SalesTicketStatus), default=SalesTicketStatus.OPEN)
    current_stage = Column(Enum(SalesTicketStage), default=SalesTicketStage.ENQUIRY)
    
    # Values
    expected_value = Column(Numeric(14, 2), default=0)
    actual_value = Column(Numeric(14, 2), default=0)
    
    # Dates
    created_date = Column(DateTime, default=datetime.utcnow)
    expected_close_date = Column(DateTime)
    actual_close_date = Column(DateTime)
    
    # Win/Loss tracking
    win_probability = Column(Integer, default=50)  # 0-100%
    loss_reason = Column(Text)
    competitor_name = Column(String(255))
    
    # Notes
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer")
    contact = relationship("Contact")
    sales_person = relationship("Employee")
    enquiries = relationship("Enquiry", back_populates="sales_ticket")
    logs = relationship("SalesTicketLog", back_populates="sales_ticket", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_ticket_company", "company_id"),
        Index("idx_ticket_customer", "customer_id"),
        Index("idx_ticket_status", "status"),
        Index("idx_ticket_stage", "current_stage"),
        Index("idx_ticket_sales_person", "sales_person_id"),
    )

    def __repr__(self):
        return f"<SalesTicket {self.ticket_number}>"


class EnquiryItem(Base):
    """Individual items in an enquiry."""
    __tablename__ = "enquiry_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    enquiry_id = Column(String(36), ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("items.id", ondelete="SET NULL"))
    
    description = Column(String(500), nullable=False)
    quantity = Column(Integer, default=1)
    
    # Image reference
    image_url = Column(String(500))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    enquiry = relationship("Enquiry", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        Index("idx_enquiry_item_enquiry", "enquiry_id"),
    )

    def __repr__(self):
        return f"<EnquiryItem {self.description[:30]}>"


class Enquiry(Base):
    """Enquiry model - Top of sales funnel."""
    __tablename__ = "enquiries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Enquiry identification
    enquiry_number = Column(String(50), nullable=False, index=True)  # ENQ-YYYYMM-XXXX
    enquiry_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Link to sales ticket
    sales_ticket_id = Column(String(36), ForeignKey("sales_tickets.id", ondelete="SET NULL"))
    
    # Customer and contact
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"))
    
    # For new customers (before creating customer record)
    prospect_name = Column(String(255))
    prospect_email = Column(String(255))
    prospect_phone = Column(String(20))
    prospect_company = Column(String(255))
    
    # Sales person
    sales_person_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    
    # Source tracking
    source = Column(Enum(EnquirySource), default=EnquirySource.OTHER)
    source_details = Column(String(255))  # e.g., campaign name, referrer name
    
    # Enquiry details
    subject = Column(String(500), nullable=False)
    description = Column(Text)
    requirements = Column(Text)
    
    # Products of interest (JSON array of product IDs or descriptions)
    products_interested = Column(JSON)
    
    # Values
    expected_value = Column(Numeric(14, 2), default=0)
    expected_quantity = Column(Numeric(14, 3))
    
    # Dates
    expected_close_date = Column(DateTime)
    follow_up_date = Column(DateTime)
    last_contact_date = Column(DateTime)
    
    # Status
    status = Column(Enum(EnquiryStatus), default=EnquiryStatus.NEW)
    priority = Column(String(20), default="medium")  # low, medium, high, urgent
    
    # Conversion tracking
    converted_quotation_id = Column(String(36), ForeignKey("quotations.id", ondelete="SET NULL"))
    converted_at = Column(DateTime)
    
    # Loss tracking
    lost_reason = Column(Text)
    lost_to_competitor = Column(String(255))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer")
    contact = relationship("Contact")
    sales_person = relationship("Employee")
    sales_ticket = relationship("SalesTicket", back_populates="enquiries")
    converted_quotation = relationship("Quotation", foreign_keys=[converted_quotation_id])
    items = relationship("EnquiryItem", back_populates="enquiry", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_enquiry_company", "company_id"),
        Index("idx_enquiry_customer", "customer_id"),
        Index("idx_enquiry_ticket", "sales_ticket_id"),
        Index("idx_enquiry_status", "status"),
        Index("idx_enquiry_date", "enquiry_date"),
    )

    def __repr__(self):
        return f"<Enquiry {self.enquiry_number}>"


class SalesTicketLogAction(str, PyEnum):
    """Sales ticket log action types."""
    CREATED = "created"
    STATUS_CHANGED = "status_changed"
    STAGE_CHANGED = "stage_changed"
    ENQUIRY_CREATED = "enquiry_created"
    QUOTATION_CREATED = "quotation_created"
    QUOTATION_SENT = "quotation_sent"
    QUOTATION_APPROVED = "quotation_approved"
    QUOTATION_REJECTED = "quotation_rejected"
    SALES_ORDER_CREATED = "sales_order_created"
    DELIVERY_CREATED = "delivery_created"
    DELIVERY_DISPATCHED = "delivery_dispatched"
    DELIVERY_COMPLETED = "delivery_completed"
    INVOICE_CREATED = "invoice_created"
    PAYMENT_RECEIVED = "payment_received"
    NOTE_ADDED = "note_added"
    CONTACT_CHANGED = "contact_changed"
    SALES_PERSON_CHANGED = "sales_person_changed"
    VALUE_UPDATED = "value_updated"
    FOLLOW_UP_SCHEDULED = "follow_up_scheduled"


class SalesTicketLogAction(str, PyEnum):
    """Sales ticket log action types."""
    CREATED = "created"
    STATUS_CHANGED = "status_changed"
    STAGE_CHANGED = "stage_changed"
    ENQUIRY_CREATED = "enquiry_created"
    QUOTATION_CREATED = "quotation_created"
    QUOTATION_SENT = "quotation_sent"
    QUOTATION_APPROVED = "quotation_approved"
    QUOTATION_REJECTED = "quotation_rejected"
    SALES_ORDER_CREATED = "sales_order_created"
    DELIVERY_CREATED = "delivery_created"
    DELIVERY_DISPATCHED = "delivery_dispatched"
    DELIVERY_COMPLETED = "delivery_completed"
    INVOICE_CREATED = "invoice_created"
    PAYMENT_RECEIVED = "payment_received"
    NOTE_ADDED = "note_added"
    CONTACT_CHANGED = "contact_changed"
    SALES_PERSON_CHANGED = "sales_person_changed"
    VALUE_UPDATED = "value_updated"
    FOLLOW_UP_SCHEDULED = "follow_up_scheduled"


class SalesTicketLog(Base):
    """Sales Ticket Log model - Activity timeline for sales tickets."""
    __tablename__ = "sales_ticket_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sales_ticket_id = Column(String(36), ForeignKey("sales_tickets.id", ondelete="CASCADE"), nullable=False)
    
    # Action details
    action_type = Column(Enum(SalesTicketLogAction), nullable=False)
    action_description = Column(String(500), nullable=False)
    
    # Change tracking
    old_value = Column(String(255))
    new_value = Column(String(255))
    
    # Related document (for linking to specific documents)
    related_document_type = Column(String(50))  # enquiry, quotation, sales_order, delivery_challan, invoice
    related_document_id = Column(String(36))
    
    # Who made the change
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_by_name = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sales_ticket = relationship("SalesTicket", back_populates="logs")
    user = relationship("User")

    __table_args__ = (
        Index("idx_ticket_log_ticket", "sales_ticket_id"),
        Index("idx_ticket_log_action", "action_type"),
        Index("idx_ticket_log_date", "created_at"),
    )

    def __repr__(self):
        return f"<SalesTicketLog {self.action_type.value}>"


# Indian State codes for GST
INDIAN_STATE_CODES = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu",
    "27": "Maharashtra",
    "28": "Andhra Pradesh (Old)",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Centre Jurisdiction",
}

