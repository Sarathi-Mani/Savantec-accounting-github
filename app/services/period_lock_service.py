"""
Period Lock Service - Prevent entries in locked periods.

Features:
- Lock periods for all or specific voucher types
- Prevent backdated entries
- Auto-lock GST filed periods
"""
from typing import Optional, List
from datetime import datetime, date
from sqlalchemy.orm import Session

from app.database.models import PeriodLock, VoucherType, generate_uuid


class PeriodLockService:
    """Service for managing period locks."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_lock(
        self,
        company_id: str,
        locked_from: datetime,
        locked_to: datetime,
        voucher_types: List[str] = None,
        reason: str = None,
        locked_by: str = None,
    ) -> PeriodLock:
        """Create a new period lock."""
        lock = PeriodLock(
            id=generate_uuid(),
            company_id=company_id,
            locked_from=locked_from,
            locked_to=locked_to,
            voucher_types=voucher_types,
            reason=reason,
            locked_by=locked_by,
            locked_at=datetime.utcnow(),
            is_active=True,
        )
        
        self.db.add(lock)
        self.db.commit()
        self.db.refresh(lock)
        
        return lock
    
    def get_lock(self, lock_id: str) -> Optional[PeriodLock]:
        """Get a specific lock by ID."""
        return self.db.query(PeriodLock).filter(PeriodLock.id == lock_id).first()
    
    def list_locks(
        self,
        company_id: str,
        active_only: bool = True,
    ) -> List[PeriodLock]:
        """List all period locks for a company."""
        query = self.db.query(PeriodLock).filter(PeriodLock.company_id == company_id)
        
        if active_only:
            query = query.filter(PeriodLock.is_active == True)
        
        return query.order_by(PeriodLock.locked_from.desc()).all()
    
    def deactivate_lock(self, lock_id: str) -> Optional[PeriodLock]:
        """Deactivate a period lock."""
        lock = self.get_lock(lock_id)
        if lock:
            lock.is_active = False
            self.db.commit()
            self.db.refresh(lock)
        return lock
    
    def is_period_locked(
        self,
        company_id: str,
        transaction_date: datetime,
        voucher_type: str = None,
    ) -> tuple:
        """
        Check if a date is within a locked period.
        
        Returns: (is_locked: bool, lock: PeriodLock or None, message: str)
        """
        if isinstance(transaction_date, date) and not isinstance(transaction_date, datetime):
            transaction_date = datetime.combine(transaction_date, datetime.min.time())
        
        locks = self.db.query(PeriodLock).filter(
            PeriodLock.company_id == company_id,
            PeriodLock.is_active == True,
            PeriodLock.locked_from <= transaction_date,
            PeriodLock.locked_to >= transaction_date,
        ).all()
        
        for lock in locks:
            # Check if this voucher type is locked
            if lock.voucher_types is None:
                # All voucher types are locked
                return (
                    True,
                    lock,
                    f"Period from {lock.locked_from.strftime('%d-%b-%Y')} to {lock.locked_to.strftime('%d-%b-%Y')} is locked. Reason: {lock.reason or 'Not specified'}"
                )
            
            if voucher_type and voucher_type in lock.voucher_types:
                return (
                    True,
                    lock,
                    f"Period from {lock.locked_from.strftime('%d-%b-%Y')} to {lock.locked_to.strftime('%d-%b-%Y')} is locked for {voucher_type} vouchers. Reason: {lock.reason or 'Not specified'}"
                )
        
        return (False, None, "Period is open for entries")
    
    def validate_transaction_date(
        self,
        company_id: str,
        transaction_date: datetime,
        voucher_type: str = None,
    ) -> None:
        """
        Validate that a transaction date is not in a locked period.
        Raises ValueError if period is locked.
        """
        is_locked, lock, message = self.is_period_locked(
            company_id, transaction_date, voucher_type
        )
        
        if is_locked:
            raise ValueError(message)
    
    def lock_financial_year(
        self,
        company_id: str,
        financial_year: str,
        reason: str = None,
        locked_by: str = None,
    ) -> PeriodLock:
        """
        Lock an entire financial year.
        
        Args:
            financial_year: Format "2024-2025"
        """
        years = financial_year.split('-')
        start_year = int(years[0])
        end_year = int(years[1])
        
        locked_from = datetime(start_year, 4, 1)  # April 1
        locked_to = datetime(end_year, 3, 31, 23, 59, 59)  # March 31
        
        return self.create_lock(
            company_id=company_id,
            locked_from=locked_from,
            locked_to=locked_to,
            reason=reason or f"Financial Year {financial_year} locked",
            locked_by=locked_by,
        )
    
    def lock_gst_period(
        self,
        company_id: str,
        month: int,
        year: int,
        reason: str = None,
        locked_by: str = None,
    ) -> PeriodLock:
        """
        Lock a GST return period (month).
        
        Typically called after GSTR-3B is filed.
        """
        locked_from = datetime(year, month, 1)
        
        # Get last day of month
        if month == 12:
            locked_to = datetime(year + 1, 1, 1) - datetime.resolution
        else:
            locked_to = datetime(year, month + 1, 1) - datetime.resolution
        
        return self.create_lock(
            company_id=company_id,
            locked_from=locked_from,
            locked_to=locked_to,
            voucher_types=['sales', 'purchase', 'debit_note', 'credit_note'],
            reason=reason or f"GST period {month:02d}/{year} locked after return filing",
            locked_by=locked_by,
        )
    
    def get_lock_status_for_period(
        self,
        company_id: str,
        from_date: datetime,
        to_date: datetime,
    ) -> List[dict]:
        """Get lock status for each day in a date range."""
        result = []
        current = from_date
        
        while current <= to_date:
            is_locked, lock, _ = self.is_period_locked(company_id, current)
            result.append({
                'date': current.strftime('%Y-%m-%d'),
                'is_locked': is_locked,
                'lock_id': lock.id if lock else None,
                'reason': lock.reason if lock else None,
            })
            current = current + datetime.resolution
        
        return result
    
    def extend_lock(
        self,
        lock_id: str,
        new_to_date: datetime,
    ) -> Optional[PeriodLock]:
        """Extend an existing lock to a new end date."""
        lock = self.get_lock(lock_id)
        if lock:
            lock.locked_to = new_to_date
            self.db.commit()
            self.db.refresh(lock)
        return lock
