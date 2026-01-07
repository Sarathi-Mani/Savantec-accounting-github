"""Brand schemas."""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from app.schemas.base import BaseResponse


class BrandBase(BaseModel):
    """Base brand schema."""
    name: str = Field(..., min_length=1, max_length=191)
    description: Optional[str] = None


class BrandCreate(BrandBase):
    """Schema for creating a brand."""
    pass


class BrandUpdate(BaseModel):
    """Schema for updating a brand."""
    name: Optional[str] = Field(None, min_length=1, max_length=191)
    description: Optional[str] = None


class BrandResponse(BaseResponse):
    """Brand response schema."""
    id: str
    name: str
    description: Optional[str]
    product_count: int = 0
    company_id: str
    created_at: datetime
    updated_at: datetime


class BrandListResponse(BaseModel):
    """Brand list response."""
    brands: list[BrandResponse]
    total: int
    page: int
    page_size: int