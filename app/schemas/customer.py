"""Customer schemas."""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import re


class CustomerCreate(BaseModel):
    """Schema for creating a customer."""
    name: str = Field(..., min_length=2, max_length=255)
    trade_name: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    
    # Billing Address
    billing_address_line1: Optional[str] = None
    billing_address_line2: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_state_code: Optional[str] = None
    billing_pincode: Optional[str] = None
    billing_country: str = "India"
    
    # Shipping Address
    shipping_address_line1: Optional[str] = None
    shipping_address_line2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_state_code: Optional[str] = None
    shipping_pincode: Optional[str] = None
    shipping_country: str = "India"
    
    customer_type: str = "b2c"  # b2b, b2c, export

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

    @field_validator("customer_type")
    @classmethod
    def validate_customer_type(cls, v):
        """Validate customer type."""
        valid_types = ["b2b", "b2c", "export", "sez"]
        if v.lower() not in valid_types:
            raise ValueError(f"Customer type must be one of: {', '.join(valid_types)}")
        return v.lower()


class CustomerUpdate(BaseModel):
    """Schema for updating a customer."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    trade_name: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    
    billing_address_line1: Optional[str] = None
    billing_address_line2: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_state_code: Optional[str] = None
    billing_pincode: Optional[str] = None
    billing_country: Optional[str] = None
    
    shipping_address_line1: Optional[str] = None
    shipping_address_line2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_state_code: Optional[str] = None
    shipping_pincode: Optional[str] = None
    shipping_country: Optional[str] = None
    
    customer_type: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerResponse(BaseModel):
    """Schema for customer response."""
    id: str
    company_id: str
    
    name: str
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    
    billing_address_line1: Optional[str] = None
    billing_address_line2: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_state_code: Optional[str] = None
    billing_pincode: Optional[str] = None
    billing_country: str
    
    shipping_address_line1: Optional[str] = None
    shipping_address_line2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_state_code: Optional[str] = None
    shipping_pincode: Optional[str] = None
    shipping_country: str
    
    customer_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    """Schema for customer list response."""
    customers: list[CustomerResponse]
    total: int
    page: int
    page_size: int

