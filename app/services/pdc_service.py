"""
Post-Dated Cheque (PDC) Service - Track cheques with future dates.

Features:
- Record PDC received and issued
- Track maturity dates
- Generate reminders
- Convert to regular cheques on maturity
"""
from decimal import Decimal
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import PostDatedCheque, Cheque, ChequeType, generate_uuid


class PDCService:
    """Service for post-dated cheque management."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_pdc(
        self,
        company_id: str,
        pdc_type: str,  # 'received' or 'issued'
        cheque_number: str,
        cheque_date: datetime,
        amount: Decimal,
        bank_name: str,
        branch_name: str = None,
        party_id: str = None,
        party_type: str = None,
        party_name: str = None,
        invoice_id: str = None,
        invoice_type: str = None,
        received_date: datetime = None,
        notes: str = None,
    ) -> PostDatedCheque:
        """Create a post-dated cheque record."""
        pdc = PostDatedCheque(
            id=generate_uuid(),
            company_id=company_id,
            pdc_type=pdc_type,
            party_id=party_id,
            party_type=party_type,
            party_name=party_name,
            cheque_number=cheque_number,
            cheque_date=cheque_date,
            bank_name=bank_name,
            branch_name=branch_name,
            amount=amount,
            status='pending',
            received_date=received_date or datetime.utcnow(),
            invoice_id=invoice_id,
            invoice_type=invoice_type,
            notes=notes,
        )
        
        self.db.add(pdc)
        self.db.commit()
        self.db.refresh(pdc)
        
        return pdc
    
    def get_pdc(self, pdc_id: str) -> Optional[PostDatedCheque]:
        return self.db.query(PostDatedCheque).filter(PostDatedCheque.id == pdc_id).first()
    
    def list_pdcs(
        self,
        company_id: str,
        pdc_type: str = None,
        status: str = None,
        party_id: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> List[PostDatedCheque]:
        query = self.db.query(PostDatedCheque).filter(PostDatedCheque.company_id == company_id)
        
        if pdc_type:
            query = query.filter(PostDatedCheque.pdc_type == pdc_type)
        
        if status:
            query = query.filter(PostDatedCheque.status == status)
        
        if party_id:
            query = query.filter(PostDatedCheque.party_id == party_id)
        
        if from_date:
            query = query.filter(PostDatedCheque.cheque_date >= from_date)
        
        if to_date:
            query = query.filter(PostDatedCheque.cheque_date <= to_date)
        
        return query.order_by(PostDatedCheque.cheque_date.asc()).all()
    
    def get_maturing_pdcs(
        self,
        company_id: str,
        days_ahead: int = 7,
    ) -> List[PostDatedCheque]:
        """Get PDCs maturing in the next N days."""
        today = datetime.utcnow()
        future_date = today + timedelta(days=days_ahead)
        
        return self.db.query(PostDatedCheque).filter(
            PostDatedCheque.company_id == company_id,
            PostDatedCheque.status == 'pending',
            PostDatedCheque.cheque_date >= today,
            PostDatedCheque.cheque_date <= future_date,
        ).order_by(PostDatedCheque.cheque_date.asc()).all()
    
    def deposit_pdc(
        self,
        pdc_id: str,
        deposit_date: datetime = None,
        cheque_service=None,  # Optional: to create actual cheque
    ) -> PostDatedCheque:
        """Mark a PDC as deposited."""
        pdc = self.get_pdc(pdc_id)
        if not pdc:
            raise ValueError("PDC not found")
        
        if pdc.status != 'pending':
            raise ValueError(f"Cannot deposit PDC in status: {pdc.status}")
        
        pdc.status = 'deposited'
        pdc.deposit_date = deposit_date or datetime.utcnow()
        
        # Optionally create actual cheque record
        if cheque_service:
            cheque = cheque_service.receive_cheque(
                company_id=pdc.company_id,
                cheque_number=pdc.cheque_number,
                cheque_date=pdc.cheque_date,
                amount=pdc.amount,
                drawer_name=pdc.party_name,
                drawn_on_bank=pdc.bank_name,
                drawn_on_branch=pdc.branch_name,
                party_id=pdc.party_id,
                party_type=pdc.party_type,
                invoice_id=pdc.invoice_id,
                invoice_type=pdc.invoice_type,
            )
            pdc.cheque_id = cheque.id
        
        self.db.commit()
        self.db.refresh(pdc)
        
        return pdc
    
    def clear_pdc(self, pdc_id: str, clearing_date: datetime = None) -> PostDatedCheque:
        """Mark a PDC as cleared."""
        pdc = self.get_pdc(pdc_id)
        if not pdc:
            raise ValueError("PDC not found")
        
        pdc.status = 'cleared'
        pdc.clearing_date = clearing_date or datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(pdc)
        
        return pdc
    
    def bounce_pdc(self, pdc_id: str, reason: str = None) -> PostDatedCheque:
        """Mark a PDC as bounced."""
        pdc = self.get_pdc(pdc_id)
        if not pdc:
            raise ValueError("PDC not found")
        
        pdc.status = 'bounced'
        if reason:
            pdc.notes = (pdc.notes or '') + f"\nBounce reason: {reason}"
        
        self.db.commit()
        self.db.refresh(pdc)
        
        return pdc
    
    def get_pdc_summary(self, company_id: str) -> Dict:
        """Get summary of PDCs."""
        pending_received = self.db.query(func.sum(PostDatedCheque.amount)).filter(
            PostDatedCheque.company_id == company_id,
            PostDatedCheque.pdc_type == 'received',
            PostDatedCheque.status == 'pending',
        ).scalar() or 0
        
        pending_issued = self.db.query(func.sum(PostDatedCheque.amount)).filter(
            PostDatedCheque.company_id == company_id,
            PostDatedCheque.pdc_type == 'issued',
            PostDatedCheque.status == 'pending',
        ).scalar() or 0
        
        maturing_7_days = len(self.get_maturing_pdcs(company_id, 7))
        
        return {
            'pending_received': float(pending_received),
            'pending_issued': float(pending_issued),
            'maturing_in_7_days': maturing_7_days,
        }
