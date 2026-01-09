"""Brand schemas."""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


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


class BrandResponse(BaseModel):
    """Brand response schema - only shows name and description."""
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


class BrandListResponse(BaseModel):
    """Brand list response."""
    brands: list[BrandResponse]
    total: int
    page: int
    page_size: int