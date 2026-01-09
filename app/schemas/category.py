"""Category schemas."""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


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


class CategoryResponse(BaseModel):
    """Category response schema - only shows name and description."""
    id: str
    name: str
    description: Optional[str]
    company_id: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )


class CategoryListResponse(BaseModel):
    """Category list response."""
    categories: list[CategoryResponse]
    total: int
    page: int
    page_size: int