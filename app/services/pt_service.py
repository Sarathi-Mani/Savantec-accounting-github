"""
Professional Tax (PT) Service - State-wise PT calculation for India.

Professional Tax is a state-levied tax on income from profession, trade, 
or employment. Each state has its own slabs and rules.

Key characteristics:
- Maximum PT cannot exceed Rs. 2,500 per year as per Article 276
- Some states have monthly deduction, others have fixed annual amounts
- Some states have special rates for February (to reach annual limit)
- Some states don't levy PT (e.g., Delhi, Rajasthan, UP)
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple
from datetime import date
from sqlalchemy.orm import Session

from app.database.payroll_models import Employee, PayrollSettings, ProfessionalTaxSlab


@dataclass
class PTCalculationResult:
    """Result of Professional Tax calculation."""
    pt_amount: Decimal
    is_applicable: bool
    reason: str
    state_code: str
    state_name: str
    is_february_rate: bool  # Some states have different February rates


# Default PT slabs by state (as of 2024)
# Format: {state_code: [(max_salary, pt_amount), ...]}
# Salary up to max_salary -> deduct pt_amount
DEFAULT_PT_SLABS: Dict[str, List[Tuple[Decimal, Decimal, Optional[Decimal]]]] = {
    # Karnataka - Monthly PT
    "KA": [
        (Decimal("15000"), Decimal("0"), None),
        (Decimal("inf"), Decimal("200"), None),  # Rs. 200/month
    ],
    
    # Maharashtra - Monthly PT with February special
    "MH": [
        (Decimal("7500"), Decimal("0"), None),
        (Decimal("10000"), Decimal("175"), None),
        (Decimal("inf"), Decimal("200"), Decimal("300")),  # Rs. 200/month, Rs. 300 in Feb
    ],
    
    # Tamil Nadu - Half-yearly PT
    "TN": [
        (Decimal("21000"), Decimal("0"), None),
        (Decimal("30000"), Decimal("135"), None),  # Rs. 135 per half year (equivalent monthly)
        (Decimal("45000"), Decimal("315"), None),
        (Decimal("60000"), Decimal("690"), None),
        (Decimal("75000"), Decimal("1025"), None),
        (Decimal("inf"), Decimal("1250"), None),  # This is semi-annual
    ],
    
    # Gujarat - Monthly PT
    "GJ": [
        (Decimal("12000"), Decimal("0"), None),
        (Decimal("inf"), Decimal("200"), None),
    ],
    
    # Andhra Pradesh - Monthly PT
    "AP": [
        (Decimal("15000"), Decimal("0"), None),
        (Decimal("20000"), Decimal("150"), None),
        (Decimal("inf"), Decimal("200"), None),
    ],
    
    # Telangana - Monthly PT
    "TS": [
        (Decimal("15000"), Decimal("0"), None),
        (Decimal("20000"), Decimal("150"), None),
        (Decimal("inf"), Decimal("200"), None),
    ],
    
    # West Bengal - Monthly PT
    "WB": [
        (Decimal("10000"), Decimal("0"), None),
        (Decimal("15000"), Decimal("110"), None),
        (Decimal("25000"), Decimal("130"), None),
        (Decimal("40000"), Decimal("150"), None),
        (Decimal("inf"), Decimal("200"), None),
    ],
    
    # Kerala - Half-yearly PT (converted to monthly equivalent)
    "KL": [
        (Decimal("11999"), Decimal("0"), None),
        (Decimal("17999"), Decimal("120"), None),  # Monthly equivalent
        (Decimal("29999"), Decimal("180"), None),
        (Decimal("inf"), Decimal("208"), None),  # Rs. 2500/year max
    ],
    
    # Odisha - Monthly PT
    "OD": [
        (Decimal("13304"), Decimal("0"), None),
        (Decimal("25000"), Decimal("150"), None),
        (Decimal("inf"), Decimal("200"), None),
    ],
    
    # Jharkhand - Monthly PT
    "JH": [
        (Decimal("25000"), Decimal("0"), None),
        (Decimal("41666"), Decimal("100"), None),
        (Decimal("66666"), Decimal("150"), None),
        (Decimal("83333"), Decimal("175"), None),
        (Decimal("inf"), Decimal("208"), None),
    ],
    
    # Bihar - Monthly PT
    "BR": [
        (Decimal("25000"), Decimal("0"), None),
        (Decimal("50000"), Decimal("83"), None),  # Rs. 1000/year
        (Decimal("75000"), Decimal("167"), None),  # Rs. 2000/year
        (Decimal("inf"), Decimal("208"), None),  # Rs. 2500/year
    ],
    
    # Assam - Monthly PT
    "AS": [
        (Decimal("10000"), Decimal("0"), None),
        (Decimal("15000"), Decimal("150"), None),
        (Decimal("25000"), Decimal("180"), None),
        (Decimal("inf"), Decimal("208"), None),
    ],
    
    # Madhya Pradesh - Monthly PT
    "MP": [
        (Decimal("18750"), Decimal("0"), None),
        (Decimal("25000"), Decimal("125"), None),  # Rs. 1500/year
        (Decimal("inf"), Decimal("208"), None),  # Rs. 2500/year
    ],
    
    # Chhattisgarh - Monthly PT
    "CG": [
        (Decimal("13000"), Decimal("0"), None),
        (Decimal("20000"), Decimal("175"), None),
        (Decimal("inf"), Decimal("208"), None),
    ],
    
    # Meghalaya - Monthly PT
    "ML": [
        (Decimal("50000"), Decimal("0"), None),
        (Decimal("75000"), Decimal("200"), None),
        (Decimal("inf"), Decimal("250"), None),  # Check - may exceed max
    ],
    
    # Tripura - Monthly PT
    "TR": [
        (Decimal("7500"), Decimal("0"), None),
        (Decimal("15000"), Decimal("80"), None),
        (Decimal("inf"), Decimal("150"), None),
    ],
    
    # Manipur - Monthly PT
    "MN": [
        (Decimal("42000"), Decimal("0"), None),
        (Decimal("58500"), Decimal("180"), None),
        (Decimal("75000"), Decimal("210"), None),
        (Decimal("inf"), Decimal("250"), None),
    ],
    
    # Sikkim - Monthly PT
    "SK": [
        (Decimal("20000"), Decimal("0"), None),
        (Decimal("30000"), Decimal("125"), None),
        (Decimal("40000"), Decimal("150"), None),
        (Decimal("inf"), Decimal("200"), None),
    ],
    
    # Punjab - Monthly PT
    "PB": [
        (Decimal("18000"), Decimal("0"), None),
        (Decimal("30000"), Decimal("125"), None),
        (Decimal("45000"), Decimal("175"), None),
        (Decimal("inf"), Decimal("200"), None),
    ],
}

# States that don't have PT
NO_PT_STATES = ["DL", "RJ", "UP", "HR", "HP", "UK", "JK", "GA", "AN", "AR", "CH", "DD", "DN", "LD", "LA", "MZ", "NL", "PY", "TN"]


STATE_NAMES = {
    "AP": "Andhra Pradesh",
    "AR": "Arunachal Pradesh",
    "AS": "Assam",
    "BR": "Bihar",
    "CG": "Chhattisgarh",
    "GA": "Goa",
    "GJ": "Gujarat",
    "HR": "Haryana",
    "HP": "Himachal Pradesh",
    "JH": "Jharkhand",
    "KA": "Karnataka",
    "KL": "Kerala",
    "MP": "Madhya Pradesh",
    "MH": "Maharashtra",
    "MN": "Manipur",
    "ML": "Meghalaya",
    "MZ": "Mizoram",
    "NL": "Nagaland",
    "OD": "Odisha",
    "PB": "Punjab",
    "RJ": "Rajasthan",
    "SK": "Sikkim",
    "TN": "Tamil Nadu",
    "TS": "Telangana",
    "TR": "Tripura",
    "UP": "Uttar Pradesh",
    "UK": "Uttarakhand",
    "WB": "West Bengal",
    "AN": "Andaman & Nicobar",
    "CH": "Chandigarh",
    "DD": "Daman & Diu",
    "DL": "Delhi",
    "JK": "Jammu & Kashmir",
    "LA": "Ladakh",
    "LD": "Lakshadweep",
    "PY": "Puducherry",
}


class PTService:
    """Service for Professional Tax calculations."""
    
    MAX_ANNUAL_PT = Decimal("2500")  # Constitutional limit
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to nearest rupee."""
        return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    
    def get_state_name(self, state_code: str) -> str:
        """Get full state name from code."""
        return STATE_NAMES.get(state_code, state_code)
    
    def get_pt_slabs_for_state(
        self,
        company_id: str,
        state_code: str,
    ) -> List[Tuple[Decimal, Decimal, Optional[Decimal]]]:
        """
        Get PT slabs for a state, checking custom slabs first.
        
        Returns list of (max_salary, pt_amount, february_amount) tuples.
        """
        # Check for custom slabs in database
        custom_slabs = self.db.query(ProfessionalTaxSlab).filter(
            ProfessionalTaxSlab.company_id == company_id,
            ProfessionalTaxSlab.state_code == state_code,
            ProfessionalTaxSlab.is_active == True,
        ).order_by(ProfessionalTaxSlab.from_amount).all()
        
        if custom_slabs:
            return [
                (
                    slab.to_amount or Decimal("inf"),
                    slab.tax_amount,
                    slab.february_tax_amount if slab.is_february_special else None
                )
                for slab in custom_slabs
            ]
        
        # Return default slabs
        return DEFAULT_PT_SLABS.get(state_code, [])
    
    def calculate_pt(
        self,
        gross_salary: Decimal,
        state_code: str,
        company_id: Optional[str] = None,
        month: int = 1,
        employee: Optional[Employee] = None,
    ) -> PTCalculationResult:
        """
        Calculate Professional Tax for an employee.
        
        Args:
            gross_salary: Monthly gross salary
            state_code: 2-letter state code (KA, MH, etc.)
            company_id: Company ID for custom slabs
            month: Month number (1-12), needed for February special rates
            employee: Employee model for checking flags
        
        Returns:
            PTCalculationResult with tax details
        """
        state_code = state_code.upper()
        state_name = self.get_state_name(state_code)
        
        # Check employee-level flag
        if employee and not employee.pt_applicable:
            return PTCalculationResult(
                pt_amount=Decimal("0"),
                is_applicable=False,
                reason="PT disabled for employee",
                state_code=state_code,
                state_name=state_name,
                is_february_rate=False,
            )
        
        # Check if state has PT
        if state_code in NO_PT_STATES:
            return PTCalculationResult(
                pt_amount=Decimal("0"),
                is_applicable=False,
                reason=f"No Professional Tax in {state_name}",
                state_code=state_code,
                state_name=state_name,
                is_february_rate=False,
            )
        
        # Get slabs
        slabs = self.get_pt_slabs_for_state(company_id, state_code) if company_id else DEFAULT_PT_SLABS.get(state_code, [])
        
        if not slabs:
            return PTCalculationResult(
                pt_amount=Decimal("0"),
                is_applicable=False,
                reason=f"No PT slabs configured for {state_name}",
                state_code=state_code,
                state_name=state_name,
                is_february_rate=False,
            )
        
        # Find applicable slab
        is_february = month == 2
        pt_amount = Decimal("0")
        is_february_rate = False
        
        for max_salary, regular_amount, february_amount in slabs:
            if gross_salary <= max_salary:
                if is_february and february_amount is not None:
                    pt_amount = february_amount
                    is_february_rate = True
                else:
                    pt_amount = regular_amount
                break
        
        pt_amount = self._round_amount(pt_amount)
        
        return PTCalculationResult(
            pt_amount=pt_amount,
            is_applicable=pt_amount > 0,
            reason=f"PT calculated for {state_name}",
            state_code=state_code,
            state_name=state_name,
            is_february_rate=is_february_rate,
        )
    
    def calculate_pt_for_employee(
        self,
        employee: Employee,
        gross_salary: Decimal,
        month: int,
    ) -> PTCalculationResult:
        """
        Calculate PT for an employee based on their work location.
        
        Args:
            employee: Employee model instance
            gross_salary: Monthly gross salary
            month: Month number (1-12)
        
        Returns:
            PTCalculationResult
        """
        # Get state from employee's work location
        state_code = self._get_employee_pt_state(employee)
        
        if not state_code:
            return PTCalculationResult(
                pt_amount=Decimal("0"),
                is_applicable=False,
                reason="No work state configured for employee",
                state_code="",
                state_name="Unknown",
                is_february_rate=False,
            )
        
        return self.calculate_pt(
            gross_salary=gross_salary,
            state_code=state_code,
            company_id=employee.company_id,
            month=month,
            employee=employee,
        )
    
    def _get_employee_pt_state(self, employee: Employee) -> Optional[str]:
        """
        Determine the PT state for an employee.
        
        Priority:
        1. Employee's work_state
        2. Employee's current_state
        3. Company's state (fallback)
        """
        if employee.work_state:
            return self._normalize_state_code(employee.work_state)
        
        if employee.current_state:
            return self._normalize_state_code(employee.current_state)
        
        return None
    
    def _normalize_state_code(self, state: str) -> str:
        """Convert state name to code if needed."""
        state = state.strip().upper()
        
        # If already a 2-letter code
        if len(state) == 2 and state in STATE_NAMES:
            return state
        
        # Try to find code from name
        for code, name in STATE_NAMES.items():
            if name.upper() == state:
                return code
        
        return state[:2]  # Return first 2 chars as fallback
    
    def get_pt_summary_for_month(
        self,
        company_id: str,
        month: int,
        year: int,
    ) -> dict:
        """
        Get PT summary for a company for a specific month.
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
                "total_pt": Decimal("0"),
                "by_state": {},
            }
        
        entries = self.db.query(PayrollEntry).filter(
            PayrollEntry.payroll_run_id == payroll_run.id,
            PayrollEntry.professional_tax > 0,
        ).all()
        
        total_pt = sum(e.professional_tax or Decimal("0") for e in entries)
        
        # Group by state
        by_state = {}
        for entry in entries:
            employee = entry.employee
            state = self._get_employee_pt_state(employee) if employee else "UNKNOWN"
            
            if state not in by_state:
                by_state[state] = {
                    "state_name": self.get_state_name(state),
                    "employee_count": 0,
                    "total_pt": Decimal("0"),
                }
            
            by_state[state]["employee_count"] += 1
            by_state[state]["total_pt"] += entry.professional_tax or Decimal("0")
        
        return {
            "month": month,
            "year": year,
            "total_employees": len(entries),
            "total_pt": total_pt,
            "by_state": by_state,
        }
    
    def get_annual_pt_for_employee(
        self,
        employee_id: str,
        financial_year: str,  # e.g., "2024-2025"
    ) -> Decimal:
        """
        Get total PT deducted for an employee in a financial year.
        Useful for annual statements and checking against max limit.
        """
        from app.database.payroll_models import PayrollRun, PayrollEntry
        
        # Parse financial year
        start_year = int(financial_year.split("-")[0])
        
        # FY is April to March
        entries = self.db.query(PayrollEntry).join(PayrollRun).filter(
            PayrollEntry.employee_id == employee_id,
            (
                (PayrollRun.pay_period_year == start_year) & (PayrollRun.pay_period_month >= 4) |
                (PayrollRun.pay_period_year == start_year + 1) & (PayrollRun.pay_period_month <= 3)
            )
        ).all()
        
        return sum(e.professional_tax or Decimal("0") for e in entries)
    
    def seed_default_pt_slabs(self, company_id: str) -> int:
        """
        Seed default PT slabs for a company.
        
        Returns number of slabs created.
        """
        count = 0
        
        for state_code, slabs in DEFAULT_PT_SLABS.items():
            from_amount = Decimal("0")
            
            for max_salary, pt_amount, feb_amount in slabs:
                slab = ProfessionalTaxSlab(
                    company_id=company_id,
                    state_code=state_code,
                    state_name=self.get_state_name(state_code),
                    from_amount=from_amount,
                    to_amount=max_salary if max_salary != Decimal("inf") else None,
                    tax_amount=pt_amount,
                    is_february_special=feb_amount is not None,
                    february_tax_amount=feb_amount,
                    is_active=True,
                )
                self.db.add(slab)
                from_amount = max_salary + Decimal("1") if max_salary != Decimal("inf") else None
                count += 1
        
        self.db.commit()
        return count
