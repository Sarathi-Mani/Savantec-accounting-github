"""Payment service for business logic."""
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from app.database.models import Payment, Invoice, InvoiceStatus, PaymentMode
from app.schemas.invoice import PaymentCreate


class PaymentService:
    """Service for payment operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def record_payment(self, invoice: Invoice, data: PaymentCreate) -> Payment:
        """Record a payment against an invoice."""
        # Validate payment amount
        if data.amount > invoice.balance_due:
            raise ValueError(
                f"Payment amount ({data.amount}) exceeds balance due ({invoice.balance_due})"
            )
        
        # Create payment record
        payment = Payment(
            invoice_id=invoice.id,
            amount=data.amount,
            payment_date=data.payment_date or datetime.utcnow(),
            payment_mode=data.payment_mode,
            reference_number=data.reference_number,
            upi_transaction_id=data.upi_transaction_id,
            notes=data.notes,
        )
        
        self.db.add(payment)
        
        # Update invoice amounts
        invoice.amount_paid += data.amount
        invoice.balance_due -= data.amount
        
        # Update invoice status (this will trigger stock reduction if PAID)
        from app.services.invoice_service import InvoiceService
        invoice_service = InvoiceService(self.db)
        
        old_status = invoice.status
        if invoice.balance_due <= 0:
            invoice_service.update_invoice_status(invoice, InvoiceStatus.PAID)
        elif invoice.amount_paid > 0 and old_status != InvoiceStatus.PARTIALLY_PAID:
            invoice_service.update_invoice_status(invoice, InvoiceStatus.PARTIALLY_PAID)
        else:
            self.db.commit()
        
        self.db.refresh(payment)
        
        # Create accounting journal entries
        try:
            from app.services.accounting_service import AccountingService
            accounting_service = AccountingService(self.db)
            accounting_service.create_payment_entries(payment)
        except Exception as e:
            # Log error but don't fail payment recording
            print(f"Warning: Failed to create accounting entries for payment: {e}")
        
        return payment
    
    def get_payments(self, invoice: Invoice) -> List[Payment]:
        """Get all payments for an invoice."""
        return self.db.query(Payment).filter(
            Payment.invoice_id == invoice.id
        ).order_by(Payment.payment_date.desc()).all()
    
    def verify_payment(self, payment: Payment) -> Payment:
        """Mark a payment as verified."""
        payment.is_verified = True
        payment.verified_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(payment)
        return payment
    
    def delete_payment(self, payment: Payment, invoice: Invoice) -> bool:
        """Delete a payment and update invoice."""
        # Reverse the payment amount
        invoice.amount_paid -= payment.amount
        invoice.balance_due += payment.amount
        
        # Update invoice status (Note: deleting payment doesn't restore stock)
        from app.services.invoice_service import InvoiceService
        invoice_service = InvoiceService(self.db)
        
        if invoice.amount_paid <= 0:
            invoice_service.update_invoice_status(invoice, InvoiceStatus.PENDING)
        elif invoice.amount_paid < invoice.total_amount:
            invoice_service.update_invoice_status(invoice, InvoiceStatus.PARTIALLY_PAID)
        else:
            self.db.commit()
        
        self.db.delete(payment)
        self.db.commit()
        
        return True
    
    def auto_mark_paid_from_upi(
        self,
        invoice: Invoice,
        upi_transaction_id: str,
        amount: Decimal
    ) -> Payment:
        """Auto-mark invoice as paid when UPI payment is received."""
        payment_data = PaymentCreate(
            amount=amount,
            payment_mode=PaymentMode.UPI,
            upi_transaction_id=upi_transaction_id,
            notes="Auto-recorded UPI payment"
        )
        
        payment = self.record_payment(invoice, payment_data)
        payment.is_verified = True
        payment.verified_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(payment)
        
        return payment

