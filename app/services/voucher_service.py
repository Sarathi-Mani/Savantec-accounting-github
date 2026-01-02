"""Voucher Service - Smart entry system that creates proper accounting entries."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.database.models import (
    Company, Customer, Account, Transaction, TransactionEntry,
    Invoice, Payment, QuickEntry, AccountType,
    VoucherType, EntryType, ReferenceType, TransactionStatus, PaymentMode
)
from app.services.accounting_service import AccountingService


# Category to Account mapping for auto-categorization
CATEGORY_ACCOUNT_MAP = {
    # Income categories
    "sale": {"type": "revenue", "code": "4001", "name": "Sales"},
    "service_income": {"type": "revenue", "code": "4002", "name": "Service Income"},
    "interest_income": {"type": "revenue", "code": "4003", "name": "Interest Income"},
    "other_income": {"type": "revenue", "code": "4099", "name": "Other Income"},
    
    # Expense categories
    "purchase": {"type": "expense", "code": "5001", "name": "Purchases"},
    "salary": {"type": "expense", "code": "5101", "name": "Salaries & Wages"},
    "rent": {"type": "expense", "code": "5102", "name": "Rent"},
    "utilities": {"type": "expense", "code": "5103", "name": "Utilities"},
    "office_supplies": {"type": "expense", "code": "5104", "name": "Office Supplies"},
    "travel": {"type": "expense", "code": "5105", "name": "Travel & Conveyance"},
    "telephone": {"type": "expense", "code": "5106", "name": "Telephone & Internet"},
    "professional_fees": {"type": "expense", "code": "5107", "name": "Professional Fees"},
    "bank_charges": {"type": "expense", "code": "5108", "name": "Bank Charges"},
    "insurance": {"type": "expense", "code": "5109", "name": "Insurance"},
    "repairs": {"type": "expense", "code": "5110", "name": "Repairs & Maintenance"},
    "marketing": {"type": "expense", "code": "5111", "name": "Marketing & Advertising"},
    "other_expense": {"type": "expense", "code": "5199", "name": "Miscellaneous Expenses"},
}


class VoucherService:
    """Service for creating Tally-style vouchers with simplified input."""
    
    def __init__(self, db: Session):
        self.db = db
        self.accounting_service = AccountingService(db)
    
    def create_quick_entry(
        self,
        company: Company,
        entry_type: str,  # 'money_in', 'money_out', 'transfer'
        amount: Decimal,
        entry_date: Optional[datetime] = None,
        category: Optional[str] = None,
        party_id: Optional[str] = None,
        party_type: Optional[str] = None,
        payment_account_id: Optional[str] = None,
        payment_mode: Optional[str] = None,
        description: Optional[str] = None,
        reference_number: Optional[str] = None,
        gst_rate: Optional[Decimal] = None,
        from_account_id: Optional[str] = None,
        to_account_id: Optional[str] = None,
        cheque_number: Optional[str] = None,
        drawer_name: Optional[str] = None,
        payee_name: Optional[str] = None,
        drawn_on_bank: Optional[str] = None,
        drawn_on_branch: Optional[str] = None,
        bank_account_id: Optional[str] = None,
    ) -> QuickEntry:
        """
        Create a quick entry that auto-generates proper accounting entries.
        
        For Money In:
            - Debit: Cash/Bank account
            - Credit: Income account (based on category) OR Accounts Receivable (if party)
        
        For Money Out:
            - Debit: Expense account (based on category) OR Accounts Payable (if party)
            - Credit: Cash/Bank account
        
        For Transfer:
            - Debit: To account
            - Credit: From account
        """
        entry_date = entry_date or datetime.utcnow()
        
        # Get or create accounts based on category
        income_account = None
        expense_account = None
        payment_account = None
        party_name = None
        
        # Get payment account
        if payment_account_id:
            payment_account = self.db.query(Account).filter(
                Account.id == payment_account_id,
                Account.company_id == company.id
            ).first()
        
        if not payment_account and entry_type != 'transfer':
            # Get default cash account
            payment_account = self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.code == "1001"  # Cash account
            ).first()
        
        # Get party name if party_id provided
        if party_id and party_type == 'customer':
            customer = self.db.query(Customer).filter(Customer.id == party_id).first()
            if customer:
                party_name = customer.name
        elif party_id and party_type == 'vendor':
            vendor = self.db.query(Customer).filter(Customer.id == party_id).first()
            if vendor:
                party_name = vendor.name
        
        # Calculate GST if applicable
        gst_amount = Decimal(0)
        if gst_rate and gst_rate > 0:
            gst_amount = (amount * gst_rate) / (100 + gst_rate)  # Extract GST from inclusive amount
        
        # Create the quick entry record
        quick_entry = QuickEntry(
            company_id=company.id,
            entry_type=EntryType(entry_type),
            entry_date=entry_date,
            amount=amount,
            party_id=party_id,
            party_type=party_type,
            party_name=party_name,
            category=category,
            payment_account_id=payment_account_id,
            payment_mode=PaymentMode(payment_mode) if payment_mode else None,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            description=description,
            reference_number=reference_number,
            is_gst_applicable=bool(gst_rate and gst_rate > 0),
            gst_rate=gst_rate,
            gst_amount=gst_amount,
        )
        
        self.db.add(quick_entry)
        self.db.flush()
        
        # Create the accounting transaction
        transaction = self._create_transaction_for_entry(
            company=company,
            quick_entry=quick_entry,
            payment_account=payment_account,
            category=category,
        )
        
        if transaction:
            quick_entry.transaction_id = transaction.id
        
        # Create cheque entry if payment mode is cheque
        if payment_mode == "cheque" and cheque_number:
            from app.services.cheque_service import ChequeService
            from app.database.models import BankAccount
            cheque_service = ChequeService(self.db)
            
            try:
                if entry_type == "money_in":
                    # Received cheque
                    cheque = cheque_service.receive_cheque(
                        company_id=company.id,
                        cheque_number=cheque_number,
                        cheque_date=entry_date or datetime.utcnow(),
                        amount=amount,
                        drawer_name=drawer_name or party_name or "Unknown",
                        drawn_on_bank=drawn_on_bank,
                        drawn_on_branch=drawn_on_branch,
                        party_id=party_id,
                        party_type=party_type,
                        notes=description,
                        create_accounting_entry=False,  # Already created via quick entry
                    )
                    # Link cheque to the transaction
                    if cheque and transaction:
                        cheque.transaction_id = transaction.id
                        self.db.flush()
                elif entry_type == "money_out":
                    # Issued cheque - need cheque book
                    # For now, create without cheque book (manual entry)
                    # In future, can add cheque book selection in UI
                    if bank_account_id:
                        # Find cheque book for this bank account
                        from app.database.models import ChequeBook
                        cheque_book = self.db.query(ChequeBook).filter(
                            ChequeBook.company_id == company.id,
                            ChequeBook.bank_account_id == bank_account_id,
                            ChequeBook.is_active == True
                        ).first()
                        
                        if cheque_book:
                            cheque = cheque_service.issue_cheque(
                                company_id=company.id,
                                cheque_book_id=cheque_book.id,
                                cheque_date=entry_date or datetime.utcnow(),
                                amount=amount,
                                payee_name=payee_name or party_name or "Unknown",
                                party_id=party_id,
                                party_type=party_type,
                                bank_account_id=bank_account_id,
                                notes=description,
                                create_accounting_entry=False,  # Already created via quick entry
                            )
                            # Link cheque to the transaction
                            if cheque and transaction:
                                cheque.transaction_id = transaction.id
                                self.db.flush()
                        else:
                            # No cheque book - create manual cheque record (accounting already done via quick entry)
                            from app.database.models import Cheque, ChequeType, ChequeStatus, generate_uuid
                            cheque = Cheque(
                                id=generate_uuid(),
                                company_id=company.id,
                                cheque_type=ChequeType.ISSUED,
                                cheque_number=cheque_number,
                                cheque_date=entry_date or datetime.utcnow(),
                                bank_account_id=bank_account_id,
                                amount=amount,
                                payee_name=payee_name or party_name or "Unknown",
                                party_id=party_id,
                                party_type=party_type,
                                status=ChequeStatus.ISSUED,
                                issue_date=datetime.utcnow(),
                                notes=description,
                                transaction_id=transaction.id if transaction else None,  # Link to quick entry transaction
                            )
                            self.db.add(cheque)
                    else:
                        # No bank account specified - skip cheque creation
                        pass
            except Exception as e:
                # Log error but don't fail the quick entry
                print(f"Warning: Could not create cheque entry: {e}")
        
        self.db.commit()
        self.db.refresh(quick_entry)
        
        return quick_entry
    
    def _create_transaction_for_entry(
        self,
        company: Company,
        quick_entry: QuickEntry,
        payment_account: Optional[Account],
        category: Optional[str],
    ) -> Optional[Transaction]:
        """Create the accounting transaction for a quick entry."""
        
        entries = []
        voucher_type = VoucherType.JOURNAL
        description = quick_entry.description or ""
        
        if quick_entry.entry_type == EntryType.MONEY_IN:
            voucher_type = VoucherType.RECEIPT
            
            # Debit: Cash/Bank
            if payment_account:
                entries.append({
                    "account_id": payment_account.id,
                    "debit_amount": quick_entry.amount,
                    "credit_amount": Decimal(0),
                    "description": f"Received: {description}"
                })
            
            # Credit: Income account or Receivables
            credit_account = self._get_or_create_category_account(company, category, "revenue")
            if credit_account:
                net_amount = quick_entry.amount - (quick_entry.gst_amount or 0)
                entries.append({
                    "account_id": credit_account.id,
                    "debit_amount": Decimal(0),
                    "credit_amount": net_amount,
                    "description": description
                })
                
                # GST entries if applicable
                if quick_entry.gst_amount and quick_entry.gst_amount > 0:
                    gst_account = self._get_or_create_gst_account(company, "output")
                    if gst_account:
                        entries.append({
                            "account_id": gst_account.id,
                            "debit_amount": Decimal(0),
                            "credit_amount": quick_entry.gst_amount,
                            "description": f"GST on {description}"
                        })
        
        elif quick_entry.entry_type == EntryType.MONEY_OUT:
            voucher_type = VoucherType.PAYMENT
            
            # Debit: Expense account or Payables
            debit_account = self._get_or_create_category_account(company, category, "expense")
            if debit_account:
                net_amount = quick_entry.amount - (quick_entry.gst_amount or 0)
                entries.append({
                    "account_id": debit_account.id,
                    "debit_amount": net_amount,
                    "credit_amount": Decimal(0),
                    "description": description
                })
                
                # GST entries if applicable (input credit)
                if quick_entry.gst_amount and quick_entry.gst_amount > 0:
                    gst_account = self._get_or_create_gst_account(company, "input")
                    if gst_account:
                        entries.append({
                            "account_id": gst_account.id,
                            "debit_amount": quick_entry.gst_amount,
                            "credit_amount": Decimal(0),
                            "description": f"Input GST on {description}"
                        })
            
            # Credit: Cash/Bank
            if payment_account:
                entries.append({
                    "account_id": payment_account.id,
                    "debit_amount": Decimal(0),
                    "credit_amount": quick_entry.amount,
                    "description": f"Paid: {description}"
                })
        
        elif quick_entry.entry_type == EntryType.TRANSFER:
            voucher_type = VoucherType.CONTRA
            
            # For transfers between accounts
            if quick_entry.from_account_id and quick_entry.to_account_id:
                entries.append({
                    "account_id": quick_entry.to_account_id,
                    "debit_amount": quick_entry.amount,
                    "credit_amount": Decimal(0),
                    "description": f"Transfer from {description}"
                })
                entries.append({
                    "account_id": quick_entry.from_account_id,
                    "debit_amount": Decimal(0),
                    "credit_amount": quick_entry.amount,
                    "description": f"Transfer to {description}"
                })
        
        if not entries:
            return None
        
        # Create transaction
        transaction = Transaction(
            company_id=company.id,
            transaction_number=self._generate_transaction_number(company, voucher_type),
            transaction_date=quick_entry.entry_date,
            voucher_type=voucher_type,
            description=description,
            party_id=quick_entry.party_id,
            party_type=quick_entry.party_type,
            reference_type=ReferenceType.MANUAL,
            status=TransactionStatus.POSTED,
            total_debit=sum(e["debit_amount"] for e in entries),
            total_credit=sum(e["credit_amount"] for e in entries),
        )
        
        self.db.add(transaction)
        self.db.flush()
        
        # Create transaction entries (balances are calculated from entries, not stored)
        for entry_data in entries:
            entry = TransactionEntry(
                transaction_id=transaction.id,
                account_id=entry_data["account_id"],
                debit_amount=entry_data["debit_amount"],
                credit_amount=entry_data["credit_amount"],
                description=entry_data["description"],
            )
            self.db.add(entry)
        
        self.db.flush()
        return transaction
    
    def _get_or_create_category_account(
        self,
        company: Company,
        category: Optional[str],
        default_type: str
    ) -> Optional[Account]:
        """Get or create an account for the given category."""
        if not category:
            category = "other_income" if default_type == "revenue" else "other_expense"
        
        category_lower = category.lower().replace(" ", "_")
        mapping = CATEGORY_ACCOUNT_MAP.get(category_lower)
        
        if mapping:
            account = self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.code == mapping["code"]
            ).first()
            
            if not account:
                # Create the account
                account = Account(
                    company_id=company.id,
                    code=mapping["code"],
                    name=mapping["name"],
                    account_type=AccountType(mapping["type"]),
                    is_system=False,
                )
                self.db.add(account)
                self.db.flush()
            
            return account
        
        # Fallback to default accounts
        if default_type == "revenue":
            return self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.code == "4001"
            ).first()
        else:
            return self.db.query(Account).filter(
                Account.company_id == company.id,
                Account.code == "5001"
            ).first()
    
    def _get_or_create_gst_account(self, company: Company, gst_type: str) -> Optional[Account]:
        """Get or create GST account."""
        if gst_type == "output":
            code = "2201"
            name = "GST Output (Payable)"
            acc_type = AccountType.LIABILITY
        else:
            code = "1301"
            name = "GST Input (Receivable)"
            acc_type = AccountType.ASSET
        
        account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == code
        ).first()
        
        if not account:
            account = Account(
                company_id=company.id,
                code=code,
                name=name,
                account_type=acc_type,
                is_system=True,
            )
            self.db.add(account)
            self.db.flush()
        
        return account
    
    def _generate_transaction_number(self, company: Company, voucher_type: VoucherType) -> str:
        """Generate a transaction number based on voucher type."""
        prefix_map = {
            VoucherType.PAYMENT: "PMT",
            VoucherType.RECEIPT: "RCT",
            VoucherType.CONTRA: "CTR",
            VoucherType.JOURNAL: "JRN",
            VoucherType.SALES: "SAL",
            VoucherType.PURCHASE: "PUR",
            VoucherType.DEBIT_NOTE: "DBN",
            VoucherType.CREDIT_NOTE: "CRN",
            VoucherType.STOCK_JOURNAL: "STK",
        }
        prefix = prefix_map.get(voucher_type, "TXN")
        
        # Count existing transactions of this type
        count = self.db.query(Transaction).filter(
            Transaction.company_id == company.id,
            Transaction.voucher_type == voucher_type
        ).count()
        
        return f"{prefix}-{count + 1:05d}"
    
    def get_quick_entries(
        self,
        company: Company,
        entry_type: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        category: Optional[str] = None,
        limit: int = 50,
    ) -> List[QuickEntry]:
        """Get quick entries with filters."""
        query = self.db.query(QuickEntry).filter(QuickEntry.company_id == company.id)
        
        if entry_type:
            query = query.filter(QuickEntry.entry_type == EntryType(entry_type))
        
        if from_date:
            query = query.filter(QuickEntry.entry_date >= from_date)
        
        if to_date:
            query = query.filter(QuickEntry.entry_date <= to_date)
        
        if category:
            query = query.filter(QuickEntry.category == category)
        
        return query.order_by(QuickEntry.entry_date.desc()).limit(limit).all()
    
    def get_category_totals(
        self,
        company: Company,
        from_date: datetime,
        to_date: datetime,
    ) -> Dict[str, Dict[str, Decimal]]:
        """Get totals by category for a period."""
        from sqlalchemy import func
        
        results = self.db.query(
            QuickEntry.entry_type,
            QuickEntry.category,
            func.sum(QuickEntry.amount).label("total")
        ).filter(
            QuickEntry.company_id == company.id,
            QuickEntry.entry_date >= from_date,
            QuickEntry.entry_date <= to_date,
        ).group_by(
            QuickEntry.entry_type,
            QuickEntry.category
        ).all()
        
        totals = {"money_in": {}, "money_out": {}, "transfer": {}}
        for entry_type, category, total in results:
            if entry_type:
                totals[entry_type.value][category or "uncategorized"] = total or Decimal(0)
        
        return totals
