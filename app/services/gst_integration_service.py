"""GST Integration Service - E-Invoice, E-Way Bill, ITC Reconciliation."""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import json
import hashlib
import base64

from app.database.models import (
    Company, Invoice, Customer, InvoiceItem, InvoiceStatus
)


class GSTIntegrationService:
    """Service for GST portal integrations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ============== E-Invoice ==============
    
    def generate_irn_data(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Generate E-Invoice data structure for IRN generation.
        This follows the NIC E-Invoice schema.
        """
        company = invoice.company
        customer = invoice.customer
        
        # Calculate totals
        items_data = []
        for idx, item in enumerate(invoice.items, 1):
            items_data.append({
                "SlNo": str(idx),
                "PrdDesc": item.description[:100],
                "IsServc": "N" if not hasattr(item, 'is_service') else ("Y" if item.is_service else "N"),
                "HsnCd": item.hsn_code or "99999999",
                "Qty": float(item.quantity),
                "Unit": item.unit or "NOS",
                "UnitPrice": float(item.unit_price),
                "TotAmt": float(item.taxable_amount),
                "Discount": float(item.discount_amount or 0),
                "AssAmt": float(item.taxable_amount),
                "GstRt": float(item.gst_rate),
                "CgstAmt": float(item.cgst_amount or 0),
                "SgstAmt": float(item.sgst_amount or 0),
                "IgstAmt": float(item.igst_amount or 0),
                "CesAmt": float(item.cess_amount or 0),
                "TotItemVal": float(item.total_amount),
            })
        
        # Build E-Invoice JSON
        einvoice_data = {
            "Version": "1.1",
            "TranDtls": {
                "TaxSch": "GST",
                "SupTyp": "B2B",  # B2B, B2C, SEZWP, SEZWOP, EXPWP, EXPWOP, DEXP
                "IgstOnIntra": "N",
            },
            "DocDtls": {
                "Typ": "INV",  # INV, CRN, DBN
                "No": invoice.invoice_number,
                "Dt": invoice.invoice_date.strftime("%d/%m/%Y"),
            },
            "SellerDtls": {
                "Gstin": company.gstin or "",
                "LglNm": company.name,
                "TrdNm": company.trade_name or company.name,
                "Addr1": company.address_line1 or "",
                "Addr2": company.address_line2 or "",
                "Loc": company.city or "",
                "Pin": int(company.pincode or 0),
                "Stcd": company.state_code or "",
            },
            "BuyerDtls": {
                "Gstin": customer.gstin if customer else "URP",  # Unregistered Person
                "LglNm": customer.name if customer else "",
                "TrdNm": customer.trade_name if customer else "",
                "Addr1": customer.billing_address_line1 if customer else "",
                "Addr2": customer.billing_address_line2 if customer else "",
                "Loc": customer.billing_city if customer else "",
                "Pin": int(customer.billing_pincode or 0) if customer else 0,
                "Stcd": customer.billing_state_code if customer else "",
                "Pos": invoice.place_of_supply or company.state_code or "",
            },
            "ItemList": items_data,
            "ValDtls": {
                "AssVal": float(invoice.subtotal or 0),
                "CgstVal": float(invoice.cgst_amount or 0),
                "SgstVal": float(invoice.sgst_amount or 0),
                "IgstVal": float(invoice.igst_amount or 0),
                "CesVal": float(invoice.cess_amount or 0),
                "Discount": float(invoice.discount_amount or 0),
                "TotInvVal": float(invoice.total_amount or 0),
            },
        }
        
        return einvoice_data
    
    def generate_signed_qr(self, invoice: Invoice) -> str:
        """
        Generate a signed QR code data for E-Invoice.
        In production, this would use actual IRN signing.
        """
        # This is a placeholder - actual implementation requires
        # integration with GST portal and proper signing
        qr_data = {
            "SellerGstin": invoice.company.gstin or "",
            "BuyerGstin": invoice.customer.gstin if invoice.customer else "",
            "DocNo": invoice.invoice_number,
            "DocTyp": "INV",
            "DocDt": invoice.invoice_date.strftime("%d/%m/%Y"),
            "TotInvVal": float(invoice.total_amount or 0),
            "ItemCnt": len(invoice.items),
        }
        
        # Create a hash for demo purposes
        json_str = json.dumps(qr_data, sort_keys=True)
        qr_hash = hashlib.sha256(json_str.encode()).hexdigest()[:32]
        
        return base64.b64encode(json_str.encode()).decode()
    
    def submit_einvoice(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Submit invoice to NIC portal for E-Invoice.
        Returns IRN and acknowledgement details.
        
        Note: This is a simulation - actual implementation requires
        GST portal API credentials and proper authentication.
        """
        einvoice_data = self.generate_irn_data(invoice)
        
        # Simulate IRN generation
        # In production, this would call the NIC E-Invoice API
        irn_hash = hashlib.sha256(
            f"{invoice.company.gstin}{invoice.invoice_number}{invoice.invoice_date}".encode()
        ).hexdigest()[:64]
        
        ack_no = f"1{datetime.utcnow().strftime('%y%m%d%H%M%S')}"
        ack_date = datetime.utcnow()
        
        # Update invoice
        invoice.irn = irn_hash
        invoice.ack_number = ack_no
        invoice.ack_date = ack_date
        invoice.signed_qr = self.generate_signed_qr(invoice)
        
        self.db.commit()
        
        return {
            "success": True,
            "irn": irn_hash,
            "ack_number": ack_no,
            "ack_date": ack_date.isoformat(),
            "signed_qr": invoice.signed_qr,
            "message": "E-Invoice generated successfully (simulation)",
        }
    
    def cancel_einvoice(self, invoice: Invoice, reason: str) -> Dict[str, Any]:
        """Cancel an E-Invoice."""
        if not invoice.irn:
            return {"success": False, "message": "No IRN found for this invoice"}
        
        # In production, this would call the NIC API to cancel
        invoice.irn = None
        invoice.ack_number = None
        invoice.ack_date = None
        invoice.signed_qr = None
        
        self.db.commit()
        
        return {
            "success": True,
            "message": "E-Invoice cancelled successfully (simulation)",
        }
    
    # ============== E-Way Bill ==============
    
    def check_eway_bill_required(self, invoice: Invoice) -> bool:
        """Check if E-Way Bill is required (value > ₹50,000)."""
        return (invoice.total_amount or Decimal("0")) >= Decimal("50000")
    
    def generate_eway_bill_data(
        self,
        invoice: Invoice,
        transporter_id: Optional[str] = None,
        transporter_name: Optional[str] = None,
        vehicle_number: Optional[str] = None,
        vehicle_type: str = "R",  # R=Regular, O=ODC
        transport_mode: str = "1",  # 1=Road, 2=Rail, 3=Air, 4=Ship
        distance_km: int = 0,
    ) -> Dict[str, Any]:
        """Generate E-Way Bill data."""
        company = invoice.company
        customer = invoice.customer
        
        eway_data = {
            "supplyType": "O",  # O=Outward, I=Inward
            "subSupplyType": "1",  # 1=Supply
            "docType": "INV",
            "docNo": invoice.invoice_number,
            "docDate": invoice.invoice_date.strftime("%d/%m/%Y"),
            "fromGstin": company.gstin or "",
            "fromTrdName": company.name,
            "fromAddr1": company.address_line1 or "",
            "fromAddr2": company.address_line2 or "",
            "fromPlace": company.city or "",
            "fromPincode": int(company.pincode or 0),
            "fromStateCode": int(company.state_code or 0),
            "toGstin": customer.gstin if customer else "URP",
            "toTrdName": customer.name if customer else "",
            "toAddr1": customer.billing_address_line1 if customer else "",
            "toAddr2": customer.billing_address_line2 if customer else "",
            "toPlace": customer.billing_city if customer else "",
            "toPincode": int(customer.billing_pincode or 0) if customer else 0,
            "toStateCode": int(customer.billing_state_code or 0) if customer else 0,
            "totalValue": float(invoice.subtotal or 0),
            "cgstValue": float(invoice.cgst_amount or 0),
            "sgstValue": float(invoice.sgst_amount or 0),
            "igstValue": float(invoice.igst_amount or 0),
            "cessValue": float(invoice.cess_amount or 0),
            "totInvValue": float(invoice.total_amount or 0),
            "transporterId": transporter_id or "",
            "transporterName": transporter_name or "",
            "transMode": transport_mode,
            "transDistance": distance_km,
            "vehicleNo": vehicle_number or "",
            "vehicleType": vehicle_type,
            "itemList": [
                {
                    "productName": item.description[:100],
                    "productDesc": item.description[:200],
                    "hsnCode": int(item.hsn_code or 99999999),
                    "quantity": float(item.quantity),
                    "qtyUnit": item.unit or "NOS",
                    "cgstRate": float(item.cgst_rate or 0),
                    "sgstRate": float(item.sgst_rate or 0),
                    "igstRate": float(item.igst_rate or 0),
                    "taxableAmount": float(item.taxable_amount),
                }
                for item in invoice.items
            ],
        }
        
        return eway_data
    
    def generate_eway_bill(
        self,
        invoice: Invoice,
        transporter_id: Optional[str] = None,
        transporter_name: Optional[str] = None,
        vehicle_number: Optional[str] = None,
        distance_km: int = 0,
    ) -> Dict[str, Any]:
        """
        Generate E-Way Bill.
        
        Note: This is a simulation - actual implementation requires
        E-Way Bill portal API credentials.
        """
        if not self.check_eway_bill_required(invoice):
            return {
                "success": False,
                "message": "E-Way Bill not required (value < ₹50,000)",
            }
        
        eway_data = self.generate_eway_bill_data(
            invoice, transporter_id, transporter_name,
            vehicle_number, distance_km=distance_km
        )
        
        # Simulate E-Way Bill number generation
        ewb_no = f"EWB{datetime.utcnow().strftime('%y%m%d%H%M%S%f')[:12]}"
        valid_upto = datetime.utcnow() + timedelta(days=1 + (distance_km // 100))
        
        return {
            "success": True,
            "ewb_number": ewb_no,
            "ewb_date": datetime.utcnow().isoformat(),
            "valid_upto": valid_upto.isoformat(),
            "invoice_number": invoice.invoice_number,
            "message": "E-Way Bill generated successfully (simulation)",
        }
    
    # ============== ITC Reconciliation ==============
    
    def get_itc_summary(
        self,
        company: Company,
        from_date: datetime,
        to_date: datetime,
    ) -> Dict[str, Any]:
        """Get Input Tax Credit summary for a period."""
        # In a full implementation, this would compare:
        # 1. Our purchase invoices
        # 2. GSTR-2A data from GST portal
        # 3. Identify mismatches
        
        # For now, return a summary structure
        return {
            "period": {
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
            },
            "claimed": {
                "cgst": Decimal("0"),
                "sgst": Decimal("0"),
                "igst": Decimal("0"),
                "cess": Decimal("0"),
                "total": Decimal("0"),
            },
            "available": {
                "cgst": Decimal("0"),
                "sgst": Decimal("0"),
                "igst": Decimal("0"),
                "cess": Decimal("0"),
                "total": Decimal("0"),
            },
            "mismatches": [],
            "message": "ITC reconciliation requires GSTR-2A data integration",
        }
    
    def reconcile_itc(
        self,
        company: Company,
        gstr2a_data: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Reconcile ITC with GSTR-2A data.
        
        This would match our purchase records with supplier-uploaded data.
        """
        matched = []
        unmatched = []
        
        # Placeholder for reconciliation logic
        # In production, this would:
        # 1. Parse GSTR-2A data
        # 2. Match with our purchase invoices
        # 3. Identify discrepancies
        
        return {
            "matched_count": len(matched),
            "unmatched_count": len(unmatched),
            "matched_invoices": matched,
            "unmatched_invoices": unmatched,
            "total_itc_claimed": Decimal("0"),
            "total_itc_available": Decimal("0"),
            "difference": Decimal("0"),
        }
    
    # ============== GST Returns Helper ==============
    
    def get_gstr1_summary(
        self,
        company: Company,
        from_date: datetime,
        to_date: datetime,
    ) -> Dict[str, Any]:
        """Get GSTR-1 summary for a period."""
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.invoice_date.between(from_date, to_date),
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID])
        ).all()
        
        b2b_invoices = [i for i in invoices if i.customer and i.customer.gstin]
        b2c_invoices = [i for i in invoices if not i.customer or not i.customer.gstin]
        
        total_value = sum(i.total_amount or Decimal("0") for i in invoices)
        total_tax = sum((i.cgst_amount or Decimal("0")) + (i.sgst_amount or Decimal("0")) + (i.igst_amount or Decimal("0")) for i in invoices)
        
        return {
            "period": {
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
            },
            "summary": {
                "total_invoices": len(invoices),
                "b2b_count": len(b2b_invoices),
                "b2c_count": len(b2c_invoices),
                "total_value": float(total_value),
                "total_tax": float(total_tax),
            },
            "tax_breakup": {
                "cgst": float(sum(i.cgst_amount or Decimal("0") for i in invoices)),
                "sgst": float(sum(i.sgst_amount or Decimal("0") for i in invoices)),
                "igst": float(sum(i.igst_amount or Decimal("0") for i in invoices)),
                "cess": float(sum(i.cess_amount or Decimal("0") for i in invoices)),
            },
        }
