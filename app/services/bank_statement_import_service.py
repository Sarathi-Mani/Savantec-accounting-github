"""
Bank Statement Import Service - Tally-style bank statement processing.

This service handles:
1. Importing bank statements to BankStatementEntry table (NOT transactions)
2. Auto-matching with existing book entries
3. Creating transactions for unmatched entries when categorized
4. Marking entries as bank charges/interest
"""
import csv
import io
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.database.models import (
    Company, BankAccount, Account, Transaction, TransactionEntry,
    TransactionStatus, generate_uuid
)
from app.database.bank_statement_models import (
    BankStatementEntry, BankStatementEntryStatus
)
from app.services.bank_import_service import (
    HDFCParser, ICICIParser, SBIParser, AxisParser, GenericParser, CustomMappingParser
)


class BankStatementImportService:
    """
    Tally-style bank statement import service.
    
    Key difference from old BankImportService:
    - Imports go to BankStatementEntry table (bank's records)
    - Auto-matches with TransactionEntry (your book records)
    - Creates transactions only for categorized unmatched entries
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.parsers = [
            HDFCParser(),
            ICICIParser(),
            SBIParser(),
            AxisParser(),
            GenericParser(),
        ]
    
    def _get_bank_ledger_account(self, company_id: str, bank_account_id: str) -> Optional[Account]:
        """Get the ledger account linked to a bank account."""
        return self.db.query(Account).filter(
            Account.company_id == company_id,
            Account.bank_account_id == bank_account_id,
        ).first()
    
    def preview_csv(self, content: str) -> Dict[str, Any]:
        """Preview CSV content and return headers and sample rows."""
        if content.startswith('\ufeff'):
            content = content[1:]
        
        reader = csv.DictReader(io.StringIO(content))
        headers = [h for h in (reader.fieldnames or []) if h is not None]
        
        sample_rows = []
        for i, row in enumerate(reader):
            if i >= 5:
                break
            sample_rows.append({k: v for k, v in row.items() if k is not None})
        
        # Detect bank format
        detected_bank = None
        for parser in self.parsers[:-1]:
            if parser.can_parse(headers, [list(r.values()) for r in sample_rows]):
                detected_bank = parser.bank_name
                break
        
        # Count total rows
        reader = csv.DictReader(io.StringIO(content))
        row_count = sum(1 for _ in reader)
        
        return {
            'headers': headers,
            'sample_rows': sample_rows,
            'detected_bank': detected_bank,
            'row_count': row_count,
        }
    
    def import_statement(
        self,
        company_id: str,
        bank_account_id: str,
        content: str,
        file_name: str = "import",
        bank_name: Optional[str] = None,
        column_mapping: Optional[Dict[str, str]] = None,
        auto_match: bool = True,
    ) -> Dict[str, Any]:
        """
        Import bank statement to BankStatementEntry table.
        
        This is the main entry point - imports bank data and optionally auto-matches.
        
        Returns:
            {
                "imported": int,
                "duplicates_skipped": int,
                "auto_matched": int,
                "pending": int,
            }
        """
        if content.startswith('\ufeff'):
            content = content[1:]
        
        # Select parser
        if column_mapping:
            parser = CustomMappingParser({
                'date': column_mapping.get('date_column', ''),
                'description': column_mapping.get('description_column', ''),
                'debit': column_mapping.get('debit_column', ''),
                'credit': column_mapping.get('credit_column', ''),
                'reference': column_mapping.get('reference_column', ''),
                'balance': column_mapping.get('balance_column', ''),
            })
            detected_bank = bank_name or "Custom"
        else:
            reader = csv.DictReader(io.StringIO(content))
            headers = [h for h in (reader.fieldnames or []) if h is not None]
            
            # Detect bank format
            parser = self.parsers[-1]  # Default to generic
            detected_bank = "Generic"
            for p in self.parsers[:-1]:
                if p.can_parse(headers, []):
                    parser = p
                    detected_bank = p.bank_name
                    break
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(content))
        rows = [{k: v for k, v in row.items() if k is not None} for row in reader]
        
        imported = 0
        duplicates = 0
        
        for i, row in enumerate(rows, 1):
            try:
                parsed = parser.parse_row(row, i)
                
                if not parsed:
                    continue
                
                # Skip rows with no amount
                debit = parsed.get('debit_amount', Decimal('0')) or Decimal('0')
                credit = parsed.get('credit_amount', Decimal('0')) or Decimal('0')
                
                if debit == 0 and credit == 0:
                    continue
                
                # Calculate net amount (positive = money in, negative = money out)
                amount = credit - debit
                
                value_date = parsed.get('value_date') or parsed.get('transaction_date')
                if not value_date:
                    continue
                
                # Check for duplicate
                existing = self.db.query(BankStatementEntry).filter(
                    BankStatementEntry.company_id == company_id,
                    BankStatementEntry.bank_account_id == bank_account_id,
                    BankStatementEntry.value_date == value_date,
                    BankStatementEntry.amount == amount,
                    BankStatementEntry.description == parsed.get('description', ''),
                ).first()
                
                if existing:
                    duplicates += 1
                    continue
                
                # Create BankStatementEntry
                entry = BankStatementEntry(
                    id=generate_uuid(),
                    company_id=company_id,
                    bank_account_id=bank_account_id,
                    value_date=value_date,
                    transaction_date=parsed.get('transaction_date'),
                    amount=amount,
                    bank_reference=parsed.get('reference_number'),
                    description=parsed.get('description', ''),
                    balance=parsed.get('balance'),
                    status=BankStatementEntryStatus.PENDING,
                )
                self.db.add(entry)
                imported += 1
                
            except Exception as e:
                continue
        
        self.db.commit()
        
        # Auto-match if requested
        matched = 0
        if auto_match and imported > 0:
            match_result = self.auto_match_entries(company_id, bank_account_id)
            matched = match_result.get('matched', 0)
        
        # Count pending
        pending = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.company_id == company_id,
            BankStatementEntry.bank_account_id == bank_account_id,
            BankStatementEntry.status == BankStatementEntryStatus.PENDING,
        ).count()
        
        return {
            "imported": imported,
            "duplicates_skipped": duplicates,
            "auto_matched": matched,
            "pending": pending,
            "bank_detected": detected_bank,
        }
    
    def auto_match_entries(
        self,
        company_id: str,
        bank_account_id: str,
        tolerance_days: int = 3,
        tolerance_amount: Decimal = Decimal('0.01'),
    ) -> Dict[str, Any]:
        """
        Auto-match bank statement entries with book entries.
        
        Matching logic:
        1. Exact amount match
        2. Date within tolerance
        3. One-to-one matching (each entry can only match once)
        """
        account = self._get_bank_ledger_account(company_id, bank_account_id)
        if not account:
            return {"matched": 0, "error": "Bank account not found"}
        
        # Get pending bank statement entries
        bank_entries = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.company_id == company_id,
            BankStatementEntry.bank_account_id == bank_account_id,
            BankStatementEntry.status == BankStatementEntryStatus.PENDING,
        ).all()
        
        # Get unreconciled book entries for this account
        book_entries = self.db.query(TransactionEntry).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == TransactionStatus.POSTED,
            TransactionEntry.is_reconciled == False,
        ).all()
        
        matched = 0
        matched_book_ids = set()
        
        for bank_entry in bank_entries:
            if bank_entry.status != BankStatementEntryStatus.PENDING:
                continue
            
            bank_amount = Decimal(str(bank_entry.amount))
            bank_date = bank_entry.value_date
            if isinstance(bank_date, datetime):
                bank_date = bank_date.date()
            
            for book_entry in book_entries:
                if book_entry.id in matched_book_ids:
                    continue
                
                # Calculate book entry amount (from bank's perspective)
                # Debit to bank account = money in = positive
                # Credit to bank account = money out = negative
                book_debit = Decimal(str(book_entry.debit_amount or 0))
                book_credit = Decimal(str(book_entry.credit_amount or 0))
                book_amount = book_debit - book_credit
                
                # Check amount match
                if abs(bank_amount - book_amount) > tolerance_amount:
                    continue
                
                # Check date match
                txn_date = book_entry.transaction.transaction_date
                if txn_date:
                    if isinstance(txn_date, datetime):
                        txn_date = txn_date.date()
                    
                    date_diff = abs((bank_date - txn_date).days)
                    if date_diff > tolerance_days:
                        continue
                
                # Match found!
                bank_entry.status = BankStatementEntryStatus.MATCHED
                bank_entry.matched_entry_id = book_entry.id
                bank_entry.matched_at = datetime.utcnow()
                
                book_entry.bank_date = bank_entry.value_date
                book_entry.is_reconciled = True
                book_entry.reconciliation_date = datetime.utcnow()
                book_entry.bank_reference = bank_entry.bank_reference
                
                matched_book_ids.add(book_entry.id)
                matched += 1
                break
        
        self.db.commit()
        
        return {"matched": matched}
    
    def get_statement_entries(
        self,
        company_id: str,
        bank_account_id: str,
        status: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[Dict]:
        """Get bank statement entries with optional filters."""
        query = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.company_id == company_id,
            BankStatementEntry.bank_account_id == bank_account_id,
        )
        
        if status:
            try:
                status_enum = BankStatementEntryStatus(status)
                query = query.filter(BankStatementEntry.status == status_enum)
            except ValueError:
                pass
        
        if from_date:
            query = query.filter(BankStatementEntry.value_date >= from_date)
        if to_date:
            query = query.filter(BankStatementEntry.value_date <= to_date)
        
        entries = query.order_by(BankStatementEntry.value_date.desc()).all()
        
        return [
            {
                "id": e.id,
                "value_date": e.value_date.isoformat() if e.value_date else None,
                "transaction_date": e.transaction_date.isoformat() if e.transaction_date else None,
                "amount": float(e.amount),
                "is_credit": float(e.amount) > 0,
                "bank_reference": e.bank_reference,
                "description": e.description,
                "balance": float(e.balance) if e.balance else None,
                "status": e.status.value if e.status else "pending",
                "matched_entry_id": e.matched_entry_id,
                "booked_transaction_id": e.booked_transaction_id,
            }
            for e in entries
        ]
    
    def get_reconciliation_summary(
        self,
        company_id: str,
        bank_account_id: str,
    ) -> Dict[str, Any]:
        """Get summary of reconciliation status."""
        # Count by status
        status_counts = {}
        for status in BankStatementEntryStatus:
            count = self.db.query(BankStatementEntry).filter(
                BankStatementEntry.company_id == company_id,
                BankStatementEntry.bank_account_id == bank_account_id,
                BankStatementEntry.status == status,
            ).count()
            status_counts[status.value] = count
        
        # Get unreconciled book entries
        account = self._get_bank_ledger_account(company_id, bank_account_id)
        unreconciled_book = 0
        if account:
            unreconciled_book = self.db.query(TransactionEntry).join(Transaction).filter(
                TransactionEntry.account_id == account.id,
                Transaction.status == TransactionStatus.POSTED,
                TransactionEntry.is_reconciled == False,
            ).count()
        
        return {
            "bank_entries": status_counts,
            "unreconciled_book_entries": unreconciled_book,
            "total_bank_entries": sum(status_counts.values()),
        }
    
    def create_transaction_from_entry(
        self,
        company_id: str,
        bank_account_id: str,
        entry_id: str,
        category_account_id: str,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a transaction from an unmatched bank statement entry.
        
        This is called when user categorizes an unmatched bank entry.
        Creates proper double-entry transaction:
        - If bank entry is positive (money in): Debit Bank, Credit Category
        - If bank entry is negative (money out): Debit Category, Credit Bank
        """
        from app.services.accounting_service import AccountingService
        
        # Get bank statement entry
        entry = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.id == entry_id,
            BankStatementEntry.company_id == company_id,
            BankStatementEntry.bank_account_id == bank_account_id,
        ).first()
        
        if not entry:
            raise ValueError("Bank statement entry not found")
        
        if entry.status == BankStatementEntryStatus.MATCHED:
            raise ValueError("Entry is already matched")
        
        if entry.booked_transaction_id:
            raise ValueError("Entry already has a transaction")
        
        # Get bank ledger account
        bank_account = self._get_bank_ledger_account(company_id, bank_account_id)
        if not bank_account:
            raise ValueError("Bank ledger account not found")
        
        # Get category account
        category_account = self.db.query(Account).filter(
            Account.id == category_account_id,
            Account.company_id == company_id,
        ).first()
        
        if not category_account:
            raise ValueError("Category account not found")
        
        # Get company
        company = self.db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise ValueError("Company not found")
        
        amount = abs(Decimal(str(entry.amount)))
        is_credit = float(entry.amount) > 0  # Positive = money into bank
        
        # Create transaction entries
        from app.schemas.accounting import TransactionCreate, TransactionEntryCreate, ReferenceType
        
        if is_credit:
            # Money IN: Debit Bank, Credit Category (e.g., revenue)
            entries = [
                TransactionEntryCreate(
                    account_id=bank_account.id,
                    description=description or entry.description,
                    debit_amount=amount,
                    credit_amount=Decimal("0"),
                ),
                TransactionEntryCreate(
                    account_id=category_account_id,
                    description=description or entry.description,
                    debit_amount=Decimal("0"),
                    credit_amount=amount,
                ),
            ]
        else:
            # Money OUT: Debit Category (e.g., expense), Credit Bank
            entries = [
                TransactionEntryCreate(
                    account_id=category_account_id,
                    description=description or entry.description,
                    debit_amount=amount,
                    credit_amount=Decimal("0"),
                ),
                TransactionEntryCreate(
                    account_id=bank_account.id,
                    description=description or entry.description,
                    debit_amount=Decimal("0"),
                    credit_amount=amount,
                ),
            ]
        
        transaction_data = TransactionCreate(
            transaction_date=entry.value_date,
            description=description or entry.description or "Bank Import",
            reference_type=ReferenceType.BANK_IMPORT,
            reference_number=entry.bank_reference,
            entries=entries,
        )
        
        accounting_service = AccountingService(self.db)
        transaction = accounting_service.create_journal_entry(
            company,
            transaction_data,
            auto_post=True,
        )
        
        # Link entry to transaction and mark as matched
        entry.booked_transaction_id = transaction.id
        entry.status = BankStatementEntryStatus.MATCHED
        entry.matched_at = datetime.utcnow()
        
        # Find and mark the book entry as reconciled
        book_entry = self.db.query(TransactionEntry).filter(
            TransactionEntry.transaction_id == transaction.id,
            TransactionEntry.account_id == bank_account.id,
        ).first()
        
        if book_entry:
            book_entry.bank_date = entry.value_date
            book_entry.is_reconciled = True
            book_entry.reconciliation_date = datetime.utcnow()
            book_entry.bank_reference = entry.bank_reference
            entry.matched_entry_id = book_entry.id
        
        self.db.commit()
        
        return {
            "transaction_id": transaction.id,
            "entry_id": entry.id,
            "status": "matched",
        }
    
    def mark_as_bank_charges(
        self,
        company_id: str,
        bank_account_id: str,
        entry_id: str,
        charge_type: str = "bank_charges",  # bank_charges, interest_received, interest_paid
    ) -> Dict[str, Any]:
        """
        Mark a bank statement entry as bank charges/interest.
        
        This is a convenience method that creates a transaction with the 
        appropriate account (Bank Charges expense or Interest income/expense).
        """
        # Get entry
        entry = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.id == entry_id,
            BankStatementEntry.company_id == company_id,
        ).first()
        
        if not entry:
            raise ValueError("Entry not found")
        
        # Find appropriate account based on charge type
        account_mapping = {
            "bank_charges": ("5040", "Bank Charges"),  # Expense
            "interest_paid": ("5041", "Interest Paid"),  # Expense
            "interest_received": ("4030", "Interest Income"),  # Revenue
        }
        
        code, name = account_mapping.get(charge_type, ("5040", "Bank Charges"))
        
        # Find or create the account
        category_account = self.db.query(Account).filter(
            Account.company_id == company_id,
            Account.code == code,
        ).first()
        
        if not category_account:
            # Get expense or revenue type
            from app.database.models import AccountType
            acc_type = AccountType.EXPENSE if code.startswith("5") else AccountType.REVENUE
            
            category_account = Account(
                id=generate_uuid(),
                company_id=company_id,
                code=code,
                name=name,
                account_type=acc_type,
                is_system=True,
                is_active=True,
            )
            self.db.add(category_account)
            self.db.flush()
        
        # Create transaction
        return self.create_transaction_from_entry(
            company_id=company_id,
            bank_account_id=bank_account_id,
            entry_id=entry_id,
            category_account_id=category_account.id,
            description=f"{name}: {entry.description or entry.bank_reference or ''}",
        )
    
    def manual_match(
        self,
        bank_entry_id: str,
        book_entry_id: str,
    ) -> Dict[str, Any]:
        """
        Manually match a bank statement entry with a book entry.
        
        Used when auto-match fails but user knows they should be matched.
        """
        bank_entry = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.id == bank_entry_id,
        ).first()
        
        book_entry = self.db.query(TransactionEntry).filter(
            TransactionEntry.id == book_entry_id,
        ).first()
        
        if not bank_entry or not book_entry:
            raise ValueError("Entry not found")
        
        if bank_entry.status == BankStatementEntryStatus.MATCHED:
            raise ValueError("Bank entry is already matched")
        
        if book_entry.is_reconciled:
            raise ValueError("Book entry is already reconciled")
        
        # Match them
        bank_entry.status = BankStatementEntryStatus.MATCHED
        bank_entry.matched_entry_id = book_entry.id
        bank_entry.matched_at = datetime.utcnow()
        
        book_entry.bank_date = bank_entry.value_date
        book_entry.is_reconciled = True
        book_entry.reconciliation_date = datetime.utcnow()
        book_entry.bank_reference = bank_entry.bank_reference
        
        self.db.commit()
        
        return {"message": "Entries matched successfully"}
    
    def unmatch_entry(self, bank_entry_id: str) -> Dict[str, Any]:
        """Unmatch a previously matched bank statement entry."""
        bank_entry = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.id == bank_entry_id,
        ).first()
        
        if not bank_entry:
            raise ValueError("Bank entry not found")
        
        # Unmatch book entry if linked
        if bank_entry.matched_entry_id:
            book_entry = self.db.query(TransactionEntry).filter(
                TransactionEntry.id == bank_entry.matched_entry_id,
            ).first()
            
            if book_entry:
                book_entry.bank_date = None
                book_entry.is_reconciled = False
                book_entry.reconciliation_date = None
                book_entry.bank_reference = None
        
        # Reset bank entry
        bank_entry.status = BankStatementEntryStatus.PENDING
        bank_entry.matched_entry_id = None
        bank_entry.matched_at = None
        
        self.db.commit()
        
        return {"message": "Entry unmatched"}
    
    def delete_entry(self, entry_id: str) -> Dict[str, Any]:
        """Delete a bank statement entry (only if not matched)."""
        entry = self.db.query(BankStatementEntry).filter(
            BankStatementEntry.id == entry_id,
        ).first()
        
        if not entry:
            raise ValueError("Entry not found")
        
        if entry.status == BankStatementEntryStatus.MATCHED:
            raise ValueError("Cannot delete matched entry. Unmatch first.")
        
        self.db.delete(entry)
        self.db.commit()
        
        return {"message": "Entry deleted"}

