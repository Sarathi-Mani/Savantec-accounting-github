"""Inventory API - Stock management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.database.models import User, Company, Product, StockGroup, Godown, StockMovementType
from app.services.inventory_service import InventoryService
from app.auth.dependencies import get_current_active_user

router = APIRouter(prefix="/companies/{company_id}/inventory", tags=["Inventory"])


def get_company_or_404(company_id: str, current_user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ============== Schemas ==============

class StockGroupCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None


class StockGroupResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str]
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class GodownCreate(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    parent_id: Optional[str] = None
    is_default: bool = False


class GodownResponse(BaseModel):
    id: str
    name: str
    code: Optional[str]
    address: Optional[str]
    parent_id: Optional[str]
    is_default: bool
    is_active: bool

    class Config:
        from_attributes = True


# Stock Item schemas now map to Product (unified model)
class StockItemCreate(BaseModel):
    name: str
    sku: Optional[str] = None  # Maps to Product.sku
    barcode: Optional[str] = None
    stock_group_id: Optional[str] = None
    unit: str = "unit"
    hsn_code: Optional[str] = None
    gst_rate: str = "18"  # String to match Product
    opening_stock: Decimal = Decimal("0")
    standard_cost: Decimal = Decimal("0")
    unit_price: Decimal = Decimal("0")  # Maps to Product.unit_price
    min_stock_level: Decimal = Decimal("0")
    enable_batch: bool = False
    enable_expiry: bool = False


class StockItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    stock_group_id: Optional[str] = None
    unit: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[str] = None
    standard_cost: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    min_stock_level: Optional[Decimal] = None
    enable_batch: Optional[bool] = None
    enable_expiry: Optional[bool] = None
    is_active: Optional[bool] = None


class StockItemResponse(BaseModel):
    """Response model for stock items - uses Product fields."""
    id: str
    name: str
    sku: Optional[str] = None  # Was 'code'
    barcode: Optional[str] = None
    stock_group_id: Optional[str] = None
    unit: str = "unit"  # Was 'primary_unit'
    hsn_code: Optional[str] = None
    gst_rate: str = "18"
    opening_stock: Decimal = Decimal("0")
    current_stock: Decimal = Decimal("0")
    min_stock_level: Decimal = Decimal("0")
    standard_cost: Decimal = Decimal("0")
    unit_price: Decimal = Decimal("0")  # Was 'standard_selling_price'
    enable_batch: bool = False
    enable_expiry: bool = False
    is_active: bool = True
    is_service: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StockInRequest(BaseModel):
    product_id: str  # Changed from stock_item_id
    quantity: Decimal = Field(..., gt=0)
    rate: Decimal = Field(..., ge=0)
    godown_id: Optional[str] = None
    batch_id: Optional[str] = None
    reference_number: Optional[str] = None
    entry_date: Optional[datetime] = None
    notes: Optional[str] = None


class StockOutRequest(BaseModel):
    product_id: str  # Changed from stock_item_id
    quantity: Decimal = Field(..., gt=0)
    rate: Optional[Decimal] = None
    godown_id: Optional[str] = None
    batch_id: Optional[str] = None
    reference_number: Optional[str] = None
    entry_date: Optional[datetime] = None
    notes: Optional[str] = None


class StockTransferRequest(BaseModel):
    product_id: str  # Changed from stock_item_id
    quantity: Decimal = Field(..., gt=0)
    from_godown_id: str
    to_godown_id: str
    batch_id: Optional[str] = None
    entry_date: Optional[datetime] = None
    notes: Optional[str] = None


class StockEntryResponse(BaseModel):
    id: str
    product_id: str  # Changed from stock_item_id
    godown_id: Optional[str]
    entry_date: datetime
    movement_type: str
    quantity: Decimal
    unit: Optional[str]
    rate: Decimal
    value: Decimal
    reference_number: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class BatchCreate(BaseModel):
    product_id: str  # Changed from stock_item_id
    batch_number: str
    manufacturing_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    quantity: Decimal = Decimal("0")
    cost_price: Decimal = Decimal("0")


class BatchResponse(BaseModel):
    id: str
    product_id: str  # Changed from stock_item_id
    batch_number: str
    manufacturing_date: Optional[datetime]
    expiry_date: Optional[datetime]
    quantity: Decimal
    cost_price: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class BOMComponentInput(BaseModel):
    item_id: str
    quantity: Decimal
    unit: Optional[str] = None
    waste_percentage: Decimal = Decimal("0")


class BOMCreate(BaseModel):
    finished_item_id: str
    name: str
    output_quantity: Decimal = Decimal("1")
    output_unit: Optional[str] = None
    description: Optional[str] = None
    components: List[BOMComponentInput] = []


class BOMResponse(BaseModel):
    id: str
    finished_item_id: str
    name: str
    output_quantity: Decimal
    output_unit: Optional[str]
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class ProductionRequest(BaseModel):
    bom_id: str
    quantity: Decimal = Field(..., gt=0)
    godown_id: Optional[str] = None
    entry_date: Optional[datetime] = None


class StockSummaryResponse(BaseModel):
    total_items: int
    total_value: float
    low_stock_count: int
    out_of_stock_count: int


# ============== Stock Groups ==============

@router.post("/groups", response_model=StockGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_group(
    company_id: str,
    data: StockGroupCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new stock group."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    group = service.create_stock_group(
        company=company,
        name=data.name,
        parent_id=data.parent_id,
        description=data.description,
    )
    return group


@router.get("/groups", response_model=List[StockGroupResponse])
async def list_stock_groups(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all stock groups."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    return service.get_stock_groups(company)


# ============== Godowns ==============

@router.post("/godowns", response_model=GodownResponse, status_code=status.HTTP_201_CREATED)
async def create_godown(
    company_id: str,
    data: GodownCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new godown/warehouse."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    godown = service.create_godown(
        company=company,
        name=data.name,
        code=data.code,
        address=data.address,
        parent_id=data.parent_id,
        is_default=data.is_default,
    )
    return godown


@router.get("/godowns", response_model=List[GodownResponse])
async def list_godowns(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all godowns."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    return service.get_godowns(company)


# ============== Stock Items ==============

@router.post("/items", response_model=StockItemResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_item(
    company_id: str,
    data: StockItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new stock item (product with inventory)."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    item = service.create_stock_item(
        company=company,
        name=data.name,
        code=data.sku,  # sku maps to code in service
        barcode=data.barcode,
        stock_group_id=data.stock_group_id,
        primary_unit=data.unit,  # unit maps to primary_unit
        hsn_code=data.hsn_code,
        gst_rate=Decimal(data.gst_rate),
        opening_stock=data.opening_stock,
        standard_cost=data.standard_cost,
        standard_selling_price=data.unit_price,  # unit_price maps to standard_selling_price
        min_stock_level=data.min_stock_level,
        enable_batch=data.enable_batch,
        enable_expiry=data.enable_expiry,
    )
    return item


@router.get("/items", response_model=List[StockItemResponse])
async def list_stock_items(
    company_id: str,
    group_id: Optional[str] = None,
    search: Optional[str] = None,
    low_stock: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List stock items with optional filters."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    return service.get_stock_items(
        company=company,
        stock_group_id=group_id,
        search=search,
        low_stock_only=low_stock,
    )


@router.get("/items/{item_id}", response_model=StockItemResponse)
async def get_stock_item(
    company_id: str,
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a stock item by ID."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    item = service.get_stock_item(item_id, company)
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    return item


@router.put("/items/{item_id}", response_model=StockItemResponse)
async def update_stock_item(
    company_id: str,
    item_id: str,
    data: StockItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a stock item."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    item = service.get_stock_item(item_id, company)
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    return service.update_stock_item(item, data.model_dump(exclude_unset=True))


# ============== Stock Movements ==============

@router.post("/stock-in", response_model=StockEntryResponse, status_code=status.HTTP_201_CREATED)
async def record_stock_in(
    company_id: str,
    data: StockInRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Record stock received (purchase, return, adjustment)."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    try:
        entry = service.record_stock_in(
            company=company,
            product_id=data.product_id,
            quantity=data.quantity,
            rate=data.rate,
            godown_id=data.godown_id,
            batch_id=data.batch_id,
            reference_number=data.reference_number,
            entry_date=data.entry_date,
            notes=data.notes,
        )
        return StockEntryResponse(
            id=entry.id,
            product_id=entry.product_id,
            godown_id=entry.godown_id,
            entry_date=entry.entry_date,
            movement_type=entry.movement_type.value,
            quantity=entry.quantity,
            unit=entry.unit,
            rate=entry.rate,
            value=entry.value,
            reference_number=entry.reference_number,
            notes=entry.notes,
            created_at=entry.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stock-out", response_model=StockEntryResponse, status_code=status.HTTP_201_CREATED)
async def record_stock_out(
    company_id: str,
    data: StockOutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Record stock issued (sale, consumption, adjustment)."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    try:
        entry = service.record_stock_out(
            company=company,
            product_id=data.product_id,
            quantity=data.quantity,
            rate=data.rate,
            godown_id=data.godown_id,
            batch_id=data.batch_id,
            reference_number=data.reference_number,
            entry_date=data.entry_date,
            notes=data.notes,
        )
        return StockEntryResponse(
            id=entry.id,
            product_id=entry.product_id,
            godown_id=entry.godown_id,
            entry_date=entry.entry_date,
            movement_type=entry.movement_type.value,
            quantity=entry.quantity,
            unit=entry.unit,
            rate=entry.rate,
            value=entry.value,
            reference_number=entry.reference_number,
            notes=entry.notes,
            created_at=entry.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transfer", status_code=status.HTTP_201_CREATED)
async def transfer_stock(
    company_id: str,
    data: StockTransferRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Transfer stock between godowns."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    try:
        out_entry, in_entry = service.transfer_stock(
            company=company,
            product_id=data.product_id,
            quantity=data.quantity,
            from_godown_id=data.from_godown_id,
            to_godown_id=data.to_godown_id,
            batch_id=data.batch_id,
            entry_date=data.entry_date,
            notes=data.notes,
        )
        return {"message": "Stock transferred successfully", "quantity": float(data.quantity)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/entries", response_model=List[StockEntryResponse])
async def list_stock_entries(
    company_id: str,
    item_id: Optional[str] = None,
    godown_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List stock entries with filters."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    from_dt = datetime.combine(from_date, datetime.min.time()) if from_date else None
    to_dt = datetime.combine(to_date, datetime.max.time()) if to_date else None
    
    entries = service.get_stock_entries(
        company=company,
        product_id=item_id,
        godown_id=godown_id,
        from_date=from_dt,
        to_date=to_dt,
        limit=limit,
    )
    
    return [
        StockEntryResponse(
            id=e.id,
            product_id=e.product_id,
            godown_id=e.godown_id,
            entry_date=e.entry_date,
            movement_type=e.movement_type.value,
            quantity=e.quantity,
            unit=e.unit,
            rate=e.rate,
            value=e.value,
            reference_number=e.reference_number,
            notes=e.notes,
            created_at=e.created_at,
        )
        for e in entries
    ]


# ============== Batches ==============

@router.post("/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    company_id: str,
    data: BatchCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new batch for a stock item."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    # Verify item belongs to company
    item = service.get_stock_item(data.product_id, company)
    if not item:
        raise HTTPException(status_code=404, detail="Product not found")
    
    batch = service.create_batch(
        product_id=data.product_id,
        batch_number=data.batch_number,
        manufacturing_date=data.manufacturing_date,
        expiry_date=data.expiry_date,
        quantity=data.quantity,
        cost_price=data.cost_price,
    )
    return batch


@router.get("/items/{item_id}/batches", response_model=List[BatchResponse])
async def list_batches(
    company_id: str,
    item_id: str,
    include_empty: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List batches for a stock item."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    item = service.get_stock_item(item_id, company)
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    return service.get_batches(item_id, include_empty=include_empty)


# ============== BOM ==============

@router.post("/bom", response_model=BOMResponse, status_code=status.HTTP_201_CREATED)
async def create_bom(
    company_id: str,
    data: BOMCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a Bill of Material."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    bom = service.create_bom(
        company=company,
        finished_item_id=data.finished_item_id,
        name=data.name,
        output_quantity=data.output_quantity,
        output_unit=data.output_unit,
        description=data.description,
        components=[c.model_dump() for c in data.components],
    )
    return bom


@router.get("/bom", response_model=List[BOMResponse])
async def list_boms(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all BOMs."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    return service.get_boms(company)


@router.post("/produce", response_model=StockEntryResponse, status_code=status.HTTP_201_CREATED)
async def produce_from_bom(
    company_id: str,
    data: ProductionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Produce finished goods using BOM (consumes raw materials)."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    try:
        entry = service.produce_from_bom(
            company=company,
            bom_id=data.bom_id,
            quantity=data.quantity,
            godown_id=data.godown_id,
            entry_date=data.entry_date,
        )
        return StockEntryResponse(
            id=entry.id,
            product_id=entry.product_id,
            godown_id=entry.godown_id,
            entry_date=entry.entry_date,
            movement_type=entry.movement_type.value,
            quantity=entry.quantity,
            unit=entry.unit,
            rate=entry.rate,
            value=entry.value,
            reference_number=entry.reference_number,
            notes=entry.notes,
            created_at=entry.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Reports ==============

@router.get("/summary", response_model=StockSummaryResponse)
async def get_stock_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get inventory summary statistics."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    return service.get_stock_summary(company)


@router.get("/valuation")
async def get_stock_valuation(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get stock valuation report."""
    company = get_company_or_404(company_id, current_user, db)
    service = InventoryService(db)
    
    valuation = service.get_stock_valuation(company)
    total_value = sum(item["value"] for item in valuation)
    
    return {
        "items": valuation,
        "total_value": total_value,
    }


@router.get("/stock-by-warehouse/{product_id}")
async def get_stock_by_warehouse(
    company_id: str,
    product_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get available stock for a product across all warehouses."""
    company = get_company_or_404(company_id, current_user, db)
    
    from app.services.stock_allocation_service import StockAllocationService
    service = StockAllocationService(db)
    
    warehouse_stock = service.get_available_stock_by_warehouse(product_id, company.id)
    
    return {
        "product_id": product_id,
        "warehouses": [
            {
                "godown_id": w["godown_id"],
                "godown_name": w["godown_name"],
                "quantity": float(w["quantity"])
            }
            for w in warehouse_stock
        ]
    }
