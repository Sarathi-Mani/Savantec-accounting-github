"""
Attendance and Leave Management API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import User, Company, generate_uuid
from app.database.payroll_models import (
    Employee, EmployeeStatus, Attendance, AttendanceStatus,
    LeaveType, LeaveBalance, LeaveApplication, LeaveApplicationStatus
)
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/payroll", tags=["Attendance & Leave"])


def get_company_or_404(company_id: str, user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ==================== ATTENDANCE SCHEMAS ====================

class AttendanceMark(BaseModel):
    employee_id: str
    attendance_date: date
    status: str = "present"
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    working_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    notes: Optional[str] = None


class BulkAttendanceMark(BaseModel):
    attendance_date: date
    records: List[dict]


# ==================== ATTENDANCE ENDPOINTS ====================

@router.get("/attendance")
async def list_attendance(
    company_id: str,
    employee_id: Optional[str] = None,
    date: Optional[date] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List attendance records."""
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(Attendance).filter(Attendance.company_id == company_id)
    
    if employee_id:
        query = query.filter(Attendance.employee_id == employee_id)
    
    if date:
        query = query.filter(Attendance.attendance_date == date)
    elif month and year:
        from sqlalchemy import extract
        query = query.filter(
            extract('month', Attendance.attendance_date) == month,
            extract('year', Attendance.attendance_date) == year
        )
    
    records = query.order_by(Attendance.attendance_date.desc()).limit(500).all()
    
    result = []
    for r in records:
        employee = db.query(Employee).filter(Employee.id == r.employee_id).first()
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name or ''}" if employee else "Unknown",
            "attendance_date": r.attendance_date.isoformat() if r.attendance_date else None,
            "status": r.status.value if r.status else "present",
            "check_in_time": r.check_in_time.isoformat() if r.check_in_time else None,
            "check_out_time": r.check_out_time.isoformat() if r.check_out_time else None,
            "working_hours": float(r.working_hours) if r.working_hours else None,
            "overtime_hours": float(r.overtime_hours) if r.overtime_hours else None,
        })
    
    return result


