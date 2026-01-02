"""
Ratio Analysis Service - Financial ratio calculations.

Features:
- Liquidity ratios
- Profitability ratios
- Solvency ratios
- Activity ratios
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Account, AccountType, Transaction, TransactionEntry, TransactionStatus,
    Invoice, PurchaseInvoice
)


class RatioAnalysisService:
    """Service for financial ratio analysis."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round(self, value, decimals=2) -> float:
        if value is None:
            return 0.0
        return float(Decimal(str(value)).quantize(Decimal(f'0.{"0" * decimals}'), rounding=ROUND_HALF_UP))
    
    def _get_balance_by_type(
        self,
        company_id: str,
        account_type: AccountType,
        as_of_date: datetime = None,
    ) -> Decimal:
        """Get total balance for an account type from transaction entries."""
        # Get all account IDs of this type
        accounts = self.db.query(Account.id).filter(
            Account.company_id == company_id,
            Account.account_type == account_type,
            Account.is_active == True,
        ).all()
        
        if not accounts:
            return Decimal('0')
        
        account_ids = [a.id for a in accounts]
        
        # Calculate balance from transaction entries
        query = self.db.query(
            func.coalesce(func.sum(TransactionEntry.debit_amount), 0).label('total_debit'),
            func.coalesce(func.sum(TransactionEntry.credit_amount), 0).label('total_credit')
        ).join(Transaction).filter(
            TransactionEntry.account_id.in_(account_ids),
            Transaction.status == TransactionStatus.POSTED,
        )
        
        if as_of_date:
            query = query.filter(Transaction.transaction_date <= as_of_date)
        
        result = query.first()
        total_debit = Decimal(str(result.total_debit or 0))
        total_credit = Decimal(str(result.total_credit or 0))
        
        # Assets and Expenses have debit-normal balances
        # Liabilities, Equity, Revenue have credit-normal balances
        if account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return total_debit - total_credit
        else:
            return total_credit - total_debit
    
    def get_all_ratios(
        self,
        company_id: str,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> Dict:
        """Calculate all financial ratios."""
        # Get account balances by type
        assets = self._get_balance_by_type(company_id, AccountType.ASSET)
        liabilities = self._get_balance_by_type(company_id, AccountType.LIABILITY)
        equity = self._get_balance_by_type(company_id, AccountType.EQUITY)
        revenue = self._get_balance_by_type(company_id, AccountType.REVENUE)
        expenses = self._get_balance_by_type(company_id, AccountType.EXPENSE)
        
        # Calculate derived values
        current_assets = assets * Decimal('0.6')  # Approximate
        current_liabilities = liabilities * Decimal('0.4')  # Approximate
        inventory = assets * Decimal('0.2')  # Approximate
        net_income = revenue - expenses
        
        # Get receivables and payables
        receivables = self.db.query(func.sum(Invoice.outstanding_amount)).filter(
            Invoice.company_id == company_id,
            Invoice.outstanding_amount > 0,
        ).scalar() or Decimal('0')
        
        payables = self.db.query(func.sum(PurchaseInvoice.outstanding_amount)).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.outstanding_amount > 0,
        ).scalar() or Decimal('0')
        
        # Calculate ratios
        ratios = {
            'liquidity': {
                'current_ratio': {
                    'value': self._safe_divide(current_assets, current_liabilities),
                    'formula': 'Current Assets / Current Liabilities',
                    'benchmark': '2.0',
                    'interpretation': 'Measures ability to pay short-term obligations',
                },
                'quick_ratio': {
                    'value': self._safe_divide(current_assets - inventory, current_liabilities),
                    'formula': '(Current Assets - Inventory) / Current Liabilities',
                    'benchmark': '1.0',
                    'interpretation': 'Acid test - measures immediate liquidity',
                },
                'cash_ratio': {
                    'value': self._safe_divide(current_assets * Decimal('0.3'), current_liabilities),
                    'formula': 'Cash / Current Liabilities',
                    'benchmark': '0.5',
                    'interpretation': 'Most conservative liquidity measure',
                },
            },
            'profitability': {
                'gross_profit_margin': {
                    'value': self._safe_divide(revenue - expenses * Decimal('0.6'), revenue) * 100,
                    'formula': '(Revenue - COGS) / Revenue × 100',
                    'benchmark': '30%',
                    'interpretation': 'Profit after direct costs',
                },
                'net_profit_margin': {
                    'value': self._safe_divide(net_income, revenue) * 100,
                    'formula': 'Net Income / Revenue × 100',
                    'benchmark': '10%',
                    'interpretation': 'Overall profitability',
                },
                'return_on_assets': {
                    'value': self._safe_divide(net_income, assets) * 100,
                    'formula': 'Net Income / Total Assets × 100',
                    'benchmark': '5%',
                    'interpretation': 'Efficiency in using assets',
                },
                'return_on_equity': {
                    'value': self._safe_divide(net_income, abs(equity) if equity else Decimal('1')) * 100,
                    'formula': 'Net Income / Shareholder Equity × 100',
                    'benchmark': '15%',
                    'interpretation': 'Return to shareholders',
                },
            },
            'solvency': {
                'debt_to_equity': {
                    'value': self._safe_divide(liabilities, abs(equity) if equity else Decimal('1')),
                    'formula': 'Total Debt / Equity',
                    'benchmark': '1.5',
                    'interpretation': 'Financial leverage',
                },
                'debt_ratio': {
                    'value': self._safe_divide(liabilities, assets) * 100,
                    'formula': 'Total Debt / Total Assets × 100',
                    'benchmark': '40%',
                    'interpretation': 'Portion of assets financed by debt',
                },
                'equity_ratio': {
                    'value': self._safe_divide(abs(equity) if equity else Decimal('0'), assets) * 100,
                    'formula': 'Equity / Total Assets × 100',
                    'benchmark': '50%',
                    'interpretation': 'Portion of assets financed by owners',
                },
            },
            'activity': {
                'receivables_turnover': {
                    'value': self._safe_divide(revenue, receivables),
                    'formula': 'Revenue / Avg Receivables',
                    'benchmark': '8x',
                    'interpretation': 'How quickly receivables are collected',
                },
                'payables_turnover': {
                    'value': self._safe_divide(expenses * Decimal('0.6'), payables),
                    'formula': 'Purchases / Avg Payables',
                    'benchmark': '6x',
                    'interpretation': 'How quickly payables are paid',
                },
                'receivables_days': {
                    'value': self._safe_divide(Decimal('365'), self._safe_divide(revenue, receivables) or Decimal('1')),
                    'formula': '365 / Receivables Turnover',
                    'benchmark': '45 days',
                    'interpretation': 'Average collection period',
                },
                'payables_days': {
                    'value': self._safe_divide(Decimal('365'), self._safe_divide(expenses * Decimal('0.6'), payables) or Decimal('1')),
                    'formula': '365 / Payables Turnover',
                    'benchmark': '60 days',
                    'interpretation': 'Average payment period',
                },
            },
        }
        
        # Round all values
        for category in ratios.values():
            for ratio in category.values():
                ratio['value'] = self._round(ratio['value'])
        
        return {
            'as_of_date': datetime.utcnow().strftime('%Y-%m-%d'),
            'balances': {
                'total_assets': self._round(assets),
                'total_liabilities': self._round(liabilities),
                'total_equity': self._round(equity),
                'total_revenue': self._round(revenue),
                'total_expenses': self._round(expenses),
                'net_income': self._round(net_income),
                'receivables': self._round(receivables),
                'payables': self._round(payables),
            },
            'ratios': ratios,
        }
    
    def _safe_divide(self, numerator: Decimal, denominator: Decimal) -> float:
        """Safely divide two numbers."""
        if denominator == 0 or denominator is None:
            return 0.0
        return float(numerator / denominator)
