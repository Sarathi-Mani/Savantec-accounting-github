"""Business Dashboard API - Comprehensive overview of sales, purchases, GST, and TDS."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from pydantic import BaseModel

from app.database.connection import get_db
from app.database.models import (
    User, Company, Invoice, InvoiceStatus, PurchaseInvoice, PurchaseInvoiceStatus,
    PurchaseOrder, SalesOrder, OrderStatus, Payment, PurchasePayment,
    TDSEntry, Transaction, TransactionEntry, Account, AccountType
)
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/business", tags=["Business Dashboard"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def get_period_dates(period: str = "month") -> tuple:
    """Get start and end dates for a period."""
    today = date.today()
    
    if period == "month":
        start_date = today.replace(day=1)
        end_date = (start_date + relativedelta(months=1)) - timedelta(days=1)
    elif period == "quarter":
        quarter = (today.month - 1) // 3
        start_date = date(today.year, quarter * 3 + 1, 1)
        end_date = (start_date + relativedelta(months=3)) - timedelta(days=1)
    elif period == "year":
        # Indian Financial Year (April to March)
        if today.month >= 4:
            start_date = date(today.year, 4, 1)
            end_date = date(today.year + 1, 3, 31)
        else:
            start_date = date(today.year - 1, 4, 1)
            end_date = date(today.year, 3, 31)
    else:
        start_date = today.replace(day=1)
        end_date = today
    
    return start_date, end_date


# ============== Response Models ==============

class BusinessSummary(BaseModel):
    total_sales: float
    total_purchases: float
    net_position: float
    period: dict


class GSTSummaryResponse(BaseModel):
    output_gst: float
    input_gst: float
    net_payable: float
    cgst_output: float
    sgst_output: float
    igst_output: float
    cgst_input: float
    sgst_input: float
    igst_input: float
    due_date: Optional[str]
    period: dict


class TDSSummaryResponse(BaseModel):
    total_deducted: float
    total_deposited: float
    pending_deposit: float
    due_date: Optional[str]
    entries_count: int
    period: dict


class ITCSummaryResponse(BaseModel):
    available: float
    utilized: float
    lapsed: float
    expiring_soon: float
    period: dict


class RecentActivity(BaseModel):
    type: str
    reference: str
    amount: float
    party: Optional[str]
    date: str
    status: Optional[str]


class RecentActivityResponse(BaseModel):
    activities: List[RecentActivity]


# ============== Endpoints ==============

@router.get("/summary", response_model=BusinessSummary)
async def get_business_summary(
    company_id: str,
    period: str = Query("month", pattern="^(month|quarter|year)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get overall business summary - sales, purchases, and net position."""
    company = get_company_or_404(company_id, current_user, db)
    start_date, end_date = get_period_dates(period)
    
    # Total Sales (from invoices)
    sales_result = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.company_id == company.id,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date <= end_date,
        Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.VOID])
    ).scalar() or Decimal("0")
    
    # Total Purchases (from purchase invoices)
    purchases_result = db.query(func.sum(PurchaseInvoice.total_amount)).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.invoice_date >= start_date,
        PurchaseInvoice.invoice_date <= end_date,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.DRAFT, PurchaseInvoiceStatus.CANCELLED])
    ).scalar() or Decimal("0")
    
    return BusinessSummary(
        total_sales=float(sales_result),
        total_purchases=float(purchases_result),
        net_position=float(sales_result - purchases_result),
        period={"from": start_date.isoformat(), "to": end_date.isoformat(), "type": period}
    )


@router.get("/gst-summary", response_model=GSTSummaryResponse)
async def get_gst_summary(
    company_id: str,
    period: str = Query("month", pattern="^(month|quarter|year)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get GST summary - output, input, and net payable."""
    company = get_company_or_404(company_id, current_user, db)
    start_date, end_date = get_period_dates(period)
    
    # Output GST (from sales invoices)
    output_gst = db.query(
        func.coalesce(func.sum(Invoice.cgst_amount), 0).label('cgst'),
        func.coalesce(func.sum(Invoice.sgst_amount), 0).label('sgst'),
        func.coalesce(func.sum(Invoice.igst_amount), 0).label('igst'),
    ).filter(
        Invoice.company_id == company.id,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date <= end_date,
        Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.VOID])
    ).first()
    
    # Input GST (from purchase invoices)
    input_gst = db.query(
        func.coalesce(func.sum(PurchaseInvoice.cgst_amount), 0).label('cgst'),
        func.coalesce(func.sum(PurchaseInvoice.sgst_amount), 0).label('sgst'),
        func.coalesce(func.sum(PurchaseInvoice.igst_amount), 0).label('igst'),
    ).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.invoice_date >= start_date,
        PurchaseInvoice.invoice_date <= end_date,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.DRAFT, PurchaseInvoiceStatus.CANCELLED]),
        PurchaseInvoice.itc_eligible == True
    ).first()
    
    cgst_out = float(output_gst.cgst or 0)
    sgst_out = float(output_gst.sgst or 0)
    igst_out = float(output_gst.igst or 0)
    cgst_in = float(input_gst.cgst or 0)
    sgst_in = float(input_gst.sgst or 0)
    igst_in = float(input_gst.igst or 0)
    
    total_output = cgst_out + sgst_out + igst_out
    total_input = cgst_in + sgst_in + igst_in
    
    # Calculate GST due date (20th of next month)
    next_month = (end_date.replace(day=1) + relativedelta(months=1))
    due_date = next_month.replace(day=20)
    
    return GSTSummaryResponse(
        output_gst=total_output,
        input_gst=total_input,
        net_payable=max(0, total_output - total_input),
        cgst_output=cgst_out,
        sgst_output=sgst_out,
        igst_output=igst_out,
        cgst_input=cgst_in,
        sgst_input=sgst_in,
        igst_input=igst_in,
        due_date=due_date.isoformat(),
        period={"from": start_date.isoformat(), "to": end_date.isoformat(), "type": period}
    )


