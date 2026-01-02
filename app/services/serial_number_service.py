"""
Serial Number Service - Track serial/IMEI numbers for products.

Features:
- Serial number creation on purchase
- Serial tracking through sales
- Warranty management
- Serial history
"""
from decimal import Decimal
from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    SerialNumber, SerialNumberStatus, Product, generate_uuid
)


class SerialNumberService:
    """Service for serial number tracking."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_serial(
        self,
        company_id: str,
        product_id: str,
        serial_number: str,
        batch_id: str = None,
        godown_id: str = None,
        purchase_invoice_id: str = None,
        purchase_date: datetime = None,
        purchase_rate: Decimal = None,
        warranty_start_date: datetime = None,
        warranty_expiry_date: datetime = None,
        warranty_terms: str = None,
        notes: str = None,
    ) -> SerialNumber:
        """Create a new serial number record."""
        # Check if serial already exists
        existing = self.db.query(SerialNumber).filter(
            SerialNumber.company_id == company_id,
            SerialNumber.serial_number == serial_number,
        ).first()
        
        if existing:
            raise ValueError(f"Serial number {serial_number} already exists")
        
        serial = SerialNumber(
            id=generate_uuid(),
            company_id=company_id,
            product_id=product_id,
            serial_number=serial_number,
            batch_id=batch_id,
            godown_id=godown_id,
            status=SerialNumberStatus.AVAILABLE,
            purchase_invoice_id=purchase_invoice_id,
            purchase_date=purchase_date or datetime.utcnow(),
            purchase_rate=purchase_rate,
            warranty_start_date=warranty_start_date,
            warranty_expiry_date=warranty_expiry_date,
            warranty_terms=warranty_terms,
            notes=notes,
        )
        
        self.db.add(serial)
        self.db.commit()
        self.db.refresh(serial)
        
        return serial
    
    def create_bulk_serials(
        self,
        company_id: str,
        product_id: str,
        serial_numbers: List[str],
        **kwargs,
    ) -> List[SerialNumber]:
        """Create multiple serial numbers at once."""
        serials = []
        for sn in serial_numbers:
            try:
                serial = self.create_serial(
                    company_id=company_id,
                    product_id=product_id,
                    serial_number=sn,
                    **kwargs,
                )
                serials.append(serial)
            except ValueError:
                continue  # Skip duplicates
        
        return serials
    
    def get_serial(self, serial_id: str) -> Optional[SerialNumber]:
        return self.db.query(SerialNumber).filter(SerialNumber.id == serial_id).first()
    
    def get_serial_by_number(
        self,
        company_id: str,
        serial_number: str,
    ) -> Optional[SerialNumber]:
        return self.db.query(SerialNumber).filter(
            SerialNumber.company_id == company_id,
            SerialNumber.serial_number == serial_number,
        ).first()
    
    def list_serials(
        self,
        company_id: str,
        product_id: str = None,
        status: SerialNumberStatus = None,
        godown_id: str = None,
        customer_id: str = None,
    ) -> List[SerialNumber]:
        query = self.db.query(SerialNumber).filter(SerialNumber.company_id == company_id)
        
        if product_id:
            query = query.filter(SerialNumber.product_id == product_id)
        
        if status:
            query = query.filter(SerialNumber.status == status)
        
        if godown_id:
            query = query.filter(SerialNumber.godown_id == godown_id)
        
        if customer_id:
            query = query.filter(SerialNumber.customer_id == customer_id)
        
        return query.order_by(SerialNumber.serial_number.asc()).all()
    
    def get_available_serials(
        self,
        company_id: str,
        product_id: str,
        godown_id: str = None,
    ) -> List[SerialNumber]:
        """Get available serial numbers for a product."""
        query = self.db.query(SerialNumber).filter(
            SerialNumber.company_id == company_id,
            SerialNumber.product_id == product_id,
            SerialNumber.status == SerialNumberStatus.AVAILABLE,
        )
        
        if godown_id:
            query = query.filter(SerialNumber.godown_id == godown_id)
        
        return query.order_by(SerialNumber.purchase_date.asc()).all()
    
    def sell_serial(
        self,
        serial_id: str,
        sales_invoice_id: str,
        customer_id: str,
        sales_rate: Decimal = None,
        sales_date: datetime = None,
    ) -> SerialNumber:
        """Mark a serial number as sold."""
        serial = self.get_serial(serial_id)
        if not serial:
            raise ValueError("Serial number not found")
        
        if serial.status != SerialNumberStatus.AVAILABLE:
            raise ValueError(f"Serial number is not available (status: {serial.status})")
        
        serial.status = SerialNumberStatus.SOLD
        serial.sales_invoice_id = sales_invoice_id
        serial.customer_id = customer_id
        serial.sales_rate = sales_rate
        serial.sales_date = sales_date or datetime.utcnow()
        
        # Set warranty start if not already set
        if serial.warranty_expiry_date and not serial.warranty_start_date:
            serial.warranty_start_date = serial.sales_date
        
        self.db.commit()
        self.db.refresh(serial)
        
        return serial
    
    def return_serial(
        self,
        serial_id: str,
        reason: str = None,
    ) -> SerialNumber:
        """Mark a sold serial number as returned."""
        serial = self.get_serial(serial_id)
        if not serial:
            raise ValueError("Serial number not found")
        
        serial.status = SerialNumberStatus.RETURNED
        serial.notes = (serial.notes or '') + f"\nReturned: {reason}" if reason else serial.notes
        
        self.db.commit()
        self.db.refresh(serial)
        
        return serial
    
    def mark_damaged(
        self,
        serial_id: str,
        reason: str = None,
    ) -> SerialNumber:
        """Mark a serial number as damaged."""
        serial = self.get_serial(serial_id)
        if not serial:
            raise ValueError("Serial number not found")
        
        serial.status = SerialNumberStatus.DAMAGED
        serial.notes = (serial.notes or '') + f"\nDamaged: {reason}" if reason else serial.notes
        
        self.db.commit()
        self.db.refresh(serial)
        
        return serial
    
    def reserve_serial(
        self,
        serial_id: str,
        reference: str = None,
    ) -> SerialNumber:
        """Reserve a serial number."""
        serial = self.get_serial(serial_id)
        if not serial:
            raise ValueError("Serial number not found")
        
        if serial.status != SerialNumberStatus.AVAILABLE:
            raise ValueError(f"Serial number is not available (status: {serial.status})")
        
        serial.status = SerialNumberStatus.RESERVED
        serial.notes = (serial.notes or '') + f"\nReserved: {reference}" if reference else serial.notes
        
        self.db.commit()
        self.db.refresh(serial)
        
        return serial
    
    def release_reservation(self, serial_id: str) -> SerialNumber:
        """Release a reserved serial number."""
        serial = self.get_serial(serial_id)
        if not serial:
            raise ValueError("Serial number not found")
        
        if serial.status != SerialNumberStatus.RESERVED:
            raise ValueError("Serial number is not reserved")
        
        serial.status = SerialNumberStatus.AVAILABLE
        
        self.db.commit()
        self.db.refresh(serial)
        
        return serial
    
    def check_warranty(
        self,
        serial_id: str,
        as_of_date: datetime = None,
    ) -> Dict:
        """Check warranty status for a serial number."""
        serial = self.get_serial(serial_id)
        if not serial:
            return {'error': 'Serial number not found'}
        
        if not as_of_date:
            as_of_date = datetime.utcnow()
        
        is_in_warranty = False
        days_remaining = 0
        
        if serial.warranty_expiry_date:
            if as_of_date <= serial.warranty_expiry_date:
                is_in_warranty = True
                days_remaining = (serial.warranty_expiry_date - as_of_date).days
        
        return {
            'serial_id': serial.id,
            'serial_number': serial.serial_number,
            'warranty_start': serial.warranty_start_date.strftime('%Y-%m-%d') if serial.warranty_start_date else None,
            'warranty_expiry': serial.warranty_expiry_date.strftime('%Y-%m-%d') if serial.warranty_expiry_date else None,
            'is_in_warranty': is_in_warranty,
            'days_remaining': days_remaining,
            'warranty_terms': serial.warranty_terms,
        }
    
    def get_serial_summary(self, company_id: str, product_id: str = None) -> Dict:
        """Get summary of serial numbers."""
        query = self.db.query(SerialNumber).filter(SerialNumber.company_id == company_id)
        
        if product_id:
            query = query.filter(SerialNumber.product_id == product_id)
        
        total = query.count()
        available = query.filter(SerialNumber.status == SerialNumberStatus.AVAILABLE).count()
        sold = query.filter(SerialNumber.status == SerialNumberStatus.SOLD).count()
        damaged = query.filter(SerialNumber.status == SerialNumberStatus.DAMAGED).count()
        returned = query.filter(SerialNumber.status == SerialNumberStatus.RETURNED).count()
        reserved = query.filter(SerialNumber.status == SerialNumberStatus.RESERVED).count()
        
        return {
            'total': total,
            'available': available,
            'sold': sold,
            'damaged': damaged,
            'returned': returned,
            'reserved': reserved,
        }
