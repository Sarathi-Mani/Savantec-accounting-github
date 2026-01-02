"""
Interest Calculation Service - Auto interest on overdue invoices.

Features:
- Simple and compound interest calculation
- Interest profiles with configurable rates
- Grace period support
- Interest on receivables and payables
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict
from datetime import datetime, date, timedelta
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import Invoice, PurchaseInvoice, InvoiceStatus


class InterestCalculationMethod(str, Enum):
    """Interest calculation method."""
    SIMPLE = "simple"
    COMPOUND = "compound"


class InterestApplyTo(str, Enum):
    """What to apply interest to."""
    RECEIVABLES = "receivables"
    PAYABLES = "payables"
    BOTH = "both"


@dataclass
class InterestProfile:
    """Interest profile configuration."""
    name: str
    interest_rate: Decimal  # Annual rate as percentage
    calculation_method: InterestCalculationMethod
    grace_period_days: int
    apply_to: InterestApplyTo
    min_overdue_amount: Decimal = Decimal("0")  # Minimum amount to charge interest
    max_interest_rate: Decimal = Decimal("24")  # Cap at 24% per annum


@dataclass
class InterestCalculationResult:
    """Result of interest calculation."""
    invoice_id: str
    invoice_number: str
    principal_amount: Decimal
    due_date: date
    days_overdue: int
    interest_rate: Decimal
    interest_amount: Decimal
    total_due: Decimal
    calculation_details: str


class InterestService:
    """Service for calculating interest on overdue invoices."""
    
    # Default interest profile
    DEFAULT_PROFILE = InterestProfile(
        name="Default",
        interest_rate=Decimal("18"),  # 18% per annum
        calculation_method=InterestCalculationMethod.SIMPLE,
        grace_period_days=0,
        apply_to=InterestApplyTo.RECEIVABLES,
    )
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def calculate_simple_interest(
        self,
        principal: Decimal,
        annual_rate: Decimal,
        days: int,
    ) -> Decimal:
        """
        Calculate simple interest.
        
        Formula: P * R * T / 100
        Where T is in years (days / 365)
        """
        if days <= 0 or principal <= 0:
            return Decimal("0")
        
        rate = annual_rate / Decimal("100")
        time_in_years = Decimal(days) / Decimal("365")
        
        interest = principal * rate * time_in_years
        return self._round_amount(interest)
    
    def calculate_compound_interest(
        self,
        principal: Decimal,
        annual_rate: Decimal,
        days: int,
        compounding_frequency: int = 12,  # Monthly
    ) -> Decimal:
        """
        Calculate compound interest.
        
        Formula: P * (1 + r/n)^(n*t) - P
        """
        if days <= 0 or principal <= 0:
            return Decimal("0")
        
        rate = annual_rate / Decimal("100")
        time_in_years = Decimal(days) / Decimal("365")
        n = Decimal(compounding_frequency)
        
        # A = P * (1 + r/n)^(n*t)
        amount = principal * (1 + rate / n) ** (n * time_in_years)
        interest = amount - principal
        
        return self._round_amount(interest)
    
    def calculate_interest_for_invoice(
        self,
        invoice: Invoice,
        profile: Optional[InterestProfile] = None,
        as_of_date: Optional[date] = None,
    ) -> Optional[InterestCalculationResult]:
        """
        Calculate interest for a single invoice.
        """
        if profile is None:
            profile = self.DEFAULT_PROFILE
        
        if as_of_date is None:
            as_of_date = date.today()
        
        # Check if invoice is overdue
        if not invoice.due_date or invoice.status == InvoiceStatus.PAID:
            return None
        
        due_date = invoice.due_date
        if isinstance(due_date, datetime):
            due_date = due_date.date()
        
        # Calculate days overdue (after grace period)
        effective_due_date = due_date + timedelta(days=profile.grace_period_days)
        
        if as_of_date <= effective_due_date:
            return None  # Not yet overdue
        
        days_overdue = (as_of_date - effective_due_date).days
        
        # Calculate outstanding amount
        total_amount = invoice.total_amount or Decimal("0")
        paid_amount = invoice.paid_amount or Decimal("0")
        outstanding = total_amount - paid_amount
        
        # Check minimum amount
        if outstanding < profile.min_overdue_amount:
            return None
        
        # Calculate interest
        if profile.calculation_method == InterestCalculationMethod.SIMPLE:
            interest = self.calculate_simple_interest(
                outstanding,
                profile.interest_rate,
                days_overdue,
            )
            calc_details = f"Simple interest: {outstanding} * {profile.interest_rate}% * {days_overdue}/365"
        else:
            interest = self.calculate_compound_interest(
                outstanding,
                profile.interest_rate,
                days_overdue,
            )
            calc_details = f"Compound interest (monthly): {outstanding} at {profile.interest_rate}% for {days_overdue} days"
        
        return InterestCalculationResult(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            principal_amount=outstanding,
            due_date=due_date,
            days_overdue=days_overdue,
            interest_rate=profile.interest_rate,
            interest_amount=interest,
            total_due=outstanding + interest,
            calculation_details=calc_details,
        )
    
    def calculate_interest_for_purchase_invoice(
        self,
        invoice: PurchaseInvoice,
        profile: Optional[InterestProfile] = None,
        as_of_date: Optional[date] = None,
    ) -> Optional[InterestCalculationResult]:
        """Calculate interest for a purchase invoice (payables)."""
        if profile is None:
            profile = self.DEFAULT_PROFILE
        
        if as_of_date is None:
            as_of_date = date.today()
        
        # Check if invoice is overdue
        if not invoice.due_date or invoice.status == "paid":
            return None
        
        due_date = invoice.due_date
        if isinstance(due_date, datetime):
            due_date = due_date.date()
        
        effective_due_date = due_date + timedelta(days=profile.grace_period_days)
        
        if as_of_date <= effective_due_date:
            return None
        
        days_overdue = (as_of_date - effective_due_date).days
        
        total_amount = invoice.total_amount or Decimal("0")
        paid_amount = invoice.paid_amount or Decimal("0")
        outstanding = total_amount - paid_amount
        
        if outstanding < profile.min_overdue_amount:
            return None
        
        if profile.calculation_method == InterestCalculationMethod.SIMPLE:
            interest = self.calculate_simple_interest(outstanding, profile.interest_rate, days_overdue)
        else:
            interest = self.calculate_compound_interest(outstanding, profile.interest_rate, days_overdue)
        
        return InterestCalculationResult(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            principal_amount=outstanding,
            due_date=due_date,
            days_overdue=days_overdue,
            interest_rate=profile.interest_rate,
            interest_amount=interest,
            total_due=outstanding + interest,
            calculation_details=f"{profile.calculation_method.value} interest calculation",
        )
    
    def get_overdue_receivables_with_interest(
        self,
        company_id: str,
        profile: Optional[InterestProfile] = None,
        as_of_date: Optional[date] = None,
    ) -> List[InterestCalculationResult]:
        """Get all overdue receivables with calculated interest."""
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get overdue invoices
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company_id,
            Invoice.due_date < as_of_date,
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID]),
        ).all()
        
        results = []
        for invoice in invoices:
            result = self.calculate_interest_for_invoice(invoice, profile, as_of_date)
            if result:
                results.append(result)
        
        return results
    
    def get_overdue_payables_with_interest(
        self,
        company_id: str,
        profile: Optional[InterestProfile] = None,
        as_of_date: Optional[date] = None,
    ) -> List[InterestCalculationResult]:
        """Get all overdue payables with calculated interest."""
        if as_of_date is None:
            as_of_date = date.today()
        
        invoices = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.due_date < as_of_date,
            PurchaseInvoice.status.in_(["pending", "overdue", "partially_paid"]),
        ).all()
        
        results = []
        for invoice in invoices:
            result = self.calculate_interest_for_purchase_invoice(invoice, profile, as_of_date)
            if result:
                results.append(result)
        
        return results
    
    def get_interest_summary(
        self,
        company_id: str,
        profile: Optional[InterestProfile] = None,
        as_of_date: Optional[date] = None,
    ) -> Dict:
        """Get summary of all interest due."""
        receivables = self.get_overdue_receivables_with_interest(company_id, profile, as_of_date)
        payables = self.get_overdue_payables_with_interest(company_id, profile, as_of_date)
        
        total_receivable_interest = sum(r.interest_amount for r in receivables)
        total_payable_interest = sum(r.interest_amount for r in payables)
        
        return {
            "as_of_date": (as_of_date or date.today()).isoformat(),
            "receivables": {
                "count": len(receivables),
                "total_principal": float(sum(r.principal_amount for r in receivables)),
                "total_interest": float(total_receivable_interest),
                "total_due": float(sum(r.total_due for r in receivables)),
            },
            "payables": {
                "count": len(payables),
                "total_principal": float(sum(r.principal_amount for r in payables)),
                "total_interest": float(total_payable_interest),
                "total_due": float(sum(r.total_due for r in payables)),
            },
            "net_interest_position": float(total_receivable_interest - total_payable_interest),
        }
