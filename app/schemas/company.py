"""Company schemas."""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re


class BankAccountCreate(BaseModel):
    """Schema for creating a bank account."""
    bank_name: str = Field(..., max_length=255)
    account_name: str = Field(..., max_length=255)
    account_number: str = Field(..., max_length=50)
    ifsc_code: str = Field(..., max_length=11)
    branch: Optional[str] = None
    upi_id: Optional[str] = None
    is_default: bool = False
    opening_balance: float = 0  # Opening balance for accounting

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v):
        """Validate IFSC code format."""
        if v and not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v.upper()):
            raise ValueError("Invalid IFSC code format")
        return v.upper() if v else v


class BankAccountUpdate(BaseModel):
    """Schema for updating a bank account."""
    bank_name: Optional[str] = Field(None, max_length=255)
    account_name: Optional[str] = Field(None, max_length=255)
    account_number: Optional[str] = Field(None, max_length=50)
    ifsc_code: Optional[str] = Field(None, max_length=11)
    branch: Optional[str] = None
    upi_id: Optional[str] = None
    is_default: Optional[bool] = None
    opening_balance: Optional[float] = None  # Update opening balance

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v):
        """Validate IFSC code format."""
        if v is None or v == "":
            return v
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v.upper()):
            raise ValueError("Invalid IFSC code format. Format should be like HDFC0001234")
        return v.upper()


class BankAccountResponse(BaseModel):
    """Schema for bank account response."""
    id: str
    bank_name: str
    account_name: str
    account_number: str
    ifsc_code: str
    branch: Optional[str] = None
    upi_id: Optional[str] = None
    is_default: bool
    is_active: bool
    created_at: datetime
    # Balance info from linked Chart of Accounts
    opening_balance: float = 0
    current_balance: float = 0
    linked_account_id: Optional[str] = None

    class Config:
        from_attributes = True


class CompanyCreate(BaseModel):
    """Schema for creating a company."""
    name: str = Field(..., min_length=2, max_length=255)
    trade_name: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    cin: Optional[str] = None
    
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    
    business_type: Optional[str] = None
    
    invoice_prefix: str = "INV"
    invoice_terms: Optional[str] = None
    invoice_notes: Optional[str] = None

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v):
        """Validate GSTIN format."""
        if v:
            gstin_pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
            if not re.match(gstin_pattern, v.upper()):
                raise ValueError("Invalid GSTIN format")
            return v.upper()
        return v

    @field_validator("pan")
    @classmethod
    def validate_pan(cls, v):
        """Validate PAN format."""
        if v:
            pan_pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
            if not re.match(pan_pattern, v.upper()):
                raise ValueError("Invalid PAN format")
            return v.upper()
        return v


class CompanyUpdate(BaseModel):
    """Schema for updating a company."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    trade_name: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    cin: Optional[str] = None
    
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    
    business_type: Optional[str] = None
    logo_url: Optional[str] = None
    signature_url: Optional[str] = None
    
    invoice_prefix: Optional[str] = None
    invoice_terms: Optional[str] = None
    invoice_notes: Optional[str] = None
    default_bank_id: Optional[str] = None
    
    # Inventory automation settings
    auto_reduce_stock: Optional[bool] = None
    warehouse_priorities: Optional[dict] = None


class CompanyResponse(BaseModel):
    """Schema for company response."""
    id: str
    name: str
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    cin: Optional[str] = None
    
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    country: str
    
    business_type: Optional[str] = None
    logo_url: Optional[str] = None
    signature_url: Optional[str] = None
    
    invoice_prefix: str
    invoice_counter: int
    invoice_terms: Optional[str] = None
    invoice_notes: Optional[str] = None
    default_bank_id: Optional[str] = None
    
    # Inventory automation settings
    auto_reduce_stock: bool = True
    warehouse_priorities: Optional[dict] = None
    
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    bank_accounts: List[BankAccountResponse] = []

    class Config:
        from_attributes = True

