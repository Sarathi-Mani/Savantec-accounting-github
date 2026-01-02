"""
PF (Provident Fund) Service - Calculates EPF, EPS, EDLI contributions.

PF Rules as per EPFO (2024):
- Employee contribution: 12% of Basic + DA (can be capped at Rs.15,000 or full wages if opted)
- Employer contribution: 12% split as:
  - EPF (Employees' Provident Fund): 3.67%
  - EPS (Employees' Pension Scheme): 8.33% (capped at Rs.15,000 basic)
  
Additional Employer charges:
- EDLI (Employees' Deposit Linked Insurance): 0.5% of Basic+DA (capped at Rs.15,000)
- PF Admin charges: 0.5% of Basic+DA (min Rs.500)
- EDLI Admin charges: Nominal (0.01% rounded off)

For international workers (IW):
- Full wages applicable (no ceiling)
- EPS not applicable
- Employer contribution goes entirely to EPF
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional
from sqlalchemy.orm import Session

from app.database.payroll_models import Employee, PayrollSettings


@dataclass
class PFCalculationResult:
    """Result of PF calculation."""
    # Employee contribution
    employee_pf: Decimal
    
    # Employer contributions
    employer_epf: Decimal  # Goes to PF account
    employer_eps: Decimal  # Goes to Pension (capped)
    employer_total: Decimal  # EPF + EPS = 12%
    
    # Additional employer charges
    edli: Decimal  # Deposit Linked Insurance
    pf_admin_charges: Decimal
    edli_admin_charges: Decimal
    
    # Totals
    total_employer_cost: Decimal  # employer_total + edli + admin
    
    # Wage details
    pf_wage: Decimal  # Wage considered for PF
    pf_wage_ceiling_applied: bool  # Whether ceiling was applied


class PFService:
    """Service for PF (Provident Fund) calculations."""
    
    # Standard rates as per EPFO
    PF_WAGE_CEILING = Decimal("15000")  # Rs. 15,000 ceiling
    
    # Employee contribution
    EMPLOYEE_PF_RATE = Decimal("0.12")  # 12%
    
    # Employer contribution breakdown
    EMPLOYER_EPF_RATE = Decimal("0.0367")  # 3.67% to EPF
    EMPLOYER_EPS_RATE = Decimal("0.0833")  # 8.33% to EPS
    EMPLOYER_TOTAL_RATE = Decimal("0.12")  # 12% total
    
    # Additional charges
    EDLI_RATE = Decimal("0.005")  # 0.5%
    PF_ADMIN_RATE = Decimal("0.005")  # 0.5%
    PF_ADMIN_MINIMUM = Decimal("500")  # Minimum Rs. 500
    EDLI_ADMIN_RATE = Decimal("0.0001")  # 0.01%
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to nearest rupee (no paise in PF)."""
        return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    
    def _round_paise(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def get_pf_settings(self, company_id: str) -> Optional[PayrollSettings]:
        """Get company-specific PF settings."""
        return self.db.query(PayrollSettings).filter(
            PayrollSettings.company_id == company_id
        ).first()
    
    def calculate_pf(
        self,
        basic_salary: Decimal,
        da_amount: Decimal = Decimal("0"),
        company_id: Optional[str] = None,
        is_international_worker: bool = False,
        apply_ceiling: bool = True,
        voluntary_pf_rate: Optional[Decimal] = None,  # For VPF (Voluntary PF)
    ) -> PFCalculationResult:
        """
        Calculate PF contributions for an employee.
        
        Args:
            basic_salary: Basic salary amount
            da_amount: Dearness Allowance amount (if applicable)
            company_id: Company ID for custom settings
            is_international_worker: Whether employee is an international worker
            apply_ceiling: Whether to apply Rs.15,000 ceiling
            voluntary_pf_rate: Additional voluntary PF rate (e.g., 0.05 for 5% extra)
        
        Returns:
            PFCalculationResult with all contribution details
        """
        # Get company settings if available
        settings = None
        if company_id:
            settings = self.get_pf_settings(company_id)
        
        # Calculate PF wage (Basic + DA)
        pf_wage = basic_salary + da_amount
        
        # Determine ceiling
        ceiling = self.PF_WAGE_CEILING
        if settings and settings.pf_wage_ceiling:
            ceiling = settings.pf_wage_ceiling
        
        # For international workers, no ceiling applies
        # For others, apply ceiling if opted
        ceiling_applied = False
        pf_wage_for_calculation = pf_wage
        
        if not is_international_worker and apply_ceiling and pf_wage > ceiling:
            pf_wage_for_calculation = ceiling
            ceiling_applied = True
        
        # Employee contribution (12% of PF wage)
        employee_rate = self.EMPLOYEE_PF_RATE
        if settings and settings.pf_contribution_rate:
            employee_rate = settings.pf_contribution_rate / Decimal("100")
        
        employee_pf = self._round_amount(pf_wage_for_calculation * employee_rate)
        
        # Add voluntary PF if applicable
        if voluntary_pf_rate and voluntary_pf_rate > 0:
            vpf = self._round_amount(pf_wage * voluntary_pf_rate)
            employee_pf += vpf
        
        # Employer contributions
        if is_international_worker:
            # IW: Full 12% goes to EPF, no EPS
            employer_epf = self._round_amount(pf_wage_for_calculation * self.EMPLOYER_TOTAL_RATE)
            employer_eps = Decimal("0")
        else:
            # Regular: Split between EPF (3.67%) and EPS (8.33%)
            # Note: EPS is always calculated on actual wage capped at 15000
            eps_wage = min(pf_wage, self.PF_WAGE_CEILING)
            employer_eps = self._round_amount(eps_wage * self.EMPLOYER_EPS_RATE)
            
            # EPF gets the rest to make total 12%
            employer_total = self._round_amount(pf_wage_for_calculation * self.EMPLOYER_TOTAL_RATE)
            employer_epf = employer_total - employer_eps
        
        employer_total = employer_epf + employer_eps
        
        # EDLI (capped at Rs.15,000 wage)
        edli_wage = min(pf_wage, self.PF_WAGE_CEILING)
        edli = self._round_amount(edli_wage * self.EDLI_RATE)
        
        # Admin charges
        pf_admin = max(
            self._round_amount(pf_wage_for_calculation * self.PF_ADMIN_RATE),
            self.PF_ADMIN_MINIMUM
        )
        
        edli_admin = self._round_amount(edli_wage * self.EDLI_ADMIN_RATE)
        
        # Total employer cost
        total_employer_cost = employer_total + edli + pf_admin + edli_admin
        
        return PFCalculationResult(
            employee_pf=employee_pf,
            employer_epf=employer_epf,
            employer_eps=employer_eps,
            employer_total=employer_total,
            edli=edli,
            pf_admin_charges=pf_admin,
            edli_admin_charges=edli_admin,
            total_employer_cost=total_employer_cost,
            pf_wage=pf_wage_for_calculation,
            pf_wage_ceiling_applied=ceiling_applied,
        )
    
    def calculate_monthly_pf_for_employee(
        self,
        employee: Employee,
        basic_salary: Decimal,
        da_amount: Decimal = Decimal("0"),
    ) -> Optional[PFCalculationResult]:
        """
        Calculate PF for an employee based on their settings.
        
        Args:
            employee: Employee model instance
            basic_salary: Monthly basic salary
            da_amount: Monthly DA (if applicable)
        
        Returns:
            PFCalculationResult or None if PF not applicable
        """
        # Check if PF is applicable for this employee
        if not employee.pf_applicable:
            return None
        
        # Check company settings
        settings = self.get_pf_settings(employee.company_id)
        if settings and not settings.pf_enabled:
            return None
        
        return self.calculate_pf(
            basic_salary=basic_salary,
            da_amount=da_amount,
            company_id=employee.company_id,
            apply_ceiling=True,  # Use ceiling by default
        )
    
    def get_pf_summary_for_month(
        self,
        company_id: str,
        month: int,
        year: int,
    ) -> dict:
        """
        Get PF summary for a company for a specific month.
        Useful for generating ECR (Electronic Challan cum Return).
        
        Returns summary with total contributions.
        """
        from app.database.payroll_models import PayrollRun, PayrollEntry
        
        # Find payroll run for the month
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
                "total_pf_wage": Decimal("0"),
                "total_employee_pf": Decimal("0"),
                "total_employer_epf": Decimal("0"),
                "total_employer_eps": Decimal("0"),
                "total_edli": Decimal("0"),
                "total_admin_charges": Decimal("0"),
                "grand_total": Decimal("0"),
            }
        
        # Aggregate from payroll entries
        entries = self.db.query(PayrollEntry).filter(
            PayrollEntry.payroll_run_id == payroll_run.id,
            PayrollEntry.pf_employee > 0,
        ).all()
        
        total_pf_wage = sum(e.basic_for_pf or Decimal("0") for e in entries)
        total_employee_pf = sum(e.pf_employee or Decimal("0") for e in entries)
        total_employer_pf = sum(e.pf_employer or Decimal("0") for e in entries)
        total_eps = sum(e.eps_employer or Decimal("0") for e in entries)
        total_edli = sum(e.edli_employer or Decimal("0") for e in entries)
        total_admin = sum(e.pf_admin or Decimal("0") for e in entries)
        
        return {
            "month": month,
            "year": year,
            "total_employees": len(entries),
            "total_pf_wage": total_pf_wage,
            "total_employee_pf": total_employee_pf,
            "total_employer_epf": total_employer_pf - total_eps,  # EPF portion
            "total_employer_eps": total_eps,
            "total_edli": total_edli,
            "total_admin_charges": total_admin,
            "grand_total": total_employee_pf + total_employer_pf + total_edli + total_admin,
        }
    
    def generate_ecr_data(
        self,
        company_id: str,
        month: int,
        year: int,
    ) -> list:
        """
        Generate ECR (Electronic Challan cum Return) data for EPFO filing.
        
        Returns list of employee-wise PF contribution details.
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
        
        ecr_data = []
        for entry in entries:
            employee = entry.employee
            if not employee or not employee.pf_applicable:
                continue
            
            ecr_data.append({
                "uan": employee.uan or "",
                "member_name": employee.full_name,
                "gross_wages": float(entry.basic_for_pf or 0),
                "epf_wages": float(entry.basic_for_pf or 0),
                "eps_wages": float(min(entry.basic_for_pf or Decimal("0"), self.PF_WAGE_CEILING)),
                "edli_wages": float(min(entry.basic_for_pf or Decimal("0"), self.PF_WAGE_CEILING)),
                "epf_contribution_employee": float(entry.pf_employee or 0),
                "eps_contribution_employer": float(entry.eps_employer or 0),
                "epf_contribution_employer": float((entry.pf_employer or Decimal("0")) - (entry.eps_employer or Decimal("0"))),
                "ncp_days": entry.days_absent or 0,
                "refund_of_advances": 0,
            })
        
        return ecr_data
