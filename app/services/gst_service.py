"""GST Report service for GSTR-1 and GSTR-3B generation."""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from collections import defaultdict
from app.database.models import (
    Invoice, InvoiceItem, Company, Customer,
    InvoiceStatus, InvoiceType, INDIAN_STATE_CODES
)
from app.schemas.gst import (
    GSTR1Response, GSTR3BResponse,
    B2BInvoice, B2CLInvoice, B2CSInvoice,
    HSNSummary, DocumentSummary,
    GSTR3BLiability, GSTR3BITC, GSTSummary
)


class GSTService:
    """Service for GST report generation."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_period_invoices(
        self,
        company: Company,
        month: int,
        year: int
    ) -> List[Invoice]:
        """Get all invoices for a given period."""
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        return self.db.query(Invoice).filter(
            Invoice.company_id == company.id,
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date < end_date,
            Invoice.status != InvoiceStatus.CANCELLED,
            Invoice.status != InvoiceStatus.DRAFT
        ).all()
    
    def generate_gstr1(
        self,
        company: Company,
        month: int,
        year: int
    ) -> GSTR1Response:
        """Generate GSTR-1 report for a month."""
        invoices = self._get_period_invoices(company, month, year)
        
        b2b_invoices = []
        b2cl_invoices = []
        b2cs_summary = defaultdict(lambda: {
            "taxable_value": Decimal("0"),
            "igst_amount": Decimal("0"),
            "cgst_amount": Decimal("0"),
            "sgst_amount": Decimal("0"),
            "cess_amount": Decimal("0")
        })
        hsn_summary = defaultdict(lambda: {
            "description": "",
            "uqc": "OTH",
            "total_quantity": Decimal("0"),
            "total_value": Decimal("0"),
            "taxable_value": Decimal("0"),
            "igst_amount": Decimal("0"),
            "cgst_amount": Decimal("0"),
            "sgst_amount": Decimal("0"),
            "cess_amount": Decimal("0")
        })
        
        b2b_total = Decimal("0")
        b2cl_total = Decimal("0")
        b2cs_total = Decimal("0")
        
        for invoice in invoices:
            customer = invoice.customer
            
            # B2B Invoices (with GSTIN)
            if invoice.invoice_type == InvoiceType.B2B or (customer and customer.gstin):
                b2b_inv = B2BInvoice(
                    customer_gstin=customer.gstin if customer else "",
                    customer_name=customer.name if customer else "",
                    invoice_number=invoice.invoice_number,
                    invoice_date=invoice.invoice_date.date(),
                    invoice_value=invoice.total_amount,
                    place_of_supply=invoice.place_of_supply or "",
                    is_reverse_charge=invoice.is_reverse_charge,
                    taxable_value=invoice.subtotal,
                    igst_amount=invoice.igst_amount,
                    cgst_amount=invoice.cgst_amount,
                    sgst_amount=invoice.sgst_amount,
                    cess_amount=invoice.cess_amount
                )
                b2b_invoices.append(b2b_inv)
                b2b_total += invoice.total_amount
            
            # B2C Large (>2.5L inter-state without GSTIN)
            elif invoice.total_amount > 250000 and company.state_code != invoice.place_of_supply:
                b2cl_inv = B2CLInvoice(
                    place_of_supply=invoice.place_of_supply or "",
                    invoice_number=invoice.invoice_number,
                    invoice_date=invoice.invoice_date.date(),
                    invoice_value=invoice.total_amount,
                    taxable_value=invoice.subtotal,
                    igst_amount=invoice.igst_amount,
                    cess_amount=invoice.cess_amount
                )
                b2cl_invoices.append(b2cl_inv)
                b2cl_total += invoice.total_amount
            
            # B2C Small (aggregate by state and rate)
            else:
                pos = invoice.place_of_supply or company.state_code or ""
                for item in invoice.items:
                    rate = item.gst_rate
                    key = f"{pos}_{rate}"
                    b2cs_summary[key]["taxable_value"] += item.taxable_amount
                    b2cs_summary[key]["igst_amount"] += item.igst_amount
                    b2cs_summary[key]["cgst_amount"] += item.cgst_amount
                    b2cs_summary[key]["sgst_amount"] += item.sgst_amount
                    b2cs_summary[key]["cess_amount"] += item.cess_amount
                b2cs_total += invoice.total_amount
            
            # HSN Summary
            for item in invoice.items:
                hsn = item.hsn_code or "00000000"
                hsn_summary[hsn]["description"] = item.description[:50]
                hsn_summary[hsn]["total_quantity"] += item.quantity
                hsn_summary[hsn]["total_value"] += item.total_amount
                hsn_summary[hsn]["taxable_value"] += item.taxable_amount
                hsn_summary[hsn]["igst_amount"] += item.igst_amount
                hsn_summary[hsn]["cgst_amount"] += item.cgst_amount
                hsn_summary[hsn]["sgst_amount"] += item.sgst_amount
                hsn_summary[hsn]["cess_amount"] += item.cess_amount
        
        # Convert B2CS summary to list
        b2cs_list = []
        for key, data in b2cs_summary.items():
            pos, rate = key.split("_")
            b2cs_list.append(B2CSInvoice(
                place_of_supply=pos,
                gst_rate=Decimal(rate),
                taxable_value=data["taxable_value"],
                igst_amount=data["igst_amount"],
                cgst_amount=data["cgst_amount"],
                sgst_amount=data["sgst_amount"],
                cess_amount=data["cess_amount"]
            ))
        
        # Convert HSN summary to list
        hsn_list = []
        for hsn, data in hsn_summary.items():
            hsn_list.append(HSNSummary(
                hsn_code=hsn,
                description=data["description"],
                uqc=data["uqc"],
                total_quantity=data["total_quantity"],
                total_value=data["total_value"],
                taxable_value=data["taxable_value"],
                igst_amount=data["igst_amount"],
                cgst_amount=data["cgst_amount"],
                sgst_amount=data["sgst_amount"],
                cess_amount=data["cess_amount"]
            ))
        
        # Document summary
        doc_summary = []
        if invoices:
            invoice_numbers = sorted([inv.invoice_number for inv in invoices])
            doc_summary.append(DocumentSummary(
                document_type="Invoices",
                from_serial=invoice_numbers[0],
                to_serial=invoice_numbers[-1],
                total_number=len(invoices),
                cancelled=0,
                net_issued=len(invoices)
            ))
        
        # Calculate totals
        total_taxable = sum(inv.subtotal for inv in invoices)
        total_igst = sum(inv.igst_amount for inv in invoices)
        total_cgst = sum(inv.cgst_amount for inv in invoices)
        total_sgst = sum(inv.sgst_amount for inv in invoices)
        total_cess = sum(inv.cess_amount for inv in invoices)
        total_tax = total_igst + total_cgst + total_sgst + total_cess
        
        return GSTR1Response(
            gstin=company.gstin or "",
            return_period=f"{month:02d}{year}",
            b2b_invoices=b2b_invoices,
            b2b_total=b2b_total,
            b2cl_invoices=b2cl_invoices,
            b2cl_total=b2cl_total,
            b2cs_summary=b2cs_list,
            b2cs_total=b2cs_total,
            hsn_summary=hsn_list,
            document_summary=doc_summary,
            total_taxable_value=total_taxable,
            total_igst=total_igst,
            total_cgst=total_cgst,
            total_sgst=total_sgst,
            total_cess=total_cess,
            total_tax=total_tax
        )
    
    def generate_gstr3b(
        self,
        company: Company,
        month: int,
        year: int
    ) -> GSTR3BResponse:
        """Generate GSTR-3B report for a month."""
        invoices = self._get_period_invoices(company, month, year)
        
        # Calculate outward supplies
        taxable_supplies = {
            "taxable_value": Decimal("0"),
            "igst": Decimal("0"),
            "cgst": Decimal("0"),
            "sgst": Decimal("0"),
            "cess": Decimal("0")
        }
        
        zero_rated = {
            "taxable_value": Decimal("0"),
            "igst": Decimal("0"),
            "cgst": Decimal("0"),
            "sgst": Decimal("0"),
            "cess": Decimal("0")
        }
        
        nil_exempt = {
            "taxable_value": Decimal("0"),
            "igst": Decimal("0"),
            "cgst": Decimal("0"),
            "sgst": Decimal("0"),
            "cess": Decimal("0")
        }
        
        reverse_charge = {
            "taxable_value": Decimal("0"),
            "igst": Decimal("0"),
            "cgst": Decimal("0"),
            "sgst": Decimal("0"),
            "cess": Decimal("0")
        }
        
        inter_state_unreg = []
        
        for invoice in invoices:
            if invoice.is_reverse_charge:
                reverse_charge["taxable_value"] += invoice.subtotal
                reverse_charge["igst"] += invoice.igst_amount
                reverse_charge["cgst"] += invoice.cgst_amount
                reverse_charge["sgst"] += invoice.sgst_amount
                reverse_charge["cess"] += invoice.cess_amount
            else:
                taxable_supplies["taxable_value"] += invoice.subtotal
                taxable_supplies["igst"] += invoice.igst_amount
                taxable_supplies["cgst"] += invoice.cgst_amount
                taxable_supplies["sgst"] += invoice.sgst_amount
                taxable_supplies["cess"] += invoice.cess_amount
            
            # Track inter-state B2C
            if (invoice.invoice_type in [InvoiceType.B2C, InvoiceType.B2CL] and
                company.state_code != invoice.place_of_supply):
                pos = invoice.place_of_supply or ""
                existing = next(
                    (x for x in inter_state_unreg if x.get("place_of_supply") == pos),
                    None
                )
                if existing:
                    existing["taxable_value"] += invoice.subtotal
                    existing["igst"] += invoice.igst_amount
                else:
                    inter_state_unreg.append({
                        "place_of_supply": pos,
                        "taxable_value": invoice.subtotal,
                        "igst": invoice.igst_amount
                    })
        
        # ITC - For now, we don't track purchases, so ITC is zero
        itc_available = GSTR3BITC(
            description="ITC Available",
            igst=Decimal("0"),
            cgst=Decimal("0"),
            sgst=Decimal("0"),
            cess=Decimal("0")
        )
        
        itc_reversed = GSTR3BITC(
            description="ITC Reversed",
            igst=Decimal("0"),
            cgst=Decimal("0"),
            sgst=Decimal("0"),
            cess=Decimal("0")
        )
        
        net_itc = GSTR3BITC(
            description="Net ITC",
            igst=Decimal("0"),
            cgst=Decimal("0"),
            sgst=Decimal("0"),
            cess=Decimal("0")
        )
        
        # Calculate tax payable
        total_tax_liability = (
            taxable_supplies["igst"] + taxable_supplies["cgst"] +
            taxable_supplies["sgst"] + taxable_supplies["cess"]
        )
        
        return GSTR3BResponse(
            gstin=company.gstin or "",
            return_period=f"{month:02d}{year}",
            legal_name=company.name,
            outward_taxable_supplies=GSTR3BLiability(
                description="Outward taxable supplies",
                taxable_value=taxable_supplies["taxable_value"],
                igst=taxable_supplies["igst"],
                cgst=taxable_supplies["cgst"],
                sgst=taxable_supplies["sgst"],
                cess=taxable_supplies["cess"]
            ),
            outward_taxable_zero_rated=GSTR3BLiability(
                description="Zero rated supplies",
                taxable_value=zero_rated["taxable_value"],
                igst=zero_rated["igst"],
                cgst=zero_rated["cgst"],
                sgst=zero_rated["sgst"],
                cess=zero_rated["cess"]
            ),
            outward_nil_rated_exempt=GSTR3BLiability(
                description="Nil rated and exempt supplies",
                taxable_value=nil_exempt["taxable_value"],
                igst=nil_exempt["igst"],
                cgst=nil_exempt["cgst"],
                sgst=nil_exempt["sgst"],
                cess=nil_exempt["cess"]
            ),
            inward_reverse_charge=GSTR3BLiability(
                description="Inward supplies (Reverse charge)",
                taxable_value=reverse_charge["taxable_value"],
                igst=reverse_charge["igst"],
                cgst=reverse_charge["cgst"],
                sgst=reverse_charge["sgst"],
                cess=reverse_charge["cess"]
            ),
            non_gst_outward=GSTR3BLiability(
                description="Non-GST outward supplies",
                taxable_value=Decimal("0"),
                igst=Decimal("0"),
                cgst=Decimal("0"),
                sgst=Decimal("0"),
                cess=Decimal("0")
            ),
            inter_state_supplies_to_unregistered=inter_state_unreg,
            inter_state_supplies_to_composition=[],
            itc_available=itc_available,
            itc_reversed=itc_reversed,
            net_itc=net_itc,
            inter_state_exempt=Decimal("0"),
            intra_state_exempt=Decimal("0"),
            total_tax_liability=total_tax_liability,
            total_itc_available=Decimal("0"),
            tax_payable=total_tax_liability,
            interest_payable=Decimal("0"),
            late_fee_payable=Decimal("0")
        )
    
    def get_gst_summary(
        self,
        company: Company,
        month: int,
        year: int
    ) -> GSTSummary:
        """Get GST summary for a period."""
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        invoices = self._get_period_invoices(company, month, year)
        
        # Calculate totals
        total_sales = sum(inv.total_amount for inv in invoices)
        taxable_sales = sum(inv.subtotal for inv in invoices)
        
        total_cgst = sum(inv.cgst_amount for inv in invoices)
        total_sgst = sum(inv.sgst_amount for inv in invoices)
        total_igst = sum(inv.igst_amount for inv in invoices)
        total_cess = sum(inv.cess_amount for inv in invoices)
        total_tax = total_cgst + total_sgst + total_igst + total_cess
        
        # Count by type
        b2b_count = len([inv for inv in invoices if inv.invoice_type == InvoiceType.B2B])
        b2c_count = len(invoices) - b2b_count
        
        # Group by rate
        rate_summary = defaultdict(lambda: {"taxable": Decimal("0"), "tax": Decimal("0")})
        for invoice in invoices:
            for item in invoice.items:
                rate = str(item.gst_rate)
                rate_summary[rate]["taxable"] += item.taxable_amount
                rate_summary[rate]["tax"] += (
                    item.cgst_amount + item.sgst_amount +
                    item.igst_amount + item.cess_amount
                )
        
        gst_by_rate = [
            {"rate": rate, "taxable": data["taxable"], "tax": data["tax"]}
            for rate, data in rate_summary.items()
        ]
        
        return GSTSummary(
            period=f"{month:02d}/{year}",
            start_date=start_date.date(),
            end_date=(end_date - timedelta(days=1)).date(),
            total_sales=total_sales,
            taxable_sales=taxable_sales,
            exempt_sales=Decimal("0"),
            zero_rated_sales=Decimal("0"),
            total_cgst=total_cgst,
            total_sgst=total_sgst,
            total_igst=total_igst,
            total_cess=total_cess,
            total_tax=total_tax,
            total_invoices=len(invoices),
            b2b_invoices=b2b_count,
            b2c_invoices=b2c_count,
            gst_by_rate=gst_by_rate
        )


from datetime import timedelta

