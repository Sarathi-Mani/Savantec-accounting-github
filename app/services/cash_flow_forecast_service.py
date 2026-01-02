"""
Cash Flow Forecasting Service - Predict future cash positions.

Features:
- Project receivables collections
- Project payables outflows
- Include recurring transactions
- Consider PDC maturities
"""
from decimal import Decimal
from typing import List, Dict
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Invoice, PurchaseInvoice, RecurringTransaction, PostDatedCheque,
    Account, AccountType, Transaction, TransactionEntry, TransactionStatus
)


class CashFlowForecastService:
    """Service for cash flow forecasting."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_current_cash_balance(self, company_id: str) -> Decimal:
        """Get current cash and bank balance calculated from transactions."""
        # Get all cash and bank accounts
        accounts = self.db.query(Account).filter(
            Account.company_id == company_id,
            Account.account_type == AccountType.ASSET,
            Account.is_active == True,
        ).all()
        
        # Filter for cash/bank accounts (by code pattern)
        cash_bank_accounts = [
            a for a in accounts 
            if a.code.startswith('1') and ('Cash' in a.name or 'Bank' in a.name)
        ]
        
        if not cash_bank_accounts:
            return Decimal('0')
        
        account_ids = [a.id for a in cash_bank_accounts]
        
        # Calculate balance from transaction entries
        result = self.db.query(
            func.coalesce(func.sum(TransactionEntry.debit_amount), 0).label('total_debit'),
            func.coalesce(func.sum(TransactionEntry.credit_amount), 0).label('total_credit')
        ).join(Transaction).filter(
            TransactionEntry.account_id.in_(account_ids),
            Transaction.status == TransactionStatus.POSTED,
        ).first()
        
        total_debit = Decimal(str(result.total_debit or 0))
        total_credit = Decimal(str(result.total_credit or 0))
        
        # Assets have debit-normal balance
        return total_debit - total_credit
    
    def get_receivables_forecast(
        self,
        company_id: str,
        days: int = 30,
    ) -> List[Dict]:
        """Forecast receivables collections by due date."""
        today = datetime.utcnow()
        end_date = today + timedelta(days=days)
        
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company_id,
            Invoice.outstanding_amount > 0,
            Invoice.due_date.isnot(None),
            Invoice.due_date <= end_date,
        ).order_by(Invoice.due_date.asc()).all()
        
        return [
            {
                'date': inv.due_date.strftime('%Y-%m-%d'),
                'type': 'receivable',
                'description': f"Invoice {inv.invoice_number}",
                'amount': float(inv.outstanding_amount or 0),
                'customer': inv.customer.name if inv.customer else None,
                'invoice_id': inv.id,
            }
            for inv in invoices
        ]
    
    def get_payables_forecast(
        self,
        company_id: str,
        days: int = 30,
    ) -> List[Dict]:
        """Forecast payables outflows by due date."""
        today = datetime.utcnow()
        end_date = today + timedelta(days=days)
        
        invoices = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.outstanding_amount > 0,
            PurchaseInvoice.due_date.isnot(None),
            PurchaseInvoice.due_date <= end_date,
        ).order_by(PurchaseInvoice.due_date.asc()).all()
        
        return [
            {
                'date': inv.due_date.strftime('%Y-%m-%d'),
                'type': 'payable',
                'description': f"Bill {inv.invoice_number}",
                'amount': -float(inv.outstanding_amount or 0),  # Negative for outflow
                'vendor': inv.vendor.name if inv.vendor else None,
                'invoice_id': inv.id,
            }
            for inv in invoices
        ]
    
    def get_pdc_forecast(
        self,
        company_id: str,
        days: int = 30,
    ) -> List[Dict]:
        """Forecast PDC maturities."""
        today = datetime.utcnow()
        end_date = today + timedelta(days=days)
        
        pdcs = self.db.query(PostDatedCheque).filter(
            PostDatedCheque.company_id == company_id,
            PostDatedCheque.status == 'pending',
            PostDatedCheque.cheque_date >= today,
            PostDatedCheque.cheque_date <= end_date,
        ).order_by(PostDatedCheque.cheque_date.asc()).all()
        
        return [
            {
                'date': pdc.cheque_date.strftime('%Y-%m-%d'),
                'type': 'pdc_received' if pdc.pdc_type == 'received' else 'pdc_issued',
                'description': f"PDC {pdc.cheque_number}",
                'amount': float(pdc.amount) if pdc.pdc_type == 'received' else -float(pdc.amount),
                'party': pdc.party_name,
                'pdc_id': pdc.id,
            }
            for pdc in pdcs
        ]
    
    def get_recurring_forecast(
        self,
        company_id: str,
        days: int = 30,
    ) -> List[Dict]:
        """Forecast recurring transaction impacts."""
        from app.database.models import VoucherType
        
        today = datetime.utcnow()
        end_date = today + timedelta(days=days)
        
        recurring = self.db.query(RecurringTransaction).filter(
            RecurringTransaction.company_id == company_id,
            RecurringTransaction.is_active == True,
            RecurringTransaction.next_date >= today,
            RecurringTransaction.next_date <= end_date,
        ).all()
        
        result = []
        for rec in recurring:
            # Determine if inflow or outflow
            is_inflow = rec.voucher_type in [VoucherType.RECEIPT, VoucherType.SALES]
            
            result.append({
                'date': rec.next_date.strftime('%Y-%m-%d'),
                'type': 'recurring',
                'description': rec.name,
                'amount': float(rec.amount) if is_inflow else -float(rec.amount),
                'recurring_id': rec.id,
            })
        
        return result
    
    def generate_forecast(
        self,
        company_id: str,
        days: int = 30,
    ) -> Dict:
        """Generate comprehensive cash flow forecast."""
        today = datetime.utcnow()
        current_balance = self.get_current_cash_balance(company_id)
        
        # Collect all forecasted items
        items = []
        items.extend(self.get_receivables_forecast(company_id, days))
        items.extend(self.get_payables_forecast(company_id, days))
        items.extend(self.get_pdc_forecast(company_id, days))
        items.extend(self.get_recurring_forecast(company_id, days))
        
        # Sort by date
        items.sort(key=lambda x: x['date'])
        
        # Calculate running balance
        running_balance = float(current_balance)
        daily_summary = {}
        
        for item in items:
            date = item['date']
            if date not in daily_summary:
                daily_summary[date] = {
                    'date': date,
                    'inflows': 0,
                    'outflows': 0,
                    'net': 0,
                    'items': [],
                }
            
            amount = item['amount']
            if amount > 0:
                daily_summary[date]['inflows'] += amount
            else:
                daily_summary[date]['outflows'] += abs(amount)
            
            daily_summary[date]['net'] += amount
            daily_summary[date]['items'].append(item)
        
        # Calculate closing balance for each day
        sorted_dates = sorted(daily_summary.keys())
        for date in sorted_dates:
            running_balance += daily_summary[date]['net']
            daily_summary[date]['closing_balance'] = running_balance
        
        # Calculate totals
        total_inflows = sum(d['inflows'] for d in daily_summary.values())
        total_outflows = sum(d['outflows'] for d in daily_summary.values())
        
        return {
            'forecast_date': today.strftime('%Y-%m-%d'),
            'forecast_days': days,
            'opening_balance': float(current_balance),
            'total_inflows': total_inflows,
            'total_outflows': total_outflows,
            'net_change': total_inflows - total_outflows,
            'closing_balance': running_balance,
            'daily_forecast': [daily_summary[d] for d in sorted_dates],
            'all_items': items,
        }
    
    def get_weekly_summary(
        self,
        company_id: str,
        weeks: int = 4,
    ) -> List[Dict]:
        """Get weekly cash flow summary."""
        today = datetime.utcnow()
        result = []
        
        for week in range(weeks):
            week_start = today + timedelta(weeks=week)
            week_end = week_start + timedelta(days=6)
            
            # Get items for this week
            forecast = self.generate_forecast(company_id, (week + 1) * 7)
            
            # Filter items for this week
            week_items = [
                item for item in forecast['all_items']
                if week_start.strftime('%Y-%m-%d') <= item['date'] <= week_end.strftime('%Y-%m-%d')
            ]
            
            inflows = sum(i['amount'] for i in week_items if i['amount'] > 0)
            outflows = sum(abs(i['amount']) for i in week_items if i['amount'] < 0)
            
            result.append({
                'week': week + 1,
                'start_date': week_start.strftime('%Y-%m-%d'),
                'end_date': week_end.strftime('%Y-%m-%d'),
                'expected_inflows': inflows,
                'expected_outflows': outflows,
                'net': inflows - outflows,
            })
        
        return result
