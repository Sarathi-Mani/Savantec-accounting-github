"""Invoice schemas."""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


class InvoiceStatus(str, Enum):
    """Invoice status."""
    DRAFT = "draft"
    PENDING = "pending"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    VOID = "void"
    WRITE_OFF = "write_off"


class InvoiceType(str, Enum):
    """Invoice type for GST."""
    B2B = "b2b"
    B2C = "b2c"
    B2CL = "b2cl"
    EXPORT = "export"
    SEZ = "sez"
    DEEMED_EXPORT = "deemed_export"


class PaymentMode(str, Enum):
    """Payment mode."""
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    CHEQUE = "cheque"
    CARD = "card"
    OTHER = "other"


class InvoiceItemCreate(BaseModel):
    """Schema for creating an invoice item."""
    product_id: Optional[str] = None
    description: str = Field(..., min_length=1, max_length=500)
    hsn_code: Optional[str] = None
    
    quantity: Decimal = Field(..., gt=0)
    unit: str = "unit"
    unit_price: Decimal = Field(..., gt=0)
    
    discount_percent: Decimal = Field(default=0, ge=0, le=100)
    gst_rate: Decimal = Field(..., ge=0)
    
    # Warehouse allocation (optional manual override)
    warehouse_allocation: Optional[List[dict]] = None

    @field_validator("hsn_code")
    @classmethod
    def validate_hsn_code(cls, v):
        """Validate HSN/SAC code format."""
        if v:
            if not v.isdigit() or len(v) < 4 or len(v) > 8:
                raise ValueError("HSN/SAC code must be 4-8 digits")
        return v


class InvoiceItemResponse(BaseModel):
    """Schema for invoice item response."""
    id: str
    invoice_id: str
    product_id: Optional[str] = None
    
    description: str
    hsn_code: Optional[str] = None
    
    quantity: Decimal
    unit: str
    unit_price: Decimal
    
    discount_percent: Decimal
    discount_amount: Decimal
    
    gst_rate: Decimal
    cgst_rate: Decimal
    sgst_rate: Decimal
    igst_rate: Decimal
    
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    cess_amount: Decimal
    
    taxable_amount: Decimal
    total_amount: Decimal
    
    # Warehouse allocation tracking
    warehouse_allocation: Optional[List[dict]] = None
    stock_reserved: bool = False
    stock_reduced: bool = False
    
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    """Schema for creating an invoice."""
    customer_id: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    
    invoice_type: InvoiceType = InvoiceType.B2C
    place_of_supply: Optional[str] = None  # State code
    is_reverse_charge: bool = False
    
    items: List[InvoiceItemCreate] = []
    
    notes: Optional[str] = None
    terms: Optional[str] = None
    
    # Warehouse allocation settings
    manual_warehouse_override: bool = False
    warehouse_allocations: Optional[dict] = None  # {"item_0": [{"godown_id": "xxx", "quantity": 10}], ...}
    
    # For quick invoices without full customer data
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_address: Optional[str] = None
    customer_state: Optional[str] = None
    customer_state_code: Optional[str] = None


class InvoiceUpdate(BaseModel):
    """Schema for updating an invoice."""
    customer_id: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    
    invoice_type: Optional[InvoiceType] = None
    place_of_supply: Optional[str] = None
    is_reverse_charge: Optional[bool] = None
    
    notes: Optional[str] = None
    terms: Optional[str] = None
    status: Optional[InvoiceStatus] = None


class PaymentCreate(BaseModel):
    """Schema for recording a payment."""
    amount: Decimal = Field(..., gt=0)
    payment_date: Optional[datetime] = None
    payment_mode: PaymentMode = PaymentMode.UPI
    reference_number: Optional[str] = None
    upi_transaction_id: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    """Schema for payment response."""
    id: str
    invoice_id: str
    amount: Decimal
    payment_date: datetime
    payment_mode: PaymentMode
    reference_number: Optional[str] = None
    upi_transaction_id: Optional[str] = None
    notes: Optional[str] = None
    is_verified: bool
    verified_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    """Schema for invoice response."""
    id: str
    company_id: str
    customer_id: Optional[str] = None
    
    invoice_number: str
    invoice_date: datetime
    due_date: Optional[datetime] = None
    
    invoice_type: str
    place_of_supply: Optional[str] = None
    place_of_supply_name: Optional[str] = None
    is_reverse_charge: bool
    
    subtotal: Decimal
    discount_amount: Decimal
    
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    cess_amount: Decimal
    total_tax: Decimal
    total_amount: Decimal
    
    amount_paid: Decimal
    balance_due: Decimal
    
    status: str
    
    payment_link: Optional[str] = None
    upi_qr_data: Optional[str] = None
    
    notes: Optional[str] = None
    terms: Optional[str] = None
    
    irn: Optional[str] = None
    pdf_url: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime
    
    items: List[InvoiceItemResponse] = []
    payments: List[PaymentResponse] = []
    
    # Customer details (flattened for response)
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    """Schema for invoice list response."""
    invoices: List[InvoiceResponse]
    total: int
    page: int
    page_size: int
    
    # Summary
    total_amount: Decimal = Decimal("0")
    total_paid: Decimal = Decimal("0")
    total_pending: Decimal = Decimal("0")


class InvoiceSummary(BaseModel):
    """Schema for invoice summary/dashboard."""
    total_invoices: int
    total_revenue: Decimal
    total_pending: Decimal
    total_paid: Decimal
    overdue_count: int
    overdue_amount: Decimal
    
    # Monthly breakdown
    current_month_revenue: Decimal
    current_month_invoices: int
    
    # GST summary
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal


class UPIQRResponse(BaseModel):
    """Schema for UPI QR code response."""
    qr_data: str
    qr_image_base64: str
    upi_link: str
    amount: Decimal
    invoice_number: str


class StatusChangeRequest(BaseModel):
    """Schema for changing invoice status."""
    reason: Optional[str] = None
    notes: Optional[str] = None
    refund_amount: Optional[Decimal] = None  # For partial refunds

