"""
Leave Management Service - Employee leave tracking.

Features:
- Leave type configuration
- Leave balance management
- Leave applications and approvals
- Leave reports
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.payroll_models import (
    LeaveType, LeaveBalance, LeaveApplication, LeaveApplicationStatus,
    Employee, Attendance, AttendanceStatus
)
from app.database.models import generate_uuid


class LeaveService:
    """Service for leave management."""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ==================== LEAVE TYPE MANAGEMENT ====================
    
    def create_leave_type(
        self,
        company_id: str,
        name: str,
        code: str,
        days_per_year: Decimal,
        **kwargs,
    ) -> LeaveType:
        """Create a new leave type."""
        leave_type = LeaveType(
            id=generate_uuid(),
            company_id=company_id,
            name=name,
            code=code,
            days_per_year=days_per_year,
            description=kwargs.get('description'),
            carry_forward=kwargs.get('carry_forward', False),
            max_carry_forward=kwargs.get('max_carry_forward'),
            encashable=kwargs.get('encashable', False),
            max_encashment=kwargs.get('max_encashment'),
            min_days_per_application=kwargs.get('min_days_per_application', Decimal('0.5')),
            max_days_per_application=kwargs.get('max_days_per_application'),
            advance_days_required=kwargs.get('advance_days_required', 0),
            accrual_type=kwargs.get('accrual_type', 'yearly'),
            probation_allowed=kwargs.get('probation_allowed', False),
            paid_leave=kwargs.get('paid_leave', True),
            is_active=True,
        )
        
        self.db.add(leave_type)
        self.db.commit()
        self.db.refresh(leave_type)
        
        return leave_type
    
    def get_leave_types(self, company_id: str, active_only: bool = True) -> List[LeaveType]:
        query = self.db.query(LeaveType).filter(LeaveType.company_id == company_id)
        
        if active_only:
            query = query.filter(LeaveType.is_active == True)
        
        return query.order_by(LeaveType.name.asc()).all()
    
    # ==================== LEAVE BALANCE MANAGEMENT ====================
    
    def initialize_balance(
        self,
        company_id: str,
        employee_id: str,
        leave_type_id: str,
        financial_year: str,
        opening_balance: Decimal = Decimal('0'),
    ) -> LeaveBalance:
        """Initialize leave balance for an employee."""
        leave_type = self.db.query(LeaveType).filter(
            LeaveType.id == leave_type_id
        ).first()
        
        if not leave_type:
            raise ValueError("Leave type not found")
        
        # Check if already exists
        existing = self.db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.financial_year == financial_year,
        ).first()
        
        if existing:
            return existing
        
        # Calculate initial accrued (yearly allocation)
        accrued = leave_type.days_per_year if leave_type.accrual_type == 'yearly' else Decimal('0')
        
        balance = LeaveBalance(
            id=generate_uuid(),
            company_id=company_id,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            financial_year=financial_year,
            opening_balance=opening_balance,
            accrued=accrued,
            taken=Decimal('0'),
            pending_approval=Decimal('0'),
            closing_balance=opening_balance + accrued,
        )
        
        self.db.add(balance)
        self.db.commit()
        self.db.refresh(balance)
        
        return balance
    
    def get_balance(
        self,
        employee_id: str,
        leave_type_id: str,
        financial_year: str,
    ) -> Optional[LeaveBalance]:
        return self.db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.financial_year == financial_year,
        ).first()
    
    def get_employee_balances(
        self,
        company_id: str,
        employee_id: str,
        financial_year: str,
    ) -> List[LeaveBalance]:
        return self.db.query(LeaveBalance).filter(
            LeaveBalance.company_id == company_id,
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.financial_year == financial_year,
        ).all()
    
    def _update_balance(
        self,
        employee_id: str,
        leave_type_id: str,
        financial_year: str,
        days: Decimal,
        action: str,  # 'apply', 'approve', 'reject', 'cancel'
    ):
        """Update leave balance based on action."""
        balance = self.get_balance(employee_id, leave_type_id, financial_year)
        
        if not balance:
            return
        
        if action == 'apply':
            balance.pending_approval += days
        elif action == 'approve':
            balance.pending_approval -= days
            balance.taken += days
        elif action == 'reject':
            balance.pending_approval -= days
        elif action == 'cancel':
            balance.taken -= days
        
        balance.closing_balance = balance.opening_balance + balance.accrued - balance.taken - balance.pending_approval
    
    # ==================== LEAVE APPLICATION ====================
    
    def apply_leave(
        self,
        company_id: str,
        employee_id: str,
        leave_type_id: str,
        from_date: date,
        to_date: date,
        reason: str,
        is_half_day: bool = False,
        half_day_type: str = None,
        contact_number: str = None,
        handover_to: str = None,
    ) -> LeaveApplication:
        """Submit a leave application."""
        leave_type = self.db.query(LeaveType).filter(
            LeaveType.id == leave_type_id
        ).first()
        
        if not leave_type:
            raise ValueError("Leave type not found")
        
        # Calculate total days
        if is_half_day:
            total_days = Decimal('0.5')
        else:
            total_days = Decimal(str((to_date - from_date).days + 1))
        
        # Validate days
        if leave_type.min_days_per_application and total_days < leave_type.min_days_per_application:
            raise ValueError(f"Minimum {leave_type.min_days_per_application} days required")
        
        if leave_type.max_days_per_application and total_days > leave_type.max_days_per_application:
            raise ValueError(f"Maximum {leave_type.max_days_per_application} days allowed")
        
        # Check balance
        fy = self._get_financial_year(from_date)
        balance = self.get_balance(employee_id, leave_type_id, fy)
        
        if balance and balance.closing_balance < total_days:
            raise ValueError(f"Insufficient leave balance. Available: {balance.closing_balance}")
        
        # Generate application number
        count = self.db.query(LeaveApplication).filter(
            LeaveApplication.company_id == company_id
        ).count()
        
        application = LeaveApplication(
            id=generate_uuid(),
            company_id=company_id,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            application_number=f"LV-{count + 1:05d}",
            application_date=datetime.utcnow(),
            from_date=from_date,
            to_date=to_date,
            total_days=total_days,
            is_half_day=is_half_day,
            half_day_type=half_day_type,
            reason=reason,
            contact_number=contact_number,
            handover_to=handover_to,
            status=LeaveApplicationStatus.PENDING,
        )
        
        self.db.add(application)
        
        # Update balance
        self._update_balance(employee_id, leave_type_id, fy, total_days, 'apply')
        
        self.db.commit()
        self.db.refresh(application)
        
        return application
    
    def _get_financial_year(self, d: date) -> str:
        """Get financial year for a date."""
        if d.month >= 4:
            return f"{d.year}-{d.year + 1}"
        else:
            return f"{d.year - 1}-{d.year}"
    
    def approve_leave(
        self,
        application_id: str,
        approved_by: str,
        remarks: str = None,
    ) -> LeaveApplication:
        """Approve a leave application."""
        application = self.db.query(LeaveApplication).filter(
            LeaveApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError("Application not found")
        
        if application.status != LeaveApplicationStatus.PENDING:
            raise ValueError(f"Cannot approve application in status: {application.status}")
        
        application.status = LeaveApplicationStatus.APPROVED
        application.approved_by = approved_by
        application.approved_at = datetime.utcnow()
        application.approver_remarks = remarks
        
        # Update balance
        fy = self._get_financial_year(application.from_date)
        self._update_balance(
            application.employee_id, 
            application.leave_type_id, 
            fy, 
            application.total_days, 
            'approve'
        )
        
        # Create attendance records
        self._create_leave_attendance(application)
        
        self.db.commit()
        self.db.refresh(application)
        
        return application
    
    def reject_leave(
        self,
        application_id: str,
        rejected_by: str,
        reason: str,
    ) -> LeaveApplication:
        """Reject a leave application."""
        application = self.db.query(LeaveApplication).filter(
            LeaveApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError("Application not found")
        
        if application.status != LeaveApplicationStatus.PENDING:
            raise ValueError(f"Cannot reject application in status: {application.status}")
        
        application.status = LeaveApplicationStatus.REJECTED
        application.rejected_by = rejected_by
        application.rejected_at = datetime.utcnow()
        application.rejection_reason = reason
        
        # Update balance
        fy = self._get_financial_year(application.from_date)
        self._update_balance(
            application.employee_id, 
            application.leave_type_id, 
            fy, 
            application.total_days, 
            'reject'
        )
        
        self.db.commit()
        self.db.refresh(application)
        
        return application
    
    def cancel_leave(
        self,
        application_id: str,
        cancelled_by: str,
        reason: str,
    ) -> LeaveApplication:
        """Cancel an approved leave application."""
        application = self.db.query(LeaveApplication).filter(
            LeaveApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError("Application not found")
        
        if application.status != LeaveApplicationStatus.APPROVED:
            raise ValueError("Can only cancel approved leaves")
        
        application.status = LeaveApplicationStatus.CANCELLED
        application.cancelled_by = cancelled_by
        application.cancelled_at = datetime.utcnow()
        application.cancellation_reason = reason
        
        # Update balance
        fy = self._get_financial_year(application.from_date)
        self._update_balance(
            application.employee_id, 
            application.leave_type_id, 
            fy, 
            application.total_days, 
            'cancel'
        )
        
        # Remove attendance records
        self._remove_leave_attendance(application)
        
        self.db.commit()
        self.db.refresh(application)
        
        return application
    
    def _create_leave_attendance(self, application: LeaveApplication):
        """Create attendance records for approved leave."""
        current = application.from_date
        
        while current <= application.to_date:
            # Check if attendance already exists
            existing = self.db.query(Attendance).filter(
                Attendance.employee_id == application.employee_id,
                Attendance.attendance_date == current,
            ).first()
            
            if existing:
                existing.status = AttendanceStatus.LEAVE
                existing.leave_application_id = application.id
            else:
                attendance = Attendance(
                    id=generate_uuid(),
                    company_id=application.company_id,
                    employee_id=application.employee_id,
                    attendance_date=current,
                    status=AttendanceStatus.LEAVE,
                    leave_application_id=application.id,
                    source='leave',
                )
                self.db.add(attendance)
            
            current += timedelta(days=1)
    
    def _remove_leave_attendance(self, application: LeaveApplication):
        """Remove attendance records for cancelled leave."""
        self.db.query(Attendance).filter(
            Attendance.leave_application_id == application.id
        ).delete()
    
    def get_application(self, application_id: str) -> Optional[LeaveApplication]:
        return self.db.query(LeaveApplication).filter(
            LeaveApplication.id == application_id
        ).first()
    
    def list_applications(
        self,
        company_id: str,
        employee_id: str = None,
        status: LeaveApplicationStatus = None,
        from_date: date = None,
        to_date: date = None,
    ) -> List[LeaveApplication]:
        query = self.db.query(LeaveApplication).filter(
            LeaveApplication.company_id == company_id
        )
        
        if employee_id:
            query = query.filter(LeaveApplication.employee_id == employee_id)
        
        if status:
            query = query.filter(LeaveApplication.status == status)
        
        if from_date:
            query = query.filter(LeaveApplication.from_date >= from_date)
        
        if to_date:
            query = query.filter(LeaveApplication.to_date <= to_date)
        
        return query.order_by(LeaveApplication.application_date.desc()).all()
