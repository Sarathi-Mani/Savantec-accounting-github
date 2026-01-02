"""Delivery Challan service for goods dispatch (DC Out) and returns (DC In)."""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from app.database.models import (
    DeliveryChallan, DeliveryChallanItem, DeliveryChallanType, DeliveryChallanStatus,
    Company, Customer, Product, Invoice, InvoiceItem, Quotation, SalesOrder,
    StockEntry, StockMovementType, Godown, Batch,
    generate_uuid
)


class DeliveryChallanService:
    """Service for delivery challan operations with stock management."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round amount to 2 decimal places."""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def _get_next_dc_number(self, company: Company, dc_type: DeliveryChallanType) -> str:
        """Generate next DC number."""
        prefix = "DCO" if dc_type == DeliveryChallanType.DC_OUT else "DCI"
        current_year = datetime.now().year
        
        last_dc = self.db.query(DeliveryChallan).filter(
            DeliveryChallan.company_id == company.id,
            DeliveryChallan.dc_type == dc_type,
            func.extract('year', DeliveryChallan.dc_date) == current_year
        ).order_by(DeliveryChallan.dc_number.desc()).first()
        
        if last_dc and last_dc.dc_number:
            try:
                last_num = int(last_dc.dc_number.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        return f"{prefix}-{current_year}-{next_num:04d}"
    
    def create_dc_out(
        self,
        company: Company,
        items: List[Dict[str, Any]],
        customer_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
        quotation_id: Optional[str] = None,
        sales_order_id: Optional[str] = None,
        dc_date: Optional[datetime] = None,
        from_godown_id: Optional[str] = None,
        transporter_name: Optional[str] = None,
        vehicle_number: Optional[str] = None,
        eway_bill_number: Optional[str] = None,
        delivery_address: Optional[Dict[str, str]] = None,
        notes: Optional[str] = None,
        auto_update_stock: bool = True,
    ) -> DeliveryChallan:
        """
        Create a DC Out (Delivery Challan for goods dispatch).
        
        Can be created:
        1. From an invoice (goods dispatch after invoicing)
        2. Standalone (goods sent before invoicing, like consignment)
        3. From quotation or sales order
        """
        # Get customer from linked documents if not provided
        if not customer_id:
            if invoice_id:
                invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
                if invoice:
                    customer_id = invoice.customer_id
            elif quotation_id:
                quotation = self.db.query(Quotation).filter(Quotation.id == quotation_id).first()
                if quotation:
                    customer_id = quotation.customer_id
            elif sales_order_id:
                sales_order = self.db.query(SalesOrder).filter(SalesOrder.id == sales_order_id).first()
                if sales_order:
                    customer_id = sales_order.customer_id
        
        # Create delivery challan
        dc = DeliveryChallan(
            id=generate_uuid(),
            company_id=company.id,
            customer_id=customer_id,
            dc_number=self._get_next_dc_number(company, DeliveryChallanType.DC_OUT),
            dc_date=dc_date or datetime.utcnow(),
            dc_type=DeliveryChallanType.DC_OUT,
            status=DeliveryChallanStatus.DRAFT,
            invoice_id=invoice_id,
            quotation_id=quotation_id,
            sales_order_id=sales_order_id,
            from_godown_id=from_godown_id,
            transporter_name=transporter_name,
            vehicle_number=vehicle_number,
            eway_bill_number=eway_bill_number,
            notes=notes,
        )
        
        # Set delivery address
        if delivery_address:
            dc.delivery_to_address = delivery_address.get("address")
            dc.delivery_to_city = delivery_address.get("city")
            dc.delivery_to_state = delivery_address.get("state")
            dc.delivery_to_pincode = delivery_address.get("pincode")
        elif customer_id:
            # Use customer's shipping address
            customer = self.db.query(Customer).filter(Customer.id == customer_id).first()
            if customer:
                dc.delivery_to_address = customer.shipping_address or customer.billing_address
                dc.delivery_to_city = customer.shipping_city or customer.billing_city
                dc.delivery_to_state = customer.shipping_state or customer.billing_state
                dc.delivery_to_pincode = customer.shipping_pincode or customer.billing_pincode
        
        # Set dispatch address from godown or company
        if from_godown_id:
            godown = self.db.query(Godown).filter(Godown.id == from_godown_id).first()
            if godown:
                dc.dispatch_from_address = godown.address
                dc.dispatch_from_city = godown.city
                dc.dispatch_from_state = godown.state
                dc.dispatch_from_pincode = godown.pincode
        else:
            dc.dispatch_from_address = company.address
            dc.dispatch_from_city = company.city
            dc.dispatch_from_state = company.state
            dc.dispatch_from_pincode = company.pincode
        
        self.db.add(dc)
        self.db.flush()
        
        # Add items
        for item_data in items:
            product_id = item_data.get("product_id")
            product = None
            if product_id:
                product = self.db.query(Product).filter(Product.id == product_id).first()
            
            qty = Decimal(str(item_data.get("quantity", 0)))
            
            dc_item = DeliveryChallanItem(
                id=generate_uuid(),
                delivery_challan_id=dc.id,
                product_id=product_id,
                invoice_item_id=item_data.get("invoice_item_id"),
                batch_id=item_data.get("batch_id"),
                description=item_data.get("description") or (product.name if product else "Item"),
                hsn_code=item_data.get("hsn_code") or (product.hsn_code if product else None),
                quantity=qty,
                unit=item_data.get("unit") or (product.unit if product else "unit"),
                unit_price=Decimal(str(item_data.get("unit_price", 0))),
                godown_id=item_data.get("godown_id") or from_godown_id,
                serial_numbers=item_data.get("serial_numbers"),
                notes=item_data.get("notes"),
            )
            self.db.add(dc_item)
        
        self.db.commit()
        self.db.refresh(dc)
        
        # Update stock if requested
        if auto_update_stock:
            self.update_stock_for_dc(dc)
        
        return dc
    
    def create_dc_in(
        self,
        company: Company,
        items: List[Dict[str, Any]],
        customer_id: Optional[str] = None,
        original_dc_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
        dc_date: Optional[datetime] = None,
        to_godown_id: Optional[str] = None,
        return_reason: Optional[str] = None,
        notes: Optional[str] = None,
        auto_update_stock: bool = True,
    ) -> DeliveryChallan:
        """
        Create a DC In (Delivery Challan for goods return).
        
        Used when customer returns goods.
        """
        # Get info from original DC if provided
        original_dc = None
        if original_dc_id:
            original_dc = self.db.query(DeliveryChallan).filter(
                DeliveryChallan.id == original_dc_id
            ).first()
            if original_dc and not customer_id:
                customer_id = original_dc.customer_id
            if original_dc and not invoice_id:
                invoice_id = original_dc.invoice_id
        
        # Create return challan
        dc = DeliveryChallan(
            id=generate_uuid(),
            company_id=company.id,
            customer_id=customer_id,
            dc_number=self._get_next_dc_number(company, DeliveryChallanType.DC_IN),
            dc_date=dc_date or datetime.utcnow(),
            dc_type=DeliveryChallanType.DC_IN,
            status=DeliveryChallanStatus.DRAFT,
            invoice_id=invoice_id,
            original_dc_id=original_dc_id,
            return_reason=return_reason,
            to_godown_id=to_godown_id,
            notes=notes,
        )
        
        self.db.add(dc)
        self.db.flush()
        
        # Add return items
        for item_data in items:
            product_id = item_data.get("product_id")
            product = None
            if product_id:
                product = self.db.query(Product).filter(Product.id == product_id).first()
            
            qty = Decimal(str(item_data.get("quantity", 0)))
            
            dc_item = DeliveryChallanItem(
                id=generate_uuid(),
                delivery_challan_id=dc.id,
                product_id=product_id,
                batch_id=item_data.get("batch_id"),
                description=item_data.get("description") or (product.name if product else "Item"),
                hsn_code=item_data.get("hsn_code") or (product.hsn_code if product else None),
                quantity=qty,
                unit=item_data.get("unit") or (product.unit if product else "unit"),
                unit_price=Decimal(str(item_data.get("unit_price", 0))),
                godown_id=item_data.get("godown_id") or to_godown_id,
                serial_numbers=item_data.get("serial_numbers"),
                notes=item_data.get("notes"),
            )
            self.db.add(dc_item)
        
        self.db.commit()
        self.db.refresh(dc)
        
        # Update stock if requested
        if auto_update_stock:
            self.update_stock_for_dc(dc)
        
        return dc
    
    def update_stock_for_dc(self, dc: DeliveryChallan) -> List[StockEntry]:
        """
        Update stock based on delivery challan.
        
        DC Out: Reduces stock (stock goes out)
        DC In: Increases stock (stock comes back)
        """
        if dc.stock_updated:
            return []
        
        entries = []
        company = self.db.query(Company).filter(Company.id == dc.company_id).first()
        
        for item in dc.items:
            if not item.product_id:
                continue
            
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product or product.is_service:
                continue
            
            qty = Decimal(str(item.quantity))
            
            # Determine movement type based on DC type
            if dc.dc_type == DeliveryChallanType.DC_OUT:
                movement_type = StockMovementType.SALE
                qty = -abs(qty)  # Negative for stock out
                notes = f"DC Out - {dc.dc_number}"
            else:  # DC_IN (return)
                movement_type = StockMovementType.ADJUSTMENT_IN
                qty = abs(qty)  # Positive for stock in
                notes = f"DC In (Return) - {dc.dc_number}"
            
            godown_id = item.godown_id or dc.from_godown_id or dc.to_godown_id
            
            # Create stock entry
            entry = StockEntry(
                id=generate_uuid(),
                company_id=dc.company_id,
                product_id=item.product_id,
                godown_id=godown_id,
                batch_id=item.batch_id,
                entry_date=dc.dc_date,
                movement_type=movement_type,
                quantity=qty,
                unit=item.unit,
                rate=item.unit_price,
                value=abs(qty) * item.unit_price,
                reference_type="delivery_challan",
                reference_id=dc.id,
                reference_number=dc.dc_number,
                notes=notes,
            )
            self.db.add(entry)
            entries.append(entry)
            
            # Update product stock
            if product.current_stock is not None:
                product.current_stock = product.current_stock + qty
            else:
                product.current_stock = qty
            
            # Link stock entry to item
            item.stock_movement_id = entry.id
        
        # Mark DC as stock updated
        dc.stock_updated = True
        dc.stock_updated_at = datetime.utcnow()
        
        self.db.commit()
        
        return entries
    
    def create_dc_from_invoice(
        self,
        invoice: Invoice,
        from_godown_id: Optional[str] = None,
        items: Optional[List[Dict[str, Any]]] = None,
        partial_dispatch: bool = False,
    ) -> DeliveryChallan:
        """
        Create a DC Out from an invoice.
        
        If partial_dispatch=True, only specified items/quantities are dispatched.
        Otherwise, all invoice items are included.
        """
        company = self.db.query(Company).filter(Company.id == invoice.company_id).first()
        
        # Prepare items
        dc_items = []
        
        if items and partial_dispatch:
            # Use specified items for partial dispatch
            dc_items = items
        else:
            # Include all invoice items
            for inv_item in invoice.items:
                dc_items.append({
                    "product_id": inv_item.product_id,
                    "invoice_item_id": inv_item.id,
                    "description": inv_item.description,
                    "hsn_code": inv_item.hsn_code,
                    "quantity": float(inv_item.quantity),
                    "unit": inv_item.unit,
                    "unit_price": float(inv_item.unit_price),
                })
        
        return self.create_dc_out(
            company=company,
            items=dc_items,
            customer_id=invoice.customer_id,
            invoice_id=invoice.id,
            from_godown_id=from_godown_id,
        )
    
    def mark_dispatched(self, dc: DeliveryChallan) -> DeliveryChallan:
        """Mark DC as dispatched."""
        if dc.status not in [DeliveryChallanStatus.DRAFT]:
            raise ValueError("Can only dispatch DCs in DRAFT status")
        
        dc.status = DeliveryChallanStatus.DISPATCHED
        dc.updated_at = datetime.utcnow()
        
        # Update stock if not already done
        if not dc.stock_updated:
            self.update_stock_for_dc(dc)
        
        self.db.commit()
        self.db.refresh(dc)
        
        return dc
    
    def mark_in_transit(
        self,
        dc: DeliveryChallan,
        vehicle_number: Optional[str] = None,
        lr_number: Optional[str] = None,
    ) -> DeliveryChallan:
        """Mark DC as in transit."""
        dc.status = DeliveryChallanStatus.IN_TRANSIT
        if vehicle_number:
            dc.vehicle_number = vehicle_number
        if lr_number:
            dc.lr_number = lr_number
        dc.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(dc)
        
        return dc
    
    def mark_delivered(
        self,
        dc: DeliveryChallan,
        delivered_at: Optional[datetime] = None,
        received_by: Optional[str] = None,
    ) -> DeliveryChallan:
        """Mark DC as delivered."""
        dc.status = DeliveryChallanStatus.DELIVERED
        dc.delivered_at = delivered_at or datetime.utcnow()
        dc.received_by = received_by
        dc.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(dc)
        
        return dc
    
    def link_to_invoice(
        self,
        dc: DeliveryChallan,
        invoice_id: str,
    ) -> DeliveryChallan:
        """Link a standalone DC to an invoice."""
        dc.invoice_id = invoice_id
        dc.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(dc)
        
        return dc
    
    def cancel_dc(self, dc: DeliveryChallan, reason: Optional[str] = None) -> DeliveryChallan:
        """
        Cancel a delivery challan.
        
        If stock was updated, creates reverse stock entries.
        """
        if dc.status == DeliveryChallanStatus.CANCELLED:
            raise ValueError("DC is already cancelled")
        
        # If stock was updated, reverse it
        if dc.stock_updated:
            self._reverse_stock_entries(dc)
        
        dc.status = DeliveryChallanStatus.CANCELLED
        if reason:
            dc.notes = f"{dc.notes or ''}\nCancelled: {reason}".strip()
        dc.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(dc)
        
        return dc
    
    def _reverse_stock_entries(self, dc: DeliveryChallan):
        """Create reverse stock entries for a cancelled DC."""
        for item in dc.items:
            if not item.product_id or not item.stock_movement_id:
                continue
            
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                continue
            
            # Get original entry
            original_entry = self.db.query(StockEntry).filter(
                StockEntry.id == item.stock_movement_id
            ).first()
            
            if not original_entry:
                continue
            
            # Create reverse entry
            reverse_qty = -Decimal(str(original_entry.quantity))
            
            reverse_entry = StockEntry(
                id=generate_uuid(),
                company_id=dc.company_id,
                product_id=item.product_id,
                godown_id=original_entry.godown_id,
                batch_id=item.batch_id,
                entry_date=datetime.utcnow(),
                movement_type=StockMovementType.ADJUSTMENT_IN if original_entry.quantity < 0 else StockMovementType.ADJUSTMENT_OUT,
                quantity=reverse_qty,
                unit=item.unit,
                rate=item.unit_price,
                value=abs(reverse_qty) * item.unit_price,
                reference_type="delivery_challan_reversal",
                reference_id=dc.id,
                reference_number=f"REV-{dc.dc_number}",
                notes=f"Reversal of {dc.dc_number}",
            )
            self.db.add(reverse_entry)
            
            # Update product stock
            if product.current_stock is not None:
                product.current_stock = product.current_stock + reverse_qty
        
        dc.stock_updated = False
    
    def list_delivery_challans(
        self,
        company_id: str,
        dc_type: Optional[DeliveryChallanType] = None,
        status: Optional[DeliveryChallanStatus] = None,
        customer_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """List delivery challans with filters."""
        query = self.db.query(DeliveryChallan).filter(
            DeliveryChallan.company_id == company_id
        )
        
        if dc_type:
            query = query.filter(DeliveryChallan.dc_type == dc_type)
        if status:
            query = query.filter(DeliveryChallan.status == status)
        if customer_id:
            query = query.filter(DeliveryChallan.customer_id == customer_id)
        if invoice_id:
            query = query.filter(DeliveryChallan.invoice_id == invoice_id)
        if from_date:
            query = query.filter(DeliveryChallan.dc_date >= from_date)
        if to_date:
            query = query.filter(DeliveryChallan.dc_date <= to_date)
        
        total = query.count()
        
        dcs = query.order_by(DeliveryChallan.dc_date.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return {
            "items": dcs,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    
    def get_delivery_challan(
        self,
        company_id: str,
        dc_id: str,
    ) -> Optional[DeliveryChallan]:
        """Get a single delivery challan by ID."""
        return self.db.query(DeliveryChallan).filter(
            DeliveryChallan.id == dc_id,
            DeliveryChallan.company_id == company_id,
        ).first()
    
    def get_pending_dispatches(self, company_id: str) -> List[Invoice]:
        """Get invoices that don't have associated DCs yet."""
        # Get invoice IDs that already have DCs
        dc_invoice_ids = self.db.query(DeliveryChallan.invoice_id).filter(
            DeliveryChallan.company_id == company_id,
            DeliveryChallan.invoice_id.isnot(None),
            DeliveryChallan.dc_type == DeliveryChallanType.DC_OUT,
            DeliveryChallan.status != DeliveryChallanStatus.CANCELLED,
        ).subquery()
        
        # Get invoices without DCs
        from app.database.models import InvoiceStatus
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company_id,
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID]),
            ~Invoice.id.in_(dc_invoice_ids),
        ).order_by(Invoice.invoice_date.desc()).all()
        
        return invoices
    
    def get_dcs_for_invoice(self, invoice_id: str) -> List[DeliveryChallan]:
        """Get all DCs linked to an invoice."""
        return self.db.query(DeliveryChallan).filter(
            DeliveryChallan.invoice_id == invoice_id,
        ).order_by(DeliveryChallan.dc_date.desc()).all()
    
    def delete_dc(self, dc: DeliveryChallan) -> bool:
        """Delete a delivery challan (only if in DRAFT status and stock not updated)."""
        if dc.status != DeliveryChallanStatus.DRAFT:
            raise ValueError("Can only delete DCs in DRAFT status")
        
        if dc.stock_updated:
            raise ValueError("Cannot delete DC with stock updates. Cancel it instead.")
        
        self.db.delete(dc)
        self.db.commit()
        return True

