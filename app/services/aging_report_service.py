"""
Aging Report Service - Age-wise outstanding analysis.

Features:
- Receivables aging
- Payables aging
- Customizable aging buckets
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import Invoice, PurchaseInvoice, Customer


class AgingReportService:
    """Service for aging analysis reports."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round(self, amount) -> float:
        return float(Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    
    def get_receivables_aging(
        self,
        company_id: str,
        as_of_date: datetime = None,
        customer_id: str = None,
        buckets: List[int] = None,
    ) -> Dict:
        """Get receivables aging report."""
        if not as_of_date:
            as_of_date = datetime.utcnow()
        
        if not buckets:
            buckets = [0, 30, 60, 90, 180]  # Standard buckets
        
        # Get outstanding invoices
        query = self.db.query(Invoice).filter(
            Invoice.company_id == company_id,
            Invoice.outstanding_amount > 0,
            Invoice.invoice_date <= as_of_date,
        )
        
        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id)
        
        invoices = query.all()
        
        # Initialize bucket totals
        bucket_labels = self._create_bucket_labels(buckets)
        totals = {label: Decimal('0') for label in bucket_labels}
        
        # Customer-wise breakdown
        customer_aging = {}
        details = []
        
        for inv in invoices:
            due_date = inv.due_date or inv.invoice_date
            days_overdue = (as_of_date - due_date).days
            bucket = self._get_bucket(days_overdue, buckets)
            bucket_label = bucket_labels[bucket]
            
            outstanding = inv.outstanding_amount or Decimal('0')
            totals[bucket_label] += outstanding
            
            # Add to customer totals
            cust_id = inv.customer_id or 'unknown'
            cust_name = inv.customer.name if inv.customer else 'Unknown'
            
            if cust_id not in customer_aging:
                customer_aging[cust_id] = {
                    'customer_id': cust_id,
                    'customer_name': cust_name,
                    'buckets': {label: Decimal('0') for label in bucket_labels},
                    'total': Decimal('0'),
                }
            
            customer_aging[cust_id]['buckets'][bucket_label] += outstanding
            customer_aging[cust_id]['total'] += outstanding
            
            details.append({
                'invoice_id': inv.id,
                'invoice_number': inv.invoice_number,
                'invoice_date': inv.invoice_date.strftime('%Y-%m-%d'),
                'due_date': due_date.strftime('%Y-%m-%d') if due_date else None,
                'days_overdue': days_overdue,
                'bucket': bucket_label,
                'customer_id': cust_id,
                'customer_name': cust_name,
                'total_amount': self._round(inv.total_amount or 0),
                'outstanding': self._round(outstanding),
            })
        
        # Convert customer aging to list
        customer_list = []
        for cust in customer_aging.values():
            cust['buckets'] = {k: self._round(v) for k, v in cust['buckets'].items()}
            cust['total'] = self._round(cust['total'])
            customer_list.append(cust)
        
        customer_list.sort(key=lambda x: x['total'], reverse=True)
        
        return {
            'report_type': 'receivables_aging',
            'as_of_date': as_of_date.strftime('%Y-%m-%d'),
            'buckets': bucket_labels,
            'summary': {k: self._round(v) for k, v in totals.items()},
            'total_outstanding': self._round(sum(totals.values())),
            'invoice_count': len(invoices),
            'customer_count': len(customer_aging),
            'by_customer': customer_list,
            'details': details,
        }
    
    def get_payables_aging(
        self,
        company_id: str,
        as_of_date: datetime = None,
        vendor_id: str = None,
        buckets: List[int] = None,
    ) -> Dict:
        """Get payables aging report."""
        if not as_of_date:
            as_of_date = datetime.utcnow()
        
        if not buckets:
            buckets = [0, 30, 60, 90, 180]
        
        query = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.outstanding_amount > 0,
            PurchaseInvoice.invoice_date <= as_of_date,
        )
        
        if vendor_id:
            query = query.filter(PurchaseInvoice.vendor_id == vendor_id)
        
        invoices = query.all()
        
        bucket_labels = self._create_bucket_labels(buckets)
        totals = {label: Decimal('0') for label in bucket_labels}
        
        vendor_aging = {}
        details = []
        
        for inv in invoices:
            due_date = inv.due_date or inv.invoice_date
            days_overdue = (as_of_date - due_date).days
            bucket = self._get_bucket(days_overdue, buckets)
            bucket_label = bucket_labels[bucket]
            
            outstanding = inv.outstanding_amount or Decimal('0')
            totals[bucket_label] += outstanding
            
            vendor_id_val = inv.vendor_id or 'unknown'
            vendor_name = inv.vendor.name if inv.vendor else 'Unknown'
            
            if vendor_id_val not in vendor_aging:
                vendor_aging[vendor_id_val] = {
                    'vendor_id': vendor_id_val,
                    'vendor_name': vendor_name,
                    'buckets': {label: Decimal('0') for label in bucket_labels},
                    'total': Decimal('0'),
                }
            
            vendor_aging[vendor_id_val]['buckets'][bucket_label] += outstanding
            vendor_aging[vendor_id_val]['total'] += outstanding
            
            details.append({
                'invoice_id': inv.id,
                'invoice_number': inv.invoice_number,
                'invoice_date': inv.invoice_date.strftime('%Y-%m-%d'),
                'due_date': due_date.strftime('%Y-%m-%d') if due_date else None,
                'days_overdue': days_overdue,
                'bucket': bucket_label,
                'vendor_id': vendor_id_val,
                'vendor_name': vendor_name,
                'total_amount': self._round(inv.total_amount or 0),
                'outstanding': self._round(outstanding),
            })
        
        vendor_list = []
        for vendor in vendor_aging.values():
            vendor['buckets'] = {k: self._round(v) for k, v in vendor['buckets'].items()}
            vendor['total'] = self._round(vendor['total'])
            vendor_list.append(vendor)
        
        vendor_list.sort(key=lambda x: x['total'], reverse=True)
        
        return {
            'report_type': 'payables_aging',
            'as_of_date': as_of_date.strftime('%Y-%m-%d'),
            'buckets': bucket_labels,
            'summary': {k: self._round(v) for k, v in totals.items()},
            'total_outstanding': self._round(sum(totals.values())),
            'invoice_count': len(invoices),
            'vendor_count': len(vendor_aging),
            'by_vendor': vendor_list,
            'details': details,
        }
    
    def _create_bucket_labels(self, buckets: List[int]) -> List[str]:
        """Create labels for aging buckets."""
        labels = []
        for i, b in enumerate(buckets):
            if i == 0:
                labels.append(f'0-{buckets[1]}')
            elif i == len(buckets) - 1:
                labels.append(f'{b}+')
            else:
                labels.append(f'{b+1}-{buckets[i+1]}')
        return labels
    
    def _get_bucket(self, days: int, buckets: List[int]) -> int:
        """Determine which bucket a number of days falls into."""
        if days < 0:
            days = 0
        
        for i, b in enumerate(buckets):
            if i == len(buckets) - 1:
                return i
            if days <= buckets[i + 1]:
                return i
        
        return len(buckets) - 1
