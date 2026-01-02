"""Customer service for business logic."""
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
from app.database.models import Customer, Company
from app.schemas.customer import CustomerCreate, CustomerUpdate


class CustomerService:
    """Service for customer operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_customer(self, company: Company, data: CustomerCreate) -> Customer:
        """Create a new customer for a company."""
        customer = Customer(
            company_id=company.id,
            name=data.name,
            trade_name=data.trade_name,
            gstin=data.gstin,
            pan=data.pan,
            email=data.email,
            phone=data.phone,
            contact_person=data.contact_person,
            billing_address_line1=data.billing_address_line1,
            billing_address_line2=data.billing_address_line2,
            billing_city=data.billing_city,
            billing_state=data.billing_state,
            billing_state_code=data.billing_state_code,
            billing_pincode=data.billing_pincode,
            billing_country=data.billing_country,
            shipping_address_line1=data.shipping_address_line1 or data.billing_address_line1,
            shipping_address_line2=data.shipping_address_line2 or data.billing_address_line2,
            shipping_city=data.shipping_city or data.billing_city,
            shipping_state=data.shipping_state or data.billing_state,
            shipping_state_code=data.shipping_state_code or data.billing_state_code,
            shipping_pincode=data.shipping_pincode or data.billing_pincode,
            shipping_country=data.shipping_country or data.billing_country,
            customer_type=data.customer_type,
        )
        
        # Extract state code from GSTIN if not provided
        if data.gstin and not data.billing_state_code:
            customer.billing_state_code = data.gstin[:2]
            customer.shipping_state_code = data.gstin[:2]
        
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer
    
    def get_customer(self, customer_id: str, company: Company) -> Optional[Customer]:
        """Get a customer by ID (must belong to company)."""
        return self.db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.company_id == company.id
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
                (Customer.phone.ilike(search_filter)) |
                (Customer.gstin.ilike(search_filter))
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
        """Update a customer."""
        update_data = data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(customer, field, value)
        
        self.db.commit()
        self.db.refresh(customer)
        return customer
    
    def delete_customer(self, customer: Customer) -> bool:
        """Soft delete a customer."""
        customer.is_active = False
        self.db.commit()
        return True
    
    def search_customers(self, company: Company, query: str, limit: int = 10) -> List[Customer]:
        """Quick search for customers (for autocomplete)."""
        search_filter = f"%{query}%"
        return self.db.query(Customer).filter(
            Customer.company_id == company.id,
            Customer.is_active == True,
            (Customer.name.ilike(search_filter)) |
            (Customer.gstin.ilike(search_filter)) |
            (Customer.phone.ilike(search_filter))
        ).limit(limit).all()

