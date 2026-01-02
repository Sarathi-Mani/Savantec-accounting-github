"""Pydantic schemas for Alternative Products."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AlternativeProductCreate(BaseModel):
    """Schema for creating an alternative product."""
    name: str = Field(..., min_length=1, max_length=255)
    manufacturer: Optional[str] = Field(None, max_length=255)
    model_number: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    specifications: Optional[Dict[str, Any]] = None
    reference_url: Optional[str] = Field(None, max_length=500)
    reference_price: Optional[Decimal] = None


class AlternativeProductUpdate(BaseModel):
    """Schema for updating an alternative product."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    manufacturer: Optional[str] = Field(None, max_length=255)
    model_number: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    specifications: Optional[Dict[str, Any]] = None
    reference_url: Optional[str] = Field(None, max_length=500)
    reference_price: Optional[Decimal] = None
    is_active: Optional[bool] = None


class AlternativeProductResponse(BaseModel):
    """Schema for alternative product response."""
    id: str
    company_id: str
    name: str
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    reference_url: Optional[str] = None
    reference_price: Optional[Decimal] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    # Count of mapped products
    mapped_products_count: Optional[int] = 0

    class Config:
        from_attributes = True


class AlternativeProductListResponse(BaseModel):
    """Schema for alternative product list response."""
    alternative_products: List[AlternativeProductResponse]
    total: int
    page: int
    page_size: int


class ProductMappingCreate(BaseModel):
    """Schema for creating a product mapping."""
    product_id: str
    notes: Optional[str] = None
    priority: Optional[int] = Field(0, ge=0)
    comparison_notes: Optional[str] = None


class ProductMappingResponse(BaseModel):
    """Schema for product mapping response."""
    id: str
    product_id: str
    alternative_product_id: str
    notes: Optional[str] = None
    priority: int = 0
    comparison_notes: Optional[str] = None
    created_at: datetime
    
    # Product details (when fetching mappings)
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    
    # Alternative product details (when fetching from product side)
    alternative_name: Optional[str] = None
    alternative_manufacturer: Optional[str] = None
    alternative_model_number: Optional[str] = None

    class Config:
        from_attributes = True


class MappedProductResponse(BaseModel):
    """Schema for mapped product in alternative product detail."""
    mapping_id: str
    product_id: str
    product_name: str
    product_sku: Optional[str] = None
    product_unit_price: Optional[Decimal] = None
    notes: Optional[str] = None
    priority: int = 0
    comparison_notes: Optional[str] = None
    created_at: datetime


class AlternativeForProductResponse(BaseModel):
    """Schema for alternative product when viewed from product side."""
    mapping_id: str
    alternative_id: str
    alternative_name: str
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    reference_price: Optional[Decimal] = None
    notes: Optional[str] = None
    priority: int = 0
    comparison_notes: Optional[str] = None

