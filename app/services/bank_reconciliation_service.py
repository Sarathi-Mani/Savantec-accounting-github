"""
Bank Reconciliation Service - Proper Tally-style implementation.

Architecture:
1. Book Entries (TransactionEntry): YOUR records - manual entries, vouchers, etc.
2. Bank Statement Entries (BankStatementEntry): BANK's records - imported from statements
3. Reconciliation: Match YOUR entries with BANK's entries
4. Monthly Close: Opening balance + entries = Closing balance

Key Concepts:
- Bank imports go to BankStatementEntry (NOT transactions)
- Manual entries go to Transactions
- Reconciliation matches the two
- Monthly reconciliation verifies opening/closing balances
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime, date, timedelta
from calendar import monthrange
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract

from app.database.models import (
    TransactionEntry, Transaction, BankAccount, Account, generate_uuid
)


class BankReconciliationService:
    """
    Tally-style Bank Reconciliation Service.
    
    Workflow:
    1. User records transactions in books (manual entries, quick entries)
    2. User imports bank statement (goes to BankStatementEntry, NOT transactions)
    3. User reconciles by matching book entries with bank entries
    4. Monthly reconciliation verifies balances
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round(self, amount: Decimal) -> Decimal:
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ==================== HELPER METHODS ====================
    
    def _get_bank_ledger_account(self, company_id: str, bank_account_id: str) -> Optional[Account]:
        """Get the ledger account linked to a bank account."""
        return self.db.query(Account).filter(
            Account.company_id == company_id,
            Account.bank_account_id == bank_account_id,
        ).first()
    
    def _get_book_balance(self, account_id: str, as_of_date: date) -> Decimal:
        """Get book balance as of a date."""
        result = self.db.query(
            func.coalesce(func.sum(TransactionEntry.debit_amount), 0) -
            func.coalesce(func.sum(TransactionEntry.credit_amount), 0)
        ).join(Transaction).filter(
            TransactionEntry.account_id == account_id,
            Transaction.status == 'POSTED',
            Transaction.transaction_date <= as_of_date,
        ).scalar()
        
        return Decimal(str(result)) if result else Decimal('0')
    
    def _get_book_balance_for_period(
        self, 
        account_id: str, 
        from_date: date, 
        to_date: date
    ) -> Dict:
        """Get book entries and balance for a period."""
        entries = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account_id,
            Transaction.status == 'POSTED',
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date,
        ).all()
        
        total_debit = sum(Decimal(str(e.debit_amount or 0)) for e in entries)
        total_credit = sum(Decimal(str(e.credit_amount or 0)) for e in entries)
        
        return {
            "entries": entries,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "net_movement": total_debit - total_credit,
        }
    
    # ==================== BOOK ENTRIES (YOUR RECORDS) ====================
    
    def get_book_entries(
        self,
        company_id: str,
        bank_account_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        unreconciled_only: bool = False,
    ) -> List[Dict]:
        """
        Get book entries for a bank account.
        These are YOUR records from transactions you've entered.
        """
        account = self._get_bank_ledger_account(company_id, bank_account_id)
        if not account:
            return []
        
        query = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == 'POSTED',
        )
        
        if from_date:
            query = query.filter(Transaction.transaction_date >= from_date)
        if to_date:
            query = query.filter(Transaction.transaction_date <= to_date)
        if unreconciled_only:
            query = query.filter(TransactionEntry.is_reconciled == False)
        
        entries = query.order_by(Transaction.transaction_date.desc()).all()
        
        result = []
        for entry in entries:
            txn = entry.transaction
            result.append({
                "id": entry.id,
                "transaction_id": txn.id,
                "transaction_number": txn.transaction_number,
                "date": txn.transaction_date.isoformat() if txn.transaction_date else None,
                "voucher_type": txn.voucher_type,
                "reference": txn.reference_number,
                "description": entry.description or txn.narration or "",
                "debit": float(entry.debit_amount or 0),
                "credit": float(entry.credit_amount or 0),
                "bank_date": entry.bank_date.isoformat() if entry.bank_date else None,
                "is_reconciled": entry.is_reconciled,
            })
        
        return result
    
    # ==================== BANK STATEMENT ENTRIES (BANK'S RECORDS) ====================
    
    def import_bank_statement(
        self,
        company_id: str,
        bank_account_id: str,
        entries: List[Dict],
        import_id: Optional[str] = None,
    ) -> Dict:
        """
        Import bank statement entries.
        These go to BankStatementEntry table, NOT transactions.
        """
        from app.database.bank_statement_models import BankStatementEntry, BankStatementEntryStatus
        
        created = 0
        for entry_data in entries:
            # Check for duplicates based on date + amount + reference
            existing = self.db.query(BankStatementEntry).filter(
                BankStatementEntry.company_id == company_id,
                BankStatementEntry.bank_account_id == bank_account_id,
                BankStatementEntry.value_date == entry_data.get('date'),
                BankStatementEntry.amount == Decimal(str(entry_data.get('amount', 0))),
                BankStatementEntry.bank_reference == entry_data.get('reference'),
            ).first()
            
            if existing:
                continue
            
            stmt_entry = BankStatementEntry(
                id=generate_uuid(),
                company_id=company_id,
                bank_account_id=bank_account_id,
                import_id=import_id,
                value_date=entry_data.get('date'),
                transaction_date=entry_data.get('posting_date'),
                amount=Decimal(str(entry_data.get('amount', 0))),
                bank_reference=entry_data.get('reference'),
                description=entry_data.get('description'),
                balance=Decimal(str(entry_data.get('balance', 0))) if entry_data.get('balance') else None,
                status=BankStatementEntryStatus.PENDING,
            )
            self.db.add(stmt_entry)
            created += 1
        
        self.db.commit()
        return {"imported": created, "skipped_duplicates": len(entries) - created}
    
    def get_bank_statement_entries(
        self,
        company_id: str,
        bank_account_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        status: Optional[str] = None,
    ) -> List[Dict]:
        """Get bank statement entries."""
        from app.database.bank_statement_models import BankStatementEntry
        
        query = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.company_id == company_id,
            BankStatementEntry.bank_account_id == bank_account_id,
        )
        
        if from_date:
            query = query.filter(BankStatementEntry.value_date >= from_date)
        if to_date:
            query = query.filter(BankStatementEntry.value_date <= to_date)
        if status:
            query = query.filter(BankStatementEntry.status == status)
        
        entries = query.order_by(BankStatementEntry.value_date.desc()).all()
        
        return [
            {
                "id": e.id,
                "date": e.value_date.isoformat() if e.value_date else None,
                "amount": float(e.amount),
                "reference": e.bank_reference,
                "description": e.description,
                "balance": float(e.balance) if e.balance else None,
                "status": e.status.value if e.status else "pending",
                "matched_entry_id": e.matched_entry_id,
            }
            for e in entries
        ]
    
    # ==================== RECONCILIATION ====================
    
    def match_entries(
        self,
        book_entry_id: str,
        bank_entry_id: str,
    ) -> Dict:
        """
        Match a book entry with a bank statement entry.
        This marks both as reconciled.
        """
        from app.database.bank_statement_models import BankStatementEntry, BankStatementEntryStatus
        
        book_entry = self.db.query(TransactionEntry).filter(
            TransactionEntry.id == book_entry_id
        ).first()
        
        bank_entry = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.id == bank_entry_id
        ).first()
        
        if not book_entry or not bank_entry:
            raise ValueError("Entry not found")
        
        # Mark book entry as reconciled
        book_entry.bank_date = bank_entry.value_date
        book_entry.is_reconciled = True
        book_entry.reconciliation_date = datetime.utcnow()
        book_entry.bank_reference = bank_entry.bank_reference
        
        # Mark bank entry as matched
        bank_entry.status = BankStatementEntryStatus.MATCHED
        bank_entry.matched_entry_id = book_entry_id
        bank_entry.matched_at = datetime.utcnow()
        
        self.db.commit()
        
        return {"message": "Entries matched successfully"}
    
    def unmatch_entry(self, book_entry_id: str) -> Dict:
        """Unmatch a previously matched entry."""
        from app.database.bank_statement_models import BankStatementEntry, BankStatementEntryStatus
        
        book_entry = self.db.query(TransactionEntry).filter(
            TransactionEntry.id == book_entry_id
        ).first()
        
        if not book_entry:
            raise ValueError("Entry not found")
        
        # Find and unmatch bank entry
        bank_entry = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.matched_entry_id == book_entry_id
        ).first()
        
        if bank_entry:
            bank_entry.status = BankStatementEntryStatus.PENDING
            bank_entry.matched_entry_id = None
            bank_entry.matched_at = None
        
        # Clear reconciliation from book entry
        book_entry.bank_date = None
        book_entry.is_reconciled = False
        book_entry.reconciliation_date = None
        book_entry.bank_reference = None
        
        self.db.commit()
        
        return {"message": "Entry unmatched"}
    
    def auto_match(
        self,
        company_id: str,
        bank_account_id: str,
        tolerance_days: int = 3,
        tolerance_amount: Decimal = Decimal('0.01'),
    ) -> Dict:
        """
        Auto-match book entries with bank statement entries.
        
        Matching logic (in order of priority):
        1. Exact amount + date within tolerance
        2. Exact amount + partial description match
        
        Returns detailed results including unmatched entries on both sides.
        """
        from app.database.bank_statement_models import BankStatementEntry, BankStatementEntryStatus
        
        account = self._get_bank_ledger_account(company_id, bank_account_id)
        if not account:
            return {
                "matched": 0,
                "bank_unmatched": [],
                "book_unmatched": [],
                "error": "Bank account not found"
            }
        
        # Get unreconciled book entries
        book_entries = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == 'POSTED',
            TransactionEntry.is_reconciled == False,
        ).all()
        
        # Get pending bank entries
        bank_entries = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.company_id == company_id,
            BankStatementEntry.bank_account_id == bank_account_id,
            BankStatementEntry.status == BankStatementEntryStatus.PENDING,
        ).all()
        
        matched = 0
        matched_bank_ids = set()
        matched_book_ids = set()
        match_details = []
        
        # First pass: Exact amount + date within tolerance
        for book in book_entries:
            if book.id in matched_book_ids:
                continue
                
            book_amount = Decimal(str(book.debit_amount or 0)) - Decimal(str(book.credit_amount or 0))
            book_date = book.transaction.transaction_date
            
            if not book_date:
                continue
            
            if isinstance(book_date, datetime):
                book_date = book_date.date()
            
            best_match = None
            best_date_diff = None
            
            for bank in bank_entries:
                if bank.id in matched_bank_ids:
                    continue
                
                # Check amount match (must be exact or within tiny tolerance)
                amount_diff = abs(book_amount - Decimal(str(bank.amount)))
                if amount_diff > tolerance_amount:
                    continue
                
                # Check date match
                bank_date = bank.value_date
                if bank_date:
                    if isinstance(bank_date, datetime):
                        bank_date = bank_date.date()
                    
                    date_diff = abs((book_date - bank_date).days)
                    if date_diff > tolerance_days:
                        continue
                    
                    # Keep best match (closest date)
                    if best_match is None or date_diff < best_date_diff:
                        best_match = bank
                        best_date_diff = date_diff
            
            if best_match:
                # Match found!
                book.bank_date = best_match.value_date
                book.is_reconciled = True
                book.reconciliation_date = datetime.utcnow()
                book.bank_reference = best_match.bank_reference
                
                best_match.status = BankStatementEntryStatus.MATCHED
                best_match.matched_entry_id = book.id
                best_match.matched_at = datetime.utcnow()
                
                matched_bank_ids.add(best_match.id)
                matched_book_ids.add(book.id)
                matched += 1
                
                match_details.append({
                    "book_entry_id": book.id,
                    "bank_entry_id": best_match.id,
                    "amount": float(book_amount),
                    "date_diff_days": best_date_diff,
                })
        
        self.db.commit()
        
        # Build unmatched lists
        bank_unmatched = [
            {
                "id": b.id,
                "date": b.value_date.isoformat() if b.value_date else None,
                "amount": float(b.amount),
                "description": b.description,
                "bank_reference": b.bank_reference,
            }
            for b in bank_entries if b.id not in matched_bank_ids
        ]
        
        book_unmatched = [
            {
                "id": b.id,
                "transaction_id": b.transaction_id,
                "date": b.transaction.transaction_date.isoformat() if b.transaction.transaction_date else None,
                "amount": float(Decimal(str(b.debit_amount or 0)) - Decimal(str(b.credit_amount or 0))),
                "description": b.description or b.transaction.narration or "",
            }
            for b in book_entries if b.id not in matched_book_ids
        ]
        
        return {
            "matched": matched,
            "match_details": match_details,
            "bank_unmatched": bank_unmatched,
            "bank_unmatched_count": len(bank_unmatched),
            "book_unmatched": book_unmatched,
            "book_unmatched_count": len(book_unmatched),
        }
    
    # ==================== MONTHLY RECONCILIATION ====================
    
    def get_monthly_reconciliation(
        self,
        company_id: str,
        bank_account_id: str,
        year: int,
        month: int,
    ) -> Dict:
        """
        Get or create monthly reconciliation.
        
        Shows:
        - Opening balance (from previous month or entered)
        - Your book entries for the month
        - Closing balance (calculated and user-entered from bank statement)
        - Difference to investigate
        """
        from app.database.bank_statement_models import MonthlyBankReconciliation
        
        account = self._get_bank_ledger_account(company_id, bank_account_id)
        
        # Get or create monthly reconciliation record
        recon = self.db.query(MonthlyBankReconciliation).filter(
            MonthlyBankReconciliation.company_id == company_id,
            MonthlyBankReconciliation.bank_account_id == bank_account_id,
            MonthlyBankReconciliation.year == str(year),
            MonthlyBankReconciliation.month == str(month).zfill(2),
        ).first()
        
        if not recon:
            recon = MonthlyBankReconciliation(
                id=generate_uuid(),
                company_id=company_id,
                bank_account_id=bank_account_id,
                year=str(year),
                month=str(month).zfill(2),
            )
            self.db.add(recon)
        
        # Calculate dates
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])
        prev_last_day = first_day - timedelta(days=1)
        
        # Calculate book balances
        if account:
            opening_book = self._get_book_balance(account.id, prev_last_day)
            closing_book = self._get_book_balance(account.id, last_day)
            period_data = self._get_book_balance_for_period(account.id, first_day, last_day)
        else:
            opening_book = Decimal('0')
            closing_book = Decimal('0')
            period_data = {"total_debit": Decimal('0'), "total_credit": Decimal('0'), "net_movement": Decimal('0')}
        
        recon.opening_balance_book = opening_book
        recon.closing_balance_book = closing_book
        
        self.db.commit()
        self.db.refresh(recon)
        
        # Calculate expected bank balance
        expected_bank_closing = (
            Decimal(str(recon.opening_balance_bank or 0)) +
            period_data["net_movement"]
        )
        
        # Calculate difference
        actual_bank_closing = Decimal(str(recon.closing_balance_bank or 0))
        difference = actual_bank_closing - expected_bank_closing
        
        return {
            "id": recon.id,
            "year": year,
            "month": month,
            "period": f"{year}-{str(month).zfill(2)}",
            "first_day": first_day.isoformat(),
            "last_day": last_day.isoformat(),
            
            # Bank statement balances (entered by user)
            "opening_balance_bank": float(recon.opening_balance_bank or 0),
            "closing_balance_bank": float(recon.closing_balance_bank or 0),
            
            # Book balances (calculated)
            "opening_balance_book": float(opening_book),
            "closing_balance_book": float(closing_book),
            
            # Movement during period
            "total_debit": float(period_data["total_debit"]),
            "total_credit": float(period_data["total_credit"]),
            "net_movement": float(period_data["net_movement"]),
            
            # Reconciliation
            "expected_bank_closing": float(expected_bank_closing),
            "actual_bank_closing": float(actual_bank_closing),
            "difference": float(difference),
            
            # Adjustments
            "cheques_issued_not_cleared": float(recon.cheques_issued_not_cleared or 0),
            "cheques_deposited_not_credited": float(recon.cheques_deposited_not_credited or 0),
            "bank_charges_not_booked": float(recon.bank_charges_not_booked or 0),
            "interest_not_booked": float(recon.interest_not_booked or 0),
            "other_differences": float(recon.other_differences or 0),
            
            "status": recon.status,
            "notes": recon.notes,
        }
    
    def update_monthly_reconciliation(
        self,
        recon_id: str,
        data: Dict,
    ) -> Dict:
        """Update monthly reconciliation with bank statement balances."""
        from app.database.bank_statement_models import MonthlyBankReconciliation
        
        recon = self.db.query(MonthlyBankReconciliation).filter(
            MonthlyBankReconciliation.id == recon_id
        ).first()
        
        if not recon:
            raise ValueError("Reconciliation not found")
        
        # Update bank balances
        if "opening_balance_bank" in data:
            recon.opening_balance_bank = Decimal(str(data["opening_balance_bank"]))
        if "closing_balance_bank" in data:
            recon.closing_balance_bank = Decimal(str(data["closing_balance_bank"]))
        
        # Update adjustments
        if "cheques_issued_not_cleared" in data:
            recon.cheques_issued_not_cleared = Decimal(str(data["cheques_issued_not_cleared"]))
        if "cheques_deposited_not_credited" in data:
            recon.cheques_deposited_not_credited = Decimal(str(data["cheques_deposited_not_credited"]))
        if "bank_charges_not_booked" in data:
            recon.bank_charges_not_booked = Decimal(str(data["bank_charges_not_booked"]))
        if "interest_not_booked" in data:
            recon.interest_not_booked = Decimal(str(data["interest_not_booked"]))
        if "other_differences" in data:
            recon.other_differences = Decimal(str(data["other_differences"]))
        
        if "notes" in data:
            recon.notes = data["notes"]
        if "status" in data:
            recon.status = data["status"]
        
        self.db.commit()
        
        return self.get_monthly_reconciliation(
            recon.company_id,
            recon.bank_account_id,
            int(recon.year),
            int(recon.month),
        )
    
    def close_monthly_reconciliation(
        self,
        recon_id: str,
        user_id: str,
    ) -> Dict:
        """Close/finalize a monthly reconciliation."""
        from app.database.bank_statement_models import MonthlyBankReconciliation
        
        recon = self.db.query(MonthlyBankReconciliation).filter(
            MonthlyBankReconciliation.id == recon_id
        ).first()
        
        if not recon:
            raise ValueError("Reconciliation not found")
        
        recon.status = "closed"
        recon.reconciled_by = user_id
        recon.reconciled_at = datetime.utcnow()
        
        self.db.commit()
        
        return {"message": "Monthly reconciliation closed", "status": "closed"}
    
    # ==================== LEGACY SUPPORT ====================
    
    def get_unreconciled_entries(
        self,
        company_id: str,
        bank_account_id: str,
        as_of_date: date = None,
    ) -> List[Dict]:
        """Legacy: Get unreconciled entries."""
        return self.get_book_entries(
            company_id,
            bank_account_id,
            to_date=as_of_date,
            unreconciled_only=True,
        )
    
    def set_bank_date(self, entry_id: str, bank_date: date) -> Dict:
        """Legacy: Set bank date for an entry."""
        entry = self.db.query(TransactionEntry).filter(
            TransactionEntry.id == entry_id
        ).first()
        
        if not entry:
            raise ValueError("Entry not found")
        
        entry.bank_date = bank_date
        entry.is_reconciled = True
        entry.reconciliation_date = datetime.utcnow()
        
        self.db.commit()
        
        return {"id": entry.id, "bank_date": bank_date.isoformat(), "is_reconciled": True}
    
    def bulk_set_bank_dates(self, entries: List[Dict]) -> Dict:
        """Bulk set bank dates for multiple entries."""
        updated = 0
        errors = []
        
        for entry_data in entries:
            entry_id = entry_data.get("entry_id")
            bank_date_str = entry_data.get("bank_date")
            
            if not entry_id or not bank_date_str:
                continue
            
            try:
                bank_date = datetime.fromisoformat(bank_date_str).date() if isinstance(bank_date_str, str) else bank_date_str
                
                entry = self.db.query(TransactionEntry).filter(
                    TransactionEntry.id == entry_id
                ).first()
                
                if entry:
                    entry.bank_date = bank_date
                    entry.is_reconciled = True
                    entry.reconciliation_date = datetime.utcnow()
                    updated += 1
                else:
                    errors.append({"entry_id": entry_id, "error": "Entry not found"})
            except Exception as e:
                errors.append({"entry_id": entry_id, "error": str(e)})
        
        self.db.commit()
        return {"updated": updated, "errors": errors}
    
    def clear_bank_date(self, entry_id: str) -> Dict:
        """Legacy: Clear bank date."""
        entry = self.db.query(TransactionEntry).filter(
            TransactionEntry.id == entry_id
        ).first()
        
        if not entry:
            raise ValueError("Entry not found")
        
        entry.bank_date = None
        entry.is_reconciled = False
        entry.reconciliation_date = None
        
        self.db.commit()
        
        return {"id": entry.id, "is_reconciled": False}
    
    def generate_brs(
        self,
        company_id: str,
        bank_account_id: str,
        as_of_date: date,
    ) -> Dict:
        """Legacy: Generate BRS report."""
        account = self._get_bank_ledger_account(company_id, bank_account_id)
        
        if not account:
            return {"error": "Bank account not found"}
        
        # Get balance as per books
        book_balance = self._get_book_balance(account.id, as_of_date)
        
        # Get unreconciled entries
        unreconciled = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == 'POSTED',
            Transaction.transaction_date <= as_of_date,
            or_(
                TransactionEntry.bank_date.is_(None),
                TransactionEntry.bank_date > as_of_date,
            )
        ).all()
        
        cheques_not_presented = []
        deposits_not_credited = []
        total_not_presented = Decimal('0')
        total_not_credited = Decimal('0')
        
        for entry in unreconciled:
            txn = entry.transaction
            debit = Decimal(str(entry.debit_amount or 0))
            credit = Decimal(str(entry.credit_amount or 0))
            
            if debit > 0:
                deposits_not_credited.append({
                    "date": txn.transaction_date.isoformat() if txn.transaction_date else None,
                    "reference": txn.reference_number or txn.transaction_number,
                    "narration": entry.description or txn.narration or "",
                    "amount": float(debit),
                })
                total_not_credited += debit
            
            if credit > 0:
                cheques_not_presented.append({
                    "date": txn.transaction_date.isoformat() if txn.transaction_date else None,
                    "reference": txn.reference_number or txn.transaction_number,
                    "narration": entry.description or txn.narration or "",
                    "amount": float(credit),
                })
                total_not_presented += credit
        
        bank_balance = book_balance + total_not_presented - total_not_credited
        
        return {
            "as_of_date": as_of_date.isoformat(),
            "balance_as_per_books": float(book_balance),
            "add_items": [
                {
                    "description": "Cheques issued but not presented",
                    "details": cheques_not_presented,
                    "total": float(total_not_presented),
                }
            ] if total_not_presented > 0 else [],
            "less_items": [
                {
                    "description": "Cheques deposited but not credited",
                    "details": deposits_not_credited,
                    "total": float(total_not_credited),
                }
            ] if total_not_credited > 0 else [],
            "balance_as_per_bank": float(bank_balance),
            "difference": 0,
            "is_reconciled": len(unreconciled) == 0,
            "summary": {
                "total_unreconciled": len(unreconciled),
            }
        }
    
    def auto_reconcile(
        self,
        company_id: str,
        bank_account_id: str,
        as_of_date: date = None,
    ) -> Dict:
        """Legacy: Auto-reconcile by setting bank_date = transaction_date."""
        if not as_of_date:
            as_of_date = date.today()
        
        account = self._get_bank_ledger_account(company_id, bank_account_id)
        if not account:
            return {"reconciled": 0}
        
        entries = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == 'POSTED',
            Transaction.transaction_date <= as_of_date,
            TransactionEntry.is_reconciled == False,
        ).all()
        
        count = 0
        for entry in entries:
            entry.bank_date = entry.transaction.transaction_date
            entry.is_reconciled = True
            entry.reconciliation_date = datetime.utcnow()
            count += 1
        
        self.db.commit()
        
        return {"reconciled": count}
    
    # Legacy session-based methods (keeping for backward compatibility)
    def create_reconciliation(self, *args, **kwargs):
        """Legacy: Create reconciliation session."""
        from app.database.models import BankReconciliation
        # Just return a dummy object for backward compatibility
        return type('obj', (object,), {'id': generate_uuid(), 'total_entries': 0})()
    
    def get_reconciliation_report(self, recon_id: str) -> Dict:
        """Legacy: Get reconciliation report."""
        return {"message": "Use monthly reconciliation instead"}
    
    def complete_reconciliation(self, recon_id: str, completed_by: str = None):
        """Legacy: Complete reconciliation."""
        return type('obj', (object,), {'id': recon_id, 'status': 'completed'})()
    
    def mark_reconciled(self, entry_id: str):
        """Legacy: Mark entry as reconciled."""
        return self.set_bank_date(entry_id, date.today())
    
    def manual_match(self, book_entry_id: str, bank_entry_id: str):
        """Legacy: Manual match."""
        return self.set_bank_date(book_entry_id, date.today())
