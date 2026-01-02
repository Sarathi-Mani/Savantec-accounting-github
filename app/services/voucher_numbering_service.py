"""
Advanced Voucher Numbering Service - Auto-generated voucher numbers.

Features:
- Configurable prefix/suffix
- Financial year reset
- Sequential or custom numbering
- Multiple series per voucher type
"""
from decimal import Decimal
from dataclasses import dataclass
from typing import Optional, List, Dict
from datetime import datetime, date
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import generate_uuid


class ResetFrequency(str, Enum):
    """When to reset the counter."""
    NEVER = "never"
    YEARLY = "yearly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class VoucherNumberFormat(str, Enum):
    """Format for voucher numbers."""
    SIMPLE = "simple"  # Just number: 001
    PREFIXED = "prefixed"  # INV-001
    YEAR_PREFIX = "year_prefix"  # 2024-25/INV/001
    CUSTOM = "custom"  # User-defined format


@dataclass
class VoucherNumberSeries:
    """Configuration for a voucher number series."""
    id: str
    company_id: str
    voucher_type: str  # invoice, purchase, payment, receipt, etc.
    series_name: str
    prefix: str
    suffix: str
    starting_number: int
    current_number: int
    number_padding: int  # How many digits (e.g., 4 = 0001)
    reset_frequency: ResetFrequency
    financial_year: Optional[str]  # e.g., "2024-2025"
    is_active: bool
    include_fy_in_number: bool  # Include FY in the number
    separator: str  # Character between parts (/, -, etc.)


