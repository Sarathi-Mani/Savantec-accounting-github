"""Report service for financial reports."""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from app.database.models import (
    Account, Transaction, TransactionEntry, Company,
    AccountType, TransactionStatus
)


class ReportService:
    """Service for generating financial reports."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_account_balance_at_date(
        self,
        account: Account,
        as_of_date: datetime
    ) -> Decimal:
        """Calculate account balance as of a specific date from transaction entries.
        Opening balances are now stored as transactions, so they're included in the query.
        """
        result = self.db.query(
            func.coalesce(func.sum(TransactionEntry.debit_amount), 0).label('total_debit'),
            func.coalesce(func.sum(TransactionEntry.credit_amount), 0).label('total_credit')
        ).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == TransactionStatus.POSTED,
            Transaction.transaction_date <= as_of_date
        ).first()
        
        total_debit = Decimal(str(result.total_debit or 0))
        total_credit = Decimal(str(result.total_credit or 0))
        
        # Assets and Expenses: Debits increase, Credits decrease
        # Liabilities, Equity, Revenue: Credits increase, Debits decrease
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return total_debit - total_credit
        else:
            return total_credit - total_debit
    
    def _get_account_balance_for_period(
        self,
        account: Account,
        from_date: datetime,
        to_date: datetime
    ) -> Decimal:
        """Calculate account activity for a period (for P&L)."""
        result = self.db.query(
            func.sum(TransactionEntry.debit_amount).label('total_debit'),
            func.sum(TransactionEntry.credit_amount).label('total_credit')
        ).join(Transaction).filter(
            TransactionEntry.account_id == account.id,
            Transaction.status == TransactionStatus.POSTED,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date
        ).first()
        
        total_debit = result.total_debit or Decimal("0")
        total_credit = result.total_credit or Decimal("0")
        
        # For Revenue: Credit is positive (income)
        # For Expenses: Debit is positive (expense)
        if account.account_type == AccountType.REVENUE:
            return total_credit - total_debit
        elif account.account_type == AccountType.EXPENSE:
            return total_debit - total_credit
        else:
            return total_debit - total_credit
    
    def get_trial_balance(
        self,
        company: Company,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate trial balance report."""
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.is_active == True
        ).order_by(Account.code).all()
        
        entries = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        
        for account in accounts:
            balance = self._get_account_balance_at_date(account, as_of_date)
            
            if balance == 0:
                continue
            
            # Assets and Expenses have debit balances
            # Liabilities, Equity, Revenue have credit balances
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                debit_balance = balance if balance > 0 else Decimal("0")
                credit_balance = abs(balance) if balance < 0 else Decimal("0")
            else:
                credit_balance = balance if balance > 0 else Decimal("0")
                debit_balance = abs(balance) if balance < 0 else Decimal("0")
            
            entries.append({
                "account_id": account.id,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": account.account_type.value,
                "debit_balance": debit_balance,
                "credit_balance": credit_balance,
            })
            
            total_debit += debit_balance
            total_credit += credit_balance
        
        return {
            "as_of_date": as_of_date,
            "entries": entries,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "is_balanced": total_debit == total_credit,
        }
    
    def get_profit_loss(
        self,
        company: Company,
        from_date: datetime,
        to_date: datetime
    ) -> Dict[str, Any]:
        """Generate Profit & Loss statement."""
        # Get revenue accounts
        revenue_accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.account_type == AccountType.REVENUE,
            Account.is_active == True
        ).order_by(Account.code).all()
        
        # Get expense accounts
        expense_accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.account_type == AccountType.EXPENSE,
            Account.is_active == True
        ).order_by(Account.code).all()
        
        revenue_entries = []
        total_revenue = Decimal("0")
        
        for account in revenue_accounts:
            amount = self._get_account_balance_for_period(account, from_date, to_date)
            if amount != 0:
                revenue_entries.append({
                    "account_id": account.id,
                    "account_name": account.name,
                    "amount": amount,
                })
                total_revenue += amount
        
        expense_entries = []
        total_expenses = Decimal("0")
        
        for account in expense_accounts:
            amount = self._get_account_balance_for_period(account, from_date, to_date)
            if amount != 0:
                expense_entries.append({
                    "account_id": account.id,
                    "account_name": account.name,
                    "amount": amount,
                })
                total_expenses += amount
        
        gross_profit = total_revenue
        net_profit = total_revenue - total_expenses
        
        return {
            "from_date": from_date,
            "to_date": to_date,
            "revenue": {
                "name": "Revenue",
                "accounts": revenue_entries,
                "total": total_revenue,
            },
            "expenses": {
                "name": "Expenses",
                "accounts": expense_entries,
                "total": total_expenses,
            },
            "gross_profit": gross_profit,
            "net_profit": net_profit,
        }
    
    def get_balance_sheet(
        self,
        company: Company,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate Balance Sheet."""
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        # Get all accounts
        asset_accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.account_type == AccountType.ASSET,
            Account.is_active == True
        ).order_by(Account.code).all()
        
        liability_accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.account_type == AccountType.LIABILITY,
            Account.is_active == True
        ).order_by(Account.code).all()
        
        equity_accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.account_type == AccountType.EQUITY,
            Account.is_active == True
        ).order_by(Account.code).all()
        
        # Calculate retained earnings (net income)
        # This is the cumulative profit/loss from inception
        revenue_total = Decimal("0")
        expense_total = Decimal("0")
        
        for account in self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.account_type == AccountType.REVENUE
        ).all():
            revenue_total += self._get_account_balance_at_date(account, as_of_date)
        
        for account in self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.account_type == AccountType.EXPENSE
        ).all():
            expense_total += self._get_account_balance_at_date(account, as_of_date)
        
        retained_earnings = revenue_total - expense_total
        
        # Assets
        asset_entries = []
        total_assets = Decimal("0")
        
        for account in asset_accounts:
            balance = self._get_account_balance_at_date(account, as_of_date)
            if balance != 0:
                asset_entries.append({
                    "account_id": account.id,
                    "account_name": account.name,
                    "amount": balance,
                })
                total_assets += balance
        
        # Liabilities
        liability_entries = []
        total_liabilities = Decimal("0")
        
        for account in liability_accounts:
            balance = self._get_account_balance_at_date(account, as_of_date)
            if balance != 0:
                liability_entries.append({
                    "account_id": account.id,
                    "account_name": account.name,
                    "amount": balance,
                })
                total_liabilities += balance
        
        # Equity
        equity_entries = []
        total_equity = Decimal("0")
        
        for account in equity_accounts:
            balance = self._get_account_balance_at_date(account, as_of_date)
            if balance != 0:
                equity_entries.append({
                    "account_id": account.id,
                    "account_name": account.name,
                    "amount": balance,
                })
                total_equity += balance
        
        # Add retained earnings to equity
        if retained_earnings != 0:
            equity_entries.append({
                "account_id": None,
                "account_name": "Retained Earnings (Current Period)",
                "amount": retained_earnings,
            })
            total_equity += retained_earnings
        
        total_liabilities_equity = total_liabilities + total_equity
        
        return {
            "as_of_date": as_of_date,
            "assets": {
                "name": "Assets",
                "accounts": asset_entries,
                "total": total_assets,
            },
            "liabilities": {
                "name": "Liabilities",
                "accounts": liability_entries,
                "total": total_liabilities,
            },
            "equity": {
                "name": "Equity",
                "accounts": equity_entries,
                "total": total_equity,
            },
            "total_assets": total_assets,
            "total_liabilities_equity": total_liabilities_equity,
            "is_balanced": total_assets == total_liabilities_equity,
        }
    
    def get_cash_flow(
        self,
        company: Company,
        from_date: datetime,
        to_date: datetime
    ) -> Dict[str, Any]:
        """Generate Cash Flow statement."""
        # Get cash accounts
        cash_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "1000"
        ).first()
        
        bank_accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code.like("1010%")
        ).all()
        
        all_cash_accounts = [cash_account] if cash_account else []
        all_cash_accounts.extend(bank_accounts)
        
        # Calculate opening cash balance
        opening_cash = Decimal("0")
        for account in all_cash_accounts:
            if account:
                opening_cash += self._get_account_balance_at_date(
                    account, 
                    from_date - timedelta(seconds=1)
                )
        
        # Calculate closing cash balance
        closing_cash = Decimal("0")
        for account in all_cash_accounts:
            if account:
                closing_cash += self._get_account_balance_at_date(account, to_date)
        
        # Operating Activities
        # Cash from sales (Accounts Receivable decreases)
        # Cash paid for expenses
        operating_entries = []
        operating_total = Decimal("0")
        
        # Get P&L for operating cash flow
        pl = self.get_profit_loss(company, from_date, to_date)
        
        operating_entries.append({
            "description": "Net Income",
            "amount": pl["net_profit"],
        })
        operating_total += pl["net_profit"]
        
        # Changes in working capital
        ar_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "1100"
        ).first()
        
        if ar_account:
            ar_start = self._get_account_balance_at_date(ar_account, from_date - timedelta(seconds=1))
            ar_end = self._get_account_balance_at_date(ar_account, to_date)
            ar_change = ar_start - ar_end  # Decrease is positive cash flow
            
            if ar_change != 0:
                operating_entries.append({
                    "description": "Change in Accounts Receivable",
                    "amount": ar_change,
                })
                operating_total += ar_change
        
        ap_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "2000"
        ).first()
        
        if ap_account:
            ap_start = self._get_account_balance_at_date(ap_account, from_date - timedelta(seconds=1))
            ap_end = self._get_account_balance_at_date(ap_account, to_date)
            ap_change = ap_end - ap_start  # Increase is positive cash flow
            
            if ap_change != 0:
                operating_entries.append({
                    "description": "Change in Accounts Payable",
                    "amount": ap_change,
                })
                operating_total += ap_change
        
        # Investing Activities (Fixed Assets)
        investing_entries = []
        investing_total = Decimal("0")
        
        fixed_assets = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "1500"
        ).first()
        
        if fixed_assets:
            fa_start = self._get_account_balance_at_date(fixed_assets, from_date - timedelta(seconds=1))
            fa_end = self._get_account_balance_at_date(fixed_assets, to_date)
            fa_change = fa_start - fa_end  # Decrease is positive (asset sale)
            
            if fa_change != 0:
                investing_entries.append({
                    "description": "Purchase/Sale of Fixed Assets",
                    "amount": fa_change,
                })
                investing_total += fa_change
        
        # Financing Activities (Loans, Equity)
        financing_entries = []
        financing_total = Decimal("0")
        
        loans_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "2300"
        ).first()
        
        if loans_account:
            loans_start = self._get_account_balance_at_date(loans_account, from_date - timedelta(seconds=1))
            loans_end = self._get_account_balance_at_date(loans_account, to_date)
            loans_change = loans_end - loans_start  # Increase is positive
            
            if loans_change != 0:
                financing_entries.append({
                    "description": "Loan Proceeds/Repayments",
                    "amount": loans_change,
                })
                financing_total += loans_change
        
        equity_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "3000"
        ).first()
        
        if equity_account:
            eq_start = self._get_account_balance_at_date(equity_account, from_date - timedelta(seconds=1))
            eq_end = self._get_account_balance_at_date(equity_account, to_date)
            eq_change = eq_end - eq_start  # Increase is positive
            
            if eq_change != 0:
                financing_entries.append({
                    "description": "Capital Contributions/Withdrawals",
                    "amount": eq_change,
                })
                financing_total += eq_change
        
        net_cash_change = operating_total + investing_total + financing_total
        
        return {
            "from_date": from_date,
            "to_date": to_date,
            "operating_activities": {
                "name": "Operating Activities",
                "entries": operating_entries,
                "total": operating_total,
            },
            "investing_activities": {
                "name": "Investing Activities",
                "entries": investing_entries,
                "total": investing_total,
            },
            "financing_activities": {
                "name": "Financing Activities",
                "entries": financing_entries,
                "total": financing_total,
            },
            "net_cash_change": net_cash_change,
            "opening_cash": opening_cash,
            "closing_cash": closing_cash,
        }
    
    def get_account_summary(
        self,
        company: Company,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Decimal]:
        """Get summary of account balances by type."""
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        summary = {
            "total_assets": Decimal("0"),
            "total_liabilities": Decimal("0"),
            "total_equity": Decimal("0"),
            "total_revenue": Decimal("0"),
            "total_expenses": Decimal("0"),
            "cash_balance": Decimal("0"),
            "accounts_receivable": Decimal("0"),
            "accounts_payable": Decimal("0"),
        }
        
        accounts = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.is_active == True
        ).all()
        
        for account in accounts:
            balance = self._get_account_balance_at_date(account, as_of_date)
            
            if account.account_type == AccountType.ASSET:
                summary["total_assets"] += balance
                if account.code in ["1000", "1010"] or account.code.startswith("1010"):
                    summary["cash_balance"] += balance
                elif account.code == "1100":
                    summary["accounts_receivable"] = balance
                    
            elif account.account_type == AccountType.LIABILITY:
                summary["total_liabilities"] += balance
                if account.code == "2000":
                    summary["accounts_payable"] = balance
                    
            elif account.account_type == AccountType.EQUITY:
                summary["total_equity"] += balance
                
            elif account.account_type == AccountType.REVENUE:
                summary["total_revenue"] += balance
                
            elif account.account_type == AccountType.EXPENSE:
                summary["total_expenses"] += balance
        
        return summary
    
    # ============== ADVANCED REPORTS ==============
    
    def get_outstanding_receivables(
        self,
        company: Company,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get outstanding receivables (who owes us money)."""
        from app.database.models import Invoice, Customer, InvoiceStatus
        
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        # Get unpaid invoices
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
            Invoice.invoice_date <= as_of_date
        ).order_by(Invoice.due_date).all()
        
        # Group by customer
        by_customer = {}
        total_outstanding = Decimal("0")
        
        for inv in invoices:
            customer_name = inv.customer.name if inv.customer else "Unknown"
            customer_id = inv.customer_id or "unknown"
            
            if customer_id not in by_customer:
                by_customer[customer_id] = {
                    "customer_id": customer_id,
                    "customer_name": customer_name,
                    "invoices": [],
                    "total_outstanding": Decimal("0"),
                }
            
            outstanding = inv.balance_due or (inv.total_amount - (inv.amount_paid or Decimal("0")))
            by_customer[customer_id]["invoices"].append({
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date,
                "due_date": inv.due_date,
                "total_amount": inv.total_amount,
                "amount_paid": inv.amount_paid or Decimal("0"),
                "outstanding": outstanding,
                "days_overdue": (as_of_date.date() - inv.due_date.date()).days if inv.due_date and inv.due_date < as_of_date else 0,
            })
            by_customer[customer_id]["total_outstanding"] += outstanding
            total_outstanding += outstanding
        
        return {
            "as_of_date": as_of_date,
            "customers": list(by_customer.values()),
            "total_outstanding": total_outstanding,
            "customer_count": len(by_customer),
            "invoice_count": len(invoices),
        }
    
    def get_outstanding_payables(
        self,
        company: Company,
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get outstanding payables (who we owe money to)."""
        # For now, we'll return data based on expense transactions
        # In a full implementation, this would track purchase invoices
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        # Get accounts payable account
        payable_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "2000"  # Accounts Payable
        ).first()
        
        if not payable_account:
            return {
                "as_of_date": as_of_date,
                "vendors": [],
                "total_outstanding": Decimal("0"),
            }
        
        balance = self._get_account_balance_at_date(payable_account, as_of_date)
        
        return {
            "as_of_date": as_of_date,
            "vendors": [],  # Would be populated with vendor details
            "total_outstanding": balance,
        }
    
    def get_aging_report(
        self,
        company: Company,
        report_type: str = "receivables",  # or "payables"
        as_of_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get aging analysis of receivables or payables."""
        from app.database.models import Invoice, InvoiceStatus
        
        if as_of_date is None:
            as_of_date = datetime.utcnow()
        
        if report_type == "receivables":
            invoices = self.db.query(Invoice).filter(
                Invoice.company_id == company.id,
                Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
                Invoice.invoice_date <= as_of_date
            ).all()
        else:
            # For payables, would query purchase invoices
            invoices = []
        
        # Age buckets
        aging = {
            "current": {"label": "Current", "amount": Decimal("0"), "invoices": []},
            "1_30": {"label": "1-30 Days", "amount": Decimal("0"), "invoices": []},
            "31_60": {"label": "31-60 Days", "amount": Decimal("0"), "invoices": []},
            "61_90": {"label": "61-90 Days", "amount": Decimal("0"), "invoices": []},
            "over_90": {"label": "90+ Days", "amount": Decimal("0"), "invoices": []},
        }
        
        total = Decimal("0")
        
        for inv in invoices:
            outstanding = inv.balance_due or (inv.total_amount - (inv.amount_paid or Decimal("0")))
            
            if inv.due_date:
                days_overdue = (as_of_date.date() - inv.due_date.date()).days
            else:
                days_overdue = 0
            
            inv_data = {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "customer_name": inv.customer.name if inv.customer else "Unknown",
                "due_date": inv.due_date,
                "amount": outstanding,
                "days_overdue": days_overdue,
            }
            
            if days_overdue <= 0:
                aging["current"]["amount"] += outstanding
                aging["current"]["invoices"].append(inv_data)
            elif days_overdue <= 30:
                aging["1_30"]["amount"] += outstanding
                aging["1_30"]["invoices"].append(inv_data)
            elif days_overdue <= 60:
                aging["31_60"]["amount"] += outstanding
                aging["31_60"]["invoices"].append(inv_data)
            elif days_overdue <= 90:
                aging["61_90"]["amount"] += outstanding
                aging["61_90"]["invoices"].append(inv_data)
            else:
                aging["over_90"]["amount"] += outstanding
                aging["over_90"]["invoices"].append(inv_data)
            
            total += outstanding
        
        return {
            "as_of_date": as_of_date,
            "report_type": report_type,
            "aging": aging,
            "total": total,
        }
    
    def get_party_statement(
        self,
        company: Company,
        party_id: str,
        party_type: str = "customer",  # or "vendor"
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get statement for a specific party (customer/vendor)."""
        from app.database.models import Invoice, Payment, Customer, InvoiceStatus
        
        if from_date is None:
            from_date = datetime.utcnow().replace(month=1, day=1)  # Start of year
        if to_date is None:
            to_date = datetime.utcnow()
        
        # Get party details
        party = self.db.query(Customer).filter(Customer.id == party_id).first()
        if not party:
            return {"error": "Party not found"}
        
        # Get invoices and payments
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.customer_id == party_id,
            Invoice.invoice_date.between(from_date, to_date)
        ).order_by(Invoice.invoice_date).all()
        
        # Build statement entries
        entries = []
        running_balance = Decimal("0")
        
        for inv in invoices:
            # Invoice entry
            running_balance += inv.total_amount
            entries.append({
                "date": inv.invoice_date,
                "type": "invoice",
                "reference": inv.invoice_number,
                "description": f"Invoice {inv.invoice_number}",
                "debit": inv.total_amount,
                "credit": Decimal("0"),
                "balance": running_balance,
            })
            
            # Payment entries
            for pmt in inv.payments:
                if from_date <= pmt.payment_date <= to_date:
                    running_balance -= pmt.amount
                    entries.append({
                        "date": pmt.payment_date,
                        "type": "payment",
                        "reference": pmt.reference_number or "Payment",
                        "description": f"Payment received - {pmt.payment_mode.value if pmt.payment_mode else 'N/A'}",
                        "debit": Decimal("0"),
                        "credit": pmt.amount,
                        "balance": running_balance,
                    })
        
        # Sort by date
        entries.sort(key=lambda x: x["date"])
        
        # Calculate totals
        total_invoiced = sum(e["debit"] for e in entries)
        total_paid = sum(e["credit"] for e in entries)
        
        return {
            "party": {
                "id": party.id,
                "name": party.name,
                "type": party_type,
                "gstin": party.gstin,
            },
            "from_date": from_date,
            "to_date": to_date,
            "entries": entries,
            "summary": {
                "opening_balance": Decimal("0"),  # Would need previous period calculation
                "total_invoiced": total_invoiced,
                "total_paid": total_paid,
                "closing_balance": running_balance,
            },
        }
    
    def get_day_book(
        self,
        company: Company,
        date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get all transactions for a specific day."""
        if date is None:
            date = datetime.utcnow()
        
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        transactions = self.db.query(Transaction).filter(
            Transaction.company_id == company.id,
            Transaction.status == TransactionStatus.POSTED,
            Transaction.transaction_date.between(start_of_day, end_of_day)
        ).order_by(Transaction.transaction_date).all()
        
        entries = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        
        for txn in transactions:
            for entry in txn.entries:
                entries.append({
                    "time": txn.transaction_date.strftime("%H:%M"),
                    "transaction_id": txn.id,
                    "transaction_number": txn.transaction_number,
                    "voucher_type": txn.voucher_type.value if txn.voucher_type else "journal",
                    "account_code": entry.account.code if entry.account else "",
                    "account_name": entry.account.name if entry.account else "",
                    "description": entry.description or txn.description,
                    "debit": entry.debit_amount,
                    "credit": entry.credit_amount,
                })
                total_debit += entry.debit_amount or Decimal("0")
                total_credit += entry.credit_amount or Decimal("0")
        
        return {
            "date": date.date(),
            "entries": entries,
            "totals": {
                "debit": total_debit,
                "credit": total_credit,
            },
            "transaction_count": len(transactions),
        }
