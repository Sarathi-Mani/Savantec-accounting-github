"""API endpoints for managing contacts."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.database.connection import get_db
from app.database.models import Contact, Customer, Company

router = APIRouter(prefix="/api/companies/{company_id}", tags=["contacts"])


class ContactCreate(BaseModel):
    customer_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    is_primary: bool = False
    is_decision_maker: bool = False
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    is_primary: Optional[bool] = None
    is_decision_maker: Optional[bool] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ContactResponse(BaseModel):
    id: str
    company_id: str
    customer_id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    mobile: Optional[str]
    designation: Optional[str]
    department: Optional[str]
    is_primary: bool
    is_decision_maker: bool
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    customer_name: Optional[str] = None

    class Config:
        from_attributes = True


def get_company(db: Session, company_id: str) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.post("/contacts", response_model=ContactResponse)
def create_contact(
    company_id: str,
    data: ContactCreate,
    db: Session = Depends(get_db),
):
    """Create a new contact."""
    company = get_company(db, company_id)
    
    # Verify customer exists
    customer = db.query(Customer).filter(
        Customer.id == data.customer_id,
        Customer.company_id == company_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # If marking as primary, unset other primary contacts
    if data.is_primary:
        db.query(Contact).filter(
            Contact.customer_id == data.customer_id,
            Contact.is_primary == True
        ).update({"is_primary": False})
    
    contact = Contact(
        company_id=company_id,
        **data.model_dump()
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    
    response = ContactResponse.model_validate(contact)
    response.customer_name = customer.name
    return response


@router.get("/contacts", response_model=List[ContactResponse])
def list_contacts(
    company_id: str,
    customer_id: Optional[str] = Query(None),
    is_active: bool = Query(True),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List contacts with filters."""
    get_company(db, company_id)
    
    query = db.query(Contact).filter(Contact.company_id == company_id)
    
    if customer_id:
        query = query.filter(Contact.customer_id == customer_id)
    if is_active is not None:
        query = query.filter(Contact.is_active == is_active)
    if search:
        query = query.filter(
            Contact.name.ilike(f"%{search}%") |
            Contact.email.ilike(f"%{search}%") |
            Contact.phone.ilike(f"%{search}%")
        )
    
    contacts = query.order_by(Contact.name).offset(skip).limit(limit).all()
    
    # Get customer names
    customer_ids = list(set(c.customer_id for c in contacts))
    customers = {c.id: c.name for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all()}
    
    results = []
    for contact in contacts:
        response = ContactResponse.model_validate(contact)
        response.customer_name = customers.get(contact.customer_id)
        results.append(response)
    
    return results


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
def get_contact(
    company_id: str,
    contact_id: str,
    db: Session = Depends(get_db),
):
    """Get a contact by ID."""
    get_company(db, company_id)
    
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.company_id == company_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    response = ContactResponse.model_validate(contact)
    if contact.customer:
        response.customer_name = contact.customer.name
    return response


@router.put("/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(
    company_id: str,
    contact_id: str,
    data: ContactUpdate,
    db: Session = Depends(get_db),
):
    """Update a contact."""
    get_company(db, company_id)
    
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.company_id == company_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # If marking as primary, unset other primary contacts
    if data.is_primary:
        db.query(Contact).filter(
            Contact.customer_id == contact.customer_id,
            Contact.is_primary == True,
            Contact.id != contact_id
        ).update({"is_primary": False})
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)
    
    contact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contact)
    
    response = ContactResponse.model_validate(contact)
    if contact.customer:
        response.customer_name = contact.customer.name
    return response


@router.delete("/contacts/{contact_id}")
def delete_contact(
    company_id: str,
    contact_id: str,
    db: Session = Depends(get_db),
):
    """Delete a contact."""
    get_company(db, company_id)
    
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.company_id == company_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    db.delete(contact)
    db.commit()
    
    return {"message": "Contact deleted"}


@router.get("/customers/{customer_id}/contacts", response_model=List[ContactResponse])
def get_customer_contacts(
    company_id: str,
    customer_id: str,
    db: Session = Depends(get_db),
):
    """Get all contacts for a customer."""
    get_company(db, company_id)
    
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.company_id == company_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    contacts = db.query(Contact).filter(
        Contact.customer_id == customer_id,
        Contact.is_active == True
    ).order_by(Contact.is_primary.desc(), Contact.name).all()
    
    results = []
    for contact in contacts:
        response = ContactResponse.model_validate(contact)
        response.customer_name = customer.name
        results.append(response)
    
    return results

