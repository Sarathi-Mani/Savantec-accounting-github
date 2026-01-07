"""Category schemas."""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from app.schemas.base import BaseResponse


class CategoryBase(BaseModel):
    """Base category schema."""
    name: str = Field(..., min_length=1, max_length=191)
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""
    pass


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=191)
    description: Optional[str] = None


class CategoryResponse(BaseResponse):
    """Category response schema."""
    id: str
    name: str
    description: Optional[str]
    product_count: int = 0
    company_id: str
    created_at: datetime
    updated_at: datetime


class CategoryListResponse(BaseModel):
    """Category list response."""
    categories: list[CategoryResponse]
    total: int
    page: int
    page_size: int