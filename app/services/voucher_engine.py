"""VoucherEngine - Central hub for all accounting entries in Tally-like architecture.

This engine handles all voucher types and creates proper double-entry accounting:
- Sales Voucher (Sales Invoice)
- Purchase Voucher (Purchase Invoice)
- Receipt Voucher (Money In)
- Payment Voucher (Money Out)
- Contra Voucher (Bank/Cash transfers)
- Journal Voucher (Adjustments)
- Debit Note (Sales Return)
- Credit Note (Purchase Return)
- Stock Journal (Stock adjustments)
"""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.orm import Session

from app.database.models import (
    Company, Customer, Account, Transaction, TransactionEntry, Invoice, InvoiceItem,
    PurchaseInvoice, PurchaseInvoiceItem, Payment, PurchasePayment, QuickEntry,
    Product, StockEntry, StockMovementType, AccountType, VoucherType, EntryType,
    ReferenceType, TransactionStatus, PaymentMode, InvoiceStatus, PurchaseInvoiceStatus,
    PurchaseOrder, SalesOrder,
    INDIAN_STATE_CODES
)


@dataclass
class VoucherLine:
    """Represents a single line in a voucher."""
    account_id: str
    debit_amount: Decimal = Decimal("0")
    credit_amount: Decimal = Decimal("0")
    description: str = ""
    party_id: Optional[str] = None


@dataclass
class VoucherResult:
    """Result of voucher creation."""
    success: bool
    transaction: Optional[Transaction] = None
    error: Optional[str] = None
    entries: List[TransactionEntry] = None


