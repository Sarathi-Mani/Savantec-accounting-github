"""Product schemas."""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProductCreate(BaseModel):
    """Schema for creating a product/service."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=50)
    hsn_code: Optional[str] = Field(None, max_length=8)
    
    unit_price: Decimal = Field(..., gt=0, decimal_places=2)
    unit: str = "unit"
    
    gst_rate: str = "18"
    is_inclusive: bool = False
    is_service: bool = False

    @field_validator("gst_rate")
    @classmethod
    def validate_gst_rate(cls, v):
        """Validate GST rate."""
        valid_rates = ["0", "5", "12", "18", "28"]
        if v not in valid_rates:
            raise ValueError(f"GST rate must be one of: {', '.join(valid_rates)}")
        return v

    @field_validator("hsn_code")
    @classmethod
    def validate_hsn_code(cls, v):
        """Validate HSN/SAC code format."""
        if v:
            if not v.isdigit() or len(v) < 4 or len(v) > 8:
                raise ValueError("HSN/SAC code must be 4-8 digits")
        return v


class ProductUpdate(BaseModel):
    """Schema for updating a product/service."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=50)
    hsn_code: Optional[str] = Field(None, max_length=8)
    
    unit_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    unit: Optional[str] = None
    
    gst_rate: Optional[str] = None
    is_inclusive: Optional[bool] = None
    is_service: Optional[bool] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    """Schema for product response."""
    id: str
    company_id: str
    
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    
    unit_price: Decimal
    unit: str
    
    gst_rate: str
    is_inclusive: bool
    is_service: bool
    
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    # Stock info (unified model - products include inventory)
    current_stock: Optional[Decimal] = None
    min_stock_level: Optional[Decimal] = None
    opening_stock: Optional[Decimal] = None
    standard_cost: Optional[Decimal] = None

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Schema for product list response."""
    products: list[ProductResponse]
    total: int
    page: int
    page_size: int