@router.get("/tds-summary", response_model=TDSSummaryResponse)
async def get_tds_summary(
    company_id: str,
    period: str = Query("month", pattern="^(month|quarter|year)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get TDS summary - deducted, deposited, and pending."""
    company = get_company_or_404(company_id, current_user, db)
    start_date, end_date = get_period_dates(period)
    
    # Total TDS deducted
    tds_deducted = db.query(func.sum(TDSEntry.tds_amount)).filter(
        TDSEntry.company_id == company.id,
        TDSEntry.deduction_date >= start_date,
        TDSEntry.deduction_date <= end_date,
    ).scalar() or Decimal("0")
    
    # Total TDS deposited
    tds_deposited = db.query(func.sum(TDSEntry.tds_amount)).filter(
        TDSEntry.company_id == company.id,
        TDSEntry.deduction_date >= start_date,
        TDSEntry.deduction_date <= end_date,
        TDSEntry.is_deposited == True
    ).scalar() or Decimal("0")
    
    # Count of entries
    entries_count = db.query(TDSEntry).filter(
        TDSEntry.company_id == company.id,
        TDSEntry.deduction_date >= start_date,
        TDSEntry.deduction_date <= end_date,
    ).count()
    
    # TDS due date (7th of next month)
    next_month = (end_date.replace(day=1) + relativedelta(months=1))
    due_date = next_month.replace(day=7)
    
    return TDSSummaryResponse(
        total_deducted=float(tds_deducted),
        total_deposited=float(tds_deposited),
        pending_deposit=float(tds_deducted - tds_deposited),
        due_date=due_date.isoformat(),
        entries_count=entries_count,
        period={"from": start_date.isoformat(), "to": end_date.isoformat(), "type": period}
    )


@router.get("/itc-summary", response_model=ITCSummaryResponse)
async def get_itc_summary(
    company_id: str,
    period: str = Query("month", pattern="^(month|quarter|year)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get Input Tax Credit summary - available, utilized, lapsed, expiring."""
    company = get_company_or_404(company_id, current_user, db)
    start_date, end_date = get_period_dates(period)
    
    # Available ITC (from eligible purchase invoices not yet claimed)
    available = db.query(
        func.coalesce(func.sum(
            PurchaseInvoice.cgst_amount + 
            PurchaseInvoice.sgst_amount + 
            PurchaseInvoice.igst_amount
        ), 0)
    ).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.invoice_date >= start_date,
        PurchaseInvoice.invoice_date <= end_date,
        PurchaseInvoice.itc_eligible == True,
        PurchaseInvoice.itc_claimed == False,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.DRAFT, PurchaseInvoiceStatus.CANCELLED])
    ).scalar() or Decimal("0")
    
    # Utilized ITC (claimed)
    utilized = db.query(
        func.coalesce(func.sum(
            PurchaseInvoice.cgst_amount + 
            PurchaseInvoice.sgst_amount + 
            PurchaseInvoice.igst_amount
        ), 0)
    ).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.invoice_date >= start_date,
        PurchaseInvoice.invoice_date <= end_date,
        PurchaseInvoice.itc_eligible == True,
        PurchaseInvoice.itc_claimed == True,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.DRAFT, PurchaseInvoiceStatus.CANCELLED])
    ).scalar() or Decimal("0")
    
    # ITC expiring soon (invoices older than 10 months where ITC not claimed)
    # ITC must be claimed by the due date of September return of following FY
    expiring_cutoff = date.today() - relativedelta(months=10)
    expiring = db.query(
        func.coalesce(func.sum(
            PurchaseInvoice.cgst_amount + 
            PurchaseInvoice.sgst_amount + 
            PurchaseInvoice.igst_amount
        ), 0)
    ).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.invoice_date <= expiring_cutoff,
        PurchaseInvoice.itc_eligible == True,
        PurchaseInvoice.itc_claimed == False,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.DRAFT, PurchaseInvoiceStatus.CANCELLED])
    ).scalar() or Decimal("0")
    
    return ITCSummaryResponse(
        available=float(available),
        utilized=float(utilized),
        lapsed=0.0,  # Would need historical tracking
        expiring_soon=float(expiring),
        period={"from": start_date.isoformat(), "to": end_date.isoformat(), "type": period}
    )


