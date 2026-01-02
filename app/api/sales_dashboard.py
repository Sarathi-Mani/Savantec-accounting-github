"""API endpoints for sales dashboard analytics."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from app.database.connection import get_db
from app.database.models import Company
from app.services.sales_dashboard_service import SalesDashboardService

router = APIRouter(prefix="/api/companies/{company_id}/sales-dashboard", tags=["sales-dashboard"])


def get_company(db: Session, company_id: str) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("/summary")
def get_dashboard_summary(
    company_id: str,
    db: Session = Depends(get_db),
):
    """Get complete dashboard summary."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_dashboard_summary(company_id)


@router.get("/pipeline-funnel")
def get_pipeline_funnel(
    company_id: str,
    db: Session = Depends(get_db),
):
    """Get pipeline funnel data."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_pipeline_funnel(company_id)


@router.get("/conversion-rates")
def get_conversion_rates(
    company_id: str,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Get conversion rates between stages."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_conversion_rates(
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
    )


@router.get("/sales-by-person")
def get_sales_by_person(
    company_id: str,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Get sales performance by sales person."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_sales_by_person(
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
    )


@router.get("/enquiry-sources")
def get_enquiry_sources(
    company_id: str,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Get enquiry distribution by source."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_enquiry_sources(
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
    )


@router.get("/monthly-trend")
def get_monthly_trend(
    company_id: str,
    months: int = Query(12, ge=1, le=24),
    db: Session = Depends(get_db),
):
    """Get monthly trend of enquiries, quotations, and invoices."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_monthly_trend(
        company_id=company_id,
        months=months,
    )


@router.get("/deal-cycle")
def get_deal_cycle(
    company_id: str,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Get average deal cycle time."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_average_deal_cycle(
        company_id=company_id,
        from_date=from_date,
        to_date=to_date,
    )


@router.get("/top-customers")
def get_top_customers(
    company_id: str,
    limit: int = Query(10, ge=1, le=50),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Get top customers by won deal value."""
    get_company(db, company_id)
    
    service = SalesDashboardService(db)
    return service.get_top_customers(
        company_id=company_id,
        limit=limit,
        from_date=from_date,
        to_date=to_date,
    )

