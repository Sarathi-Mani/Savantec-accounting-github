"""Payroll database models for employee management and salary processing."""
from datetime import datetime, date
from decimal import Decimal
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Numeric, Boolean,
    ForeignKey, Enum, JSON, Index
)
from sqlalchemy.orm import relationship
from app.database.connection import Base
from app.database.models import generate_uuid


# ==================== ENUMS ====================

class EmployeeType(str, PyEnum):
    """Employee type enumeration."""
    PERMANENT = "permanent"
    CONTRACT = "contract"
    PROBATION = "probation"
    INTERN = "intern"
    CONSULTANT = "consultant"


class EmployeeStatus(str, PyEnum):
    """Employee status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    TERMINATED = "terminated"
    RESIGNED = "resigned"
    ON_NOTICE = "on_notice"


class Gender(str, PyEnum):
    """Gender enumeration."""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class MaritalStatus(str, PyEnum):
    """Marital status enumeration."""
    SINGLE = "single"
    MARRIED = "married"
    DIVORCED = "divorced"
    WIDOWED = "widowed"


class PayFrequency(str, PyEnum):
    """Pay frequency enumeration."""
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    DAILY = "daily"


class SalaryComponentType(str, PyEnum):
    """Salary component type enumeration."""
    EARNING = "earning"
    DEDUCTION = "deduction"
    EMPLOYER_CONTRIBUTION = "employer_contribution"


class ComponentCalculationType(str, PyEnum):
    """How component amount is calculated."""
    FIXED = "fixed"
    PERCENTAGE_OF_BASIC = "percentage_of_basic"
    PERCENTAGE_OF_GROSS = "percentage_of_gross"
    PERCENTAGE_OF_CTC = "percentage_of_ctc"


class PayrollRunStatus(str, PyEnum):
    """Payroll run status enumeration."""
    DRAFT = "draft"
    PROCESSING = "processing"
    PROCESSED = "processed"
    APPROVED = "approved"
    FINALIZED = "finalized"
    CANCELLED = "cancelled"


class LoanStatus(str, PyEnum):
    """Loan status enumeration."""
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ACTIVE = "active"
    CLOSED = "closed"
    DEFAULTED = "defaulted"
    CANCELLED = "cancelled"


class LoanType(str, PyEnum):
    """Loan type enumeration."""
    SALARY_ADVANCE = "salary_advance"
    PERSONAL_LOAN = "personal_loan"
    EMERGENCY_LOAN = "emergency_loan"
    FESTIVAL_ADVANCE = "festival_advance"
    OTHER = "other"


class TaxRegime(str, PyEnum):
    """Tax regime enumeration."""
    OLD = "old"
    NEW = "new"


# ==================== MODELS ====================

class Department(Base):
    """Department model for organization structure."""
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    code = Column(String(20))
    description = Column(Text)
    parent_id = Column(String(36), ForeignKey("departments.id", ondelete="SET NULL"))
    
    head_employee_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent = relationship("Department", remote_side=[id], backref="sub_departments")
    employees = relationship("Employee", back_populates="department", foreign_keys="Employee.department_id")

    __table_args__ = (
        Index("idx_department_company", "company_id"),
    )


class Designation(Base):
    """Designation/Job title model."""
    __tablename__ = "designations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    code = Column(String(20))
    description = Column(Text)
    level = Column(Integer, default=1)  # Hierarchy level
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employees = relationship("Employee", back_populates="designation")

    __table_args__ = (
        Index("idx_designation_company", "company_id"),
    )


class Employee(Base):
    """Employee master model."""
    __tablename__ = "employees"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Employee identification
    employee_code = Column(String(50), nullable=False)  # Unique employee ID
    
    # Personal details
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100))
    full_name = Column(String(255))  # Computed: first + last
    date_of_birth = Column(Date)
    gender = Column(Enum(Gender))
    marital_status = Column(Enum(MaritalStatus))
    blood_group = Column(String(10))
    nationality = Column(String(50), default="Indian")
    
    # Contact
    email = Column(String(255))
    phone = Column(String(20))
    emergency_contact_name = Column(String(255))
    emergency_contact_phone = Column(String(20))
    
    # Family details
    father_name = Column(String(100))
    mother_name = Column(String(100))
    spouse_name = Column(String(100))
    spouse_occupation = Column(String(100))
    children_count = Column(Integer, default=0)
    children_details = Column(Text)
    emergency_contact_relation = Column(String(50))

    # Additional contact
    personal_email = Column(String(255))
    official_email = Column(String(255))
    personal_phone = Column(String(20))
    official_phone = Column(String(20))
    alternate_phone = Column(String(20))

    # Account holder name
    account_holder_name = Column(String(255))
    
    # Address
    current_address = Column(Text)
    current_city = Column(String(100))
    current_state = Column(String(100))
    current_pincode = Column(String(10))
    permanent_address = Column(Text)
    permanent_city = Column(String(100))
    permanent_state = Column(String(100))
    permanent_pincode = Column(String(10))
    
    # Government IDs
    pan = Column(String(10))  # PAN Number
    aadhaar = Column(String(12))  # Aadhaar Number
    passport_number = Column(String(20))
    passport_expiry = Column(Date)
    
    # Employment details
    department_id = Column(String(36), ForeignKey("departments.id", ondelete="SET NULL"))
    designation_id = Column(String(36), ForeignKey("designations.id", ondelete="SET NULL"))
    reporting_manager_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    
    employee_type = Column(Enum(EmployeeType), default=EmployeeType.PERMANENT)
    date_of_joining = Column(Date, nullable=False)
    date_of_confirmation = Column(Date)
    date_of_resignation = Column(Date)
    date_of_exit = Column(Date)
    notice_period_days = Column(Integer, default=30)
    
    # Work location
    work_location = Column(String(255))
    work_state = Column(String(100))  # For PT calculation
    
    # Payroll settings
    pay_frequency = Column(Enum(PayFrequency), default=PayFrequency.MONTHLY)
    ctc = Column(Numeric(14, 2), default=0)  # Cost to Company (annual)
    
    # Statutory details
    uan = Column(String(12))  # Universal Account Number for PF
    pf_number = Column(String(22))  # PF Account Number
    esi_number = Column(String(17))  # ESI Number
    pf_applicable = Column(Boolean, default=True)
    esi_applicable = Column(Boolean, default=True)
    pt_applicable = Column(Boolean, default=True)
    lwf_applicable = Column(Boolean, default=False)  # Labour Welfare Fund
    
    # Tax settings
    tax_regime = Column(Enum(TaxRegime), default=TaxRegime.NEW)
    
    # Bank details
    bank_name = Column(String(255))
    bank_account_number = Column(String(50))
    bank_ifsc = Column(String(11))
    bank_branch = Column(String(255))
    
    # Status
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE)
    
    # Photo
    photo_url = Column(String(500))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    designation = relationship("Designation", back_populates="employees")
    reporting_manager = relationship("Employee", remote_side=[id], backref="subordinates")
    salary_structures = relationship("EmployeeSalaryStructure", back_populates="employee")
    payroll_entries = relationship("PayrollEntry", back_populates="employee")
    loans = relationship("EmployeeLoan", back_populates="employee")
    tax_declarations = relationship("EmployeeTaxDeclaration", back_populates="employee")

    __table_args__ = (
        Index("idx_employee_company", "company_id"),
        Index("idx_employee_code", "company_id", "employee_code", unique=True),
        Index("idx_employee_department", "department_id"),
        Index("idx_employee_status", "status"),
    )

    def __repr__(self):
        return f"<Employee {self.employee_code} - {self.full_name}>"


class SalaryComponent(Base):
    """Salary component master - Basic, HRA, DA, etc."""
    __tablename__ = "salary_components"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    code = Column(String(20), nullable=False)
    description = Column(Text)
    
    component_type = Column(Enum(SalaryComponentType), nullable=False)
    calculation_type = Column(Enum(ComponentCalculationType), default=ComponentCalculationType.FIXED)
    
    # For percentage-based calculations
    percentage = Column(Numeric(5, 2), default=0)
    
    # Limits
    max_amount = Column(Numeric(14, 2))  # Maximum limit per month
    annual_max = Column(Numeric(14, 2))  # Annual maximum
    
    # Tax treatment
    is_taxable = Column(Boolean, default=True)
    is_part_of_ctc = Column(Boolean, default=True)
    is_part_of_gross = Column(Boolean, default=True)
    
    # Statutory
    is_statutory = Column(Boolean, default=False)
    statutory_type = Column(String(20))  # pf, esi, pt, tds
    
    # For PF/ESI calculations
    include_in_pf_wages = Column(Boolean, default=False)
    include_in_esi_wages = Column(Boolean, default=False)
    
    # Display
    display_order = Column(Integer, default=0)
    show_in_payslip = Column(Boolean, default=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_salary_component_company", "company_id"),
        Index("idx_salary_component_code", "company_id", "code", unique=True),
    )

    def __repr__(self):
        return f"<SalaryComponent {self.code} - {self.name}>"


class EmployeeSalaryStructure(Base):
    """Employee-specific salary structure - component assignments."""
    __tablename__ = "employee_salary_structures"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(String(36), ForeignKey("salary_components.id", ondelete="CASCADE"), nullable=False)
    
    # Amount or percentage override
    amount = Column(Numeric(14, 2), default=0)  # Fixed amount
    percentage = Column(Numeric(5, 2))  # Override percentage
    
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date)  # NULL means current
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="salary_structures")
    component = relationship("SalaryComponent")

    __table_args__ = (
        Index("idx_emp_salary_employee", "employee_id"),
        Index("idx_emp_salary_effective", "effective_from", "effective_to"),
    )


class PayrollRun(Base):
    """Monthly payroll processing batch."""
    __tablename__ = "payroll_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    # Period
    pay_period_month = Column(Integer, nullable=False)  # 1-12
    pay_period_year = Column(Integer, nullable=False)
    pay_date = Column(Date)  # Actual payment date
    
    # Processing info
    status = Column(Enum(PayrollRunStatus), default=PayrollRunStatus.DRAFT)
    total_employees = Column(Integer, default=0)
    processed_employees = Column(Integer, default=0)
    
    # Totals
    total_gross = Column(Numeric(14, 2), default=0)
    total_deductions = Column(Numeric(14, 2), default=0)
    total_net_pay = Column(Numeric(14, 2), default=0)
    total_employer_contributions = Column(Numeric(14, 2), default=0)
    
    # Statutory totals
    total_pf_employee = Column(Numeric(14, 2), default=0)
    total_pf_employer = Column(Numeric(14, 2), default=0)
    total_esi_employee = Column(Numeric(14, 2), default=0)
    total_esi_employer = Column(Numeric(14, 2), default=0)
    total_pt = Column(Numeric(14, 2), default=0)
    total_tds = Column(Numeric(14, 2), default=0)
    
    # Workflow
    processed_by = Column(String(36))
    processed_at = Column(DateTime)
    approved_by = Column(String(36))
    approved_at = Column(DateTime)
    finalized_by = Column(String(36))
    finalized_at = Column(DateTime)
    
    # Linked transaction (when finalized)
    transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entries = relationship("PayrollEntry", back_populates="payroll_run", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_payroll_run_company", "company_id"),
        Index("idx_payroll_run_period", "pay_period_year", "pay_period_month"),
        Index("idx_payroll_run_status", "status"),
    )

    def __repr__(self):
        return f"<PayrollRun {self.pay_period_month}/{self.pay_period_year}>"


class PayrollEntry(Base):
    """Individual employee payslip entry."""
    __tablename__ = "payroll_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    payroll_run_id = Column(String(36), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    
    # Working days
    total_working_days = Column(Integer, default=30)
    days_worked = Column(Integer, default=30)
    days_absent = Column(Integer, default=0)
    lop_days = Column(Integer, default=0)  # Loss of Pay days
    
    # Earnings breakdown (JSON for flexibility)
    earnings = Column(JSON)  # {"basic": 50000, "hra": 20000, ...}
    total_earnings = Column(Numeric(14, 2), default=0)
    
    # Deductions breakdown
    deductions = Column(JSON)  # {"pf": 1800, "pt": 200, "tds": 5000, ...}
    total_deductions = Column(Numeric(14, 2), default=0)
    
    # Employer contributions (not deducted from employee)
    employer_contributions = Column(JSON)  # {"pf": 1800, "esi": 975, ...}
    total_employer_contributions = Column(Numeric(14, 2), default=0)
    
    # Statutory details
    basic_for_pf = Column(Numeric(14, 2), default=0)  # PF wage
    gross_for_esi = Column(Numeric(14, 2), default=0)  # ESI wage
    
    pf_employee = Column(Numeric(14, 2), default=0)
    pf_employer = Column(Numeric(14, 2), default=0)
    eps_employer = Column(Numeric(14, 2), default=0)
    edli_employer = Column(Numeric(14, 2), default=0)
    pf_admin = Column(Numeric(14, 2), default=0)
    
    esi_employee = Column(Numeric(14, 2), default=0)
    esi_employer = Column(Numeric(14, 2), default=0)
    
    professional_tax = Column(Numeric(14, 2), default=0)
    tds = Column(Numeric(14, 2), default=0)
    
    # Loan deductions
    loan_deductions = Column(JSON)  # [{"loan_id": "...", "amount": 5000}, ...]
    total_loan_deductions = Column(Numeric(14, 2), default=0)
    
    # Net pay
    gross_salary = Column(Numeric(14, 2), default=0)
    net_pay = Column(Numeric(14, 2), default=0)
    
    # Payment info
    payment_mode = Column(String(20))  # bank_transfer, cash, cheque
    payment_reference = Column(String(100))
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime)
    
    # Arrears (if any)
    arrears = Column(JSON)
    total_arrears = Column(Numeric(14, 2), default=0)
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payroll_run = relationship("PayrollRun", back_populates="entries")
    employee = relationship("Employee", back_populates="payroll_entries")
    loan_repayments = relationship("LoanRepayment", back_populates="payroll_entry")

    __table_args__ = (
        Index("idx_payroll_entry_run", "payroll_run_id"),
        Index("idx_payroll_entry_employee", "employee_id"),
    )

    def __repr__(self):
        return f"<PayrollEntry {self.employee_id} - {self.net_pay}>"


class EmployeeLoan(Base):
    """Employee loan/advance master."""
    __tablename__ = "employee_loans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    
    loan_number = Column(String(50), nullable=False)
    loan_type = Column(Enum(LoanType), default=LoanType.PERSONAL_LOAN)
    
    # Loan details
    principal_amount = Column(Numeric(14, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), default=0)  # Annual interest rate %
    tenure_months = Column(Integer, nullable=False)
    emi_amount = Column(Numeric(14, 2), nullable=False)  # Monthly EMI
    
    # Status tracking
    disbursement_date = Column(Date)
    first_emi_date = Column(Date)
    total_interest = Column(Numeric(14, 2), default=0)
    total_repayable = Column(Numeric(14, 2), default=0)
    amount_repaid = Column(Numeric(14, 2), default=0)
    outstanding_balance = Column(Numeric(14, 2), default=0)
    
    # EMI tracking
    emis_paid = Column(Integer, default=0)
    emis_pending = Column(Integer)
    next_emi_date = Column(Date)
    
    status = Column(Enum(LoanStatus), default=LoanStatus.PENDING_APPROVAL)
    
    # Approval workflow
    requested_date = Column(Date, default=date.today)
    approved_by = Column(String(36))
    approved_date = Column(Date)
    closed_date = Column(Date)
    
    reason = Column(Text)
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="loans")
    repayments = relationship("LoanRepayment", back_populates="loan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_loan_company", "company_id"),
        Index("idx_loan_employee", "employee_id"),
        Index("idx_loan_status", "status"),
    )

    def __repr__(self):
        return f"<EmployeeLoan {self.loan_number} - {self.principal_amount}>"


class LoanRepayment(Base):
    """Individual loan EMI repayment record."""
    __tablename__ = "loan_repayments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    loan_id = Column(String(36), ForeignKey("employee_loans.id", ondelete="CASCADE"), nullable=False)
    payroll_entry_id = Column(String(36), ForeignKey("payroll_entries.id", ondelete="SET NULL"))
    
    # Repayment details
    repayment_date = Column(Date, nullable=False)
    emi_number = Column(Integer, nullable=False)
    
    principal_component = Column(Numeric(14, 2), default=0)
    interest_component = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    
    balance_after = Column(Numeric(14, 2), default=0)
    
    # Payment tracking
    is_paid = Column(Boolean, default=False)
    payment_mode = Column(String(20))  # payroll_deduction, manual
    reference = Column(String(100))
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    loan = relationship("EmployeeLoan", back_populates="repayments")
    payroll_entry = relationship("PayrollEntry", back_populates="loan_repayments")

    __table_args__ = (
        Index("idx_repayment_loan", "loan_id"),
        Index("idx_repayment_date", "repayment_date"),
    )


class EmployeeTaxDeclaration(Base):
    """Employee tax declaration for TDS calculation (Section 80C, etc.)."""
    __tablename__ = "employee_tax_declarations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    financial_year = Column(String(9), nullable=False)  # e.g., "2024-2025"
    
    # Tax regime
    tax_regime = Column(Enum(TaxRegime), default=TaxRegime.NEW)
    
    # Section 80C (max 1.5L)
    sec_80c_ppf = Column(Numeric(14, 2), default=0)
    sec_80c_elss = Column(Numeric(14, 2), default=0)
    sec_80c_life_insurance = Column(Numeric(14, 2), default=0)
    sec_80c_nsc = Column(Numeric(14, 2), default=0)
    sec_80c_tuition_fees = Column(Numeric(14, 2), default=0)
    sec_80c_home_loan_principal = Column(Numeric(14, 2), default=0)
    sec_80c_others = Column(Numeric(14, 2), default=0)
    
    # Section 80CCD - NPS
    sec_80ccd_1b = Column(Numeric(14, 2), default=0)  # Additional 50K NPS
    
    # Section 80D - Medical Insurance
    sec_80d_self = Column(Numeric(14, 2), default=0)
    sec_80d_parents = Column(Numeric(14, 2), default=0)
    
    # Section 80E - Education Loan Interest
    sec_80e = Column(Numeric(14, 2), default=0)
    
    # Section 80G - Donations
    sec_80g = Column(Numeric(14, 2), default=0)
    
    # Section 80TTA/TTB - Savings Interest
    sec_80tta = Column(Numeric(14, 2), default=0)
    
    # House Rent
    hra_rent_paid_annual = Column(Numeric(14, 2), default=0)
    hra_metro_city = Column(Boolean, default=False)
    
    # Home Loan Interest (Section 24)
    home_loan_interest = Column(Numeric(14, 2), default=0)
    home_loan_is_self_occupied = Column(Boolean, default=True)
    
    # Other Income
    other_income = Column(Numeric(14, 2), default=0)
    previous_employer_income = Column(Numeric(14, 2), default=0)
    previous_employer_tds = Column(Numeric(14, 2), default=0)
    
    # Calculated values
    total_deductions = Column(Numeric(14, 2), default=0)
    taxable_income = Column(Numeric(14, 2), default=0)
    total_tax = Column(Numeric(14, 2), default=0)
    
    # Status
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(36))
    verified_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="tax_declarations")

    __table_args__ = (
        Index("idx_tax_dec_employee", "employee_id"),
        Index("idx_tax_dec_fy", "financial_year"),
    )


class ProfessionalTaxSlab(Base):
    """Professional Tax slabs by state."""
    __tablename__ = "professional_tax_slabs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    state_code = Column(String(2), nullable=False)  # State code (KA, MH, TN, etc.)
    state_name = Column(String(100))
    
    # Slab details
    from_amount = Column(Numeric(14, 2), nullable=False)
    to_amount = Column(Numeric(14, 2))  # NULL means no upper limit
    tax_amount = Column(Numeric(14, 2), nullable=False)
    
    # Special cases
    is_february_special = Column(Boolean, default=False)  # Some states have different Feb tax
    february_tax_amount = Column(Numeric(14, 2))
    
    is_active = Column(Boolean, default=True)
    effective_from = Column(Date)
    effective_to = Column(Date)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_pt_slab_company", "company_id"),
        Index("idx_pt_slab_state", "state_code"),
    )


class PayrollSettings(Base):
    """Company-wide payroll settings."""
    __tablename__ = "payroll_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # PF Settings
    pf_enabled = Column(Boolean, default=True)
    pf_contribution_rate = Column(Numeric(5, 2), default=Decimal("12"))  # Employee %
    pf_employer_rate = Column(Numeric(5, 2), default=Decimal("12"))
    pf_wage_ceiling = Column(Numeric(14, 2), default=Decimal("15000"))
    pf_include_basic_only = Column(Boolean, default=False)  # Basic only or Basic + DA
    pf_establishment_id = Column(String(50))
    
    # ESI Settings
    esi_enabled = Column(Boolean, default=True)
    esi_employee_rate = Column(Numeric(5, 2), default=Decimal("0.75"))
    esi_employer_rate = Column(Numeric(5, 2), default=Decimal("3.25"))
    esi_wage_ceiling = Column(Numeric(14, 2), default=Decimal("21000"))
    esi_establishment_id = Column(String(50))
    
    # PT Settings
    pt_enabled = Column(Boolean, default=True)
    pt_state = Column(String(2))  # Default state for PT
    
    # TDS Settings
    tds_enabled = Column(Boolean, default=True)
    default_tax_regime = Column(Enum(TaxRegime), default=TaxRegime.NEW)
    
    # Pay schedule
    pay_day = Column(Integer, default=1)  # Day of month for salary
    working_days_per_month = Column(Integer, default=30)
    
    # Payslip settings
    payslip_template = Column(String(100), default="default")
    show_ytd_in_payslip = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_payroll_settings_company", "company_id"),
    )


# ==================== ATTENDANCE & LEAVE MODELS ====================

class AttendanceStatus(str, PyEnum):
    """Attendance status enumeration."""
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    LEAVE = "leave"
    HOLIDAY = "holiday"
    WEEK_OFF = "week_off"
    ON_DUTY = "on_duty"


class Attendance(Base):
    """Daily attendance tracking."""
    __tablename__ = "attendance"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    
    attendance_date = Column(Date, nullable=False)
    status = Column(Enum(AttendanceStatus), nullable=False, default=AttendanceStatus.PRESENT)
    
    # Time tracking
    check_in = Column(DateTime)
    check_out = Column(DateTime)
    
    # Hours
    working_hours = Column(Numeric(5, 2), default=0)
    overtime_hours = Column(Numeric(5, 2), default=0)
    
    # Late/Early
    late_minutes = Column(Integer, default=0)
    early_leaving_minutes = Column(Integer, default=0)
    
    # Shift
    shift = Column(String(50))  # day, night, rotational
    
    # Leave reference
    leave_application_id = Column(String(36), ForeignKey("leave_applications.id", ondelete="SET NULL"))
    
    # Source
    source = Column(String(20), default="manual")  # manual, biometric, import
    biometric_id = Column(String(100))
    
    remarks = Column(Text)
    
    # Regularization
    is_regularized = Column(Boolean, default=False)
    regularized_by = Column(String(36))
    regularized_at = Column(DateTime)
    regularization_reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee")

    __table_args__ = (
        Index("idx_attendance_company", "company_id"),
        Index("idx_attendance_employee", "employee_id"),
        Index("idx_attendance_date", "attendance_date"),
        Index("idx_attendance_employee_date", "employee_id", "attendance_date", unique=True),
    )


class LeaveType(Base):
    """Leave types configuration (CL, EL, SL, etc.)."""
    __tablename__ = "leave_types"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(100), nullable=False)  # Casual Leave, Sick Leave
    code = Column(String(10), nullable=False)  # CL, SL, EL
    description = Column(Text)
    
    # Allocation
    days_per_year = Column(Numeric(5, 2), nullable=False)  # Annual entitlement
    
    # Carry forward
    carry_forward = Column(Boolean, default=False)
    max_carry_forward = Column(Numeric(5, 2))
    carry_forward_expiry_months = Column(Integer)  # Months after which carry forward expires
    
    # Encashment
    encashable = Column(Boolean, default=False)
    max_encashment = Column(Numeric(5, 2))
    
    # Rules
    min_days_per_application = Column(Numeric(5, 2), default=0.5)  # Half day minimum
    max_days_per_application = Column(Numeric(5, 2))
    advance_days_required = Column(Integer, default=0)  # Days before leave to apply
    
    # Accrual
    accrual_type = Column(String(20), default="yearly")  # yearly, monthly, quarterly
    
    # Eligibility
    probation_allowed = Column(Boolean, default=False)
    gender_specific = Column(String(10))  # male, female, or null for both
    
    # Impact on salary
    paid_leave = Column(Boolean, default=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_leave_type_company", "company_id"),
        Index("idx_leave_type_code", "company_id", "code", unique=True),
    )


class LeaveBalance(Base):
    """Leave balance per employee per year."""
    __tablename__ = "leave_balances"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(String(36), ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    
    financial_year = Column(String(9), nullable=False)  # 2024-2025
    
    # Balances
    opening_balance = Column(Numeric(5, 2), default=0)  # Carry forward from last year
    accrued = Column(Numeric(5, 2), default=0)  # Earned this year
    taken = Column(Numeric(5, 2), default=0)  # Used this year
    pending_approval = Column(Numeric(5, 2), default=0)  # In pending applications
    encashed = Column(Numeric(5, 2), default=0)  # Encashed
    lapsed = Column(Numeric(5, 2), default=0)  # Expired
    adjusted = Column(Numeric(5, 2), default=0)  # Manual adjustments
    closing_balance = Column(Numeric(5, 2), default=0)  # Available balance
    
    last_accrual_date = Column(Date)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee")
    leave_type = relationship("LeaveType")

    __table_args__ = (
        Index("idx_leave_balance_company", "company_id"),
        Index("idx_leave_balance_employee", "employee_id"),
        Index("idx_leave_balance_unique", "employee_id", "leave_type_id", "financial_year", unique=True),
    )


class LeaveApplicationStatus(str, PyEnum):
    """Leave application status."""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LeaveApplication(Base):
    """Leave application/request."""
    __tablename__ = "leave_applications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(String(36), ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    
    application_number = Column(String(50))
    application_date = Column(DateTime, default=datetime.utcnow)
    
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    
    # Days calculation
    total_days = Column(Numeric(5, 2), nullable=False)
    is_half_day = Column(Boolean, default=False)
    half_day_type = Column(String(10))  # first_half, second_half
    
    reason = Column(Text, nullable=False)
    
    # Contact during leave
    contact_number = Column(String(20))
    contact_address = Column(Text)
    
    # Handover
    handover_to = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    handover_notes = Column(Text)
    
    status = Column(Enum(LeaveApplicationStatus), default=LeaveApplicationStatus.PENDING)
    
    # Approval workflow
    approved_by = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    approved_at = Column(DateTime)
    approver_remarks = Column(Text)
    
    # Rejection
    rejected_by = Column(String(36))
    rejected_at = Column(DateTime)
    rejection_reason = Column(Text)
    
    # Cancellation
    cancelled_by = Column(String(36))
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType")

    __table_args__ = (
        Index("idx_leave_app_company", "company_id"),
        Index("idx_leave_app_employee", "employee_id"),
        Index("idx_leave_app_date", "from_date", "to_date"),
        Index("idx_leave_app_status", "status"),
    )


class OvertimeRule(Base):
    """Overtime rate configuration."""
    __tablename__ = "overtime_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Rate multipliers
    weekday_rate = Column(Numeric(5, 2), default=Decimal("1.5"))  # 1.5x normal
    weekend_rate = Column(Numeric(5, 2), default=Decimal("2.0"))  # 2x normal
    holiday_rate = Column(Numeric(5, 2), default=Decimal("2.0"))  # 2x normal
    night_rate = Column(Numeric(5, 2), default=Decimal("1.5"))  # Night shift premium
    
    # Calculation basis
    calculation_basis = Column(String(20), default="hourly")  # hourly, daily
    
    # Minimum hours to qualify
    min_ot_hours = Column(Numeric(5, 2), default=0)
    
    # Maximum limits
    max_daily_ot_hours = Column(Numeric(5, 2))
    max_weekly_ot_hours = Column(Numeric(5, 2))
    max_monthly_ot_hours = Column(Numeric(5, 2))
    
    # Approval required
    approval_required = Column(Boolean, default=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_ot_rule_company", "company_id"),
    )


class Holiday(Base):
    """Company holidays."""
    __tablename__ = "holidays"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    
    holiday_type = Column(String(20), default="national")  # national, state, restricted, optional
    
    # Applicable to
    applicable_to_all = Column(Boolean, default=True)
    applicable_states = Column(JSON)  # List of state codes
    applicable_departments = Column(JSON)  # List of department IDs
    
    is_paid = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_holiday_company", "company_id"),
        Index("idx_holiday_date", "date"),
    )
