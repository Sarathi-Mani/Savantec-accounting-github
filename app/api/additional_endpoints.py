"""
Additional API Endpoints - Serial Numbers, Manufacturing, Price Levels, Period Locks, etc.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel
from io import BytesIO

from app.database.connection import get_db
from app.database.models import (
    User, Company, Product, SerialNumber, SerialNumberStatus,
    PriceLevel, ProductPrice, DiscountRule, DiscountType,
    ManufacturingOrder, ManufacturingOrderStatus,
    StockAdjustment, StockAdjustmentStatus, StockAdjustmentItem,
    PeriodLock, AuditLog, NarrationTemplate, Notification, NotificationType,
    BillOfMaterial, generate_uuid
)
from app.auth.dependencies import get_current_active_user

router = APIRouter(tags=["Additional Features"])


def get_company_or_404(company_id: str, user: User, db: Session) -> Company:
    """Get company or raise 404."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.user_id == user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ==================== SERIAL NUMBERS ====================

class SerialNumberCreate(BaseModel):
    product_id: str
    serial_number: str
    batch_id: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_rate: Optional[float] = None
    purchase_invoice_id: Optional[str] = None
    warranty_months: Optional[int] = None
    notes: Optional[str] = None


@router.get("/companies/{company_id}/serial-numbers")
async def list_serial_numbers(
    company_id: str,
    status: Optional[str] = None,
    product_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all serial numbers."""
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(SerialNumber).filter(SerialNumber.company_id == company_id)
    
    if status:
        try:
            query = query.filter(SerialNumber.status == SerialNumberStatus(status))
        except ValueError:
            pass
    
    if product_id:
        query = query.filter(SerialNumber.product_id == product_id)
    
    if search:
        query = query.filter(SerialNumber.serial_number.ilike(f"%{search}%"))
    
    serials = query.order_by(SerialNumber.created_at.desc()).limit(500).all()
    
    result = []
    for s in serials:
        product = db.query(Product).filter(Product.id == s.product_id).first()
        result.append({
            "id": s.id,
            "serial_number": s.serial_number,
            "product_id": s.product_id,
            "product_name": product.name if product else "Unknown",
            "status": s.status.value if s.status else "available",
            "purchase_date": s.purchase_date.isoformat() if s.purchase_date else None,
            "sales_date": s.sales_date.isoformat() if s.sales_date else None,
            "warranty_expiry": s.warranty_expiry.isoformat() if s.warranty_expiry else None,
            "customer_id": s.customer_id,
        })
    
    return result


@router.post("/companies/{company_id}/serial-numbers")
async def create_serial_number(
    company_id: str,
    data: SerialNumberCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new serial number."""
    get_company_or_404(company_id, current_user, db)
    
    # Check if serial already exists
    existing = db.query(SerialNumber).filter(
        SerialNumber.company_id == company_id,
        SerialNumber.serial_number == data.serial_number
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Serial number already exists")
    
    warranty_expiry = None
    if data.warranty_months and data.purchase_date:
        from dateutil.relativedelta import relativedelta
        warranty_expiry = data.purchase_date + relativedelta(months=data.warranty_months)
    
    serial = SerialNumber(
        id=generate_uuid(),
        company_id=company_id,
        product_id=data.product_id,
        serial_number=data.serial_number,
        batch_id=data.batch_id,
        purchase_date=data.purchase_date,
        purchase_rate=Decimal(str(data.purchase_rate)) if data.purchase_rate else None,
        purchase_invoice_id=data.purchase_invoice_id,
        warranty_expiry=warranty_expiry,
        notes=data.notes,
        status=SerialNumberStatus.AVAILABLE,
    )
    
    db.add(serial)
    db.commit()
    
    return {"id": serial.id, "serial_number": serial.serial_number}


@router.get("/companies/{company_id}/serial-numbers/summary")
async def serial_numbers_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get serial numbers summary."""
    get_company_or_404(company_id, current_user, db)
    
    total = db.query(SerialNumber).filter(SerialNumber.company_id == company_id).count()
    available = db.query(SerialNumber).filter(
        SerialNumber.company_id == company_id,
        SerialNumber.status == SerialNumberStatus.AVAILABLE
    ).count()
    sold = db.query(SerialNumber).filter(
        SerialNumber.company_id == company_id,
        SerialNumber.status == SerialNumberStatus.SOLD
    ).count()
    
    return {
        "total": total,
        "available": available,
        "sold": sold,
        "damaged": total - available - sold,
    }


# ==================== PRICE LEVELS ====================

class PriceLevelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    discount_percent: Optional[float] = 0
    markup_percent: Optional[float] = 0


@router.get("/companies/{company_id}/price-levels")
async def list_price_levels(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all price levels."""
    get_company_or_404(company_id, current_user, db)
    
    levels = db.query(PriceLevel).filter(
        PriceLevel.company_id == company_id,
        PriceLevel.is_active == True
    ).all()
    
    return [{
        "id": l.id,
        "name": l.name,
        "description": l.description,
        "discount_percent": float(l.discount_percent) if l.discount_percent else 0,
        "markup_percent": float(l.markup_percent) if l.markup_percent else 0,
        "is_default": l.is_default,
    } for l in levels]


@router.post("/companies/{company_id}/price-levels")
async def create_price_level(
    company_id: str,
    data: PriceLevelCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new price level."""
    get_company_or_404(company_id, current_user, db)
    
    level = PriceLevel(
        id=generate_uuid(),
        company_id=company_id,
        name=data.name,
        description=data.description,
        discount_percent=Decimal(str(data.discount_percent)) if data.discount_percent else Decimal("0"),
        markup_percent=Decimal(str(data.markup_percent)) if data.markup_percent else Decimal("0"),
    )
    
    db.add(level)
    db.commit()
    
    return {"id": level.id, "name": level.name}


# ==================== DISCOUNT RULES ====================

class DiscountRuleCreate(BaseModel):
    name: str
    discount_type: str = "percentage"
    discount_value: float
    min_quantity: Optional[float] = None
    max_quantity: Optional[float] = None
    valid_from: Optional[datetime] = None  # Maps to effective_from in model
    valid_to: Optional[datetime] = None  # Maps to effective_to in model
    product_id: Optional[str] = None
    category_id: Optional[str] = None


@router.get("/companies/{company_id}/discount-rules")
async def list_discount_rules(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all discount rules."""
    get_company_or_404(company_id, current_user, db)
    
    rules = db.query(DiscountRule).filter(
        DiscountRule.company_id == company_id,
        DiscountRule.is_active == True
    ).all()
    
    return [{
        "id": r.id,
        "name": r.name,
        "discount_type": r.discount_type.value if r.discount_type else "percentage",
        "discount_value": float(r.discount_value) if r.discount_value else 0,
        "min_quantity": float(r.min_quantity) if r.min_quantity else None,
        "max_quantity": float(r.max_quantity) if r.max_quantity else None,
        "valid_from": r.effective_from.isoformat() if r.effective_from else None,
        "valid_to": r.effective_to.isoformat() if r.effective_to else None,
        "is_active": r.is_active if r.is_active is not None else True,
    } for r in rules]


@router.post("/companies/{company_id}/discount-rules")
async def create_discount_rule(
    company_id: str,
    data: DiscountRuleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new discount rule."""
    get_company_or_404(company_id, current_user, db)
    
    rule = DiscountRule(
        id=generate_uuid(),
        company_id=company_id,
        name=data.name,
        discount_type=DiscountType(data.discount_type) if data.discount_type else DiscountType.PERCENTAGE,
        discount_value=Decimal(str(data.discount_value)),
        min_quantity=Decimal(str(data.min_quantity)) if data.min_quantity else None,
        max_quantity=Decimal(str(data.max_quantity)) if data.max_quantity else None,
        effective_from=data.valid_from,  # Map valid_from to effective_from
        effective_to=data.valid_to,  # Map valid_to to effective_to
        product_id=data.product_id,
        category_id=data.category_id,
    )
    
    db.add(rule)
    db.commit()
    
    return {"id": rule.id}


@router.get("/companies/{company_id}/discount-rules/{rule_id}")
async def get_discount_rule(
    company_id: str,
    rule_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a discount rule by ID."""
    get_company_or_404(company_id, current_user, db)
    
    rule = db.query(DiscountRule).filter(
        DiscountRule.id == rule_id,
        DiscountRule.company_id == company_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Discount rule not found")
    
    return {
        "id": rule.id,
        "name": rule.name,
        "discount_type": rule.discount_type.value if rule.discount_type else "percentage",
        "discount_value": float(rule.discount_value) if rule.discount_value else 0,
        "min_quantity": float(rule.min_quantity) if rule.min_quantity else None,
        "max_quantity": float(rule.max_quantity) if rule.max_quantity else None,
        "valid_from": rule.effective_from.isoformat() if rule.effective_from else None,
        "valid_to": rule.effective_to.isoformat() if rule.effective_to else None,
        "product_id": rule.product_id,
        "category_id": rule.category_id,
        "is_active": rule.is_active if rule.is_active is not None else True,
    }


@router.delete("/companies/{company_id}/discount-rules/{rule_id}")
async def delete_discount_rule(
    company_id: str,
    rule_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a discount rule."""
    get_company_or_404(company_id, current_user, db)
    
    rule = db.query(DiscountRule).filter(
        DiscountRule.id == rule_id,
        DiscountRule.company_id == company_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Discount rule not found")
    
    db.delete(rule)
    db.commit()
    
    return {"message": "Discount rule deleted successfully"}


# ==================== MANUFACTURING ORDERS ====================

@router.get("/companies/{company_id}/manufacturing-orders")
async def list_manufacturing_orders(
    company_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List manufacturing orders."""
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(ManufacturingOrder).filter(ManufacturingOrder.company_id == company_id)
    
    if status:
        try:
            query = query.filter(ManufacturingOrder.status == ManufacturingOrderStatus(status))
        except ValueError:
            pass
    
    orders = query.order_by(ManufacturingOrder.created_at.desc()).limit(100).all()
    
    result = []
    for o in orders:
        product = db.query(Product).filter(Product.id == o.finished_product_id).first()
        result.append({
            "id": o.id,
            "order_number": o.order_number,
            "finished_product_id": o.finished_product_id,
            "product_name": product.name if product else "Unknown",
            "planned_quantity": float(o.planned_quantity) if o.planned_quantity else 0,
            "produced_quantity": float(o.produced_quantity) if o.produced_quantity else 0,
            "status": o.status.value if o.status else "draft",
            "start_date": o.actual_start_date.isoformat() if o.actual_start_date else (o.planned_start_date.isoformat() if o.planned_start_date else None),
            "completion_date": o.actual_end_date.isoformat() if o.actual_end_date else (o.planned_end_date.isoformat() if o.planned_end_date else None),
        })
    
    return result


class ManufacturingOrderCreate(BaseModel):
    finished_product_id: str
    bom_id: Optional[str] = None
    planned_quantity: float
    order_date: Optional[datetime] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    production_godown_id: Optional[str] = None
    finished_goods_godown_id: Optional[str] = None
    notes: Optional[str] = None


@router.post("/companies/{company_id}/manufacturing-orders")
async def create_manufacturing_order(
    company_id: str,
    data: ManufacturingOrderCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a manufacturing/production order."""
    get_company_or_404(company_id, current_user, db)
    
    from app.services.manufacturing_service import ManufacturingService
    from decimal import Decimal
    
    service = ManufacturingService(db)
    
    order = service.create_order(
        company_id=company_id,
        finished_product_id=data.finished_product_id,
        planned_quantity=Decimal(str(data.planned_quantity)),
        bom_id=data.bom_id,
        order_date=data.order_date,
        planned_start_date=data.planned_start_date,
        planned_end_date=data.planned_end_date,
        production_godown_id=data.production_godown_id,
        finished_goods_godown_id=data.finished_goods_godown_id,
        notes=data.notes,
    )
    
    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status.value if order.status else "draft",
    }


# ==================== BILL OF MATERIALS ====================

@router.get("/companies/{company_id}/bill-of-materials")
async def list_bill_of_materials(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all bills of material."""
    get_company_or_404(company_id, current_user, db)
    
    boms = db.query(BillOfMaterial).filter(
        BillOfMaterial.company_id == company_id,
        BillOfMaterial.is_active == True
    ).all()
    
    result = []
    for b in boms:
        finished_item_id = getattr(b, 'finished_item_id', None)
        product = db.query(Product).filter(Product.id == finished_item_id).first() if finished_item_id else None
        result.append({
            "id": b.id,
            "bom_name": getattr(b, 'name', ''),
            "finished_product_name": product.name if product else "Unknown",
            "finished_item_id": finished_item_id,
            "quantity": float(b.output_quantity) if hasattr(b, 'output_quantity') and b.output_quantity else 1,
            "components_count": len(b.components) if hasattr(b, 'components') and b.components else 0,
            "total_cost": float(b.estimated_cost) if hasattr(b, 'estimated_cost') and b.estimated_cost else 0,
            "is_active": b.is_active if hasattr(b, 'is_active') else True,
        })
    
    return result


# ==================== STOCK VERIFICATION ====================

@router.get("/companies/{company_id}/stock-adjustments")
async def list_stock_adjustments(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List stock adjustments/verifications."""
    get_company_or_404(company_id, current_user, db)
    
    adjustments = db.query(StockAdjustment).filter(
        StockAdjustment.company_id == company_id
    ).order_by(StockAdjustment.created_at.desc()).limit(100).all()
    
    result = []
    for a in adjustments:
        item_count = db.query(StockAdjustmentItem).filter(
            StockAdjustmentItem.adjustment_id == a.id
        ).count()
        result.append({
            "id": a.id,
            "adjustment_number": a.adjustment_number,
            "adjustment_date": a.adjustment_date.isoformat() if a.adjustment_date else None,
            "godown_id": a.godown_id,
            "item_count": item_count,
            "total_variance_value": float(a.total_variance_value) if a.total_variance_value else 0,
            "status": a.status.value if a.status else "draft",
            "godown_name": None,  # Will be populated if needed
        })
    
    # Populate godown names
    for r in result:
        if r["godown_id"]:
            from app.database.models import Godown
            godown = db.query(Godown).filter(Godown.id == r["godown_id"]).first()
            if godown:
                r["godown_name"] = godown.name
    
    return result


@router.get("/companies/{company_id}/inventory/items/{product_id}/stock")
async def get_product_stock(
    company_id: str,
    product_id: str,
    godown_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current stock quantity for a product (optionally filtered by godown)."""
    get_company_or_404(company_id, current_user, db)
    
    from app.services.stock_verification_service import StockVerificationService
    from app.database.models import Product
    
    service = StockVerificationService(db)
    
    # Get stock quantity
    quantity = service._get_stock_quantity(company_id, product_id, godown_id)
    
    # Get product for rate
    product = db.query(Product).filter(Product.id == product_id).first()
    rate = 0
    if product:
        rate = float(product.standard_cost or product.unit_price or 0)
    
    return {
        "product_id": product_id,
        "quantity": float(quantity),
        "rate": rate,
        "godown_id": godown_id,
    }


class StockAdjustmentItemInput(BaseModel):
    product_id: str
    physical_quantity: float
    batch_id: Optional[str] = None
    reason: Optional[str] = None


class StockAdjustmentCreate(BaseModel):
    godown_id: Optional[str] = None
    adjustment_date: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    items: List[StockAdjustmentItemInput] = []


@router.post("/companies/{company_id}/stock-adjustments")
async def create_stock_adjustment(
    company_id: str,
    data: StockAdjustmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a stock adjustment/verification."""
    get_company_or_404(company_id, current_user, db)
    
    from app.services.stock_verification_service import StockVerificationService
    from decimal import Decimal
    
    service = StockVerificationService(db)
    
    adjustment = service.create_verification(
        company_id=company_id,
        godown_id=data.godown_id,
        adjustment_date=data.adjustment_date,
        reason=data.reason,
        notes=data.notes,
    )
    
    # Add items
    for item_data in data.items:
        service.add_item(
            adjustment_id=adjustment.id,
            product_id=item_data.product_id,
            physical_quantity=Decimal(str(item_data.physical_quantity)),
            batch_id=item_data.batch_id,
            reason=item_data.reason,
        )
    
    return {
        "id": adjustment.id,
        "adjustment_number": adjustment.adjustment_number,
        "status": adjustment.status.value if adjustment.status else "draft",
    }


@router.get("/companies/{company_id}/inventory/items/{product_id}/stock")
async def get_product_stock(
    company_id: str,
    product_id: str,
    godown_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current stock quantity for a product (optionally filtered by godown)."""
    get_company_or_404(company_id, current_user, db)
    
    from app.services.stock_verification_service import StockVerificationService
    from app.database.models import Product
    from sqlalchemy import func
    from app.database.models import StockEntry
    
    service = StockVerificationService(db)
    
    # Get stock quantity
    quantity = service._get_stock_quantity(company_id, product_id, godown_id)
    
    # Get product for rate
    product = db.query(Product).filter(Product.id == product_id).first()
    rate = 0
    if product:
        rate = float(product.standard_cost or product.unit_price or 0)
    
    return {
        "product_id": product_id,
        "quantity": float(quantity),
        "rate": rate,
        "godown_id": godown_id,
    }


# ==================== PERIOD LOCKS ====================

class PeriodLockCreate(BaseModel):
    locked_from: datetime
    locked_to: datetime
    voucher_types: Optional[List[str]] = None
    reason: Optional[str] = None


@router.get("/companies/{company_id}/period-locks")
async def list_period_locks(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all period locks."""
    get_company_or_404(company_id, current_user, db)
    
    locks = db.query(PeriodLock).filter(
        PeriodLock.company_id == company_id
    ).order_by(PeriodLock.locked_from.desc()).all()
    
    return [{
        "id": l.id,
        "locked_from": l.locked_from.isoformat() if l.locked_from else None,
        "locked_to": l.locked_to.isoformat() if l.locked_to else None,
        "voucher_types": l.voucher_types,
        "reason": l.reason,
        "is_active": l.is_active,
        "locked_by": l.locked_by,
    } for l in locks]


@router.post("/companies/{company_id}/period-locks")
async def create_period_lock(
    company_id: str,
    data: PeriodLockCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new period lock."""
    get_company_or_404(company_id, current_user, db)
    
    lock = PeriodLock(
        id=generate_uuid(),
        company_id=company_id,
        locked_from=data.locked_from,
        locked_to=data.locked_to,
        voucher_types=data.voucher_types,
        reason=data.reason,
        locked_by=current_user.id,
        is_active=True,
    )
    
    db.add(lock)
    db.commit()
    
    return {"id": lock.id}


@router.post("/companies/{company_id}/period-locks/{lock_id}/deactivate")
async def deactivate_period_lock(
    company_id: str,
    lock_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Deactivate a period lock."""
    get_company_or_404(company_id, current_user, db)
    
    lock = db.query(PeriodLock).filter(
        PeriodLock.id == lock_id,
        PeriodLock.company_id == company_id
    ).first()
    
    if not lock:
        raise HTTPException(status_code=404, detail="Period lock not found")
    
    lock.is_active = False
    db.commit()
    
    return {"status": "deactivated"}


# ==================== AUDIT LOG ====================

@router.get("/companies/{company_id}/audit-logs")
async def list_audit_logs(
    company_id: str,
    table_name: Optional[str] = None,
    action: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List audit logs."""
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(AuditLog).filter(AuditLog.company_id == company_id)
    
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if action:
        query = query.filter(AuditLog.action == action)
    if from_date:
        query = query.filter(AuditLog.changed_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.filter(AuditLog.changed_at <= datetime.combine(to_date, datetime.max.time()))
    
    logs = query.order_by(AuditLog.changed_at.desc()).limit(limit).all()
    
    return [{
        "id": l.id,
        "table_name": l.table_name,
        "record_id": l.record_id,
        "action": l.action,
        "changed_fields": l.changed_fields or [],
        "old_values": l.old_values,
        "new_values": l.new_values,
        "user_id": l.changed_by,
        "user_name": l.changed_by_name or "System",
        "timestamp": l.changed_at.isoformat() if l.changed_at else None,
        "ip_address": l.ip_address or "",
    } for l in logs]


# ==================== NARRATION TEMPLATES ====================

class NarrationTemplateCreate(BaseModel):
    name: str
    voucher_type: str
    template_text: str


@router.get("/companies/{company_id}/narration-templates")
async def list_narration_templates(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all narration templates."""
    get_company_or_404(company_id, current_user, db)
    
    templates = db.query(NarrationTemplate).filter(
        NarrationTemplate.company_id == company_id,
        NarrationTemplate.is_active == True
    ).all()
    
    return [{
        "id": t.id,
        "name": t.name,
        "voucher_type": t.voucher_type,
        "template_text": t.template_text,
    } for t in templates]


@router.post("/companies/{company_id}/narration-templates")
async def create_narration_template(
    company_id: str,
    data: NarrationTemplateCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new narration template."""
    get_company_or_404(company_id, current_user, db)
    
    template = NarrationTemplate(
        id=generate_uuid(),
        company_id=company_id,
        name=data.name,
        voucher_type=data.voucher_type,
        template_text=data.template_text,
    )
    
    db.add(template)
    db.commit()
    
    return {"id": template.id}


# ==================== NOTIFICATIONS ====================

@router.get("/companies/{company_id}/notifications")
async def list_notifications(
    company_id: str,
    is_read: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List notifications."""
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(Notification).filter(
        Notification.company_id == company_id,
        Notification.user_id == current_user.id
    )
    
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    
    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
    
    return [{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "notification_type": n.notification_type.value if n.notification_type else "info",
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    } for n in notifications]


@router.post("/companies/{company_id}/notifications/{notification_id}/read")
async def mark_notification_read(
    company_id: str,
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read."""
    get_company_or_404(company_id, current_user, db)
    
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.company_id == company_id
    ).first()
    
    if notification:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
    
    return {"status": "read"}


@router.post("/companies/{company_id}/notifications/read-all")
async def mark_all_notifications_read(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read."""
    get_company_or_404(company_id, current_user, db)
    
    db.query(Notification).filter(
        Notification.company_id == company_id,
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True, "read_at": datetime.utcnow()})
    
    db.commit()
    
    return {"status": "all_read"}


# ==================== RECURRING TRANSACTIONS ====================

class RecurringTransactionCreate(BaseModel):
    name: str
    voucher_type: str  # payment, receipt, journal, contra
    amount: float
    frequency: str  # daily, weekly, biweekly, monthly, quarterly, half_yearly, yearly
    start_date: datetime
    end_date: Optional[datetime] = None
    party_id: Optional[str] = None
    party_type: Optional[str] = None  # customer, vendor
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    total_occurrences: Optional[int] = None
    auto_create: Optional[bool] = True
    reminder_days: Optional[int] = 3
    description: Optional[str] = None
    template_data: Optional[dict] = None
    # Account mapping fields
    category: Optional[str] = None  # rent, utilities, subscription, etc.
    debit_account_id: Optional[str] = None
    credit_account_id: Optional[str] = None


class RecurringTransactionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    end_date: Optional[datetime] = None
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    auto_create: Optional[bool] = None
    reminder_days: Optional[int] = None
    description: Optional[str] = None
    # Account mapping fields
    category: Optional[str] = None
    debit_account_id: Optional[str] = None
    credit_account_id: Optional[str] = None
    frequency: Optional[str] = None
    total_occurrences: Optional[int] = None
    description: Optional[str] = None


@router.get("/companies/{company_id}/recurring-transactions")
async def list_recurring_transactions(
    company_id: str,
    active_only: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List recurring transactions."""
    from app.database.models import RecurringTransaction, Account
    
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(RecurringTransaction).filter(
        RecurringTransaction.company_id == company_id
    )
    
    if active_only:
        query = query.filter(RecurringTransaction.is_active == True)
    
    transactions = query.order_by(RecurringTransaction.next_date.asc()).all()
    
    result = []
    for t in transactions:
        # Get account names
        debit_account_name = None
        credit_account_name = None
        if t.debit_account_id:
            debit_acc = db.query(Account).filter(Account.id == t.debit_account_id).first()
            if debit_acc:
                debit_account_name = f"{debit_acc.code} - {debit_acc.name}"
        if t.credit_account_id:
            credit_acc = db.query(Account).filter(Account.id == t.credit_account_id).first()
            if credit_acc:
                credit_account_name = f"{credit_acc.code} - {credit_acc.name}"
        
        result.append({
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "voucher_type": t.voucher_type.value if t.voucher_type else None,
            "amount": float(t.amount) if t.amount else 0,
            "frequency": t.frequency.value if t.frequency else None,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "next_date": t.next_date.isoformat() if t.next_date else None,
            "day_of_month": t.day_of_month,
            "day_of_week": t.day_of_week,
            "occurrences_created": t.occurrences_created,
            "total_occurrences": t.total_occurrences,
            "auto_create": t.auto_create,
            "is_active": t.is_active,
            "last_created_at": t.last_created_at.isoformat() if t.last_created_at else None,
            "category": t.category,
            "debit_account_id": t.debit_account_id,
            "debit_account_name": debit_account_name,
            "credit_account_id": t.credit_account_id,
            "credit_account_name": credit_account_name,
            "last_transaction_id": t.last_transaction_id,
        })
    
    return result


@router.post("/companies/{company_id}/recurring-transactions", status_code=status.HTTP_201_CREATED)
async def create_recurring_transaction(
    company_id: str,
    data: RecurringTransactionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new recurring transaction."""
    from app.services.recurring_transaction_service import RecurringTransactionService
    from app.database.models import VoucherType, RecurringFrequency
    
    get_company_or_404(company_id, current_user, db)
    
    service = RecurringTransactionService(db)
    
    try:
        voucher_type = VoucherType(data.voucher_type)
        frequency = RecurringFrequency(data.frequency)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid enum value: {str(e)}")
    
    recurring = service.create_recurring(
        company_id=company_id,
        name=data.name,
        voucher_type=voucher_type,
        amount=Decimal(str(data.amount)),
        frequency=frequency,
        start_date=data.start_date,
        end_date=data.end_date,
        template_data=data.template_data,
        party_id=data.party_id,
        party_type=data.party_type,
        day_of_month=data.day_of_month,
        day_of_week=data.day_of_week,
        total_occurrences=data.total_occurrences,
        auto_create=data.auto_create,
        reminder_days=data.reminder_days,
        description=data.description,
        category=data.category,
        debit_account_id=data.debit_account_id,
        credit_account_id=data.credit_account_id,
    )
    
    return {
        "id": recurring.id,
        "name": recurring.name,
        "next_date": recurring.next_date.isoformat() if recurring.next_date else None,
        "category": recurring.category,
        "debit_account_id": recurring.debit_account_id,
        "credit_account_id": recurring.credit_account_id,
        "message": "Recurring transaction created successfully"
    }


@router.get("/companies/{company_id}/recurring-transactions/{recurring_id}")
async def get_recurring_transaction(
    company_id: str,
    recurring_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a single recurring transaction."""
    from app.database.models import RecurringTransaction, Account
    
    get_company_or_404(company_id, current_user, db)
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.company_id == company_id
    ).first()
    
    if not recurring:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    # Get account names
    debit_account_name = None
    credit_account_name = None
    if recurring.debit_account_id:
        debit_acc = db.query(Account).filter(Account.id == recurring.debit_account_id).first()
        if debit_acc:
            debit_account_name = f"{debit_acc.code} - {debit_acc.name}"
    if recurring.credit_account_id:
        credit_acc = db.query(Account).filter(Account.id == recurring.credit_account_id).first()
        if credit_acc:
            credit_account_name = f"{credit_acc.code} - {credit_acc.name}"
    
    return {
        "id": recurring.id,
        "name": recurring.name,
        "description": recurring.description,
        "voucher_type": recurring.voucher_type.value if recurring.voucher_type else None,
        "amount": float(recurring.amount) if recurring.amount else 0,
        "frequency": recurring.frequency.value if recurring.frequency else None,
        "start_date": recurring.start_date.isoformat() if recurring.start_date else None,
        "end_date": recurring.end_date.isoformat() if recurring.end_date else None,
        "next_date": recurring.next_date.isoformat() if recurring.next_date else None,
        "day_of_month": recurring.day_of_month,
        "day_of_week": recurring.day_of_week,
        "occurrences_created": recurring.occurrences_created,
        "category": recurring.category,
        "debit_account_id": recurring.debit_account_id,
        "debit_account_name": debit_account_name,
        "credit_account_id": recurring.credit_account_id,
        "credit_account_name": credit_account_name,
        "last_transaction_id": recurring.last_transaction_id,
        "total_occurrences": recurring.total_occurrences,
        "auto_create": recurring.auto_create,
        "reminder_days": recurring.reminder_days,
        "is_active": recurring.is_active,
        "last_created_at": recurring.last_created_at.isoformat() if recurring.last_created_at else None,
        "template_data": recurring.template_data,
        "party_id": recurring.party_id,
        "party_type": recurring.party_type,
    }


@router.put("/companies/{company_id}/recurring-transactions/{recurring_id}")
async def update_recurring_transaction(
    company_id: str,
    recurring_id: str,
    data: RecurringTransactionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a recurring transaction."""
    from app.database.models import RecurringTransaction
    
    get_company_or_404(company_id, current_user, db)
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.company_id == company_id
    ).first()
    
    if not recurring:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    # Update fields
    from app.database.models import RecurringFrequency
    
    if data.name is not None:
        recurring.name = data.name
    if data.amount is not None:
        recurring.amount = Decimal(str(data.amount))
    if data.end_date is not None:
        recurring.end_date = data.end_date
    if data.day_of_month is not None:
        recurring.day_of_month = data.day_of_month
    if data.day_of_week is not None:
        recurring.day_of_week = data.day_of_week
    if data.auto_create is not None:
        recurring.auto_create = data.auto_create
    if data.reminder_days is not None:
        recurring.reminder_days = data.reminder_days
    if data.description is not None:
        recurring.description = data.description
    # New account mapping fields
    if data.category is not None:
        recurring.category = data.category
    if data.debit_account_id is not None:
        recurring.debit_account_id = data.debit_account_id
    if data.credit_account_id is not None:
        recurring.credit_account_id = data.credit_account_id
    if data.frequency is not None:
        recurring.frequency = RecurringFrequency(data.frequency)
    if data.total_occurrences is not None:
        recurring.total_occurrences = data.total_occurrences
    
    db.commit()
    db.refresh(recurring)
    
    return {"id": recurring.id, "message": "Recurring transaction updated successfully"}


@router.delete("/companies/{company_id}/recurring-transactions/{recurring_id}")
async def delete_recurring_transaction(
    company_id: str,
    recurring_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a recurring transaction."""
    from app.services.recurring_transaction_service import RecurringTransactionService
    from app.database.models import RecurringTransaction
    
    get_company_or_404(company_id, current_user, db)
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.company_id == company_id
    ).first()
    
    if not recurring:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    service = RecurringTransactionService(db)
    service.delete_recurring(recurring_id)
    
    return {"message": "Recurring transaction deleted successfully"}


@router.post("/companies/{company_id}/recurring-transactions/{recurring_id}/pause")
async def pause_recurring_transaction(
    company_id: str,
    recurring_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Pause a recurring transaction."""
    from app.services.recurring_transaction_service import RecurringTransactionService
    from app.database.models import RecurringTransaction
    
    get_company_or_404(company_id, current_user, db)
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.company_id == company_id
    ).first()
    
    if not recurring:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    service = RecurringTransactionService(db)
    service.pause_recurring(recurring_id)
    
    return {"message": "Recurring transaction paused", "is_active": False}


@router.post("/companies/{company_id}/recurring-transactions/{recurring_id}/resume")
async def resume_recurring_transaction(
    company_id: str,
    recurring_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Resume a paused recurring transaction."""
    from app.services.recurring_transaction_service import RecurringTransactionService
    from app.database.models import RecurringTransaction
    
    get_company_or_404(company_id, current_user, db)
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.company_id == company_id
    ).first()
    
    if not recurring:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    service = RecurringTransactionService(db)
    result = service.resume_recurring(recurring_id)
    
    return {
        "message": "Recurring transaction resumed",
        "is_active": True,
        "next_date": result.next_date.isoformat() if result.next_date else None
    }


@router.post("/companies/{company_id}/recurring-transactions/process-due")
async def process_due_recurring_transactions(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Process all due recurring transactions (create the actual vouchers)."""
    from app.services.recurring_transaction_service import RecurringTransactionService
    
    get_company_or_404(company_id, current_user, db)
    
    service = RecurringTransactionService(db)
    result = service.process_all_due(company_id)
    
    return result


# ==================== DELIVERY NOTES ====================

@router.get("/companies/{company_id}/delivery-notes")
async def list_delivery_notes(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List delivery notes."""
    from app.database.models import DeliveryNote
    
    get_company_or_404(company_id, current_user, db)
    
    notes = db.query(DeliveryNote).filter(
        DeliveryNote.company_id == company_id
    ).order_by(DeliveryNote.delivery_date.desc()).limit(100).all()
    
    from app.database.models import Customer, SalesOrder
    
    result = []
    for n in notes:
        status_val = "draft"
        if hasattr(n, 'status') and n.status:
            status_val = n.status.value if hasattr(n.status, 'value') else str(n.status)
        
        # Get customer name
        customer_name = ""
        if n.customer_id:
            customer = db.query(Customer).filter(Customer.id == n.customer_id).first()
            if customer:
                customer_name = customer.name
        
        # Get sales order number
        sales_order_number = ""
        if n.sales_order_id:
            sales_order = db.query(SalesOrder).filter(SalesOrder.id == n.sales_order_id).first()
            if sales_order:
                sales_order_number = sales_order.order_number
        
        result.append({
            "id": n.id,
            "delivery_number": getattr(n, 'delivery_number', ''),
            "delivery_date": n.delivery_date.isoformat() if hasattr(n, 'delivery_date') and n.delivery_date else None,
            "customer_id": getattr(n, 'customer_id', None),
            "customer_name": customer_name,
            "sales_order_id": getattr(n, 'sales_order_id', None),
            "sales_order_number": sales_order_number,
            "total_items": len(n.items) if hasattr(n, 'items') and n.items else 0,
            "status": status_val,
        })
    
    return result


# ==================== RECEIPT NOTES ====================

@router.get("/companies/{company_id}/receipt-notes")
async def list_receipt_notes(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List receipt notes (GRN)."""
    from app.database.models import ReceiptNote
    
    get_company_or_404(company_id, current_user, db)
    
    notes = db.query(ReceiptNote).filter(
        ReceiptNote.company_id == company_id
    ).order_by(ReceiptNote.receipt_date.desc()).limit(100).all()
    
    from app.database.models import Customer, PurchaseOrder
    
    result = []
    for n in notes:
        status_val = "draft"
        if hasattr(n, 'status') and n.status:
            status_val = n.status.value if hasattr(n.status, 'value') else str(n.status)
        
        # Get vendor name
        vendor_name = ""
        if n.vendor_id:
            vendor = db.query(Customer).filter(Customer.id == n.vendor_id).first()
            if vendor:
                vendor_name = vendor.name
        
        # Get purchase order number
        purchase_order_number = ""
        if n.purchase_order_id:
            po = db.query(PurchaseOrder).filter(PurchaseOrder.id == n.purchase_order_id).first()
            if po:
                purchase_order_number = po.order_number
        
        result.append({
            "id": n.id,
            "receipt_number": getattr(n, 'receipt_number', ''),
            "receipt_date": n.receipt_date.isoformat() if hasattr(n, 'receipt_date') and n.receipt_date else None,
            "vendor_id": getattr(n, 'vendor_id', None),
            "vendor_name": vendor_name,
            "purchase_order_id": getattr(n, 'purchase_order_id', None),
            "purchase_order_number": purchase_order_number,
            "total_items": len(n.items) if hasattr(n, 'items') and n.items else 0,
            "status": status_val,
        })
    
    return result


# ==================== CREDIT NOTES ====================

class CreditNoteItemCreate(BaseModel):
    invoice_item_id: Optional[str] = None
    description: str
    quantity: float
    unit_price: float
    gst_rate: float = 0
    
class CreditNoteCreate(BaseModel):
    original_invoice_id: str
    note_date: Optional[datetime] = None
    reason: str
    items: List[CreditNoteItemCreate]


@router.get("/companies/{company_id}/credit-notes")
async def list_credit_notes(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List credit notes - invoices with status 'refunded' or marked as credit notes."""
    from app.database.models import Invoice, Customer
    
    get_company_or_404(company_id, current_user, db)
    
    # Get invoices that are credit notes (refunded invoices)
    invoices = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.status == 'refunded'
    ).order_by(Invoice.invoice_date.desc()).limit(100).all()
    
    result = []
    for inv in invoices:
        customer_name = ""
        if inv.customer_id:
            customer = db.query(Customer).filter(Customer.id == inv.customer_id).first()
            customer_name = customer.name if customer else ""
        
        result.append({
            "id": inv.id,
            "note_number": f"CN-{inv.invoice_number}",
            "note_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "customer_name": customer_name,
            "original_invoice": inv.invoice_number,
            "total_amount": float(inv.total_amount or 0),
            "reason": inv.notes or "Refund",
        })
    
    return result


@router.post("/companies/{company_id}/credit-notes", status_code=status.HTTP_201_CREATED)
async def create_credit_note(
    company_id: str,
    data: CreditNoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a credit note for a sales return.
    
    This creates accounting entries to reverse the original sale:
    - Debits Sales (reduces revenue)
    - Debits Output GST (reduces liability)
    - Credits Accounts Receivable (reduces what customer owes)
    """
    from app.database.models import Invoice, Customer
    from app.services.voucher_engine import VoucherEngine
    
    company = get_company_or_404(company_id, current_user, db)
    
    # Get the original invoice
    original_invoice = db.query(Invoice).filter(
        Invoice.id == data.original_invoice_id,
        Invoice.company_id == company_id
    ).first()
    
    if not original_invoice:
        raise HTTPException(status_code=404, detail="Original invoice not found")
    
    if original_invoice.status == 'refunded':
        raise HTTPException(status_code=400, detail="Invoice has already been refunded")
    
    # Calculate return amounts
    return_items = []
    total_taxable = Decimal("0")
    total_gst = Decimal("0")
    
    for item in data.items:
        taxable_amount = Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        gst_amount = taxable_amount * Decimal(str(item.gst_rate)) / Decimal("100")
        
        return_items.append({
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "taxable_amount": float(taxable_amount),
            "gst_amount": float(gst_amount),
            "gst_rate": item.gst_rate,
        })
        total_taxable += taxable_amount
        total_gst += gst_amount
    
    # Create voucher using VoucherEngine
    voucher_engine = VoucherEngine(db)
    
    try:
        result = voucher_engine.create_credit_note(
            company=company,
            original_invoice=original_invoice,
            return_items=return_items,
            voucher_date=data.note_date or datetime.utcnow(),
            reason=data.reason,
        )
        
        # Update original invoice status
        original_invoice.status = 'refunded'
        original_invoice.notes = (original_invoice.notes or "") + f"\nRefunded: {data.reason}"
        db.commit()
        
        # Get customer name
        customer_name = ""
        if original_invoice.customer_id:
            customer = db.query(Customer).filter(Customer.id == original_invoice.customer_id).first()
            customer_name = customer.name if customer else ""
        
        return {
            "id": result.voucher_id,
            "note_number": result.voucher_number,
            "note_date": (data.note_date or datetime.utcnow()).isoformat(),
            "customer_name": customer_name,
            "original_invoice_id": original_invoice.id,
            "original_invoice_number": original_invoice.invoice_number,
            "taxable_amount": float(total_taxable),
            "gst_amount": float(total_gst),
            "total_amount": float(total_taxable + total_gst),
            "reason": data.reason,
            "items": return_items,
            "message": "Credit note created successfully",
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ==================== DEBIT NOTES ====================

class DebitNoteItemCreate(BaseModel):
    purchase_item_id: Optional[str] = None
    description: str
    quantity: float
    unit_price: float
    gst_rate: float = 0


class DebitNoteCreate(BaseModel):
    original_invoice_id: str
    note_date: Optional[datetime] = None
    reason: str
    items: List[DebitNoteItemCreate]


@router.get("/companies/{company_id}/debit-notes")
async def list_debit_notes(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List debit notes - purchase invoices with status 'refunded' or marked as debit notes."""
    from app.database.models import PurchaseInvoice, Vendor
    
    get_company_or_404(company_id, current_user, db)
    
    # Get purchase invoices that are debit notes (refunded/returned purchases)
    purchases = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.company_id == company_id,
        PurchaseInvoice.status == 'refunded'
    ).order_by(PurchaseInvoice.invoice_date.desc()).limit(100).all()
    
    result = []
    for p in purchases:
        vendor_name = ""
        if p.vendor_id:
            vendor = db.query(Vendor).filter(Vendor.id == p.vendor_id).first()
            vendor_name = vendor.name if vendor else ""
        
        result.append({
            "id": p.id,
            "note_number": f"DN-{p.invoice_number}",
            "note_date": p.invoice_date.isoformat() if p.invoice_date else None,
            "vendor_name": vendor_name,
            "original_invoice": p.vendor_invoice_number or p.invoice_number,
            "total_amount": float(p.total_amount or 0),
            "reason": p.notes or "Purchase Return",
        })
    
    return result


@router.post("/companies/{company_id}/debit-notes", status_code=status.HTTP_201_CREATED)
async def create_debit_note(
    company_id: str,
    data: DebitNoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a debit note for a purchase return.
    
    This creates accounting entries to reverse the original purchase:
    - Debits Accounts Payable (reduces what we owe vendor)
    - Credits Purchases (reduces expense)
    - Credits Input GST (reduces ITC claim)
    """
    from app.database.models import PurchaseInvoice, Vendor
    from app.services.voucher_engine import VoucherEngine
    
    company = get_company_or_404(company_id, current_user, db)
    
    # Get the original purchase invoice
    original_invoice = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.id == data.original_invoice_id,
        PurchaseInvoice.company_id == company_id
    ).first()
    
    if not original_invoice:
        raise HTTPException(status_code=404, detail="Original purchase invoice not found")
    
    if original_invoice.status == 'refunded':
        raise HTTPException(status_code=400, detail="Purchase invoice has already been refunded")
    
    # Calculate return amounts
    return_items = []
    total_taxable = Decimal("0")
    total_gst = Decimal("0")
    
    for item in data.items:
        taxable_amount = Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
        gst_amount = taxable_amount * Decimal(str(item.gst_rate)) / Decimal("100")
        
        return_items.append({
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "taxable_amount": float(taxable_amount),
            "gst_amount": float(gst_amount),
            "gst_rate": item.gst_rate,
        })
        total_taxable += taxable_amount
        total_gst += gst_amount
    
    # Create voucher using VoucherEngine
    voucher_engine = VoucherEngine(db)
    
    try:
        result = voucher_engine.create_debit_note(
            company=company,
            original_invoice=original_invoice,
            return_items=return_items,
            voucher_date=data.note_date or datetime.utcnow(),
            reason=data.reason,
        )
        
        # Update original invoice status
        original_invoice.status = 'refunded'
        original_invoice.notes = (original_invoice.notes or "") + f"\nReturned: {data.reason}"
        db.commit()
        
        # Get vendor name
        vendor_name = ""
        if original_invoice.vendor_id:
            vendor = db.query(Vendor).filter(Vendor.id == original_invoice.vendor_id).first()
            vendor_name = vendor.name if vendor else ""
        
        return {
            "id": result.voucher_id,
            "note_number": result.voucher_number,
            "note_date": (data.note_date or datetime.utcnow()).isoformat(),
            "vendor_name": vendor_name,
            "original_invoice_id": original_invoice.id,
            "original_invoice_number": original_invoice.vendor_invoice_number or original_invoice.invoice_number,
            "taxable_amount": float(total_taxable),
            "gst_amount": float(total_gst),
            "total_amount": float(total_taxable + total_gst),
            "reason": data.reason,
            "items": return_items,
            "message": "Debit note created successfully",
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ==================== BUDGETS ====================

@router.get("/companies/{company_id}/budgets")
async def list_budgets(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List budgets."""
    from app.database.models import BudgetMaster
    
    get_company_or_404(company_id, current_user, db)
    
    budgets = db.query(BudgetMaster).filter(
        BudgetMaster.company_id == company_id
    ).order_by(BudgetMaster.created_at.desc()).all()
    
    result = []
    for b in budgets:
        total_budgeted = float(b.total_budgeted) if hasattr(b, 'total_budgeted') and b.total_budgeted else 0
        total_actual = float(b.total_actual) if hasattr(b, 'total_actual') and b.total_actual else 0
        period_val = "annual"
        if hasattr(b, 'period') and b.period:
            period_val = b.period.value if hasattr(b.period, 'value') else str(b.period)
        status_val = "draft"
        if hasattr(b, 'status') and b.status:
            status_val = b.status.value if hasattr(b.status, 'value') else str(b.status)
        
        result.append({
            "id": b.id,
            "name": getattr(b, 'name', ''),
            "financial_year": getattr(b, 'financial_year', ''),
            "period": period_val,
            "total_budgeted": total_budgeted,
            "total_actual": total_actual,
            "variance": total_budgeted - total_actual,
            "status": status_val,
        })
    
    return result


# ==================== REORDER REPORT ====================

@router.get("/companies/{company_id}/inventory/reorder-report")
async def reorder_report(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get items that need reordering."""
    get_company_or_404(company_id, current_user, db)
    
    # Get products where current stock is at or below reorder level
    products = db.query(Product).filter(
        Product.company_id == company_id,
        Product.is_active == True,
        Product.reorder_level != None,
        Product.current_stock <= Product.reorder_level
    ).all()
    
    return [{
        "id": p.id,
        "product_name": p.name,
        "sku": p.sku,
        "current_stock": float(p.current_stock) if p.current_stock else 0,
        "reorder_level": float(p.reorder_level) if p.reorder_level else 0,
        "reorder_quantity": float(p.reorder_quantity) if p.reorder_quantity else 0,
        "maximum_level": float(p.maximum_stock_level) if hasattr(p, 'maximum_stock_level') and p.maximum_stock_level else 0,
        "supplier_name": "",  # Would need vendor relationship
        "last_purchase_rate": float(p.standard_cost) if p.standard_cost else 0,
    } for p in products]


# ==================== OUTSTANDING SUMMARY ====================

@router.get("/companies/{company_id}/reports/outstanding-summary")
async def outstanding_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get outstanding receivables and payables summary."""
    from app.database.models import Invoice, PurchaseInvoice
    from sqlalchemy import func
    
    get_company_or_404(company_id, current_user, db)
    
    # Receivables
    receivables = db.query(
        func.sum(Invoice.outstanding_amount)
    ).filter(
        Invoice.company_id == company_id,
        Invoice.outstanding_amount > 0
    ).scalar() or 0
    
    receivables_count = db.query(
        func.count(Invoice.id)
    ).filter(
        Invoice.company_id == company_id,
        Invoice.outstanding_amount > 0
    ).scalar() or 0
    
    overdue_receivables = db.query(
        func.sum(Invoice.outstanding_amount)
    ).filter(
        Invoice.company_id == company_id,
        Invoice.outstanding_amount > 0,
        Invoice.due_date < datetime.utcnow()
    ).scalar() or 0
    
    # Payables
    payables = db.query(
        func.sum(PurchaseInvoice.outstanding_amount)
    ).filter(
        PurchaseInvoice.company_id == company_id,
        PurchaseInvoice.outstanding_amount > 0
    ).scalar() or 0
    
    payables_count = db.query(
        func.count(PurchaseInvoice.id)
    ).filter(
        PurchaseInvoice.company_id == company_id,
        PurchaseInvoice.outstanding_amount > 0
    ).scalar() or 0
    
    overdue_payables = db.query(
        func.sum(PurchaseInvoice.outstanding_amount)
    ).filter(
        PurchaseInvoice.company_id == company_id,
        PurchaseInvoice.outstanding_amount > 0,
        PurchaseInvoice.due_date < datetime.utcnow()
    ).scalar() or 0
    
    return {
        "receivables": {
            "total": float(receivables),
            "count": receivables_count,
            "overdue": float(overdue_receivables),
        },
        "payables": {
            "total": float(payables),
            "count": payables_count,
            "overdue": float(overdue_payables),
        },
        "net_position": float(receivables - payables),
    }


# ==================== STOCK VALUATION REPORT ====================

@router.get("/companies/{company_id}/reports/stock-valuation")
async def stock_valuation_report(
    company_id: str,
    method: str = "average",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get stock valuation report."""
    get_company_or_404(company_id, current_user, db)
    
    products = db.query(Product).filter(
        Product.company_id == company_id,
        Product.is_active == True,
        Product.current_stock > 0
    ).all()
    
    items = []
    total_value = Decimal("0")
    
    for p in products:
        rate = p.standard_cost or p.unit_price or Decimal("0")
        value = (p.current_stock or Decimal("0")) * rate
        total_value += value
        
        items.append({
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "quantity": float(p.current_stock) if p.current_stock else 0,
            "rate": float(rate),
            "value": float(value),
        })
    
    return {
        "method": method,
        "items": items,
        "total_value": float(total_value),
    }


# ==================== STOCK MOVEMENT REPORT ====================

@router.get("/companies/{company_id}/reports/stock-movement")
async def stock_movement_report(
    company_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get stock movement analysis."""
    from app.database.models import StockEntry, StockMovementType
    from sqlalchemy import func
    
    get_company_or_404(company_id, current_user, db)
    
    products = db.query(Product).filter(
        Product.company_id == company_id,
        Product.is_active == True
    ).limit(100).all()
    
    result = []
    for p in products:
        # Get movements
        query = db.query(StockEntry).filter(StockEntry.product_id == p.id)
        
        if from_date:
            query = query.filter(StockEntry.entry_date >= datetime.combine(from_date, datetime.min.time()))
        if to_date:
            query = query.filter(StockEntry.entry_date <= datetime.combine(to_date, datetime.max.time()))
        
        entries = query.all()
        
        opening = p.opening_stock or Decimal("0")
        purchases = sum(e.quantity for e in entries if e.movement_type == StockMovementType.PURCHASE)
        sales = sum(e.quantity for e in entries if e.movement_type == StockMovementType.SALE)
        adjustments = sum(e.quantity for e in entries if e.movement_type in [StockMovementType.ADJUSTMENT, StockMovementType.PRODUCTION])
        closing = opening + purchases - sales + adjustments
        
        result.append({
            "id": p.id,
            "product_name": p.name,
            "sku": p.sku,
            "opening": float(opening),
            "purchased": float(purchases),
            "sold": float(sales),
            "adjusted": float(adjustments),
            "closing": float(closing),
        })
    
    return {"items": result}


# ==================== SALES ANALYSIS ====================

@router.get("/companies/{company_id}/reports/sales-analysis")
async def sales_analysis_report(
    company_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get sales analysis summary."""
    from app.database.models import Invoice, InvoiceItem, Customer
    from sqlalchemy import func
    
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.status != 'cancelled'
    )
    
    if from_date:
        query = query.filter(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.filter(Invoice.invoice_date <= to_date)
    
    invoices = query.all()
    
    total_sales = sum(float(i.total_amount or 0) for i in invoices)
    total_gst = sum(float(i.total_tax or 0) for i in invoices)
    invoice_count = len(invoices)
    avg_invoice = total_sales / invoice_count if invoice_count > 0 else 0
    
    # Top customers
    customer_sales = {}
    for inv in invoices:
        if inv.customer_id:
            customer_sales[inv.customer_id] = customer_sales.get(inv.customer_id, 0) + float(inv.total_amount or 0)
    
    top_customers = sorted(customer_sales.items(), key=lambda x: x[1], reverse=True)[:5]
    top_customer_data = []
    for cid, amount in top_customers:
        customer = db.query(Customer).filter(Customer.id == cid).first()
        top_customer_data.append({
            "id": cid,
            "name": customer.name if customer else "Unknown",
            "amount": amount,
        })
    
    # Top products
    product_sales = {}
    for inv in invoices:
        items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).all()
        for item in items:
            pid = item.product_id or "unknown"
            if pid not in product_sales:
                product = db.query(Product).filter(Product.id == item.product_id).first() if item.product_id else None
                product_sales[pid] = {
                    "id": pid,
                    "name": product.name if product else item.description or "Unknown",
                    "amount": 0,
                }
            product_sales[pid]["amount"] += float(item.amount or 0)
    
    top_product_data = sorted(product_sales.values(), key=lambda x: x["amount"], reverse=True)[:5]
    
    return {
        "total_sales": total_sales,
        "total_invoices": invoice_count,
        "avg_invoice": avg_invoice,
        "total_gst": total_gst,
        "top_customers": top_customer_data,
        "top_products": top_product_data,
    }


# ==================== SALES BY CUSTOMER ====================

@router.get("/companies/{company_id}/reports/sales-by-customer")
async def sales_by_customer_report(
    company_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get sales breakdown by customer."""
    from app.database.models import Invoice, Customer
    
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.status != 'cancelled'
    )
    
    if from_date:
        query = query.filter(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.filter(Invoice.invoice_date <= to_date)
    
    invoices = query.all()
    
    customer_data = {}
    total_sales = Decimal("0")
    
    for inv in invoices:
        cid = inv.customer_id or "unknown"
        if cid not in customer_data:
            customer = db.query(Customer).filter(Customer.id == inv.customer_id).first() if inv.customer_id else None
            customer_data[cid] = {
                "id": cid,
                "customer_name": customer.name if customer else "Walk-in Customer",
                "invoice_count": 0,
                "total_amount": Decimal("0"),
                "gst_amount": Decimal("0"),
            }
        
        customer_data[cid]["invoice_count"] += 1
        customer_data[cid]["total_amount"] += inv.total_amount or Decimal("0")
        customer_data[cid]["gst_amount"] += inv.total_tax or Decimal("0")
        total_sales += inv.total_amount or Decimal("0")
    
    customers = []
    for data in customer_data.values():
        data["percentage"] = float(data["total_amount"] / total_sales * 100) if total_sales > 0 else 0
        data["total_amount"] = float(data["total_amount"])
        data["gst_amount"] = float(data["gst_amount"])
        customers.append(data)
    
    customers.sort(key=lambda x: x["total_amount"], reverse=True)
    
    return {"customers": customers, "total_sales": float(total_sales)}


# ==================== SALES BY PRODUCT ====================

@router.get("/companies/{company_id}/reports/sales-by-product")
async def sales_by_product_report(
    company_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get sales breakdown by product."""
    from app.database.models import Invoice, InvoiceItem
    
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.status != 'cancelled'
    )
    
    if from_date:
        query = query.filter(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.filter(Invoice.invoice_date <= to_date)
    
    invoices = query.all()
    
    product_data = {}
    total_sales = Decimal("0")
    
    for inv in invoices:
        items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).all()
        for item in items:
            pid = item.product_id or "unknown"
            if pid not in product_data:
                product = db.query(Product).filter(Product.id == item.product_id).first() if item.product_id else None
                product_data[pid] = {
                    "id": pid,
                    "product_name": product.name if product else item.description or "Unknown",
                    "sku": product.sku if product else None,
                    "quantity_sold": Decimal("0"),
                    "total_amount": Decimal("0"),
                }
            
            product_data[pid]["quantity_sold"] += item.quantity or Decimal("0")
            product_data[pid]["total_amount"] += item.amount or Decimal("0")
            total_sales += item.amount or Decimal("0")
    
    products = []
    for data in product_data.values():
        data["percentage"] = float(data["total_amount"] / total_sales * 100) if total_sales > 0 else 0
        data["quantity_sold"] = float(data["quantity_sold"])
        data["total_amount"] = float(data["total_amount"])
        products.append(data)
    
    products.sort(key=lambda x: x["total_amount"], reverse=True)
    
    return {"products": products, "total_sales": float(total_sales)}


# ==================== HSN SUMMARY ====================

@router.get("/companies/{company_id}/gst/hsn-summary")
async def hsn_summary_report(
    company_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get HSN/SAC summary for GST."""
    from app.database.models import Invoice, InvoiceItem
    
    get_company_or_404(company_id, current_user, db)
    
    query = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.status != 'cancelled'
    )
    
    if from_date:
        query = query.filter(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.filter(Invoice.invoice_date <= to_date)
    
    invoices = query.all()
    
    hsn_data = {}
    
    for inv in invoices:
        items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).all()
        for item in items:
            hsn = item.hsn_code or "NA"
            if hsn not in hsn_data:
                hsn_data[hsn] = {
                    "hsn_code": hsn,
                    "description": item.description or "",
                    "quantity": Decimal("0"),
                    "taxable_value": Decimal("0"),
                    "igst": Decimal("0"),
                    "cgst": Decimal("0"),
                    "sgst": Decimal("0"),
                    "total_tax": Decimal("0"),
                }
            
            hsn_data[hsn]["quantity"] += item.quantity or Decimal("0")
            taxable = item.amount or Decimal("0")
            hsn_data[hsn]["taxable_value"] += taxable
            
            # Calculate tax components
            gst_rate = Decimal(str(item.gst_rate or 0))
            tax = taxable * gst_rate / 100
            hsn_data[hsn]["total_tax"] += tax
            hsn_data[hsn]["cgst"] += tax / 2
            hsn_data[hsn]["sgst"] += tax / 2
    
    result = []
    for data in hsn_data.values():
        result.append({
            "hsn_code": data["hsn_code"],
            "description": data["description"],
            "quantity": float(data["quantity"]),
            "taxable_value": float(data["taxable_value"]),
            "igst": float(data["igst"]),
            "cgst": float(data["cgst"]),
            "sgst": float(data["sgst"]),
            "total_tax": float(data["total_tax"]),
        })
    
    return {"items": result, "hsn_summary": result}


# ==================== BANK ACCOUNTS (for dropdowns) ====================

@router.get("/companies/{company_id}/bank-accounts-list")
async def list_bank_accounts(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List bank accounts for dropdowns."""
    from app.database.models import BankAccount
    
    get_company_or_404(company_id, current_user, db)
    
    accounts = db.query(BankAccount).filter(
        BankAccount.company_id == company_id,
        BankAccount.is_active == True
    ).all()
    
    return [{
        "id": a.id,
        "bank_name": a.bank_name,
        "account_number": a.account_number,
        "account_type": a.account_type,
    } for a in accounts]


# ==================== IMPORT/EXPORT ENDPOINTS ====================

@router.get("/companies/{company_id}/import/template/{template_type}")
async def download_import_template(
    company_id: str,
    template_type: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download import template Excel file."""
    from fastapi.responses import Response
    from app.services.excel_service import ExcelService
    
    get_company_or_404(company_id, current_user, db)
    
    service = ExcelService(db)
    
    try:
        template_data = service.generate_import_template(template_type)
        return Response(
            content=template_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={template_type}_template.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error generating template: {str(e)}")


@router.post("/companies/{company_id}/import/{import_type}")
async def import_data(
    company_id: str,
    import_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Import data from Excel file."""
    from app.services.excel_service import ExcelService
    
    get_company_or_404(company_id, current_user, db)
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        file_data = await file.read()
        service = ExcelService(db)
        
        if import_type == 'customers':
            result = service.import_customers(company_id, file_data)
        elif import_type == 'products':
            result = service.import_products(company_id, file_data)
        elif import_type == 'accounts':
            result = service.import_accounts(company_id, file_data)
        elif import_type == 'opening_balances':
            result = service.import_opening_balances(company_id, file_data)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown import type: {import_type}")
        
        return {
            "imported": result.get('imported', 0),
            "errors": result.get('errors', []),
            "total_rows": result.get('total_rows', 0),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


# ==================== EXPORT ENDPOINTS ====================

@router.get("/companies/{company_id}/export/{export_type}")
async def export_data(
    company_id: str,
    export_type: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export data to Excel."""
    from fastapi.responses import Response
    from app.services.excel_service import ExcelService
    from app.database.models import Invoice, PurchaseInvoice, Customer, Account, Transaction
    
    company = get_company_or_404(company_id, current_user, db)
    
    service = ExcelService(db)
    
    try:
        data = []
        columns = []
        title = export_type.replace('_', ' ').title()
        
        if export_type == 'customers':
            customers = db.query(Customer).filter(
                Customer.company_id == company_id,
                Customer.is_active == True
            ).all()
            columns = ['Name', 'Trade Name', 'GSTIN', 'PAN', 'Email', 'Phone', 'City', 'State', 'Type']
            data = [{
                'Name': c.name,
                'Trade Name': c.trade_name,
                'GSTIN': c.gstin,
                'PAN': c.pan,
                'Email': c.email,
                'Phone': c.phone,
                'City': c.billing_city,
                'State': c.billing_state,
                'Type': c.customer_type,
            } for c in customers]
            
        elif export_type == 'products':
            products = db.query(Product).filter(
                Product.company_id == company_id,
                Product.is_active == True
            ).all()
            columns = ['Name', 'SKU', 'HSN Code', 'Unit Price', 'Unit', 'GST Rate', 'Current Stock', 'Min Stock']
            data = [{
                'Name': p.name,
                'SKU': p.sku,
                'HSN Code': p.hsn_code,
                'Unit Price': float(p.unit_price or 0),
                'Unit': p.unit,
                'GST Rate': p.gst_rate,
                'Current Stock': float(p.current_stock or 0),
                'Min Stock': float(p.min_stock_level or 0),
            } for p in products]
            
        elif export_type == 'invoices':
            query = db.query(Invoice).filter(Invoice.company_id == company_id)
            if from_date:
                query = query.filter(Invoice.invoice_date >= from_date)
            if to_date:
                query = query.filter(Invoice.invoice_date <= to_date)
            invoices = query.order_by(Invoice.invoice_date.desc()).all()
            
            columns = ['Invoice No', 'Date', 'Customer', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance', 'Status']
            for inv in invoices:
                customer = db.query(Customer).filter(Customer.id == inv.customer_id).first() if inv.customer_id else None
                data.append({
                    'Invoice No': inv.invoice_number,
                    'Date': inv.invoice_date.isoformat() if inv.invoice_date else '',
                    'Customer': customer.name if customer else 'Walk-in',
                    'Subtotal': float(inv.subtotal or 0),
                    'Tax': float(inv.total_tax or 0),
                    'Total': float(inv.total_amount or 0),
                    'Paid': float(inv.amount_paid or 0),
                    'Balance': float(inv.balance_due or 0),
                    'Status': inv.status,
                })
                
        elif export_type == 'purchases':
            query = db.query(PurchaseInvoice).filter(PurchaseInvoice.company_id == company_id)
            if from_date:
                query = query.filter(PurchaseInvoice.invoice_date >= from_date)
            if to_date:
                query = query.filter(PurchaseInvoice.invoice_date <= to_date)
            purchases = query.order_by(PurchaseInvoice.invoice_date.desc()).all()
            
            columns = ['Invoice No', 'Vendor Invoice', 'Date', 'Vendor', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance', 'Status']
            for p in purchases:
                vendor = db.query(Customer).filter(Customer.id == p.vendor_id).first() if p.vendor_id else None
                data.append({
                    'Invoice No': p.invoice_number,
                    'Vendor Invoice': p.vendor_invoice_number,
                    'Date': p.invoice_date.isoformat() if p.invoice_date else '',
                    'Vendor': vendor.name if vendor else 'Unknown',
                    'Subtotal': float(p.subtotal or 0),
                    'Tax': float(p.total_tax or 0),
                    'Total': float(p.total_amount or 0),
                    'Paid': float(p.amount_paid or 0),
                    'Balance': float(p.balance_due or 0),
                    'Status': p.status,
                })
                
        elif export_type == 'transactions':
            query = db.query(Transaction).filter(Transaction.company_id == company_id)
            if from_date:
                query = query.filter(Transaction.transaction_date >= from_date)
            if to_date:
                query = query.filter(Transaction.transaction_date <= to_date)
            transactions = query.order_by(Transaction.transaction_date.desc()).all()
            
            columns = ['Transaction No', 'Date', 'Description', 'Type', 'Debit', 'Credit', 'Status']
            data = [{
                'Transaction No': t.transaction_number,
                'Date': t.transaction_date.isoformat() if t.transaction_date else '',
                'Description': t.description,
                'Type': t.reference_type.value if t.reference_type else '',
                'Debit': float(t.total_debit or 0),
                'Credit': float(t.total_credit or 0),
                'Status': t.status.value if t.status else '',
            } for t in transactions]
            
        elif export_type == 'trial_balance':
            accounts = db.query(Account).filter(
                Account.company_id == company_id,
                Account.is_active == True
            ).order_by(Account.code).all()
            
            columns = ['Code', 'Name', 'Type', 'Opening Balance', 'Current Balance']
            data = [{
                'Code': a.code,
                'Name': a.name,
                'Type': a.account_type.value if a.account_type else '',
                'Opening Balance': float(a.opening_balance or 0),
                'Current Balance': float(a.current_balance or 0),
            } for a in accounts]
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown export type: {export_type}")
        
        excel_data = service.export_to_excel(data, columns, title, include_totals=True)
        
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={export_type}_export.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {str(e)}")


# ==================== EXCHANGE RATES ENDPOINTS ====================

@router.get("/companies/{company_id}/exchange-rates")
async def list_exchange_rates(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List exchange rates for a company."""
    from app.database.models import ExchangeRate
    
    get_company_or_404(company_id, current_user, db)
    
    rates = db.query(ExchangeRate).filter(
        ExchangeRate.company_id == company_id
    ).order_by(ExchangeRate.rate_date.desc()).limit(100).all()
    
    return [{
        "id": r.id,
        "from_currency": r.from_currency_code,
        "to_currency": r.to_currency_code,
        "rate": float(r.rate) if r.rate else 0,
        "effective_date": r.rate_date.isoformat() if r.rate_date else None,
    } for r in rates]


@router.post("/companies/{company_id}/exchange-rates")
async def create_exchange_rate(
    company_id: str,
    data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new exchange rate."""
    from app.services.forex_service import ForexService
    from decimal import Decimal
    
    get_company_or_404(company_id, current_user, db)
    
    service = ForexService(db)
    
    try:
        rate = service.set_exchange_rate(
            company_id=company_id,
            from_currency_code=data.get('from_currency', '').upper(),
            to_currency_code=data.get('to_currency', '').upper(),
            rate=Decimal(str(data.get('rate', 0))),
            rate_date=datetime.fromisoformat(data.get('effective_date', datetime.utcnow().isoformat())) if isinstance(data.get('effective_date'), str) else data.get('effective_date', datetime.utcnow()),
        )
        return {
            "id": rate.id,
            "from_currency": data.get('from_currency', '').upper(),
            "to_currency": data.get('to_currency', '').upper(),
            "rate": float(rate.rate) if rate.rate else 0,
            "effective_date": rate.rate_date.isoformat() if rate.rate_date else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== BILL ALLOCATION ENDPOINTS ====================

@router.get("/companies/{company_id}/bill-allocation/outstanding")
async def get_bill_allocation_outstanding(
    company_id: str,
    type: str = Query(..., pattern="^(receivables|payables)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get outstanding invoices for bill allocation."""
    from app.services.bill_allocation_service import BillAllocationService
    from app.database.models import Invoice, PurchaseInvoice, Customer
    
    get_company_or_404(company_id, current_user, db)
    
    service = BillAllocationService(db)
    
    invoice_type = 'sales' if type == 'receivables' else 'purchase'
    outstanding_list = service.get_outstanding_invoices(company_id, invoice_type=invoice_type)
    
    # Enrich with party names
    result = []
    for inv in outstanding_list:
        party_name = "Unknown"
        if invoice_type == 'sales':
            if inv.get('customer_id'):
                customer = db.query(Customer).filter(Customer.id == inv['customer_id']).first()
                party_name = customer.name if customer else "Unknown"
        else:
            if inv.get('vendor_id'):
                vendor = db.query(Customer).filter(Customer.id == inv['vendor_id']).first()
                party_name = vendor.name if vendor else "Unknown"
        
        result.append({
            "id": inv['id'],
            "invoice_number": inv['invoice_number'],
            "invoice_date": inv['invoice_date'],
            "party_name": party_name,
            "total_amount": inv['total_amount'],
            "outstanding_amount": inv['outstanding_amount'],
            "due_date": inv['due_date'],
            "days_overdue": inv['days_overdue'],
        })
    
    return result


# ==================== BACKUP ENDPOINTS ====================

@router.get("/companies/{company_id}/backups")
async def list_backups(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List available backups."""
    get_company_or_404(company_id, current_user, db)
    
    # Return empty list for now - would integrate with backup service
    # In production, this would list actual backup files
    return []


@router.post("/companies/{company_id}/backups")
async def create_backup(
    company_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new backup."""
    get_company_or_404(company_id, current_user, db)
    
    backup_id = generate_uuid()
    backup_time = datetime.utcnow()
    
    # In production, this would create an actual backup file
    # For now, return a mock response
    return {
        "id": backup_id,
        "filename": f"backup_{company_id}_{backup_time.strftime('%Y%m%d_%H%M%S')}.zip",
        "created_at": backup_time.isoformat(),
        "size": "0 MB",
        "type": "full",
    }


@router.get("/companies/{company_id}/backups/{backup_id}/download")
async def download_backup(
    company_id: str,
    backup_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download a backup file."""
    from fastapi.responses import Response
    
    get_company_or_404(company_id, current_user, db)
    
    # In production, this would return the actual backup file
    # For now, return a placeholder
    return Response(
        content="Backup file would be here",
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=backup_{backup_id}.zip"}
    )


@router.delete("/companies/{company_id}/backups/{backup_id}")
async def delete_backup(
    company_id: str,
    backup_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a backup file."""
    get_company_or_404(company_id, current_user, db)
    
    # In production, this would delete the actual backup file
    return {"message": "Backup deleted successfully"}

