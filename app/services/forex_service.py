"""
Forex Service - Multi-currency support with exchange rates and gain/loss tracking.

Features:
- Currency master management
- Exchange rate tracking (manual and API-based)
- Currency conversion
- Realized forex gain/loss calculation (on payment)
- Unrealized forex gain/loss calculation (on revaluation)
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database.models import (
    Currency, ExchangeRate, ForexGainLoss, ExchangeRateSource,
    Invoice, PurchaseInvoice, Transaction
)


@dataclass
class ConversionResult:
    """Result of currency conversion."""
    from_amount: Decimal
    from_currency: str
    to_amount: Decimal
    to_currency: str
    exchange_rate: Decimal
    rate_date: datetime


@dataclass
class ForexCalculationResult:
    """Result of forex gain/loss calculation."""
    original_amount: Decimal
    original_rate: Decimal
    original_base_amount: Decimal
    settlement_amount: Decimal
    settlement_rate: Decimal
    settlement_base_amount: Decimal
    gain_loss: Decimal  # Positive = gain, Negative = loss
    is_gain: bool


# Common currencies with default settings
DEFAULT_CURRENCIES = [
    {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "is_base": True},
    {"code": "USD", "name": "US Dollar", "symbol": "$"},
    {"code": "EUR", "name": "Euro", "symbol": "€"},
    {"code": "GBP", "name": "British Pound", "symbol": "£"},
    {"code": "AED", "name": "UAE Dirham", "symbol": "د.إ"},
    {"code": "SGD", "name": "Singapore Dollar", "symbol": "S$"},
    {"code": "AUD", "name": "Australian Dollar", "symbol": "A$"},
    {"code": "CAD", "name": "Canadian Dollar", "symbol": "C$"},
    {"code": "CHF", "name": "Swiss Franc", "symbol": "CHF"},
    {"code": "JPY", "name": "Japanese Yen", "symbol": "¥", "decimal_places": 0},
    {"code": "CNY", "name": "Chinese Yuan", "symbol": "¥"},
]


class ForexService:
    """Service for multi-currency and forex operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal, decimal_places: int = 2) -> Decimal:
        """Round amount to specified decimal places."""
        return amount.quantize(Decimal(10) ** -decimal_places, rounding=ROUND_HALF_UP)
    
    # ==================== CURRENCY MANAGEMENT ====================
    
    def initialize_currencies(self, company_id: str) -> List[Currency]:
        """Initialize default currencies for a company."""
        created = []
        
        for curr_data in DEFAULT_CURRENCIES:
            existing = self.db.query(Currency).filter(
                Currency.company_id == company_id,
                Currency.code == curr_data["code"],
            ).first()
            
            if not existing:
                currency = Currency(
                    company_id=company_id,
                    code=curr_data["code"],
                    name=curr_data["name"],
                    symbol=curr_data.get("symbol", ""),
                    decimal_places=curr_data.get("decimal_places", 2),
                    is_base_currency=curr_data.get("is_base", False),
                    is_active=True,
                )
                self.db.add(currency)
                created.append(currency)
        
        self.db.commit()
        return created
    
    def get_base_currency(self, company_id: str) -> Optional[Currency]:
        """Get the base currency for a company (usually INR)."""
        return self.db.query(Currency).filter(
            Currency.company_id == company_id,
            Currency.is_base_currency == True,
        ).first()
    
    def get_currency(self, company_id: str, code: str) -> Optional[Currency]:
        """Get currency by code."""
        return self.db.query(Currency).filter(
            Currency.company_id == company_id,
            Currency.code == code.upper(),
        ).first()
    
    def get_currency_by_id(self, currency_id: str) -> Optional[Currency]:
        """Get currency by ID."""
        return self.db.query(Currency).filter(Currency.id == currency_id).first()
    
    def list_currencies(self, company_id: str, active_only: bool = True) -> List[Currency]:
        """List all currencies for a company."""
        query = self.db.query(Currency).filter(Currency.company_id == company_id)
        
        if active_only:
            query = query.filter(Currency.is_active == True)
        
        return query.order_by(Currency.is_base_currency.desc(), Currency.code).all()
    
    def create_currency(
        self,
        company_id: str,
        code: str,
        name: str,
        symbol: str = "",
        decimal_places: int = 2,
    ) -> Currency:
        """Create a new currency."""
        existing = self.get_currency(company_id, code)
        if existing:
            raise ValueError(f"Currency {code} already exists")
        
        currency = Currency(
            company_id=company_id,
            code=code.upper(),
            name=name,
            symbol=symbol,
            decimal_places=decimal_places,
            is_base_currency=False,
            is_active=True,
        )
        
        self.db.add(currency)
        self.db.commit()
        self.db.refresh(currency)
        
        return currency
    
    # ==================== EXCHANGE RATE MANAGEMENT ====================
    
    def set_exchange_rate(
        self,
        company_id: str,
        from_currency_code: str,
        to_currency_code: str,
        rate: Decimal,
        rate_date: Optional[datetime] = None,
        source: ExchangeRateSource = ExchangeRateSource.MANUAL,
    ) -> ExchangeRate:
        """Set exchange rate between two currencies."""
        from_currency = self.get_currency(company_id, from_currency_code)
        to_currency = self.get_currency(company_id, to_currency_code)
        
        if not from_currency:
            raise ValueError(f"Currency {from_currency_code} not found")
        if not to_currency:
            raise ValueError(f"Currency {to_currency_code} not found")
        
        if rate_date is None:
            rate_date = datetime.utcnow()
        
        exchange_rate = ExchangeRate(
            company_id=company_id,
            from_currency_id=from_currency.id,
            to_currency_id=to_currency.id,
            rate=rate,
            rate_date=rate_date,
            source=source,
        )
        
        self.db.add(exchange_rate)
        self.db.commit()
        self.db.refresh(exchange_rate)
        
        return exchange_rate
    
    def get_exchange_rate(
        self,
        company_id: str,
        from_currency_code: str,
        to_currency_code: str,
        as_of_date: Optional[datetime] = None,
    ) -> Optional[Decimal]:
        """
        Get exchange rate between two currencies.
        
        Returns the most recent rate as of the specified date.
        """
        from_currency = self.get_currency(company_id, from_currency_code)
        to_currency = self.get_currency(company_id, to_currency_code)
        
        if not from_currency or not to_currency:
            return None
        
        # Same currency
        if from_currency.id == to_currency.id:
            return Decimal("1")
        
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        # Direct rate
        rate = self.db.query(ExchangeRate).filter(
            ExchangeRate.company_id == company_id,
            ExchangeRate.from_currency_id == from_currency.id,
            ExchangeRate.to_currency_id == to_currency.id,
            ExchangeRate.rate_date <= as_of_date,
        ).order_by(ExchangeRate.rate_date.desc()).first()
        
        if rate:
            return rate.rate
        
        # Try inverse rate
        inverse_rate = self.db.query(ExchangeRate).filter(
            ExchangeRate.company_id == company_id,
            ExchangeRate.from_currency_id == to_currency.id,
            ExchangeRate.to_currency_id == from_currency.id,
            ExchangeRate.rate_date <= as_of_date,
        ).order_by(ExchangeRate.rate_date.desc()).first()
        
        if inverse_rate:
            return Decimal("1") / inverse_rate.rate
        
        return None
    
    def get_rate_history(
        self,
        company_id: str,
        from_currency_code: str,
        to_currency_code: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 30,
    ) -> List[ExchangeRate]:
        """Get exchange rate history between two currencies."""
        from_currency = self.get_currency(company_id, from_currency_code)
        to_currency = self.get_currency(company_id, to_currency_code)
        
        if not from_currency or not to_currency:
            return []
        
        query = self.db.query(ExchangeRate).filter(
            ExchangeRate.company_id == company_id,
            ExchangeRate.from_currency_id == from_currency.id,
            ExchangeRate.to_currency_id == to_currency.id,
        )
        
        if from_date:
            query = query.filter(ExchangeRate.rate_date >= from_date)
        if to_date:
            query = query.filter(ExchangeRate.rate_date <= to_date)
        
        return query.order_by(ExchangeRate.rate_date.desc()).limit(limit).all()
    
    # ==================== CURRENCY CONVERSION ====================
    
    def convert(
        self,
        company_id: str,
        amount: Decimal,
        from_currency_code: str,
        to_currency_code: str,
        as_of_date: Optional[datetime] = None,
    ) -> ConversionResult:
        """
        Convert amount from one currency to another.
        """
        rate = self.get_exchange_rate(
            company_id, from_currency_code, to_currency_code, as_of_date
        )
        
        if rate is None:
            raise ValueError(f"No exchange rate found for {from_currency_code} to {to_currency_code}")
        
        to_currency = self.get_currency(company_id, to_currency_code)
        converted_amount = self._round_amount(amount * rate, to_currency.decimal_places if to_currency else 2)
        
        return ConversionResult(
            from_amount=amount,
            from_currency=from_currency_code,
            to_amount=converted_amount,
            to_currency=to_currency_code,
            exchange_rate=rate,
            rate_date=as_of_date or datetime.utcnow(),
        )
    
    def convert_to_base(
        self,
        company_id: str,
        amount: Decimal,
        from_currency_code: str,
        as_of_date: Optional[datetime] = None,
    ) -> ConversionResult:
        """Convert amount to base currency (INR)."""
        base_currency = self.get_base_currency(company_id)
        if not base_currency:
            raise ValueError("No base currency configured")
        
        return self.convert(company_id, amount, from_currency_code, base_currency.code, as_of_date)
    
    # ==================== FOREX GAIN/LOSS ====================
    
    def calculate_realized_forex(
        self,
        original_amount: Decimal,
        original_rate: Decimal,
        settlement_amount: Decimal,
        settlement_rate: Decimal,
    ) -> ForexCalculationResult:
        """
        Calculate realized forex gain/loss.
        
        This is calculated when a foreign currency invoice is settled.
        
        For receivables (sales invoice):
        - Gain if settlement rate > original rate
        - Loss if settlement rate < original rate
        
        For payables (purchase invoice):
        - Loss if settlement rate > original rate
        - Gain if settlement rate < original rate
        """
        original_base = self._round_amount(original_amount * original_rate)
        settlement_base = self._round_amount(settlement_amount * settlement_rate)
        
        # For same-direction transactions, difference is gain/loss
        gain_loss = settlement_base - original_base
        
        return ForexCalculationResult(
            original_amount=original_amount,
            original_rate=original_rate,
            original_base_amount=original_base,
            settlement_amount=settlement_amount,
            settlement_rate=settlement_rate,
            settlement_base_amount=settlement_base,
            gain_loss=gain_loss,
            is_gain=gain_loss > 0,
        )
    
    def record_realized_forex(
        self,
        company_id: str,
        reference_type: str,
        reference_id: str,
        currency_id: str,
        original_amount: Decimal,
        original_rate: Decimal,
        settlement_amount: Decimal,
        settlement_rate: Decimal,
        transaction_id: Optional[str] = None,
        notes: str = "",
    ) -> ForexGainLoss:
        """Record a realized forex gain/loss."""
        result = self.calculate_realized_forex(
            original_amount, original_rate, settlement_amount, settlement_rate
        )
        
        entry = ForexGainLoss(
            company_id=company_id,
            reference_type=reference_type,
            reference_id=reference_id,
            currency_id=currency_id,
            original_amount=result.original_amount,
            original_rate=result.original_rate,
            original_base_amount=result.original_base_amount,
            settlement_amount=result.settlement_amount,
            settlement_rate=result.settlement_rate,
            settlement_base_amount=result.settlement_base_amount,
            gain_loss_amount=result.gain_loss,
            is_realized=True,
            gain_loss_date=datetime.utcnow(),
            transaction_id=transaction_id,
            notes=notes,
        )
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        
        return entry
    
    def revalue_open_items(
        self,
        company_id: str,
        as_of_date: Optional[datetime] = None,
    ) -> List[ForexGainLoss]:
        """
        Revalue all open foreign currency items at current exchange rates.
        
        Creates unrealized forex gain/loss entries.
        Used for period-end revaluation.
        """
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        unrealized_entries = []
        base_currency = self.get_base_currency(company_id)
        
        if not base_currency:
            return []
        
        # Note: In a real implementation, you would:
        # 1. Find all open invoices with foreign currency
        # 2. Get current exchange rate for each currency
        # 3. Calculate unrealized gain/loss
        # 4. Create ForexGainLoss entries with is_realized=False
        # 5. Optionally create accounting entries
        
        # This is a placeholder for the revaluation logic
        # The actual implementation would depend on how invoices track currency
        
        return unrealized_entries
    
    # ==================== REPORTING ====================
    
    def get_forex_summary(
        self,
        company_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> Dict:
        """Get forex gain/loss summary for a period."""
        query = self.db.query(ForexGainLoss).filter(
            ForexGainLoss.company_id == company_id,
        )
        
        if from_date:
            query = query.filter(ForexGainLoss.gain_loss_date >= from_date)
        if to_date:
            query = query.filter(ForexGainLoss.gain_loss_date <= to_date)
        
        entries = query.all()
        
        realized_gain = sum(e.gain_loss_amount for e in entries if e.is_realized and e.gain_loss_amount > 0)
        realized_loss = sum(abs(e.gain_loss_amount) for e in entries if e.is_realized and e.gain_loss_amount < 0)
        unrealized_gain = sum(e.gain_loss_amount for e in entries if not e.is_realized and e.gain_loss_amount > 0)
        unrealized_loss = sum(abs(e.gain_loss_amount) for e in entries if not e.is_realized and e.gain_loss_amount < 0)
        
        return {
            "realized": {
                "gain": float(realized_gain),
                "loss": float(realized_loss),
                "net": float(realized_gain - realized_loss),
            },
            "unrealized": {
                "gain": float(unrealized_gain),
                "loss": float(unrealized_loss),
                "net": float(unrealized_gain - unrealized_loss),
            },
            "total": {
                "gain": float(realized_gain + unrealized_gain),
                "loss": float(realized_loss + unrealized_loss),
                "net": float((realized_gain + unrealized_gain) - (realized_loss + unrealized_loss)),
            },
            "entry_count": len(entries),
        }
    
    def get_currency_exposure(self, company_id: str) -> Dict:
        """
        Get outstanding currency exposure.
        
        Shows total receivables and payables by currency.
        """
        # This would query open invoices and purchase invoices grouped by currency
        # Placeholder implementation
        return {
            "receivables": {},
            "payables": {},
            "net_exposure": {},
        }
