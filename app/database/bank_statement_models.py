"""
Bank Statement Models - Separate storage for bank statement data.

These are NOT transactions - they are records imported from bank statements
used for reconciliation purposes only.
"""
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, Boolean, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum

from app.database.connection import Base
from app.database.models import generate_uuid


class BankStatementEntryStatus(str, PyEnum):
    """Status of a bank statement entry."""
    PENDING = "pending"          # Not yet matched
    MATCHED = "matched"          # Matched with a book entry
    UNMATCHED = "unmatched"      # Confirmed as not in books (bank charges, interest, etc.)
    DISPUTED = "disputed"        # Under investigation


class BankStatementEntry(Base):
    """
    Bank Statement Entry - Records from bank statements.
    
    This is NOT a transaction - it's external data from the bank
    used for reconciliation purposes.
    """
    __tablename__ = "bank_statement_entries"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    
    # Bank import reference
    import_id = Column(String(36), ForeignKey("bank_imports.id", ondelete="SET NULL"))
    
    # Entry details (as per bank statement)
    value_date = Column(DateTime, nullable=False)  # Date of transaction as per bank
    transaction_date = Column(DateTime)  # Posting date if different
    
    # Amount - positive = credit (money in), negative = debit (money out)
    amount = Column(Numeric(14, 2), nullable=False)
    
    # Bank reference
    bank_reference = Column(String(100))  # UTR, cheque number, etc.
    description = Column(Text)  # Bank's description/narration
    
    # Running balance as per bank
    balance = Column(Numeric(14, 2))
    
    # Reconciliation
    status = Column(SQLEnum(BankStatementEntryStatus), default=BankStatementEntryStatus.PENDING)
    matched_entry_id = Column(String(36), ForeignKey("transaction_entries.id", ondelete="SET NULL"))
    matched_at = Column(DateTime)
    matched_by = Column(String(36))
    
    # For unmatched entries that need to create transactions
    needs_booking = Column(Boolean, default=False)  # True if this should become a transaction
    booked_transaction_id = Column(String(36), ForeignKey("transactions.id", ondelete="SET NULL"))
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company")
    bank_account = relationship("BankAccount")
    matched_entry = relationship("TransactionEntry", foreign_keys=[matched_entry_id])
    booked_transaction = relationship("Transaction", foreign_keys=[booked_transaction_id])


class MonthlyBankReconciliation(Base):
    """
    Monthly Bank Reconciliation - Track monthly opening/closing balances.
    
    This allows comparing:
    - Opening balance (as per bank statement)
    - Your book entries for the month
    - Closing balance (as per bank statement)
    - Difference to investigate
    """
    __tablename__ = "monthly_bank_reconciliations"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    
    # Period
    year = Column(String(4), nullable=False)
    month = Column(String(2), nullable=False)  # 01-12
    
    # Bank statement balances (entered by user from bank statement)
    opening_balance_bank = Column(Numeric(14, 2), default=0)  # As per bank statement
    closing_balance_bank = Column(Numeric(14, 2), default=0)  # As per bank statement
    
    # Book balances (calculated from transactions)
    opening_balance_book = Column(Numeric(14, 2), default=0)  # As per your books
    closing_balance_book = Column(Numeric(14, 2), default=0)  # As per your books
    
    # Reconciliation items
    cheques_issued_not_cleared = Column(Numeric(14, 2), default=0)  # In books, not in bank yet
    cheques_deposited_not_credited = Column(Numeric(14, 2), default=0)  # In books, not in bank yet
    bank_charges_not_booked = Column(Numeric(14, 2), default=0)  # In bank, not in books
    interest_not_booked = Column(Numeric(14, 2), default=0)  # In bank, not in books
    other_differences = Column(Numeric(14, 2), default=0)
    
    # Status
    status = Column(String(20), default="draft")  # draft, reconciled, closed
    
    # Notes
    notes = Column(Text)
    
    # Audit
    reconciled_by = Column(String(36))
    reconciled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company")
    bank_account = relationship("BankAccount")

