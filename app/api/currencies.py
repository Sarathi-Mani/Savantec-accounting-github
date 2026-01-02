"""Currency API endpoints for multi-currency support."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import User, Company, Currency, ExchangeRate, ExchangeRateSource
from app.auth.dependencies import get_current_active_user
from app.services.forex_service import ForexService

router = APIRouter(prefix="/companies/{company_id}/currencies", tags=["Currencies"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ==================== SCHEMAS ====================

class CurrencyCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=3)
    name: str
    symbol: str = ""
    decimal_places: int = 2


class CurrencyResponse(BaseModel):
    id: str
    code: str
    name: str
    symbol: Optional[str]
    decimal_places: int
    is_base_currency: bool
    is_active: bool
    
    class Config:
        from_attributes = True


class ExchangeRateCreate(BaseModel):
    from_currency_code: str
    to_currency_code: str
    rate: float
    rate_date: Optional[datetime] = None


class ExchangeRateResponse(BaseModel):
    id: str
    from_currency_code: str
    to_currency_code: str
    rate: float
    rate_date: datetime
    source: str
    
    class Config:
        from_attributes = True


class ConversionRequest(BaseModel):
    amount: float
    from_currency: str
    to_currency: str
    as_of_date: Optional[datetime] = None


class ConversionResponse(BaseModel):
    from_amount: float
    from_currency: str
    to_amount: float
    to_currency: str
    exchange_rate: float
    rate_date: datetime


# ==================== ENDPOINTS ====================

@router.post("/initialize")
async def initialize_currencies(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Initialize default currencies for a company."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    created = service.initialize_currencies(company.id)
    
    return {"message": f"Initialized {len(created)} currencies"}


@router.get("", response_model=List[CurrencyResponse])
async def list_currencies(
    company_id: str,
    active_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all currencies for a company."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    currencies = service.list_currencies(company.id, active_only)
    
    return currencies


@router.post("", response_model=CurrencyResponse, status_code=status.HTTP_201_CREATED)
async def create_currency(
    company_id: str,
    data: CurrencyCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new currency."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    
    try:
        currency = service.create_currency(
            company_id=company.id,
            code=data.code,
            name=data.name,
            symbol=data.symbol,
            decimal_places=data.decimal_places,
        )
        return currency
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{code}", response_model=CurrencyResponse)
async def get_currency(
    company_id: str,
    code: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get currency by code."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    currency = service.get_currency(company.id, code)
    
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    
    return currency


# ==================== EXCHANGE RATES ====================

@router.post("/exchange-rates")
async def set_exchange_rate(
    company_id: str,
    data: ExchangeRateCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Set exchange rate between two currencies."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    
    try:
        rate = service.set_exchange_rate(
            company_id=company.id,
            from_currency_code=data.from_currency_code,
            to_currency_code=data.to_currency_code,
            rate=Decimal(str(data.rate)),
            rate_date=data.rate_date,
        )
        return {
            "id": rate.id,
            "from_currency": data.from_currency_code,
            "to_currency": data.to_currency_code,
            "rate": float(rate.rate),
            "rate_date": rate.rate_date.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exchange-rates/{from_code}/{to_code}")
async def get_exchange_rate(
    company_id: str,
    from_code: str,
    to_code: str,
    as_of: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current exchange rate between two currencies."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    rate = service.get_exchange_rate(company.id, from_code, to_code, as_of)
    
    if rate is None:
        raise HTTPException(status_code=404, detail="Exchange rate not found")
    
    return {
        "from_currency": from_code,
        "to_currency": to_code,
        "rate": float(rate),
        "as_of": as_of.isoformat() if as_of else datetime.utcnow().isoformat(),
    }


@router.get("/exchange-rates/{from_code}/{to_code}/history")
async def get_rate_history(
    company_id: str,
    from_code: str,
    to_code: str,
    limit: int = 30,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get exchange rate history between two currencies."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    history = service.get_rate_history(company.id, from_code, to_code, limit=limit)
    
    return [
        {
            "rate": float(r.rate),
            "rate_date": r.rate_date.isoformat(),
            "source": r.source.value,
        }
        for r in history
    ]


# ==================== CONVERSION ====================

@router.post("/convert", response_model=ConversionResponse)
async def convert_currency(
    company_id: str,
    data: ConversionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Convert amount from one currency to another."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    
    try:
        result = service.convert(
            company_id=company.id,
            amount=Decimal(str(data.amount)),
            from_currency_code=data.from_currency,
            to_currency_code=data.to_currency,
            as_of_date=data.as_of_date,
        )
        
        return ConversionResponse(
            from_amount=float(result.from_amount),
            from_currency=result.from_currency,
            to_amount=float(result.to_amount),
            to_currency=result.to_currency,
            exchange_rate=float(result.exchange_rate),
            rate_date=result.rate_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== FOREX REPORTS ====================

@router.get("/forex/summary")
async def get_forex_summary(
    company_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get forex gain/loss summary."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    summary = service.get_forex_summary(company.id, from_date, to_date)
    
    return summary


@router.get("/forex/exposure")
async def get_currency_exposure(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get outstanding currency exposure."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    exposure = service.get_currency_exposure(company.id)
    
    return exposure
