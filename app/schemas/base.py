"""Base Pydantic schemas."""
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Any
from decimal import Decimal


class BaseResponse(BaseModel):
    """Base response schema."""
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None,
            Decimal: lambda v: float(v) if v else 0.0
        }
    )


class PaginatedResponse(BaseModel):
    """Base paginated response."""
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    """Error response schema."""
    detail: str
    code: Optional[str] = None


class SuccessResponse(BaseModel):
    """Success response schema."""
    message: str
    data: Optional[dict] = None


class ListResponse(BaseModel):
    """Generic list response."""
    items: list[Any]
    total: int
    page: int
    page_size: int