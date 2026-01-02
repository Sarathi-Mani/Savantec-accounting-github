"""Quotation service for business logic with GST calculations."""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from app.database.models import (
    Quotation, QuotationItem, Company, Customer, Product,
    QuotationStatus, Invoice, InvoiceItem, InvoiceStatus, InvoiceType,
    INDIAN_STATE_CODES, generate_uuid
)


class QuotationService:
    """Service for quotation operations with GST compliance."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round amount to 2 decimal places."""
        return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def _calculate_gst_split(
        self,
        taxable_amount: Decimal,
        gst_rate: Decimal,
        company_state_code: str,
        place_of_supply: str
    ) -> dict:
        """Calculate GST split (CGST+SGST or IGST) based on place of supply."""
        total_gst = self._round_amount(taxable_amount * gst_rate / 100)
        
        if company_state_code == place_of_supply:
            half_rate = gst_rate / 2
            cgst = self._round_amount(taxable_amount * half_rate / 100)
            sgst = total_gst - cgst
            return {
                "cgst_rate": half_rate,
                "sgst_rate": half_rate,
                "igst_rate": Decimal("0"),
                "cgst_amount": cgst,
                "sgst_amount": sgst,
                "igst_amount": Decimal("0"),
            }
        else:
            return {
                "cgst_rate": Decimal("0"),
                "sgst_rate": Decimal("0"),
                "igst_rate": gst_rate,
                "cgst_amount": Decimal("0"),
                "sgst_amount": Decimal("0"),
                "igst_amount": total_gst,
            }
    
    def _get_next_quotation_number(self, company: Company) -> str:
        """Generate next quotation number."""
        prefix = company.quotation_prefix if hasattr(company, 'quotation_prefix') and company.quotation_prefix else "QT"
        current_year = datetime.now().year
        
        last_quotation = self.db.query(Quotation).filter(
            Quotation.company_id == company.id,
            func.extract('year', Quotation.quotation_date) == current_year
        ).order_by(Quotation.quotation_number.desc()).first()
        
        if last_quotation and last_quotation.quotation_number:
            try:
                last_num = int(last_quotation.quotation_number.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        return f"{prefix}-{current_year}-{next_num:04d}"
    
    def create_quotation(
        self,
        company: Company,
        customer_id: Optional[str],
        items: List[Dict[str, Any]],
        quotation_date: Optional[datetime] = None,
        validity_days: int = 30,
        place_of_supply: Optional[str] = None,
        subject: Optional[str] = None,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
    ) -> Quotation:
        """Create a new quotation with GST calculations."""
        # Get customer
        customer = None
        if customer_id:
            customer = self.db.query(Customer).filter(
                Customer.id == customer_id,
                Customer.company_id == company.id
            ).first()
        
        # Determine place of supply
        if not place_of_supply and customer:
            place_of_supply = customer.billing_state_code
        if not place_of_supply:
            place_of_supply = company.state_code or "27"
        
        place_of_supply_name = INDIAN_STATE_CODES.get(place_of_supply, "")
        
        # Calculate validity date
        quote_date = quotation_date or datetime.utcnow()
        validity_date = quote_date + timedelta(days=validity_days)
        
        # Create quotation
        quotation = Quotation(
            id=generate_uuid(),
            company_id=company.id,
            customer_id=customer.id if customer else None,
            quotation_number=self._get_next_quotation_number(company),
            quotation_date=quote_date,
            validity_date=validity_date,
            place_of_supply=place_of_supply,
            place_of_supply_name=place_of_supply_name,
            subject=subject,
            notes=notes,
            terms=terms or (company.invoice_terms if hasattr(company, 'invoice_terms') else None),
            status=QuotationStatus.DRAFT,
        )
        
        self.db.add(quotation)
        self.db.flush()
        
        # Calculate totals
        subtotal = Decimal("0")
        total_cgst = Decimal("0")
        total_sgst = Decimal("0")
        total_igst = Decimal("0")
        total_discount = Decimal("0")
        
        company_state = company.state_code or "27"
        
        # Add items
        for item_data in items:
            qty = Decimal(str(item_data.get("quantity", 0)))
            unit_price = Decimal(str(item_data.get("unit_price", 0)))
            gst_rate = Decimal(str(item_data.get("gst_rate", 18)))
            discount_percent = Decimal(str(item_data.get("discount_percent", 0)))
            
            # Calculate amounts
            base_amount = self._round_amount(qty * unit_price)
            discount_amount = self._round_amount(base_amount * discount_percent / 100)
            taxable_amount = base_amount - discount_amount
            
            # Calculate GST
            gst_split = self._calculate_gst_split(
                taxable_amount,
                gst_rate,
                company_state,
                place_of_supply
            )
            
            total_tax = gst_split["cgst_amount"] + gst_split["sgst_amount"] + gst_split["igst_amount"]
            item_total = taxable_amount + total_tax
            
            # Get product details
            product = None
            if item_data.get("product_id"):
                product = self.db.query(Product).filter(Product.id == item_data["product_id"]).first()
            
            item = QuotationItem(
                id=generate_uuid(),
                quotation_id=quotation.id,
                product_id=item_data.get("product_id"),
                description=item_data.get("description") or (product.name if product else "Item"),
                hsn_code=item_data.get("hsn_code") or (product.hsn_code if product else None),
                quantity=qty,
                unit=item_data.get("unit") or (product.unit if product else "unit"),
                unit_price=unit_price,
                discount_percent=discount_percent,
                discount_amount=discount_amount,
                gst_rate=gst_rate,
                cgst_rate=gst_split["cgst_rate"],
                sgst_rate=gst_split["sgst_rate"],
                igst_rate=gst_split["igst_rate"],
                cgst_amount=gst_split["cgst_amount"],
                sgst_amount=gst_split["sgst_amount"],
                igst_amount=gst_split["igst_amount"],
                taxable_amount=taxable_amount,
                total_amount=item_total,
            )
            self.db.add(item)
            
            # Accumulate totals
            subtotal += taxable_amount
            total_cgst += gst_split["cgst_amount"]
            total_sgst += gst_split["sgst_amount"]
            total_igst += gst_split["igst_amount"]
            total_discount += discount_amount
        
        # Update quotation totals
        quotation.subtotal = subtotal
        quotation.discount_amount = total_discount
        quotation.cgst_amount = total_cgst
        quotation.sgst_amount = total_sgst
        quotation.igst_amount = total_igst
        quotation.total_tax = total_cgst + total_sgst + total_igst
        quotation.total_amount = subtotal + quotation.total_tax
        
        self.db.commit()
        self.db.refresh(quotation)
        
        return quotation
    
    def update_quotation(
        self,
        quotation: Quotation,
        items: Optional[List[Dict[str, Any]]] = None,
        validity_days: Optional[int] = None,
        subject: Optional[str] = None,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
    ) -> Quotation:
        """Update a quotation (only if in DRAFT status)."""
        if quotation.status != QuotationStatus.DRAFT:
            raise ValueError("Can only update quotations in DRAFT status")
        
        if subject is not None:
            quotation.subject = subject
        if notes is not None:
            quotation.notes = notes
        if terms is not None:
            quotation.terms = terms
        if validity_days is not None:
            quotation.validity_date = quotation.quotation_date + timedelta(days=validity_days)
        
        if items is not None:
            # Remove existing items
            self.db.query(QuotationItem).filter(
                QuotationItem.quotation_id == quotation.id
            ).delete()
            
            # Recalculate with new items
            subtotal = Decimal("0")
            total_cgst = Decimal("0")
            total_sgst = Decimal("0")
            total_igst = Decimal("0")
            total_discount = Decimal("0")
            
            company = self.db.query(Company).filter(Company.id == quotation.company_id).first()
            company_state = company.state_code or "27"
            place_of_supply = quotation.place_of_supply or company_state
            
            for item_data in items:
                qty = Decimal(str(item_data.get("quantity", 0)))
                unit_price = Decimal(str(item_data.get("unit_price", 0)))
                gst_rate = Decimal(str(item_data.get("gst_rate", 18)))
                discount_percent = Decimal(str(item_data.get("discount_percent", 0)))
                
                base_amount = self._round_amount(qty * unit_price)
                discount_amount = self._round_amount(base_amount * discount_percent / 100)
                taxable_amount = base_amount - discount_amount
                
                gst_split = self._calculate_gst_split(
                    taxable_amount, gst_rate, company_state, place_of_supply
                )
                
                total_tax = gst_split["cgst_amount"] + gst_split["sgst_amount"] + gst_split["igst_amount"]
                item_total = taxable_amount + total_tax
                
                product = None
                if item_data.get("product_id"):
                    product = self.db.query(Product).filter(Product.id == item_data["product_id"]).first()
                
                item = QuotationItem(
                    id=generate_uuid(),
                    quotation_id=quotation.id,
                    product_id=item_data.get("product_id"),
                    description=item_data.get("description") or (product.name if product else "Item"),
                    hsn_code=item_data.get("hsn_code") or (product.hsn_code if product else None),
                    quantity=qty,
                    unit=item_data.get("unit") or (product.unit if product else "unit"),
                    unit_price=unit_price,
                    discount_percent=discount_percent,
                    discount_amount=discount_amount,
                    gst_rate=gst_rate,
                    cgst_rate=gst_split["cgst_rate"],
                    sgst_rate=gst_split["sgst_rate"],
                    igst_rate=gst_split["igst_rate"],
                    cgst_amount=gst_split["cgst_amount"],
                    sgst_amount=gst_split["sgst_amount"],
                    igst_amount=gst_split["igst_amount"],
                    taxable_amount=taxable_amount,
                    total_amount=item_total,
                )
                self.db.add(item)
                
                subtotal += taxable_amount
                total_cgst += gst_split["cgst_amount"]
                total_sgst += gst_split["sgst_amount"]
                total_igst += gst_split["igst_amount"]
                total_discount += discount_amount
            
            quotation.subtotal = subtotal
            quotation.discount_amount = total_discount
            quotation.cgst_amount = total_cgst
            quotation.sgst_amount = total_sgst
            quotation.igst_amount = total_igst
            quotation.total_tax = total_cgst + total_sgst + total_igst
            quotation.total_amount = subtotal + quotation.total_tax
        
        quotation.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(quotation)
        
        return quotation
    
    def send_to_customer(
        self,
        quotation: Quotation,
        email: Optional[str] = None,
    ) -> Quotation:
        """Mark quotation as sent to customer."""
        if quotation.status not in [QuotationStatus.DRAFT, QuotationStatus.SENT]:
            raise ValueError("Can only send quotations in DRAFT or SENT status")
        
        quotation.status = QuotationStatus.SENT
        quotation.email_sent_at = datetime.utcnow()
        quotation.email_sent_to = email
        quotation.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(quotation)
        
        return quotation
    
    def mark_approved(
        self,
        quotation: Quotation,
        approved_by: Optional[str] = None,
    ) -> Quotation:
        """Mark quotation as approved by customer."""
        if quotation.status not in [QuotationStatus.SENT, QuotationStatus.DRAFT]:
            raise ValueError("Can only approve quotations in DRAFT or SENT status")
        
        quotation.status = QuotationStatus.APPROVED
        quotation.approved_at = datetime.utcnow()
        quotation.approved_by = approved_by or "Customer"
        quotation.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(quotation)
        
        return quotation
    
    def mark_rejected(
        self,
        quotation: Quotation,
        rejection_reason: Optional[str] = None,
    ) -> Quotation:
        """Mark quotation as rejected by customer."""
        if quotation.status not in [QuotationStatus.SENT, QuotationStatus.DRAFT]:
            raise ValueError("Can only reject quotations in DRAFT or SENT status")
        
        quotation.status = QuotationStatus.REJECTED
        quotation.rejected_at = datetime.utcnow()
        quotation.rejection_reason = rejection_reason
        quotation.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(quotation)
        
        return quotation
    
    def convert_to_invoice(
        self,
        quotation: Quotation,
        invoice_date: Optional[datetime] = None,
        due_date: Optional[datetime] = None,
    ) -> Invoice:
        """Convert an approved quotation to an invoice."""
        if quotation.status == QuotationStatus.CONVERTED:
            raise ValueError("Quotation has already been converted to an invoice")
        
        if quotation.status not in [QuotationStatus.APPROVED, QuotationStatus.DRAFT, QuotationStatus.SENT]:
            raise ValueError("Can only convert approved or pending quotations")
        
        # Get company
        company = self.db.query(Company).filter(Company.id == quotation.company_id).first()
        if not company:
            raise ValueError("Company not found")
        
        # Get next invoice number
        from app.services.company_service import CompanyService
        company_service = CompanyService(self.db)
        invoice_number = company_service.get_next_invoice_number(company)
        
        # Determine invoice type
        customer = quotation.customer
        invoice_type = InvoiceType.B2C
        if customer and customer.gstin:
            invoice_type = InvoiceType.B2B
        
        # Create invoice
        invoice = Invoice(
            id=generate_uuid(),
            company_id=quotation.company_id,
            customer_id=quotation.customer_id,
            invoice_number=invoice_number,
            invoice_date=invoice_date or datetime.utcnow(),
            due_date=due_date,
            invoice_type=invoice_type,
            place_of_supply=quotation.place_of_supply,
            place_of_supply_name=quotation.place_of_supply_name,
            subtotal=quotation.subtotal,
            discount_amount=quotation.discount_amount,
            cgst_amount=quotation.cgst_amount,
            sgst_amount=quotation.sgst_amount,
            igst_amount=quotation.igst_amount,
            total_tax=quotation.total_tax,
            total_amount=quotation.total_amount,
            balance_due=quotation.total_amount,
            outstanding_amount=quotation.total_amount,
            notes=quotation.notes,
            terms=quotation.terms,
            status=InvoiceStatus.DRAFT,
        )
        
        self.db.add(invoice)
        self.db.flush()
        
        # Copy items
        for q_item in quotation.items:
            i_item = InvoiceItem(
                id=generate_uuid(),
                invoice_id=invoice.id,
                product_id=q_item.product_id,
                description=q_item.description,
                hsn_code=q_item.hsn_code,
                quantity=q_item.quantity,
                unit=q_item.unit,
                unit_price=q_item.unit_price,
                discount_percent=q_item.discount_percent,
                discount_amount=q_item.discount_amount,
                gst_rate=q_item.gst_rate,
                cgst_rate=q_item.cgst_rate,
                sgst_rate=q_item.sgst_rate,
                igst_rate=q_item.igst_rate,
                cgst_amount=q_item.cgst_amount,
                sgst_amount=q_item.sgst_amount,
                igst_amount=q_item.igst_amount,
                taxable_amount=q_item.taxable_amount,
                total_amount=q_item.total_amount,
            )
            self.db.add(i_item)
        
        # Update quotation status
        quotation.status = QuotationStatus.CONVERTED
        quotation.converted_invoice_id = invoice.id
        quotation.converted_at = datetime.utcnow()
        quotation.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(invoice)
        
        return invoice
    
    def check_expired_quotations(self, company_id: str) -> int:
        """Mark expired quotations. Returns count of updated quotations."""
        now = datetime.utcnow()
        
        expired = self.db.query(Quotation).filter(
            Quotation.company_id == company_id,
            Quotation.status.in_([QuotationStatus.DRAFT, QuotationStatus.SENT]),
            Quotation.validity_date < now,
        ).all()
        
        count = 0
        for quotation in expired:
            quotation.status = QuotationStatus.EXPIRED
            quotation.updated_at = now
            count += 1
        
        if count > 0:
            self.db.commit()
        
        return count
    
    def list_quotations(
        self,
        company_id: str,
        status: Optional[QuotationStatus] = None,
        customer_id: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """List quotations with filters."""
        query = self.db.query(Quotation).filter(Quotation.company_id == company_id)
        
        if status:
            query = query.filter(Quotation.status == status)
        if customer_id:
            query = query.filter(Quotation.customer_id == customer_id)
        if from_date:
            query = query.filter(Quotation.quotation_date >= from_date)
        if to_date:
            query = query.filter(Quotation.quotation_date <= to_date)
        
        total = query.count()
        
        quotations = query.order_by(Quotation.quotation_date.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return {
            "items": quotations,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    
    def get_quotation(self, company_id: str, quotation_id: str) -> Optional[Quotation]:
        """Get a single quotation by ID."""
        return self.db.query(Quotation).filter(
            Quotation.id == quotation_id,
            Quotation.company_id == company_id,
        ).first()
    
    def delete_quotation(self, quotation: Quotation) -> bool:
        """Delete a quotation (only if in DRAFT status)."""
        if quotation.status != QuotationStatus.DRAFT:
            raise ValueError("Can only delete quotations in DRAFT status")
        
        self.db.delete(quotation)
        self.db.commit()
        return True
    
    def revise_quotation(self, quotation: Quotation) -> Quotation:
        """Create a revised version of a quotation."""
        # Create new quotation as revision
        new_quotation = Quotation(
            id=generate_uuid(),
            company_id=quotation.company_id,
            customer_id=quotation.customer_id,
            quotation_number=quotation.quotation_number + f"-R{quotation.revision_number + 1}",
            quotation_date=datetime.utcnow(),
            validity_date=datetime.utcnow() + timedelta(days=30),
            revised_from_id=quotation.id,
            revision_number=quotation.revision_number + 1,
            place_of_supply=quotation.place_of_supply,
            place_of_supply_name=quotation.place_of_supply_name,
            subtotal=quotation.subtotal,
            discount_amount=quotation.discount_amount,
            cgst_amount=quotation.cgst_amount,
            sgst_amount=quotation.sgst_amount,
            igst_amount=quotation.igst_amount,
            total_tax=quotation.total_tax,
            total_amount=quotation.total_amount,
            subject=quotation.subject,
            notes=quotation.notes,
            terms=quotation.terms,
            status=QuotationStatus.DRAFT,
        )
        
        self.db.add(new_quotation)
        self.db.flush()
        
        # Copy items
        for q_item in quotation.items:
            new_item = QuotationItem(
                id=generate_uuid(),
                quotation_id=new_quotation.id,
                product_id=q_item.product_id,
                description=q_item.description,
                hsn_code=q_item.hsn_code,
                quantity=q_item.quantity,
                unit=q_item.unit,
                unit_price=q_item.unit_price,
                discount_percent=q_item.discount_percent,
                discount_amount=q_item.discount_amount,
                gst_rate=q_item.gst_rate,
                cgst_rate=q_item.cgst_rate,
                sgst_rate=q_item.sgst_rate,
                igst_rate=q_item.igst_rate,
                cgst_amount=q_item.cgst_amount,
                sgst_amount=q_item.sgst_amount,
                igst_amount=q_item.igst_amount,
                taxable_amount=q_item.taxable_amount,
                total_amount=q_item.total_amount,
            )
            self.db.add(new_item)
        
        self.db.commit()
        self.db.refresh(new_quotation)
        
        return new_quotation

