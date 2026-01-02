"""
Employee Loan Service - Manage employee loans, advances, and EMI deductions.

Features:
- Create different types of loans (salary advance, personal, emergency, festival)
- Calculate EMI with interest (reducing balance method)
- Track repayments through payroll deductions
- Generate loan statements
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.payroll_models import (
    Employee, EmployeeLoan, LoanRepayment, LoanStatus, LoanType
)


@dataclass
class EMICalculationResult:
    """Result of EMI calculation."""
    emi_amount: Decimal
    total_interest: Decimal
    total_repayable: Decimal
    amortization_schedule: List[Dict]


@dataclass
class LoanEligibilityResult:
    """Result of loan eligibility check."""
    is_eligible: bool
    max_amount: Decimal
    max_tenure_months: int
    reason: str
    existing_loans_count: int
    existing_loans_outstanding: Decimal


class LoanService:
    """Service for managing employee loans and advances."""
    
    # Loan policies (configurable per company)
    DEFAULT_POLICIES = {
        LoanType.SALARY_ADVANCE: {
            "max_months_salary": 2,
            "max_amount": Decimal("200000"),
            "interest_rate": Decimal("0"),  # Usually interest-free
            "max_tenure_months": 6,
            "min_service_months": 3,
        },
        LoanType.PERSONAL_LOAN: {
            "max_months_salary": 12,
            "max_amount": Decimal("1000000"),
            "interest_rate": Decimal("8"),  # 8% per annum
            "max_tenure_months": 60,
            "min_service_months": 12,
        },
        LoanType.EMERGENCY_LOAN: {
            "max_months_salary": 3,
            "max_amount": Decimal("300000"),
            "interest_rate": Decimal("4"),  # Subsidized
            "max_tenure_months": 24,
            "min_service_months": 6,
        },
        LoanType.FESTIVAL_ADVANCE: {
            "max_months_salary": 1,
            "max_amount": Decimal("50000"),
            "interest_rate": Decimal("0"),
            "max_tenure_months": 10,
            "min_service_months": 6,
        },
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def _round_emi(self, amount: Decimal) -> Decimal:
        """Round EMI to nearest rupee."""
        return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    
    def calculate_emi(
        self,
        principal: Decimal,
        annual_interest_rate: Decimal,
        tenure_months: int,
    ) -> EMICalculationResult:
        """
        Calculate EMI using reducing balance method.
        
        EMI Formula: P * r * (1+r)^n / ((1+r)^n - 1)
        Where:
            P = Principal
            r = Monthly interest rate
            n = Number of months
        
        Args:
            principal: Loan principal amount
            annual_interest_rate: Annual interest rate (e.g., 8 for 8%)
            tenure_months: Loan tenure in months
        
        Returns:
            EMICalculationResult with EMI amount and amortization schedule
        """
        if tenure_months <= 0:
            return EMICalculationResult(
                emi_amount=principal,
                total_interest=Decimal("0"),
                total_repayable=principal,
                amortization_schedule=[],
            )
        
        # Interest-free loan
        if annual_interest_rate == 0:
            emi = self._round_emi(principal / tenure_months)
            schedule = []
            remaining = principal
            
            for month in range(1, tenure_months + 1):
                payment = emi if month < tenure_months else remaining
                remaining -= payment
                schedule.append({
                    "emi_number": month,
                    "principal": float(payment),
                    "interest": 0,
                    "emi": float(payment),
                    "balance": float(max(remaining, Decimal("0"))),
                })
            
            return EMICalculationResult(
                emi_amount=emi,
                total_interest=Decimal("0"),
                total_repayable=principal,
                amortization_schedule=schedule,
            )
        
        # Calculate monthly interest rate
        monthly_rate = annual_interest_rate / Decimal("1200")  # Divide by 100 and 12
        
        # Calculate EMI using formula
        power = (1 + monthly_rate) ** tenure_months
        emi = principal * monthly_rate * power / (power - 1)
        emi = self._round_emi(emi)
        
        # Generate amortization schedule
        schedule = []
        remaining_principal = principal
        total_interest = Decimal("0")
        
        for month in range(1, tenure_months + 1):
            interest = self._round_amount(remaining_principal * monthly_rate)
            principal_component = emi - interest
            
            # Adjust last EMI
            if month == tenure_months:
                principal_component = remaining_principal
                interest = emi - principal_component
                if interest < 0:
                    interest = Decimal("0")
                    principal_component = remaining_principal
            
            remaining_principal -= principal_component
            total_interest += interest
            
            schedule.append({
                "emi_number": month,
                "principal": float(principal_component),
                "interest": float(interest),
                "emi": float(principal_component + interest),
                "balance": float(max(remaining_principal, Decimal("0"))),
            })
        
        total_repayable = principal + total_interest
        
        return EMICalculationResult(
            emi_amount=emi,
            total_interest=self._round_amount(total_interest),
            total_repayable=self._round_amount(total_repayable),
            amortization_schedule=schedule,
        )
    
    def check_eligibility(
        self,
        employee_id: str,
        loan_type: LoanType,
        requested_amount: Optional[Decimal] = None,
    ) -> LoanEligibilityResult:
        """
        Check if employee is eligible for a loan.
        
        Checks:
        1. Minimum service period
        2. Existing active loans
        3. Maximum loan amount based on salary
        4. Company-specific policies
        """
        employee = self.db.query(Employee).filter(Employee.id == employee_id).first()
        
        if not employee:
            return LoanEligibilityResult(
                is_eligible=False,
                max_amount=Decimal("0"),
                max_tenure_months=0,
                reason="Employee not found",
                existing_loans_count=0,
                existing_loans_outstanding=Decimal("0"),
            )
        
        if employee.status.value != "active":
            return LoanEligibilityResult(
                is_eligible=False,
                max_amount=Decimal("0"),
                max_tenure_months=0,
                reason="Employee is not active",
                existing_loans_count=0,
                existing_loans_outstanding=Decimal("0"),
            )
        
        # Get policy for loan type
        policy = self.DEFAULT_POLICIES.get(loan_type, self.DEFAULT_POLICIES[LoanType.PERSONAL_LOAN])
        
        # Check service period
        if employee.date_of_joining:
            service_months = self._calculate_service_months(employee.date_of_joining)
            if service_months < policy["min_service_months"]:
                return LoanEligibilityResult(
                    is_eligible=False,
                    max_amount=Decimal("0"),
                    max_tenure_months=0,
                    reason=f"Minimum {policy['min_service_months']} months of service required. Current: {service_months} months",
                    existing_loans_count=0,
                    existing_loans_outstanding=Decimal("0"),
                )
        
        # Check existing loans
        existing_loans = self.db.query(EmployeeLoan).filter(
            EmployeeLoan.employee_id == employee_id,
            EmployeeLoan.status.in_([LoanStatus.ACTIVE, LoanStatus.APPROVED]),
        ).all()
        
        existing_count = len(existing_loans)
        existing_outstanding = sum(loan.outstanding_balance or Decimal("0") for loan in existing_loans)
        
        # Check if employee already has too many loans
        if existing_count >= 3:  # Max 3 active loans
            return LoanEligibilityResult(
                is_eligible=False,
                max_amount=Decimal("0"),
                max_tenure_months=0,
                reason="Maximum number of active loans reached (3)",
                existing_loans_count=existing_count,
                existing_loans_outstanding=existing_outstanding,
            )
        
        # Calculate max loan amount based on salary
        monthly_salary = employee.ctc / 12 if employee.ctc else Decimal("0")
        max_based_on_salary = monthly_salary * policy["max_months_salary"]
        max_amount = min(max_based_on_salary, policy["max_amount"])
        
        # Reduce by existing outstanding
        available_amount = max(max_amount - existing_outstanding, Decimal("0"))
        
        if available_amount <= 0:
            return LoanEligibilityResult(
                is_eligible=False,
                max_amount=Decimal("0"),
                max_tenure_months=0,
                reason="No available loan limit. Existing loans exhaust the limit.",
                existing_loans_count=existing_count,
                existing_loans_outstanding=existing_outstanding,
            )
        
        # Check if requested amount is within limit
        if requested_amount and requested_amount > available_amount:
            return LoanEligibilityResult(
                is_eligible=False,
                max_amount=available_amount,
                max_tenure_months=policy["max_tenure_months"],
                reason=f"Requested amount exceeds available limit. Max available: Rs. {available_amount}",
                existing_loans_count=existing_count,
                existing_loans_outstanding=existing_outstanding,
            )
        
        return LoanEligibilityResult(
            is_eligible=True,
            max_amount=available_amount,
            max_tenure_months=policy["max_tenure_months"],
            reason="Eligible for loan",
            existing_loans_count=existing_count,
            existing_loans_outstanding=existing_outstanding,
        )
    
    def _calculate_service_months(self, joining_date: date) -> int:
        """Calculate months of service from joining date."""
        today = date.today()
        delta = relativedelta(today, joining_date)
        return delta.years * 12 + delta.months
    
    def create_loan(
        self,
        company_id: str,
        employee_id: str,
        loan_type: LoanType,
        principal_amount: Decimal,
        tenure_months: int,
        interest_rate: Optional[Decimal] = None,
        disbursement_date: Optional[date] = None,
        first_emi_date: Optional[date] = None,
        reason: str = "",
    ) -> EmployeeLoan:
        """
        Create a new employee loan.
        
        Args:
            company_id: Company ID
            employee_id: Employee ID
            loan_type: Type of loan
            principal_amount: Loan amount
            tenure_months: Repayment tenure in months
            interest_rate: Annual interest rate (optional, uses default)
            disbursement_date: Date of disbursement (default: today)
            first_emi_date: Date of first EMI (default: next month)
            reason: Reason for loan
        
        Returns:
            Created EmployeeLoan instance
        """
        # Check eligibility
        eligibility = self.check_eligibility(employee_id, loan_type, principal_amount)
        if not eligibility.is_eligible:
            raise ValueError(eligibility.reason)
        
        # Get interest rate from policy if not provided
        if interest_rate is None:
            policy = self.DEFAULT_POLICIES.get(loan_type, self.DEFAULT_POLICIES[LoanType.PERSONAL_LOAN])
            interest_rate = policy["interest_rate"]
        
        # Set dates
        if not disbursement_date:
            disbursement_date = date.today()
        
        if not first_emi_date:
            # First EMI from next month
            first_emi_date = (disbursement_date + relativedelta(months=1)).replace(day=1)
        
        # Calculate EMI
        emi_result = self.calculate_emi(principal_amount, interest_rate, tenure_months)
        
        # Generate loan number
        loan_number = self._generate_loan_number(company_id, loan_type)
        
        # Create loan
        loan = EmployeeLoan(
            company_id=company_id,
            employee_id=employee_id,
            loan_number=loan_number,
            loan_type=loan_type,
            principal_amount=principal_amount,
            interest_rate=interest_rate,
            tenure_months=tenure_months,
            emi_amount=emi_result.emi_amount,
            disbursement_date=disbursement_date,
            first_emi_date=first_emi_date,
            total_interest=emi_result.total_interest,
            total_repayable=emi_result.total_repayable,
            amount_repaid=Decimal("0"),
            outstanding_balance=emi_result.total_repayable,
            emis_paid=0,
            emis_pending=tenure_months,
            next_emi_date=first_emi_date,
            status=LoanStatus.PENDING_APPROVAL,
            reason=reason,
        )
        
        self.db.add(loan)
        self.db.commit()
        self.db.refresh(loan)
        
        return loan
    
    def _generate_loan_number(self, company_id: str, loan_type: LoanType) -> str:
        """Generate unique loan number."""
        prefix_map = {
            LoanType.SALARY_ADVANCE: "SA",
            LoanType.PERSONAL_LOAN: "PL",
            LoanType.EMERGENCY_LOAN: "EL",
            LoanType.FESTIVAL_ADVANCE: "FA",
            LoanType.OTHER: "OT",
        }
        
        prefix = prefix_map.get(loan_type, "LN")
        
        count = self.db.query(EmployeeLoan).filter(
            EmployeeLoan.company_id == company_id,
        ).count()
        
        year = date.today().year
        return f"{prefix}/{year}/{count + 1:04d}"
    
    def approve_loan(
        self,
        loan_id: str,
        approved_by: str,
        disbursement_date: Optional[date] = None,
    ) -> EmployeeLoan:
        """Approve a loan and optionally update disbursement date."""
        loan = self.db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        
        if not loan:
            raise ValueError("Loan not found")
        
        if loan.status != LoanStatus.PENDING_APPROVAL:
            raise ValueError(f"Loan cannot be approved. Current status: {loan.status}")
        
        loan.status = LoanStatus.APPROVED
        loan.approved_by = approved_by
        loan.approved_date = date.today()
        
        if disbursement_date:
            loan.disbursement_date = disbursement_date
            # Update first EMI date
            loan.first_emi_date = (disbursement_date + relativedelta(months=1)).replace(day=1)
            loan.next_emi_date = loan.first_emi_date
        
        self.db.commit()
        self.db.refresh(loan)
        
        return loan
    
    def disburse_loan(self, loan_id: str) -> EmployeeLoan:
        """Mark loan as disbursed and set to active."""
        loan = self.db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        
        if not loan:
            raise ValueError("Loan not found")
        
        if loan.status not in [LoanStatus.APPROVED, LoanStatus.PENDING_APPROVAL]:
            raise ValueError(f"Loan cannot be disbursed. Current status: {loan.status}")
        
        loan.status = LoanStatus.ACTIVE
        
        if not loan.disbursement_date:
            loan.disbursement_date = date.today()
        
        self.db.commit()
        self.db.refresh(loan)
        
        return loan
    
    def record_repayment(
        self,
        loan_id: str,
        amount: Decimal,
        repayment_date: Optional[date] = None,
        payroll_entry_id: Optional[str] = None,
        payment_mode: str = "payroll_deduction",
    ) -> LoanRepayment:
        """
        Record a loan repayment.
        
        Args:
            loan_id: Loan ID
            amount: Repayment amount
            repayment_date: Date of repayment
            payroll_entry_id: Link to payroll entry if deducted from salary
            payment_mode: How payment was made
        
        Returns:
            Created LoanRepayment instance
        """
        loan = self.db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        
        if not loan:
            raise ValueError("Loan not found")
        
        if loan.status != LoanStatus.ACTIVE:
            raise ValueError(f"Cannot record repayment. Loan status: {loan.status}")
        
        if not repayment_date:
            repayment_date = date.today()
        
        # Calculate principal and interest components
        # Using reducing balance method
        monthly_rate = loan.interest_rate / Decimal("1200") if loan.interest_rate else Decimal("0")
        interest_component = self._round_amount(loan.outstanding_balance * monthly_rate)
        principal_component = amount - interest_component
        
        # Ensure principal doesn't go negative
        if principal_component < 0:
            principal_component = Decimal("0")
            interest_component = amount
        
        # Create repayment record
        emi_number = loan.emis_paid + 1
        new_balance = max(loan.outstanding_balance - amount, Decimal("0"))
        
        repayment = LoanRepayment(
            loan_id=loan_id,
            payroll_entry_id=payroll_entry_id,
            repayment_date=repayment_date,
            emi_number=emi_number,
            principal_component=principal_component,
            interest_component=interest_component,
            total_amount=amount,
            balance_after=new_balance,
            is_paid=True,
            payment_mode=payment_mode,
        )
        
        self.db.add(repayment)
        
        # Update loan
        loan.amount_repaid += amount
        loan.outstanding_balance = new_balance
        loan.emis_paid = emi_number
        loan.emis_pending = max(loan.tenure_months - emi_number, 0)
        
        # Update next EMI date
        if loan.next_emi_date:
            loan.next_emi_date = loan.next_emi_date + relativedelta(months=1)
        
        # Check if loan is fully repaid
        if loan.outstanding_balance <= 0:
            loan.status = LoanStatus.CLOSED
            loan.closed_date = repayment_date
        
        self.db.commit()
        self.db.refresh(repayment)
        
        return repayment
    
    def get_pending_emis_for_payroll(
        self,
        company_id: str,
        payroll_month: int,
        payroll_year: int,
    ) -> List[Dict]:
        """
        Get pending EMIs for all employees for a payroll run.
        
        Returns list of dictionaries with employee_id, loan_id, emi_amount
        """
        # Get all active loans
        active_loans = self.db.query(EmployeeLoan).filter(
            EmployeeLoan.company_id == company_id,
            EmployeeLoan.status == LoanStatus.ACTIVE,
            EmployeeLoan.outstanding_balance > 0,
        ).all()
        
        payroll_date = date(payroll_year, payroll_month, 1)
        pending_emis = []
        
        for loan in active_loans:
            # Check if EMI is due
            if loan.next_emi_date and loan.next_emi_date <= payroll_date + relativedelta(months=1):
                pending_emis.append({
                    "employee_id": loan.employee_id,
                    "loan_id": loan.id,
                    "loan_number": loan.loan_number,
                    "loan_type": loan.loan_type.value,
                    "emi_amount": float(loan.emi_amount),
                    "outstanding_balance": float(loan.outstanding_balance),
                    "emis_remaining": loan.emis_pending,
                })
        
        return pending_emis
    
    def get_loan_statement(self, loan_id: str) -> Dict:
        """Generate loan statement with all details and repayment history."""
        loan = self.db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        
        if not loan:
            return {"error": "Loan not found"}
        
        repayments = self.db.query(LoanRepayment).filter(
            LoanRepayment.loan_id == loan_id,
        ).order_by(LoanRepayment.emi_number).all()
        
        employee = loan.employee
        
        return {
            "loan": {
                "loan_number": loan.loan_number,
                "loan_type": loan.loan_type.value,
                "principal_amount": float(loan.principal_amount),
                "interest_rate": float(loan.interest_rate),
                "tenure_months": loan.tenure_months,
                "emi_amount": float(loan.emi_amount),
                "disbursement_date": loan.disbursement_date.isoformat() if loan.disbursement_date else None,
                "first_emi_date": loan.first_emi_date.isoformat() if loan.first_emi_date else None,
                "total_interest": float(loan.total_interest),
                "total_repayable": float(loan.total_repayable),
                "amount_repaid": float(loan.amount_repaid),
                "outstanding_balance": float(loan.outstanding_balance),
                "emis_paid": loan.emis_paid,
                "emis_pending": loan.emis_pending,
                "status": loan.status.value,
            },
            "employee": {
                "id": employee.id,
                "name": employee.full_name,
                "employee_code": employee.employee_code,
            } if employee else None,
            "repayments": [
                {
                    "emi_number": r.emi_number,
                    "repayment_date": r.repayment_date.isoformat() if r.repayment_date else None,
                    "principal": float(r.principal_component),
                    "interest": float(r.interest_component),
                    "total": float(r.total_amount),
                    "balance_after": float(r.balance_after),
                    "payment_mode": r.payment_mode,
                }
                for r in repayments
            ],
        }
    
    def get_employee_loans(
        self,
        employee_id: str,
        include_closed: bool = False,
    ) -> List[EmployeeLoan]:
        """Get all loans for an employee."""
        query = self.db.query(EmployeeLoan).filter(
            EmployeeLoan.employee_id == employee_id,
        )
        
        if not include_closed:
            query = query.filter(
                EmployeeLoan.status.in_([
                    LoanStatus.PENDING_APPROVAL,
                    LoanStatus.APPROVED,
                    LoanStatus.ACTIVE,
                ])
            )
        
        return query.order_by(EmployeeLoan.created_at.desc()).all()
    
    def close_loan(
        self,
        loan_id: str,
        reason: str = "Manual closure",
    ) -> EmployeeLoan:
        """Close a loan (for prepayment or cancellation)."""
        loan = self.db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        
        if not loan:
            raise ValueError("Loan not found")
        
        loan.status = LoanStatus.CLOSED
        loan.closed_date = date.today()
        loan.notes = f"{loan.notes or ''}\nClosed: {reason}".strip()
        
        self.db.commit()
        self.db.refresh(loan)
        
        return loan
