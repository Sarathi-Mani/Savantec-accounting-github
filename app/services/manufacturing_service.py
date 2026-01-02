"""
Manufacturing Service - Production orders and stock journals.

Features:
- Create manufacturing orders from BOM
- Track raw material consumption
- Record finished goods production
- Handle byproducts
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    ManufacturingOrder, ManufacturingOrderStatus, ManufacturingConsumption,
    ManufacturingByproduct, BillOfMaterial, BOMComponent, Product, 
    StockEntry, StockMovementType, generate_uuid
)


class ManufacturingService:
    """Service for manufacturing/production orders."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_order(
        self,
        company_id: str,
        finished_product_id: str,
        planned_quantity: Decimal,
        bom_id: str = None,
        order_number: str = None,
        order_date: datetime = None,
        planned_start_date: datetime = None,
        planned_end_date: datetime = None,
        production_godown_id: str = None,
        finished_goods_godown_id: str = None,
        notes: str = None,
    ) -> ManufacturingOrder:
        """Create a new manufacturing order."""
        # Generate order number if not provided
        if not order_number:
            count = self.db.query(ManufacturingOrder).filter(
                ManufacturingOrder.company_id == company_id
            ).count()
            order_number = f"MFG-{count + 1:05d}"
        
        order = ManufacturingOrder(
            id=generate_uuid(),
            company_id=company_id,
            order_number=order_number,
            order_date=order_date or datetime.utcnow(),
            bom_id=bom_id,
            finished_product_id=finished_product_id,
            planned_quantity=planned_quantity,
            produced_quantity=Decimal('0'),
            production_godown_id=production_godown_id,
            finished_goods_godown_id=finished_goods_godown_id,
            status=ManufacturingOrderStatus.DRAFT,
            planned_start_date=planned_start_date,
            planned_end_date=planned_end_date,
            notes=notes,
        )
        
        self.db.add(order)
        
        # If BOM provided, add consumption items from BOM
        if bom_id:
            self._add_bom_components(order)
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    def _add_bom_components(self, order: ManufacturingOrder):
        """Add consumption items from BOM."""
        bom = self.db.query(BillOfMaterial).filter(
            BillOfMaterial.id == order.bom_id
        ).first()
        
        if not bom:
            return
        
        # Calculate quantity multiplier
        multiplier = order.planned_quantity / (bom.output_quantity or Decimal('1'))
        
        for component in bom.components:
            # Calculate required quantity with waste
            required_qty = component.quantity * multiplier
            if component.waste_percentage:
                required_qty *= (1 + component.waste_percentage / 100)
            
            consumption = ManufacturingConsumption(
                id=generate_uuid(),
                order_id=order.id,
                product_id=component.component_item_id,
                planned_quantity=required_qty.quantize(Decimal('0.001')),
                actual_quantity=Decimal('0'),
            )
            self.db.add(consumption)
    
    def add_consumption(
        self,
        order_id: str,
        product_id: str,
        planned_quantity: Decimal,
        batch_id: str = None,
        godown_id: str = None,
    ) -> ManufacturingConsumption:
        """Add a raw material to consumption list."""
        consumption = ManufacturingConsumption(
            id=generate_uuid(),
            order_id=order_id,
            product_id=product_id,
            batch_id=batch_id,
            godown_id=godown_id,
            planned_quantity=planned_quantity,
            actual_quantity=Decimal('0'),
        )
        
        self.db.add(consumption)
        self.db.commit()
        self.db.refresh(consumption)
        
        return consumption
    
    def record_consumption(
        self,
        consumption_id: str,
        actual_quantity: Decimal,
        rate: Decimal = None,
    ) -> ManufacturingConsumption:
        """Record actual consumption of raw material."""
        consumption = self.db.query(ManufacturingConsumption).filter(
            ManufacturingConsumption.id == consumption_id
        ).first()
        
        if not consumption:
            raise ValueError("Consumption record not found")
        
        consumption.actual_quantity = actual_quantity
        consumption.rate = rate or Decimal('0')
        consumption.value = actual_quantity * (rate or Decimal('0'))
        
        self.db.commit()
        self.db.refresh(consumption)
        
        return consumption
    
    def start_production(self, order_id: str) -> ManufacturingOrder:
        """Start production on an order."""
        order = self.db.query(ManufacturingOrder).filter(
            ManufacturingOrder.id == order_id
        ).first()
        
        if not order:
            raise ValueError("Order not found")
        
        if order.status not in [ManufacturingOrderStatus.DRAFT, ManufacturingOrderStatus.PLANNED]:
            raise ValueError(f"Cannot start production from status: {order.status}")
        
        order.status = ManufacturingOrderStatus.IN_PROGRESS
        order.actual_start_date = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    def complete_production(
        self,
        order_id: str,
        produced_quantity: Decimal,
        actual_cost: Decimal = None,
    ) -> ManufacturingOrder:
        """Complete production and record output."""
        order = self.db.query(ManufacturingOrder).filter(
            ManufacturingOrder.id == order_id
        ).first()
        
        if not order:
            raise ValueError("Order not found")
        
        if order.status != ManufacturingOrderStatus.IN_PROGRESS:
            raise ValueError(f"Order is not in progress (status: {order.status})")
        
        order.produced_quantity = produced_quantity
        order.actual_end_date = datetime.utcnow()
        order.actual_cost = actual_cost or self._calculate_cost(order)
        order.status = ManufacturingOrderStatus.COMPLETED
        
        # Create stock entries
        self._create_stock_entries(order)
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    def _calculate_cost(self, order: ManufacturingOrder) -> Decimal:
        """Calculate actual cost from consumption."""
        total = Decimal('0')
        for consumption in order.consumption_items:
            total += consumption.value or Decimal('0')
        return total
    
    def _create_stock_entries(self, order: ManufacturingOrder):
        """Create stock entries for consumption and production."""
        # Consume raw materials
        for consumption in order.consumption_items:
            if consumption.actual_quantity > 0:
                entry = StockEntry(
                    id=generate_uuid(),
                    company_id=order.company_id,
                    product_id=consumption.product_id,
                    godown_id=consumption.godown_id or order.production_godown_id,
                    batch_id=consumption.batch_id,
                    entry_date=datetime.utcnow(),
                    movement_type=StockMovementType.MANUFACTURING_OUT,
                    quantity=-consumption.actual_quantity,
                    rate=consumption.rate,
                    value=-consumption.value if consumption.value else Decimal('0'),
                    reference_type='manufacturing_order',
                    reference_id=order.id,
                    reference_number=order.order_number,
                )
                self.db.add(entry)
        
        # Add finished goods
        if order.produced_quantity > 0:
            unit_cost = order.actual_cost / order.produced_quantity if order.produced_quantity else Decimal('0')
            
            entry = StockEntry(
                id=generate_uuid(),
                company_id=order.company_id,
                product_id=order.finished_product_id,
                godown_id=order.finished_goods_godown_id or order.production_godown_id,
                entry_date=datetime.utcnow(),
                movement_type=StockMovementType.MANUFACTURING_IN,
                quantity=order.produced_quantity,
                rate=unit_cost,
                value=order.actual_cost or Decimal('0'),
                reference_type='manufacturing_order',
                reference_id=order.id,
                reference_number=order.order_number,
            )
            self.db.add(entry)
        
        # Add byproducts
        for byproduct in order.byproducts:
            if byproduct.quantity > 0:
                entry = StockEntry(
                    id=generate_uuid(),
                    company_id=order.company_id,
                    product_id=byproduct.product_id,
                    godown_id=byproduct.godown_id or order.finished_goods_godown_id,
                    entry_date=datetime.utcnow(),
                    movement_type=StockMovementType.MANUFACTURING_IN,
                    quantity=byproduct.quantity,
                    rate=byproduct.rate,
                    value=byproduct.value or Decimal('0'),
                    reference_type='manufacturing_order',
                    reference_id=order.id,
                    reference_number=order.order_number,
                    notes=f"Byproduct from {order.order_number}",
                )
                self.db.add(entry)
    
    def cancel_order(self, order_id: str) -> ManufacturingOrder:
        """Cancel a manufacturing order."""
        order = self.db.query(ManufacturingOrder).filter(
            ManufacturingOrder.id == order_id
        ).first()
        
        if not order:
            raise ValueError("Order not found")
        
        if order.status == ManufacturingOrderStatus.COMPLETED:
            raise ValueError("Cannot cancel completed order")
        
        order.status = ManufacturingOrderStatus.CANCELLED
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    def get_order(self, order_id: str) -> Optional[ManufacturingOrder]:
        return self.db.query(ManufacturingOrder).filter(
            ManufacturingOrder.id == order_id
        ).first()
    
    def list_orders(
        self,
        company_id: str,
        status: ManufacturingOrderStatus = None,
        product_id: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> List[ManufacturingOrder]:
        query = self.db.query(ManufacturingOrder).filter(
            ManufacturingOrder.company_id == company_id
        )
        
        if status:
            query = query.filter(ManufacturingOrder.status == status)
        
        if product_id:
            query = query.filter(ManufacturingOrder.finished_product_id == product_id)
        
        if from_date:
            query = query.filter(ManufacturingOrder.order_date >= from_date)
        
        if to_date:
            query = query.filter(ManufacturingOrder.order_date <= to_date)
        
        return query.order_by(ManufacturingOrder.order_date.desc()).all()
