"""Sales Dashboard service for analytics and reporting."""
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, extract

from app.database.models import (
    SalesTicket, SalesTicketStatus, SalesTicketStage,
    Enquiry, EnquiryStatus, EnquirySource,
    Quotation, QuotationStatus,
    SalesOrder,
    DeliveryChallan, DeliveryChallanStatus,
    Invoice, InvoiceStatus,
    Customer
)
from app.database.payroll_models import Employee


class SalesDashboardService:
    """Service for sales dashboard analytics."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_pipeline_funnel(self, company_id: str) -> Dict[str, Any]:
        """Get pipeline funnel data showing progression through stages."""
        funnel = []
        
        for stage in SalesTicketStage:
            count = self.db.query(func.count(SalesTicket.id)).filter(
                and_(
                    SalesTicket.company_id == company_id,
                    SalesTicket.status == SalesTicketStatus.OPEN,
                    SalesTicket.current_stage == stage
                )
            ).scalar() or 0
            
            value = self.db.query(func.sum(SalesTicket.expected_value)).filter(
                and_(
                    SalesTicket.company_id == company_id,
                    SalesTicket.status == SalesTicketStatus.OPEN,
                    SalesTicket.current_stage == stage
                )
            ).scalar() or Decimal("0")
            
            funnel.append({
                "stage": stage.value,
                "stage_label": stage.value.replace("_", " ").title(),
                "count": count,
                "value": float(value),
            })
        
        return {
            "funnel": funnel,
            "total_count": sum(s["count"] for s in funnel),
            "total_value": sum(s["value"] for s in funnel),
        }
    
    def get_conversion_rates(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Calculate conversion rates between stages."""
        if not from_date:
            from_date = datetime.utcnow().date() - timedelta(days=90)
        if not to_date:
            to_date = datetime.utcnow().date()
        
        # Count tickets that reached each stage
        base_filter = and_(
            SalesTicket.company_id == company_id,
            SalesTicket.created_date >= from_date,
            SalesTicket.created_date <= to_date
        )
        
        total_tickets = self.db.query(func.count(SalesTicket.id)).filter(base_filter).scalar() or 0
        
        # Count by final status
        won = self.db.query(func.count(SalesTicket.id)).filter(
            and_(base_filter, SalesTicket.status == SalesTicketStatus.WON)
        ).scalar() or 0
        
        lost = self.db.query(func.count(SalesTicket.id)).filter(
            and_(base_filter, SalesTicket.status == SalesTicketStatus.LOST)
        ).scalar() or 0
        
        # Count enquiries that converted to quotations
        enquiries_total = self.db.query(func.count(Enquiry.id)).filter(
            and_(
                Enquiry.company_id == company_id,
                Enquiry.enquiry_date >= from_date,
                Enquiry.enquiry_date <= to_date
            )
        ).scalar() or 0
        
        enquiries_converted = self.db.query(func.count(Enquiry.id)).filter(
            and_(
                Enquiry.company_id == company_id,
                Enquiry.enquiry_date >= from_date,
                Enquiry.enquiry_date <= to_date,
                Enquiry.converted_quotation_id.isnot(None)
            )
        ).scalar() or 0
        
        # Count quotations that converted to invoices
        quotations_total = self.db.query(func.count(Quotation.id)).filter(
            and_(
                Quotation.company_id == company_id,
                Quotation.quotation_date >= from_date,
                Quotation.quotation_date <= to_date
            )
        ).scalar() or 0
        
        quotations_converted = self.db.query(func.count(Quotation.id)).filter(
            and_(
                Quotation.company_id == company_id,
                Quotation.quotation_date >= from_date,
                Quotation.quotation_date <= to_date,
                Quotation.status == QuotationStatus.CONVERTED
            )
        ).scalar() or 0
        
        return {
            "period": {
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
            },
            "overall": {
                "total_tickets": total_tickets,
                "won": won,
                "lost": lost,
                "open": total_tickets - won - lost,
                "win_rate": round((won / (won + lost) * 100) if (won + lost) > 0 else 0, 1),
            },
            "enquiry_to_quote": {
                "total": enquiries_total,
                "converted": enquiries_converted,
                "rate": round((enquiries_converted / enquiries_total * 100) if enquiries_total > 0 else 0, 1),
            },
            "quote_to_invoice": {
                "total": quotations_total,
                "converted": quotations_converted,
                "rate": round((quotations_converted / quotations_total * 100) if quotations_total > 0 else 0, 1),
            },
        }
    
    def get_sales_by_person(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """Get sales performance by sales person."""
        if not from_date:
            from_date = datetime.utcnow().date() - timedelta(days=30)
        if not to_date:
            to_date = datetime.utcnow().date()
        
        # Get all sales persons with tickets
        sales_persons = self.db.query(Employee).join(
            SalesTicket, SalesTicket.sales_person_id == Employee.id
        ).filter(
            SalesTicket.company_id == company_id
        ).distinct().all()
        
        results = []
        for person in sales_persons:
            base_filter = and_(
                SalesTicket.company_id == company_id,
                SalesTicket.sales_person_id == person.id,
                SalesTicket.created_date >= from_date,
                SalesTicket.created_date <= to_date
            )
            
            total_tickets = self.db.query(func.count(SalesTicket.id)).filter(base_filter).scalar() or 0
            
            won_tickets = self.db.query(func.count(SalesTicket.id)).filter(
                and_(base_filter, SalesTicket.status == SalesTicketStatus.WON)
            ).scalar() or 0
            
            lost_tickets = self.db.query(func.count(SalesTicket.id)).filter(
                and_(base_filter, SalesTicket.status == SalesTicketStatus.LOST)
            ).scalar() or 0
            
            won_value = self.db.query(func.sum(SalesTicket.actual_value)).filter(
                and_(base_filter, SalesTicket.status == SalesTicketStatus.WON)
            ).scalar() or Decimal("0")
            
            pipeline_value = self.db.query(func.sum(SalesTicket.expected_value)).filter(
                and_(base_filter, SalesTicket.status == SalesTicketStatus.OPEN)
            ).scalar() or Decimal("0")
            
            results.append({
                "sales_person_id": person.id,
                "sales_person_name": f"{person.first_name} {person.last_name}",
                "total_tickets": total_tickets,
                "won": won_tickets,
                "lost": lost_tickets,
                "open": total_tickets - won_tickets - lost_tickets,
                "won_value": float(won_value),
                "pipeline_value": float(pipeline_value),
                "win_rate": round((won_tickets / (won_tickets + lost_tickets) * 100) if (won_tickets + lost_tickets) > 0 else 0, 1),
            })
        
        # Sort by won value
        results.sort(key=lambda x: x["won_value"], reverse=True)
        
        return results
    
    def get_enquiry_sources(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """Get enquiry distribution by source."""
        if not from_date:
            from_date = datetime.utcnow().date() - timedelta(days=90)
        if not to_date:
            to_date = datetime.utcnow().date()
        
        results = []
        for source in EnquirySource:
            count = self.db.query(func.count(Enquiry.id)).filter(
                and_(
                    Enquiry.company_id == company_id,
                    Enquiry.source == source,
                    Enquiry.enquiry_date >= from_date,
                    Enquiry.enquiry_date <= to_date
                )
            ).scalar() or 0
            
            converted = self.db.query(func.count(Enquiry.id)).filter(
                and_(
                    Enquiry.company_id == company_id,
                    Enquiry.source == source,
                    Enquiry.enquiry_date >= from_date,
                    Enquiry.enquiry_date <= to_date,
                    Enquiry.converted_quotation_id.isnot(None)
                )
            ).scalar() or 0
            
            value = self.db.query(func.sum(Enquiry.expected_value)).filter(
                and_(
                    Enquiry.company_id == company_id,
                    Enquiry.source == source,
                    Enquiry.enquiry_date >= from_date,
                    Enquiry.enquiry_date <= to_date
                )
            ).scalar() or Decimal("0")
            
            results.append({
                "source": source.value,
                "source_label": source.value.replace("_", " ").title(),
                "count": count,
                "converted": converted,
                "conversion_rate": round((converted / count * 100) if count > 0 else 0, 1),
                "expected_value": float(value),
            })
        
        # Sort by count
        results.sort(key=lambda x: x["count"], reverse=True)
        
        return results
    
    def get_monthly_trend(
        self,
        company_id: str,
        months: int = 12,
    ) -> List[Dict[str, Any]]:
        """Get monthly trend of enquiries, quotations, and invoices."""
        results = []
        today = datetime.utcnow().date()
        
        for i in range(months - 1, -1, -1):
            # Calculate month start and end
            month_date = today - timedelta(days=i * 30)
            month_start = date(month_date.year, month_date.month, 1)
            if month_date.month == 12:
                month_end = date(month_date.year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(month_date.year, month_date.month + 1, 1) - timedelta(days=1)
            
            enquiries = self.db.query(func.count(Enquiry.id)).filter(
                and_(
                    Enquiry.company_id == company_id,
                    func.date(Enquiry.enquiry_date) >= month_start,
                    func.date(Enquiry.enquiry_date) <= month_end
                )
            ).scalar() or 0
            
            quotations = self.db.query(func.count(Quotation.id)).filter(
                and_(
                    Quotation.company_id == company_id,
                    func.date(Quotation.quotation_date) >= month_start,
                    func.date(Quotation.quotation_date) <= month_end
                )
            ).scalar() or 0
            
            invoices = self.db.query(func.count(Invoice.id)).filter(
                and_(
                    Invoice.company_id == company_id,
                    func.date(Invoice.invoice_date) >= month_start,
                    func.date(Invoice.invoice_date) <= month_end
                )
            ).scalar() or 0
            
            won_value = self.db.query(func.sum(SalesTicket.actual_value)).filter(
                and_(
                    SalesTicket.company_id == company_id,
                    SalesTicket.status == SalesTicketStatus.WON,
                    func.date(SalesTicket.actual_close_date) >= month_start,
                    func.date(SalesTicket.actual_close_date) <= month_end
                )
            ).scalar() or Decimal("0")
            
            results.append({
                "month": month_start.strftime("%Y-%m"),
                "month_label": month_start.strftime("%b %Y"),
                "enquiries": enquiries,
                "quotations": quotations,
                "invoices": invoices,
                "won_value": float(won_value),
            })
        
        return results
    
    def get_average_deal_cycle(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Calculate average time to close deals."""
        if not from_date:
            from_date = datetime.utcnow().date() - timedelta(days=365)
        if not to_date:
            to_date = datetime.utcnow().date()
        
        # Get won tickets with close dates
        won_tickets = self.db.query(SalesTicket).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.WON,
                SalesTicket.actual_close_date >= from_date,
                SalesTicket.actual_close_date <= to_date,
                SalesTicket.created_date.isnot(None),
                SalesTicket.actual_close_date.isnot(None)
            )
        ).all()
        
        if not won_tickets:
            return {
                "average_days": 0,
                "min_days": 0,
                "max_days": 0,
                "sample_size": 0,
            }
        
        days_list = []
        for ticket in won_tickets:
            days = (ticket.actual_close_date - ticket.created_date).days
            if days >= 0:
                days_list.append(days)
        
        if not days_list:
            return {
                "average_days": 0,
                "min_days": 0,
                "max_days": 0,
                "sample_size": 0,
            }
        
        return {
            "average_days": round(sum(days_list) / len(days_list), 1),
            "min_days": min(days_list),
            "max_days": max(days_list),
            "sample_size": len(days_list),
        }
    
    def get_top_customers(
        self,
        company_id: str,
        limit: int = 10,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """Get top customers by won deal value."""
        if not from_date:
            from_date = datetime.utcnow().date() - timedelta(days=365)
        if not to_date:
            to_date = datetime.utcnow().date()
        
        results = self.db.query(
            Customer.id,
            Customer.name,
            func.count(SalesTicket.id).label("total_deals"),
            func.sum(SalesTicket.actual_value).label("total_value")
        ).join(
            SalesTicket, SalesTicket.customer_id == Customer.id
        ).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.WON,
                SalesTicket.actual_close_date >= from_date,
                SalesTicket.actual_close_date <= to_date
            )
        ).group_by(
            Customer.id, Customer.name
        ).order_by(
            func.sum(SalesTicket.actual_value).desc()
        ).limit(limit).all()
        
        return [
            {
                "customer_id": r[0],
                "customer_name": r[1],
                "total_deals": r[2],
                "total_value": float(r[3] or 0),
            }
            for r in results
        ]
    
    def get_dashboard_summary(self, company_id: str) -> Dict[str, Any]:
        """Get complete dashboard summary."""
        today = datetime.utcnow().date()
        this_month_start = date(today.year, today.month, 1)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
        last_month_end = this_month_start - timedelta(days=1)
        
        # Current month stats
        this_month_enquiries = self.db.query(func.count(Enquiry.id)).filter(
            and_(
                Enquiry.company_id == company_id,
                func.date(Enquiry.enquiry_date) >= this_month_start
            )
        ).scalar() or 0
        
        this_month_won = self.db.query(func.sum(SalesTicket.actual_value)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.WON,
                func.date(SalesTicket.actual_close_date) >= this_month_start
            )
        ).scalar() or Decimal("0")
        
        # Last month for comparison
        last_month_enquiries = self.db.query(func.count(Enquiry.id)).filter(
            and_(
                Enquiry.company_id == company_id,
                func.date(Enquiry.enquiry_date) >= last_month_start,
                func.date(Enquiry.enquiry_date) <= last_month_end
            )
        ).scalar() or 0
        
        last_month_won = self.db.query(func.sum(SalesTicket.actual_value)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.WON,
                func.date(SalesTicket.actual_close_date) >= last_month_start,
                func.date(SalesTicket.actual_close_date) <= last_month_end
            )
        ).scalar() or Decimal("0")
        
        # Total pipeline
        pipeline_value = self.db.query(func.sum(SalesTicket.expected_value)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.OPEN
            )
        ).scalar() or Decimal("0")
        
        pipeline_count = self.db.query(func.count(SalesTicket.id)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.OPEN
            )
        ).scalar() or 0
        
        # Pending follow-ups
        pending_followups = self.db.query(func.count(Enquiry.id)).filter(
            and_(
                Enquiry.company_id == company_id,
                Enquiry.follow_up_date <= today + timedelta(days=7),
                Enquiry.follow_up_date >= today,
                Enquiry.status.not_in([EnquiryStatus.WON, EnquiryStatus.LOST])
            )
        ).scalar() or 0
        
        return {
            "this_month": {
                "enquiries": this_month_enquiries,
                "won_value": float(this_month_won),
                "enquiries_change": round(((this_month_enquiries - last_month_enquiries) / last_month_enquiries * 100) if last_month_enquiries > 0 else 0, 1),
                "won_change": round(((float(this_month_won) - float(last_month_won)) / float(last_month_won) * 100) if last_month_won > 0 else 0, 1),
            },
            "pipeline": {
                "count": pipeline_count,
                "value": float(pipeline_value),
            },
            "pending_followups": pending_followups,
            "funnel": self.get_pipeline_funnel(company_id),
            "conversion_rates": self.get_conversion_rates(company_id),
            "deal_cycle": self.get_average_deal_cycle(company_id),
        }

