"""
Payroll Service - Main orchestration service for payroll processing.

This service brings together:
- PF calculations
- ESI calculations
- Professional Tax
- TDS on Salary
- Loan deductions
- Salary structure processing
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import Company
from app.database.payroll_models import (
    Employee, Department, Designation, SalaryComponent,
    EmployeeSalaryStructure, PayrollRun, PayrollEntry,
    PayrollSettings, PayrollRunStatus, SalaryComponentType,
    ComponentCalculationType, EmployeeStatus
)
from app.services.pf_service import PFService
from app.services.esi_service import ESIService
from app.services.pt_service import PTService
from app.services.salary_tds_service import SalaryTDSService
from app.services.loan_service import LoanService


@dataclass
class SalaryBreakdown:
    """Complete salary breakdown for an employee."""
    employee_id: str
    employee_name: str
    earnings: Dict[str, Decimal]
    deductions: Dict[str, Decimal]
    employer_contributions: Dict[str, Decimal]
    gross_salary: Decimal
    total_deductions: Decimal
    net_pay: Decimal
    ctc_monthly: Decimal


class PayrollService:
    """Main payroll processing service."""
    
    def __init__(self, db: Session):
        self.db = db
        self.pf_service = PFService(db)
        self.esi_service = ESIService(db)
        self.pt_service = PTService(db)
        self.tds_service = SalaryTDSService(db)
        self.loan_service = LoanService(db)
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ==================== SALARY COMPONENT MANAGEMENT ====================
    
    def create_default_salary_components(self, company_id: str) -> List[SalaryComponent]:
        """Create default salary components for a company."""
        default_components = [
            # Earnings
            {
                "code": "BASIC",
                "name": "Basic Salary",
                "component_type": SalaryComponentType.EARNING,
                "calculation_type": ComponentCalculationType.PERCENTAGE_OF_CTC,
                "percentage": Decimal("40"),
                "is_taxable": True,
                "is_part_of_ctc": True,
                "is_part_of_gross": True,
                "include_in_pf_wages": True,
                "include_in_esi_wages": True,
                "display_order": 1,
            },
            {
                "code": "HRA",
                "name": "House Rent Allowance",
                "component_type": SalaryComponentType.EARNING,
                "calculation_type": ComponentCalculationType.PERCENTAGE_OF_BASIC,
                "percentage": Decimal("50"),
                "is_taxable": True,  # Subject to exemption
                "is_part_of_ctc": True,
                "is_part_of_gross": True,
                "include_in_pf_wages": False,
                "include_in_esi_wages": True,
                "display_order": 2,
            },
            {
                "code": "CONV",
                "name": "Conveyance Allowance",
                "component_type": SalaryComponentType.EARNING,
                "calculation_type": ComponentCalculationType.FIXED,
                "max_amount": Decimal("1600"),  # Tax-free limit
                "is_taxable": True,
                "is_part_of_ctc": True,
                "is_part_of_gross": True,
                "include_in_pf_wages": False,
                "include_in_esi_wages": True,
                "display_order": 3,
            },
            {
                "code": "MED",
                "name": "Medical Allowance",
                "component_type": SalaryComponentType.EARNING,
                "calculation_type": ComponentCalculationType.FIXED,
                "is_taxable": True,
                "is_part_of_ctc": True,
                "is_part_of_gross": True,
                "include_in_pf_wages": False,
                "include_in_esi_wages": True,
                "display_order": 4,
            },
            {
                "code": "SPECIAL",
                "name": "Special Allowance",
                "component_type": SalaryComponentType.EARNING,
                "calculation_type": ComponentCalculationType.FIXED,
                "is_taxable": True,
                "is_part_of_ctc": True,
                "is_part_of_gross": True,
                "include_in_pf_wages": False,
                "include_in_esi_wages": True,
                "display_order": 5,
            },
            # Deductions
            {
                "code": "PF_EMP",
                "name": "Provident Fund (Employee)",
                "component_type": SalaryComponentType.DEDUCTION,
                "calculation_type": ComponentCalculationType.PERCENTAGE_OF_BASIC,
                "percentage": Decimal("12"),
                "is_taxable": False,
                "is_statutory": True,
                "statutory_type": "pf",
                "is_part_of_ctc": False,
                "display_order": 1,
            },
            {
                "code": "ESI_EMP",
                "name": "ESI (Employee)",
                "component_type": SalaryComponentType.DEDUCTION,
                "calculation_type": ComponentCalculationType.PERCENTAGE_OF_GROSS,
                "percentage": Decimal("0.75"),
                "is_taxable": False,
                "is_statutory": True,
                "statutory_type": "esi",
                "is_part_of_ctc": False,
                "display_order": 2,
            },
            {
                "code": "PT",
                "name": "Professional Tax",
                "component_type": SalaryComponentType.DEDUCTION,
                "calculation_type": ComponentCalculationType.FIXED,
                "is_taxable": False,
                "is_statutory": True,
                "statutory_type": "pt",
                "is_part_of_ctc": False,
                "display_order": 3,
            },
            {
                "code": "TDS",
                "name": "TDS on Salary",
                "component_type": SalaryComponentType.DEDUCTION,
                "calculation_type": ComponentCalculationType.FIXED,
                "is_taxable": False,
                "is_statutory": True,
                "statutory_type": "tds",
                "is_part_of_ctc": False,
                "display_order": 4,
            },
            # Employer Contributions
            {
                "code": "PF_ER",
                "name": "Provident Fund (Employer)",
                "component_type": SalaryComponentType.EMPLOYER_CONTRIBUTION,
                "calculation_type": ComponentCalculationType.PERCENTAGE_OF_BASIC,
                "percentage": Decimal("12"),
                "is_taxable": False,
                "is_statutory": True,
                "statutory_type": "pf",
                "is_part_of_ctc": True,
                "display_order": 1,
            },
            {
                "code": "ESI_ER",
                "name": "ESI (Employer)",
                "component_type": SalaryComponentType.EMPLOYER_CONTRIBUTION,
                "calculation_type": ComponentCalculationType.PERCENTAGE_OF_GROSS,
                "percentage": Decimal("3.25"),
                "is_taxable": False,
                "is_statutory": True,
                "statutory_type": "esi",
                "is_part_of_ctc": True,
                "display_order": 2,
            },
        ]
        
        created = []
        for comp_data in default_components:
            existing = self.db.query(SalaryComponent).filter(
                SalaryComponent.company_id == company_id,
                SalaryComponent.code == comp_data["code"],
            ).first()
            
            if not existing:
                component = SalaryComponent(company_id=company_id, **comp_data)
                self.db.add(component)
                created.append(component)
        
        self.db.commit()
        return created
    
    def get_salary_components(
        self,
        company_id: str,
        component_type: Optional[SalaryComponentType] = None,
    ) -> List[SalaryComponent]:
        """Get salary components for a company."""
        query = self.db.query(SalaryComponent).filter(
            SalaryComponent.company_id == company_id,
            SalaryComponent.is_active == True,
        )
        
        if component_type:
            query = query.filter(SalaryComponent.component_type == component_type)
        
        return query.order_by(SalaryComponent.display_order).all()
    
    # ==================== EMPLOYEE SALARY STRUCTURE ====================
    
    def create_employee_salary_structure(
        self,
        employee_id: str,
        ctc: Decimal,
        effective_from: date,
        custom_components: Optional[Dict[str, Decimal]] = None,
    ) -> List[EmployeeSalaryStructure]:
        """
        Create salary structure for an employee based on CTC.
        
        If custom_components provided, uses those amounts.
        Otherwise, calculates based on default percentages.
        """
        employee = self.db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise ValueError("Employee not found")
        
        # Update employee CTC
        employee.ctc = ctc
        
        # Get company's salary components
        components = self.get_salary_components(employee.company_id)
        
        # Deactivate existing structure
        self.db.query(EmployeeSalaryStructure).filter(
            EmployeeSalaryStructure.employee_id == employee_id,
            EmployeeSalaryStructure.is_active == True,
        ).update({"is_active": False, "effective_to": effective_from})
        
        structures = []
        monthly_ctc = ctc / 12
        
        # Calculate basic first (needed for percentage calculations)
        basic_component = next((c for c in components if c.code == "BASIC"), None)
        basic_amount = Decimal("0")
        
        if basic_component:
            if custom_components and "BASIC" in custom_components:
                basic_amount = custom_components["BASIC"]
            elif basic_component.percentage:
                basic_amount = self._round_amount(monthly_ctc * basic_component.percentage / 100)
        
        # Create structure for each component
        for component in components:
            if component.component_type == SalaryComponentType.EMPLOYER_CONTRIBUTION:
                continue  # Employer contributions calculated separately
            
            amount = Decimal("0")
            
            if custom_components and component.code in custom_components:
                amount = custom_components[component.code]
            elif component.calculation_type == ComponentCalculationType.FIXED:
                amount = component.max_amount or Decimal("0")
            elif component.calculation_type == ComponentCalculationType.PERCENTAGE_OF_CTC:
                amount = self._round_amount(monthly_ctc * (component.percentage or Decimal("0")) / 100)
            elif component.calculation_type == ComponentCalculationType.PERCENTAGE_OF_BASIC:
                amount = self._round_amount(basic_amount * (component.percentage or Decimal("0")) / 100)
            elif component.calculation_type == ComponentCalculationType.PERCENTAGE_OF_GROSS:
                # Will be calculated during payroll
                pass
            
            if component.code == "BASIC":
                amount = basic_amount
            
            structure = EmployeeSalaryStructure(
                employee_id=employee_id,
                component_id=component.id,
                amount=amount,
                effective_from=effective_from,
                is_active=True,
            )
            self.db.add(structure)
            structures.append(structure)
        
        self.db.commit()
        return structures
    
    def get_employee_salary_structure(
        self,
        employee_id: str,
        as_of_date: Optional[date] = None,
    ) -> List[Dict]:
        """Get current salary structure for an employee."""
        if not as_of_date:
            as_of_date = date.today()
        
        structures = self.db.query(EmployeeSalaryStructure).filter(
            EmployeeSalaryStructure.employee_id == employee_id,
            EmployeeSalaryStructure.effective_from <= as_of_date,
            EmployeeSalaryStructure.is_active == True,
        ).all()
        
        result = []
        for s in structures:
            component = s.component
            result.append({
                "component_code": component.code,
                "component_name": component.name,
                "component_type": component.component_type.value,
                "amount": float(s.amount),
                "percentage": float(s.percentage) if s.percentage else None,
            })
        
        return result
    
    # ==================== PAYROLL PROCESSING ====================
    
    def create_payroll_run(
        self,
        company_id: str,
        month: int,
        year: int,
        pay_date: Optional[date] = None,
    ) -> PayrollRun:
        """Create a new payroll run for a month."""
        # Check if payroll already exists
        existing = self.db.query(PayrollRun).filter(
            PayrollRun.company_id == company_id,
            PayrollRun.pay_period_month == month,
            PayrollRun.pay_period_year == year,
        ).first()
        
        if existing and existing.status not in [PayrollRunStatus.CANCELLED]:
            raise ValueError(f"Payroll for {month}/{year} already exists with status: {existing.status}")
        
        # Count active employees
        employee_count = self.db.query(Employee).filter(
            Employee.company_id == company_id,
            Employee.status == EmployeeStatus.ACTIVE,
        ).count()
        
        payroll_run = PayrollRun(
            company_id=company_id,
            pay_period_month=month,
            pay_period_year=year,
            pay_date=pay_date or date(year, month, 28),
            status=PayrollRunStatus.DRAFT,
            total_employees=employee_count,
        )
        
        self.db.add(payroll_run)
        self.db.commit()
        self.db.refresh(payroll_run)
        
        return payroll_run
    
    def calculate_employee_salary(
        self,
        employee: Employee,
        month: int,
        year: int,
        working_days: int = 30,
        days_worked: int = 30,
        lop_days: int = 0,
    ) -> SalaryBreakdown:
        """
        Calculate complete salary for an employee for a month.
        """
        # Get salary structure
        structure = self.db.query(EmployeeSalaryStructure).filter(
            EmployeeSalaryStructure.employee_id == employee.id,
            EmployeeSalaryStructure.is_active == True,
        ).all()
        
        earnings = {}
        basic_amount = Decimal("0")
        hra_amount = Decimal("0")
        gross_salary = Decimal("0")
        
        # Calculate earnings
        for s in structure:
            component = s.component
            if component.component_type != SalaryComponentType.EARNING:
                continue
            
            amount = s.amount or Decimal("0")
            
            # Apply LOP
            if lop_days > 0 and working_days > 0:
                per_day = amount / working_days
                amount = self._round_amount(amount - (per_day * lop_days))
            
            earnings[component.code] = amount
            gross_salary += amount
            
            if component.code == "BASIC":
                basic_amount = amount
            elif component.code == "HRA":
                hra_amount = amount
        
        deductions = {}
        employer_contributions = {}
        
        # Calculate PF
        if employee.pf_applicable:
            pf_result = self.pf_service.calculate_pf(
                basic_salary=basic_amount,
                company_id=employee.company_id,
            )
            if pf_result:
                deductions["PF_EMP"] = pf_result.employee_pf
                employer_contributions["PF_ER"] = pf_result.employer_total
                employer_contributions["PF_ADMIN"] = pf_result.pf_admin_charges
                employer_contributions["EDLI"] = pf_result.edli
        
        # Calculate ESI
        if employee.esi_applicable:
            esi_result = self.esi_service.calculate_esi(
                gross_salary=gross_salary,
                company_id=employee.company_id,
                employee=employee,
            )
            if esi_result.is_applicable:
                deductions["ESI_EMP"] = esi_result.employee_esi
                employer_contributions["ESI_ER"] = esi_result.employer_esi
        
        # Calculate PT
        if employee.pt_applicable:
            pt_result = self.pt_service.calculate_pt_for_employee(
                employee=employee,
                gross_salary=gross_salary,
                month=month,
            )
            if pt_result.is_applicable:
                deductions["PT"] = pt_result.pt_amount
        
        # Calculate TDS
        # Project annual salary
        annual_gross = gross_salary * 12
        annual_basic = basic_amount * 12
        annual_hra = hra_amount * 12
        
        tds_result = self.tds_service.calculate_annual_tds(
            employee=employee,
            annual_gross_salary=annual_gross,
            annual_basic=annual_basic,
            annual_hra=annual_hra,
        )
        deductions["TDS"] = tds_result.monthly_tds
        
        # Get loan EMIs
        pending_loans = self.loan_service.get_pending_emis_for_payroll(
            company_id=employee.company_id,
            payroll_month=month,
            payroll_year=year,
        )
        
        loan_deductions = Decimal("0")
        for loan in pending_loans:
            if loan["employee_id"] == employee.id:
                loan_deductions += Decimal(str(loan["emi_amount"]))
        
        if loan_deductions > 0:
            deductions["LOAN"] = loan_deductions
        
        total_deductions = sum(deductions.values())
        net_pay = gross_salary - total_deductions
        
        # Calculate CTC
        ctc_monthly = gross_salary + sum(employer_contributions.values())
        
        return SalaryBreakdown(
            employee_id=employee.id,
            employee_name=employee.full_name or f"{employee.first_name} {employee.last_name}",
            earnings=earnings,
            deductions=deductions,
            employer_contributions=employer_contributions,
            gross_salary=gross_salary,
            total_deductions=total_deductions,
            net_pay=net_pay,
            ctc_monthly=ctc_monthly,
        )
    
    def process_payroll(
        self,
        payroll_run_id: str,
        working_days: int = 30,
    ) -> PayrollRun:
        """Process payroll for all employees."""
        payroll_run = self.db.query(PayrollRun).filter(
            PayrollRun.id == payroll_run_id
        ).first()
        
        if not payroll_run:
            raise ValueError("Payroll run not found")
        
        if payroll_run.status not in [PayrollRunStatus.DRAFT, PayrollRunStatus.PROCESSING]:
            raise ValueError(f"Cannot process payroll. Status: {payroll_run.status}")
        
        payroll_run.status = PayrollRunStatus.PROCESSING
        self.db.commit()
        
        # Get all active employees
        employees = self.db.query(Employee).filter(
            Employee.company_id == payroll_run.company_id,
            Employee.status == EmployeeStatus.ACTIVE,
        ).all()
        
        # Clear existing entries
        self.db.query(PayrollEntry).filter(
            PayrollEntry.payroll_run_id == payroll_run_id
        ).delete()
        
        totals = {
            "gross": Decimal("0"),
            "deductions": Decimal("0"),
            "net_pay": Decimal("0"),
            "employer_contributions": Decimal("0"),
            "pf_employee": Decimal("0"),
            "pf_employer": Decimal("0"),
            "esi_employee": Decimal("0"),
            "esi_employer": Decimal("0"),
            "pt": Decimal("0"),
            "tds": Decimal("0"),
        }
        
        processed = 0
        
        for employee in employees:
            try:
                # Calculate salary
                breakdown = self.calculate_employee_salary(
                    employee=employee,
                    month=payroll_run.pay_period_month,
                    year=payroll_run.pay_period_year,
                    working_days=working_days,
                )
                
                # Create payroll entry
                entry = PayrollEntry(
                    payroll_run_id=payroll_run_id,
                    employee_id=employee.id,
                    total_working_days=working_days,
                    days_worked=working_days,
                    earnings=dict(breakdown.earnings),
                    total_earnings=breakdown.gross_salary,
                    deductions=dict(breakdown.deductions),
                    total_deductions=breakdown.total_deductions,
                    employer_contributions=dict(breakdown.employer_contributions),
                    total_employer_contributions=sum(breakdown.employer_contributions.values()),
                    basic_for_pf=breakdown.earnings.get("BASIC", Decimal("0")),
                    gross_for_esi=breakdown.gross_salary,
                    pf_employee=breakdown.deductions.get("PF_EMP", Decimal("0")),
                    pf_employer=breakdown.employer_contributions.get("PF_ER", Decimal("0")),
                    esi_employee=breakdown.deductions.get("ESI_EMP", Decimal("0")),
                    esi_employer=breakdown.employer_contributions.get("ESI_ER", Decimal("0")),
                    professional_tax=breakdown.deductions.get("PT", Decimal("0")),
                    tds=breakdown.deductions.get("TDS", Decimal("0")),
                    total_loan_deductions=breakdown.deductions.get("LOAN", Decimal("0")),
                    gross_salary=breakdown.gross_salary,
                    net_pay=breakdown.net_pay,
                )
                
                self.db.add(entry)
                
                # Update totals
                totals["gross"] += breakdown.gross_salary
                totals["deductions"] += breakdown.total_deductions
                totals["net_pay"] += breakdown.net_pay
                totals["employer_contributions"] += sum(breakdown.employer_contributions.values())
                totals["pf_employee"] += breakdown.deductions.get("PF_EMP", Decimal("0"))
                totals["pf_employer"] += breakdown.employer_contributions.get("PF_ER", Decimal("0"))
                totals["esi_employee"] += breakdown.deductions.get("ESI_EMP", Decimal("0"))
                totals["esi_employer"] += breakdown.employer_contributions.get("ESI_ER", Decimal("0"))
                totals["pt"] += breakdown.deductions.get("PT", Decimal("0"))
                totals["tds"] += breakdown.deductions.get("TDS", Decimal("0"))
                
                processed += 1
                
            except Exception as e:
                print(f"Error processing employee {employee.id}: {e}")
        
        # Update payroll run totals
        payroll_run.processed_employees = processed
        payroll_run.total_gross = totals["gross"]
        payroll_run.total_deductions = totals["deductions"]
        payroll_run.total_net_pay = totals["net_pay"]
        payroll_run.total_employer_contributions = totals["employer_contributions"]
        payroll_run.total_pf_employee = totals["pf_employee"]
        payroll_run.total_pf_employer = totals["pf_employer"]
        payroll_run.total_esi_employee = totals["esi_employee"]
        payroll_run.total_esi_employer = totals["esi_employer"]
        payroll_run.total_pt = totals["pt"]
        payroll_run.total_tds = totals["tds"]
        payroll_run.status = PayrollRunStatus.PROCESSED
        payroll_run.processed_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(payroll_run)
        
        return payroll_run
    
    def finalize_payroll(
        self,
        payroll_run_id: str,
        user_id: str,
    ) -> PayrollRun:
        """Finalize payroll and create accounting entries."""
        payroll_run = self.db.query(PayrollRun).filter(
            PayrollRun.id == payroll_run_id
        ).first()
        
        if not payroll_run:
            raise ValueError("Payroll run not found")
        
        if payroll_run.status != PayrollRunStatus.PROCESSED:
            raise ValueError(f"Cannot finalize payroll. Status: {payroll_run.status}")
        
        # Get company
        company = self.db.query(Company).filter(
            Company.id == payroll_run.company_id
        ).first()
        
        # Create accounting entries using AccountingService
        try:
            transaction = self._create_payroll_accounting_entries(payroll_run, company)
            if transaction:
                payroll_run.transaction_id = transaction.id
        except Exception as e:
            print(f"Error creating payroll accounting entries: {e}")
        
        # Process loan deductions
        entries = self.db.query(PayrollEntry).filter(
            PayrollEntry.payroll_run_id == payroll_run_id,
            PayrollEntry.total_loan_deductions > 0,
        ).all()
        
        for entry in entries:
            # Record loan repayments
            pending_loans = self.loan_service.get_pending_emis_for_payroll(
                company_id=payroll_run.company_id,
                payroll_month=payroll_run.pay_period_month,
                payroll_year=payroll_run.pay_period_year,
            )
            
            for loan in pending_loans:
                if loan["employee_id"] == entry.employee_id:
                    try:
                        self.loan_service.record_repayment(
                            loan_id=loan["loan_id"],
                            amount=Decimal(str(loan["emi_amount"])),
                            payroll_entry_id=entry.id,
                        )
                    except Exception as e:
                        print(f"Error recording loan repayment: {e}")
        
        payroll_run.status = PayrollRunStatus.FINALIZED
        payroll_run.finalized_by = user_id
        payroll_run.finalized_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(payroll_run)
        
        return payroll_run
    
    def _create_payroll_accounting_entries(self, payroll_run: PayrollRun, company: Company):
        """
        Create double-entry accounting journal for payroll.
        
        Entries created:
        Dr. Salaries & Wages (6100) - Total gross salary
        Dr. PF Employer Contribution (6101) - Employer PF
        Dr. ESI Employer (6104) - Employer ESI
        Cr. Salary Payable (2400) - Net pay
        Cr. PF Payable (2410) - PF Employee + PF Employer
        Cr. ESI Payable (2420) - ESI Employee + ESI Employer
        Cr. TDS Payable (2200) - TDS deducted
        Cr. Professional Tax Payable (2430) - PT deducted
        """
        from app.services.accounting_service import AccountingService
        from app.schemas.accounting import TransactionCreate, TransactionEntryCreate, ReferenceType
        
        accounting_service = AccountingService(self.db)
        
        # Initialize chart of accounts and payroll configs
        accounting_service.initialize_chart_of_accounts(company)
        accounting_service.initialize_payroll_account_configs(company)
        
        # Get payroll entries
        entries = self.db.query(PayrollEntry).filter(
            PayrollEntry.payroll_run_id == payroll_run.id
        ).all()
        
        if not entries:
            return None
        
        # Aggregate totals
        total_gross = Decimal("0")
        total_net_pay = Decimal("0")
        total_pf_employee = Decimal("0")
        total_pf_employer = Decimal("0")
        total_esi_employee = Decimal("0")
        total_esi_employer = Decimal("0")
        total_pt = Decimal("0")
        total_tds = Decimal("0")
        
        for entry in entries:
            total_gross += entry.gross_salary or Decimal("0")
            total_net_pay += entry.net_pay or Decimal("0")
            total_pf_employee += entry.pf_employee or Decimal("0")
            total_pf_employer += entry.pf_employer or Decimal("0")
            total_esi_employee += entry.esi_employee or Decimal("0")
            total_esi_employer += entry.esi_employer or Decimal("0")
            total_pt += entry.professional_tax or Decimal("0")
            total_tds += entry.tds or Decimal("0")
        
        # Get accounts
        salary_expense_acc = accounting_service.get_account_by_code("6100", company)
        pf_expense_acc = accounting_service.get_account_by_code("6101", company)
        esi_expense_acc = accounting_service.get_account_by_code("6104", company)
        salary_payable_acc = accounting_service.get_account_by_code("2400", company)
        pf_payable_acc = accounting_service.get_account_by_code("2410", company)
        esi_payable_acc = accounting_service.get_account_by_code("2420", company)
        tds_payable_acc = accounting_service.get_account_by_code("2200", company)
        pt_payable_acc = accounting_service.get_account_by_code("2430", company)
        
        # Create accounts if they don't exist (using parent accounts as fallback)
        if not salary_expense_acc:
            salary_expense_acc = accounting_service.get_account_by_code("6000", company)
        if not salary_payable_acc:
            salary_payable_acc = accounting_service.get_account_by_code("2000", company)
        if not pf_payable_acc:
            pf_payable_acc = salary_payable_acc
        if not esi_payable_acc:
            esi_payable_acc = salary_payable_acc
        if not tds_payable_acc:
            tds_payable_acc = accounting_service.get_account_by_code("2100", company)
        if not pt_payable_acc:
            pt_payable_acc = tds_payable_acc
        
        if not salary_expense_acc or not salary_payable_acc:
            print("Warning: Required accounts not found for payroll entries")
            return None
        
        journal_entries = []
        pay_period = f"{payroll_run.pay_period_month}/{payroll_run.pay_period_year}"
        
        # Debit: Salaries & Wages Expense (total gross salary)
        if total_gross > 0:
            journal_entries.append(TransactionEntryCreate(
                account_id=salary_expense_acc.id,
                description=f"Salary expense for {pay_period}",
                debit_amount=self._round_amount(total_gross),
                credit_amount=Decimal("0"),
            ))
        
        # Debit: PF Employer Contribution
        if total_pf_employer > 0 and pf_expense_acc:
            journal_entries.append(TransactionEntryCreate(
                account_id=pf_expense_acc.id,
                description=f"PF employer contribution for {pay_period}",
                debit_amount=self._round_amount(total_pf_employer),
                credit_amount=Decimal("0"),
            ))
        
        # Debit: ESI Employer Contribution
        if total_esi_employer > 0 and esi_expense_acc:
            journal_entries.append(TransactionEntryCreate(
                account_id=esi_expense_acc.id,
                description=f"ESI employer contribution for {pay_period}",
                debit_amount=self._round_amount(total_esi_employer),
                credit_amount=Decimal("0"),
            ))
        
        # Credit: Salary Payable (net pay)
        if total_net_pay > 0:
            journal_entries.append(TransactionEntryCreate(
                account_id=salary_payable_acc.id,
                description=f"Net salary payable for {pay_period}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(total_net_pay),
            ))
        
        # Credit: PF Payable (Employee + Employer)
        total_pf = total_pf_employee + total_pf_employer
        if total_pf > 0 and pf_payable_acc:
            journal_entries.append(TransactionEntryCreate(
                account_id=pf_payable_acc.id,
                description=f"PF payable for {pay_period}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(total_pf),
            ))
        
        # Credit: ESI Payable (Employee + Employer)
        total_esi = total_esi_employee + total_esi_employer
        if total_esi > 0 and esi_payable_acc:
            journal_entries.append(TransactionEntryCreate(
                account_id=esi_payable_acc.id,
                description=f"ESI payable for {pay_period}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(total_esi),
            ))
        
        # Credit: TDS Payable
        if total_tds > 0 and tds_payable_acc:
            journal_entries.append(TransactionEntryCreate(
                account_id=tds_payable_acc.id,
                description=f"TDS on salary for {pay_period}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(total_tds),
            ))
        
        # Credit: Professional Tax Payable
        if total_pt > 0 and pt_payable_acc:
            journal_entries.append(TransactionEntryCreate(
                account_id=pt_payable_acc.id,
                description=f"Professional tax for {pay_period}",
                debit_amount=Decimal("0"),
                credit_amount=self._round_amount(total_pt),
            ))
        
        if not journal_entries:
            return None
        
        # Create the transaction
        transaction_data = TransactionCreate(
            transaction_date=payroll_run.pay_date or datetime.utcnow(),
            description=f"Payroll for {pay_period} - {payroll_run.processed_employees} employees",
            reference_type=ReferenceType.MANUAL,
            reference_id=payroll_run.id,
            entries=journal_entries,
        )
        
        return accounting_service.create_journal_entry(company, transaction_data, auto_post=True)
    
    def get_payslip(
        self,
        employee_id: str,
        month: int,
        year: int,
    ) -> Optional[Dict]:
        """Get payslip for an employee for a specific month."""
        entry = self.db.query(PayrollEntry).join(PayrollRun).filter(
            PayrollEntry.employee_id == employee_id,
            PayrollRun.pay_period_month == month,
            PayrollRun.pay_period_year == year,
            PayrollRun.status.in_([PayrollRunStatus.PROCESSED, PayrollRunStatus.FINALIZED]),
        ).first()
        
        if not entry:
            return None
        
        employee = entry.employee
        payroll_run = entry.payroll_run
        
        return {
            "payslip_id": entry.id,
            "employee": {
                "id": employee.id,
                "employee_code": employee.employee_code,
                "name": employee.full_name,
                "department": employee.department.name if employee.department else None,
                "designation": employee.designation.name if employee.designation else None,
                "pan": employee.pan,
                "uan": employee.uan,
                "bank_account": employee.bank_account_number,
                "bank_name": employee.bank_name,
            },
            "pay_period": {
                "month": payroll_run.pay_period_month,
                "year": payroll_run.pay_period_year,
                "pay_date": payroll_run.pay_date.isoformat() if payroll_run.pay_date else None,
            },
            "working_days": {
                "total": entry.total_working_days,
                "worked": entry.days_worked,
                "absent": entry.days_absent,
                "lop": entry.lop_days,
            },
            "earnings": entry.earnings,
            "deductions": entry.deductions,
            "employer_contributions": entry.employer_contributions,
            "summary": {
                "gross_salary": float(entry.gross_salary),
                "total_deductions": float(entry.total_deductions),
                "net_pay": float(entry.net_pay),
            },
            "statutory": {
                "pf_employee": float(entry.pf_employee),
                "pf_employer": float(entry.pf_employer),
                "esi_employee": float(entry.esi_employee),
                "esi_employer": float(entry.esi_employer),
                "professional_tax": float(entry.professional_tax),
                "tds": float(entry.tds),
            },
        }
    
    # ==================== PAYROLL SETTINGS ====================
    
    def get_or_create_payroll_settings(self, company_id: str) -> PayrollSettings:
        """Get or create payroll settings for a company."""
        settings = self.db.query(PayrollSettings).filter(
            PayrollSettings.company_id == company_id
        ).first()
        
        if not settings:
            settings = PayrollSettings(company_id=company_id)
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        
        return settings
    
    def update_payroll_settings(
        self,
        company_id: str,
        **kwargs,
    ) -> PayrollSettings:
        """Update payroll settings."""
        settings = self.get_or_create_payroll_settings(company_id)
        
        for key, value in kwargs.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
        
        self.db.commit()
        self.db.refresh(settings)
        
        return settings
