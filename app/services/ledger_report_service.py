"""
Ledger Report Service - Ledger with running balance.

Features:
- Account ledger with running balance
- Period filtering
- Drill-down to vouchers
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Account, Transaction, TransactionEntry, TransactionStatus
)


class LedgerReportService:
    """Service for ledger reports."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round(self, amount: Decimal) -> Decimal:
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def get_account_ledger(
        self,
        company_id: str,
        account_id: str,
        from_date: datetime = None,
        to_date: datetime = None,
        include_opening: bool = True,
    ) -> Dict:
        """Get ledger for an account with running balance."""
        account = self.db.query(Account).filter(
            Account.id == account_id,
            Account.company_id == company_id,
        ).first()
        
        if not account:
            return {'error': 'Account not found'}
        
        # Calculate opening balance from transaction entries
        # (opening balances are now stored as transactions, so they're included in the query)
        opening_balance = Decimal('0')
        if include_opening and from_date:
            # Balance before from_date (includes opening balance transactions)
            opening_result = self.db.query(
                func.coalesce(func.sum(TransactionEntry.debit_amount), 0) - 
                func.coalesce(func.sum(TransactionEntry.credit_amount), 0)
            ).join(Transaction).filter(
                TransactionEntry.account_id == account_id,
                Transaction.transaction_date < from_date,
                Transaction.status == TransactionStatus.POSTED,
            ).scalar()
            
            opening_balance = Decimal(str(opening_result)) if opening_result else Decimal('0')
        # else: opening_balance stays 0 (showing all transactions from beginning)
        
        # Get entries
        query = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account_id,
            Transaction.status == TransactionStatus.POSTED,
        )
        
        if from_date:
            query = query.filter(Transaction.transaction_date >= from_date)
        
        if to_date:
            query = query.filter(Transaction.transaction_date <= to_date)
        
        entries = query.order_by(Transaction.transaction_date.asc()).all()
        
        # Build ledger with running balance
        running_balance = opening_balance
        ledger_entries = []
        
        for entry in entries:
            debit = entry.debit_amount or Decimal('0')
            credit = entry.credit_amount or Decimal('0')
            running_balance += debit - credit
            
            ledger_entries.append({
                'id': entry.id,
                'date': entry.transaction.transaction_date.strftime('%Y-%m-%d'),
                'voucher_number': entry.transaction.transaction_number,
                'voucher_type': entry.transaction.voucher_type.value if entry.transaction.voucher_type else None,
                'description': entry.description or entry.transaction.description,
                'debit': float(debit),
                'credit': float(credit),
                'balance': float(self._round(running_balance)),
                'transaction_id': entry.transaction_id,
            })
        
        closing_balance = running_balance
        
        # Calculate totals
        total_debit = sum(e['debit'] for e in ledger_entries)
        total_credit = sum(e['credit'] for e in ledger_entries)
        
        return {
            'account': {
                'id': account.id,
                'code': account.code,
                'name': account.name,
                'type': account.account_type.value,
            },
            'period': {
                'from': from_date.strftime('%Y-%m-%d') if from_date else None,
                'to': to_date.strftime('%Y-%m-%d') if to_date else None,
            },
            'opening_balance': float(self._round(opening_balance)),
            'closing_balance': float(self._round(closing_balance)),
            'total_debit': total_debit,
            'total_credit': total_credit,
            'entries': ledger_entries,
            'entry_count': len(ledger_entries),
        }
    
    def get_day_book(
        self,
        company_id: str,
        date: datetime,
        voucher_type: str = None,
    ) -> Dict:
        """Get day book - all vouchers for a specific date."""
        query = self.db.query(Transaction).filter(
            Transaction.company_id == company_id,
            func.date(Transaction.transaction_date) == date.date(),
            Transaction.status == TransactionStatus.POSTED,
        )
        
        if voucher_type:
            query = query.filter(Transaction.voucher_type == voucher_type)
        
        transactions = query.order_by(Transaction.transaction_number.asc()).all()
        
        vouchers = []
        total_debit = Decimal('0')
        total_credit = Decimal('0')
        
        for txn in transactions:
            voucher_debit = sum((e.debit_amount or Decimal('0')) for e in txn.entries)
            voucher_credit = sum((e.credit_amount or Decimal('0')) for e in txn.entries)
            total_debit += voucher_debit
            total_credit += voucher_credit
            
            vouchers.append({
                'id': txn.id,
                'voucher_number': txn.transaction_number,
                'voucher_type': txn.voucher_type.value if txn.voucher_type else None,
                'description': txn.description,
                'debit': float(voucher_debit),
                'credit': float(voucher_credit),
                'entries': [
                    {
                        'account_id': e.account_id,
                        'account_name': e.account.name if e.account else None,
                        'description': e.description,
                        'debit': float(e.debit_amount or 0),
                        'credit': float(e.credit_amount or 0),
                    }
                    for e in txn.entries
                ],
            })
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'voucher_type_filter': voucher_type,
            'vouchers': vouchers,
            'voucher_count': len(vouchers),
            'total_debit': float(total_debit),
            'total_credit': float(total_credit),
        }
    
    def get_voucher_register(
        self,
        company_id: str,
        from_date: datetime,
        to_date: datetime,
        voucher_type: str = None,
    ) -> Dict:
        """Get voucher register for a period."""
        query = self.db.query(Transaction).filter(
            Transaction.company_id == company_id,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date,
            Transaction.status == TransactionStatus.POSTED,
        )
        
        if voucher_type:
            query = query.filter(Transaction.voucher_type == voucher_type)
        
        transactions = query.order_by(
            Transaction.transaction_date.asc(),
            Transaction.transaction_number.asc()
        ).all()
        
        vouchers = []
        
        for txn in transactions:
            voucher_amount = sum((e.debit_amount or Decimal('0')) for e in txn.entries)
            
            vouchers.append({
                'id': txn.id,
                'date': txn.transaction_date.strftime('%Y-%m-%d'),
                'voucher_number': txn.transaction_number,
                'voucher_type': txn.voucher_type.value if txn.voucher_type else None,
                'description': txn.description,
                'amount': float(voucher_amount),
                'party': txn.party_type + ': ' + txn.party_id if txn.party_id else None,
            })
        
        return {
            'period': {
                'from': from_date.strftime('%Y-%m-%d'),
                'to': to_date.strftime('%Y-%m-%d'),
            },
            'voucher_type_filter': voucher_type,
            'vouchers': vouchers,
            'voucher_count': len(vouchers),
        }
    
    def get_cash_bank_book(
        self,
        company_id: str,
        from_date: datetime,
        to_date: datetime,
        book_type: str = 'cash',  # 'cash' or 'bank'
    ) -> Dict:
        """Get cash or bank book."""
        # Find cash/bank account
        if book_type == 'cash':
            account = self.db.query(Account).filter(
                Account.company_id == company_id,
                Account.name.ilike('%Cash%'),
                Account.is_active == True,
            ).first()
        else:
            account = self.db.query(Account).filter(
                Account.company_id == company_id,
                Account.bank_account_id.isnot(None),
                Account.is_active == True,
            ).first()
        
        if not account:
            return {'error': f'{book_type.title()} account not found'}
        
        return self.get_account_ledger(
            company_id=company_id,
            account_id=account.id,
            from_date=from_date,
            to_date=to_date,
        )
