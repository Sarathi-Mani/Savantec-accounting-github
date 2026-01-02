"""
Stock Verification Service - Physical stock adjustment.

Features:
- Create verification sessions
- Record physical counts
- Calculate variances
- Post adjustments to stock
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    StockAdjustment, StockAdjustmentStatus, StockAdjustmentItem,
    Product, StockEntry, StockMovementType, Transaction, TransactionEntry,
    Account, AccountType, generate_uuid
)


class StockVerificationService:
    """Service for physical stock verification."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_verification(
        self,
        company_id: str,
        godown_id: str = None,
        adjustment_number: str = None,
        adjustment_date: datetime = None,
        reason: str = None,
        notes: str = None,
    ) -> StockAdjustment:
        """Create a new stock verification session."""
        if not adjustment_number:
            count = self.db.query(StockAdjustment).filter(
                StockAdjustment.company_id == company_id
            ).count()
            adjustment_number = f"ADJ-{count + 1:05d}"
        
        adjustment = StockAdjustment(
            id=generate_uuid(),
            company_id=company_id,
            adjustment_number=adjustment_number,
            adjustment_date=adjustment_date or datetime.utcnow(),
            godown_id=godown_id,
            status=StockAdjustmentStatus.DRAFT,
            reason=reason,
            notes=notes,
        )
        
        self.db.add(adjustment)
        self.db.commit()
        self.db.refresh(adjustment)
        
        return adjustment
    
    def add_item(
        self,
        adjustment_id: str,
        product_id: str,
        physical_quantity: Decimal,
        batch_id: str = None,
        reason: str = None,
    ) -> StockAdjustmentItem:
        """Add an item to verification with physical count."""
        adjustment = self.db.query(StockAdjustment).filter(
            StockAdjustment.id == adjustment_id
        ).first()
        
        if not adjustment:
            raise ValueError("Adjustment not found")
        
        if adjustment.status != StockAdjustmentStatus.DRAFT:
            raise ValueError("Cannot add items to non-draft adjustment")
        
        # Get current book quantity
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ValueError("Product not found")
        
        book_quantity = self._get_stock_quantity(
            adjustment.company_id, product_id, adjustment.godown_id, batch_id
        )
        
        variance = physical_quantity - book_quantity
        rate = product.standard_cost or product.unit_price or Decimal('0')
        variance_value = variance * rate
        
        item = StockAdjustmentItem(
            id=generate_uuid(),
            adjustment_id=adjustment_id,
            product_id=product_id,
            batch_id=batch_id,
            book_quantity=book_quantity,
            physical_quantity=physical_quantity,
            variance_quantity=variance,
            rate=rate,
            variance_value=variance_value,
            reason=reason,
        )
        
        self.db.add(item)
        
        # Update totals
        adjustment.total_items = len(adjustment.items) + 1
        adjustment.total_variance_value = (adjustment.total_variance_value or Decimal('0')) + variance_value
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    def _get_stock_quantity(
        self,
        company_id: str,
        product_id: str,
        godown_id: str = None,
        batch_id: str = None,
    ) -> Decimal:
        """Get current stock quantity from stock entries."""
        query = self.db.query(func.sum(StockEntry.quantity)).filter(
            StockEntry.company_id == company_id,
            StockEntry.product_id == product_id,
        )
        
        if godown_id:
            query = query.filter(StockEntry.godown_id == godown_id)
        
        if batch_id:
            query = query.filter(StockEntry.batch_id == batch_id)
        
        result = query.scalar()
        return Decimal(str(result)) if result else Decimal('0')
    
    def update_item(
        self,
        item_id: str,
        physical_quantity: Decimal,
        reason: str = None,
    ) -> StockAdjustmentItem:
        """Update physical count for an item."""
        item = self.db.query(StockAdjustmentItem).filter(
            StockAdjustmentItem.id == item_id
        ).first()
        
        if not item:
            raise ValueError("Item not found")
        
        old_variance_value = item.variance_value or Decimal('0')
        
        variance = physical_quantity - item.book_quantity
        variance_value = variance * (item.rate or Decimal('0'))
        
        item.physical_quantity = physical_quantity
        item.variance_quantity = variance
        item.variance_value = variance_value
        
        if reason:
            item.reason = reason
        
        # Update adjustment totals
        adjustment = item.adjustment
        adjustment.total_variance_value = (adjustment.total_variance_value or Decimal('0')) - old_variance_value + variance_value
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    def remove_item(self, item_id: str) -> bool:
        """Remove an item from verification."""
        item = self.db.query(StockAdjustmentItem).filter(
            StockAdjustmentItem.id == item_id
        ).first()
        
        if not item:
            return False
        
        adjustment = item.adjustment
        if adjustment.status != StockAdjustmentStatus.DRAFT:
            raise ValueError("Cannot remove items from non-draft adjustment")
        
        adjustment.total_items -= 1
        adjustment.total_variance_value = (adjustment.total_variance_value or Decimal('0')) - (item.variance_value or Decimal('0'))
        
        self.db.delete(item)
        self.db.commit()
        
        return True
    
    def verify_adjustment(
        self,
        adjustment_id: str,
        verified_by: str,
    ) -> StockAdjustment:
        """Mark adjustment as verified."""
        adjustment = self.db.query(StockAdjustment).filter(
            StockAdjustment.id == adjustment_id
        ).first()
        
        if not adjustment:
            raise ValueError("Adjustment not found")
        
        if adjustment.status != StockAdjustmentStatus.DRAFT:
            raise ValueError("Adjustment is not in draft status")
        
        adjustment.status = StockAdjustmentStatus.VERIFIED
        adjustment.verified_by = verified_by
        adjustment.verified_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(adjustment)
        
        return adjustment
    
    def approve_adjustment(
        self,
        adjustment_id: str,
        approved_by: str,
    ) -> StockAdjustment:
        """Approve adjustment for posting."""
        adjustment = self.db.query(StockAdjustment).filter(
            StockAdjustment.id == adjustment_id
        ).first()
        
        if not adjustment:
            raise ValueError("Adjustment not found")
        
        if adjustment.status != StockAdjustmentStatus.VERIFIED:
            raise ValueError("Adjustment must be verified before approval")
        
        adjustment.status = StockAdjustmentStatus.APPROVED
        adjustment.approved_by = approved_by
        adjustment.approved_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(adjustment)
        
        return adjustment
    
    def post_adjustment(
        self,
        adjustment_id: str,
        accounting_service=None,
    ) -> StockAdjustment:
        """Post adjustment to stock."""
        adjustment = self.db.query(StockAdjustment).filter(
            StockAdjustment.id == adjustment_id
        ).first()
        
        if not adjustment:
            raise ValueError("Adjustment not found")
        
        if adjustment.status != StockAdjustmentStatus.APPROVED:
            raise ValueError("Adjustment must be approved before posting")
        
        # Create stock entries for variances
        for item in adjustment.items:
            if item.variance_quantity != 0:
                movement_type = StockMovementType.ADJUSTMENT_IN if item.variance_quantity > 0 else StockMovementType.ADJUSTMENT_OUT
                
                entry = StockEntry(
                    id=generate_uuid(),
                    company_id=adjustment.company_id,
                    product_id=item.product_id,
                    godown_id=adjustment.godown_id,
                    batch_id=item.batch_id,
                    entry_date=adjustment.adjustment_date,
                    movement_type=movement_type,
                    quantity=item.variance_quantity,
                    rate=item.rate,
                    value=item.variance_value,
                    reference_type='stock_adjustment',
                    reference_id=adjustment.id,
                    reference_number=adjustment.adjustment_number,
                    notes=item.reason or adjustment.reason,
                )
                self.db.add(entry)
                
                # Update product stock
                product = self.db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product.current_stock = (product.current_stock or Decimal('0')) + item.variance_quantity
        
        adjustment.status = StockAdjustmentStatus.POSTED
        
        self.db.commit()
        self.db.refresh(adjustment)
        
        return adjustment
    
    def get_adjustment(self, adjustment_id: str) -> Optional[StockAdjustment]:
        return self.db.query(StockAdjustment).filter(
            StockAdjustment.id == adjustment_id
        ).first()
    
    def list_adjustments(
        self,
        company_id: str,
        status: StockAdjustmentStatus = None,
        godown_id: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> List[StockAdjustment]:
        query = self.db.query(StockAdjustment).filter(
            StockAdjustment.company_id == company_id
        )
        
        if status:
            query = query.filter(StockAdjustment.status == status)
        
        if godown_id:
            query = query.filter(StockAdjustment.godown_id == godown_id)
        
        if from_date:
            query = query.filter(StockAdjustment.adjustment_date >= from_date)
        
        if to_date:
            query = query.filter(StockAdjustment.adjustment_date <= to_date)
        
        return query.order_by(StockAdjustment.adjustment_date.desc()).all()
    
    def load_all_products(
        self,
        adjustment_id: str,
        godown_id: str = None,
    ) -> List[StockAdjustmentItem]:
        """Load all products with current stock for verification."""
        adjustment = self.db.query(StockAdjustment).filter(
            StockAdjustment.id == adjustment_id
        ).first()
        
        if not adjustment:
            raise ValueError("Adjustment not found")
        
        products = self.db.query(Product).filter(
            Product.company_id == adjustment.company_id,
            Product.is_active == True,
            Product.is_service == False,
        ).all()
        
        items = []
        for product in products:
            book_qty = self._get_stock_quantity(
                adjustment.company_id, product.id, godown_id or adjustment.godown_id
            )
            
            if book_qty > 0:  # Only include products with stock
                item = self.add_item(
                    adjustment_id=adjustment_id,
                    product_id=product.id,
                    physical_quantity=book_qty,  # Default to book qty
                )
                items.append(item)
        
        return items
