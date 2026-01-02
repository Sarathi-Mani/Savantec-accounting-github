"""
ESI (Employee State Insurance) Service - Calculates ESI contributions.

ESI Rules as per ESIC (2024):
- Applicable if monthly gross wages <= Rs.21,000
- Employee contribution: 0.75% of gross wages
- Employer contribution: 3.25% of gross wages
- Total: 4% of gross wages

ESI provides medical benefits, sickness benefits, maternity benefits,
disablement benefits, and dependent benefits to employees and their families.

Once covered, employee remains covered even if wage exceeds limit,
until next contribution period (April-September or October-March).
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Tuple
from datetime import date
from sqlalchemy.orm import Session

from app.database.payroll_models import Employee, PayrollSettings


@dataclass
class ESICalculationResult:
    """Result of ESI calculation."""
    # Contributions
    employee_esi: Decimal
    employer_esi: Decimal
    total_esi: Decimal
    
    # Wage details
    esi_wage: Decimal  # Gross wage for ESI
    is_applicable: bool  # Whether ESI is applicable
    reason: str  # Reason if not applicable


class ESIService:
    """Service for ESI (Employee State Insurance) calculations."""
    
    # Standard rates as per ESIC
    ESI_WAGE_CEILING = Decimal("21000")  # Rs. 21,000 monthly ceiling
    
    # Contribution rates
    EMPLOYEE_ESI_RATE = Decimal("0.0075")  # 0.75%
    EMPLOYER_ESI_RATE = Decimal("0.0325")  # 3.25%
    TOTAL_ESI_RATE = Decimal("0.04")  # 4% total
    
    # Minimum contribution (round off below Rs.1 to Rs.1)
    MIN_CONTRIBUTION = Decimal("1")
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to nearest rupee."""
        return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    
    def _round_paise(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def get_esi_settings(self, company_id: str) -> Optional[PayrollSettings]:
        """Get company-specific ESI settings."""
        return self.db.query(PayrollSettings).filter(
            PayrollSettings.company_id == company_id
        ).first()
    
    def get_contribution_period(self, for_date: date) -> Tuple[date, date]:
        """
        Get ESI contribution period for a given date.
        
        ESI has two contribution periods:
        - April to September (benefits from January to June of next cycle)
        - October to March (benefits from July to December)
        """
        year = for_date.year
        month = for_date.month
        
        if 4 <= month <= 9:
            # April-September contribution period
            start = date(year, 4, 1)
            end = date(year, 9, 30)
        else:
            # October-March contribution period
            if month >= 10:
                start = date(year, 10, 1)
                end = date(year + 1, 3, 31)
            else:
                start = date(year - 1, 10, 1)
                end = date(year, 3, 31)
        
        return start, end
    
    def check_esi_applicability(
        self,
        gross_salary: Decimal,
        company_id: Optional[str] = None,
        employee: Optional[Employee] = None,
        was_covered_in_period: bool = False,
    ) -> Tuple[bool, str]:
        """
        Check if ESI is applicable for given salary.
        
        Args:
            gross_salary: Monthly gross salary
            company_id: Company ID for custom settings
            employee: Employee model for checking flags
            was_covered_in_period: Whether employee was covered earlier in contribution period
        
        Returns:
            Tuple of (is_applicable, reason)
        """
        # Check employee-level flag
        if employee and not employee.esi_applicable:
            return False, "ESI disabled for employee"
        
        # Check company settings
        if company_id:
            settings = self.get_esi_settings(company_id)
            if settings and not settings.esi_enabled:
                return False, "ESI disabled for company"
        
        # Get ceiling
        ceiling = self.ESI_WAGE_CEILING
        if company_id:
            settings = self.get_esi_settings(company_id)
            if settings and settings.esi_wage_ceiling:
                ceiling = settings.esi_wage_ceiling
        
        # Once covered in a contribution period, remains covered
        # even if salary exceeds ceiling
        if was_covered_in_period:
            return True, "Continued coverage in contribution period"
        
        # Check against ceiling
        if gross_salary > ceiling:
            return False, f"Gross salary exceeds ESI ceiling of Rs.{ceiling}"
        
        return True, "ESI applicable"
    
    def calculate_esi(
        self,
        gross_salary: Decimal,
        company_id: Optional[str] = None,
        employee: Optional[Employee] = None,
        was_covered_in_period: bool = False,
        check_applicability: bool = True,
    ) -> ESICalculationResult:
        """
        Calculate ESI contributions.
        
        Args:
            gross_salary: Monthly gross salary (all earnings)
            company_id: Company ID for custom settings
            employee: Employee model for checking flags
            was_covered_in_period: Whether covered earlier in this period
            check_applicability: Whether to check applicability
        
        Returns:
            ESICalculationResult with contribution details
        """
        # Check applicability
        if check_applicability:
            is_applicable, reason = self.check_esi_applicability(
                gross_salary=gross_salary,
                company_id=company_id,
                employee=employee,
                was_covered_in_period=was_covered_in_period,
            )
            
            if not is_applicable:
                return ESICalculationResult(
                    employee_esi=Decimal("0"),
                    employer_esi=Decimal("0"),
                    total_esi=Decimal("0"),
                    esi_wage=gross_salary,
                    is_applicable=False,
                    reason=reason,
                )
        
        # Get rates from settings or use defaults
        employee_rate = self.EMPLOYEE_ESI_RATE
        employer_rate = self.EMPLOYER_ESI_RATE
        
        if company_id:
            settings = self.get_esi_settings(company_id)
            if settings:
                if settings.esi_employee_rate:
                    employee_rate = settings.esi_employee_rate / Decimal("100")
                if settings.esi_employer_rate:
                    employer_rate = settings.esi_employer_rate / Decimal("100")
        
        # Calculate contributions
        employee_esi = self._round_amount(gross_salary * employee_rate)
        employer_esi = self._round_amount(gross_salary * employer_rate)
        
        # Minimum contribution check
        if employee_esi > 0 and employee_esi < self.MIN_CONTRIBUTION:
            employee_esi = self.MIN_CONTRIBUTION
        if employer_esi > 0 and employer_esi < self.MIN_CONTRIBUTION:
            employer_esi = self.MIN_CONTRIBUTION
        
        total_esi = employee_esi + employer_esi
        
        return ESICalculationResult(
            employee_esi=employee_esi,
            employer_esi=employer_esi,
            total_esi=total_esi,
            esi_wage=gross_salary,
            is_applicable=True,
            reason="ESI calculated",
        )
    
    def calculate_esi_for_employee(
        self,
        employee: Employee,
        gross_salary: Decimal,
        payroll_month: int,
        payroll_year: int,
    ) -> ESICalculationResult:
        """
        Calculate ESI for an employee for a specific month.
        
        Args:
            employee: Employee model instance
            gross_salary: Monthly gross salary
            payroll_month: Month number (1-12)
            payroll_year: Year
        
        Returns:
            ESICalculationResult
        """
        # Check if employee was covered earlier in this contribution period
        was_covered = self._was_covered_in_period(
            employee.id,
            payroll_month,
            payroll_year,
        )
        
        return self.calculate_esi(
            gross_salary=gross_salary,
            company_id=employee.company_id,
            employee=employee,
            was_covered_in_period=was_covered,
        )
    
    def _was_covered_in_period(
        self,
        employee_id: str,
        month: int,
        year: int,
    ) -> bool:
        """
        Check if employee was covered under ESI earlier in this contribution period.
        """
        from app.database.payroll_models import PayrollEntry, PayrollRun
        
        # Get contribution period dates
        check_date = date(year, month, 1)
        period_start, period_end = self.get_contribution_period(check_date)
        
        # Check if there are any previous entries with ESI in this period
        entries = self.db.query(PayrollEntry).join(PayrollRun).filter(
            PayrollEntry.employee_id == employee_id,
            PayrollEntry.esi_employee > 0,
            PayrollRun.pay_period_year >= period_start.year,
            PayrollRun.pay_period_month >= period_start.month if PayrollRun.pay_period_year == period_start.year else True,
        ).count()
        
        return entries > 0
    
    def get_esi_summary_for_month(
        self,
        company_id: str,
        month: int,
        year: int,
    ) -> dict:
        """
        Get ESI summary for a company for a specific month.
        Useful for generating ESI challans.
        """
        from app.database.payroll_models import PayrollRun, PayrollEntry
        
        payroll_run = self.db.query(PayrollRun).filter(
            PayrollRun.company_id == company_id,
            PayrollRun.pay_period_month == month,
            PayrollRun.pay_period_year == year,
        ).first()
        
        if not payroll_run:
            return {
                "month": month,
                "year": year,
                "total_employees": 0,
                "total_esi_wage": Decimal("0"),
                "total_employee_esi": Decimal("0"),
                "total_employer_esi": Decimal("0"),
                "total_esi": Decimal("0"),
            }
        
        entries = self.db.query(PayrollEntry).filter(
            PayrollEntry.payroll_run_id == payroll_run.id,
            PayrollEntry.esi_employee > 0,
        ).all()
        
        total_esi_wage = sum(e.gross_for_esi or Decimal("0") for e in entries)
        total_employee_esi = sum(e.esi_employee or Decimal("0") for e in entries)
        total_employer_esi = sum(e.esi_employer or Decimal("0") for e in entries)
        
        return {
            "month": month,
            "year": year,
            "total_employees": len(entries),
            "total_esi_wage": total_esi_wage,
            "total_employee_esi": total_employee_esi,
            "total_employer_esi": total_employer_esi,
            "total_esi": total_employee_esi + total_employer_esi,
        }
    
    def generate_esi_challan_data(
        self,
        company_id: str,
        month: int,
        year: int,
    ) -> List[dict]:
        """
        Generate ESI challan data for ESIC filing.
        
        Returns list of employee-wise ESI contribution details.
        """
        from app.database.payroll_models import PayrollRun, PayrollEntry
        
        payroll_run = self.db.query(PayrollRun).filter(
            PayrollRun.company_id == company_id,
            PayrollRun.pay_period_month == month,
            PayrollRun.pay_period_year == year,
        ).first()
        
        if not payroll_run:
            return []
        
        entries = self.db.query(PayrollEntry).filter(
            PayrollEntry.payroll_run_id == payroll_run.id,
        ).all()
        
        challan_data = []
        for entry in entries:
            employee = entry.employee
            if not employee or not employee.esi_applicable:
                continue
            
            if entry.esi_employee == 0:
                continue
            
            challan_data.append({
                "esi_number": employee.esi_number or "",
                "employee_name": employee.full_name,
                "esi_wage": float(entry.gross_for_esi or 0),
                "employee_contribution": float(entry.esi_employee or 0),
                "employer_contribution": float(entry.esi_employer or 0),
                "total_contribution": float((entry.esi_employee or 0) + (entry.esi_employer or 0)),
                "days_worked": entry.days_worked or 0,
            })
        
        return challan_data


def get_esi_components_for_gross(
    basic: Decimal,
    hra: Decimal = Decimal("0"),
    conveyance: Decimal = Decimal("0"),
    special_allowance: Decimal = Decimal("0"),
    other_allowances: Decimal = Decimal("0"),
) -> Decimal:
    """
    Calculate gross wages for ESI purposes.
    
    ESI gross includes:
    - Basic salary
    - HRA
    - Conveyance
    - Special allowances
    - All other regular allowances
    
    ESI gross excludes:
    - Overtime (occasional)
    - Commission (if occasional)
    - Reimbursements
    - Gratuity
    - Annual bonus
    - Leave encashment
    """
    return basic + hra + conveyance + special_allowance + other_allowances
