"""Order Service - Sales and Purchase order management."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Company, Customer, Product, SalesOrder, SalesOrderItem,
    PurchaseOrder, PurchaseOrderItem, DeliveryNote, DeliveryNoteItem,
    ReceiptNote, ReceiptNoteItem, Godown, OrderStatus
)
from app.services.inventory_service import InventoryService
from app.services.voucher_engine import VoucherEngine


class OrderService:
    """Service for managing sales and purchase orders."""
    
    def __init__(self, db: Session):
        self.db = db
        self.inventory_service = InventoryService(db)
    
    # ============== Sales Orders ==============
    
    def create_sales_order(
        self,
        company: Company,
        customer_id: str,
        items: List[Dict[str, Any]],
        order_date: Optional[datetime] = None,
        expected_delivery_date: Optional[datetime] = None,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
    ) -> SalesOrder:
        """Create a new sales order."""
        # Generate order number
        order_count = self.db.query(SalesOrder).filter(
            SalesOrder.company_id == company.id
        ).count()
        order_number = f"SO-{order_count + 1:05d}"
        
        order = SalesOrder(
            company_id=company.id,
            customer_id=customer_id,
            order_number=order_number,
            order_date=order_date or datetime.utcnow(),
            expected_delivery_date=expected_delivery_date,
            status=OrderStatus.DRAFT,
            notes=notes,
            terms=terms,
        )
        
        self.db.add(order)
        self.db.flush()
        
        subtotal = Decimal("0")
        total_tax = Decimal("0")
        total_qty = Decimal("0")
        
        for item_data in items:
            qty = Decimal(str(item_data.get("quantity", 0)))
            rate = Decimal(str(item_data.get("rate", 0)))
            gst_rate = Decimal(str(item_data.get("gst_rate", 18)))
            
            taxable_amount = qty * rate
            tax_amount = taxable_amount * gst_rate / 100
            total_amount = taxable_amount + tax_amount
            
            item = SalesOrderItem(
                order_id=order.id,
                product_id=item_data.get("product_id"),  # Unified Product model
                description=item_data.get("description", ""),
                quantity=qty,
                unit=item_data.get("unit", "Nos"),
                rate=rate,
                quantity_pending=qty,
                gst_rate=gst_rate,
                tax_amount=tax_amount,
                total_amount=total_amount,
            )
            self.db.add(item)
            
            subtotal += taxable_amount
            total_tax += tax_amount
            total_qty += qty
        
        order.subtotal = subtotal
        order.tax_amount = total_tax
        order.total_amount = subtotal + total_tax
        order.quantity_ordered = total_qty
        
        self.db.commit()
        self.db.refresh(order)
        return order
    
    def get_sales_orders(
        self,
        company: Company,
        customer_id: Optional[str] = None,
        status: Optional[OrderStatus] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> List[SalesOrder]:
        """Get sales orders with filters."""
        query = self.db.query(SalesOrder).filter(
            SalesOrder.company_id == company.id
        )
        
        if customer_id:
            query = query.filter(SalesOrder.customer_id == customer_id)
        if status:
            query = query.filter(SalesOrder.status == status)
        if from_date:
            query = query.filter(SalesOrder.order_date >= from_date)
        if to_date:
            query = query.filter(SalesOrder.order_date <= to_date)
        
        return query.order_by(SalesOrder.order_date.desc()).all()
    
    def get_sales_order(self, order_id: str, company: Company) -> Optional[SalesOrder]:
        """Get a sales order by ID."""
        return self.db.query(SalesOrder).filter(
            SalesOrder.id == order_id,
            SalesOrder.company_id == company.id
        ).first()
    
    def confirm_sales_order(self, order: SalesOrder, create_voucher: bool = True) -> SalesOrder:
        """Confirm a sales order and optionally create accounting entries.
        
        When confirmed, creates the following accounting entries:
        - Dr. Accounts Receivable (Total amount)
        - Cr. Sales A/c (Subtotal)
        - Cr. Output CGST A/c (CGST amount)
        - Cr. Output SGST A/c (SGST amount)
        """
        order.status = OrderStatus.CONFIRMED
        
        # Create accounting voucher
        if create_voucher and order.total_amount and order.total_amount > 0:
            try:
                company = self.db.query(Company).filter(Company.id == order.company_id).first()
                if company:
                    voucher_engine = VoucherEngine(self.db)
                    result = voucher_engine.create_sales_order_voucher(company, order)
                    if not result.success:
                        print(f"Warning: Failed to create voucher for SO {order.order_number}: {result.error}")
            except Exception as e:
                print(f"Warning: Error creating voucher for SO {order.order_number}: {e}")
        
        self.db.commit()
        self.db.refresh(order)
        return order
    
    def cancel_sales_order(self, order: SalesOrder) -> SalesOrder:
        """Cancel a sales order."""
        order.status = OrderStatus.CANCELLED
        self.db.commit()
        self.db.refresh(order)
        return order
    
    # ============== Purchase Orders ==============
    
    def create_purchase_order(
        self,
        company: Company,
        vendor_id: str,
        items: List[Dict[str, Any]],
        order_date: Optional[datetime] = None,
        expected_date: Optional[datetime] = None,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
    ) -> PurchaseOrder:
        """Create a new purchase order."""
        order_count = self.db.query(PurchaseOrder).filter(
            PurchaseOrder.company_id == company.id
        ).count()
        order_number = f"PO-{order_count + 1:05d}"
        
        order = PurchaseOrder(
            company_id=company.id,
            vendor_id=vendor_id,
            order_number=order_number,
            order_date=order_date or datetime.utcnow(),
            expected_date=expected_date,
            status=OrderStatus.DRAFT,
            notes=notes,
            terms=terms,
        )
        
        self.db.add(order)
        self.db.flush()
        
        subtotal = Decimal("0")
        total_tax = Decimal("0")
        total_qty = Decimal("0")
        
        for item_data in items:
            qty = Decimal(str(item_data.get("quantity", 0)))
            rate = Decimal(str(item_data.get("rate", 0)))
            gst_rate = Decimal(str(item_data.get("gst_rate", 18)))
            
            taxable_amount = qty * rate
            tax_amount = taxable_amount * gst_rate / 100
            total_amount = taxable_amount + tax_amount
            
            item = PurchaseOrderItem(
                order_id=order.id,
                product_id=item_data.get("product_id"),  # Unified Product model
                description=item_data.get("description", ""),
                quantity=qty,
                unit=item_data.get("unit", "Nos"),
                rate=rate,
                quantity_pending=qty,
                gst_rate=gst_rate,
                tax_amount=tax_amount,
                total_amount=total_amount,
            )
            self.db.add(item)
            
            subtotal += taxable_amount
            total_tax += tax_amount
            total_qty += qty
        
        order.subtotal = subtotal
        order.tax_amount = total_tax
        order.total_amount = subtotal + total_tax
        order.quantity_ordered = total_qty
        
        self.db.commit()
        self.db.refresh(order)
        return order
    
    def get_purchase_orders(
        self,
        company: Company,
        vendor_id: Optional[str] = None,
        status: Optional[OrderStatus] = None,
    ) -> List[PurchaseOrder]:
        """Get purchase orders with filters."""
        query = self.db.query(PurchaseOrder).filter(
            PurchaseOrder.company_id == company.id
        )
        
        if vendor_id:
            query = query.filter(PurchaseOrder.vendor_id == vendor_id)
        if status:
            query = query.filter(PurchaseOrder.status == status)
        
        return query.order_by(PurchaseOrder.order_date.desc()).all()
    
    def get_purchase_order(self, order_id: str, company: Company) -> Optional[PurchaseOrder]:
        """Get a purchase order by ID."""
        return self.db.query(PurchaseOrder).filter(
            PurchaseOrder.id == order_id,
            PurchaseOrder.company_id == company.id
        ).first()
    
    def get_purchase_order_with_items(self, order_id: str, company: Company) -> Optional[PurchaseOrder]:
        """Get a purchase order by ID with items eagerly loaded."""
        from sqlalchemy.orm import joinedload
        return self.db.query(PurchaseOrder).options(
            joinedload(PurchaseOrder.items)
        ).filter(
            PurchaseOrder.id == order_id,
            PurchaseOrder.company_id == company.id
        ).first()
    
    def update_purchase_order(
        self,
        order: PurchaseOrder,
        vendor_id: Optional[str] = None,
        items: Optional[List[Dict[str, Any]]] = None,
        order_date: Optional[datetime] = None,
        expected_date: Optional[datetime] = None,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
    ) -> PurchaseOrder:
        """Update an existing purchase order."""
        # Update basic fields if provided
        if vendor_id is not None:
            order.vendor_id = vendor_id
        if order_date is not None:
            order.order_date = order_date
        if expected_date is not None:
            order.expected_date = expected_date
        if notes is not None:
            order.notes = notes
        if terms is not None:
            order.terms = terms
        
        # Update items if provided
        if items is not None:
            # Delete existing items
            self.db.query(PurchaseOrderItem).filter(
                PurchaseOrderItem.order_id == order.id
            ).delete()
            
            # Add new items
            subtotal = Decimal("0")
            total_tax = Decimal("0")
            total_qty = Decimal("0")
            
            for item_data in items:
                qty = Decimal(str(item_data.get("quantity", 0)))
                rate = Decimal(str(item_data.get("rate", 0)))
                gst_rate = Decimal(str(item_data.get("gst_rate", 18)))
                
                taxable_amount = qty * rate
                tax_amount = taxable_amount * gst_rate / 100
                total_amount = taxable_amount + tax_amount
                
                item = PurchaseOrderItem(
                    order_id=order.id,
                    product_id=item_data.get("product_id"),
                    description=item_data.get("description", ""),
                    quantity=qty,
                    unit=item_data.get("unit", "Nos"),
                    rate=rate,
                    quantity_pending=qty,
                    gst_rate=gst_rate,
                    tax_amount=tax_amount,
                    total_amount=total_amount,
                )
                self.db.add(item)
                
                subtotal += taxable_amount
                total_tax += tax_amount
                total_qty += qty
            
            order.subtotal = subtotal
            order.tax_amount = total_tax
            order.total_amount = subtotal + total_tax
            order.quantity_ordered = total_qty
        
        self.db.commit()
        self.db.refresh(order)
        return order
    
    def confirm_purchase_order(self, order: PurchaseOrder, create_voucher: bool = True) -> PurchaseOrder:
        """Confirm a purchase order and optionally create accounting entries.
        
        When confirmed, creates the following accounting entries:
        - Dr. Purchases A/c (Subtotal)
        - Dr. Input CGST A/c (CGST amount)
        - Dr. Input SGST A/c (SGST amount)
        - Cr. Accounts Payable (Total amount)
        """
        order.status = OrderStatus.CONFIRMED
        
        # Create accounting voucher
        if create_voucher and order.total_amount and order.total_amount > 0:
            try:
                company = self.db.query(Company).filter(Company.id == order.company_id).first()
                if company:
                    voucher_engine = VoucherEngine(self.db)
                    result = voucher_engine.create_purchase_order_voucher(company, order)
                    if not result.success:
                        # Log but don't fail the order confirmation
                        print(f"Warning: Failed to create voucher for PO {order.order_number}: {result.error}")
            except Exception as e:
                # Log but don't fail the order confirmation
                print(f"Warning: Error creating voucher for PO {order.order_number}: {e}")
        
        self.db.commit()
        self.db.refresh(order)
        return order
    
    def cancel_purchase_order(self, order: PurchaseOrder) -> PurchaseOrder:
        """Cancel a purchase order."""
        order.status = OrderStatus.CANCELLED
        self.db.commit()
        self.db.refresh(order)
        return order
    
    # ============== Delivery Notes ==============
    
    def create_delivery_note(
        self,
        company: Company,
        sales_order_id: Optional[str],
        customer_id: str,
        items: List[Dict[str, Any]],
        godown_id: Optional[str] = None,
        delivery_date: Optional[datetime] = None,
        transporter_name: Optional[str] = None,
        vehicle_number: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> DeliveryNote:
        """Create a delivery note and update stock."""
        note_count = self.db.query(DeliveryNote).filter(
            DeliveryNote.company_id == company.id
        ).count()
        delivery_number = f"DN-{note_count + 1:05d}"
        
        note = DeliveryNote(
            company_id=company.id,
            sales_order_id=sales_order_id,
            customer_id=customer_id,
            delivery_number=delivery_number,
            delivery_date=delivery_date or datetime.utcnow(),
            godown_id=godown_id,
            transporter_name=transporter_name,
            vehicle_number=vehicle_number,
            notes=notes,
        )
        
        self.db.add(note)
        self.db.flush()
        
        for item_data in items:
            dn_item = DeliveryNoteItem(
                delivery_note_id=note.id,
                product_id=item_data.get("product_id"),  # Unified Product model
                description=item_data.get("description", ""),
                quantity=Decimal(str(item_data.get("quantity", 0))),
                unit=item_data.get("unit", "Nos"),
            )
            self.db.add(dn_item)
            
            # Update stock
            if item_data.get("product_id"):
                self.inventory_service.record_stock_out(
                    company=company,
                    product_id=item_data["product_id"],
                    quantity=Decimal(str(item_data["quantity"])),
                    godown_id=godown_id,
                    reference_type="delivery_note",
                    reference_id=note.id,
                    reference_number=delivery_number,
                )
        
        # Update sales order if linked
        if sales_order_id:
            order = self.get_sales_order(sales_order_id, company)
            if order:
                delivered = sum(Decimal(str(i.get("quantity", 0))) for i in items)
                order.quantity_delivered = (order.quantity_delivered or Decimal("0")) + delivered
                
                if order.quantity_delivered >= order.quantity_ordered:
                    order.status = OrderStatus.FULFILLED
                else:
                    order.status = OrderStatus.PARTIALLY_FULFILLED
        
        self.db.commit()
        self.db.refresh(note)
        return note
    
    def get_delivery_notes(
        self,
        company: Company,
        sales_order_id: Optional[str] = None,
    ) -> List[DeliveryNote]:
        """Get delivery notes."""
        query = self.db.query(DeliveryNote).filter(
            DeliveryNote.company_id == company.id
        )
        
        if sales_order_id:
            query = query.filter(DeliveryNote.sales_order_id == sales_order_id)
        
        return query.order_by(DeliveryNote.delivery_date.desc()).all()
    
    # ============== Receipt Notes ==============
    
    def create_receipt_note(
        self,
        company: Company,
        purchase_order_id: Optional[str],
        vendor_id: str,
        items: List[Dict[str, Any]],
        godown_id: Optional[str] = None,
        receipt_date: Optional[datetime] = None,
        vendor_invoice_number: Optional[str] = None,
        vendor_invoice_date: Optional[datetime] = None,
        notes: Optional[str] = None,
    ) -> ReceiptNote:
        """Create a receipt note and update stock."""
        note_count = self.db.query(ReceiptNote).filter(
            ReceiptNote.company_id == company.id
        ).count()
        receipt_number = f"RN-{note_count + 1:05d}"
        
        note = ReceiptNote(
            company_id=company.id,
            purchase_order_id=purchase_order_id,
            vendor_id=vendor_id,
            receipt_number=receipt_number,
            receipt_date=receipt_date or datetime.utcnow(),
            godown_id=godown_id,
            vendor_invoice_number=vendor_invoice_number,
            vendor_invoice_date=vendor_invoice_date,
            notes=notes,
        )
        
        self.db.add(note)
        self.db.flush()
        
        for item_data in items:
            accepted = Decimal(str(item_data.get("quantity", 0)))
            rejected = Decimal(str(item_data.get("rejected_quantity", 0)))
            
            rn_item = ReceiptNoteItem(
                receipt_note_id=note.id,
                product_id=item_data.get("product_id"),  # Unified Product model
                description=item_data.get("description", ""),
                quantity=accepted + rejected,
                unit=item_data.get("unit", "Nos"),
                rate=Decimal(str(item_data.get("rate", 0))),
                accepted_quantity=accepted,
                rejected_quantity=rejected,
                rejection_reason=item_data.get("rejection_reason"),
            )
            self.db.add(rn_item)
            
            # Update stock (only accepted quantity)
            if item_data.get("product_id") and accepted > 0:
                self.inventory_service.record_stock_in(
                    company=company,
                    product_id=item_data["product_id"],
                    quantity=accepted,
                    rate=Decimal(str(item_data.get("rate", 0))),
                    godown_id=godown_id,
                    reference_type="receipt_note",
                    reference_id=note.id,
                    reference_number=receipt_number,
                )
        
        # Update purchase order if linked
        if purchase_order_id:
            order = self.get_purchase_order(purchase_order_id, company)
            if order:
                received = sum(Decimal(str(i.get("quantity", 0))) for i in items)
                order.quantity_received = (order.quantity_received or Decimal("0")) + received
                
                if order.quantity_received >= order.quantity_ordered:
                    order.status = OrderStatus.FULFILLED
                else:
                    order.status = OrderStatus.PARTIALLY_FULFILLED
        
        self.db.commit()
        self.db.refresh(note)
        return note
    
    def get_receipt_notes(
        self,
        company: Company,
        purchase_order_id: Optional[str] = None,
    ) -> List[ReceiptNote]:
        """Get receipt notes."""
        query = self.db.query(ReceiptNote).filter(
            ReceiptNote.company_id == company.id
        )
        
        if purchase_order_id:
            query = query.filter(ReceiptNote.purchase_order_id == purchase_order_id)
        
        return query.order_by(ReceiptNote.receipt_date.desc()).all()
