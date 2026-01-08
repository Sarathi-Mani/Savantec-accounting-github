"""Customer schemas."""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict, condecimal
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from decimal import Decimal
import re
from enum import Enum


# Enums for consistent values
class OpeningBalanceType(str, Enum):
    OUTSTANDING = "outstanding"
    ADVANCE = "advance"


class OpeningBalanceMode(str, Enum):
    SINGLE = "single"
    SPLIT = "split"


class GSTRegistrationType(str, Enum):
    UNKNOWN = "Unknown"
    COMPOSITION = "Composition"
    REGULAR = "Regular"
    UNREGISTERED = "Unregistered/Consumer"
    GOVERNMENT = "Government entity/TDS"
    SEZ = "Regular - SEZ"
    DEEMED_EXPORTER = "Regular-Deemed Exporter"
    EXPORTS = "Regular-Exports (EOU)"
    ECOMMERCE = "e-Commerce Operator"
    INPUT_SERVICE = "Input Service Distributor"
    EMBASSY = "Embassy/UN Body"
    NON_RESIDENT = "Non-Resident Taxpayer"


class CustomerType(str, Enum):
    B2B = "b2b"
    B2C = "b2c"
    EXPORT = "export"
    SEZ = "sez"


# Opening Balance Item Schema (for split mode)
class OpeningBalanceItemCreate(BaseModel):
    """Schema for opening balance item in split mode."""
    date: date
    voucher_name: str = Field(..., min_length=1, max_length=255)
    days: Optional[str] = None
    amount: str = Field(...)
    
    @field_validator('days')
    @classmethod
    def validate_days(cls, v):
        if v:
            try:
                int(v)
            except ValueError:
                raise ValueError("Days must be a number")
        return v
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        try:
            float(v)
        except ValueError:
            raise ValueError("Amount must be a valid number")
        return v
    
    model_config = ConfigDict(from_attributes=True)


class OpeningBalanceItemResponse(BaseModel):
    """Schema for opening balance item response."""
    id: str
    customer_id: str
    date: date
    voucher_name: str
    days: Optional[int] = None
    amount: Decimal
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Contact Person Schema
class ContactPersonBase(BaseModel):
    """Base schema for contact person."""
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ContactPersonCreate(ContactPersonBase):
    """Schema for creating a contact person."""
    pass


class ContactPersonResponse(ContactPersonBase):
    """Schema for contact person response."""
    id: str
    customer_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Main Customer Schemas
class CustomerBase(BaseModel):
    """Base customer schema."""
    # Basic Information
    name: str = Field(..., min_length=2, max_length=255)
    contact: str = Field(..., min_length=1, max_length=20)
    email: Optional[EmailStr] = None
    mobile: Optional[str] = Field(None, max_length=20)
    
    # Tax Information
    tax_number: Optional[str] = Field(None, max_length=15)
    gst_registration_type: Optional[str] = None
    pan_number: Optional[str] = Field(None, max_length=10)
    vendor_code: Optional[str] = Field(None, max_length=50)
    
    # Opening Balance Fields - NEW
    opening_balance: Optional[str] = "0"
    opening_balance_type: Optional[OpeningBalanceType] = OpeningBalanceType.OUTSTANDING
    opening_balance_mode: Optional[OpeningBalanceMode] = OpeningBalanceMode.SINGLE
    opening_balance_split: Optional[List[OpeningBalanceItemCreate]] = []
    
    # Credit Information - NEW
    credit_limit: Optional[str] = "0"
    credit_days: Optional[str] = "0"
    
    # Contact Persons
    contact_persons: Optional[List[ContactPersonCreate]] = []
    
    # Billing Address
    billing_address: Optional[str] = None
    billing_city: Optional[str] = Field(None, max_length=100)
    billing_state: Optional[str] = Field(None, max_length=100)
    billing_country: str = "India"
    billing_zip: Optional[str] = Field(None, max_length=10)
    
    # Shipping Address
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=100)
    shipping_country: str = "India"
    shipping_zip: Optional[str] = Field(None, max_length=10)
    
    # Additional Info
    customer_type: Optional[CustomerType] = CustomerType.B2B
    
    @field_validator("tax_number")
    @classmethod
    def validate_gstin(cls, v):
        """Validate GSTIN format."""
        if v:
            v = v.upper().strip()
            # Basic validation - 15 characters
            if len(v) != 15:
                raise ValueError("GST number must be 15 characters")
        return v
    
    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v):
        """Validate PAN number format."""
        if v:
            v = v.upper().strip()
            pan_pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
            if not re.match(pan_pattern, v):
                raise ValueError("Invalid PAN number format")
        return v
    
    @field_validator("contact", "mobile")
    @classmethod
    def validate_contact_numbers(cls, v):
        """Validate contact number format."""
        if v:
            # Remove all non-digit characters
            cleaned = "".join(filter(str.isdigit, v))
            if len(cleaned) != 10:
                raise ValueError("Contact number must be 10 digits")
            return cleaned
        return v
    
    @field_validator("opening_balance", "credit_limit")
    @classmethod
    def validate_decimal_fields(cls, v):
        """Validate decimal fields."""
        if v:
            try:
                float(v)
            except ValueError:
                raise ValueError("Must be a valid number")
        return v
    
    @field_validator("credit_days")
    @classmethod
    def validate_credit_days(cls, v):
        """Validate credit days."""
        if v:
            try:
                int(v)
            except ValueError:
                raise ValueError("Credit days must be a whole number")
        return v
    
    model_config = ConfigDict(populate_by_name=True)


