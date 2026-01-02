"""Quick Entry API - Simple entry endpoints for non-accountants."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import User, Company, QuickEntry, Account, Customer
from app.services.voucher_service import VoucherService, CATEGORY_ACCOUNT_MAP
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}", tags=["Quick Entry"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# Schemas
class QuickEntryCreate(BaseModel):
    """Schema for creating a quick entry."""
    entry_type: str = Field(..., description="'money_in', 'money_out', or 'transfer'")
    amount: Decimal = Field(..., gt=0)
    entry_date: Optional[datetime] = None
    category: Optional[str] = None
    party_id: Optional[str] = None
    party_type: Optional[str] = None  # 'customer' or 'vendor'
    payment_account_id: Optional[str] = None
    payment_mode: Optional[str] = None  # 'cash', 'bank_transfer', 'upi', etc.
    description: Optional[str] = None
    reference_number: Optional[str] = None
    gst_rate: Optional[Decimal] = None
    from_account_id: Optional[str] = None  # For transfers
    to_account_id: Optional[str] = None    # For transfers
    # Cheque-specific fields
    cheque_number: Optional[str] = None
    drawer_name: Optional[str] = None  # For received cheques
    payee_name: Optional[str] = None  # For issued cheques
    drawn_on_bank: Optional[str] = None
    drawn_on_branch: Optional[str] = None
    bank_account_id: Optional[str] = None  # For issued cheques (cheque book bank account)


class QuickEntryResponse(BaseModel):
    """Schema for quick entry response."""
    id: str
    entry_type: str
    entry_date: datetime
    amount: Decimal
    category: Optional[str]
    party_id: Optional[str]
    party_type: Optional[str]
    party_name: Optional[str]
    payment_mode: Optional[str]
    description: Optional[str]
    reference_number: Optional[str]
    is_gst_applicable: bool
    gst_rate: Optional[Decimal]
    gst_amount: Decimal
    transaction_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryOption(BaseModel):
    """Category option for dropdown."""
    value: str
    label: str
    type: str  # 'income' or 'expense'


class PaymentAccountOption(BaseModel):
    """Payment account option."""
    id: str
    name: str
    code: str
    type: str  # 'cash' or 'bank'


class PartyOption(BaseModel):
    """Party (customer/vendor) option."""
    id: str
    name: str
    type: str  # 'customer' or 'vendor'
    gstin: Optional[str]


class QuickEntryOptions(BaseModel):
    """Options for quick entry form."""
    categories: List[CategoryOption]
    payment_accounts: List[PaymentAccountOption]
    parties: List[PartyOption]


# Endpoints

@router.post("/quick-entry", response_model=QuickEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_quick_entry(
    company_id: str,
    data: QuickEntryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a quick entry - simplified accounting entry.
    
    Entry Types:
    - **money_in**: Money received (sales, payments, income)
    - **money_out**: Money paid (expenses, purchases, payments)
    - **transfer**: Transfer between accounts (cash to bank, etc.)
    
    The system automatically creates proper double-entry accounting transactions.
    """
    company = get_company_or_404(company_id, current_user, db)
    
    # Validate entry type
    if data.entry_type not in ['money_in', 'money_out', 'transfer']:
        raise HTTPException(
            status_code=400,
            detail="entry_type must be 'money_in', 'money_out', or 'transfer'"
        )
    
    # Validate transfer has from/to accounts
    if data.entry_type == 'transfer':
        if not data.from_account_id or not data.to_account_id:
            raise HTTPException(
                status_code=400,
                detail="Transfer requires both from_account_id and to_account_id"
            )
    
    # Validate cheque fields if payment mode is cheque
    if data.payment_mode == 'cheque':
        if not data.cheque_number:
            raise HTTPException(
                status_code=400,
                detail="Cheque number is required when payment mode is cheque"
            )
        if data.entry_type == 'money_in' and not data.drawer_name:
            raise HTTPException(
                status_code=400,
                detail="Drawer name is required for received cheques"
            )
        if data.entry_type == 'money_out' and not data.payee_name:
            raise HTTPException(
                status_code=400,
                detail="Payee name is required for issued cheques"
            )
    
    service = VoucherService(db)
    
    try:
        entry = service.create_quick_entry(
            company=company,
            entry_type=data.entry_type,
            amount=data.amount,
            entry_date=data.entry_date,
            category=data.category,
            party_id=data.party_id,
            party_type=data.party_type,
            payment_account_id=data.payment_account_id,
            payment_mode=data.payment_mode,
            description=data.description,
            reference_number=data.reference_number,
            gst_rate=data.gst_rate,
            from_account_id=data.from_account_id,
            to_account_id=data.to_account_id,
            cheque_number=data.cheque_number,
            drawer_name=data.drawer_name,
            payee_name=data.payee_name,
            drawn_on_bank=data.drawn_on_bank,
            drawn_on_branch=data.drawn_on_branch,
            bank_account_id=data.bank_account_id,
        )
        
        return QuickEntryResponse(
            id=entry.id,
            entry_type=entry.entry_type.value,
            entry_date=entry.entry_date,
            amount=entry.amount,
            category=entry.category,
            party_id=entry.party_id,
            party_type=entry.party_type,
            party_name=entry.party_name,
            payment_mode=entry.payment_mode.value if entry.payment_mode else None,
            description=entry.description,
            reference_number=entry.reference_number,
            is_gst_applicable=entry.is_gst_applicable,
            gst_rate=entry.gst_rate,
            gst_amount=entry.gst_amount or Decimal(0),
            transaction_id=entry.transaction_id,
            created_at=entry.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick-entry", response_model=List[QuickEntryResponse])
async def list_quick_entries(
    company_id: str,
    entry_type: Optional[str] = None,
    category: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List quick entries with optional filters."""
    company = get_company_or_404(company_id, current_user, db)
    service = VoucherService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time()) if from_date else None
    to_dt = datetime.combine(to_date, datetime.max.time()) if to_date else None
    
    entries = service.get_quick_entries(
        company=company,
        entry_type=entry_type,
        from_date=from_dt,
        to_date=to_dt,
        category=category,
        limit=limit,
    )
    
    return [
        QuickEntryResponse(
            id=e.id,
            entry_type=e.entry_type.value,
            entry_date=e.entry_date,
            amount=e.amount,
            category=e.category,
            party_id=e.party_id,
            party_type=e.party_type,
            party_name=e.party_name,
            payment_mode=e.payment_mode.value if e.payment_mode else None,
            description=e.description,
            reference_number=e.reference_number,
            is_gst_applicable=e.is_gst_applicable,
            gst_rate=e.gst_rate,
            gst_amount=e.gst_amount or Decimal(0),
            transaction_id=e.transaction_id,
            created_at=e.created_at,
        )
        for e in entries
    ]


@router.get("/quick-entry/options", response_model=QuickEntryOptions)
async def get_quick_entry_options(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get options for quick entry form (categories, accounts, parties)."""
    company = get_company_or_404(company_id, current_user, db)
    
    # Build category options from mapping
    categories = []
    for key, value in CATEGORY_ACCOUNT_MAP.items():
        cat_type = "income" if value["type"] == "revenue" else "expense"
        categories.append(CategoryOption(
            value=key,
            label=value["name"],
            type=cat_type
        ))
    
    # Get payment accounts (cash and bank)
    payment_accounts = db.query(Account).filter(
        Account.company_id == company.id,
        Account.account_type == "asset",
        Account.is_active == True,
        Account.code.like("10%")  # Cash and bank accounts typically start with 10
    ).all()
    
    payment_account_options = []
    for acc in payment_accounts:
        acc_type = "cash" if "cash" in acc.name.lower() else "bank"
        payment_account_options.append(PaymentAccountOption(
            id=acc.id,
            name=acc.name,
            code=acc.code,
            type=acc_type
        ))
    
    # Get parties (customers and vendors)
    parties = []
    customers = db.query(Customer).filter(
        Customer.company_id == company.id,
        Customer.is_active == True
    ).limit(100).all()
    
    for c in customers:
        party_type = "vendor" if c.customer_type == "vendor" else "customer"
        parties.append(PartyOption(
            id=c.id,
            name=c.name,
            type=party_type,
            gstin=c.gstin
        ))
    
    return QuickEntryOptions(
        categories=categories,
        payment_accounts=payment_account_options,
        parties=parties
    )


@router.get("/quick-entry/summary")
async def get_quick_entry_summary(
    company_id: str,
    from_date: date,
    to_date: date,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get summary of quick entries by category for a period."""
    company = get_company_or_404(company_id, current_user, db)
    service = VoucherService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time())
    to_dt = datetime.combine(to_date, datetime.max.time())
    
    totals = service.get_category_totals(company, from_dt, to_dt)
    
    # Calculate grand totals
    total_in = sum(totals.get("money_in", {}).values())
    total_out = sum(totals.get("money_out", {}).values())
    
    return {
        "period": {
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat()
        },
        "money_in": {
            "total": float(total_in),
            "by_category": {k: float(v) for k, v in totals.get("money_in", {}).items()}
        },
        "money_out": {
            "total": float(total_out),
            "by_category": {k: float(v) for k, v in totals.get("money_out", {}).items()}
        },
        "net": float(total_in - total_out)
    }
