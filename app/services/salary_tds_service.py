"""
TDS on Salary (Section 192) Service - Income Tax calculation for employees.

Tax calculation as per Income Tax Act with both Old and New tax regimes.

New Tax Regime (Default from FY 2024-25):
- No deductions allowed (except standard deduction Rs. 75,000)
- Lower tax rates with higher slabs

Old Tax Regime:
- Various deductions under Sections 80C, 80D, 80E, etc.
- HRA exemption, LTA, etc. available
- Higher tax rates

The employer must calculate and deduct TDS monthly based on:
1. Projected annual income
2. Declared investments/deductions
3. Tax regime chosen by employee
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple
from datetime import date
from sqlalchemy.orm import Session

from app.database.payroll_models import (
    Employee, EmployeeTaxDeclaration, PayrollSettings, TaxRegime
)


@dataclass
class TDSCalculationResult:
    """Result of TDS calculation."""
    monthly_tds: Decimal
    annual_tax: Decimal
    taxable_income: Decimal
    total_deductions: Decimal
    effective_tax_rate: Decimal
    tax_regime: TaxRegime
    breakdown: Dict[str, Decimal]


# Tax slabs for FY 2024-25

# New Tax Regime (Section 115BAC) - Default
NEW_REGIME_SLABS = [
    (Decimal("300000"), Decimal("0")),      # 0 - 3L: Nil
    (Decimal("700000"), Decimal("0.05")),   # 3L - 7L: 5%
    (Decimal("1000000"), Decimal("0.10")),  # 7L - 10L: 10%
    (Decimal("1200000"), Decimal("0.15")),  # 10L - 12L: 15%
    (Decimal("1500000"), Decimal("0.20")),  # 12L - 15L: 20%
    (Decimal("inf"), Decimal("0.30")),      # Above 15L: 30%
]

# New Regime Standard Deduction (FY 2024-25)
NEW_REGIME_STANDARD_DEDUCTION = Decimal("75000")

# Old Tax Regime
OLD_REGIME_SLABS = [
    (Decimal("250000"), Decimal("0")),      # 0 - 2.5L: Nil
    (Decimal("500000"), Decimal("0.05")),   # 2.5L - 5L: 5%
    (Decimal("1000000"), Decimal("0.20")),  # 5L - 10L: 20%
    (Decimal("inf"), Decimal("0.30")),      # Above 10L: 30%
]

# Old Regime Standard Deduction
OLD_REGIME_STANDARD_DEDUCTION = Decimal("50000")

# Deduction limits (Old Regime)
DEDUCTION_LIMITS = {
    "80C": Decimal("150000"),       # Max Rs. 1.5L
    "80CCD_1B": Decimal("50000"),   # Additional Rs. 50K for NPS
    "80D_SELF": Decimal("25000"),   # Health insurance - self
    "80D_PARENTS": Decimal("50000"), # Health insurance - parents (senior citizen)
    "80E": Decimal("inf"),          # Education loan interest - no limit
    "80G": Decimal("inf"),          # Donations - varies
    "80TTA": Decimal("10000"),      # Savings interest
    "HRA": Decimal("inf"),          # HRA exemption - calculated
    "LTA": Decimal("inf"),          # LTA - actual/eligible
    "HOME_LOAN_INTEREST": Decimal("200000"),  # Section 24
}

# Rebate u/s 87A
REBATE_87A_NEW_REGIME = {
    "income_limit": Decimal("700000"),
    "max_rebate": Decimal("25000"),
}

REBATE_87A_OLD_REGIME = {
    "income_limit": Decimal("500000"),
    "max_rebate": Decimal("12500"),
}

# Surcharge slabs
SURCHARGE_SLABS = [
    (Decimal("5000000"), Decimal("0")),      # Up to 50L: Nil
    (Decimal("10000000"), Decimal("0.10")),  # 50L - 1Cr: 10%
    (Decimal("20000000"), Decimal("0.15")),  # 1Cr - 2Cr: 15%
    (Decimal("50000000"), Decimal("0.25")),  # 2Cr - 5Cr: 25%
    (Decimal("inf"), Decimal("0.37")),       # Above 5Cr: 37%
]

# Health & Education Cess
CESS_RATE = Decimal("0.04")  # 4%


class SalaryTDSService:
    """Service for TDS on Salary calculations (Section 192)."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to nearest rupee."""
        return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    
    def _round_tax(self, amount: Decimal) -> Decimal:
        """Round tax to nearest 10 rupees (for TDS purposes)."""
        return (amount / 10).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * 10
    
    def get_tax_declaration(
        self,
        employee_id: str,
        financial_year: str,
    ) -> Optional[EmployeeTaxDeclaration]:
        """Get employee's tax declaration for a financial year."""
        return self.db.query(EmployeeTaxDeclaration).filter(
            EmployeeTaxDeclaration.employee_id == employee_id,
            EmployeeTaxDeclaration.financial_year == financial_year,
        ).first()
    
    def calculate_hra_exemption(
        self,
        basic_salary: Decimal,
        hra_received: Decimal,
        rent_paid: Decimal,
        is_metro: bool = False,
    ) -> Decimal:
        """
        Calculate HRA exemption under Section 10(13A).
        
        HRA exemption is minimum of:
        1. Actual HRA received
        2. 50% of salary (metro) or 40% of salary (non-metro)
        3. Rent paid - 10% of salary
        
        Salary = Basic + DA (if forms part of retirement benefits)
        """
        # For simplicity, assuming salary = basic only
        salary = basic_salary
        
        # Calculate all three
        actual_hra = hra_received
        percent_of_salary = salary * (Decimal("0.5") if is_metro else Decimal("0.4"))
        rent_minus_10_percent = max(rent_paid - (salary * Decimal("0.1")), Decimal("0"))
        
        return min(actual_hra, percent_of_salary, rent_minus_10_percent)
    
    def calculate_total_deductions_old_regime(
        self,
        declaration: Optional[EmployeeTaxDeclaration],
        annual_basic: Decimal,
        annual_hra: Decimal = Decimal("0"),
    ) -> Tuple[Decimal, Dict[str, Decimal]]:
        """
        Calculate total deductions under Old Tax Regime.
        
        Returns (total_deductions, breakdown_dict)
        """
        breakdown = {}
        
        # Standard deduction
        breakdown["standard_deduction"] = OLD_REGIME_STANDARD_DEDUCTION
        
        if not declaration:
            return breakdown["standard_deduction"], breakdown
        
        # Section 80C
        sec_80c_total = (
            (declaration.sec_80c_ppf or Decimal("0")) +
            (declaration.sec_80c_elss or Decimal("0")) +
            (declaration.sec_80c_life_insurance or Decimal("0")) +
            (declaration.sec_80c_nsc or Decimal("0")) +
            (declaration.sec_80c_tuition_fees or Decimal("0")) +
            (declaration.sec_80c_home_loan_principal or Decimal("0")) +
            (declaration.sec_80c_others or Decimal("0"))
        )
        breakdown["80C"] = min(sec_80c_total, DEDUCTION_LIMITS["80C"])
        
        # Section 80CCD(1B) - NPS
        breakdown["80CCD_1B"] = min(
            declaration.sec_80ccd_1b or Decimal("0"),
            DEDUCTION_LIMITS["80CCD_1B"]
        )
        
        # Section 80D - Health Insurance
        breakdown["80D_SELF"] = min(
            declaration.sec_80d_self or Decimal("0"),
            DEDUCTION_LIMITS["80D_SELF"]
        )
        breakdown["80D_PARENTS"] = min(
            declaration.sec_80d_parents or Decimal("0"),
            DEDUCTION_LIMITS["80D_PARENTS"]
        )
        
        # Section 80E - Education Loan Interest
        breakdown["80E"] = declaration.sec_80e or Decimal("0")
        
        # Section 80G - Donations
        breakdown["80G"] = declaration.sec_80g or Decimal("0")
        
        # Section 80TTA - Savings Interest
        breakdown["80TTA"] = min(
            declaration.sec_80tta or Decimal("0"),
            DEDUCTION_LIMITS["80TTA"]
        )
        
        # HRA Exemption
        if declaration.hra_rent_paid_annual and declaration.hra_rent_paid_annual > 0:
            hra_exemption = self.calculate_hra_exemption(
                basic_salary=annual_basic / 12,  # Monthly basic
                hra_received=annual_hra / 12,
                rent_paid=declaration.hra_rent_paid_annual / 12,
                is_metro=declaration.hra_metro_city or False,
            )
            breakdown["HRA"] = hra_exemption * 12  # Annual
        
        # Home Loan Interest (Section 24)
        if declaration.home_loan_interest:
            limit = DEDUCTION_LIMITS["HOME_LOAN_INTEREST"] if declaration.home_loan_is_self_occupied else Decimal("inf")
            breakdown["home_loan_interest"] = min(
                declaration.home_loan_interest,
                limit
            )
        
        total = sum(breakdown.values())
        return total, breakdown
    
    def calculate_total_deductions_new_regime(self) -> Tuple[Decimal, Dict[str, Decimal]]:
        """
        Calculate total deductions under New Tax Regime.
        
        Only standard deduction is allowed.
        """
        breakdown = {
            "standard_deduction": NEW_REGIME_STANDARD_DEDUCTION,
        }
        return NEW_REGIME_STANDARD_DEDUCTION, breakdown
    
    def calculate_tax_on_income(
        self,
        taxable_income: Decimal,
        tax_regime: TaxRegime,
    ) -> Tuple[Decimal, Dict[str, Decimal]]:
        """
        Calculate tax on taxable income using appropriate slabs.
        
        Returns (total_tax, breakdown)
        """
        slabs = NEW_REGIME_SLABS if tax_regime == TaxRegime.NEW else OLD_REGIME_SLABS
        
        breakdown = {}
        remaining_income = taxable_income
        previous_limit = Decimal("0")
        total_tax = Decimal("0")
        
        for slab_limit, rate in slabs:
            if remaining_income <= 0:
                break
            
            slab_income = min(remaining_income, slab_limit - previous_limit)
            slab_tax = self._round_amount(slab_income * rate)
            
            if slab_tax > 0:
                breakdown[f"tax_at_{int(rate * 100)}%"] = slab_tax
            
            total_tax += slab_tax
            remaining_income -= slab_income
            previous_limit = slab_limit
        
        return total_tax, breakdown
    
    def apply_rebate_87a(
        self,
        taxable_income: Decimal,
        tax_amount: Decimal,
        tax_regime: TaxRegime,
    ) -> Decimal:
        """
        Apply rebate under Section 87A.
        
        New Regime: If income <= 7L, rebate up to Rs. 25,000
        Old Regime: If income <= 5L, rebate up to Rs. 12,500
        """
        if tax_regime == TaxRegime.NEW:
            limits = REBATE_87A_NEW_REGIME
        else:
            limits = REBATE_87A_OLD_REGIME
        
        if taxable_income <= limits["income_limit"]:
            return min(tax_amount, limits["max_rebate"])
        
        return Decimal("0")
    
    def calculate_surcharge(
        self,
        taxable_income: Decimal,
        tax_amount: Decimal,
    ) -> Decimal:
        """Calculate surcharge on tax based on income level."""
        for income_limit, rate in SURCHARGE_SLABS:
            if taxable_income <= income_limit:
                return self._round_amount(tax_amount * rate)
        
        return Decimal("0")
    
    def calculate_cess(self, tax_plus_surcharge: Decimal) -> Decimal:
        """Calculate Health & Education Cess (4%)."""
        return self._round_amount(tax_plus_surcharge * CESS_RATE)
    
    def calculate_annual_tds(
        self,
        employee: Employee,
        annual_gross_salary: Decimal,
        annual_basic: Decimal = Decimal("0"),
        annual_hra: Decimal = Decimal("0"),
        financial_year: str = None,
        other_income: Decimal = Decimal("0"),
        previous_employer_income: Decimal = Decimal("0"),
        previous_employer_tds: Decimal = Decimal("0"),
    ) -> TDSCalculationResult:
        """
        Calculate annual TDS for an employee.
        
        Args:
            employee: Employee model
            annual_gross_salary: Total projected annual gross salary
            annual_basic: Annual basic salary (for HRA calculation)
            annual_hra: Annual HRA (for exemption calculation)
            financial_year: FY string (e.g., "2024-2025")
            other_income: Other income declared by employee
            previous_employer_income: Income from previous employer
            previous_employer_tds: TDS already deducted by previous employer
        
        Returns:
            TDSCalculationResult with complete tax calculation
        """
        # Determine financial year
        if not financial_year:
            today = date.today()
            if today.month >= 4:
                financial_year = f"{today.year}-{today.year + 1}"
            else:
                financial_year = f"{today.year - 1}-{today.year}"
        
        # Get tax declaration
        declaration = self.get_tax_declaration(employee.id, financial_year)
        
        # Determine tax regime
        tax_regime = TaxRegime.NEW  # Default
        if declaration and declaration.tax_regime:
            tax_regime = declaration.tax_regime
        elif employee.tax_regime:
            tax_regime = employee.tax_regime
        
        # Add other income
        total_income = annual_gross_salary + other_income + previous_employer_income
        
        # Calculate deductions based on regime
        if tax_regime == TaxRegime.NEW:
            total_deductions, deduction_breakdown = self.calculate_total_deductions_new_regime()
        else:
            total_deductions, deduction_breakdown = self.calculate_total_deductions_old_regime(
                declaration=declaration,
                annual_basic=annual_basic,
                annual_hra=annual_hra,
            )
        
        # Calculate taxable income
        taxable_income = max(total_income - total_deductions, Decimal("0"))
        
        # Calculate tax
        tax_before_rebate, tax_breakdown = self.calculate_tax_on_income(taxable_income, tax_regime)
        
        # Apply rebate 87A
        rebate = self.apply_rebate_87a(taxable_income, tax_before_rebate, tax_regime)
        tax_after_rebate = tax_before_rebate - rebate
        
        if rebate > 0:
            tax_breakdown["rebate_87A"] = -rebate
        
        # Calculate surcharge
        surcharge = self.calculate_surcharge(taxable_income, tax_after_rebate)
        if surcharge > 0:
            tax_breakdown["surcharge"] = surcharge
        
        # Calculate cess
        cess = self.calculate_cess(tax_after_rebate + surcharge)
        tax_breakdown["cess"] = cess
        
        # Total annual tax
        annual_tax = tax_after_rebate + surcharge + cess
        
        # Deduct TDS already paid to previous employer
        annual_tax = max(annual_tax - previous_employer_tds, Decimal("0"))
        
        # Calculate monthly TDS (remaining months in FY)
        today = date.today()
        remaining_months = self._get_remaining_months(today, financial_year)
        monthly_tds = self._round_tax(annual_tax / remaining_months) if remaining_months > 0 else Decimal("0")
        
        # Effective tax rate
        effective_rate = (annual_tax / total_income * 100) if total_income > 0 else Decimal("0")
        
        return TDSCalculationResult(
            monthly_tds=monthly_tds,
            annual_tax=annual_tax,
            taxable_income=taxable_income,
            total_deductions=total_deductions,
            effective_tax_rate=self._round_amount(effective_rate),
            tax_regime=tax_regime,
            breakdown={
                "gross_income": float(total_income),
                "deductions": {k: float(v) for k, v in deduction_breakdown.items()},
                "tax_calculation": {k: float(v) for k, v in tax_breakdown.items()},
            },
        )
    
    def _get_remaining_months(self, current_date: date, financial_year: str) -> int:
        """Get remaining months in financial year from current date."""
        fy_start_year = int(financial_year.split("-")[0])
        
        # FY is April to March
        if current_date.month >= 4:
            months_elapsed = current_date.month - 4
        else:
            months_elapsed = current_date.month + 8
        
        return max(12 - months_elapsed, 1)
    
    def calculate_monthly_tds(
        self,
        employee: Employee,
        monthly_gross: Decimal,
        monthly_basic: Decimal,
        monthly_hra: Decimal = Decimal("0"),
        month: int = 1,
        year: int = 2024,
        ytd_salary: Decimal = Decimal("0"),
        ytd_tds: Decimal = Decimal("0"),
    ) -> Decimal:
        """
        Calculate TDS for a specific month.
        
        Uses averaging method:
        1. Project annual income based on current month's salary
        2. Calculate annual tax
        3. Deduct TDS already paid
        4. Divide remaining by remaining months
        """
        # Determine financial year
        if month >= 4:
            financial_year = f"{year}-{year + 1}"
        else:
            financial_year = f"{year - 1}-{year}"
        
        # Project annual salary
        months_remaining = self._get_months_remaining_from_month(month)
        projected_future = monthly_gross * months_remaining
        projected_annual = ytd_salary + projected_future
        
        # Project basic and HRA
        projected_basic = monthly_basic * 12
        projected_hra = monthly_hra * 12
        
        # Get declaration for other income
        declaration = self.get_tax_declaration(employee.id, financial_year)
        other_income = Decimal("0")
        prev_income = Decimal("0")
        prev_tds = Decimal("0")
        
        if declaration:
            other_income = declaration.other_income or Decimal("0")
            prev_income = declaration.previous_employer_income or Decimal("0")
            prev_tds = declaration.previous_employer_tds or Decimal("0")
        
        # Calculate full year tax
        result = self.calculate_annual_tds(
            employee=employee,
            annual_gross_salary=projected_annual,
            annual_basic=projected_basic,
            annual_hra=projected_hra,
            financial_year=financial_year,
            other_income=other_income,
            previous_employer_income=prev_income,
            previous_employer_tds=prev_tds,
        )
        
        # Remaining tax to collect
        remaining_tax = max(result.annual_tax - ytd_tds, Decimal("0"))
        
        # Monthly TDS
        monthly_tds = self._round_tax(remaining_tax / months_remaining) if months_remaining > 0 else Decimal("0")
        
        return monthly_tds
    
    def _get_months_remaining_from_month(self, month: int) -> int:
        """Get remaining months in FY from a given month."""
        if month >= 4:
            return 12 - (month - 4)
        else:
            return 3 - month + 1
    
    def get_form16_data(
        self,
        employee_id: str,
        financial_year: str,
    ) -> dict:
        """
        Generate Form 16 data for an employee.
        
        Form 16 is the TDS certificate issued by employer.
        """
        from app.database.payroll_models import PayrollRun, PayrollEntry
        
        employee = self.db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            return {"error": "Employee not found"}
        
        # Get all payroll entries for the financial year
        fy_start_year = int(financial_year.split("-")[0])
        
        entries = self.db.query(PayrollEntry).join(PayrollRun).filter(
            PayrollEntry.employee_id == employee_id,
            (
                (PayrollRun.pay_period_year == fy_start_year) & (PayrollRun.pay_period_month >= 4) |
                (PayrollRun.pay_period_year == fy_start_year + 1) & (PayrollRun.pay_period_month <= 3)
            )
        ).order_by(PayrollRun.pay_period_year, PayrollRun.pay_period_month).all()
        
        # Aggregate
        total_gross = sum(e.gross_salary or Decimal("0") for e in entries)
        total_tds = sum(e.tds or Decimal("0") for e in entries)
        total_pf = sum(e.pf_employee or Decimal("0") for e in entries)
        total_pt = sum(e.professional_tax or Decimal("0") for e in entries)
        
        # Get declaration
        declaration = self.get_tax_declaration(employee_id, financial_year)
        
        return {
            "employee": {
                "name": employee.full_name,
                "pan": employee.pan,
                "employee_code": employee.employee_code,
            },
            "financial_year": financial_year,
            "gross_salary": float(total_gross),
            "allowances": {},  # Would need detailed breakdown
            "perquisites": 0,
            "profits_in_lieu": 0,
            "deductions": {
                "standard_deduction": float(NEW_REGIME_STANDARD_DEDUCTION if employee.tax_regime == TaxRegime.NEW else OLD_REGIME_STANDARD_DEDUCTION),
                "pf": float(total_pf),
                "pt": float(total_pt),
            },
            "tds_deducted": float(total_tds),
            "monthly_breakdown": [
                {
                    "month": e.payroll_run.pay_period_month,
                    "year": e.payroll_run.pay_period_year,
                    "gross": float(e.gross_salary or 0),
                    "tds": float(e.tds or 0),
                }
                for e in entries
            ],
        }
