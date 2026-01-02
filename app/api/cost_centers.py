"""Cost Center and Budget API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import (
    User, Company, CostCenter, CostCategory, BudgetMaster, BudgetLine,
    CostCenterAllocationType, BudgetStatus, BudgetPeriod
)
from app.auth.dependencies import get_current_active_user
from app.services.cost_center_service import CostCenterService
from app.services.budget_service import BudgetService

router = APIRouter(prefix="/companies/{company_id}", tags=["Cost Centers & Budgets"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ==================== SCHEMAS ====================

class CostCenterCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    department_id: Optional[str] = None


class CostCenterResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    parent_id: Optional[str]
    level: int
    is_active: bool
    
    class Config:
        from_attributes = True


class CostCategoryCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    allocation_type: str = "amount"


class CostCategoryResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    allocation_type: str
    is_active: bool
    
    class Config:
        from_attributes = True


class BudgetCreate(BaseModel):
    name: str
    financial_year: str
    from_date: datetime
    to_date: datetime
    period_type: str = "monthly"
    description: Optional[str] = None


class BudgetResponse(BaseModel):
    id: str
    name: str
    financial_year: str
    from_date: datetime
    to_date: datetime
    period_type: str
    status: str
    total_budgeted: float
    total_actual: float
    total_variance: float
    
    class Config:
        from_attributes = True


class BudgetLineCreate(BaseModel):
    account_id: str
    budgeted_amount: float
    period_month: Optional[int] = None
    period_quarter: Optional[int] = None
    cost_center_id: Optional[str] = None
    notes: Optional[str] = None


class BudgetLineResponse(BaseModel):
    id: str
    account_id: str
    cost_center_id: Optional[str]
    period_month: Optional[int]
    budgeted_amount: float
    actual_amount: float
    variance_amount: float
    variance_percentage: float
    
    class Config:
        from_attributes = True


# ==================== COST CENTER ENDPOINTS ====================

@router.post("/cost-centers", response_model=CostCenterResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_center(
    company_id: str,
    data: CostCenterCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new cost center."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    
    try:
        cost_center = service.create_cost_center(
            company_id=company.id,
            code=data.code,
            name=data.name,
            description=data.description or "",
            parent_id=data.parent_id,
            department_id=data.department_id,
        )
        return cost_center
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cost-centers", response_model=List[CostCenterResponse])
async def list_cost_centers(
    company_id: str,
    active_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all cost centers."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    cost_centers = service.list_cost_centers(company.id, active_only)
    
    return cost_centers


@router.get("/cost-centers/hierarchy")
async def get_cost_center_hierarchy(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get cost centers in hierarchical structure."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    hierarchy = service.get_cost_center_hierarchy(company.id)
    
    return hierarchy


@router.get("/cost-centers/{cost_center_id}", response_model=CostCenterResponse)
async def get_cost_center(
    company_id: str,
    cost_center_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get cost center by ID."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    cost_center = service.get_cost_center(cost_center_id)
    
    if not cost_center or cost_center.company_id != company.id:
        raise HTTPException(status_code=404, detail="Cost center not found")
    
    return cost_center


@router.put("/cost-centers/{cost_center_id}", response_model=CostCenterResponse)
async def update_cost_center(
    company_id: str,
    cost_center_id: str,
    data: CostCenterCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a cost center."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    
    try:
        cost_center = service.update_cost_center(
            cost_center_id,
            name=data.name,
            description=data.description,
        )
        return cost_center
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/cost-centers/{cost_center_id}")
async def deactivate_cost_center(
    company_id: str,
    cost_center_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Deactivate a cost center."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    service.deactivate_cost_center(cost_center_id)
    
    return {"message": "Cost center deactivated"}


# ==================== COST CATEGORY ENDPOINTS ====================

@router.post("/cost-categories", response_model=CostCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_category(
    company_id: str,
    data: CostCategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new cost category."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    
    try:
        allocation_type = CostCenterAllocationType(data.allocation_type)
        category = service.create_cost_category(
            company_id=company.id,
            code=data.code,
            name=data.name,
            description=data.description or "",
            allocation_type=allocation_type,
        )
        return category
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cost-categories", response_model=List[CostCategoryResponse])
async def list_cost_categories(
    company_id: str,
    active_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all cost categories."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    categories = service.list_cost_categories(company.id, active_only)
    
    return categories


@router.post("/cost-categories/initialize")
async def initialize_cost_categories(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Initialize default cost categories."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = CostCenterService(db)
    created = service.initialize_default_categories(company.id)
    
    return {"message": f"Initialized {len(created)} cost categories"}


# ==================== BUDGET ENDPOINTS ====================

@router.post("/budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    company_id: str,
    data: BudgetCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new budget."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    
    period_type = BudgetPeriod(data.period_type)
    budget = service.create_budget(
        company_id=company.id,
        name=data.name,
        financial_year=data.financial_year,
        from_date=data.from_date,
        to_date=data.to_date,
        period_type=period_type,
        description=data.description or "",
        created_by=current_user.id,
    )
    
    return budget


@router.get("/budgets", response_model=List[BudgetResponse])
async def list_budgets(
    company_id: str,
    financial_year: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all budgets."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    
    budget_status = BudgetStatus(status) if status else None
    budgets = service.list_budgets(company.id, financial_year, budget_status)
    
    return budgets


@router.get("/budgets/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    company_id: str,
    budget_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get budget by ID."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    budget = service.get_budget(budget_id)
    
    if not budget or budget.company_id != company.id:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    return budget


@router.post("/budgets/{budget_id}/approve")
async def approve_budget(
    company_id: str,
    budget_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Approve a budget."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    
    try:
        budget = service.approve_budget(budget_id, current_user.id)
        return {"message": "Budget approved", "status": budget.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/budgets/{budget_id}/activate")
async def activate_budget(
    company_id: str,
    budget_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Activate an approved budget."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    
    try:
        budget = service.activate_budget(budget_id)
        return {"message": "Budget activated", "status": budget.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== BUDGET LINE ENDPOINTS ====================

@router.post("/budgets/{budget_id}/lines", response_model=BudgetLineResponse)
async def add_budget_line(
    company_id: str,
    budget_id: str,
    data: BudgetLineCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a budget line item."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    
    try:
        line = service.add_budget_line(
            budget_id=budget_id,
            account_id=data.account_id,
            budgeted_amount=Decimal(str(data.budgeted_amount)),
            period_month=data.period_month,
            period_quarter=data.period_quarter,
            cost_center_id=data.cost_center_id,
            notes=data.notes or "",
        )
        return line
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/budgets/{budget_id}/lines", response_model=List[BudgetLineResponse])
async def get_budget_lines(
    company_id: str,
    budget_id: str,
    account_id: Optional[str] = None,
    cost_center_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get budget lines for a budget."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    lines = service.get_budget_lines(budget_id, account_id, cost_center_id)
    
    return lines


@router.delete("/budgets/{budget_id}/lines/{line_id}")
async def delete_budget_line(
    company_id: str,
    budget_id: str,
    line_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a budget line."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    
    try:
        service.delete_budget_line(line_id)
        return {"message": "Budget line deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== VARIANCE REPORTS ====================

@router.get("/budgets/{budget_id}/variance")
async def get_variance_report(
    company_id: str,
    budget_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get budget variance report."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    report = service.get_variance_report(budget_id)
    
    return report


@router.get("/budgets/summary/{financial_year}")
async def get_budget_summary(
    company_id: str,
    financial_year: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get budget vs actual summary for a financial year."""
    company = get_company_or_404(company_id, current_user, db)
    
    service = BudgetService(db)
    summary = service.get_budget_vs_actual_summary(company.id, financial_year)
    
    return summary