@router.post("/attendance")
async def mark_attendance(
    company_id: str,
    data: AttendanceMark,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark attendance for an employee."""
    get_company_or_404(company_id, current_user, db)
    
    # Check if attendance already exists
    existing = db.query(Attendance).filter(
        Attendance.company_id == company_id,
        Attendance.employee_id == data.employee_id,
        Attendance.attendance_date == data.attendance_date
    ).first()
    
    try:
        status_enum = AttendanceStatus(data.status)
    except ValueError:
        status_enum = AttendanceStatus.PRESENT
    
    if existing:
        # Update existing
        existing.status = status_enum
        existing.working_hours = Decimal(str(data.working_hours)) if data.working_hours else None
        existing.overtime_hours = Decimal(str(data.overtime_hours)) if data.overtime_hours else None
        existing.notes = data.notes
        db.commit()
        return {"id": existing.id, "updated": True}
    else:
        # Create new
        attendance = Attendance(
            id=generate_uuid(),
            company_id=company_id,
            employee_id=data.employee_id,
            attendance_date=data.attendance_date,
            status=status_enum,
            working_hours=Decimal(str(data.working_hours)) if data.working_hours else None,
            overtime_hours=Decimal(str(data.overtime_hours)) if data.overtime_hours else None,
            notes=data.notes,
        )
        db.add(attendance)
        db.commit()
        return {"id": attendance.id, "created": True}


@router.post("/attendance/bulk")
async def bulk_mark_attendance(
    company_id: str,
    data: BulkAttendanceMark,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark attendance for multiple employees."""
    get_company_or_404(company_id, current_user, db)
    
    created = 0
    updated = 0
    
    for record in data.records:
        employee_id = record.get("employee_id")
        status = record.get("status", "present")
        
        if not employee_id:
            continue
        
        try:
            status_enum = AttendanceStatus(status)
        except ValueError:
            status_enum = AttendanceStatus.PRESENT
        
        existing = db.query(Attendance).filter(
            Attendance.company_id == company_id,
            Attendance.employee_id == employee_id,
            Attendance.attendance_date == data.attendance_date
        ).first()
        
        if existing:
            existing.status = status_enum
            updated += 1
        else:
            attendance = Attendance(
                id=generate_uuid(),
                company_id=company_id,
                employee_id=employee_id,
                attendance_date=data.attendance_date,
                status=status_enum,
            )
            db.add(attendance)
            created += 1
    
    db.commit()
    
    return {"created": created, "updated": updated}


@router.get("/attendance/summary/{employee_id}/{month}/{year}")
async def attendance_summary(
    company_id: str,
    employee_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get attendance summary for an employee."""
    get_company_or_404(company_id, current_user, db)
    
    from sqlalchemy import extract
    
    records = db.query(Attendance).filter(
        Attendance.company_id == company_id,
        Attendance.employee_id == employee_id,
        extract('month', Attendance.attendance_date) == month,
        extract('year', Attendance.attendance_date) == year
    ).all()
    
    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    half_day = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
    leave = sum(1 for r in records if r.status == AttendanceStatus.LEAVE)
    
    # Calculate working days in month
    import calendar
    _, total_days = calendar.monthrange(year, month)
    
    # Subtract weekends (basic calculation)
    working_days = sum(1 for day in range(1, total_days + 1) 
                       if date(year, month, day).weekday() < 5)
    
    return {
        "employee_id": employee_id,
        "month": month,
        "year": year,
        "total_working_days": working_days,
        "present": present,
        "absent": absent,
        "half_day": half_day,
        "leave": leave,
        "attendance_percentage": round((present + half_day * 0.5) / working_days * 100, 2) if working_days > 0 else 0,
    }


@router.get("/attendance/report")
async def attendance_report(
    company_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get attendance report for all employees."""
    get_company_or_404(company_id, current_user, db)
    
    from sqlalchemy import extract
    import calendar
    
    employees = db.query(Employee).filter(
        Employee.company_id == company_id,
        Employee.status == EmployeeStatus.ACTIVE
    ).all()
    
    _, total_days = calendar.monthrange(year, month)
    working_days = sum(1 for day in range(1, total_days + 1) 
                       if date(year, month, day).weekday() < 5)
    
    result = []
    for emp in employees:
        records = db.query(Attendance).filter(
            Attendance.company_id == company_id,
            Attendance.employee_id == emp.id,
            extract('month', Attendance.attendance_date) == month,
            extract('year', Attendance.attendance_date) == year
        ).all()
        
        present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
        absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
        half_day = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
        leave = sum(1 for r in records if r.status == AttendanceStatus.LEAVE)
        
        result.append({
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "employee_name": f"{emp.first_name} {emp.last_name or ''}",
            "present": present,
            "absent": absent,
            "half_day": half_day,
            "leave": leave,
            "working_days": working_days,
            "attendance_percentage": round((present + half_day * 0.5) / working_days * 100, 2) if working_days > 0 else 0,
        })
    
    return {"employees": result, "month": month, "year": year, "working_days": working_days}


@router.get("/attendance/summary")
async def attendance_summary_alias(
    company_id: str,
    month: int,
    year: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get attendance summary for all employees (alias for frontend)."""
    get_company_or_404(company_id, current_user, db)
    
    from sqlalchemy import extract
    import calendar
    
    employees = db.query(Employee).filter(
        Employee.company_id == company_id,
        Employee.status == EmployeeStatus.ACTIVE
    ).all()
    
    _, total_days = calendar.monthrange(year, month)
    working_days = sum(1 for day in range(1, total_days + 1) 
                       if date(year, month, day).weekday() < 5)
    
    result = []
    for emp in employees:
        records = db.query(Attendance).filter(
            Attendance.company_id == company_id,
            Attendance.employee_id == emp.id,
            extract('month', Attendance.attendance_date) == month,
            extract('year', Attendance.attendance_date) == year
        ).all()
        
        present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
        absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
        half_day = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
        leave = sum(1 for r in records if r.status == AttendanceStatus.LEAVE)
        
        attendance_percent = round((present + half_day * 0.5) / working_days * 100, 2) if working_days > 0 else 0
        
        result.append({
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "employee_name": f"{emp.first_name} {emp.last_name or ''}".strip(),
            "present_days": present,
            "absent_days": absent,
            "half_days": half_day,
            "leave_days": leave,
            "working_days": working_days,
            "attendance_percent": attendance_percent,
        })
    
    return result


# ==================== LEAVE TYPE SCHEMAS ====================

class LeaveTypeCreate(BaseModel):
    name: str
    code: str
    days_per_year: float
    is_paid: bool = True
    carry_forward: bool = False  # Match model field name
    max_carry_forward: Optional[float] = None  # Match model field name
    description: Optional[str] = None


# ==================== LEAVE TYPE ENDPOINTS ====================

@router.get("/leaves/types")
async def list_leave_types(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all leave types."""
    get_company_or_404(company_id, current_user, db)
    
    types = db.query(LeaveType).filter(
        LeaveType.company_id == company_id,
        LeaveType.is_active == True
    ).all()
    
    return [{
        "id": t.id,
        "name": t.name,
        "code": t.code,
        "days_per_year": float(t.days_per_year) if t.days_per_year else 0,
        "is_paid": t.paid_leave if hasattr(t, 'paid_leave') else True,  # Map paid_leave to is_paid for frontend
        "carry_forward": t.carry_forward if hasattr(t, 'carry_forward') else False,
        "max_carry_forward": float(t.max_carry_forward) if hasattr(t, 'max_carry_forward') and t.max_carry_forward else 0,
        "is_active": t.is_active if hasattr(t, 'is_active') else True,
        "description": t.description,
    } for t in types]


@router.post("/leaves/types")
async def create_leave_type(
    company_id: str,
    data: LeaveTypeCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new leave type."""
    get_company_or_404(company_id, current_user, db)
    
    leave_type = LeaveType(
        id=generate_uuid(),
        company_id=company_id,
        name=data.name,
        code=data.code,
        days_per_year=Decimal(str(data.days_per_year)),
        paid_leave=data.is_paid,  # Model uses paid_leave, not is_paid
        carry_forward=data.carry_forward,
        max_carry_forward=Decimal(str(data.max_carry_forward)) if data.max_carry_forward else None,
        description=data.description,
    )
    
    db.add(leave_type)
    db.commit()
    
    return {"id": leave_type.id}


# Alias endpoints to match frontend expectations
@router.get("/leave-types")
async def list_leave_types_alias(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all leave types (alias for /leaves/types)."""
    return await list_leave_types(company_id, current_user, db)


@router.post("/leave-types")
async def create_leave_type_alias(
    company_id: str,
    data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new leave type (alias for /leaves/types)."""
    # Map frontend field names to backend field names
    leave_type_data = LeaveTypeCreate(
        name=data.get("name", ""),
        code=data.get("code", ""),
        days_per_year=data.get("days_per_year", 0),
        is_paid=data.get("is_paid", True),
        carry_forward=data.get("carry_forward", False),
        max_carry_forward=data.get("max_carry_forward"),
        description=data.get("description"),
    )
    return await create_leave_type(company_id, leave_type_data, current_user, db)


# ==================== LEAVE BALANCE ENDPOINTS ====================

@router.get("/leaves/balances")
async def list_leave_balances(
    company_id: str,
    employee_id: Optional[str] = None,
    financial_year: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List leave balances."""
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(LeaveBalance).filter(LeaveBalance.company_id == company_id)
    
    if employee_id:
        query = query.filter(LeaveBalance.employee_id == employee_id)
    
    if financial_year:
        query = query.filter(LeaveBalance.financial_year == financial_year)
    
    balances = query.all()
    
    result = []
    for b in balances:
        employee = db.query(Employee).filter(Employee.id == b.employee_id).first()
        leave_type = db.query(LeaveType).filter(LeaveType.id == b.leave_type_id).first()
        
        result.append({
            "id": b.id,
            "employee_id": b.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name or ''}" if employee else "Unknown",
            "leave_type_id": b.leave_type_id,
            "leave_type_name": leave_type.name if leave_type else "Unknown",
            "financial_year": b.financial_year,
            "opening_balance": float(b.opening_balance) if b.opening_balance else 0,
            "accrued": float(b.accrued) if b.accrued else 0,
            "used": float(b.used) if b.used else 0,
            "available": float((b.opening_balance or 0) + (b.accrued or 0) - (b.used or 0)),
        })
    
    return result


# Alias endpoint for frontend compatibility
@router.get("/leave-balances")
async def list_leave_balances_alias(
    company_id: str,
    employee_id: Optional[str] = None,
    financial_year: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List leave balances (alias for /leaves/balances)."""
    return await list_leave_balances(company_id, employee_id, financial_year, current_user, db)


@router.post("/leaves/balances/initialize")
async def initialize_leave_balances(
    company_id: str,
    financial_year: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Initialize leave balances for all employees for a financial year."""
    get_company_or_404(company_id, current_user, db)
    
    employees = db.query(Employee).filter(
        Employee.company_id == company_id,
        Employee.status == EmployeeStatus.ACTIVE
    ).all()
    
    leave_types = db.query(LeaveType).filter(
        LeaveType.company_id == company_id,
        LeaveType.is_active == True
    ).all()
    
    created = 0
    for emp in employees:
        for lt in leave_types:
            # Check if balance already exists
            existing = db.query(LeaveBalance).filter(
                LeaveBalance.company_id == company_id,
                LeaveBalance.employee_id == emp.id,
                LeaveBalance.leave_type_id == lt.id,
                LeaveBalance.financial_year == financial_year
            ).first()
            
            if not existing:
                balance = LeaveBalance(
                    id=generate_uuid(),
                    company_id=company_id,
                    employee_id=emp.id,
                    leave_type_id=lt.id,
                    financial_year=financial_year,
                    opening_balance=Decimal("0"),
                    accrued=lt.days_per_year or Decimal("0"),
                    used=Decimal("0"),
                )
                db.add(balance)
                created += 1
    
    db.commit()
    
    return {"created": created}


# ==================== LEAVE APPLICATION SCHEMAS ====================

class LeaveApplicationCreate(BaseModel):
    employee_id: str
    leave_type_id: str
    from_date: date
    to_date: date
    reason: str
    is_half_day: bool = False


# ==================== LEAVE APPLICATION ENDPOINTS ====================

@router.get("/leaves/applications")
async def list_leave_applications(
    company_id: str,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List leave applications."""
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(LeaveApplication).filter(LeaveApplication.company_id == company_id)
    
    if employee_id:
        query = query.filter(LeaveApplication.employee_id == employee_id)
    
    if status:
        try:
            if status.lower() == "all":
                pass  # Don't filter
            else:
                query = query.filter(LeaveApplication.status == LeaveApplicationStatus(status))
        except ValueError:
            pass
    
    applications = query.order_by(LeaveApplication.created_at.desc()).limit(100).all()
    
    result = []
    for a in applications:
        employee = db.query(Employee).filter(Employee.id == a.employee_id).first()
        leave_type = db.query(LeaveType).filter(LeaveType.id == a.leave_type_id).first()
        
        result.append({
            "id": a.id,
            "employee_id": a.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name or ''}" if employee else "Unknown",
            "leave_type_id": a.leave_type_id,
            "leave_type": leave_type.name if leave_type else "Unknown",
            "leave_type_name": leave_type.name if leave_type else "Unknown",
            "from_date": a.from_date.isoformat() if a.from_date else None,
            "to_date": a.to_date.isoformat() if a.to_date else None,
            "days": float(a.days) if a.days else 0,
            "reason": a.reason,
            "status": a.status.value if a.status else "pending",
            "applied_on": a.created_at.isoformat() if a.created_at else None,
            "approved_by": a.approved_by,
            "rejection_reason": a.rejection_reason,
        })
    
    return result


# Alias endpoint for frontend compatibility
@router.get("/leave-applications")
async def list_leave_applications_alias(
    company_id: str,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List leave applications (alias for /leaves/applications)."""
    return await list_leave_applications(company_id, employee_id, status, current_user, db)


@router.post("/leaves/applications")
async def create_leave_application(
    company_id: str,
    data: LeaveApplicationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new leave application."""
    get_company_or_404(company_id, current_user, db)
    
    # Calculate days
    days = (data.to_date - data.from_date).days + 1
    if data.is_half_day:
        days = Decimal("0.5")
    
    application = LeaveApplication(
        id=generate_uuid(),
        company_id=company_id,
        employee_id=data.employee_id,
        leave_type_id=data.leave_type_id,
        from_date=data.from_date,
        to_date=data.to_date,
        days=Decimal(str(days)),
        reason=data.reason,
        is_half_day=data.is_half_day,
        status=LeaveApplicationStatus.PENDING,
    )
    
    db.add(application)
    db.commit()
    
    return {"id": application.id}


@router.post("/leaves/applications/{application_id}/approve")
async def approve_leave_application(
    company_id: str,
    application_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Approve a leave application."""
    get_company_or_404(company_id, current_user, db)
    
    application = db.query(LeaveApplication).filter(
        LeaveApplication.id == application_id,
        LeaveApplication.company_id == company_id
    ).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    application.status = LeaveApplicationStatus.APPROVED
    application.approved_by = current_user.id
    application.approved_at = datetime.utcnow()
    
    # Update leave balance
    # Get current financial year
    today = date.today()
    if today.month >= 4:
        fy = f"{today.year}-{today.year + 1}"
    else:
        fy = f"{today.year - 1}-{today.year}"
    
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.company_id == company_id,
        LeaveBalance.employee_id == application.employee_id,
        LeaveBalance.leave_type_id == application.leave_type_id,
        LeaveBalance.financial_year == fy
    ).first()
    
    if balance:
        balance.used = (balance.used or Decimal("0")) + (application.days or Decimal("0"))
    
    db.commit()
    
    return {"status": "approved"}


@router.post("/leaves/applications/{application_id}/reject")
async def reject_leave_application(
    company_id: str,
    application_id: str,
    reason: str = "",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reject a leave application."""
    get_company_or_404(company_id, current_user, db)
    
    application = db.query(LeaveApplication).filter(
        LeaveApplication.id == application_id,
        LeaveApplication.company_id == company_id
    ).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    application.status = LeaveApplicationStatus.REJECTED
    application.rejection_reason = reason
    application.rejected_by = current_user.id
    
    db.commit()
    
    return {"status": "rejected"}


# Alias endpoints for frontend compatibility
@router.post("/leave-applications/{application_id}/{action}")
async def leave_application_action_alias(
    company_id: str,
    application_id: str,
    action: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Approve or reject leave application (alias endpoint)."""
    if action == "approve":
        return await approve_leave_application(company_id, application_id, current_user, db)
    elif action == "reject":
        return await reject_leave_application(company_id, application_id, "", current_user, db)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")


# ==================== FORM 16 ====================

@router.get("/form16/{employee_id}/{financial_year}")
async def generate_form16(
    company_id: str,
    employee_id: str,
    financial_year: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate Form 16 data for an employee."""
    get_company_or_404(company_id, current_user, db)
    
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.company_id == company_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Return Form 16 structure (simplified)
    return {
        "financial_year": financial_year,
        "employee": {
            "name": f"{employee.first_name} {employee.last_name or ''}",
            "pan": employee.pan,
            "employee_code": employee.employee_code,
        },
        "part_a": {
            "gross_salary": 0,  # Would calculate from payroll entries
            "section_16_deductions": 0,
            "net_taxable_salary": 0,
        },
        "part_b": {
            "gross_total_income": 0,
            "chapter_vi_deductions": 0,
            "total_taxable_income": 0,
            "tax_on_total_income": 0,
            "rebate_87a": 0,
            "surcharge": 0,
            "cess": 0,
            "total_tax_payable": 0,
            "tax_deducted": 0,
        },
        "message": "Form 16 data - full implementation requires payroll history",
    }

