"""
Attendance Service - Employee attendance and overtime tracking.

Features:
- Daily attendance marking
- Late/early tracking
- Overtime calculation
- Attendance reports
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.payroll_models import (
    Attendance, AttendanceStatus, Employee, OvertimeRule, Holiday
)
from app.database.models import generate_uuid


class AttendanceService:
    """Service for attendance management."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def mark_attendance(
        self,
        company_id: str,
        employee_id: str,
        attendance_date: date,
        status: AttendanceStatus = AttendanceStatus.PRESENT,
        check_in: datetime = None,
        check_out: datetime = None,
        shift: str = None,
        remarks: str = None,
    ) -> Attendance:
        """Mark attendance for an employee."""
        # Check for existing entry
        existing = self.db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date == attendance_date,
        ).first()
        
        if existing:
            # Update existing
            existing.status = status
            existing.check_in = check_in or existing.check_in
            existing.check_out = check_out or existing.check_out
            existing.shift = shift or existing.shift
            existing.remarks = remarks
            
            self._calculate_hours(existing)
            
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        # Create new
        attendance = Attendance(
            id=generate_uuid(),
            company_id=company_id,
            employee_id=employee_id,
            attendance_date=attendance_date,
            status=status,
            check_in=check_in,
            check_out=check_out,
            shift=shift or 'day',
            remarks=remarks,
            source='manual',
        )
        
        self._calculate_hours(attendance)
        
        self.db.add(attendance)
        self.db.commit()
        self.db.refresh(attendance)
        
        return attendance
    
    def _calculate_hours(self, attendance: Attendance):
        """Calculate working hours and overtime."""
        if attendance.check_in and attendance.check_out:
            duration = attendance.check_out - attendance.check_in
            hours = duration.total_seconds() / 3600
            
            attendance.working_hours = Decimal(str(min(hours, 12)))  # Cap at 12
            
            # Calculate overtime (assuming 8 hour standard)
            if hours > 8:
                attendance.overtime_hours = Decimal(str(hours - 8))
            else:
                attendance.overtime_hours = Decimal('0')
        else:
            if attendance.status == AttendanceStatus.PRESENT:
                attendance.working_hours = Decimal('8')
            elif attendance.status == AttendanceStatus.HALF_DAY:
                attendance.working_hours = Decimal('4')
            else:
                attendance.working_hours = Decimal('0')
            
            attendance.overtime_hours = Decimal('0')
    
    def bulk_mark_attendance(
        self,
        company_id: str,
        attendance_date: date,
        employee_statuses: List[Dict],
    ) -> List[Attendance]:
        """Mark attendance for multiple employees."""
        results = []
        
        for entry in employee_statuses:
            attendance = self.mark_attendance(
                company_id=company_id,
                employee_id=entry['employee_id'],
                attendance_date=attendance_date,
                status=AttendanceStatus(entry.get('status', 'present')),
                check_in=entry.get('check_in'),
                check_out=entry.get('check_out'),
                remarks=entry.get('remarks'),
            )
            results.append(attendance)
        
        return results
    
    def get_attendance(
        self,
        employee_id: str,
        attendance_date: date,
    ) -> Optional[Attendance]:
        return self.db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date == attendance_date,
        ).first()
    
    def get_monthly_attendance(
        self,
        company_id: str,
        employee_id: str,
        month: int,
        year: int,
    ) -> List[Attendance]:
        """Get attendance for a month."""
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        return self.db.query(Attendance).filter(
            Attendance.company_id == company_id,
            Attendance.employee_id == employee_id,
            Attendance.attendance_date >= start_date,
            Attendance.attendance_date <= end_date,
        ).order_by(Attendance.attendance_date.asc()).all()
    
    def get_attendance_summary(
        self,
        company_id: str,
        employee_id: str,
        month: int,
        year: int,
    ) -> Dict:
        """Get attendance summary for a month."""
        records = self.get_monthly_attendance(company_id, employee_id, month, year)
        
        summary = {
            'employee_id': employee_id,
            'month': month,
            'year': year,
            'total_days': 0,
            'present': 0,
            'absent': 0,
            'half_day': 0,
            'leave': 0,
            'holiday': 0,
            'week_off': 0,
            'total_working_hours': Decimal('0'),
            'total_overtime_hours': Decimal('0'),
            'late_count': 0,
            'early_leaving_count': 0,
        }
        
        for record in records:
            summary['total_days'] += 1
            
            if record.status == AttendanceStatus.PRESENT:
                summary['present'] += 1
            elif record.status == AttendanceStatus.ABSENT:
                summary['absent'] += 1
            elif record.status == AttendanceStatus.HALF_DAY:
                summary['half_day'] += 1
            elif record.status == AttendanceStatus.LEAVE:
                summary['leave'] += 1
            elif record.status == AttendanceStatus.HOLIDAY:
                summary['holiday'] += 1
            elif record.status == AttendanceStatus.WEEK_OFF:
                summary['week_off'] += 1
            
            summary['total_working_hours'] += record.working_hours or Decimal('0')
            summary['total_overtime_hours'] += record.overtime_hours or Decimal('0')
            
            if record.late_minutes and record.late_minutes > 0:
                summary['late_count'] += 1
            
            if record.early_leaving_minutes and record.early_leaving_minutes > 0:
                summary['early_leaving_count'] += 1
        
        summary['total_working_hours'] = float(summary['total_working_hours'])
        summary['total_overtime_hours'] = float(summary['total_overtime_hours'])
        summary['effective_days'] = summary['present'] + summary['half_day'] * 0.5
        
        return summary
    
    def get_department_attendance(
        self,
        company_id: str,
        department_id: str,
        attendance_date: date,
    ) -> List[Dict]:
        """Get attendance for all employees in a department."""
        from app.database.payroll_models import Employee
        
        employees = self.db.query(Employee).filter(
            Employee.company_id == company_id,
            Employee.department_id == department_id,
            Employee.status == 'active',
        ).all()
        
        result = []
        for emp in employees:
            attendance = self.get_attendance(emp.id, attendance_date)
            
            result.append({
                'employee_id': emp.id,
                'employee_name': f"{emp.first_name} {emp.last_name}",
                'employee_code': emp.employee_code,
                'status': attendance.status.value if attendance else None,
                'check_in': attendance.check_in.isoformat() if attendance and attendance.check_in else None,
                'check_out': attendance.check_out.isoformat() if attendance and attendance.check_out else None,
                'working_hours': float(attendance.working_hours) if attendance else 0,
            })
        
        return result
    
    def regularize_attendance(
        self,
        attendance_id: str,
        new_status: AttendanceStatus,
        reason: str,
        regularized_by: str,
    ) -> Attendance:
        """Regularize attendance with approval."""
        attendance = self.db.query(Attendance).filter(
            Attendance.id == attendance_id
        ).first()
        
        if not attendance:
            raise ValueError("Attendance record not found")
        
        attendance.status = new_status
        attendance.is_regularized = True
        attendance.regularized_by = regularized_by
        attendance.regularized_at = datetime.utcnow()
        attendance.regularization_reason = reason
        
        self._calculate_hours(attendance)
        
        self.db.commit()
        self.db.refresh(attendance)
        
        return attendance
    
    def calculate_overtime_pay(
        self,
        company_id: str,
        employee_id: str,
        month: int,
        year: int,
    ) -> Dict:
        """Calculate overtime pay for a month."""
        # Get overtime rule
        ot_rule = self.db.query(OvertimeRule).filter(
            OvertimeRule.company_id == company_id,
            OvertimeRule.is_active == True,
        ).first()
        
        if not ot_rule:
            return {'overtime_hours': 0, 'overtime_pay': 0}
        
        # Get employee for hourly rate calculation
        employee = self.db.query(Employee).filter(
            Employee.id == employee_id
        ).first()
        
        if not employee:
            return {'overtime_hours': 0, 'overtime_pay': 0}
        
        # Calculate hourly rate (monthly CTC / 30 days / 8 hours)
        ctc = employee.ctc or Decimal('0')
        hourly_rate = ctc / 30 / 8
        
        # Get attendance with overtime
        summary = self.get_attendance_summary(company_id, employee_id, month, year)
        total_ot = Decimal(str(summary['total_overtime_hours']))
        
        # Apply rate multiplier (simplified - using weekday rate)
        ot_pay = total_ot * hourly_rate * ot_rule.weekday_rate
        
        return {
            'overtime_hours': float(total_ot),
            'hourly_rate': float(hourly_rate),
            'multiplier': float(ot_rule.weekday_rate),
            'overtime_pay': float(ot_pay.quantize(Decimal('0.01'))),
        }