@router.get("/recent-activity", response_model=RecentActivityResponse)
async def get_recent_activity(
    company_id: str,
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get recent business activity - invoices, orders, payments."""
    company = get_company_or_404(company_id, current_user, db)
    activities = []
    
    # Recent Sales Invoices
    invoices = db.query(Invoice).filter(
        Invoice.company_id == company.id,
    ).order_by(Invoice.created_at.desc()).limit(limit // 3 + 1).all()
    
    for inv in invoices:
        customer_name = None
        if inv.customer:
            customer_name = inv.customer.name
        activities.append(RecentActivity(
            type="invoice",
            reference=inv.invoice_number,
            amount=float(inv.total_amount),
            party=customer_name,
            date=inv.invoice_date.isoformat() if inv.invoice_date else inv.created_at.isoformat(),
            status=inv.status.value if inv.status else None
        ))
    
    # Recent Purchase Orders
    pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.company_id == company.id,
    ).order_by(PurchaseOrder.created_at.desc()).limit(limit // 3 + 1).all()
    
    for po in pos:
        vendor_name = None
        if po.vendor:
            vendor_name = po.vendor.name
        activities.append(RecentActivity(
            type="purchase_order",
            reference=po.order_number,
            amount=float(po.total_amount),
            party=vendor_name,
            date=po.order_date.isoformat() if po.order_date else po.created_at.isoformat(),
            status=po.status.value if po.status else None
        ))
    
    # Recent Payments
    payments = db.query(Payment).join(Invoice).filter(
        Invoice.company_id == company.id,
    ).order_by(Payment.created_at.desc()).limit(limit // 3 + 1).all()
    
    for pmt in payments:
        activities.append(RecentActivity(
            type="payment_received",
            reference=f"Payment - {pmt.invoice.invoice_number}" if pmt.invoice else f"Payment {pmt.id[:8]}",
            amount=float(pmt.amount),
            party=pmt.invoice.customer.name if pmt.invoice and pmt.invoice.customer else None,
            date=pmt.payment_date.isoformat() if pmt.payment_date else pmt.created_at.isoformat(),
            status="verified" if pmt.is_verified else "pending"
        ))
    
    # Sort by date and limit
    activities.sort(key=lambda x: x.date, reverse=True)
    activities = activities[:limit]
    
    return RecentActivityResponse(activities=activities)


@router.get("/outstanding")
async def get_outstanding_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get outstanding receivables and payables summary."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Outstanding Receivables (unpaid invoices)
    receivables = db.query(func.sum(Invoice.balance_due)).filter(
        Invoice.company_id == company.id,
        Invoice.balance_due > 0,
        Invoice.status.notin_([InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT])
    ).scalar() or Decimal("0")
    
    receivables_count = db.query(Invoice).filter(
        Invoice.company_id == company.id,
        Invoice.balance_due > 0,
        Invoice.status.notin_([InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT])
    ).count()
    
    # Outstanding Payables (unpaid purchase invoices)
    payables = db.query(func.sum(PurchaseInvoice.balance_due)).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.balance_due > 0,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.CANCELLED, PurchaseInvoiceStatus.DRAFT])
    ).scalar() or Decimal("0")
    
    payables_count = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.balance_due > 0,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.CANCELLED, PurchaseInvoiceStatus.DRAFT])
    ).count()
    
    # Overdue amounts
    today = date.today()
    overdue_receivables = db.query(func.sum(Invoice.balance_due)).filter(
        Invoice.company_id == company.id,
        Invoice.balance_due > 0,
        Invoice.due_date < today,
        Invoice.status.notin_([InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT])
    ).scalar() or Decimal("0")
    
    overdue_payables = db.query(func.sum(PurchaseInvoice.balance_due)).filter(
        PurchaseInvoice.company_id == company.id,
        PurchaseInvoice.balance_due > 0,
        PurchaseInvoice.due_date < today,
        PurchaseInvoice.status.notin_([PurchaseInvoiceStatus.CANCELLED, PurchaseInvoiceStatus.DRAFT])
    ).scalar() or Decimal("0")
    
    return {
        "receivables": {
            "total": float(receivables),
            "count": receivables_count,
            "overdue": float(overdue_receivables)
        },
        "payables": {
            "total": float(payables),
            "count": payables_count,
            "overdue": float(overdue_payables)
        },
        "net_position": float(receivables - payables)
    }
