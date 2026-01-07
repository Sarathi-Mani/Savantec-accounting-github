"""Customer service for business logic."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from decimal import Decimal
import uuid
import json
from app.database.models import Customer, Company, OpeningBalanceItem, ContactPerson
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, OpeningBalanceItemCreate, 
    ContactPersonCreate, OpeningBalanceType, OpeningBalanceMode
)


class CustomerService:
    """Service for customer operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_customer(self, company: Company, data: CustomerCreate) -> Customer:
        """Create a new customer for a company with all fields."""
        # Generate customer code
        customer_code = self._generate_customer_code(company)
        
        # Convert string values to appropriate types
        opening_balance = Decimal(data.opening_balance) if data.opening_balance else Decimal('0')
        credit_limit = Decimal(data.credit_limit) if data.credit_limit else Decimal('0')
        credit_days = int(data.credit_days) if data.credit_days else 0
        
        # Calculate outstanding and advance balances
        outstanding_balance = Decimal('0')
        advance_balance = Decimal('0')
        
        if opening_balance and data.opening_balance_type:
            if data.opening_balance_type == OpeningBalanceType.OUTSTANDING:
                outstanding_balance = opening_balance
            else:
                advance_balance = opening_balance
        
        # Create customer with all fields
        customer = Customer(
            company_id=company.id,
            customer_code=customer_code,
            
            # Basic Information
            name=data.name,
            contact=data.contact,
            email=data.email,
            mobile=data.mobile,
            
            # Tax Information
            tax_number=data.tax_number,
            gst_registration_type=data.gst_registration_type,
            pan_number=data.pan_number,
            vendor_code=data.vendor_code,
            
            # Financial Information
            opening_balance=opening_balance,
            opening_balance_type=data.opening_balance_type.value if data.opening_balance_type else None,
            opening_balance_mode=data.opening_balance_mode.value if data.opening_balance_mode else None,
            credit_limit=credit_limit,
            credit_days=credit_days,
            
            # Address Information
            billing_address=data.billing_address,
            billing_city=data.billing_city,
            billing_state=data.billing_state,
            billing_country=data.billing_country,
            billing_zip=data.billing_zip,
            
            shipping_address=data.shipping_address,
            shipping_city=data.shipping_city,
            shipping_state=data.shipping_state,
            shipping_country=data.shipping_country,
            shipping_zip=data.shipping_zip,
            
            # Calculated balances
            outstanding_balance=outstanding_balance,
            advance_balance=advance_balance,
            
            # Additional Information
            customer_type=data.customer_type.value if data.customer_type else "b2b",
            
            # System defaults
            is_active=True,
            total_transactions=0
        )
        
        self.db.add(customer)
        self.db.flush()  # Flush to get customer ID
        
        # Create opening balance split items if in split mode
        if (data.opening_balance_mode == OpeningBalanceMode.SPLIT and 
            data.opening_balance_split):
            
            total_split_amount = Decimal('0')
            for item_data in data.opening_balance_split:
                item = OpeningBalanceItem(
                    customer_id=customer.id,
                    date=item_data.date,
                    voucher_name=item_data.voucher_name,
                    days=int(item_data.days) if item_data.days else None,
                    amount=Decimal(item_data.amount)
                )
                self.db.add(item)
                total_split_amount += Decimal(item_data.amount)
            
            # Update customer opening balance from split items
            customer.opening_balance = total_split_amount
            
            # Recalculate outstanding/advance based on total split amount
            if data.opening_balance_type == OpeningBalanceType.OUTSTANDING:
                customer.outstanding_balance = total_split_amount
            else:
                customer.advance_balance = total_split_amount
        
        # Create contact persons
        if data.contact_persons:
            for contact_data in data.contact_persons:
                # Only create if at least name is provided
                if contact_data.name.strip():
                    contact_person = ContactPerson(
                        customer_id=customer.id,
                        name=contact_data.name,
                        email=contact_data.email,
                        phone=contact_data.phone
                    )
                    self.db.add(contact_person)
        
        self.db.commit()
        self.db.refresh(customer)
        return customer
    
    def get_customer(self, customer_id: str, company: Company) -> Optional[Customer]:
        """Get a customer by ID (must belong to company)."""
        return self.db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.company_id == company.id,
            Customer.is_active == True
        ).first()
    
    def get_customers(
        self,
        company: Company,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        customer_type: Optional[str] = None
    ) -> Tuple[List[Customer], int]:
        """Get all customers for a company with pagination."""
        query = self.db.query(Customer).filter(
            Customer.company_id == company.id,
            Customer.is_active == True
        )
        
        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                (Customer.name.ilike(search_filter)) |
                (Customer.email.ilike(search_filter)) |
                (Customer.contact.ilike(search_filter)) |
                (Customer.mobile.ilike(search_filter)) |
                (Customer.tax_number.ilike(search_filter)) |
                (Customer.pan_number.ilike(search_filter)) |
                (Customer.vendor_code.ilike(search_filter)) |
                (Customer.customer_code.ilike(search_filter))
            )
        
        # Customer type filter
        if customer_type:
            query = query.filter(Customer.customer_type == customer_type)
        
        # Get total count
        total = query.count()
        
        # Pagination
        offset = (page - 1) * page_size
        customers = query.order_by(Customer.name).offset(offset).limit(page_size).all()
        
        return customers, total
    
    def update_customer(self, customer: Customer, data: CustomerUpdate) -> Customer:
        """Update a customer with all fields."""
        update_data = data.model_dump(exclude_unset=True)
        
        # Handle financial field conversions
        if 'opening_balance' in update_data and update_data['opening_balance']:
            update_data['opening_balance'] = Decimal(update_data['opening_balance'])
            
            # Recalculate outstanding/advance
            opening_balance_type = update_data.get('opening_balance_type', 
                                                 customer.opening_balance_type)
            if opening_balance_type == OpeningBalanceType.OUTSTANDING.value:
                update_data['outstanding_balance'] = update_data['opening_balance']
                update_data['advance_balance'] = Decimal('0')
            else:
                update_data['advance_balance'] = update_data['opening_balance']
                update_data['outstanding_balance'] = Decimal('0')
        
        if 'credit_limit' in update_data and update_data['credit_limit']:
            update_data['credit_limit'] = Decimal(update_data['credit_limit'])
        
        if 'credit_days' in update_data and update_data['credit_days']:
            update_data['credit_days'] = int(update_data['credit_days'])
        
        # Update opening balance split items if mode changed to split
        if (update_data.get('opening_balance_mode') == OpeningBalanceMode.SPLIT.value and
            'opening_balance_split' in update_data and update_data['opening_balance_split']):
            
            # Delete existing split items
            self.db.query(OpeningBalanceItem).filter(
                OpeningBalanceItem.customer_id == customer.id
            ).delete()
            
            # Add new split items
            total_split_amount = Decimal('0')
            for item_data in update_data['opening_balance_split']:
                item = OpeningBalanceItem(
                    customer_id=customer.id,
                    date=item_data['date'],
                    voucher_name=item_data['voucher_name'],
                    days=int(item_data['days']) if item_data.get('days') else None,
                    amount=Decimal(item_data['amount'])
                )
                self.db.add(item)
                total_split_amount += Decimal(item_data['amount'])
            
            # Update opening balance from split items
            update_data['opening_balance'] = total_split_amount
            
            # Recalculate outstanding/advance
            opening_balance_type = update_data.get('opening_balance_type', 
                                                 customer.opening_balance_type)
            if opening_balance_type == OpeningBalanceType.OUTSTANDING.value:
                update_data['outstanding_balance'] = total_split_amount
                update_data['advance_balance'] = Decimal('0')
            else:
                update_data['advance_balance'] = total_split_amount
                update_data['outstanding_balance'] = Decimal('0')
        
        # Update contact persons if provided
        if 'contact_persons' in update_data:
            # Delete existing contact persons
            self.db.query(ContactPerson).filter(
                ContactPerson.customer_id == customer.id
            ).delete()
            
            # Add new contact persons
            for contact_data in update_data['contact_persons']:
                if contact_data['name'].strip():
                    contact_person = ContactPerson(
                        customer_id=customer.id,
                        name=contact_data['name'],
                        email=contact_data.get('email'),
                        phone=contact_data.get('phone')
                    )
                    self.db.add(contact_person)
            
            # Remove from update_data as we've handled it separately
            del update_data['contact_persons']
        
        # Update basic fields
        for field, value in update_data.items():
            if hasattr(customer, field) and value is not None:
                setattr(customer, field, value)
        
        customer.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(customer)
        return customer
    
    def delete_customer(self, customer: Customer) -> bool:
        """Soft delete a customer."""
        customer.is_active = False
        customer.updated_at = datetime.utcnow()
        self.db.commit()
        return True
    
    def search_customers(self, company: Company, query_str: str, limit: int = 10) -> List[Customer]:
        """Quick search for customers (for autocomplete)."""
        search_filter = f"%{query_str}%"
        return self.db.query(Customer).filter(
            Customer.company_id == company.id,
            Customer.is_active == True,
            (Customer.name.ilike(search_filter)) |
            (Customer.contact.ilike(search_filter)) |
            (Customer.email.ilike(search_filter)) |
            (Customer.tax_number.ilike(search_filter)) |
            (Customer.vendor_code.ilike(search_filter))
        ).limit(limit).all()
    
    def get_customer_count(self, company: Company) -> int:
        """Get total number of active customers."""
        return self.db.query(func.count(Customer.id)).filter(
            Customer.company_id == company.id,
            Customer.is_active == True
        ).scalar()
    
    def get_total_outstanding(self, company: Company) -> Decimal:
        """Get total outstanding balance for all customers."""
        result = self.db.query(func.sum(Customer.outstanding_balance)).filter(
            Customer.company_id == company.id,
            Customer.is_active == True
        ).scalar()
        return Decimal(result) if result else Decimal('0')
    
    def get_total_advance(self, company: Company) -> Decimal:
        """Get total advance balance for all customers."""
        result = self.db.query(func.sum(Customer.advance_balance)).filter(
            Customer.company_id == company.id,
            Customer.is_active == True
        ).scalar()
        return Decimal(result) if result else Decimal('0')
    
    def get_recent_customers(self, company: Company, limit: int = 5) -> List[Customer]:
        """Get recent customers."""
        return self.db.query(Customer).filter(
            Customer.company_id == company.id,
            Customer.is_active == True
        ).order_by(Customer.created_at.desc()).limit(limit).all()
    
    def get_customers_by_state(self, company: Company) -> Dict[str, int]:
        """Get customers grouped by state."""
        result = self.db.query(
            Customer.billing_state,
            func.count(Customer.id).label('count')
        ).filter(
            Customer.company_id == company.id,
            Customer.is_active == True,
            Customer.billing_state.isnot(None)
        ).group_by(Customer.billing_state).all()
        
        return {state: count for state, count in result}
    
    def get_top_customers(self, company: Company, limit: int = 10, period: str = "all") -> List[Dict[str, Any]]:
        """Get top customers by outstanding balance."""
        customers = self.db.query(Customer).filter(
            Customer.company_id == company.id,
            Customer.is_active == True,
            Customer.outstanding_balance > 0
        ).order_by(Customer.outstanding_balance.desc()).limit(limit).all()
        
        return [
            {
                "id": str(customer.id),
                "name": customer.name,
                "outstanding_balance": float(customer.outstanding_balance),
                "contact": customer.contact
            }
            for customer in customers
        ]
    
    def _generate_customer_code(self, company: Company) -> str:
        """Generate a unique customer code."""
        # Get the count of customers for this company
        count = self.db.query(func.count(Customer.id)).filter(
            Customer.company_id == company.id
        ).scalar()
        
        # Format: CUST-001, CUST-002, etc.
        return f"CUST-{count + 1:03d}"