class CustomerCreate(CustomerBase):
    """Schema for creating a customer."""
    pass


class CustomerUpdate(BaseModel):
    """Schema for updating a customer."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    contact: Optional[str] = Field(None, min_length=1, max_length=20)
    email: Optional[EmailStr] = None
    mobile: Optional[str] = Field(None, max_length=20)
    
    tax_number: Optional[str] = Field(None, max_length=15)
    gst_registration_type: Optional[str] = None
    pan_number: Optional[str] = Field(None, max_length=10)
    vendor_code: Optional[str] = Field(None, max_length=50)
    
    opening_balance: Optional[str] = None
    opening_balance_type: Optional[OpeningBalanceType] = None
    opening_balance_mode: Optional[OpeningBalanceMode] = None
    opening_balance_split: Optional[List[OpeningBalanceItemCreate]] = None
    
    credit_limit: Optional[str] = None
    credit_days: Optional[str] = None
    
    contact_persons: Optional[List[ContactPersonCreate]] = None
    
    billing_address: Optional[str] = None
    billing_city: Optional[str] = Field(None, max_length=100)
    billing_state: Optional[str] = Field(None, max_length=100)
    billing_country: Optional[str] = None
    billing_zip: Optional[str] = Field(None, max_length=10)
    
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=100)
    shipping_country: Optional[str] = None
    shipping_zip: Optional[str] = Field(None, max_length=10)
    
    customer_type: Optional[CustomerType] = None
    is_active: Optional[bool] = None
    
    model_config = ConfigDict(populate_by_name=True)


class CustomerResponse(BaseModel):
    id: str
    company_id: str
    name: str
    contact: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    tax_number: Optional[str] = None
    gst_registration_type: Optional[str] = None
    pan_number: Optional[str] = None
    vendor_code: Optional[str] = None
    opening_balance: Optional[Decimal] = 0
    opening_balance_type: Optional[str] = None
    opening_balance_mode: Optional[str] = None
    outstanding_balance: Optional[Decimal] = 0
    advance_balance: Optional[Decimal] = 0
    credit_limit: Optional[Decimal] = 0
    credit_days: Optional[int] = 0
    customer_code: Optional[str] = None
    total_transactions: Optional[int] = 0
    last_transaction_date: Optional[date] = None
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_country: Optional[str] = "India"
    billing_zip: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_country: Optional[str] = "India"
    shipping_zip: Optional[str] = None
    customer_type: Optional[str] = "b2b"
    contact_person_name: Optional[str] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    # Legacy fields for frontend compatibility
    gstin: Optional[str] = None
    pan: Optional[str] = None
    phone: Optional[str] = None
    trade_name: Optional[str] = None
    contact_person: Optional[str] = None
    billing_pincode: Optional[str] = None
    shipping_pincode: Optional[str] = None
    
    # Relationships
    opening_balance_items: List[OpeningBalanceItemResponse] = []
    contact_persons: List[ContactPersonResponse] = []
    
    class Config:
        from_attributes = True
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat() if v else None,
            date: lambda v: v.isoformat() if v else None,
        }
        
        @staticmethod
        def schema_extra(schema: dict, model) -> None:
            # Add computed properties for legacy fields
            schema['properties']['gstin'] = {'type': 'string', 'nullable': True}
            schema['properties']['pan'] = {'type': 'string', 'nullable': True}
            schema['properties']['phone'] = {'type': 'string', 'nullable': True}
            schema['properties']['trade_name'] = {'type': 'string', 'nullable': True}
            schema['properties']['contact_person'] = {'type': 'string', 'nullable': True}
            schema['properties']['billing_pincode'] = {'type': 'string', 'nullable': True}
            schema['properties']['shipping_pincode'] = {'type': 'string', 'nullable': True}

class CustomerListResponse(BaseModel):
    """Schema for customer list response."""
    customers: List[CustomerResponse]
    total: int
    page: int
    page_size: int
    

class CustomerSearchResult(BaseModel):
    """Schema for customer search result."""
    id: str
    name: str
    contact: str
    email: Optional[str] = None
    tax_number: Optional[str] = None
    vendor_code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class CustomerStatistics(BaseModel):
    """Schema for customer statistics."""
    total_customers: int
    active_customers: int
    total_outstanding: Decimal
    total_advance: Decimal
    net_balance: Decimal
    customers_by_type: Dict[str, int]
    customers_by_state: Dict[str, int]
    top_customers: List[Dict]
    

class CustomerExportRequest(BaseModel):
    """Schema for customer export request."""
    format: str = "csv"
    include_inactive: bool = False
    columns: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None