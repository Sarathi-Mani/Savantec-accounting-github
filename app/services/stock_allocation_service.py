"""
Stock Allocation Service - Handles automatic stock reduction from invoices.
"""
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Company, Invoice, InvoiceItem, Product, StockEntry, Godown,
    StockMovementType, InvoiceStatus
)


class StockAllocationService:
    """Service for managing stock allocation from invoices."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _serialize_allocation(self, allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert allocation data to JSON-serializable format.
        Converts Decimal quantities to float.
        """
        return [
            {
                "godown_id": a.get("godown_id"),
                "quantity": float(a.get("quantity", 0))
            }
            for a in allocation
        ]
    
    def get_available_stock_by_warehouse(
        self, 
        product_id: str, 
        company_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get available stock for a product across all warehouses.
        Returns: [{"godown_id": str|None, "godown_name": str, "quantity": Decimal}, ...]
        """
        # Query all stock entries for this product
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
        
        # Format results
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
        """
        Split quantity across warehouses based on company priority settings.
        Allows negative stock (no blocking).
        Returns: [{"godown_id": str|None, "quantity": Decimal}, ...]
        """
        # Get warehouse priorities
        priorities = company.warehouse_priorities or {"priority_order": ["main"]}
        priority_order = priorities.get("priority_order", ["main"])
        
        # Get available stock
        warehouse_stock = self.get_available_stock_by_warehouse(product_id, company.id)
        stock_map = {w["godown_id"]: w["quantity"] for w in warehouse_stock}
        
        allocation = []
        remaining = quantity
        
        # Allocate according to priority
        for warehouse_ref in priority_order:
            if remaining <= 0:
                break
            
            godown_id = None if warehouse_ref == "main" else warehouse_ref
            available = stock_map.get(godown_id, Decimal("0"))
            
            # Take as much as available (or all remaining if enough)
            to_allocate = min(available, remaining) if available > 0 else remaining
            
            if to_allocate > 0:
                allocation.append({
                    "godown_id": godown_id,
                    "quantity": to_allocate
                })
                remaining -= to_allocate
        
        # If still remaining (not enough stock), allocate from first warehouse (negative stock)
        if remaining > 0:
            first_warehouse = priority_order[0] if priority_order else "main"
            godown_id = None if first_warehouse == "main" else first_warehouse
            
            # Check if we already allocated from this warehouse
            existing = next((a for a in allocation if a["godown_id"] == godown_id), None)
            if existing:
                existing["quantity"] += remaining
            else:
                allocation.append({
                    "godown_id": godown_id,
                    "quantity": remaining
                })
        
        return allocation
    
    def allocate_stock_for_invoice(
        self, 
        invoice: Invoice, 
        manual_allocation: Optional[Dict[str, List[Dict[str, Any]]]] = None
    ) -> None:
        """
        Allocate warehouse stock for all items in an invoice.
        
        Args:
            invoice: The invoice to allocate stock for
            manual_allocation: Optional manual warehouse selection
                Format: {"item_0": [{"godown_id": "xxx", "quantity": 10}, ...], ...}
        """
        for idx, item in enumerate(invoice.items):
            # Skip services
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            # Use manual allocation if provided (by index or item ID)
            allocation = None
            if manual_allocation:
                # Try by item index first (item_0, item_1, etc.)
                item_key = f"item_{idx}"
                if item_key in manual_allocation and manual_allocation[item_key]:
                    allocation = manual_allocation[item_key]
                # Fall back to item ID
                elif item.id in manual_allocation:
                    allocation = manual_allocation[item.id]
            
            # Auto-allocate by priority if no manual allocation
            if not allocation:
                allocation = self.split_by_priority(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    company=invoice.company
                )
            
            # Store allocation in invoice item (serialized to avoid Decimal JSON issues)
            item.warehouse_allocation = self._serialize_allocation(allocation)
            item.stock_reserved = True
            item.stock_reduced = False
        
        self.db.commit()
    
    def reserve_stock(self, invoice_item: InvoiceItem) -> None:
        """
        Reserve stock for an invoice item (just tracking, no actual entries yet).
        This is called during invoice creation.
        """
        # Already handled in allocate_stock_for_invoice
        # This method exists for explicit reservation if needed
        if not invoice_item.warehouse_allocation:
            product = self.db.query(Product).filter(
                Product.id == invoice_item.product_id
            ).first()
            
            if product and not product.is_service:
                allocation = self.split_by_priority(
                    product_id=invoice_item.product_id,
                    quantity=invoice_item.quantity,
                    company=invoice_item.invoice.company
                )
                invoice_item.warehouse_allocation = self._serialize_allocation(allocation)
                invoice_item.stock_reserved = True
                self.db.commit()
    
    def finalize_stock_reduction(self, invoice: Invoice) -> List[StockEntry]:
        """
        Finalize stock reduction by creating actual StockEntry records.
        Called when invoice is marked as PAID.
        Also creates COGS accounting entries.
        Returns list of created stock entries.
        """
        entries = []
        
        for item in invoice.items:
            # Skip if already reduced or no allocation
            if item.stock_reduced or not item.warehouse_allocation:
                continue
            
            # Skip services
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            # Create stock entry for each warehouse allocation
            for allocation in item.warehouse_allocation:
                godown_id = allocation.get("godown_id")
                qty = Decimal(str(allocation.get("quantity", 0)))
                
                if qty == 0:
                    continue
                
                # Create stock OUT entry
                entry = StockEntry(
                    company_id=invoice.company_id,
                    product_id=item.product_id,
                    godown_id=godown_id,
                    entry_date=invoice.invoice_date or datetime.utcnow(),
                    movement_type=StockMovementType.SALE,
                    quantity=-qty,  # Negative for stock OUT
                    unit=item.unit,
                    rate=item.unit_price,
                    value=qty * item.unit_price,
                    reference_number=invoice.invoice_number,
                    notes=f"Sale via invoice {invoice.invoice_number}"
                )
                self.db.add(entry)
                entries.append(entry)
                
                # Update product current_stock
                product.current_stock = (product.current_stock or Decimal("0")) - qty
            
            # Mark item as reduced
            item.stock_reduced = True
        
        self.db.commit()
        
        # Create COGS accounting entries
        if entries:
            try:
                from app.services.accounting_service import AccountingService
                accounting_service = AccountingService(self.db)
                accounting_service.create_stock_reduction_entries(invoice, entries)
            except Exception as e:
                print(f"Warning: Failed to create COGS entries for invoice {invoice.invoice_number}: {e}")
        
        return entries
    
    def restore_stock(self, invoice: Invoice, reason: str = None) -> List[StockEntry]:
        """
        Restore stock when invoice is cancelled or refunded.
        Creates reverse stock entries to add stock back.
        Also reverses COGS accounting entries.
        Returns list of created stock entries.
        """
        # First, reverse COGS entries before modifying stock_reduced flags
        try:
            from app.services.accounting_service import AccountingService
            accounting_service = AccountingService(self.db)
            accounting_service.reverse_stock_reduction_entries(invoice, reason)
        except Exception as e:
            print(f"Warning: Failed to reverse COGS entries for invoice {invoice.invoice_number}: {e}")
        
        entries = []
        
        for item in invoice.items:
            # Only restore if stock was actually reduced
            if not item.stock_reduced or not item.warehouse_allocation:
                continue
            
            # Skip services
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            # Create reverse stock entry for each allocation
            for allocation in item.warehouse_allocation:
                godown_id = allocation.get("godown_id")
                qty = Decimal(str(allocation.get("quantity", 0)))
                
                if qty == 0:
                    continue
                
                # Create stock IN entry (reverse)
                entry = StockEntry(
                    company_id=invoice.company_id,
                    product_id=item.product_id,
                    godown_id=godown_id,
                    entry_date=datetime.utcnow(),
                    movement_type=StockMovementType.ADJUSTMENT_IN,
                    quantity=qty,  # Positive to add back
                    unit=item.unit,
                    rate=item.unit_price,
                    value=qty * item.unit_price,
                    reference_number=f"REV-{invoice.invoice_number}",
                    notes=f"Stock restored from {invoice.status.value} invoice {invoice.invoice_number}"
                )
                self.db.add(entry)
                entries.append(entry)
                
                # Update product current_stock
                product.current_stock = (product.current_stock or Decimal("0")) + qty
            
            # Mark as no longer reduced
            item.stock_reduced = False
            item.stock_reserved = False
        
        self.db.commit()
        return entries
    
    def get_allocation_summary(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Get summary of stock allocation for an invoice.
        Returns details about reserved/reduced stock per item.
        """
        summary = {
            "items": [],
            "total_reserved": 0,
            "total_reduced": 0,
        }
        
        for item in invoice.items:
            if not item.warehouse_allocation:
                continue
            
            # Get godown names
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
            
            item_summary = {
                "item_id": item.id,
                "description": item.description,
                "product_id": item.product_id,
                "quantity": float(item.quantity),
                "allocations": allocations_with_names,
                "reserved": item.stock_reserved,
                "reduced": item.stock_reduced,
            }
            summary["items"].append(item_summary)
            
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
        """
        Update warehouse priority order for a company.
        
        Args:
            company: The company to update
            priority_order: List of godown IDs or "main", in priority order
        """
        company.warehouse_priorities = {"priority_order": priority_order}
        self.db.commit()
    
    def validate_manual_allocation(
        self, 
        item_quantity: Decimal, 
        allocations: List[Dict[str, Any]]
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate that manual warehouse allocations sum to item quantity.
        
        Returns: (is_valid, error_message)
        """
        total = sum(Decimal(str(a.get("quantity", 0))) for a in allocations)
        
        if total != item_quantity:
            return False, f"Allocation total ({total}) doesn't match item quantity ({item_quantity})"
        
        return True, None
    
    def allocate_existing_invoice(
        self, 
        invoice: Invoice,
        manual_allocation: Optional[Dict[str, List[Dict[str, Any]]]] = None
    ) -> Dict[str, Any]:
        """
        Allocate stock for an existing invoice that wasn't tracked before.
        Used for legacy invoices or invoices created with auto_reduce_stock disabled.
        
        Args:
            invoice: The invoice to allocate stock for
            manual_allocation: Optional manual warehouse selection
        
        Returns:
            Summary of what was allocated
        """
        # Check if already allocated
        already_allocated = any(item.stock_reserved or item.stock_reduced for item in invoice.items)
        
        result = {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "items_allocated": 0,
            "items_skipped": 0,
            "already_tracked": already_allocated,
            "allocations": []
        }
        
        if already_allocated:
            result["message"] = "Invoice already has stock tracking"
            return result
        
        # Check invoice status - don't allocate for cancelled/void invoices
        if invoice.status in [InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.REFUNDED]:
            result["message"] = f"Cannot allocate stock for {invoice.status.value} invoice"
            return result
        
        for idx, item in enumerate(invoice.items):
            # Skip if no product linked
            if not item.product_id:
                result["items_skipped"] += 1
                continue
            
            # Skip services
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                result["items_skipped"] += 1
                continue
            
            if product.is_service:
                result["items_skipped"] += 1
                continue
            
            # Use manual allocation if provided
            allocation = None
            if manual_allocation:
                item_key = f"item_{idx}"
                if item_key in manual_allocation:
                    allocation = manual_allocation[item_key]
                elif item.id in manual_allocation:
                    allocation = manual_allocation[item.id]
            
            # Auto-allocate by priority if no manual allocation
            if not allocation:
                allocation = self.split_by_priority(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    company=invoice.company
                )
            
            # Serialize allocation to avoid Decimal JSON issues
            serialized_allocation = self._serialize_allocation(allocation)
            
            # Store allocation
            item.warehouse_allocation = serialized_allocation
            item.stock_reserved = True
            item.stock_reduced = False
            
            result["items_allocated"] += 1
            result["allocations"].append({
                "item_id": item.id,
                "description": item.description,
                "allocation": serialized_allocation
            })
        
        self.db.commit()
        
        # If invoice is already paid, finalize the stock reduction
        if invoice.status == InvoiceStatus.PAID:
            self.finalize_stock_reduction(invoice)
            result["stock_finalized"] = True
            result["message"] = "Stock allocated and reduced (invoice is paid)"
        else:
            result["stock_finalized"] = False
            result["message"] = "Stock allocated and reserved (will reduce when paid)"
        
        return result
