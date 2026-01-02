"""Payroll API endpoints for employee and salary management."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import User, Company
from app.database.payroll_models import (
    Employee, Department, Designation, SalaryComponent, PayrollRun, PayrollEntry,
    EmployeeLoan, PayrollSettings, EmployeeType, EmployeeStatus, Gender,
    MaritalStatus, PayFrequency, SalaryComponentType, ComponentCalculationType,
    PayrollRunStatus, LoanStatus, LoanType, TaxRegime
)
from app.auth.dependencies import get_current_active_user
from app.services.payroll_service import PayrollService
from app.services.loan_service import LoanService
from app.services.pf_service import PFService
from app.services.esi_service import ESIService
from app.services.pt_service import PTService

router = APIRouter(prefix="/companies/{company_id}/payroll", tags=["Payroll"])


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

class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    code: Optional[str]
    description: Optional[str]
    parent_id: Optional[str]
    is_active: bool
    
    class Config:
        from_attributes = True


class DesignationCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    level: int = 1


class DesignationResponse(BaseModel):
    id: str
    name: str
    code: Optional[str]
    description: Optional[str]
    level: int
    is_active: bool
    
    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    employee_code: str
    first_name: str
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    marital_status: Optional[MaritalStatus] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_address: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    current_pincode: Optional[str] = None
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    employee_type: EmployeeType = EmployeeType.PERMANENT
    date_of_joining: date
    work_state: Optional[str] = None
    ctc: Optional[float] = 0
    uan: Optional[str] = None
    pf_number: Optional[str] = None
    esi_number: Optional[str] = None
    pf_applicable: bool = True
    esi_applicable: bool = True
    pt_applicable: bool = True
    tax_regime: TaxRegime = TaxRegime.NEW
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    marital_status: Optional[MaritalStatus] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_address: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    current_pincode: Optional[str] = None
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    employee_type: Optional[EmployeeType] = None
    work_state: Optional[str] = None
    ctc: Optional[float] = None
    uan: Optional[str] = None
    pf_number: Optional[str] = None
    esi_number: Optional[str] = None
    pf_applicable: Optional[bool] = None
    esi_applicable: Optional[bool] = None
    pt_applicable: Optional[bool] = None
    tax_regime: Optional[TaxRegime] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    status: Optional[EmployeeStatus] = None


class EmployeeResponse(BaseModel):
    id: str
    employee_code: str
    first_name: str
    last_name: Optional[str]
    full_name: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    department_id: Optional[str]
    designation_id: Optional[str]
    employee_type: str
    date_of_joining: date
    work_state: Optional[str]
    ctc: Optional[float]
    pan: Optional[str]
    uan: Optional[str]
    pf_applicable: bool
    esi_applicable: bool
    pt_applicable: bool
    tax_regime: str
    status: str
    
    class Config:
        from_attributes = True


class SalaryComponentCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    component_type: SalaryComponentType
    calculation_type: ComponentCalculationType = ComponentCalculationType.FIXED
    percentage: Optional[float] = None
    max_amount: Optional[float] = None
    is_taxable: bool = True
    is_part_of_ctc: bool = True
    is_part_of_gross: bool = True
    include_in_pf_wages: bool = False
    include_in_esi_wages: bool = False
    display_order: int = 0


class SalaryComponentResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    component_type: str
    calculation_type: str
    percentage: Optional[float]
    max_amount: Optional[float]
    is_taxable: bool
    is_part_of_ctc: bool
    is_statutory: bool
    display_order: int
    is_active: bool
    
    class Config:
        from_attributes = True


class SalaryStructureCreate(BaseModel):
    ctc: float
    effective_from: date
    components: Optional[dict] = None  # {"BASIC": 50000, "HRA": 20000, ...}


class PayrollRunCreate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020, le=2100)
    pay_date: Optional[date] = None


class PayrollRunResponse(BaseModel):
    id: str
    pay_period_month: int
    pay_period_year: int
    pay_date: Optional[date]
    status: str
    total_employees: int
    processed_employees: int
    total_gross: float
    total_deductions: float
    total_net_pay: float
    total_pf_employee: float
    total_pf_employer: float
    total_esi_employee: float
    total_esi_employer: float
    total_pt: float
    total_tds: float
    
    class Config:
        from_attributes = True


class LoanCreate(BaseModel):
    employee_id: str
    loan_type: LoanType
    principal_amount: float
    tenure_months: int
    interest_rate: Optional[float] = None
    disbursement_date: Optional[date] = None
    reason: Optional[str] = None


class LoanResponse(BaseModel):
    id: str
    loan_number: str
    employee_id: str
    loan_type: str
    principal_amount: float
    interest_rate: float
    tenure_months: int
    emi_amount: float
    disbursement_date: Optional[date]
    total_repayable: float
    amount_repaid: float
    outstanding_balance: float
    emis_paid: int
    emis_pending: int
    status: str
    
    class Config:
        from_attributes = True


# ==================== DEPARTMENTS ====================

@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    company_id: str,
    data: DepartmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new department."""
    company = get_company_or_404(company_id, current_user, db)
    
    department = Department(
        company_id=company.id,
        **data.model_dump()
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    
    return department


@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all departments."""
    company = get_company_or_404(company_id, current_user, db)
    
    departments = db.query(Department).filter(
        Department.company_id == company.id,
        Department.is_active == True,
    ).all()
    
    return departments


# ==================== DESIGNATIONS ====================

@router.post("/designations", response_model=DesignationResponse, status_code=status.HTTP_201_CREATED)
async def create_designation(
    company_id: str,
    data: DesignationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new designation."""
    company = get_company_or_404(company_id, current_user, db)
    
    designation = Designation(
        company_id=company.id,
        **data.model_dump()
    )
    db.add(designation)
    db.commit()
    db.refresh(designation)
    
    return designation


@router.get("/designations", response_model=List[DesignationResponse])
async def list_designations(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all designations."""
    company = get_company_or_404(company_id, current_user, db)
    
    designations = db.query(Designation).filter(
        Designation.company_id == company.id,
        Designation.is_active == True,
    ).order_by(Designation.level).all()
    
    return designations


# ==================== EMPLOYEES ====================

@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    company_id: str,
    data: EmployeeCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new employee."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Check for duplicate employee code
    existing = db.query(Employee).filter(
        Employee.company_id == company.id,
        Employee.employee_code == data.employee_code,
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with code {data.employee_code} already exists"
        )
    
    employee_data = data.model_dump()
    employee_data["full_name"] = f"{data.first_name} {data.last_name or ''}".strip()
    if data.ctc:
        employee_data["ctc"] = Decimal(str(data.ctc))
    
    employee = Employee(
        company_id=company.id,
        **employee_data
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    
    return employee


@router.get("/employees", response_model=List[EmployeeResponse])
async def list_employees(
    company_id: str,
    status_filter: Optional[EmployeeStatus] = None,
    department_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all employees."""
    company = get_company_or_404(company_id, current_user, db)
    
    query = db.query(Employee).filter(Employee.company_id == company.id)
    
    if status_filter:
        query = query.filter(Employee.status == status_filter)
    else:
        query = query.filter(Employee.status != EmployeeStatus.TERMINATED)
    
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    
    employees = query.order_by(Employee.employee_code).all()
    
    return employees


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    company_id: str,
    employee_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get employee details."""
    company = get_company_or_404(company_id, current_user, db)
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == company.id,
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return employee


@router.put("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    company_id: str,
    employee_id: str,
    data: EmployeeUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update employee details."""
    company = get_company_or_404(company_id, current_user, db)
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == company.id,
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if key == "ctc" and value is not None:
            value = Decimal(str(value))
        setattr(employee, key, value)
    
    # Update full name
    employee.full_name = f"{employee.first_name} {employee.last_name or ''}".strip()
    
    db.commit()
    db.refresh(employee)
    
    return employee


@router.delete("/employees/{employee_id}")
async def deactivate_employee(
    company_id: str,
    employee_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Deactivate an employee (soft delete)."""
    company = get_company_or_404(company_id, current_user, db)
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == company.id,
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee.status = EmployeeStatus.INACTIVE
    db.commit()
    
    return {"message": "Employee deactivated"}


# ==================== SALARY COMPONENTS ====================

@router.post("/salary-components", response_model=SalaryComponentResponse, status_code=status.HTTP_201_CREATED)
async def create_salary_component(
    company_id: str,
    data: SalaryComponentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new salary component."""
    company = get_company_or_404(company_id, current_user, db)
    
    component_data = data.model_dump()
    if data.percentage:
        component_data["percentage"] = Decimal(str(data.percentage))
    if data.max_amount:
        component_data["max_amount"] = Decimal(str(data.max_amount))
    
    component = SalaryComponent(
        company_id=company.id,
        **component_data
    )
    db.add(component)
    db.commit()
    db.refresh(component)
    
    return component


@router.get("/salary-components", response_model=List[SalaryComponentResponse])
async def list_salary_components(
    company_id: str,
    component_type: Optional[SalaryComponentType] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all salary components."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PayrollService(db)
    components = service.get_salary_components(company.id, component_type)
    
    return components


@router.post("/salary-components/initialize")
async def initialize_default_components(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Initialize default salary components for a company."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PayrollService(db)
    created = service.create_default_salary_components(company.id)
    
    return {"message": f"Created {len(created)} default components"}


# ==================== SALARY STRUCTURE ====================

@router.post("/employees/{employee_id}/salary-structure")
async def create_salary_structure(
    company_id: str,
    employee_id: str,
    data: SalaryStructureCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create/update salary structure for an employee."""
    company = get_company_or_404(company_id, current_user, db)
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == company.id,
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    service = PayrollService(db)
    
    # Convert component amounts to Decimal
    custom_components = None
    if data.components:
        custom_components = {k: Decimal(str(v)) for k, v in data.components.items()}
    
    structures = service.create_employee_salary_structure(
        employee_id=employee_id,
        ctc=Decimal(str(data.ctc)),
        effective_from=data.effective_from,
        custom_components=custom_components,
    )
    
    return {"message": f"Created salary structure with {len(structures)} components"}


@router.get("/employees/{employee_id}/salary-structure")
async def get_salary_structure(
    company_id: str,
    employee_id: str,
    as_of: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current salary structure for an employee."""
    company = get_company_or_404(company_id, current_user, db)
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == company.id,
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    service = PayrollService(db)
    structure = service.get_employee_salary_structure(employee_id, as_of)
    
    return {
        "employee_id": employee_id,
        "employee_name": employee.full_name,
        "ctc": float(employee.ctc) if employee.ctc else 0,
        "components": structure,
    }


# ==================== PAYROLL RUN ====================

@router.post("/run", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED)
async def create_payroll_run(
    company_id: str,
    data: PayrollRunCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new payroll run for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PayrollService(db)
    
    try:
        payroll_run = service.create_payroll_run(
            company_id=company.id,
            month=data.month,
            year=data.year,
            pay_date=data.pay_date,
        )
        return payroll_run
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/run", response_model=List[PayrollRunResponse])
async def list_payroll_runs(
    company_id: str,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all payroll runs."""
    company = get_company_or_404(company_id, current_user, db)
    
    query = db.query(PayrollRun).filter(PayrollRun.company_id == company.id)
    
    if year:
        query = query.filter(PayrollRun.pay_period_year == year)
    
    runs = query.order_by(
        PayrollRun.pay_period_year.desc(),
        PayrollRun.pay_period_month.desc()
    ).all()
    
    return runs


@router.get("/run/{month}/{year}", response_model=PayrollRunResponse)
async def get_payroll_run(
    company_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get payroll run for a specific month."""
    company = get_company_or_404(company_id, current_user, db)
    
    payroll_run = db.query(PayrollRun).filter(
        PayrollRun.company_id == company.id,
        PayrollRun.pay_period_month == month,
        PayrollRun.pay_period_year == year,
    ).first()
    
    if not payroll_run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    
    return payroll_run


@router.post("/run/{payroll_run_id}/process")
async def process_payroll(
    company_id: str,
    payroll_run_id: str,
    working_days: int = Query(30, ge=1, le=31),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Process payroll for all employees."""
    company = get_company_or_404(company_id, current_user, db)
    
    payroll_run = db.query(PayrollRun).filter(
        PayrollRun.id == payroll_run_id,
        PayrollRun.company_id == company.id,
    ).first()
    
    if not payroll_run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    
    service = PayrollService(db)
    
    try:
        payroll_run = service.process_payroll(payroll_run_id, working_days)
        return {
            "message": "Payroll processed successfully",
            "processed_employees": payroll_run.processed_employees,
            "total_net_pay": float(payroll_run.total_net_pay),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/run/{payroll_run_id}/finalize")
async def finalize_payroll(
    company_id: str,
    payroll_run_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Finalize payroll and create accounting entries."""
    company = get_company_or_404(company_id, current_user, db)
    
    payroll_run = db.query(PayrollRun).filter(
        PayrollRun.id == payroll_run_id,
        PayrollRun.company_id == company.id,
    ).first()
    
    if not payroll_run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    
    service = PayrollService(db)
    
    try:
        payroll_run = service.finalize_payroll(payroll_run_id, current_user.id)
        return {"message": "Payroll finalized successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== PAYSLIPS ====================

@router.get("/payslip/{employee_id}/{month}/{year}")
async def get_payslip(
    company_id: str,
    employee_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get payslip for an employee."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PayrollService(db)
    payslip = service.get_payslip(employee_id, month, year)
    
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    return payslip


@router.get("/payslips/{month}/{year}")
async def list_payslips(
    company_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all payslips for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    entries = db.query(PayrollEntry).join(PayrollRun).filter(
        PayrollRun.company_id == company.id,
        PayrollRun.pay_period_month == month,
        PayrollRun.pay_period_year == year,
    ).all()
    
    payslips = []
    for entry in entries:
        employee = entry.employee
        payslips.append({
            "employee_id": entry.employee_id,
            "employee_code": employee.employee_code if employee else None,
            "employee_name": employee.full_name if employee else None,
            "gross_salary": float(entry.gross_salary),
            "total_deductions": float(entry.total_deductions),
            "net_pay": float(entry.net_pay),
        })
    
    return payslips


# ==================== LOANS ====================

@router.post("/loans", response_model=LoanResponse, status_code=status.HTTP_201_CREATED)
async def create_loan(
    company_id: str,
    data: LoanCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new employee loan."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = LoanService(db)
    
    try:
        loan = service.create_loan(
            company_id=company.id,
            employee_id=data.employee_id,
            loan_type=data.loan_type,
            principal_amount=Decimal(str(data.principal_amount)),
            tenure_months=data.tenure_months,
            interest_rate=Decimal(str(data.interest_rate)) if data.interest_rate else None,
            disbursement_date=data.disbursement_date,
            reason=data.reason,
        )
        return loan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/loans", response_model=List[LoanResponse])
async def list_loans(
    company_id: str,
    employee_id: Optional[str] = None,
    status_filter: Optional[LoanStatus] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all loans."""
    company = get_company_or_404(company_id, current_user, db)
    
    query = db.query(EmployeeLoan).filter(EmployeeLoan.company_id == company.id)
    
    if employee_id:
        query = query.filter(EmployeeLoan.employee_id == employee_id)
    
    if status_filter:
        query = query.filter(EmployeeLoan.status == status_filter)
    
    loans = query.order_by(EmployeeLoan.created_at.desc()).all()
    
    return loans


@router.get("/loans/{loan_id}")
async def get_loan_statement(
    company_id: str,
    loan_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get loan details with repayment history."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = LoanService(db)
    statement = service.get_loan_statement(loan_id)
    
    if "error" in statement:
        raise HTTPException(status_code=404, detail=statement["error"])
    
    return statement


@router.post("/loans/{loan_id}/approve")
async def approve_loan(
    company_id: str,
    loan_id: str,
    disbursement_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Approve a loan."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = LoanService(db)
    
    try:
        loan = service.approve_loan(loan_id, current_user.id, disbursement_date)
        return {"message": "Loan approved", "loan_number": loan.loan_number}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/loans/{loan_id}/disburse")
async def disburse_loan(
    company_id: str,
    loan_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Disburse a loan."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = LoanService(db)
    
    try:
        loan = service.disburse_loan(loan_id)
        return {"message": "Loan disbursed", "loan_number": loan.loan_number}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/loans/{loan_id}/eligibility")
async def check_loan_eligibility(
    company_id: str,
    employee_id: str,
    loan_type: LoanType,
    amount: Optional[float] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check loan eligibility for an employee."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = LoanService(db)
    
    result = service.check_eligibility(
        employee_id=employee_id,
        loan_type=loan_type,
        requested_amount=Decimal(str(amount)) if amount else None,
    )
    
    return {
        "is_eligible": result.is_eligible,
        "max_amount": float(result.max_amount),
        "max_tenure_months": result.max_tenure_months,
        "reason": result.reason,
        "existing_loans": result.existing_loans_count,
        "outstanding_amount": float(result.existing_loans_outstanding),
    }


# ==================== REPORTS ====================

@router.get("/reports/pf/{month}/{year}")
async def get_pf_report(
    company_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get PF ECR report for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PFService(db)
    
    summary = service.get_pf_summary_for_month(company.id, month, year)
    ecr_data = service.generate_ecr_data(company.id, month, year)
    
    return {
        "summary": summary,
        "ecr_data": ecr_data,
    }


@router.get("/reports/esi/{month}/{year}")
async def get_esi_report(
    company_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get ESI challan report for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = ESIService(db)
    
    summary = service.get_esi_summary_for_month(company.id, month, year)
    challan_data = service.generate_esi_challan_data(company.id, month, year)
    
    return {
        "summary": summary,
        "challan_data": challan_data,
    }


@router.get("/reports/pt/{month}/{year}")
async def get_pt_report(
    company_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get Professional Tax report for a month."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PTService(db)
    summary = service.get_pt_summary_for_month(company.id, month, year)
    
    return summary


# ==================== SETTINGS ====================

@router.get("/settings")
async def get_payroll_settings(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get payroll settings."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PayrollService(db)
    settings = service.get_or_create_payroll_settings(company.id)
    
    return {
        "pf_enabled": settings.pf_enabled,
        "pf_contribution_rate": float(settings.pf_contribution_rate) if settings.pf_contribution_rate else 12,
        "pf_wage_ceiling": float(settings.pf_wage_ceiling) if settings.pf_wage_ceiling else 15000,
        "pf_establishment_id": settings.pf_establishment_id,
        "esi_enabled": settings.esi_enabled,
        "esi_employee_rate": float(settings.esi_employee_rate) if settings.esi_employee_rate else 0.75,
        "esi_employer_rate": float(settings.esi_employer_rate) if settings.esi_employer_rate else 3.25,
        "esi_wage_ceiling": float(settings.esi_wage_ceiling) if settings.esi_wage_ceiling else 21000,
        "esi_establishment_id": settings.esi_establishment_id,
        "pt_enabled": settings.pt_enabled,
        "pt_state": settings.pt_state,
        "tds_enabled": settings.tds_enabled,
        "default_tax_regime": settings.default_tax_regime.value if settings.default_tax_regime else "new",
        "pay_day": settings.pay_day,
        "working_days_per_month": settings.working_days_per_month,
    }


@router.put("/settings")
async def update_payroll_settings(
    company_id: str,
    data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update payroll settings."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = PayrollService(db)
    
    # Convert numeric fields to Decimal
    if "pf_contribution_rate" in data:
        data["pf_contribution_rate"] = Decimal(str(data["pf_contribution_rate"]))
    if "pf_wage_ceiling" in data:
        data["pf_wage_ceiling"] = Decimal(str(data["pf_wage_ceiling"]))
    if "esi_employee_rate" in data:
        data["esi_employee_rate"] = Decimal(str(data["esi_employee_rate"]))
    if "esi_employer_rate" in data:
        data["esi_employer_rate"] = Decimal(str(data["esi_employer_rate"]))
    if "esi_wage_ceiling" in data:
        data["esi_wage_ceiling"] = Decimal(str(data["esi_wage_ceiling"]))
    
    settings = service.update_payroll_settings(company.id, **data)
    
    return {"message": "Settings updated"}
