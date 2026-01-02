"""
Budget Service - Manage budgets and track variance.

Features:
- Create budgets by financial year
- Budget lines by account and cost center
- Monthly/quarterly/annual period tracking
- Budget vs actual variance reporting
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database.models import (
    BudgetMaster, BudgetLine, BudgetStatus, BudgetPeriod,
    Account, CostCenter, Transaction, TransactionEntry
)


class BudgetService:
    """Service for managing budgets and variance tracking."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ==================== BUDGET MANAGEMENT ====================
    
    def create_budget(
        self,
        company_id: str,
        name: str,
        financial_year: str,
        from_date: datetime,
        to_date: datetime,
        period_type: BudgetPeriod = BudgetPeriod.MONTHLY,
        description: str = "",
        created_by: Optional[str] = None,
    ) -> BudgetMaster:
        """Create a new budget."""
        budget = BudgetMaster(
            company_id=company_id,
            name=name,
            financial_year=financial_year,
            from_date=from_date,
            to_date=to_date,
            period_type=period_type,
            description=description,
            status=BudgetStatus.DRAFT,
            created_by=created_by,
        )
        
        self.db.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        
        return budget
    
    def get_budget(self, budget_id: str) -> Optional[BudgetMaster]:
        """Get budget by ID."""
        return self.db.query(BudgetMaster).filter(BudgetMaster.id == budget_id).first()
    
    def list_budgets(
        self,
        company_id: str,
        financial_year: Optional[str] = None,
        status: Optional[BudgetStatus] = None,
    ) -> List[BudgetMaster]:
        """List budgets for a company."""
        query = self.db.query(BudgetMaster).filter(BudgetMaster.company_id == company_id)
        
        if financial_year:
            query = query.filter(BudgetMaster.financial_year == financial_year)
        
        if status:
            query = query.filter(BudgetMaster.status == status)
        
        return query.order_by(BudgetMaster.from_date.desc()).all()
    
    def approve_budget(
        self,
        budget_id: str,
        approved_by: str,
    ) -> BudgetMaster:
        """Approve a budget."""
        budget = self.get_budget(budget_id)
        if not budget:
            raise ValueError("Budget not found")
        
        if budget.status != BudgetStatus.DRAFT:
            raise ValueError(f"Cannot approve budget in status: {budget.status}")
        
        budget.status = BudgetStatus.APPROVED
        budget.approved_by = approved_by
        budget.approved_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(budget)
        
        return budget
    
    def activate_budget(self, budget_id: str) -> BudgetMaster:
        """Activate an approved budget."""
        budget = self.get_budget(budget_id)
        if not budget:
            raise ValueError("Budget not found")
        
        if budget.status != BudgetStatus.APPROVED:
            raise ValueError("Budget must be approved before activation")
        
        budget.status = BudgetStatus.ACTIVE
        self.db.commit()
        self.db.refresh(budget)
        
        return budget
    
    def close_budget(self, budget_id: str) -> BudgetMaster:
        """Close a budget."""
        budget = self.get_budget(budget_id)
        if not budget:
            raise ValueError("Budget not found")
        
        budget.status = BudgetStatus.CLOSED
        self.db.commit()
        self.db.refresh(budget)
        
        return budget
    
    # ==================== BUDGET LINE MANAGEMENT ====================
    
    def add_budget_line(
        self,
        budget_id: str,
        account_id: str,
        budgeted_amount: Decimal,
        period_month: Optional[int] = None,
        period_quarter: Optional[int] = None,
        cost_center_id: Optional[str] = None,
        notes: str = "",
    ) -> BudgetLine:
        """Add a budget line item."""
        budget = self.get_budget(budget_id)
        if not budget:
            raise ValueError("Budget not found")
        
        if budget.status not in [BudgetStatus.DRAFT, BudgetStatus.APPROVED]:
            raise ValueError("Cannot modify budget lines after activation")
        
        line = BudgetLine(
            budget_id=budget_id,
            account_id=account_id,
            cost_center_id=cost_center_id,
            period_month=period_month,
            period_quarter=period_quarter,
            budgeted_amount=budgeted_amount,
            notes=notes,
        )
        
        self.db.add(line)
        
        # Update budget total
        budget.total_budgeted = (budget.total_budgeted or Decimal("0")) + budgeted_amount
        
        self.db.commit()
        self.db.refresh(line)
        
        return line
    
    def update_budget_line(
        self,
        line_id: str,
        budgeted_amount: Decimal,
        notes: Optional[str] = None,
    ) -> BudgetLine:
        """Update a budget line."""
        line = self.db.query(BudgetLine).filter(BudgetLine.id == line_id).first()
        if not line:
            raise ValueError("Budget line not found")
        
        # Update budget total
        budget = line.budget
        old_amount = line.budgeted_amount or Decimal("0")
        budget.total_budgeted = (budget.total_budgeted or Decimal("0")) - old_amount + budgeted_amount
        
        line.budgeted_amount = budgeted_amount
        if notes is not None:
            line.notes = notes
        
        self.db.commit()
        self.db.refresh(line)
        
        return line
    
    def delete_budget_line(self, line_id: str):
        """Delete a budget line."""
        line = self.db.query(BudgetLine).filter(BudgetLine.id == line_id).first()
        if not line:
            raise ValueError("Budget line not found")
        
        # Update budget total
        budget = line.budget
        budget.total_budgeted = (budget.total_budgeted or Decimal("0")) - (line.budgeted_amount or Decimal("0"))
        
        self.db.delete(line)
        self.db.commit()
    
    def get_budget_lines(
        self,
        budget_id: str,
        account_id: Optional[str] = None,
        cost_center_id: Optional[str] = None,
    ) -> List[BudgetLine]:
        """Get budget lines for a budget."""
        query = self.db.query(BudgetLine).filter(BudgetLine.budget_id == budget_id)
        
        if account_id:
            query = query.filter(BudgetLine.account_id == account_id)
        
        if cost_center_id:
            query = query.filter(BudgetLine.cost_center_id == cost_center_id)
        
        return query.all()
    
    # ==================== VARIANCE CALCULATION ====================
    
    def calculate_actuals(self, budget_id: str):
        """
        Calculate actual amounts from transactions for all budget lines.
        Updates actual_amount, variance_amount, and variance_percentage.
        """
        budget = self.get_budget(budget_id)
        if not budget:
            raise ValueError("Budget not found")
        
        lines = self.get_budget_lines(budget_id)
        total_actual = Decimal("0")
        total_variance = Decimal("0")
        
        for line in lines:
            # Get actual transactions for this account in the budget period
            actual = self._get_actual_for_line(
                line.account_id,
                budget.from_date,
                budget.to_date,
                line.period_month,
                line.cost_center_id,
            )
            
            line.actual_amount = actual
            line.variance_amount = (line.budgeted_amount or Decimal("0")) - actual
            
            if line.budgeted_amount and line.budgeted_amount != 0:
                line.variance_percentage = self._round_amount(
                    line.variance_amount / line.budgeted_amount * 100
                )
            else:
                line.variance_percentage = Decimal("0")
            
            total_actual += actual
            total_variance += line.variance_amount
        
        budget.total_actual = total_actual
        budget.total_variance = total_variance
        
        self.db.commit()
    
    def _get_actual_for_line(
        self,
        account_id: str,
        from_date: datetime,
        to_date: datetime,
        period_month: Optional[int],
        cost_center_id: Optional[str],
    ) -> Decimal:
        """Get actual transaction amount for a budget line."""
        # Note: This requires TransactionEntry to have cost_center_id field
        # For now, we'll query transactions without cost center filter
        
        # Build date filter for specific month if provided
        if period_month:
            year = from_date.year
            month_start = datetime(year, period_month, 1)
            if period_month == 12:
                month_end = datetime(year + 1, 1, 1)
            else:
                month_end = datetime(year, period_month + 1, 1)
            from_date = month_start
            to_date = month_end
        
        # Query transaction entries for the account
        result = self.db.query(func.sum(TransactionEntry.debit_amount - TransactionEntry.credit_amount)).join(
            Transaction
        ).filter(
            TransactionEntry.account_id == account_id,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date < to_date,
        ).scalar()
        
        return abs(result) if result else Decimal("0")
    
    # ==================== VARIANCE REPORTING ====================
    
    def get_variance_report(
        self,
        budget_id: str,
        group_by: str = "account",  # account, cost_center, month
    ) -> Dict:
        """Get budget variance report."""
        budget = self.get_budget(budget_id)
        if not budget:
            return {"error": "Budget not found"}
        
        # Calculate latest actuals
        self.calculate_actuals(budget_id)
        
        lines = self.get_budget_lines(budget_id)
        
        report = {
            "budget": {
                "id": budget.id,
                "name": budget.name,
                "financial_year": budget.financial_year,
                "status": budget.status.value,
                "from_date": budget.from_date.isoformat(),
                "to_date": budget.to_date.isoformat(),
            },
            "summary": {
                "total_budgeted": float(budget.total_budgeted or 0),
                "total_actual": float(budget.total_actual or 0),
                "total_variance": float(budget.total_variance or 0),
                "variance_percentage": float(
                    (budget.total_variance / budget.total_budgeted * 100)
                    if budget.total_budgeted else 0
                ),
            },
            "lines": [],
        }
        
        for line in lines:
            report["lines"].append({
                "id": line.id,
                "account_id": line.account_id,
                "cost_center_id": line.cost_center_id,
                "period_month": line.period_month,
                "budgeted": float(line.budgeted_amount or 0),
                "actual": float(line.actual_amount or 0),
                "variance": float(line.variance_amount or 0),
                "variance_pct": float(line.variance_percentage or 0),
                "status": "under" if (line.variance_amount or 0) > 0 else "over",
            })
        
        return report
    
    def get_budget_vs_actual_summary(
        self,
        company_id: str,
        financial_year: str,
    ) -> Dict:
        """Get summary of all budgets for a financial year."""
        budgets = self.list_budgets(company_id, financial_year=financial_year)
        
        summary = {
            "financial_year": financial_year,
            "budgets": [],
            "totals": {
                "total_budgeted": 0,
                "total_actual": 0,
                "total_variance": 0,
            },
        }
        
        for budget in budgets:
            # Refresh actuals
            self.calculate_actuals(budget.id)
            
            summary["budgets"].append({
                "id": budget.id,
                "name": budget.name,
                "status": budget.status.value,
                "budgeted": float(budget.total_budgeted or 0),
                "actual": float(budget.total_actual or 0),
                "variance": float(budget.total_variance or 0),
                "utilization_pct": float(
                    (budget.total_actual / budget.total_budgeted * 100)
                    if budget.total_budgeted else 0
                ),
            })
            
            summary["totals"]["total_budgeted"] += float(budget.total_budgeted or 0)
            summary["totals"]["total_actual"] += float(budget.total_actual or 0)
            summary["totals"]["total_variance"] += float(budget.total_variance or 0)
        
        return summary
