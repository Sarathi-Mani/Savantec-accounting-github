"""
Bill Allocation Service - Bill-wise payment tracking.

Features:
- Allocate payments against specific invoices
- Track outstanding amounts per invoice
- Support for advance payments
- Support for on-account payments
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    BillAllocation, BillAllocationType, Invoice, PurchaseInvoice,
    Transaction, Customer, generate_uuid
)


class BillAllocationService:
    """Service for bill-wise payment allocation."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ==================== ALLOCATION METHODS ====================
    
    def allocate_payment(
        self,
        company_id: str,
        payment_transaction_id: str,
        invoice_id: str,
        invoice_type: str,  # 'sales' or 'purchase'
        allocated_amount: Decimal,
        allocation_type: BillAllocationType = BillAllocationType.AGAINST_REFERENCE,
        allocation_date: datetime = None,
        party_id: str = None,
        party_type: str = None,
        notes: str = None,
    ) -> BillAllocation:
        """Create a payment allocation against an invoice."""
        # Get invoice
        if invoice_type == 'sales':
            invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
            invoice_number = invoice.invoice_number if invoice else None
        else:
            invoice = self.db.query(PurchaseInvoice).filter(PurchaseInvoice.id == invoice_id).first()
            invoice_number = invoice.invoice_number if invoice else None
        
        allocation = BillAllocation(
            id=generate_uuid(),
            company_id=company_id,
            payment_transaction_id=payment_transaction_id,
            invoice_id=invoice_id,
            invoice_type=invoice_type,
            invoice_number=invoice_number,
            allocation_type=allocation_type,
            allocated_amount=self._round(allocated_amount),
            allocation_date=allocation_date or datetime.utcnow(),
            party_id=party_id,
            party_type=party_type,
            notes=notes,
        )
        
        self.db.add(allocation)
        
        # Update invoice outstanding
        if invoice:
            self._update_invoice_outstanding(invoice, invoice_type)
        
        self.db.commit()
        self.db.refresh(allocation)
        
        return allocation
    
    def _update_invoice_outstanding(self, invoice, invoice_type: str):
        """Update the outstanding amount on an invoice."""
        total_allocated = self.get_total_allocated(
            invoice.company_id,
            invoice.id,
            invoice_type,
        )
        
        total_amount = invoice.total_amount or Decimal('0')
        outstanding = total_amount - total_allocated
        
        invoice.outstanding_amount = self._round(outstanding)
        invoice.balance_due = self._round(outstanding)
    
    def delete_allocation(self, allocation_id: str) -> bool:
        """Delete an allocation and update outstanding."""
        allocation = self.db.query(BillAllocation).filter(
            BillAllocation.id == allocation_id
        ).first()
        
        if not allocation:
            return False
        
        invoice_id = allocation.invoice_id
        invoice_type = allocation.invoice_type
        company_id = allocation.company_id
        
        self.db.delete(allocation)
        
        # Update invoice outstanding
        if invoice_type == 'sales':
            invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
        else:
            invoice = self.db.query(PurchaseInvoice).filter(PurchaseInvoice.id == invoice_id).first()
        
        if invoice:
            self._update_invoice_outstanding(invoice, invoice_type)
        
        self.db.commit()
        return True
    
    # ==================== QUERY METHODS ====================
    
    def get_allocations_for_invoice(
        self,
        company_id: str,
        invoice_id: str,
        invoice_type: str,
    ) -> List[BillAllocation]:
        """Get all allocations for an invoice."""
        return self.db.query(BillAllocation).filter(
            BillAllocation.company_id == company_id,
            BillAllocation.invoice_id == invoice_id,
            BillAllocation.invoice_type == invoice_type,
        ).order_by(BillAllocation.allocation_date.asc()).all()
    
    def get_allocations_for_payment(
        self,
        payment_transaction_id: str,
    ) -> List[BillAllocation]:
        """Get all allocations for a payment transaction."""
        return self.db.query(BillAllocation).filter(
            BillAllocation.payment_transaction_id == payment_transaction_id,
        ).all()
    
    def get_total_allocated(
        self,
        company_id: str,
        invoice_id: str,
        invoice_type: str,
    ) -> Decimal:
        """Get total amount allocated against an invoice."""
        result = self.db.query(func.sum(BillAllocation.allocated_amount)).filter(
            BillAllocation.company_id == company_id,
            BillAllocation.invoice_id == invoice_id,
            BillAllocation.invoice_type == invoice_type,
        ).scalar()
        
        return Decimal(str(result)) if result else Decimal('0')
    
    # ==================== OUTSTANDING METHODS ====================
    
    def get_outstanding_invoices(
        self,
        company_id: str,
        party_id: str = None,
        invoice_type: str = 'sales',
        as_of_date: datetime = None,
    ) -> List[Dict]:
        """Get list of invoices with outstanding amounts."""
        if invoice_type == 'sales':
            query = self.db.query(Invoice).filter(
                Invoice.company_id == company_id,
                Invoice.outstanding_amount > 0,
            )
            if party_id:
                query = query.filter(Invoice.customer_id == party_id)
            if as_of_date:
                query = query.filter(Invoice.invoice_date <= as_of_date)
            
            invoices = query.order_by(Invoice.invoice_date.asc()).all()
            
            return [
                {
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
                    'due_date': inv.due_date.isoformat() if inv.due_date else None,
                    'total_amount': float(inv.total_amount or 0),
                    'outstanding_amount': float(inv.outstanding_amount or 0),
                    'customer_id': inv.customer_id,
                    'days_overdue': (datetime.utcnow() - inv.due_date).days if inv.due_date else 0,
                }
                for inv in invoices
            ]
        else:
            query = self.db.query(PurchaseInvoice).filter(
                PurchaseInvoice.company_id == company_id,
                PurchaseInvoice.outstanding_amount > 0,
            )
            if party_id:
                query = query.filter(PurchaseInvoice.vendor_id == party_id)
            if as_of_date:
                query = query.filter(PurchaseInvoice.invoice_date <= as_of_date)
            
            invoices = query.order_by(PurchaseInvoice.invoice_date.asc()).all()
            
            return [
                {
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
                    'due_date': inv.due_date.isoformat() if inv.due_date else None,
                    'total_amount': float(inv.total_amount or 0),
                    'outstanding_amount': float(inv.outstanding_amount or 0),
                    'vendor_id': inv.vendor_id,
                    'days_overdue': (datetime.utcnow() - inv.due_date).days if inv.due_date else 0,
                }
                for inv in invoices
            ]
    
    def get_party_outstanding(
        self,
        company_id: str,
        party_id: str,
        party_type: str,  # 'customer' or 'vendor'
    ) -> Dict:
        """Get total outstanding for a party."""
        if party_type == 'customer':
            result = self.db.query(func.sum(Invoice.outstanding_amount)).filter(
                Invoice.company_id == company_id,
                Invoice.customer_id == party_id,
                Invoice.outstanding_amount > 0,
            ).scalar()
            
            invoice_count = self.db.query(Invoice).filter(
                Invoice.company_id == company_id,
                Invoice.customer_id == party_id,
                Invoice.outstanding_amount > 0,
            ).count()
        else:
            result = self.db.query(func.sum(PurchaseInvoice.outstanding_amount)).filter(
                PurchaseInvoice.company_id == company_id,
                PurchaseInvoice.vendor_id == party_id,
                PurchaseInvoice.outstanding_amount > 0,
            ).scalar()
            
            invoice_count = self.db.query(PurchaseInvoice).filter(
                PurchaseInvoice.company_id == company_id,
                PurchaseInvoice.vendor_id == party_id,
                PurchaseInvoice.outstanding_amount > 0,
            ).count()
        
        return {
            'party_id': party_id,
            'party_type': party_type,
            'total_outstanding': float(result) if result else 0,
            'invoice_count': invoice_count,
        }
    
    # ==================== AGING ANALYSIS ====================
    
    def get_aging_analysis(
        self,
        company_id: str,
        invoice_type: str = 'sales',
        party_id: str = None,
        as_of_date: datetime = None,
    ) -> Dict:
        """Get age-wise outstanding analysis."""
        if not as_of_date:
            as_of_date = datetime.utcnow()
        
        buckets = {
            '0-30': Decimal('0'),
            '31-60': Decimal('0'),
            '61-90': Decimal('0'),
            '91-180': Decimal('0'),
            '180+': Decimal('0'),
        }
        
        invoices = self.get_outstanding_invoices(
            company_id, party_id, invoice_type, as_of_date
        )
        
        details = []
        
        for inv in invoices:
            due_date = datetime.fromisoformat(inv['due_date']) if inv['due_date'] else datetime.fromisoformat(inv['invoice_date'])
            days_overdue = (as_of_date - due_date).days
            outstanding = Decimal(str(inv['outstanding_amount']))
            
            if days_overdue <= 0:
                bucket = '0-30'  # Not yet due
            elif days_overdue <= 30:
                bucket = '0-30'
            elif days_overdue <= 60:
                bucket = '31-60'
            elif days_overdue <= 90:
                bucket = '61-90'
            elif days_overdue <= 180:
                bucket = '91-180'
            else:
                bucket = '180+'
            
            buckets[bucket] += outstanding
            
            details.append({
                **inv,
                'days_overdue': days_overdue,
                'bucket': bucket,
            })
        
        return {
            'as_of_date': as_of_date.isoformat(),
            'invoice_type': invoice_type,
            'summary': {k: float(v) for k, v in buckets.items()},
            'total_outstanding': sum(float(v) for v in buckets.values()),
            'invoice_count': len(invoices),
            'details': details,
        }
    
    # ==================== ADVANCE/ON-ACCOUNT ====================
    
    def get_advance_balance(
        self,
        company_id: str,
        party_id: str,
        party_type: str,
    ) -> Decimal:
        """Get total unallocated advance from a party."""
        result = self.db.query(func.sum(BillAllocation.allocated_amount)).filter(
            BillAllocation.company_id == company_id,
            BillAllocation.party_id == party_id,
            BillAllocation.party_type == party_type,
            BillAllocation.allocation_type == BillAllocationType.ADVANCE,
        ).scalar()
        
        return Decimal(str(result)) if result else Decimal('0')
    
    def adjust_advance(
        self,
        company_id: str,
        party_id: str,
        party_type: str,
        invoice_id: str,
        invoice_type: str,
        amount: Decimal,
    ) -> BillAllocation:
        """Adjust advance against an invoice."""
        return self.allocate_payment(
            company_id=company_id,
            payment_transaction_id=None,  # No specific payment
            invoice_id=invoice_id,
            invoice_type=invoice_type,
            allocated_amount=amount,
            allocation_type=BillAllocationType.AGAINST_REFERENCE,
            party_id=party_id,
            party_type=party_type,
            notes=f"Adjusted from advance balance",
        )
    
    # ==================== RECALCULATION ====================
    
    def recalculate_all_outstanding(self, company_id: str):
        """Recalculate outstanding for all invoices."""
        # Sales invoices
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company_id
        ).all()
        
        for inv in invoices:
            self._update_invoice_outstanding(inv, 'sales')
        
        # Purchase invoices
        purchase_invoices = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id
        ).all()
        
        for inv in purchase_invoices:
            self._update_invoice_outstanding(inv, 'purchase')
        
        self.db.commit()
