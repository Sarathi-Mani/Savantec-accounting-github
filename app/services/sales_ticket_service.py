"""Sales Ticket service for managing sales pipeline tickets."""
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.database.models import (
    SalesTicket, SalesTicketStatus, SalesTicketStage,
    SalesTicketLog, SalesTicketLogAction,
    Enquiry, EnquiryStatus,
    Quotation, QuotationStatus,
    SalesOrder,
    DeliveryChallan, DeliveryChallanStatus,
    Invoice, InvoiceStatus,
    Customer, Contact
)
from app.database.payroll_models import Employee


class SalesTicketService:
    """Service for managing sales tickets."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_ticket_number(self, company_id: str) -> str:
        """Generate a unique sales ticket number."""
        today = datetime.utcnow()
        prefix = f"TKT-{today.strftime('%Y%m')}-"
        
        last_ticket = self.db.query(SalesTicket).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.ticket_number.like(f"{prefix}%")
            )
        ).order_by(SalesTicket.ticket_number.desc()).first()
        
        if last_ticket:
            last_num = int(last_ticket.ticket_number.split("-")[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        
        return f"{prefix}{new_num:04d}"
    
    def create_ticket(
        self,
        company_id: str,
        customer_id: Optional[str] = None,
        contact_id: Optional[str] = None,
        sales_person_id: Optional[str] = None,
        expected_value: Decimal = Decimal("0"),
        expected_close_date: Optional[datetime] = None,
        notes: Optional[str] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> SalesTicket:
        """Create a new sales ticket."""
        ticket = SalesTicket(
            company_id=company_id,
            ticket_number=self._generate_ticket_number(company_id),
            customer_id=customer_id,
            contact_id=contact_id,
            sales_person_id=sales_person_id,
            status=SalesTicketStatus.OPEN,
            current_stage=SalesTicketStage.ENQUIRY,
            expected_value=expected_value,
            expected_close_date=expected_close_date,
            notes=notes,
        )
        self.db.add(ticket)
        self.db.flush()
        
        # Log creation
        log = SalesTicketLog(
            sales_ticket_id=ticket.id,
            action_type=SalesTicketLogAction.CREATED,
            action_description=f"Sales ticket {ticket.ticket_number} created",
            created_by=user_id,
            created_by_name=user_name or "System",
        )
        self.db.add(log)
        
        self.db.commit()
        self.db.refresh(ticket)
        
        return ticket
    
    def get_ticket(self, ticket_id: str) -> Optional[SalesTicket]:
        """Get a ticket by ID."""
        return self.db.query(SalesTicket).filter(SalesTicket.id == ticket_id).first()
    
    def get_ticket_by_number(self, company_id: str, ticket_number: str) -> Optional[SalesTicket]:
        """Get a ticket by number."""
        return self.db.query(SalesTicket).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.ticket_number == ticket_number
            )
        ).first()
    
    def list_tickets(
        self,
        company_id: str,
        status: Optional[SalesTicketStatus] = None,
        stage: Optional[SalesTicketStage] = None,
        customer_id: Optional[str] = None,
        sales_person_id: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[SalesTicket]:
        """List tickets with filters."""
        query = self.db.query(SalesTicket).filter(SalesTicket.company_id == company_id)
        
        if status:
            query = query.filter(SalesTicket.status == status)
        if stage:
            query = query.filter(SalesTicket.current_stage == stage)
        if customer_id:
            query = query.filter(SalesTicket.customer_id == customer_id)
        if sales_person_id:
            query = query.filter(SalesTicket.sales_person_id == sales_person_id)
        if from_date:
            query = query.filter(SalesTicket.created_date >= from_date)
        if to_date:
            query = query.filter(SalesTicket.created_date <= to_date)
        if search:
            query = query.filter(SalesTicket.ticket_number.ilike(f"%{search}%"))
        
        return query.order_by(SalesTicket.created_date.desc()).offset(skip).limit(limit).all()
    
    def count_tickets(
        self,
        company_id: str,
        status: Optional[SalesTicketStatus] = None,
        stage: Optional[SalesTicketStage] = None,
    ) -> int:
        """Count tickets with filters."""
        query = self.db.query(func.count(SalesTicket.id)).filter(SalesTicket.company_id == company_id)
        
        if status:
            query = query.filter(SalesTicket.status == status)
        if stage:
            query = query.filter(SalesTicket.current_stage == stage)
        
        return query.scalar()
    
    def update_ticket(
        self,
        ticket_id: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        **kwargs
    ) -> Optional[SalesTicket]:
        """Update a ticket."""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return None
        
        old_status = ticket.status
        old_stage = ticket.current_stage
        
        for key, value in kwargs.items():
            if hasattr(ticket, key) and value is not None:
                setattr(ticket, key, value)
        
        ticket.updated_at = datetime.utcnow()
        
        # Log status change
        if "status" in kwargs and kwargs["status"] != old_status:
            log = SalesTicketLog(
                sales_ticket_id=ticket.id,
                action_type=SalesTicketLogAction.STATUS_CHANGED,
                action_description=f"Ticket status changed from {old_status.value} to {kwargs['status'].value}",
                old_value=old_status.value,
                new_value=kwargs["status"].value,
                created_by=user_id,
                created_by_name=user_name or "System",
            )
            self.db.add(log)
        
        # Log stage change
        if "current_stage" in kwargs and kwargs["current_stage"] != old_stage:
            log = SalesTicketLog(
                sales_ticket_id=ticket.id,
                action_type=SalesTicketLogAction.STAGE_CHANGED,
                action_description=f"Pipeline stage changed from {old_stage.value} to {kwargs['current_stage'].value}",
                old_value=old_stage.value,
                new_value=kwargs["current_stage"].value,
                created_by=user_id,
                created_by_name=user_name or "System",
            )
            self.db.add(log)
        
        self.db.commit()
        self.db.refresh(ticket)
        
        return ticket
    
    def update_stage(
        self,
        ticket_id: str,
        stage: SalesTicketStage,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> Optional[SalesTicket]:
        """Update ticket stage."""
        return self.update_ticket(
            ticket_id=ticket_id,
            current_stage=stage,
            user_id=user_id,
            user_name=user_name,
        )
    
    def mark_won(
        self,
        ticket_id: str,
        actual_value: Optional[Decimal] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> Optional[SalesTicket]:
        """Mark a ticket as won."""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return None
        
        ticket.status = SalesTicketStatus.WON
        ticket.actual_close_date = datetime.utcnow()
        if actual_value:
            ticket.actual_value = actual_value
        
        # Log the win
        log = SalesTicketLog(
            sales_ticket_id=ticket.id,
            action_type=SalesTicketLogAction.STATUS_CHANGED,
            action_description=f"Deal won! Value: {ticket.actual_value or ticket.expected_value}",
            old_value=SalesTicketStatus.OPEN.value,
            new_value=SalesTicketStatus.WON.value,
            created_by=user_id,
            created_by_name=user_name or "System",
        )
        self.db.add(log)
        
        self.db.commit()
        self.db.refresh(ticket)
        
        return ticket
    
    def mark_lost(
        self,
        ticket_id: str,
        loss_reason: Optional[str] = None,
        competitor_name: Optional[str] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> Optional[SalesTicket]:
        """Mark a ticket as lost."""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return None
        
        ticket.status = SalesTicketStatus.LOST
        ticket.actual_close_date = datetime.utcnow()
        ticket.loss_reason = loss_reason
        ticket.competitor_name = competitor_name
        
        # Log the loss
        description = "Deal lost"
        if loss_reason:
            description += f": {loss_reason[:100]}"
        if competitor_name:
            description += f" (Lost to: {competitor_name})"
        
        log = SalesTicketLog(
            sales_ticket_id=ticket.id,
            action_type=SalesTicketLogAction.STATUS_CHANGED,
            action_description=description,
            old_value=SalesTicketStatus.OPEN.value,
            new_value=SalesTicketStatus.LOST.value,
            created_by=user_id,
            created_by_name=user_name or "System",
        )
        self.db.add(log)
        
        self.db.commit()
        self.db.refresh(ticket)
        
        return ticket
    
    def get_timeline(self, ticket_id: str) -> List[SalesTicketLog]:
        """Get the activity timeline for a ticket."""
        return self.db.query(SalesTicketLog).filter(
            SalesTicketLog.sales_ticket_id == ticket_id
        ).order_by(SalesTicketLog.created_at.desc()).all()
    
    def add_note(
        self,
        ticket_id: str,
        note: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> Optional[SalesTicketLog]:
        """Add a note to a ticket."""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return None
        
        log = SalesTicketLog(
            sales_ticket_id=ticket.id,
            action_type=SalesTicketLogAction.NOTE_ADDED,
            action_description=note[:500],
            created_by=user_id,
            created_by_name=user_name or "System",
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        
        return log
    
    def get_full_flow(self, ticket_id: str) -> Dict[str, Any]:
        """Get the complete flow of documents for a ticket."""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return {}
        
        # Get all linked documents
        enquiries = self.db.query(Enquiry).filter(
            Enquiry.sales_ticket_id == ticket_id
        ).order_by(Enquiry.enquiry_date).all()
        
        quotations = self.db.query(Quotation).filter(
            Quotation.sales_ticket_id == ticket_id
        ).order_by(Quotation.quotation_date).all()
        
        sales_orders = self.db.query(SalesOrder).filter(
            SalesOrder.sales_ticket_id == ticket_id
        ).order_by(SalesOrder.order_date).all()
        
        delivery_challans = self.db.query(DeliveryChallan).filter(
            DeliveryChallan.sales_ticket_id == ticket_id
        ).order_by(DeliveryChallan.dc_date).all()
        
        invoices = self.db.query(Invoice).filter(
            Invoice.sales_ticket_id == ticket_id
        ).order_by(Invoice.invoice_date).all()
        
        timeline = self.get_timeline(ticket_id)
        
        return {
            "ticket": ticket,
            "customer": ticket.customer,
            "contact": ticket.contact,
            "sales_person": ticket.sales_person,
            "enquiries": enquiries,
            "quotations": quotations,
            "sales_orders": sales_orders,
            "delivery_challans": delivery_challans,
            "invoices": invoices,
            "timeline": timeline,
            "summary": {
                "total_enquiries": len(enquiries),
                "total_quotations": len(quotations),
                "total_sales_orders": len(sales_orders),
                "total_delivery_challans": len(delivery_challans),
                "total_invoices": len(invoices),
                "expected_value": float(ticket.expected_value or 0),
                "actual_value": float(ticket.actual_value or 0),
                "days_in_pipeline": (datetime.utcnow() - ticket.created_date).days if ticket.created_date else 0,
            }
        }
    
    def log_document_action(
        self,
        ticket_id: str,
        action_type: SalesTicketLogAction,
        description: str,
        document_type: str,
        document_id: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> SalesTicketLog:
        """Log an action related to a document."""
        log = SalesTicketLog(
            sales_ticket_id=ticket_id,
            action_type=action_type,
            action_description=description,
            related_document_type=document_type,
            related_document_id=document_id,
            created_by=user_id,
            created_by_name=user_name or "System",
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        
        return log
    
    def get_tickets_by_stage(self, company_id: str) -> Dict[str, List[SalesTicket]]:
        """Get tickets grouped by stage (for pipeline view)."""
        result = {}
        for stage in SalesTicketStage:
            tickets = self.db.query(SalesTicket).filter(
                and_(
                    SalesTicket.company_id == company_id,
                    SalesTicket.status == SalesTicketStatus.OPEN,
                    SalesTicket.current_stage == stage
                )
            ).order_by(SalesTicket.created_date.desc()).all()
            result[stage.value] = tickets
        
        return result
    
    def get_pipeline_summary(self, company_id: str) -> Dict[str, Any]:
        """Get pipeline summary statistics."""
        stages = {}
        for stage in SalesTicketStage:
            count = self.db.query(func.count(SalesTicket.id)).filter(
                and_(
                    SalesTicket.company_id == company_id,
                    SalesTicket.status == SalesTicketStatus.OPEN,
                    SalesTicket.current_stage == stage
                )
            ).scalar()
            
            value = self.db.query(func.sum(SalesTicket.expected_value)).filter(
                and_(
                    SalesTicket.company_id == company_id,
                    SalesTicket.status == SalesTicketStatus.OPEN,
                    SalesTicket.current_stage == stage
                )
            ).scalar() or 0
            
            stages[stage.value] = {
                "count": count,
                "value": float(value),
            }
        
        # Overall stats
        total_open = self.db.query(func.count(SalesTicket.id)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.OPEN
            )
        ).scalar()
        
        total_won = self.db.query(func.count(SalesTicket.id)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.WON
            )
        ).scalar()
        
        total_lost = self.db.query(func.count(SalesTicket.id)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.LOST
            )
        ).scalar()
        
        pipeline_value = self.db.query(func.sum(SalesTicket.expected_value)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.OPEN
            )
        ).scalar() or 0
        
        won_value = self.db.query(func.sum(SalesTicket.actual_value)).filter(
            and_(
                SalesTicket.company_id == company_id,
                SalesTicket.status == SalesTicketStatus.WON
            )
        ).scalar() or 0
        
        return {
            "stages": stages,
            "total_open": total_open,
            "total_won": total_won,
            "total_lost": total_lost,
            "pipeline_value": float(pipeline_value),
            "won_value": float(won_value),
            "win_rate": round((total_won / (total_won + total_lost) * 100) if (total_won + total_lost) > 0 else 0, 1),
        }

