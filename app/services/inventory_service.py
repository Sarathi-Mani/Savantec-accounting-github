"""Inventory Service - Stock management and tracking."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Company, StockGroup, Product, Godown, Batch, StockEntry,
    BillOfMaterial, BOMComponent, StockMovementType
)


class InventoryService:
    """Service for managing inventory operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ============== Stock Groups ==============
    
    def create_stock_group(
        self,
        company: Company,
        name: str,
        parent_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> StockGroup:
        """Create a new stock group."""
        group = StockGroup(
            company_id=company.id,
            name=name,
            parent_id=parent_id,
            description=description,
        )
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group
    
    def get_stock_groups(self, company: Company) -> List[StockGroup]:
        """Get all stock groups for a company."""
        return self.db.query(StockGroup).filter(
            StockGroup.company_id == company.id,
            StockGroup.is_active == True
        ).order_by(StockGroup.name).all()
    
    def get_stock_group(self, group_id: str, company: Company) -> Optional[StockGroup]:
        """Get a stock group by ID."""
        return self.db.query(StockGroup).filter(
            StockGroup.id == group_id,
            StockGroup.company_id == company.id
        ).first()
    
    # ============== Godowns ==============
    
    def create_godown(
        self,
        company: Company,
        name: str,
        code: Optional[str] = None,
        address: Optional[str] = None,
        parent_id: Optional[str] = None,
        is_default: bool = False,
    ) -> Godown:
        """Create a new godown/warehouse."""
        # If this is default, unset other defaults
        if is_default:
            self.db.query(Godown).filter(
                Godown.company_id == company.id,
                Godown.is_default == True
            ).update({"is_default": False})
        
        godown = Godown(
            company_id=company.id,
            name=name,
            code=code,
            address=address,
            parent_id=parent_id,
            is_default=is_default,
        )
        self.db.add(godown)
        self.db.commit()
        self.db.refresh(godown)
        return godown
    
    def get_godowns(self, company: Company) -> List[Godown]:
        """Get all godowns for a company."""
        return self.db.query(Godown).filter(
            Godown.company_id == company.id,
            Godown.is_active == True
        ).order_by(Godown.name).all()
    
    def get_default_godown(self, company: Company) -> Optional[Godown]:
        """Get the default godown."""
        return self.db.query(Godown).filter(
            Godown.company_id == company.id,
            Godown.is_default == True
        ).first()
    
    # ============== Stock Items ==============
    
    def create_stock_item(
        self,
        company: Company,
        name: str,
        code: Optional[str] = None,
        barcode: Optional[str] = None,
        stock_group_id: Optional[str] = None,
        primary_unit: str = "Nos",
        hsn_code: Optional[str] = None,
        gst_rate: Decimal = Decimal("18"),
        opening_stock: Decimal = Decimal("0"),
        standard_cost: Decimal = Decimal("0"),
        standard_selling_price: Decimal = Decimal("0"),
        min_stock_level: Decimal = Decimal("0"),
        enable_batch: bool = False,
        enable_expiry: bool = False,
        product_id: Optional[str] = None,
    ) -> Product:
        """Create a new product with inventory (unified model)."""
        # Use Product directly - it now includes all stock fields
        product = Product(
            company_id=company.id,
            name=name,
            sku=code,
            barcode=barcode,
            stock_group_id=stock_group_id,
            primary_unit=primary_unit,
            unit=primary_unit,
            hsn_code=hsn_code,
            gst_rate=str(gst_rate),
            unit_price=standard_selling_price,
            standard_selling_price=standard_selling_price,
            opening_stock=opening_stock,
            current_stock=opening_stock,
            standard_cost=standard_cost,
            min_stock_level=min_stock_level,
            enable_batch=enable_batch,
            enable_expiry=enable_expiry,
            is_service=False,
        )
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product
    
    def get_stock_items(
        self,
        company: Company,
        stock_group_id: Optional[str] = None,
        search: Optional[str] = None,
        low_stock_only: bool = False,
    ) -> List[Product]:
        """Get products with inventory (non-services only)."""
        query = self.db.query(Product).filter(
            Product.company_id == company.id,
            Product.is_active == True,
            Product.is_service == False  # Only products, not services
        )
        
        if stock_group_id:
            query = query.filter(Product.stock_group_id == stock_group_id)
        
        if search:
            query = query.filter(
                (Product.name.ilike(f"%{search}%")) |
                (Product.sku.ilike(f"%{search}%")) |
                (Product.barcode.ilike(f"%{search}%"))
            )
        
        if low_stock_only:
            query = query.filter(Product.current_stock <= Product.min_stock_level)
        
        return query.order_by(Product.name).all()
    
    def get_stock_item(self, item_id: str, company: Company) -> Optional[Product]:
        """Get a product with inventory by ID."""
        return self.db.query(Product).filter(
            Product.id == item_id,
            Product.company_id == company.id,
            Product.is_service == False
        ).first()
    
    def update_stock_item(self, item: Product, data: Dict[str, Any]) -> Product:
        """Update a product with inventory (unified model)."""
        for key, value in data.items():
            if hasattr(item, key) and value is not None:
                setattr(item, key, value)
        
        # Sync unit and primary_unit
        if 'primary_unit' in data:
            item.unit = item.primary_unit
        if 'standard_selling_price' in data:
            item.unit_price = item.standard_selling_price
        
        self.db.commit()
        self.db.refresh(item)
        return item
    
    # ============== Stock Movements ==============
    
    def record_stock_in(
        self,
        company: Company,
        product_id: str,  # Changed from stock_item_id
        quantity: Decimal,
        rate: Decimal,
        godown_id: Optional[str] = None,
        batch_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        reference_number: Optional[str] = None,
        entry_date: Optional[datetime] = None,
        notes: Optional[str] = None,
        movement_type: StockMovementType = StockMovementType.PURCHASE,
    ) -> StockEntry:
        """Record stock received (purchase, return, etc.)."""
        item = self.get_stock_item(product_id, company)  # Now uses product_id
        if not item:
            raise ValueError("Product not found")
        
        # Use default godown if not specified
        if not godown_id:
            default_godown = self.get_default_godown(company)
            if default_godown:
                godown_id = default_godown.id
        
        entry = StockEntry(
            company_id=company.id,
            product_id=product_id,  # Changed from stock_item_id
            godown_id=godown_id,
            batch_id=batch_id,
            entry_date=entry_date or datetime.utcnow(),
            movement_type=movement_type,
            quantity=quantity,
            unit=item.primary_unit or item.unit,
            rate=rate,
            value=quantity * rate,
            reference_type=reference_type,
            reference_id=reference_id,
            reference_number=reference_number,
            notes=notes,
        )
        
        # Update current stock
        item.current_stock = (item.current_stock or Decimal("0")) + quantity
        
        # Update batch quantity if applicable
        if batch_id:
            batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
            if batch:
                batch.quantity = (batch.quantity or Decimal("0")) + quantity
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry
    
    def record_stock_out(
        self,
        company: Company,
        product_id: str,  # Changed from stock_item_id
        quantity: Decimal,
        rate: Optional[Decimal] = None,
        godown_id: Optional[str] = None,
        batch_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        reference_number: Optional[str] = None,
        entry_date: Optional[datetime] = None,
        notes: Optional[str] = None,
        movement_type: StockMovementType = StockMovementType.SALE,
    ) -> StockEntry:
        """Record stock issued (sale, consumption, etc.)."""
        item = self.get_stock_item(product_id, company)  # Now uses product_id
        if not item:
            raise ValueError("Product not found")
        
        # Check stock availability
        if item.current_stock < quantity:
            raise ValueError(f"Insufficient stock. Available: {item.current_stock}, Requested: {quantity}")
        
        # Use standard cost if rate not specified
        if rate is None:
            rate = item.standard_cost or Decimal("0")
        
        entry = StockEntry(
            company_id=company.id,
            product_id=product_id,  # Changed from stock_item_id
            godown_id=godown_id,
            batch_id=batch_id,
            entry_date=entry_date or datetime.utcnow(),
            movement_type=movement_type,
            quantity=-quantity,  # Negative for out
            unit=item.primary_unit or item.unit,
            rate=rate,
            value=quantity * rate,
            reference_type=reference_type,
            reference_id=reference_id,
            reference_number=reference_number,
            notes=notes,
        )
        
        # Update current stock
        item.current_stock = (item.current_stock or Decimal("0")) - quantity
        
        # Update batch quantity if applicable
        if batch_id:
            batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
            if batch:
                batch.quantity = (batch.quantity or Decimal("0")) - quantity
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry
    
    def transfer_stock(
        self,
        company: Company,
        product_id: str,
        quantity: Decimal,
        from_godown_id: str,
        to_godown_id: str,
        batch_id: Optional[str] = None,
        entry_date: Optional[datetime] = None,
        notes: Optional[str] = None,
    ) -> Tuple[StockEntry, StockEntry]:
        """Transfer stock between godowns."""
        item = self.get_stock_item(product_id, company)
        if not item:
            raise ValueError("Product not found")
        
        entry_date = entry_date or datetime.utcnow()
        
        # Create OUT entry
        out_entry = StockEntry(
            company_id=company.id,
            product_id=product_id,
            godown_id=from_godown_id,
            batch_id=batch_id,
            entry_date=entry_date,
            movement_type=StockMovementType.TRANSFER_OUT,
            quantity=-quantity,
            unit=item.primary_unit or item.unit,
            rate=item.standard_cost or Decimal("0"),
            value=quantity * (item.standard_cost or Decimal("0")),
            from_godown_id=from_godown_id,
            to_godown_id=to_godown_id,
            notes=notes,
        )
        
        # Create IN entry
        in_entry = StockEntry(
            company_id=company.id,
            product_id=product_id,
            godown_id=to_godown_id,
            batch_id=batch_id,
            entry_date=entry_date,
            movement_type=StockMovementType.TRANSFER_IN,
            quantity=quantity,
            unit=item.primary_unit or item.unit,
            rate=item.standard_cost or Decimal("0"),
            value=quantity * (item.standard_cost or Decimal("0")),
            from_godown_id=from_godown_id,
            to_godown_id=to_godown_id,
            notes=notes,
        )
        
        # Total stock doesn't change, only location
        self.db.add(out_entry)
        self.db.add(in_entry)
        self.db.commit()
        
        return out_entry, in_entry
    
    def get_stock_entries(
        self,
        company: Company,
        product_id: Optional[str] = None,  # Changed from stock_item_id
        godown_id: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        movement_type: Optional[StockMovementType] = None,
        limit: int = 100,
    ) -> List[StockEntry]:
        """Get stock entries with filters."""
        query = self.db.query(StockEntry).filter(StockEntry.company_id == company.id)
        
        if product_id:
            query = query.filter(StockEntry.product_id == product_id)
        
        if godown_id:
            query = query.filter(StockEntry.godown_id == godown_id)
        
        if from_date:
            query = query.filter(StockEntry.entry_date >= from_date)
        
        if to_date:
            query = query.filter(StockEntry.entry_date <= to_date)
        
        if movement_type:
            query = query.filter(StockEntry.movement_type == movement_type)
        
        return query.order_by(StockEntry.entry_date.desc()).limit(limit).all()
    
    # ============== Batches ==============
    
    def create_batch(
        self,
        product_id: str,
        batch_number: str,
        manufacturing_date: Optional[datetime] = None,
        expiry_date: Optional[datetime] = None,
        quantity: Decimal = Decimal("0"),
        cost_price: Decimal = Decimal("0"),
    ) -> Batch:
        """Create a new batch for a product."""
        batch = Batch(
            product_id=product_id,
            batch_number=batch_number,
            manufacturing_date=manufacturing_date,
            expiry_date=expiry_date,
            quantity=quantity,
            cost_price=cost_price,
        )
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch
    
    def get_batches(
        self,
        product_id: str,
        include_empty: bool = False,
    ) -> List[Batch]:
        """Get batches for a product."""
        query = self.db.query(Batch).filter(
            Batch.product_id == product_id,
            Batch.is_active == True
        )
        
        if not include_empty:
            query = query.filter(Batch.quantity > 0)
        
        return query.order_by(Batch.expiry_date.asc()).all()
    
    # ============== BOM ==============
    
    def create_bom(
        self,
        company: Company,
        finished_item_id: str,
        name: str,
        output_quantity: Decimal = Decimal("1"),
        output_unit: Optional[str] = None,
        description: Optional[str] = None,
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> BillOfMaterial:
        """Create a Bill of Material."""
        bom = BillOfMaterial(
            company_id=company.id,
            finished_item_id=finished_item_id,
            name=name,
            output_quantity=output_quantity,
            output_unit=output_unit,
            description=description,
        )
        self.db.add(bom)
        self.db.flush()
        
        # Add components
        if components:
            for comp in components:
                component = BOMComponent(
                    bom_id=bom.id,
                    component_item_id=comp["item_id"],
                    quantity=comp["quantity"],
                    unit=comp.get("unit"),
                    waste_percentage=comp.get("waste_percentage", Decimal("0")),
                )
                self.db.add(component)
        
        self.db.commit()
        self.db.refresh(bom)
        return bom
    
    def get_boms(self, company: Company) -> List[BillOfMaterial]:
        """Get all BOMs for a company."""
        return self.db.query(BillOfMaterial).filter(
            BillOfMaterial.company_id == company.id,
            BillOfMaterial.is_active == True
        ).all()
    
    def produce_from_bom(
        self,
        company: Company,
        bom_id: str,
        quantity: Decimal,
        godown_id: Optional[str] = None,
        entry_date: Optional[datetime] = None,
    ) -> StockEntry:
        """Produce finished goods using BOM (consumes raw materials)."""
        bom = self.db.query(BillOfMaterial).filter(
            BillOfMaterial.id == bom_id,
            BillOfMaterial.company_id == company.id
        ).first()
        
        if not bom:
            raise ValueError("BOM not found")
        
        # Calculate multiplier
        multiplier = quantity / bom.output_quantity
        
        # Consume raw materials
        for component in bom.components:
            required_qty = component.quantity * multiplier
            # Add waste
            if component.waste_percentage:
                required_qty = required_qty * (1 + component.waste_percentage / 100)
            
            self.record_stock_out(
                company=company,
                product_id=component.component_item_id,
                quantity=required_qty,
                godown_id=godown_id,
                reference_type="manufacturing",
                reference_id=bom.id,
                entry_date=entry_date,
                movement_type=StockMovementType.MANUFACTURING_OUT,
            )
        
        # Produce finished goods
        finished_item = self.get_stock_item(bom.finished_item_id, company)
        entry = self.record_stock_in(
            company=company,
            product_id=bom.finished_item_id,
            quantity=quantity,
            rate=finished_item.standard_cost or Decimal("0"),
            godown_id=godown_id,
            reference_type="manufacturing",
            reference_id=bom.id,
            entry_date=entry_date,
            movement_type=StockMovementType.MANUFACTURING_IN,
        )
        
        return entry
    
    # ============== Reports ==============
    
    def get_stock_summary(self, company: Company) -> Dict[str, Any]:
        """Get inventory summary statistics."""
        items = self.db.query(Product).filter(
            Product.company_id == company.id,
            Product.is_active == True,
            Product.is_service == False
        ).all()
        
        total_items = len(items)
        total_value = sum((i.current_stock or Decimal("0")) * (i.standard_cost or Decimal("0")) for i in items)
        low_stock_count = sum(1 for i in items if (i.current_stock or 0) <= (i.min_stock_level or 0))
        out_of_stock_count = sum(1 for i in items if (i.current_stock or 0) <= 0)
        
        return {
            "total_items": total_items,
            "total_value": float(total_value),
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
        }
    
    def get_stock_valuation(
        self,
        company: Company,
        as_of_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Get stock valuation report."""
        items = self.get_stock_items(company)
        
        valuation = []
        for item in items:
            qty = item.current_stock or Decimal("0")
            rate = item.standard_cost or Decimal("0")
            valuation.append({
                "item_id": item.id,
                "item_name": item.name,
                "item_code": item.code,
                "quantity": float(qty),
                "unit": item.primary_unit,
                "rate": float(rate),
                "value": float(qty * rate),
            })
        
        return valuation