class VoucherEngine:
    """Central engine for creating all types of accounting vouchers."""
    
    # System account codes
    ACCOUNTS = {
        # Assets
        "CASH": "1001",
        "BANK": "1010",
        "ACCOUNTS_RECEIVABLE": "1100",
        "INVENTORY": "1200",
        "INPUT_CGST": "1301",
        "INPUT_SGST": "1302",
        "INPUT_IGST": "1303",
        
        # Liabilities
        "ACCOUNTS_PAYABLE": "2000",
        "OUTPUT_CGST": "2101",
        "OUTPUT_SGST": "2102",
        "OUTPUT_IGST": "2103",
        "TDS_PAYABLE": "2200",
        
        # Revenue
        "SALES": "4001",
        "SERVICE_INCOME": "4002",
        
        # Expenses
        "PURCHASES": "5100",
        "COGS": "5200",  # Cost of Goods Sold
    }
    
    def __init__(self, db: Session):
        self.db = db
        self._account_cache: Dict[str, Account] = {}
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ==================== ACCOUNT MANAGEMENT ====================
    
    def get_or_create_account(
        self,
        company: Company,
        code: str,
        name: Optional[str] = None,
        account_type: Optional[AccountType] = None
    ) -> Account:
        """Get or create an account by code."""
        cache_key = f"{company.id}_{code}"
        
        if cache_key in self._account_cache:
            return self._account_cache[cache_key]
        
        account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == code
        ).first()
        
        if not account and name and account_type:
            account = Account(
                company_id=company.id,
                code=code,
                name=name,
                account_type=account_type,
                is_system=True,
            )
            self.db.add(account)
            self.db.flush()
        
        if account:
            self._account_cache[cache_key] = account
        
        return account
    
    def _ensure_system_accounts(self, company: Company) -> None:
        """Ensure all system accounts exist for a company."""
        account_definitions = [
            (self.ACCOUNTS["CASH"], "Cash in Hand", AccountType.ASSET),
            (self.ACCOUNTS["BANK"], "Bank Account", AccountType.ASSET),
            (self.ACCOUNTS["ACCOUNTS_RECEIVABLE"], "Accounts Receivable", AccountType.ASSET),
            (self.ACCOUNTS["INVENTORY"], "Inventory", AccountType.ASSET),
            (self.ACCOUNTS["INPUT_CGST"], "Input CGST", AccountType.ASSET),
            (self.ACCOUNTS["INPUT_SGST"], "Input SGST", AccountType.ASSET),
            (self.ACCOUNTS["INPUT_IGST"], "Input IGST", AccountType.ASSET),
            (self.ACCOUNTS["ACCOUNTS_PAYABLE"], "Accounts Payable", AccountType.LIABILITY),
            (self.ACCOUNTS["OUTPUT_CGST"], "Output CGST", AccountType.LIABILITY),
            (self.ACCOUNTS["OUTPUT_SGST"], "Output SGST", AccountType.LIABILITY),
            (self.ACCOUNTS["OUTPUT_IGST"], "Output IGST", AccountType.LIABILITY),
            (self.ACCOUNTS["TDS_PAYABLE"], "TDS Payable", AccountType.LIABILITY),
            (self.ACCOUNTS["SALES"], "Sales", AccountType.REVENUE),
            (self.ACCOUNTS["SERVICE_INCOME"], "Service Income", AccountType.REVENUE),
            (self.ACCOUNTS["PURCHASES"], "Purchases", AccountType.EXPENSE),
            (self.ACCOUNTS["COGS"], "Cost of Goods Sold", AccountType.EXPENSE),
        ]
        
        for code, name, acc_type in account_definitions:
            self.get_or_create_account(company, code, name, acc_type)
    
    def _update_account_balances(self, entries: List[VoucherLine]) -> None:
        """No-op - account balances are calculated from transaction entries, not stored."""
        # Balances are now calculated dynamically from TransactionEntry records
        # Use AccountingService.get_account_balance() to get account balance
        pass
    
    def _generate_voucher_number(self, company: Company, voucher_type: VoucherType) -> str:
        """Generate sequential voucher number."""
        prefix_map = {
            VoucherType.SALES: "SAL",
            VoucherType.PURCHASE: "PUR",
            VoucherType.RECEIPT: "RCT",
            VoucherType.PAYMENT: "PMT",
            VoucherType.CONTRA: "CTR",
            VoucherType.JOURNAL: "JRN",
            VoucherType.DEBIT_NOTE: "DBN",
            VoucherType.CREDIT_NOTE: "CRN",
            VoucherType.STOCK_JOURNAL: "STK",
        }
        prefix = prefix_map.get(voucher_type, "TXN")
        
        count = self.db.query(Transaction).filter(
            Transaction.company_id == company.id,
            Transaction.voucher_type == voucher_type
        ).count()
        
        return f"{prefix}-{count + 1:06d}"
    
    # ==================== CORE VOUCHER CREATION ====================
    
    def create_voucher(
        self,
        company: Company,
        voucher_type: VoucherType,
        entries: List[VoucherLine],
        voucher_date: Optional[datetime] = None,
        description: str = "",
        reference_type: ReferenceType = ReferenceType.MANUAL,
        reference_id: Optional[str] = None,
        party_id: Optional[str] = None,
        party_type: Optional[str] = None,
        narration: Optional[str] = None,
    ) -> VoucherResult:
        """Create a voucher with double-entry accounting entries."""
        
        # Ensure accounts exist
        self._ensure_system_accounts(company)
        
        # Validate entries balance
        total_debit = sum(e.debit_amount for e in entries)
        total_credit = sum(e.credit_amount for e in entries)
        
        if abs(total_debit - total_credit) > Decimal("0.01"):
            return VoucherResult(
                success=False,
                error=f"Entries don't balance: Debit={total_debit}, Credit={total_credit}"
            )
        
        if total_debit == 0:
            return VoucherResult(
                success=False,
                error="Voucher has no entries"
            )
        
        # Create transaction
        transaction = Transaction(
            company_id=company.id,
            transaction_number=self._generate_voucher_number(company, voucher_type),
            transaction_date=voucher_date or datetime.utcnow(),
            voucher_type=voucher_type,
            description=description,
            narration=narration,
            party_id=party_id,
            party_type=party_type,
            reference_type=reference_type,
            reference_id=reference_id,
            status=TransactionStatus.POSTED,
            total_debit=total_debit,
            total_credit=total_credit,
        )
        self.db.add(transaction)
        self.db.flush()
        
        # Create entries
        created_entries = []
        for entry in entries:
            if entry.debit_amount == 0 and entry.credit_amount == 0:
                continue
            
            txn_entry = TransactionEntry(
                transaction_id=transaction.id,
                account_id=entry.account_id,
                debit_amount=entry.debit_amount,
                credit_amount=entry.credit_amount,
                description=entry.description,
                party_id=entry.party_id,
            )
            self.db.add(txn_entry)
            created_entries.append(txn_entry)
        
        # Update account balances
        self._update_account_balances(entries)
        
        return VoucherResult(
            success=True,
            transaction=transaction,
            entries=created_entries
        )
    
    # ==================== SALES VOUCHER ====================
    
    def create_sales_voucher(
        self,
        company: Company,
        invoice: Invoice,
    ) -> VoucherResult:
        """Create accounting entries for a sales invoice.
        
        Double Entry:
        - Debit: Accounts Receivable (or Cash/Bank if cash sale)
        - Credit: Sales Revenue
        - Credit: Output CGST/SGST or IGST (based on GST type)
        """
        entries = []
        
        # Get accounts
        ar_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_RECEIVABLE"],
            "Accounts Receivable", AccountType.ASSET
        )
        sales_account = self.get_or_create_account(
            company, self.ACCOUNTS["SALES"],
            "Sales", AccountType.REVENUE
        )
        
        # Debit: Accounts Receivable (total invoice amount)
        entries.append(VoucherLine(
            account_id=ar_account.id,
            debit_amount=self._round_amount(invoice.total_amount),
            description=f"Receivable - {invoice.invoice_number}",
            party_id=invoice.customer_id,
        ))
        
        # Credit: Sales (taxable amount)
        entries.append(VoucherLine(
            account_id=sales_account.id,
            credit_amount=self._round_amount(invoice.subtotal),
            description=f"Sales - {invoice.invoice_number}",
        ))
        
        # Credit: GST (based on type)
        if invoice.cgst_amount and invoice.cgst_amount > 0:
            cgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_CGST"],
                "Output CGST", AccountType.LIABILITY
            )
            entries.append(VoucherLine(
                account_id=cgst_account.id,
                credit_amount=self._round_amount(invoice.cgst_amount),
                description=f"CGST - {invoice.invoice_number}",
            ))
        
        if invoice.sgst_amount and invoice.sgst_amount > 0:
            sgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_SGST"],
                "Output SGST", AccountType.LIABILITY
            )
            entries.append(VoucherLine(
                account_id=sgst_account.id,
                credit_amount=self._round_amount(invoice.sgst_amount),
                description=f"SGST - {invoice.invoice_number}",
            ))
        
        if invoice.igst_amount and invoice.igst_amount > 0:
            igst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_IGST"],
                "Output IGST", AccountType.LIABILITY
            )
            entries.append(VoucherLine(
                account_id=igst_account.id,
                credit_amount=self._round_amount(invoice.igst_amount),
                description=f"IGST - {invoice.invoice_number}",
            ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.SALES,
            entries=entries,
            voucher_date=invoice.invoice_date,
            description=f"Sales Invoice {invoice.invoice_number}",
            reference_type=ReferenceType.INVOICE,
            reference_id=invoice.id,
            party_id=invoice.customer_id,
            party_type="customer",
        )
    
    # ==================== PURCHASE VOUCHER ====================
    
    def create_purchase_voucher(
        self,
        company: Company,
        invoice: PurchaseInvoice,
    ) -> VoucherResult:
        """Create accounting entries for a purchase invoice.
        
        Double Entry:
        - Debit: Purchases (expense)
        - Debit: Input CGST/SGST/IGST (asset - tax credit)
        - Credit: Accounts Payable (net payable after TDS)
        - Credit: TDS Payable (if TDS applicable)
        """
        entries = []
        
        # Get accounts
        purchases_account = self.get_or_create_account(
            company, self.ACCOUNTS["PURCHASES"],
            "Purchases", AccountType.EXPENSE
        )
        ap_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_PAYABLE"],
            "Accounts Payable", AccountType.LIABILITY
        )
        
        # Debit: Purchases (taxable amount)
        entries.append(VoucherLine(
            account_id=purchases_account.id,
            debit_amount=self._round_amount(invoice.subtotal),
            description=f"Purchase - {invoice.invoice_number}",
        ))
        
        # Debit: Input GST (tax credit)
        if invoice.cgst_amount and invoice.cgst_amount > 0:
            cgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_CGST"],
                "Input CGST", AccountType.ASSET
            )
            entries.append(VoucherLine(
                account_id=cgst_account.id,
                debit_amount=self._round_amount(invoice.cgst_amount),
                description=f"Input CGST - {invoice.invoice_number}",
            ))
        
        if invoice.sgst_amount and invoice.sgst_amount > 0:
            sgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_SGST"],
                "Input SGST", AccountType.ASSET
            )
            entries.append(VoucherLine(
                account_id=sgst_account.id,
                debit_amount=self._round_amount(invoice.sgst_amount),
                description=f"Input SGST - {invoice.invoice_number}",
            ))
        
        if invoice.igst_amount and invoice.igst_amount > 0:
            igst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_IGST"],
                "Input IGST", AccountType.ASSET
            )
            entries.append(VoucherLine(
                account_id=igst_account.id,
                debit_amount=self._round_amount(invoice.igst_amount),
                description=f"Input IGST - {invoice.invoice_number}",
            ))
        
        # Credit: Accounts Payable (net payable after TDS)
        entries.append(VoucherLine(
            account_id=ap_account.id,
            credit_amount=self._round_amount(invoice.net_payable),
            description=f"Payable - {invoice.invoice_number}",
            party_id=invoice.vendor_id,
        ))
        
        # Credit: TDS Payable (if applicable)
        if invoice.tds_amount and invoice.tds_amount > 0:
            tds_account = self.get_or_create_account(
                company, self.ACCOUNTS["TDS_PAYABLE"],
                "TDS Payable", AccountType.LIABILITY
            )
            entries.append(VoucherLine(
                account_id=tds_account.id,
                credit_amount=self._round_amount(invoice.tds_amount),
                description=f"TDS - {invoice.invoice_number}",
            ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.PURCHASE,
            entries=entries,
            voucher_date=invoice.invoice_date,
            description=f"Purchase Invoice {invoice.invoice_number}",
            reference_type=ReferenceType.INVOICE,
            reference_id=invoice.id,
            party_id=invoice.vendor_id,
            party_type="vendor",
        )
    
    # ==================== PURCHASE ORDER VOUCHER ====================
    
    def create_purchase_order_voucher(
        self,
        company: Company,
        order: PurchaseOrder,
    ) -> VoucherResult:
        """Create accounting entries when a purchase order is confirmed.
        
        Double Entry:
        - Debit: Purchases (expense) - taxable amount
        - Debit: Input CGST/SGST (asset - tax credit)
        - Credit: Accounts Payable (total amount)
        
        Note: For Purchase Orders, TDS is typically calculated at invoice/payment stage,
        so we don't include TDS entries here.
        """
        entries = []
        
        # Get accounts
        purchases_account = self.get_or_create_account(
            company, self.ACCOUNTS["PURCHASES"],
            "Purchases", AccountType.EXPENSE
        )
        ap_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_PAYABLE"],
            "Accounts Payable", AccountType.LIABILITY
        )
        
        # Debit: Purchases (taxable amount = subtotal)
        entries.append(VoucherLine(
            account_id=purchases_account.id,
            debit_amount=self._round_amount(order.subtotal or Decimal("0")),
            description=f"Purchase Order - {order.order_number}",
        ))
        
        # Debit: Input GST (tax credit) - split 50/50 CGST/SGST for intra-state
        tax_amount = order.tax_amount or Decimal("0")
        if tax_amount > 0:
            half_tax = self._round_amount(tax_amount / 2)
            
            cgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_CGST"],
                "Input CGST", AccountType.ASSET
            )
            entries.append(VoucherLine(
                account_id=cgst_account.id,
                debit_amount=half_tax,
                description=f"Input CGST - {order.order_number}",
            ))
            
            sgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_SGST"],
                "Input SGST", AccountType.ASSET
            )
            entries.append(VoucherLine(
                account_id=sgst_account.id,
                debit_amount=tax_amount - half_tax,  # Handle rounding
                description=f"Input SGST - {order.order_number}",
            ))
        
        # Credit: Accounts Payable (total amount)
        entries.append(VoucherLine(
            account_id=ap_account.id,
            credit_amount=self._round_amount(order.total_amount or Decimal("0")),
            description=f"Payable - {order.order_number}",
            party_id=order.vendor_id,
        ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.PURCHASE,
            entries=entries,
            voucher_date=order.order_date,
            description=f"Purchase Order {order.order_number} Confirmed",
            reference_type=ReferenceType.PURCHASE_ORDER,
            reference_id=order.id,
            party_id=order.vendor_id,
            party_type="vendor",
        )
    
    # ==================== SALES ORDER VOUCHER ====================
    
    def create_sales_order_voucher(
        self,
        company: Company,
        order: SalesOrder,
    ) -> VoucherResult:
        """Create accounting entries when a sales order is fulfilled/invoiced.
        
        Double Entry:
        - Debit: Accounts Receivable (total amount)
        - Credit: Sales (taxable amount)
        - Credit: Output CGST/SGST (GST liability)
        """
        entries = []
        
        # Get accounts
        ar_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_RECEIVABLE"],
            "Accounts Receivable", AccountType.ASSET
        )
        sales_account = self.get_or_create_account(
            company, self.ACCOUNTS["SALES"],
            "Sales", AccountType.REVENUE
        )
        
        # Debit: Accounts Receivable (total amount)
        entries.append(VoucherLine(
            account_id=ar_account.id,
            debit_amount=self._round_amount(order.total_amount or Decimal("0")),
            description=f"Receivable - {order.order_number}",
            party_id=order.customer_id,
        ))
        
        # Credit: Sales (taxable amount)
        entries.append(VoucherLine(
            account_id=sales_account.id,
            credit_amount=self._round_amount(order.subtotal or Decimal("0")),
            description=f"Sales - {order.order_number}",
        ))
        
        # Credit: Output GST - split 50/50 CGST/SGST for intra-state
        tax_amount = order.tax_amount or Decimal("0")
        if tax_amount > 0:
            half_tax = self._round_amount(tax_amount / 2)
            
            cgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_CGST"],
                "Output CGST", AccountType.LIABILITY
            )
            entries.append(VoucherLine(
                account_id=cgst_account.id,
                credit_amount=half_tax,
                description=f"CGST - {order.order_number}",
            ))
            
            sgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_SGST"],
                "Output SGST", AccountType.LIABILITY
            )
            entries.append(VoucherLine(
                account_id=sgst_account.id,
                credit_amount=tax_amount - half_tax,
                description=f"SGST - {order.order_number}",
            ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.SALES,
            entries=entries,
            voucher_date=order.order_date,
            description=f"Sales Order {order.order_number}",
            reference_type=ReferenceType.SALES_ORDER,
            reference_id=order.id,
            party_id=order.customer_id,
            party_type="customer",
        )
    
    # ==================== RECEIPT VOUCHER ====================
    
    def create_receipt_voucher(
        self,
        company: Company,
        payment: Payment,
        invoice: Invoice,
        payment_account: Optional[Account] = None,
    ) -> VoucherResult:
        """Create accounting entries for a receipt (sales payment).
        
        Double Entry:
        - Debit: Cash/Bank
        - Credit: Accounts Receivable
        """
        entries = []
        
        # Get payment account (Cash or Bank)
        if not payment_account:
            if payment.payment_mode == PaymentMode.CASH:
                payment_account = self.get_or_create_account(
                    company, self.ACCOUNTS["CASH"],
                    "Cash in Hand", AccountType.ASSET
                )
            else:
                payment_account = self.get_or_create_account(
                    company, self.ACCOUNTS["BANK"],
                    "Bank Account", AccountType.ASSET
                )
        
        ar_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_RECEIVABLE"],
            "Accounts Receivable", AccountType.ASSET
        )
        
        # Debit: Cash/Bank
        entries.append(VoucherLine(
            account_id=payment_account.id,
            debit_amount=self._round_amount(payment.amount),
            description=f"Payment received - {invoice.invoice_number}",
        ))
        
        # Credit: Accounts Receivable
        entries.append(VoucherLine(
            account_id=ar_account.id,
            credit_amount=self._round_amount(payment.amount),
            description=f"Receivable settled - {invoice.invoice_number}",
            party_id=invoice.customer_id,
        ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.RECEIPT,
            entries=entries,
            voucher_date=payment.payment_date,
            description=f"Receipt for Invoice {invoice.invoice_number}",
            reference_type=ReferenceType.PAYMENT,
            reference_id=payment.id,
            party_id=invoice.customer_id,
            party_type="customer",
        )
    
    # ==================== PAYMENT VOUCHER ====================
    
    def create_payment_voucher(
        self,
        company: Company,
        payment: PurchasePayment,
        invoice: PurchaseInvoice,
        payment_account: Optional[Account] = None,
    ) -> VoucherResult:
        """Create accounting entries for a payment (purchase payment).
        
        Double Entry:
        - Debit: Accounts Payable
        - Credit: Cash/Bank
        """
        entries = []
        
        # Get payment account
        if not payment_account:
            if payment.payment_mode == PaymentMode.CASH:
                payment_account = self.get_or_create_account(
                    company, self.ACCOUNTS["CASH"],
                    "Cash in Hand", AccountType.ASSET
                )
            else:
                payment_account = self.get_or_create_account(
                    company, self.ACCOUNTS["BANK"],
                    "Bank Account", AccountType.ASSET
                )
        
        ap_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_PAYABLE"],
            "Accounts Payable", AccountType.LIABILITY
        )
        
        # Debit: Accounts Payable
        entries.append(VoucherLine(
            account_id=ap_account.id,
            debit_amount=self._round_amount(payment.amount),
            description=f"Payment made - {invoice.invoice_number}",
            party_id=invoice.vendor_id,
        ))
        
        # Credit: Cash/Bank
        entries.append(VoucherLine(
            account_id=payment_account.id,
            credit_amount=self._round_amount(payment.amount),
            description=f"Payment for {invoice.invoice_number}",
        ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.PAYMENT,
            entries=entries,
            voucher_date=payment.payment_date,
            description=f"Payment for Purchase {invoice.invoice_number}",
            reference_type=ReferenceType.PAYMENT,
            reference_id=payment.id,
            party_id=invoice.vendor_id,
            party_type="vendor",
        )
    
    # ==================== CONTRA VOUCHER ====================
    
    def create_contra_voucher(
        self,
        company: Company,
        from_account_id: str,
        to_account_id: str,
        amount: Decimal,
        voucher_date: Optional[datetime] = None,
        description: str = "",
    ) -> VoucherResult:
        """Create a contra voucher for cash/bank transfers.
        
        Double Entry:
        - Debit: To Account
        - Credit: From Account
        """
        entries = [
            VoucherLine(
                account_id=to_account_id,
                debit_amount=self._round_amount(amount),
                description=description or "Transfer In",
            ),
            VoucherLine(
                account_id=from_account_id,
                credit_amount=self._round_amount(amount),
                description=description or "Transfer Out",
            ),
        ]
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.CONTRA,
            entries=entries,
            voucher_date=voucher_date,
            description=description or "Contra Entry",
        )
    
    # ==================== JOURNAL VOUCHER ====================
    
    def create_journal_voucher(
        self,
        company: Company,
        entries: List[Dict[str, Any]],
        voucher_date: Optional[datetime] = None,
        description: str = "",
        narration: Optional[str] = None,
    ) -> VoucherResult:
        """Create a journal voucher for manual adjustments.
        
        entries: [{"account_id": "...", "debit": 100, "credit": 0, "description": "..."}]
        """
        voucher_lines = []
        
        for entry in entries:
            voucher_lines.append(VoucherLine(
                account_id=entry["account_id"],
                debit_amount=self._round_amount(Decimal(str(entry.get("debit", 0)))),
                credit_amount=self._round_amount(Decimal(str(entry.get("credit", 0)))),
                description=entry.get("description", ""),
                party_id=entry.get("party_id"),
            ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.JOURNAL,
            entries=voucher_lines,
            voucher_date=voucher_date,
            description=description,
            narration=narration,
        )
    
    # ==================== STOCK JOURNAL ====================
    
    def create_stock_journal(
        self,
        company: Company,
        product: Product,
        quantity: Decimal,
        rate: Decimal,
        movement_type: StockMovementType,
        godown_id: Optional[str] = None,
        voucher_date: Optional[datetime] = None,
        description: str = "",
    ) -> VoucherResult:
        """Create a stock journal for inventory adjustments.
        
        For stock increase (positive adjustment):
        - Debit: Inventory
        - Credit: Stock Adjustment (or COGS for sales)
        
        For stock decrease (negative adjustment):
        - Debit: Stock Adjustment (or COGS for sales)
        - Credit: Inventory
        """
        if product.is_service:
            return VoucherResult(success=False, error="Cannot create stock journal for service items")
        
        entries = []
        amount = self._round_amount(quantity * rate)
        
        inventory_account = self.get_or_create_account(
            company, self.ACCOUNTS["INVENTORY"],
            "Inventory", AccountType.ASSET
        )
        cogs_account = self.get_or_create_account(
            company, self.ACCOUNTS["COGS"],
            "Cost of Goods Sold", AccountType.EXPENSE
        )
        
        if movement_type in [StockMovementType.PURCHASE, StockMovementType.ADJUSTMENT]:
            if quantity > 0:
                # Stock increase
                entries.append(VoucherLine(
                    account_id=inventory_account.id,
                    debit_amount=amount,
                    description=f"Stock In - {product.name}",
                ))
                entries.append(VoucherLine(
                    account_id=cogs_account.id,
                    credit_amount=amount,
                    description=f"Stock adjustment - {product.name}",
                ))
        elif movement_type == StockMovementType.SALE:
            # Stock decrease for sales
            entries.append(VoucherLine(
                account_id=cogs_account.id,
                debit_amount=amount,
                description=f"COGS - {product.name}",
            ))
            entries.append(VoucherLine(
                account_id=inventory_account.id,
                credit_amount=amount,
                description=f"Stock Out - {product.name}",
            ))
        
        if not entries:
            return VoucherResult(success=False, error="Invalid stock movement")
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.STOCK_JOURNAL,
            entries=entries,
            voucher_date=voucher_date,
            description=description or f"Stock Journal - {product.name}",
        )
    
    # ==================== DEBIT NOTE (SALES RETURN) ====================
    
    def create_debit_note(
        self,
        company: Company,
        original_invoice: Invoice,
        return_items: List[Dict[str, Any]],
        voucher_date: Optional[datetime] = None,
        reason: str = "",
    ) -> VoucherResult:
        """Create a debit note for sales returns.
        
        Double Entry (reverses sales):
        - Debit: Sales (return amount)
        - Debit: Output GST
        - Credit: Accounts Receivable
        """
        entries = []
        
        total_return = Decimal("0")
        total_gst = Decimal("0")
        
        for item in return_items:
            total_return += Decimal(str(item.get("taxable_amount", 0)))
            total_gst += Decimal(str(item.get("gst_amount", 0)))
        
        # Get accounts
        sales_account = self.get_or_create_account(
            company, self.ACCOUNTS["SALES"],
            "Sales", AccountType.REVENUE
        )
        ar_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_RECEIVABLE"],
            "Accounts Receivable", AccountType.ASSET
        )
        
        # Debit: Sales (reduces revenue)
        entries.append(VoucherLine(
            account_id=sales_account.id,
            debit_amount=self._round_amount(total_return),
            description=f"Sales Return - {original_invoice.invoice_number}",
        ))
        
        # Debit: GST (reduces liability)
        if original_invoice.igst_amount > 0:
            igst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_IGST"],
                "Output IGST", AccountType.LIABILITY
            )
            entries.append(VoucherLine(
                account_id=igst_account.id,
                debit_amount=self._round_amount(total_gst),
                description=f"IGST on return - {original_invoice.invoice_number}",
            ))
        else:
            cgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_CGST"],
                "Output CGST", AccountType.LIABILITY
            )
            sgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["OUTPUT_SGST"],
                "Output SGST", AccountType.LIABILITY
            )
            half_gst = self._round_amount(total_gst / 2)
            entries.append(VoucherLine(
                account_id=cgst_account.id,
                debit_amount=half_gst,
                description=f"CGST on return - {original_invoice.invoice_number}",
            ))
            entries.append(VoucherLine(
                account_id=sgst_account.id,
                debit_amount=total_gst - half_gst,
                description=f"SGST on return - {original_invoice.invoice_number}",
            ))
        
        # Credit: Accounts Receivable
        entries.append(VoucherLine(
            account_id=ar_account.id,
            credit_amount=self._round_amount(total_return + total_gst),
            description=f"Receivable reduced - {original_invoice.invoice_number}",
            party_id=original_invoice.customer_id,
        ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.DEBIT_NOTE,
            entries=entries,
            voucher_date=voucher_date,
            description=f"Debit Note for {original_invoice.invoice_number}: {reason}",
            reference_type=ReferenceType.INVOICE,
            reference_id=original_invoice.id,
            party_id=original_invoice.customer_id,
            party_type="customer",
        )
    
    # ==================== CREDIT NOTE (PURCHASE RETURN) ====================
    
    def create_credit_note(
        self,
        company: Company,
        original_invoice: PurchaseInvoice,
        return_items: List[Dict[str, Any]],
        voucher_date: Optional[datetime] = None,
        reason: str = "",
    ) -> VoucherResult:
        """Create a credit note for purchase returns.
        
        Double Entry (reverses purchase):
        - Debit: Accounts Payable
        - Credit: Purchases
        - Credit: Input GST
        """
        entries = []
        
        total_return = Decimal("0")
        total_gst = Decimal("0")
        
        for item in return_items:
            total_return += Decimal(str(item.get("taxable_amount", 0)))
            total_gst += Decimal(str(item.get("gst_amount", 0)))
        
        # Get accounts
        purchases_account = self.get_or_create_account(
            company, self.ACCOUNTS["PURCHASES"],
            "Purchases", AccountType.EXPENSE
        )
        ap_account = self.get_or_create_account(
            company, self.ACCOUNTS["ACCOUNTS_PAYABLE"],
            "Accounts Payable", AccountType.LIABILITY
        )
        
        # Debit: Accounts Payable (reduces liability)
        entries.append(VoucherLine(
            account_id=ap_account.id,
            debit_amount=self._round_amount(total_return + total_gst),
            description=f"Payable reduced - {original_invoice.invoice_number}",
            party_id=original_invoice.vendor_id,
        ))
        
        # Credit: Purchases (reduces expense)
        entries.append(VoucherLine(
            account_id=purchases_account.id,
            credit_amount=self._round_amount(total_return),
            description=f"Purchase Return - {original_invoice.invoice_number}",
        ))
        
        # Credit: Input GST (reduces asset/credit)
        if original_invoice.igst_amount > 0:
            igst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_IGST"],
                "Input IGST", AccountType.ASSET
            )
            entries.append(VoucherLine(
                account_id=igst_account.id,
                credit_amount=self._round_amount(total_gst),
                description=f"Input IGST reversed - {original_invoice.invoice_number}",
            ))
        else:
            cgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_CGST"],
                "Input CGST", AccountType.ASSET
            )
            sgst_account = self.get_or_create_account(
                company, self.ACCOUNTS["INPUT_SGST"],
                "Input SGST", AccountType.ASSET
            )
            half_gst = self._round_amount(total_gst / 2)
            entries.append(VoucherLine(
                account_id=cgst_account.id,
                credit_amount=half_gst,
                description=f"Input CGST reversed - {original_invoice.invoice_number}",
            ))
            entries.append(VoucherLine(
                account_id=sgst_account.id,
                credit_amount=total_gst - half_gst,
                description=f"Input SGST reversed - {original_invoice.invoice_number}",
            ))
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.CREDIT_NOTE,
            entries=entries,
            voucher_date=voucher_date,
            description=f"Credit Note for {original_invoice.invoice_number}: {reason}",
            reference_type=ReferenceType.INVOICE,
            reference_id=original_invoice.id,
            party_id=original_invoice.vendor_id,
            party_type="vendor",
        )
    
    # ==================== TDS PAYMENT ====================
    
    def create_tds_payment_voucher(
        self,
        company: Company,
        amount: Decimal,
        challan_number: str,
        payment_date: Optional[datetime] = None,
        bank_account_id: Optional[str] = None,
    ) -> VoucherResult:
        """Create a payment voucher for TDS deposit.
        
        Double Entry:
        - Debit: TDS Payable (reduces liability)
        - Credit: Bank (reduces asset)
        """
        tds_account = self.get_or_create_account(
            company, self.ACCOUNTS["TDS_PAYABLE"],
            "TDS Payable", AccountType.LIABILITY
        )
        
        if bank_account_id:
            bank_account = self.db.query(Account).filter(Account.id == bank_account_id).first()
        else:
            bank_account = self.get_or_create_account(
                company, self.ACCOUNTS["BANK"],
                "Bank Account", AccountType.ASSET
            )
        
        entries = [
            VoucherLine(
                account_id=tds_account.id,
                debit_amount=self._round_amount(amount),
                description=f"TDS Deposit - Challan {challan_number}",
            ),
            VoucherLine(
                account_id=bank_account.id,
                credit_amount=self._round_amount(amount),
                description=f"TDS Payment - {challan_number}",
            ),
        ]
        
        return self.create_voucher(
            company=company,
            voucher_type=VoucherType.PAYMENT,
            entries=entries,
            voucher_date=payment_date,
            description=f"TDS Payment - Challan {challan_number}",
        )
    
    # ==================== REVERSAL ====================
    
    def reverse_voucher(
        self,
        company: Company,
        transaction_id: str,
        reversal_date: Optional[datetime] = None,
        reason: str = "",
    ) -> VoucherResult:
        """Reverse a voucher by creating opposite entries."""
        original = self.db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.company_id == company.id
        ).first()
        
        if not original:
            return VoucherResult(success=False, error="Transaction not found")
        
        if original.is_reversed:
            return VoucherResult(success=False, error="Transaction already reversed")
        
        # Get original entries
        original_entries = self.db.query(TransactionEntry).filter(
            TransactionEntry.transaction_id == transaction_id
        ).all()
        
        # Create reversed entries (swap debit/credit)
        reversed_entries = []
        for entry in original_entries:
            reversed_entries.append(VoucherLine(
                account_id=entry.account_id,
                debit_amount=entry.credit_amount,
                credit_amount=entry.debit_amount,
                description=f"Reversal: {entry.description}",
                party_id=entry.party_id,
            ))
        
        result = self.create_voucher(
            company=company,
            voucher_type=original.voucher_type,
            entries=reversed_entries,
            voucher_date=reversal_date,
            description=f"Reversal of {original.transaction_number}: {reason}",
            reference_type=ReferenceType.MANUAL,
            reference_id=original.id,
            narration=f"Reversal of {original.transaction_number}. Reason: {reason}",
        )
        
        if result.success:
            original.is_reversed = True
            original.reversal_id = result.transaction.id
            self.db.commit()
        
        return result
