"""InventoryEngine - Consolidated inventory management service.

This engine consolidates:
- Stock management (from inventory_service)
- Stock allocation for invoices (from stock_allocation_service)
- Integration with VoucherEngine for COGS accounting

No circular imports - uses dependency injection for VoucherEngine.
"""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Tuple, Dict, Any, TYPE_CHECKING
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Company, Product, Godown, Batch, StockEntry, StockGroup, BillOfMaterial,
    BOMComponent, Invoice, InvoiceItem, PurchaseInvoice, PurchaseInvoiceItem,
    StockMovementType, InvoiceStatus, PurchaseInvoiceStatus
)

# Avoid circular import - only for type hints
if TYPE_CHECKING:
    from app.services.voucher_engine import VoucherEngine


class InventoryEngine:
    """Consolidated engine for all inventory operations."""
    
    def __init__(self, db: Session, voucher_engine: Optional['VoucherEngine'] = None):
        self.db = db
        self._voucher_engine = voucher_engine
    
    @property
    def voucher_engine(self) -> Optional['VoucherEngine']:
        """Lazy load voucher engine to avoid circular imports."""
        if self._voucher_engine is None:
            from app.services.voucher_engine import VoucherEngine
            self._voucher_engine = VoucherEngine(self.db)
        return self._voucher_engine
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ==================== STOCK GROUPS ====================
    
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
    
    # ==================== GODOWNS ====================
    
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
    
    # ==================== PRODUCTS/STOCK ITEMS ====================
    
    def get_product(self, product_id: str, company: Company) -> Optional[Product]:
        """Get a product by ID."""
        return self.db.query(Product).filter(
            Product.id == product_id,
            Product.company_id == company.id,
            Product.is_service == False
        ).first()
    
    def get_products(
        self,
        company: Company,
        stock_group_id: Optional[str] = None,
        search: Optional[str] = None,
        low_stock_only: bool = False,
        include_services: bool = False,
    ) -> List[Product]:
        """Get products with filters."""
        query = self.db.query(Product).filter(
            Product.company_id == company.id,
            Product.is_active == True,
        )
        
        if not include_services:
            query = query.filter(Product.is_service == False)
        
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
    
    # ==================== STOCK MOVEMENTS ====================
    
    def record_stock_in(
        self,
        company: Company,
        product_id: str,
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
        create_accounting: bool = False,
    ) -> StockEntry:
        """Record stock received (purchase, return, etc.)."""
        product = self.get_product(product_id, company)
        if not product:
            raise ValueError("Product not found")
        
        if not godown_id:
            default_godown = self.get_default_godown(company)
            if default_godown:
                godown_id = default_godown.id
        
        entry = StockEntry(
            company_id=company.id,
            product_id=product_id,
            godown_id=godown_id,
            batch_id=batch_id,
            entry_date=entry_date or datetime.utcnow(),
            movement_type=movement_type,
            quantity=quantity,
            unit=product.primary_unit or product.unit,
            rate=rate,
            value=self._round_amount(quantity * rate),
            reference_type=reference_type,
            reference_id=reference_id,
            reference_number=reference_number,
            notes=notes,
        )
        
        # Update product stock
        product.current_stock = (product.current_stock or Decimal("0")) + quantity
        
        # Update batch if applicable
        if batch_id:
            batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
            if batch:
                batch.quantity = (batch.quantity or Decimal("0")) + quantity
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        
        # Create inventory accounting entry if requested
        if create_accounting and self.voucher_engine:
            self.voucher_engine.create_stock_journal(
                company=company,
                product=product,
                quantity=quantity,
                rate=rate,
                movement_type=movement_type,
                godown_id=godown_id,
                voucher_date=entry_date,
                description=f"Stock In - {reference_number or ''}"
            )
        
        return entry
    
    def record_stock_out(
        self,
        company: Company,
        product_id: str,
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
        allow_negative: bool = True,
        create_accounting: bool = False,
    ) -> StockEntry:
        """Record stock issued (sale, consumption, etc.)."""
        product = self.get_product(product_id, company)
        if not product:
            raise ValueError("Product not found")
        
        # Check stock if negative not allowed
        if not allow_negative and (product.current_stock or Decimal("0")) < quantity:
            raise ValueError(f"Insufficient stock. Available: {product.current_stock}, Requested: {quantity}")
        
        if rate is None:
            rate = product.standard_cost or Decimal("0")
        
        entry = StockEntry(
            company_id=company.id,
            product_id=product_id,
            godown_id=godown_id,
            batch_id=batch_id,
            entry_date=entry_date or datetime.utcnow(),
            movement_type=movement_type,
            quantity=-quantity,  # Negative for out
            unit=product.primary_unit or product.unit,
            rate=rate,
            value=self._round_amount(quantity * rate),
            reference_type=reference_type,
            reference_id=reference_id,
            reference_number=reference_number,
            notes=notes,
        )
        
        # Update product stock
        product.current_stock = (product.current_stock or Decimal("0")) - quantity
        
        # Update batch if applicable
        if batch_id:
            batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
            if batch:
                batch.quantity = (batch.quantity or Decimal("0")) - quantity
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        
        # Create COGS accounting entry if requested
        if create_accounting and self.voucher_engine:
            self.voucher_engine.create_stock_journal(
                company=company,
                product=product,
                quantity=quantity,
                rate=rate,
                movement_type=movement_type,
                godown_id=godown_id,
                voucher_date=entry_date,
                description=f"Stock Out - {reference_number or ''}"
            )
        
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
        product = self.get_product(product_id, company)
        if not product:
            raise ValueError("Product not found")
        
        entry_date = entry_date or datetime.utcnow()
        rate = product.standard_cost or Decimal("0")
        
        # Create OUT entry
        out_entry = StockEntry(
            company_id=company.id,
            product_id=product_id,
            godown_id=from_godown_id,
            batch_id=batch_id,
            entry_date=entry_date,
            movement_type=StockMovementType.TRANSFER_OUT,
            quantity=-quantity,
            unit=product.primary_unit or product.unit,
            rate=rate,
            value=self._round_amount(quantity * rate),
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
            unit=product.primary_unit or product.unit,
            rate=rate,
            value=self._round_amount(quantity * rate),
            from_godown_id=from_godown_id,
            to_godown_id=to_godown_id,
            notes=notes,
        )
        
        self.db.add(out_entry)
        self.db.add(in_entry)
        self.db.commit()
        
        return out_entry, in_entry
    
    # ==================== INVOICE STOCK ALLOCATION ====================
    
    def get_available_stock_by_warehouse(
        self,
        product_id: str,
        company_id: str
    ) -> List[Dict[str, Any]]:
        """Get available stock for a product across all warehouses."""
        entries = self.db.query(StockEntry).filter(
            StockEntry.company_id == company_id,
            StockEntry.product_id == product_id
        ).all()
        
        # Aggregate by warehouse
        warehouse_stock = {}
        for entry in entries:
            godown_id = entry.godown_id or "main"
            if godown_id not in warehouse_stock:
                warehouse_stock[godown_id] = Decimal("0")
            warehouse_stock[godown_id] += entry.quantity
        
        result = []
        
        # Add main location
        if "main" in warehouse_stock and warehouse_stock["main"] != 0:
            result.append({
                "godown_id": None,
                "godown_name": "Main Location",
                "quantity": warehouse_stock["main"]
            })
        
        # Add godowns
        godowns = self.db.query(Godown).filter(
            Godown.company_id == company_id,
            Godown.is_active == True
        ).all()
        
        for godown in godowns:
            qty = warehouse_stock.get(godown.id, Decimal("0"))
            if qty != 0:
                result.append({
                    "godown_id": godown.id,
                    "godown_name": godown.name,
                    "quantity": qty
                })
        
        return result
    
    def split_by_priority(
        self,
        product_id: str,
        quantity: Decimal,
        company: Company
    ) -> List[Dict[str, Any]]:
        """Split quantity across warehouses based on priority."""
        priorities = company.warehouse_priorities or {"priority_order": ["main"]}
        priority_order = priorities.get("priority_order", ["main"])
        
        warehouse_stock = self.get_available_stock_by_warehouse(product_id, company.id)
        stock_map = {w["godown_id"]: w["quantity"] for w in warehouse_stock}
        
        allocation = []
        remaining = quantity
        
        for warehouse_ref in priority_order:
            if remaining <= 0:
                break
            
            godown_id = None if warehouse_ref == "main" else warehouse_ref
            available = stock_map.get(godown_id, Decimal("0"))
            
            to_allocate = min(available, remaining) if available > 0 else remaining
            
            if to_allocate > 0:
                allocation.append({
                    "godown_id": godown_id,
                    "quantity": to_allocate
                })
                remaining -= to_allocate
        
        # Allocate remaining from first warehouse (allows negative)
        if remaining > 0:
            first_warehouse = priority_order[0] if priority_order else "main"
            godown_id = None if first_warehouse == "main" else first_warehouse
            
            existing = next((a for a in allocation if a["godown_id"] == godown_id), None)
            if existing:
                existing["quantity"] += remaining
            else:
                allocation.append({
                    "godown_id": godown_id,
                    "quantity": remaining
                })
        
        return allocation
    
    def _serialize_allocation(self, allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Serialize allocation for JSON storage."""
        return [
            {"godown_id": a.get("godown_id"), "quantity": float(a.get("quantity", 0))}
            for a in allocation
        ]
    
    def allocate_stock_for_invoice(
        self,
        invoice: Invoice,
        manual_allocation: Optional[Dict[str, List[Dict[str, Any]]]] = None
    ) -> None:
        """Allocate warehouse stock for all items in an invoice."""
        for idx, item in enumerate(invoice.items):
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            allocation = None
            if manual_allocation:
                item_key = f"item_{idx}"
                if item_key in manual_allocation and manual_allocation[item_key]:
                    allocation = manual_allocation[item_key]
                elif item.id in manual_allocation:
                    allocation = manual_allocation[item.id]
            
            if not allocation:
                allocation = self.split_by_priority(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    company=invoice.company
                )
            
            item.warehouse_allocation = self._serialize_allocation(allocation)
            item.stock_reserved = True
            item.stock_reduced = False
        
        self.db.commit()
    
    def finalize_stock_reduction(
        self,
        invoice: Invoice,
        create_cogs_entries: bool = True
    ) -> List[StockEntry]:
        """Finalize stock reduction when invoice is PAID."""
        entries = []
        cogs_total = Decimal("0")
        
        for item in invoice.items:
            if item.stock_reduced or not item.warehouse_allocation:
                continue
            
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            for allocation in item.warehouse_allocation:
                godown_id = allocation.get("godown_id")
                qty = Decimal(str(allocation.get("quantity", 0)))
                
                if qty == 0:
                    continue
                
                cost_rate = product.standard_cost or Decimal("0")
                
                entry = StockEntry(
                    company_id=invoice.company_id,
                    product_id=item.product_id,
                    godown_id=godown_id,
                    entry_date=invoice.invoice_date or datetime.utcnow(),
                    movement_type=StockMovementType.SALE,
                    quantity=-qty,
                    unit=item.unit,
                    rate=item.unit_price,
                    value=self._round_amount(qty * item.unit_price),
                    reference_type="invoice",
                    reference_id=invoice.id,
                    reference_number=invoice.invoice_number,
                    notes=f"Sale via invoice {invoice.invoice_number}"
                )
                self.db.add(entry)
                entries.append(entry)
                
                # Update product stock
                product.current_stock = (product.current_stock or Decimal("0")) - qty
                
                # Calculate COGS
                cogs_total += qty * cost_rate
            
            item.stock_reduced = True
        
        self.db.commit()
        
        # Create COGS accounting entries
        if entries and create_cogs_entries and cogs_total > 0 and self.voucher_engine:
            try:
                from app.database.models import AccountType
                from app.services.voucher_engine import VoucherLine, VoucherType
                
                company = invoice.company
                
                cogs_account = self.voucher_engine.get_or_create_account(
                    company, "5200", "Cost of Goods Sold", AccountType.EXPENSE
                )
                inventory_account = self.voucher_engine.get_or_create_account(
                    company, "1200", "Inventory", AccountType.ASSET
                )
                
                self.voucher_engine.create_voucher(
                    company=company,
                    voucher_type=VoucherType.STOCK_JOURNAL,
                    entries=[
                        VoucherLine(
                            account_id=cogs_account.id,
                            debit_amount=self._round_amount(cogs_total),
                            description=f"COGS - Invoice {invoice.invoice_number}"
                        ),
                        VoucherLine(
                            account_id=inventory_account.id,
                            credit_amount=self._round_amount(cogs_total),
                            description=f"Inventory reduction - {invoice.invoice_number}"
                        ),
                    ],
                    voucher_date=invoice.invoice_date,
                    description=f"COGS for Invoice {invoice.invoice_number}",
                )
            except Exception as e:
                print(f"Warning: Failed to create COGS entries: {e}")
        
        return entries
    
    def restore_stock(
        self,
        invoice: Invoice,
        reason: Optional[str] = None
    ) -> List[StockEntry]:
        """Restore stock when invoice is cancelled."""
        entries = []
        
        for item in invoice.items:
            if not item.stock_reduced or not item.warehouse_allocation:
                continue
            
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            for allocation in item.warehouse_allocation:
                godown_id = allocation.get("godown_id")
                qty = Decimal(str(allocation.get("quantity", 0)))
                
                if qty == 0:
                    continue
                
                entry = StockEntry(
                    company_id=invoice.company_id,
                    product_id=item.product_id,
                    godown_id=godown_id,
                    entry_date=datetime.utcnow(),
                    movement_type=StockMovementType.ADJUSTMENT,
                    quantity=qty,
                    unit=item.unit,
                    rate=item.unit_price,
                    value=self._round_amount(qty * item.unit_price),
                    reference_type="invoice_reversal",
                    reference_id=invoice.id,
                    reference_number=f"REV-{invoice.invoice_number}",
                    notes=f"Stock restored: {reason or invoice.status.value}"
                )
                self.db.add(entry)
                entries.append(entry)
                
                product.current_stock = (product.current_stock or Decimal("0")) + qty
            
            item.stock_reduced = False
            item.stock_reserved = False
        
        self.db.commit()
        return entries
    
    # ==================== PURCHASE INVOICE STOCK ====================
    
    def receive_stock_for_purchase(
        self,
        purchase_invoice: PurchaseInvoice,
        godown_id: Optional[str] = None,
    ) -> List[StockEntry]:
        """Receive stock for a purchase invoice."""
        entries = []
        
        for item in purchase_invoice.items:
            if item.stock_received or not item.product_id:
                continue
            
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            target_godown = godown_id or item.godown_id
            
            entry = StockEntry(
                company_id=purchase_invoice.company_id,
                product_id=item.product_id,
                godown_id=target_godown,
                entry_date=purchase_invoice.invoice_date,
                movement_type=StockMovementType.PURCHASE,
                quantity=item.quantity,
                unit=item.unit,
                rate=item.unit_price,
                value=self._round_amount(item.quantity * item.unit_price),
                reference_type="purchase_invoice",
                reference_id=purchase_invoice.id,
                reference_number=purchase_invoice.invoice_number,
                notes=f"Purchase from {purchase_invoice.vendor.name if purchase_invoice.vendor else 'Vendor'}"
            )
            self.db.add(entry)
            entries.append(entry)
            
            # Update product stock
            product.current_stock = (product.current_stock or Decimal("0")) + item.quantity
            
            item.stock_received = True
            item.godown_id = target_godown
        
        self.db.commit()
        return entries
    
    # ==================== BATCHES ====================
    
    def create_batch(
        self,
        product_id: str,
        batch_number: str,
        manufacturing_date: Optional[datetime] = None,
        expiry_date: Optional[datetime] = None,
        quantity: Decimal = Decimal("0"),
        cost_price: Decimal = Decimal("0"),
    ) -> Batch:
        """Create a new batch."""
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
    
    # ==================== BOM ====================
    
    def create_bom(
        self,
        company: Company,
        finished_item_id: str,
        name: str,
        output_quantity: Decimal = Decimal("1"),
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> BillOfMaterial:
        """Create a Bill of Material."""
        bom = BillOfMaterial(
            company_id=company.id,
            finished_item_id=finished_item_id,
            name=name,
            output_quantity=output_quantity,
        )
        self.db.add(bom)
        self.db.flush()
        
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
    
    def produce_from_bom(
        self,
        company: Company,
        bom_id: str,
        quantity: Decimal,
        godown_id: Optional[str] = None,
        entry_date: Optional[datetime] = None,
    ) -> StockEntry:
        """Produce finished goods using BOM."""
        bom = self.db.query(BillOfMaterial).filter(
            BillOfMaterial.id == bom_id,
            BillOfMaterial.company_id == company.id
        ).first()
        
        if not bom:
            raise ValueError("BOM not found")
        
        multiplier = quantity / bom.output_quantity
        
        # Consume raw materials
        for component in bom.components:
            required_qty = component.quantity * multiplier
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
        finished_item = self.get_product(bom.finished_item_id, company)
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
    
    # ==================== REPORTS ====================
    
    def get_stock_summary(self, company: Company) -> Dict[str, Any]:
        """Get inventory summary."""
        items = self.db.query(Product).filter(
            Product.company_id == company.id,
            Product.is_active == True,
            Product.is_service == False
        ).all()
        
        total_items = len(items)
        total_value = sum(
            (i.current_stock or Decimal("0")) * (i.standard_cost or Decimal("0"))
            for i in items
        )
        low_stock_count = sum(
            1 for i in items
            if (i.current_stock or 0) <= (i.min_stock_level or 0)
        )
        out_of_stock_count = sum(
            1 for i in items
            if (i.current_stock or 0) <= 0
        )
        
        return {
            "total_items": total_items,
            "total_value": float(total_value),
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
        }
    
    def get_allocation_summary(self, invoice: Invoice) -> Dict[str, Any]:
        """Get stock allocation summary for an invoice."""
        summary = {
            "items": [],
            "total_reserved": 0,
            "total_reduced": 0,
        }
        
        for item in invoice.items:
            if not item.warehouse_allocation:
                continue
            
            allocations_with_names = []
            for alloc in item.warehouse_allocation:
                godown_id = alloc.get("godown_id")
                qty = alloc.get("quantity", 0)
                
                if godown_id:
                    godown = self.db.query(Godown).filter(Godown.id == godown_id).first()
                    godown_name = godown.name if godown else "Unknown"
                else:
                    godown_name = "Main Location"
                
                allocations_with_names.append({
                    "godown_id": godown_id,
                    "godown_name": godown_name,
                    "quantity": float(qty)
                })
            
            summary["items"].append({
                "item_id": item.id,
                "description": item.description,
                "product_id": item.product_id,
                "quantity": float(item.quantity),
                "allocations": allocations_with_names,
                "reserved": item.stock_reserved,
                "reduced": item.stock_reduced,
            })
            
            if item.stock_reserved:
                summary["total_reserved"] += 1
            if item.stock_reduced:
                summary["total_reduced"] += 1
        
        return summary
    
    def update_warehouse_priorities(
        self,
        company: Company,
        priority_order: List[str]
    ) -> None:
        """Update warehouse priority order."""
        company.warehouse_priorities = {"priority_order": priority_order}
        self.db.commit()
