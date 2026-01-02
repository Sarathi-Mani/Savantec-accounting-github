"""Purchase Service - Handles purchase invoices with GST Input Credit and TDS."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP

from app.database.models import (
    PurchaseInvoice, PurchaseInvoiceItem, PurchasePayment, TDSEntry, TDSSection,
    Company, Customer, Product, PurchaseOrder, ReceiptNote, Godown,
    PurchaseInvoiceStatus, PaymentMode, Account, Transaction, TransactionEntry,
    AccountType, TransactionStatus, ReferenceType, StockEntry, StockMovementType,
    INDIAN_STATE_CODES
)


class PurchaseService:
    """Service for purchase invoice operations with GST Input Credit."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round amount to 2 decimal places."""
        return Decimal(amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def _calculate_gst_split(
        self,
        taxable_amount: Decimal,
        gst_rate: Decimal,
        company_state_code: str,
        place_of_supply: str
    ) -> dict:
        """Calculate GST split (CGST+SGST or IGST) based on place of supply."""
        total_gst = self._round_amount(taxable_amount * gst_rate / 100)
        
        # If same state, split into CGST and SGST
        if company_state_code == place_of_supply:
            half_rate = gst_rate / 2
            cgst = self._round_amount(taxable_amount * half_rate / 100)
            sgst = total_gst - cgst
            return {
                "cgst_rate": half_rate,
                "sgst_rate": half_rate,
                "igst_rate": Decimal("0"),
                "cgst_amount": cgst,
                "sgst_amount": sgst,
                "igst_amount": Decimal("0"),
            }
        else:
            return {
                "cgst_rate": Decimal("0"),
                "sgst_rate": Decimal("0"),
                "igst_rate": gst_rate,
                "cgst_amount": Decimal("0"),
                "sgst_amount": Decimal("0"),
                "igst_amount": total_gst,
            }
    
    def _get_next_invoice_number(self, company: Company) -> str:
        """Generate next purchase invoice number."""
        count = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company.id
        ).count()
        prefix = company.invoice_prefix or "PUR"
        return f"{prefix}-{count + 1:05d}"
    
    def _get_financial_year_quarter(self, date_obj: datetime) -> Tuple[str, str]:
        """Get financial year and quarter for a date (Indian FY: April to March)."""
        year = date_obj.year
        month = date_obj.month
        
        # Financial year starts in April
        if month < 4:
            fy_start = year - 1
            fy_end = year
        else:
            fy_start = year
            fy_end = year + 1
        
        financial_year = f"{fy_start}-{fy_end}"
        
        # Quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
        if month in [4, 5, 6]:
            quarter = "Q1"
        elif month in [7, 8, 9]:
            quarter = "Q2"
        elif month in [10, 11, 12]:
            quarter = "Q3"
        else:
            quarter = "Q4"
        
        return financial_year, quarter
    
    # ==================== PURCHASE INVOICE ====================
    
    def create_purchase_invoice(
        self,
        company: Company,
        vendor_id: str,
        items: List[Dict[str, Any]],
        vendor_invoice_number: Optional[str] = None,
        vendor_invoice_date: Optional[datetime] = None,
        invoice_date: Optional[datetime] = None,
        due_date: Optional[datetime] = None,
        place_of_supply: Optional[str] = None,
        is_reverse_charge: bool = False,
        tds_section_id: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        receipt_note_id: Optional[str] = None,
        notes: Optional[str] = None,
        auto_receive_stock: bool = False,
        godown_id: Optional[str] = None,
    ) -> PurchaseInvoice:
        """Create a new purchase invoice with GST Input Credit."""
        
        # Get vendor
        vendor = self.db.query(Customer).filter(Customer.id == vendor_id).first()
        if not vendor:
            raise ValueError("Vendor not found")
        
        # Determine place of supply
        if not place_of_supply:
            place_of_supply = vendor.billing_state_code or company.state_code or "27"
        
        place_of_supply_name = INDIAN_STATE_CODES.get(place_of_supply, "")
        
        # Get TDS section if applicable
        tds_section = None
        tds_rate = Decimal("0")
        if tds_section_id:
            tds_section = self.db.query(TDSSection).filter(
                TDSSection.id == tds_section_id
            ).first()
            if tds_section:
                # Use company rate for companies, individual rate otherwise
                if vendor.gstin and len(vendor.gstin) == 15:
                    tds_rate = tds_section.rate_company
                else:
                    tds_rate = tds_section.rate_individual
                
                # Higher rate if no PAN
                if not vendor.pan:
                    tds_rate = tds_section.rate_no_pan
        
        # Create invoice
        invoice = PurchaseInvoice(
            company_id=company.id,
            vendor_id=vendor_id,
            invoice_number=self._get_next_invoice_number(company),
            vendor_invoice_number=vendor_invoice_number,
            invoice_date=invoice_date or datetime.utcnow(),
            vendor_invoice_date=vendor_invoice_date,
            due_date=due_date,
            purchase_order_id=purchase_order_id,
            receipt_note_id=receipt_note_id,
            place_of_supply=place_of_supply,
            place_of_supply_name=place_of_supply_name,
            is_reverse_charge=is_reverse_charge,
            tds_applicable=bool(tds_section_id),
            tds_section_id=tds_section_id,
            tds_rate=tds_rate,
            status=PurchaseInvoiceStatus.DRAFT,
            notes=notes,
        )
        
        self.db.add(invoice)
        self.db.flush()
        
        # Calculate totals
        subtotal = Decimal("0")
        total_cgst = Decimal("0")
        total_sgst = Decimal("0")
        total_igst = Decimal("0")
        total_discount = Decimal("0")
        
        # Add items
        for item_data in items:
            qty = Decimal(str(item_data.get("quantity", 0)))
            unit_price = Decimal(str(item_data.get("unit_price", 0)))
            gst_rate = Decimal(str(item_data.get("gst_rate", 18)))
            discount_percent = Decimal(str(item_data.get("discount_percent", 0)))
            
            # Calculate amounts
            base_amount = self._round_amount(qty * unit_price)
            discount_amount = self._round_amount(base_amount * discount_percent / 100)
            taxable_amount = base_amount - discount_amount
            
            # Calculate GST
            gst_split = self._calculate_gst_split(
                taxable_amount,
                gst_rate,
                company.state_code or "27",
                place_of_supply
            )
            
            total_tax = gst_split["cgst_amount"] + gst_split["sgst_amount"] + gst_split["igst_amount"]
            total_amount = taxable_amount + total_tax
            
            item = PurchaseInvoiceItem(
                purchase_invoice_id=invoice.id,
                product_id=item_data.get("product_id"),
                description=item_data.get("description", ""),
                hsn_code=item_data.get("hsn_code"),
                quantity=qty,
                unit=item_data.get("unit", "unit"),
                unit_price=unit_price,
                discount_percent=discount_percent,
                discount_amount=discount_amount,
                gst_rate=gst_rate,
                cgst_rate=gst_split["cgst_rate"],
                sgst_rate=gst_split["sgst_rate"],
                igst_rate=gst_split["igst_rate"],
                cgst_amount=gst_split["cgst_amount"],
                sgst_amount=gst_split["sgst_amount"],
                igst_amount=gst_split["igst_amount"],
                taxable_amount=taxable_amount,
                total_amount=total_amount,
                itc_eligible=item_data.get("itc_eligible", True),
                godown_id=godown_id,
            )
            self.db.add(item)
            
            # Accumulate totals
            subtotal += taxable_amount
            total_cgst += gst_split["cgst_amount"]
            total_sgst += gst_split["sgst_amount"]
            total_igst += gst_split["igst_amount"]
            total_discount += discount_amount
        
        # Calculate TDS
        tds_amount = Decimal("0")
        if invoice.tds_applicable and tds_rate > 0:
            tds_amount = self._round_amount(subtotal * tds_rate / 100)
        
        # Update invoice totals
        total_tax = total_cgst + total_sgst + total_igst
        total_amount = subtotal + total_tax
        net_payable = total_amount - tds_amount
        
        invoice.subtotal = subtotal
        invoice.discount_amount = total_discount
        invoice.cgst_amount = total_cgst
        invoice.sgst_amount = total_sgst
        invoice.igst_amount = total_igst
        invoice.total_tax = total_tax
        invoice.total_amount = total_amount
        invoice.tds_amount = tds_amount
        invoice.net_payable = net_payable
        invoice.balance_due = net_payable
        
        self.db.commit()
        self.db.refresh(invoice)
        
        # Auto-receive stock if requested
        if auto_receive_stock:
            self.receive_stock_for_invoice(invoice, godown_id)
        
        return invoice
    
    def approve_purchase_invoice(self, invoice: PurchaseInvoice) -> PurchaseInvoice:
        """Approve a purchase invoice and create accounting entries."""
        if invoice.status != PurchaseInvoiceStatus.DRAFT:
            raise ValueError("Only draft invoices can be approved")
        
        invoice.status = PurchaseInvoiceStatus.APPROVED
        
        # Create TDS entry if applicable
        if invoice.tds_applicable and invoice.tds_amount > 0:
            self._create_tds_entry(invoice)
        
        # Create accounting entries
        self._create_purchase_accounting_entries(invoice)
        
        self.db.commit()
        self.db.refresh(invoice)
        return invoice
    
    def _create_tds_entry(self, invoice: PurchaseInvoice) -> TDSEntry:
        """Create TDS entry for a purchase invoice."""
        vendor = invoice.vendor
        fy, quarter = self._get_financial_year_quarter(invoice.invoice_date)
        
        tds_entry = TDSEntry(
            company_id=invoice.company_id,
            purchase_invoice_id=invoice.id,
            vendor_id=invoice.vendor_id,
            vendor_name=vendor.name if vendor else "",
            vendor_pan=vendor.pan if vendor else "",
            tds_section_id=invoice.tds_section_id,
            section_code=invoice.tds_section.section_code if invoice.tds_section else "",
            gross_amount=invoice.subtotal,
            tds_rate=invoice.tds_rate,
            tds_amount=invoice.tds_amount,
            deduction_date=invoice.invoice_date,
            financial_year=fy,
            quarter=quarter,
        )
        self.db.add(tds_entry)
        return tds_entry
    
    def _create_purchase_accounting_entries(self, invoice: PurchaseInvoice) -> Optional[Transaction]:
        """Create accounting entries for a purchase invoice."""
        company = invoice.company
        
        # Get required accounts
        purchase_account = self._get_account_by_code("5100", company)  # Purchases
        ap_account = self._get_account_by_code("2000", company)  # Accounts Payable
        cgst_input = self._get_account_by_code("1301", company)  # Input CGST
        sgst_input = self._get_account_by_code("1302", company)  # Input SGST
        igst_input = self._get_account_by_code("1303", company)  # Input IGST
        tds_payable = self._get_account_by_code("2200", company)  # TDS Payable
        
        # Create accounts if they don't exist
        if not purchase_account:
            purchase_account = self._create_account(company, "5100", "Purchases", AccountType.EXPENSE)
        if not ap_account:
            ap_account = self._create_account(company, "2000", "Accounts Payable", AccountType.LIABILITY)
        if not cgst_input:
            cgst_input = self._create_account(company, "1301", "Input CGST", AccountType.ASSET)
        if not sgst_input:
            sgst_input = self._create_account(company, "1302", "Input SGST", AccountType.ASSET)
        if not igst_input:
            igst_input = self._create_account(company, "1303", "Input IGST", AccountType.ASSET)
        if not tds_payable:
            tds_payable = self._create_account(company, "2200", "TDS Payable", AccountType.LIABILITY)
        
        entries = []
        
        # Debit: Purchases (expense)
        entries.append({
            "account_id": purchase_account.id,
            "debit_amount": invoice.subtotal,
            "credit_amount": Decimal("0"),
            "description": f"Purchase - {invoice.vendor_invoice_number or invoice.invoice_number}"
        })
        
        # Debit: Input GST (asset - tax credit)
        if invoice.cgst_amount > 0:
            entries.append({
                "account_id": cgst_input.id,
                "debit_amount": invoice.cgst_amount,
                "credit_amount": Decimal("0"),
                "description": f"Input CGST - {invoice.invoice_number}"
            })
        if invoice.sgst_amount > 0:
            entries.append({
                "account_id": sgst_input.id,
                "debit_amount": invoice.sgst_amount,
                "credit_amount": Decimal("0"),
                "description": f"Input SGST - {invoice.invoice_number}"
            })
        if invoice.igst_amount > 0:
            entries.append({
                "account_id": igst_input.id,
                "debit_amount": invoice.igst_amount,
                "credit_amount": Decimal("0"),
                "description": f"Input IGST - {invoice.invoice_number}"
            })
        
        # Credit: Accounts Payable (net payable after TDS)
        entries.append({
            "account_id": ap_account.id,
            "debit_amount": Decimal("0"),
            "credit_amount": invoice.net_payable,
            "description": f"Payable to {invoice.vendor.name if invoice.vendor else 'Vendor'}"
        })
        
        # Credit: TDS Payable (if TDS applicable)
        if invoice.tds_amount > 0:
            entries.append({
                "account_id": tds_payable.id,
                "debit_amount": Decimal("0"),
                "credit_amount": invoice.tds_amount,
                "description": f"TDS u/s {invoice.tds_section.section_code if invoice.tds_section else ''}"
            })
        
        # Create transaction
        total_debit = sum(e["debit_amount"] for e in entries)
        total_credit = sum(e["credit_amount"] for e in entries)
        
        transaction = Transaction(
            company_id=company.id,
            transaction_number=f"PUR-{invoice.invoice_number}",
            transaction_date=invoice.invoice_date,
            description=f"Purchase Invoice {invoice.invoice_number}",
            reference_type=ReferenceType.INVOICE,
            reference_id=invoice.id,
            status=TransactionStatus.POSTED,
            total_debit=total_debit,
            total_credit=total_credit,
        )
        self.db.add(transaction)
        self.db.flush()
        
        for entry_data in entries:
            entry = TransactionEntry(
                transaction_id=transaction.id,
                account_id=entry_data["account_id"],
                debit_amount=entry_data["debit_amount"],
                credit_amount=entry_data["credit_amount"],
                description=entry_data["description"],
            )
            self.db.add(entry)
        
        # Balances are calculated from transaction entries, not stored
        return transaction
    
    def _get_account_by_code(self, code: str, company: Company) -> Optional[Account]:
        """Get account by code."""
        return self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == code
        ).first()
    
    def _create_account(self, company: Company, code: str, name: str, account_type: AccountType) -> Account:
        """Create a new account."""
        account = Account(
            company_id=company.id,
            code=code,
            name=name,
            account_type=account_type,
        )
        self.db.add(account)
        self.db.flush()
        return account
    
    def receive_stock_for_invoice(
        self,
        invoice: PurchaseInvoice,
        godown_id: Optional[str] = None
    ) -> List[StockEntry]:
        """Receive stock for all items in a purchase invoice."""
        entries = []
        
        for item in invoice.items:
            if item.stock_received or not item.product_id:
                continue
            
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            target_godown = godown_id or item.godown_id
            
            entry = StockEntry(
                company_id=invoice.company_id,
                product_id=item.product_id,
                godown_id=target_godown,
                entry_date=invoice.invoice_date,
                movement_type=StockMovementType.PURCHASE,
                quantity=item.quantity,
                unit=item.unit,
                rate=item.unit_price,
                value=item.taxable_amount,
                reference_type="purchase_invoice",
                reference_id=invoice.id,
                reference_number=invoice.invoice_number,
                notes=f"Purchase from {invoice.vendor.name if invoice.vendor else 'Vendor'}"
            )
            self.db.add(entry)
            entries.append(entry)
            
            # Update product stock
            product.current_stock = (product.current_stock or Decimal("0")) + item.quantity
            
            # Mark item as received
            item.stock_received = True
            item.godown_id = target_godown
        
        self.db.commit()
        return entries
    
    # ==================== PAYMENT ====================
    
    def record_payment(
        self,
        invoice: PurchaseInvoice,
        amount: Decimal,
        payment_date: Optional[datetime] = None,
        payment_mode: PaymentMode = PaymentMode.BANK_TRANSFER,
        reference_number: Optional[str] = None,
        bank_account_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> PurchasePayment:
        """Record a payment against a purchase invoice."""
        if amount > invoice.balance_due:
            raise ValueError(f"Payment amount ({amount}) exceeds balance due ({invoice.balance_due})")
        
        payment = PurchasePayment(
            purchase_invoice_id=invoice.id,
            amount=amount,
            payment_date=payment_date or datetime.utcnow(),
            payment_mode=payment_mode,
            reference_number=reference_number,
            bank_account_id=bank_account_id,
            notes=notes,
        )
        self.db.add(payment)
        
        # Update invoice
        invoice.amount_paid += amount
        invoice.balance_due -= amount
        
        if invoice.balance_due <= 0:
            invoice.status = PurchaseInvoiceStatus.PAID
        elif invoice.amount_paid > 0:
            invoice.status = PurchaseInvoiceStatus.PARTIALLY_PAID
        
        # Create payment accounting entry
        self._create_payment_accounting_entry(invoice, payment)
        
        self.db.commit()
        self.db.refresh(payment)
        return payment
    
    def _create_payment_accounting_entry(
        self,
        invoice: PurchaseInvoice,
        payment: PurchasePayment
    ) -> Optional[Transaction]:
        """Create accounting entry for purchase payment."""
        company = invoice.company
        
        ap_account = self._get_account_by_code("2000", company)
        
        # Get bank/cash account
        if payment.payment_mode == PaymentMode.CASH:
            cash_account = self._get_account_by_code("1000", company)
            if not cash_account:
                cash_account = self._create_account(company, "1000", "Cash", AccountType.ASSET)
            payment_account = cash_account
        else:
            bank_account = self._get_account_by_code("1010", company)
            if not bank_account:
                bank_account = self._create_account(company, "1010", "Bank Account", AccountType.ASSET)
            payment_account = bank_account
        
        if not ap_account:
            return None
        
        transaction = Transaction(
            company_id=company.id,
            transaction_number=f"PPMT-{payment.id[:8]}",
            transaction_date=payment.payment_date,
            description=f"Payment for Purchase {invoice.invoice_number}",
            reference_type=ReferenceType.PAYMENT,
            reference_id=payment.id,
            status=TransactionStatus.POSTED,
            total_debit=payment.amount,
            total_credit=payment.amount,
        )
        self.db.add(transaction)
        self.db.flush()
        
        # Debit: Accounts Payable (reducing liability)
        entry1 = TransactionEntry(
            transaction_id=transaction.id,
            account_id=ap_account.id,
            debit_amount=payment.amount,
            credit_amount=Decimal("0"),
            description=f"Payment to {invoice.vendor.name if invoice.vendor else 'Vendor'}"
        )
        self.db.add(entry1)
        
        # Credit: Bank/Cash (reducing asset)
        entry2 = TransactionEntry(
            transaction_id=transaction.id,
            account_id=payment_account.id,
            debit_amount=Decimal("0"),
            credit_amount=payment.amount,
            description=f"Payment for {invoice.invoice_number}"
        )
        self.db.add(entry2)
        
        # Balances are calculated from transaction entries, not stored
        payment.transaction_id = transaction.id
        
        return transaction
    
    # ==================== QUERIES ====================
    
    def get_purchase_invoice(self, invoice_id: str, company: Company) -> Optional[PurchaseInvoice]:
        """Get a purchase invoice by ID."""
        return self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.id == invoice_id,
            PurchaseInvoice.company_id == company.id
        ).first()
    
    def get_purchase_invoices(
        self,
        company: Company,
        vendor_id: Optional[str] = None,
        status: Optional[PurchaseInvoiceStatus] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[PurchaseInvoice], int]:
        """Get purchase invoices with filters."""
        query = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company.id
        )
        
        if vendor_id:
            query = query.filter(PurchaseInvoice.vendor_id == vendor_id)
        if status:
            query = query.filter(PurchaseInvoice.status == status)
        if from_date:
            query = query.filter(PurchaseInvoice.invoice_date >= from_date)
        if to_date:
            query = query.filter(PurchaseInvoice.invoice_date <= to_date)
        
        total = query.count()
        
        offset = (page - 1) * page_size
        invoices = query.order_by(PurchaseInvoice.invoice_date.desc()).offset(offset).limit(page_size).all()
        
        return invoices, total
    
    def get_input_gst_summary(
        self,
        company: Company,
        from_date: date,
        to_date: date
    ) -> Dict[str, Any]:
        """Get Input GST summary for a period (for GST returns)."""
        invoices = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company.id,
            PurchaseInvoice.invoice_date >= from_date,
            PurchaseInvoice.invoice_date <= to_date,
            PurchaseInvoice.status != PurchaseInvoiceStatus.CANCELLED,
            PurchaseInvoice.itc_eligible == True,
        ).all()
        
        total_taxable = Decimal("0")
        total_cgst = Decimal("0")
        total_sgst = Decimal("0")
        total_igst = Decimal("0")
        total_itc = Decimal("0")
        
        for inv in invoices:
            total_taxable += inv.subtotal
            total_cgst += inv.cgst_amount
            total_sgst += inv.sgst_amount
            total_igst += inv.igst_amount
        
        total_itc = total_cgst + total_sgst + total_igst
        
        return {
            "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
            "total_invoices": len(invoices),
            "total_taxable_value": float(total_taxable),
            "cgst_input": float(total_cgst),
            "sgst_input": float(total_sgst),
            "igst_input": float(total_igst),
            "total_itc_available": float(total_itc),
        }
    
    def cancel_purchase_invoice(self, invoice: PurchaseInvoice, reason: str = None) -> PurchaseInvoice:
        """Cancel a purchase invoice."""
        if invoice.status == PurchaseInvoiceStatus.PAID:
            raise ValueError("Cannot cancel a paid invoice")
        
        # Reverse stock if received
        for item in invoice.items:
            if item.stock_received and item.product_id:
                product = self.db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product.current_stock = (product.current_stock or Decimal("0")) - item.quantity
                item.stock_received = False
        
        invoice.status = PurchaseInvoiceStatus.CANCELLED
        if reason:
            invoice.notes = f"{invoice.notes or ''}\n\n[CANCELLED] {reason}".strip()
        
        self.db.commit()
        self.db.refresh(invoice)
        return invoice