class VoucherNumberingService:
    """Service for generating and managing voucher numbers."""
    
    # In-memory storage for series (would be in DB in production)
    _series_cache: Dict[str, Dict[str, VoucherNumberSeries]] = {}
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_current_financial_year(self, as_of: Optional[date] = None) -> str:
        """Get current financial year string (e.g., '2024-2025')."""
        if as_of is None:
            as_of = date.today()
        
        if as_of.month >= 4:  # April onwards
            return f"{as_of.year}-{as_of.year + 1}"
        else:
            return f"{as_of.year - 1}-{as_of.year}"
    
    def _get_short_fy(self, financial_year: str) -> str:
        """Get short financial year (e.g., '24-25')."""
        years = financial_year.split("-")
        return f"{years[0][-2:]}-{years[1][-2:]}"
    
    def create_series(
        self,
        company_id: str,
        voucher_type: str,
        series_name: str = "Default",
        prefix: str = "",
        suffix: str = "",
        starting_number: int = 1,
        number_padding: int = 4,
        reset_frequency: ResetFrequency = ResetFrequency.YEARLY,
        include_fy_in_number: bool = True,
        separator: str = "/",
    ) -> VoucherNumberSeries:
        """Create a new voucher number series."""
        series_id = generate_uuid()
        financial_year = self._get_current_financial_year()
        
        series = VoucherNumberSeries(
            id=series_id,
            company_id=company_id,
            voucher_type=voucher_type,
            series_name=series_name,
            prefix=prefix,
            suffix=suffix,
            starting_number=starting_number,
            current_number=starting_number - 1,  # Will be incremented on first use
            number_padding=number_padding,
            reset_frequency=reset_frequency,
            financial_year=financial_year,
            is_active=True,
            include_fy_in_number=include_fy_in_number,
            separator=separator,
        )
        
        # Store in cache (would be DB in production)
        if company_id not in self._series_cache:
            self._series_cache[company_id] = {}
        
        key = f"{voucher_type}_{series_name}"
        self._series_cache[company_id][key] = series
        
        return series
    
    def get_series(
        self,
        company_id: str,
        voucher_type: str,
        series_name: str = "Default",
    ) -> Optional[VoucherNumberSeries]:
        """Get a voucher number series."""
        if company_id not in self._series_cache:
            return None
        
        key = f"{voucher_type}_{series_name}"
        return self._series_cache[company_id].get(key)
    
    def _check_and_reset_series(self, series: VoucherNumberSeries) -> bool:
        """Check if series needs to be reset and reset if necessary."""
        if series.reset_frequency == ResetFrequency.NEVER:
            return False
        
        current_fy = self._get_current_financial_year()
        
        if series.reset_frequency == ResetFrequency.YEARLY:
            if series.financial_year != current_fy:
                series.financial_year = current_fy
                series.current_number = series.starting_number - 1
                return True
        
        # Add monthly/quarterly reset logic if needed
        
        return False
    
    def generate_number(
        self,
        company_id: str,
        voucher_type: str,
        series_name: str = "Default",
        transaction_date: Optional[date] = None,
    ) -> str:
        """
        Generate next voucher number.
        
        Examples:
        - INV/24-25/0001
        - PUR/2024-25/00123
        - REC-001
        """
        series = self.get_series(company_id, voucher_type, series_name)
        
        if not series:
            # Create default series if doesn't exist
            prefix_map = {
                "invoice": "INV",
                "sales_invoice": "INV",
                "purchase_invoice": "PUR",
                "purchase": "PUR",
                "payment": "PAY",
                "receipt": "REC",
                "journal": "JV",
                "contra": "CON",
                "debit_note": "DN",
                "credit_note": "CN",
            }
            
            series = self.create_series(
                company_id=company_id,
                voucher_type=voucher_type,
                series_name=series_name,
                prefix=prefix_map.get(voucher_type, voucher_type.upper()[:3]),
            )
        
        # Check if reset needed
        self._check_and_reset_series(series)
        
        # Increment counter
        series.current_number += 1
        
        # Build the number
        parts = []
        
        # Prefix
        if series.prefix:
            parts.append(series.prefix)
        
        # Financial year
        if series.include_fy_in_number and series.financial_year:
            parts.append(self._get_short_fy(series.financial_year))
        
        # Number with padding
        number_str = str(series.current_number).zfill(series.number_padding)
        parts.append(number_str)
        
        # Suffix
        if series.suffix:
            parts.append(series.suffix)
        
        return series.separator.join(parts)
    
    def preview_next_number(
        self,
        company_id: str,
        voucher_type: str,
        series_name: str = "Default",
    ) -> str:
        """Preview next number without incrementing."""
        series = self.get_series(company_id, voucher_type, series_name)
        
        if not series:
            return "No series configured"
        
        # Simulate next number
        next_num = series.current_number + 1
        parts = []
        
        if series.prefix:
            parts.append(series.prefix)
        
        if series.include_fy_in_number and series.financial_year:
            parts.append(self._get_short_fy(series.financial_year))
        
        parts.append(str(next_num).zfill(series.number_padding))
        
        if series.suffix:
            parts.append(series.suffix)
        
        return series.separator.join(parts)
    
    def update_series_settings(
        self,
        company_id: str,
        voucher_type: str,
        series_name: str = "Default",
        **kwargs,
    ) -> Optional[VoucherNumberSeries]:
        """Update series settings."""
        series = self.get_series(company_id, voucher_type, series_name)
        
        if not series:
            return None
        
        for key, value in kwargs.items():
            if hasattr(series, key):
                setattr(series, key, value)
        
        return series
    
    def list_series(self, company_id: str) -> List[VoucherNumberSeries]:
        """List all series for a company."""
        if company_id not in self._series_cache:
            return []
        
        return list(self._series_cache[company_id].values())
    
    def get_default_series_config(self, voucher_type: str) -> Dict:
        """Get default configuration for a voucher type."""
        defaults = {
            "invoice": {
                "prefix": "INV",
                "number_padding": 4,
                "include_fy": True,
                "reset": "yearly",
            },
            "purchase_invoice": {
                "prefix": "PUR",
                "number_padding": 4,
                "include_fy": True,
                "reset": "yearly",
            },
            "payment": {
                "prefix": "PAY",
                "number_padding": 4,
                "include_fy": True,
                "reset": "yearly",
            },
            "receipt": {
                "prefix": "REC",
                "number_padding": 4,
                "include_fy": True,
                "reset": "yearly",
            },
            "journal": {
                "prefix": "JV",
                "number_padding": 5,
                "include_fy": True,
                "reset": "yearly",
            },
            "debit_note": {
                "prefix": "DN",
                "number_padding": 4,
                "include_fy": True,
                "reset": "yearly",
            },
            "credit_note": {
                "prefix": "CN",
                "number_padding": 4,
                "include_fy": True,
                "reset": "yearly",
            },
        }
        
        return defaults.get(voucher_type, {
            "prefix": voucher_type.upper()[:3],
            "number_padding": 4,
            "include_fy": True,
            "reset": "yearly",
        })
