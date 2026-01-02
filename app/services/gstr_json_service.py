"""
GSTR JSON Export Service - Generate GSTR-1 and GSTR-3B JSON files.

Features:
- GSTR-1 JSON generation (B2B, B2C, CDN, exports)
- GSTR-3B JSON generation
- HSN summary
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import Invoice, InvoiceItem, PurchaseInvoice, Customer


class GSTRJsonService:
    """Service for GSTR JSON generation."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round(self, amount) -> float:
        if amount is None:
            return 0.0
        return float(Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    
    def generate_gstr1_json(
        self,
        company_id: str,
        return_period: str,  # "012024" for January 2024
        gstin: str,
    ) -> Dict:
        """Generate GSTR-1 JSON file structure."""
        # Parse period
        month = int(return_period[:2])
        year = int(return_period[2:])
        
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        # Get invoices for the period
        invoices = self.db.query(Invoice).filter(
            Invoice.company_id == company_id,
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date < end_date,
        ).all()
        
        # Build JSON structure
        gstr1 = {
            "gstin": gstin,
            "fp": return_period,
            "version": "GST3.0.4",
            "hash": "hash",
            "b2b": self._build_b2b(invoices),
            "b2cl": self._build_b2cl(invoices),
            "b2cs": self._build_b2cs(invoices),
            "cdnr": self._build_cdnr(invoices),
            "exp": self._build_exports(invoices),
            "hsn": self._build_hsn_summary(invoices),
            "nil": self._build_nil_supplies(invoices),
            "doc_issue": self._build_doc_issue(invoices),
        }
        
        return gstr1
    
    def _build_b2b(self, invoices: List[Invoice]) -> List[Dict]:
        """Build B2B (Business to Business) section."""
        b2b_invoices = [inv for inv in invoices if inv.customer and inv.customer.gstin]
        
        # Group by customer GSTIN
        by_gstin = {}
        for inv in b2b_invoices:
            gstin = inv.customer.gstin
            if gstin not in by_gstin:
                by_gstin[gstin] = []
            by_gstin[gstin].append(inv)
        
        result = []
        for gstin, inv_list in by_gstin.items():
            customer_invoices = []
            for inv in inv_list:
                customer_invoices.append({
                    "inum": inv.invoice_number,
                    "idt": inv.invoice_date.strftime("%d-%m-%Y"),
                    "val": self._round(inv.total_amount),
                    "pos": inv.place_of_supply or "27",
                    "rchrg": "Y" if inv.is_reverse_charge else "N",
                    "inv_typ": "R",
                    "itms": self._build_invoice_items(inv),
                })
            
            result.append({
                "ctin": gstin,
                "inv": customer_invoices,
            })
        
        return result
    
    def _build_b2cl(self, invoices: List[Invoice]) -> List[Dict]:
        """Build B2C Large (>2.5L) section."""
        b2cl_invoices = [
            inv for inv in invoices 
            if not (inv.customer and inv.customer.gstin)
            and inv.total_amount >= 250000
            and inv.place_of_supply
        ]
        
        by_pos = {}
        for inv in b2cl_invoices:
            pos = inv.place_of_supply
            if pos not in by_pos:
                by_pos[pos] = []
            by_pos[pos].append(inv)
        
        result = []
        for pos, inv_list in by_pos.items():
            inv_details = []
            for inv in inv_list:
                inv_details.append({
                    "inum": inv.invoice_number,
                    "idt": inv.invoice_date.strftime("%d-%m-%Y"),
                    "val": self._round(inv.total_amount),
                    "itms": self._build_invoice_items(inv),
                })
            
            result.append({
                "pos": pos,
                "inv": inv_details,
            })
        
        return result
    
    def _build_b2cs(self, invoices: List[Invoice]) -> List[Dict]:
        """Build B2C Small (<2.5L) section - summary by rate."""
        b2cs_invoices = [
            inv for inv in invoices 
            if not (inv.customer and inv.customer.gstin)
            and inv.total_amount < 250000
        ]
        
        # Group by GST rate and place of supply
        summary = {}
        for inv in b2cs_invoices:
            for item in inv.items:
                key = (inv.place_of_supply or "27", float(item.gst_rate))
                if key not in summary:
                    summary[key] = {
                        "pos": key[0],
                        "rt": key[1],
                        "sply_ty": "INTRA" if inv.place_of_supply == "27" else "INTER",
                        "txval": Decimal('0'),
                        "camt": Decimal('0'),
                        "samt": Decimal('0'),
                        "iamt": Decimal('0'),
                        "csamt": Decimal('0'),
                    }
                
                summary[key]["txval"] += item.taxable_amount or Decimal('0')
                summary[key]["camt"] += item.cgst_amount or Decimal('0')
                summary[key]["samt"] += item.sgst_amount or Decimal('0')
                summary[key]["iamt"] += item.igst_amount or Decimal('0')
                summary[key]["csamt"] += item.cess_amount or Decimal('0')
        
        result = []
        for data in summary.values():
            result.append({
                "pos": data["pos"],
                "rt": data["rt"],
                "sply_ty": data["sply_ty"],
                "txval": self._round(data["txval"]),
                "camt": self._round(data["camt"]),
                "samt": self._round(data["samt"]),
                "iamt": self._round(data["iamt"]),
                "csamt": self._round(data["csamt"]),
            })
        
        return result
    
    def _build_cdnr(self, invoices: List[Invoice]) -> List[Dict]:
        """Build Credit/Debit Notes section."""
        # Filter for credit/debit notes
        cdn_invoices = [inv for inv in invoices if inv.invoice_type and 'note' in str(inv.invoice_type).lower()]
        
        # Group by customer GSTIN
        by_gstin = {}
        for inv in cdn_invoices:
            if inv.customer and inv.customer.gstin:
                gstin = inv.customer.gstin
                if gstin not in by_gstin:
                    by_gstin[gstin] = []
                by_gstin[gstin].append(inv)
        
        result = []
        for gstin, inv_list in by_gstin.items():
            notes = []
            for inv in inv_list:
                notes.append({
                    "ntty": "C",  # Credit note
                    "nt_num": inv.invoice_number,
                    "nt_dt": inv.invoice_date.strftime("%d-%m-%Y"),
                    "val": self._round(inv.total_amount),
                    "pos": inv.place_of_supply or "27",
                    "rchrg": "N",
                    "itms": self._build_invoice_items(inv),
                })
            
            result.append({
                "ctin": gstin,
                "nt": notes,
            })
        
        return result
    
    def _build_exports(self, invoices: List[Invoice]) -> List[Dict]:
        """Build Exports section."""
        export_invoices = [
            inv for inv in invoices 
            if inv.invoice_type and inv.invoice_type.value in ['export', 'sez']
        ]
        
        if not export_invoices:
            return []
        
        exp_with_pay = []
        exp_without_pay = []
        
        for inv in export_invoices:
            entry = {
                "inum": inv.invoice_number,
                "idt": inv.invoice_date.strftime("%d-%m-%Y"),
                "val": self._round(inv.total_amount),
                "sbnum": "",
                "sbdt": inv.invoice_date.strftime("%d-%m-%Y"),
                "itms": self._build_invoice_items(inv),
            }
            
            if inv.igst_amount and inv.igst_amount > 0:
                exp_with_pay.append(entry)
            else:
                exp_without_pay.append(entry)
        
        return [
            {"exp_typ": "WPAY", "inv": exp_with_pay} if exp_with_pay else None,
            {"exp_typ": "WOPAY", "inv": exp_without_pay} if exp_without_pay else None,
        ]
    
    def _build_hsn_summary(self, invoices: List[Invoice]) -> Dict:
        """Build HSN Summary section."""
        hsn_data = {}
        
        for inv in invoices:
            for item in inv.items:
                hsn = item.hsn_code or "0"
                if hsn not in hsn_data:
                    hsn_data[hsn] = {
                        "hsn_sc": hsn,
                        "desc": "",
                        "uqc": item.unit or "NOS",
                        "qty": Decimal('0'),
                        "val": Decimal('0'),
                        "txval": Decimal('0'),
                        "iamt": Decimal('0'),
                        "camt": Decimal('0'),
                        "samt": Decimal('0'),
                        "csamt": Decimal('0'),
                    }
                
                hsn_data[hsn]["qty"] += item.quantity or Decimal('0')
                hsn_data[hsn]["val"] += item.total_amount or Decimal('0')
                hsn_data[hsn]["txval"] += item.taxable_amount or Decimal('0')
                hsn_data[hsn]["iamt"] += item.igst_amount or Decimal('0')
                hsn_data[hsn]["camt"] += item.cgst_amount or Decimal('0')
                hsn_data[hsn]["samt"] += item.sgst_amount or Decimal('0')
                hsn_data[hsn]["csamt"] += item.cess_amount or Decimal('0')
        
        data = []
        for entry in hsn_data.values():
            data.append({
                "hsn_sc": entry["hsn_sc"],
                "desc": entry["desc"],
                "uqc": entry["uqc"],
                "qty": self._round(entry["qty"]),
                "val": self._round(entry["val"]),
                "txval": self._round(entry["txval"]),
                "iamt": self._round(entry["iamt"]),
                "camt": self._round(entry["camt"]),
                "samt": self._round(entry["samt"]),
                "csamt": self._round(entry["csamt"]),
            })
        
        return {"data": data}
    
    def _build_nil_supplies(self, invoices: List[Invoice]) -> Dict:
        """Build Nil/Exempt supplies section."""
        nil_invoices = [inv for inv in invoices if inv.total_tax == 0]
        
        total = sum(inv.total_amount or Decimal('0') for inv in nil_invoices)
        
        return {
            "inv": [
                {
                    "sply_ty": "INTRB2B",
                    "expt_amt": 0,
                    "nil_amt": self._round(total),
                    "ngsup_amt": 0,
                }
            ]
        }
    
    def _build_doc_issue(self, invoices: List[Invoice]) -> Dict:
        """Build Document Issue Summary."""
        if not invoices:
            return {"doc_det": []}
        
        invoice_numbers = [inv.invoice_number for inv in invoices]
        
        return {
            "doc_det": [
                {
                    "doc_num": 1,
                    "doc_typ": "Invoices for outward supply",
                    "docs": [
                        {
                            "num": 1,
                            "from": min(invoice_numbers) if invoice_numbers else "",
                            "to": max(invoice_numbers) if invoice_numbers else "",
                            "totnum": len(invoices),
                            "cancel": 0,
                            "net_issue": len(invoices),
                        }
                    ]
                }
            ]
        }
    
    def _build_invoice_items(self, invoice: Invoice) -> List[Dict]:
        """Build items array for an invoice."""
        items = []
        for item in invoice.items:
            items.append({
                "num": len(items) + 1,
                "itm_det": {
                    "txval": self._round(item.taxable_amount),
                    "rt": float(item.gst_rate),
                    "iamt": self._round(item.igst_amount),
                    "camt": self._round(item.cgst_amount),
                    "samt": self._round(item.sgst_amount),
                    "csamt": self._round(item.cess_amount),
                }
            })
        return items
    
    def generate_gstr3b_json(
        self,
        company_id: str,
        return_period: str,
        gstin: str,
    ) -> Dict:
        """Generate GSTR-3B JSON file structure."""
        month = int(return_period[:2])
        year = int(return_period[2:])
        
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        # Get sales invoices
        sales = self.db.query(Invoice).filter(
            Invoice.company_id == company_id,
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date < end_date,
        ).all()
        
        # Get purchase invoices
        purchases = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.invoice_date >= start_date,
            PurchaseInvoice.invoice_date < end_date,
        ).all()
        
        # Calculate totals
        outward_taxable = sum(inv.subtotal or Decimal('0') for inv in sales)
        outward_igst = sum(inv.igst_amount or Decimal('0') for inv in sales)
        outward_cgst = sum(inv.cgst_amount or Decimal('0') for inv in sales)
        outward_sgst = sum(inv.sgst_amount or Decimal('0') for inv in sales)
        
        inward_taxable = sum(inv.subtotal or Decimal('0') for inv in purchases if inv.itc_eligible)
        inward_igst = sum(inv.igst_amount or Decimal('0') for inv in purchases if inv.itc_eligible)
        inward_cgst = sum(inv.cgst_amount or Decimal('0') for inv in purchases if inv.itc_eligible)
        inward_sgst = sum(inv.sgst_amount or Decimal('0') for inv in purchases if inv.itc_eligible)
        
        return {
            "gstin": gstin,
            "ret_period": return_period,
            "sup_details": {
                "osup_det": {
                    "txval": self._round(outward_taxable),
                    "iamt": self._round(outward_igst),
                    "camt": self._round(outward_cgst),
                    "samt": self._round(outward_sgst),
                    "csamt": 0,
                },
                "osup_zero": {"txval": 0, "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                "osup_nil_exmp": {"txval": 0},
                "isup_rev": {"txval": 0, "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                "osup_nongst": {"txval": 0},
            },
            "itc_elg": {
                "itc_avl": [
                    {"ty": "IMPG", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    {"ty": "IMPS", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    {"ty": "ISRC", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    {"ty": "ISD", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    {
                        "ty": "OTH",
                        "iamt": self._round(inward_igst),
                        "camt": self._round(inward_cgst),
                        "samt": self._round(inward_sgst),
                        "csamt": 0,
                    },
                ],
                "itc_rev": [
                    {"ty": "RUL", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    {"ty": "OTH", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                ],
                "itc_net": {
                    "iamt": self._round(inward_igst),
                    "camt": self._round(inward_cgst),
                    "samt": self._round(inward_sgst),
                    "csamt": 0,
                },
                "itc_inelg": [
                    {"ty": "RUL", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                    {"ty": "OTH", "iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                ],
            },
            "inward_sup": {
                "isup_details": [
                    {"ty": "GST", "inter": 0, "intra": self._round(inward_taxable)},
                    {"ty": "NONGST", "inter": 0, "intra": 0},
                ]
            },
            "intr_ltfee": {
                "intr_details": {"iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
                "ltfee_details": {"iamt": 0, "camt": 0, "samt": 0, "csamt": 0},
            },
        }
