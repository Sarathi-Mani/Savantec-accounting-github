"""
Cheque Management Service - Track cheques issued and received.

Features:
- Cheque book management
- Issue and receive cheques
- Track clearing and bouncing
- Stop payment functionality
- Automatic accounting entries for all cheque operations
"""
from decimal import Decimal
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    ChequeBook, Cheque, ChequeStatus, ChequeType, 
    BankAccount, Transaction, Company, generate_uuid
)


class ChequeService:
    """Service for cheque management with accounting integration."""
    
    def __init__(self, db: Session):
        self.db = db
        self._accounting_service = None
    
    @property
    def accounting_service(self):
        """Lazy load AccountingService to avoid circular imports."""
        if self._accounting_service is None:
            from app.services.accounting_service import AccountingService
            self._accounting_service = AccountingService(self.db)
        return self._accounting_service
    
    def _get_company(self, company_id: str) -> Company:
        """Get company by ID."""
        company = self.db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise ValueError("Company not found")
        return company
    
    def _get_bank_account(self, bank_account_id: str) -> Optional[BankAccount]:
        """Get bank account by ID."""
        if not bank_account_id:
            return None
        return self.db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    
    # ==================== CHEQUE BOOK MANAGEMENT ====================
    
    def create_cheque_book(
        self,
        company_id: str,
        bank_account_id: str,
        cheque_series_from: str,
        cheque_series_to: str,
        book_name: str = None,
        received_date: datetime = None,
    ) -> ChequeBook:
        """Create a new cheque book record."""
        # Calculate total leaves
        try:
            from_num = int(cheque_series_from)
            to_num = int(cheque_series_to)
            total_leaves = to_num - from_num + 1
        except ValueError:
            total_leaves = 0
        
        cheque_book = ChequeBook(
            id=generate_uuid(),
            company_id=company_id,
            bank_account_id=bank_account_id,
            book_name=book_name,
            cheque_series_from=cheque_series_from,
            cheque_series_to=cheque_series_to,
            current_cheque=cheque_series_from,
            total_leaves=total_leaves,
            used_leaves=0,
            received_date=received_date or datetime.utcnow(),
            is_active=True,
        )
        
        self.db.add(cheque_book)
        self.db.commit()
        self.db.refresh(cheque_book)
        
        return cheque_book
    
    def get_cheque_book(self, book_id: str) -> Optional[ChequeBook]:
        return self.db.query(ChequeBook).filter(ChequeBook.id == book_id).first()
    
    def list_cheque_books(
        self,
        company_id: str,
        bank_account_id: str = None,
        active_only: bool = True,
    ) -> List[ChequeBook]:
        query = self.db.query(ChequeBook).filter(ChequeBook.company_id == company_id)
        
        if bank_account_id:
            query = query.filter(ChequeBook.bank_account_id == bank_account_id)
        
        if active_only:
            query = query.filter(ChequeBook.is_active == True)
        
        return query.all()
    
    def get_next_cheque_number(self, book_id: str) -> Optional[str]:
        """Get the next available cheque number from a book."""
        book = self.get_cheque_book(book_id)
        if not book or not book.is_active:
            return None
        
        # Get current number
        current = book.current_cheque
        try:
            current_num = int(current)
            to_num = int(book.cheque_series_to)
            
            if current_num > to_num:
                return None  # Book exhausted
            
            return str(current_num).zfill(len(book.cheque_series_from))
        except ValueError:
            return current
    
    def _increment_cheque_number(self, book: ChequeBook):
        """Increment the current cheque number."""
        try:
            current_num = int(book.current_cheque)
            book.current_cheque = str(current_num + 1).zfill(len(book.cheque_series_from))
            book.used_leaves += 1
            
            # Check if book is exhausted
            if current_num >= int(book.cheque_series_to):
                book.is_active = False
        except ValueError:
            pass
    
    # ==================== CHEQUE OPERATIONS ====================
    
    def issue_cheque(
        self,
        company_id: str,
        cheque_book_id: str,
        cheque_date: datetime,
        amount: Decimal,
        payee_name: str,
        party_id: str = None,
        party_type: str = None,
        invoice_id: str = None,
        invoice_type: str = None,
        bank_account_id: str = None,
        notes: str = None,
        create_accounting_entry: bool = True,
    ) -> Cheque:
        """
        Issue a cheque from a cheque book.
        
        Creates accounting entry:
        Dr. Accounts Payable (2000) - Vendor owes less
        Cr. Bank (1010) - Money going out
        """
        book = self.get_cheque_book(cheque_book_id)
        if not book:
            raise ValueError("Cheque book not found")
        
        cheque_number = self.get_next_cheque_number(cheque_book_id)
        if not cheque_number:
            raise ValueError("No cheques available in this book")
        
        cheque = Cheque(
            id=generate_uuid(),
            company_id=company_id,
            cheque_book_id=cheque_book_id,
            cheque_type=ChequeType.ISSUED,
            cheque_number=cheque_number,
            cheque_date=cheque_date,
            bank_account_id=bank_account_id or book.bank_account_id,
            amount=amount,
            payee_name=payee_name,
            party_id=party_id,
            party_type=party_type,
            invoice_id=invoice_id,
            invoice_type=invoice_type,
            status=ChequeStatus.ISSUED,
            issue_date=datetime.utcnow(),
            notes=notes,
        )
        
        self.db.add(cheque)
        self._increment_cheque_number(book)
        self.db.flush()  # Get the cheque ID before creating accounting entry
        
        # Create accounting entry
        if create_accounting_entry:
            try:
                company = self._get_company(company_id)
                bank_account = self._get_bank_account(cheque.bank_account_id)
                
                transaction = self.accounting_service.create_cheque_issue_entries(
                    company=company,
                    cheque_id=cheque.id,
                    amount=Decimal(str(amount)),
                    cheque_number=cheque_number,
                    payee_name=payee_name,
                    cheque_date=cheque_date,
                    bank_account=bank_account,
                )
                
                if transaction:
                    cheque.transaction_id = transaction.id
            except Exception as e:
                # Log but don't fail the cheque operation
                print(f"Warning: Could not create accounting entry for cheque issue: {e}")
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def receive_cheque(
        self,
        company_id: str,
        cheque_number: str,
        cheque_date: datetime,
        amount: Decimal,
        drawer_name: str,
        drawn_on_bank: str = None,
        drawn_on_branch: str = None,
        party_id: str = None,
        party_type: str = None,
        invoice_id: str = None,
        invoice_type: str = None,
        notes: str = None,
        create_accounting_entry: bool = True,
    ) -> Cheque:
        """
        Record a cheque received from a party.
        
        Creates accounting entry:
        Dr. Cheques in Hand (1120) - We have the cheque
        Cr. Accounts Receivable (1100) - Customer owes less
        """
        cheque = Cheque(
            id=generate_uuid(),
            company_id=company_id,
            cheque_type=ChequeType.RECEIVED,
            cheque_number=cheque_number,
            cheque_date=cheque_date,
            drawn_on_bank=drawn_on_bank,
            drawn_on_branch=drawn_on_branch,
            amount=amount,
            drawer_name=drawer_name,
            party_id=party_id,
            party_type=party_type,
            invoice_id=invoice_id,
            invoice_type=invoice_type,
            status=ChequeStatus.RECEIVED,
            notes=notes,
        )
        
        self.db.add(cheque)
        self.db.flush()  # Get the cheque ID before creating accounting entry
        
        # Create accounting entry
        if create_accounting_entry:
            try:
                company = self._get_company(company_id)
                
                transaction = self.accounting_service.create_cheque_receive_entries(
                    company=company,
                    cheque_id=cheque.id,
                    amount=Decimal(str(amount)),
                    cheque_number=cheque_number,
                    drawer_name=drawer_name,
                    cheque_date=cheque_date,
                )
                
                if transaction:
                    cheque.transaction_id = transaction.id
            except Exception as e:
                # Log but don't fail the cheque operation
                print(f"Warning: Could not create accounting entry for cheque receive: {e}")
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def deposit_cheque(
        self,
        cheque_id: str,
        bank_account_id: str,
        deposit_date: datetime = None,
        create_accounting_entry: bool = True,
    ) -> Cheque:
        """
        Mark a received cheque as deposited.
        
        Creates accounting entry:
        Dr. Bank (1010) - Money going into bank
        Cr. Cheques in Hand (1120) - Cheque asset converted to bank
        """
        cheque = self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
        if not cheque:
            raise ValueError("Cheque not found")
        
        if cheque.cheque_type != ChequeType.RECEIVED:
            raise ValueError("Can only deposit received cheques")
        
        if cheque.status not in [ChequeStatus.RECEIVED, ChequeStatus.BOUNCED]:
            raise ValueError(f"Cannot deposit cheque in status: {cheque.status}")
        
        cheque.status = ChequeStatus.DEPOSITED
        cheque.bank_account_id = bank_account_id
        cheque.deposit_date = deposit_date or datetime.utcnow()
        
        # Create accounting entry
        if create_accounting_entry:
            try:
                company = self._get_company(cheque.company_id)
                bank_account = self._get_bank_account(bank_account_id)
                
                transaction = self.accounting_service.create_cheque_deposit_entries(
                    company=company,
                    cheque_id=cheque.id,
                    amount=Decimal(str(cheque.amount)),
                    cheque_number=cheque.cheque_number,
                    drawer_name=cheque.drawer_name or "Unknown",
                    bank_account=bank_account,
                    deposit_date=cheque.deposit_date,
                )
                
                if transaction:
                    # Store the deposit transaction separately (optional - or update the main one)
                    pass  # The transaction is linked via reference_id
            except Exception as e:
                # Log but don't fail the cheque operation
                print(f"Warning: Could not create accounting entry for cheque deposit: {e}")
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def clear_cheque(
        self,
        cheque_id: str,
        clearing_date: datetime = None,
    ) -> Cheque:
        """
        Mark a cheque as cleared.
        No accounting entry needed - the deposit entry already recorded the bank credit.
        """
        cheque = self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
        if not cheque:
            raise ValueError("Cheque not found")
        
        cheque.status = ChequeStatus.CLEARED
        cheque.clearing_date = clearing_date or datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def bounce_cheque(
        self,
        cheque_id: str,
        bounce_reason: str,
        bounce_charges: Decimal = Decimal('0'),
        bounce_date: datetime = None,
        create_accounting_entry: bool = True,
    ) -> Cheque:
        """
        Mark a cheque as bounced.
        
        Creates accounting entry to reverse the deposit:
        Dr. Accounts Receivable (1100) - Customer owes us again
        Cr. Bank (1010) - Money reversed from bank
        
        If bounce charges:
        Dr. Bank Charges (6600)
        Cr. Bank (1010)
        """
        cheque = self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
        if not cheque:
            raise ValueError("Cheque not found")
        
        previous_status = cheque.status
        
        cheque.status = ChequeStatus.BOUNCED
        cheque.bounce_date = bounce_date or datetime.utcnow()
        cheque.bounce_reason = bounce_reason
        cheque.bounce_charges = bounce_charges
        
        # Create accounting entry only if the cheque was deposited
        if create_accounting_entry and previous_status == ChequeStatus.DEPOSITED:
            try:
                company = self._get_company(cheque.company_id)
                bank_account = self._get_bank_account(cheque.bank_account_id)
                
                transaction = self.accounting_service.create_cheque_bounce_entries(
                    company=company,
                    cheque_id=cheque.id,
                    amount=Decimal(str(cheque.amount)),
                    cheque_number=cheque.cheque_number,
                    drawer_name=cheque.drawer_name or "Unknown",
                    bounce_charges=Decimal(str(bounce_charges)),
                    bounce_date=cheque.bounce_date,
                    bank_account=bank_account,
                )
            except Exception as e:
                # Log but don't fail the cheque operation
                print(f"Warning: Could not create accounting entry for cheque bounce: {e}")
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def stop_payment(
        self,
        cheque_id: str,
        stop_reason: str,
        create_accounting_entry: bool = True,
    ) -> Cheque:
        """
        Stop payment on an issued cheque.
        
        Creates accounting entry to reverse the issue:
        Dr. Bank (1010) - Money back in bank
        Cr. Accounts Payable (2000) - We owe the vendor again
        """
        cheque = self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
        if not cheque:
            raise ValueError("Cheque not found")
        
        if cheque.cheque_type != ChequeType.ISSUED:
            raise ValueError("Can only stop payment on issued cheques")
        
        if cheque.status == ChequeStatus.CLEARED:
            raise ValueError("Cannot stop payment on cleared cheque")
        
        cheque.status = ChequeStatus.STOPPED
        cheque.stop_date = datetime.utcnow()
        cheque.stop_reason = stop_reason
        
        # Create accounting entry
        if create_accounting_entry:
            try:
                company = self._get_company(cheque.company_id)
                bank_account = self._get_bank_account(cheque.bank_account_id)
                
                transaction = self.accounting_service.create_cheque_stop_entries(
                    company=company,
                    cheque_id=cheque.id,
                    amount=Decimal(str(cheque.amount)),
                    cheque_number=cheque.cheque_number,
                    payee_name=cheque.payee_name or "Unknown",
                    stop_date=cheque.stop_date,
                    bank_account=bank_account,
                )
            except Exception as e:
                # Log but don't fail the cheque operation
                print(f"Warning: Could not create accounting entry for stop payment: {e}")
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def cancel_cheque(self, cheque_id: str, reason: str = None) -> Cheque:
        """Cancel a cheque."""
        cheque = self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
        if not cheque:
            raise ValueError("Cheque not found")
        
        if cheque.status == ChequeStatus.CLEARED:
            raise ValueError("Cannot cancel cleared cheque")
        
        cheque.status = ChequeStatus.CANCELLED
        if reason:
            cheque.notes = (cheque.notes or "") + f"\nCancelled: {reason}"
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def update_cheque(
        self,
        cheque_id: str,
        cheque_date: datetime = None,
        amount: Decimal = None,
        payee_name: str = None,
        drawer_name: str = None,
        notes: str = None,
    ) -> Cheque:
        """Update cheque details (only for pending cheques)."""
        cheque = self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
        if not cheque:
            raise ValueError("Cheque not found")
        
        if cheque.status in [ChequeStatus.CLEARED, ChequeStatus.DEPOSITED]:
            raise ValueError("Cannot update cheque after it has been deposited or cleared")
        
        if cheque_date is not None:
            cheque.cheque_date = cheque_date
        if amount is not None:
            cheque.amount = amount
        if payee_name is not None:
            cheque.payee_name = payee_name
        if drawer_name is not None:
            cheque.drawer_name = drawer_name
        if notes is not None:
            cheque.notes = notes
        
        self.db.commit()
        self.db.refresh(cheque)
        
        return cheque
    
    def delete_cheque(self, cheque_id: str) -> bool:
        """Delete a cheque (only for pending/cancelled cheques)."""
        cheque = self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
        if not cheque:
            return False
        
        if cheque.status in [ChequeStatus.CLEARED, ChequeStatus.DEPOSITED]:
            raise ValueError("Cannot delete cheque that has been deposited or cleared")
        
        self.db.delete(cheque)
        self.db.commit()
        return True
    
    # ==================== QUERY METHODS ====================
    
    def get_cheque(self, cheque_id: str) -> Optional[Cheque]:
        return self.db.query(Cheque).filter(Cheque.id == cheque_id).first()
    
    def list_cheques(
        self,
        company_id: str,
        cheque_type: ChequeType = None,
        status: ChequeStatus = None,
        bank_account_id: str = None,
        party_id: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> List[Cheque]:
        query = self.db.query(Cheque).filter(Cheque.company_id == company_id)
        
        if cheque_type:
            query = query.filter(Cheque.cheque_type == cheque_type)
        
        if status:
            query = query.filter(Cheque.status == status)
        
        if bank_account_id:
            query = query.filter(Cheque.bank_account_id == bank_account_id)
        
        if party_id:
            query = query.filter(Cheque.party_id == party_id)
        
        if from_date:
            query = query.filter(Cheque.cheque_date >= from_date)
        
        if to_date:
            query = query.filter(Cheque.cheque_date <= to_date)
        
        return query.order_by(Cheque.cheque_date.desc()).all()
    
    def get_pending_clearance(
        self,
        company_id: str,
        cheque_type: ChequeType = None,
    ) -> List[Cheque]:
        """Get cheques pending clearance."""
        query = self.db.query(Cheque).filter(
            Cheque.company_id == company_id,
            Cheque.status.in_([ChequeStatus.ISSUED, ChequeStatus.DEPOSITED]),
        )
        
        if cheque_type:
            query = query.filter(Cheque.cheque_type == cheque_type)
        
        return query.order_by(Cheque.cheque_date.asc()).all()
    
    def get_cheque_summary(
        self,
        company_id: str,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> Dict:
        """Get summary of cheques by status."""
        if not from_date:
            from_date = datetime.utcnow() - timedelta(days=30)
        if not to_date:
            to_date = datetime.utcnow()
        
        issued = self.db.query(func.sum(Cheque.amount)).filter(
            Cheque.company_id == company_id,
            Cheque.cheque_type == ChequeType.ISSUED,
            Cheque.cheque_date >= from_date,
            Cheque.cheque_date <= to_date,
        ).scalar() or 0
        
        received = self.db.query(func.sum(Cheque.amount)).filter(
            Cheque.company_id == company_id,
            Cheque.cheque_type == ChequeType.RECEIVED,
            Cheque.cheque_date >= from_date,
            Cheque.cheque_date <= to_date,
        ).scalar() or 0
        
        pending_issued = self.db.query(func.sum(Cheque.amount)).filter(
            Cheque.company_id == company_id,
            Cheque.cheque_type == ChequeType.ISSUED,
            Cheque.status == ChequeStatus.ISSUED,
        ).scalar() or 0
        
        pending_received = self.db.query(func.sum(Cheque.amount)).filter(
            Cheque.company_id == company_id,
            Cheque.cheque_type == ChequeType.RECEIVED,
            Cheque.status.in_([ChequeStatus.ISSUED, ChequeStatus.DEPOSITED]),
        ).scalar() or 0
        
        bounced = self.db.query(func.sum(Cheque.amount)).filter(
            Cheque.company_id == company_id,
            Cheque.status == ChequeStatus.BOUNCED,
            Cheque.cheque_date >= from_date,
            Cheque.cheque_date <= to_date,
        ).scalar() or 0
        
        return {
            'period': {'from': from_date.isoformat(), 'to': to_date.isoformat()},
            'total_issued': float(issued),
            'total_received': float(received),
            'pending_issued_clearance': float(pending_issued),
            'pending_received_clearance': float(pending_received),
            'total_bounced': float(bounced),
        }
