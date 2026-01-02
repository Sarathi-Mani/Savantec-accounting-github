"""
Recurring Transaction Service - Standing instructions and auto-vouchers.

Features:
- Create recurring transaction templates
- Auto-generate vouchers with accounting entries
- Manage schedules
"""
from decimal import Decimal
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.database.models import (
    RecurringTransaction, RecurringFrequency, VoucherType,
    Transaction, TransactionEntry, generate_uuid, Company,
    AccountMappingType
)
from app.services.accounting_service import AccountingService
from app.schemas.accounting import (
    TransactionCreate, TransactionEntryCreate, 
    ReferenceType as SchemaReferenceType
)


class RecurringTransactionService:
    """Service for recurring transactions."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_recurring(
        self,
        company_id: str,
        name: str,
        voucher_type: VoucherType,
        amount: Decimal,
        frequency: RecurringFrequency,
        start_date: datetime,
        end_date: datetime = None,
        template_data: Dict = None,
        party_id: str = None,
        party_type: str = None,
        day_of_month: int = None,
        day_of_week: int = None,
        total_occurrences: int = None,
        auto_create: bool = True,
        reminder_days: int = 3,
        description: str = None,
        category: str = None,
        debit_account_id: str = None,
        credit_account_id: str = None,
    ) -> RecurringTransaction:
        """Create a new recurring transaction template."""
        next_date = self._calculate_next_date(start_date, frequency, day_of_month, day_of_week)
        
        recurring = RecurringTransaction(
            id=generate_uuid(),
            company_id=company_id,
            name=name,
            description=description,
            voucher_type=voucher_type,
            template_data=template_data or {},
            party_id=party_id,
            party_type=party_type,
            amount=amount,
            category=category,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            frequency=frequency,
            start_date=start_date,
            end_date=end_date,
            next_date=next_date,
            day_of_month=day_of_month,
            day_of_week=day_of_week,
            total_occurrences=total_occurrences,
            occurrences_created=0,
            auto_create=auto_create,
            reminder_days=reminder_days,
            is_active=True,
        )
        
        self.db.add(recurring)
        self.db.commit()
        self.db.refresh(recurring)
        
        return recurring
    
    def _calculate_next_date(
        self,
        from_date: datetime,
        frequency: RecurringFrequency,
        day_of_month: int = None,
        day_of_week: int = None,
    ) -> datetime:
        """Calculate the next occurrence date."""
        if frequency == RecurringFrequency.DAILY:
            return from_date + timedelta(days=1)
        
        elif frequency == RecurringFrequency.WEEKLY:
            if day_of_week is not None:
                days_ahead = day_of_week - from_date.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return from_date + timedelta(days=days_ahead)
            return from_date + timedelta(weeks=1)
        
        elif frequency == RecurringFrequency.BIWEEKLY:
            return from_date + timedelta(weeks=2)
        
        elif frequency == RecurringFrequency.MONTHLY:
            next_month = from_date + relativedelta(months=1)
            if day_of_month:
                try:
                    return next_month.replace(day=day_of_month)
                except ValueError:
                    # Handle months with fewer days
                    return next_month.replace(day=28)
            return next_month
        
        elif frequency == RecurringFrequency.QUARTERLY:
            return from_date + relativedelta(months=3)
        
        elif frequency == RecurringFrequency.HALF_YEARLY:
            return from_date + relativedelta(months=6)
        
        elif frequency == RecurringFrequency.YEARLY:
            return from_date + relativedelta(years=1)
        
        return from_date + timedelta(days=30)  # Default
    
    def get_recurring(self, recurring_id: str) -> Optional[RecurringTransaction]:
        return self.db.query(RecurringTransaction).filter(
            RecurringTransaction.id == recurring_id
        ).first()
    
    def update_recurring(
        self,
        recurring_id: str,
        name: str = None,
        description: str = None,
        amount: Decimal = None,
        category: str = None,
        debit_account_id: str = None,
        credit_account_id: str = None,
        frequency: RecurringFrequency = None,
        end_date: datetime = None,
        day_of_month: int = None,
        day_of_week: int = None,
        total_occurrences: int = None,
        auto_create: bool = None,
        reminder_days: int = None,
    ) -> Optional[RecurringTransaction]:
        """Update a recurring transaction template."""
        recurring = self.get_recurring(recurring_id)
        if not recurring:
            return None
        
        if name is not None:
            recurring.name = name
        if description is not None:
            recurring.description = description
        if amount is not None:
            recurring.amount = amount
        if category is not None:
            recurring.category = category
        if debit_account_id is not None:
            recurring.debit_account_id = debit_account_id
        if credit_account_id is not None:
            recurring.credit_account_id = credit_account_id
        if frequency is not None:
            recurring.frequency = frequency
            # Recalculate next date
            recurring.next_date = self._calculate_next_date(
                datetime.utcnow(),
                frequency,
                day_of_month or recurring.day_of_month,
                day_of_week or recurring.day_of_week,
            )
        if end_date is not None:
            recurring.end_date = end_date
        if day_of_month is not None:
            recurring.day_of_month = day_of_month
        if day_of_week is not None:
            recurring.day_of_week = day_of_week
        if total_occurrences is not None:
            recurring.total_occurrences = total_occurrences
        if auto_create is not None:
            recurring.auto_create = auto_create
        if reminder_days is not None:
            recurring.reminder_days = reminder_days
        
        self.db.commit()
        self.db.refresh(recurring)
        return recurring
    
    def list_recurring(
        self,
        company_id: str,
        active_only: bool = True,
        voucher_type: VoucherType = None,
    ) -> List[RecurringTransaction]:
        query = self.db.query(RecurringTransaction).filter(
            RecurringTransaction.company_id == company_id
        )
        
        if active_only:
            query = query.filter(RecurringTransaction.is_active == True)
        
        if voucher_type:
            query = query.filter(RecurringTransaction.voucher_type == voucher_type)
        
        return query.order_by(RecurringTransaction.next_date.asc()).all()
    
    def get_due_recurring(self, company_id: str) -> List[RecurringTransaction]:
        """Get recurring transactions due for creation."""
        today = datetime.utcnow()
        
        return self.db.query(RecurringTransaction).filter(
            RecurringTransaction.company_id == company_id,
            RecurringTransaction.is_active == True,
            RecurringTransaction.auto_create == True,
            RecurringTransaction.next_date <= today,
        ).all()
    
    def get_upcoming_recurring(
        self,
        company_id: str,
        days_ahead: int = 7,
    ) -> List[RecurringTransaction]:
        """Get recurring transactions coming up (for reminders)."""
        today = datetime.utcnow()
        future = today + timedelta(days=days_ahead)
        
        return self.db.query(RecurringTransaction).filter(
            RecurringTransaction.company_id == company_id,
            RecurringTransaction.is_active == True,
            RecurringTransaction.next_date >= today,
            RecurringTransaction.next_date <= future,
        ).all()
    
    def process_recurring(
        self,
        recurring_id: str,
        company: Company = None,
    ) -> Optional[Transaction]:
        """Process a recurring transaction and create the actual journal entry."""
        recurring = self.get_recurring(recurring_id)
        if not recurring or not recurring.is_active:
            return None
        
        # Check if within occurrence limit
        if recurring.total_occurrences and recurring.occurrences_created >= recurring.total_occurrences:
            recurring.is_active = False
            self.db.commit()
            return None
        
        # Check if past end date
        if recurring.end_date and recurring.next_date > recurring.end_date:
            recurring.is_active = False
            self.db.commit()
            return None
        
        # Get company if not provided
        if not company:
            company = self.db.query(Company).filter(Company.id == recurring.company_id).first()
            if not company:
                return None
        
        # Create the transaction using AccountingService
        transaction = None
        accounting_service = AccountingService(self.db)
        
        # Ensure chart of accounts exists
        accounting_service.initialize_chart_of_accounts(company)
        accounting_service.initialize_account_mappings(company)
        
        # Get debit and credit accounts
        debit_account_id = recurring.debit_account_id
        credit_account_id = recurring.credit_account_id
        
        # If no accounts set, try to get from account mapping
        if not debit_account_id or not credit_account_id:
            # Determine mapping type based on voucher type
            if recurring.voucher_type in [VoucherType.PAYMENT, VoucherType.PURCHASE]:
                mapping_type = AccountMappingType.RECURRING_EXPENSE
            else:
                mapping_type = AccountMappingType.RECURRING_INCOME
            
            # Try to find mapping by category
            if recurring.category:
                mapping = accounting_service.get_account_mapping(company, mapping_type, recurring.category)
                if mapping:
                    if not debit_account_id:
                        debit_account_id = mapping.debit_account_id
                    if not credit_account_id:
                        credit_account_id = mapping.credit_account_id
            
            # Default to "other_expense" or "other_income" if still no accounts
            if not debit_account_id or not credit_account_id:
                default_category = "other_expense" if mapping_type == AccountMappingType.RECURRING_EXPENSE else "other_income"
                mapping = accounting_service.get_account_mapping(company, mapping_type, default_category)
                if mapping:
                    if not debit_account_id:
                        debit_account_id = mapping.debit_account_id
                    if not credit_account_id:
                        credit_account_id = mapping.credit_account_id
        
        # Create journal entry if we have accounts
        if debit_account_id and credit_account_id:
            entries = [
                TransactionEntryCreate(
                    account_id=debit_account_id,
                    description=f"{recurring.name} - {recurring.next_date.strftime('%Y-%m-%d')}",
                    debit_amount=recurring.amount,
                    credit_amount=Decimal("0"),
                ),
                TransactionEntryCreate(
                    account_id=credit_account_id,
                    description=f"{recurring.name} - {recurring.next_date.strftime('%Y-%m-%d')}",
                    debit_amount=Decimal("0"),
                    credit_amount=recurring.amount,
                ),
            ]
            
            transaction_data = TransactionCreate(
                transaction_date=recurring.next_date,
                description=f"Recurring: {recurring.name}",
                reference_type=SchemaReferenceType.MANUAL,
                reference_id=recurring.id,
                entries=entries,
            )
            
            try:
                transaction = accounting_service.create_journal_entry(
                    company, 
                    transaction_data, 
                    auto_post=True
                )
                recurring.last_transaction_id = transaction.id
            except Exception as e:
                print(f"Error creating journal entry for recurring {recurring.id}: {e}")
        
        # Update recurring record
        recurring.occurrences_created += 1
        recurring.last_created_at = datetime.utcnow()
        recurring.next_date = self._calculate_next_date(
            recurring.next_date,
            recurring.frequency,
            recurring.day_of_month,
            recurring.day_of_week,
        )
        
        # Check limits again
        if recurring.total_occurrences and recurring.occurrences_created >= recurring.total_occurrences:
            recurring.is_active = False
        
        if recurring.end_date and recurring.next_date > recurring.end_date:
            recurring.is_active = False
        
        self.db.commit()
        self.db.refresh(recurring)
        
        return transaction
    
    def process_all_due(self, company_id: str) -> Dict:
        """Process all due recurring transactions."""
        due = self.get_due_recurring(company_id)
        processed = 0
        
        for recurring in due:
            self.process_recurring(recurring.id)
            processed += 1
        
        return {
            'total_due': len(due),
            'processed': processed,
        }
    
    def pause_recurring(self, recurring_id: str) -> RecurringTransaction:
        """Pause a recurring transaction."""
        recurring = self.get_recurring(recurring_id)
        if recurring:
            recurring.is_active = False
            self.db.commit()
            self.db.refresh(recurring)
        return recurring
    
    def resume_recurring(self, recurring_id: str) -> RecurringTransaction:
        """Resume a paused recurring transaction."""
        recurring = self.get_recurring(recurring_id)
        if recurring:
            recurring.is_active = True
            # Reset next date to next occurrence from today
            recurring.next_date = self._calculate_next_date(
                datetime.utcnow(),
                recurring.frequency,
                recurring.day_of_month,
                recurring.day_of_week,
            )
            self.db.commit()
            self.db.refresh(recurring)
        return recurring
    
    def delete_recurring(self, recurring_id: str) -> bool:
        """Delete a recurring transaction."""
        recurring = self.get_recurring(recurring_id)
        if recurring:
            self.db.delete(recurring)
            self.db.commit()
            return True
        return False
