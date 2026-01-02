"""
GST Reconciliation Service - GSTR-2A/2B import and ITC matching.

Features:
- Import GSTR-2A/2B data from JSON/Excel
- Auto-match with purchase invoices
- Identify discrepancies
- Generate reconciliation reports
"""
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple
from datetime import datetime, date
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database.models import PurchaseInvoice


class GSTR2MatchStatus(str, Enum):
    """Match status for GSTR-2A/2B records."""
    MATCHED = "matched"
    AMOUNT_MISMATCH = "amount_mismatch"
    DATE_MISMATCH = "date_mismatch"
    NOT_IN_BOOKS = "not_in_books"
    NOT_IN_GSTR = "not_in_gstr"
    GSTIN_MISMATCH = "gstin_mismatch"


@dataclass
class GSTR2Record:
    """Represents a record from GSTR-2A/2B."""
    supplier_gstin: str
    supplier_name: str
    invoice_number: str
    invoice_date: date
    invoice_value: Decimal
    taxable_value: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    cess: Decimal
    place_of_supply: str
    reverse_charge: bool = False
    invoice_type: str = "R"  # R=Regular, SEZWP=SEZ with payment, etc.


@dataclass
class ReconciliationResult:
    """Result of reconciling a single record."""
    gstr_record: GSTR2Record
    purchase_invoice: Optional[PurchaseInvoice]
    match_status: GSTR2MatchStatus
    amount_difference: Decimal
    tax_difference: Decimal
    notes: str


class GSTReconciliationService:
    """Service for GSTR-2A/2B reconciliation."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round to 2 decimal places."""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # ==================== GSTR-2A/2B IMPORT ====================
    
    def parse_gstr2b_json(self, json_data: Dict) -> List[GSTR2Record]:
        """
        Parse GSTR-2B JSON response from GST Portal.
        
        Expected structure:
        {
            "data": {
                "docdata": {
                    "b2b": [
                        {
                            "ctin": "GSTIN",
                            "trdnm": "Supplier Name",
                            "inv": [
                                {
                                    "inum": "Invoice Number",
                                    "dt": "DD-MM-YYYY",
                                    "val": 1000.00,
                                    "txval": 900.00,
                                    "igst": 0,
                                    "cgst": 81,
                                    "sgst": 81,
                                    "cess": 0
                                }
                            ]
                        }
                    ]
                }
            }
        }
        """
        records = []
        
        try:
            b2b_data = json_data.get("data", {}).get("docdata", {}).get("b2b", [])
            
            for supplier in b2b_data:
                gstin = supplier.get("ctin", "")
                supplier_name = supplier.get("trdnm", "")
                
                for inv in supplier.get("inv", []):
                    # Parse date (DD-MM-YYYY format)
                    date_str = inv.get("dt", "")
                    inv_date = datetime.strptime(date_str, "%d-%m-%Y").date() if date_str else None
                    
                    record = GSTR2Record(
                        supplier_gstin=gstin,
                        supplier_name=supplier_name,
                        invoice_number=inv.get("inum", ""),
                        invoice_date=inv_date,
                        invoice_value=Decimal(str(inv.get("val", 0))),
                        taxable_value=Decimal(str(inv.get("txval", 0))),
                        cgst=Decimal(str(inv.get("cgst", 0))),
                        sgst=Decimal(str(inv.get("sgst", 0))),
                        igst=Decimal(str(inv.get("igst", 0))),
                        cess=Decimal(str(inv.get("cess", 0))),
                        place_of_supply=inv.get("pos", ""),
                        reverse_charge=inv.get("rchrg", "N") == "Y",
                    )
                    records.append(record)
        
        except Exception as e:
            raise ValueError(f"Error parsing GSTR-2B JSON: {str(e)}")
        
        return records
    
    def import_gstr2b(
        self,
        company_id: str,
        return_period: str,  # MMYYYY format
        json_data: Dict,
    ) -> Dict:
        """
        Import GSTR-2B data for a return period.
        
        Returns summary of import.
        """
        records = self.parse_gstr2b_json(json_data)
        
        return {
            "return_period": return_period,
            "total_records": len(records),
            "total_taxable": sum(float(r.taxable_value) for r in records),
            "total_igst": sum(float(r.igst) for r in records),
            "total_cgst": sum(float(r.cgst) for r in records),
            "total_sgst": sum(float(r.sgst) for r in records),
            "records": [
                {
                    "supplier_gstin": r.supplier_gstin,
                    "supplier_name": r.supplier_name,
                    "invoice_number": r.invoice_number,
                    "invoice_date": r.invoice_date.isoformat() if r.invoice_date else None,
                    "invoice_value": float(r.invoice_value),
                    "taxable_value": float(r.taxable_value),
                    "cgst": float(r.cgst),
                    "sgst": float(r.sgst),
                    "igst": float(r.igst),
                }
                for r in records
            ],
        }
    
    # ==================== RECONCILIATION ====================
    
    def reconcile_record(
        self,
        company_id: str,
        gstr_record: GSTR2Record,
        tolerance: Decimal = Decimal("1"),  # Allow Rs. 1 difference
    ) -> ReconciliationResult:
        """
        Reconcile a single GSTR-2B record with purchase invoices.
        """
        # Search for matching purchase invoice
        # First try exact match on GSTIN + Invoice Number
        purchase_invoice = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.vendor_gstin == gstr_record.supplier_gstin,
            PurchaseInvoice.invoice_number == gstr_record.invoice_number,
        ).first()
        
        if not purchase_invoice:
            # Try fuzzy match (same invoice number, close date)
            purchase_invoice = self._fuzzy_match(company_id, gstr_record)
        
        if not purchase_invoice:
            return ReconciliationResult(
                gstr_record=gstr_record,
                purchase_invoice=None,
                match_status=GSTR2MatchStatus.NOT_IN_BOOKS,
                amount_difference=Decimal("0"),
                tax_difference=Decimal("0"),
                notes="Invoice not found in books. Verify vendor name and invoice number.",
            )
        
        # Compare amounts
        gstr_total_tax = gstr_record.cgst + gstr_record.sgst + gstr_record.igst
        books_total_tax = (
            (purchase_invoice.cgst_amount or Decimal("0")) +
            (purchase_invoice.sgst_amount or Decimal("0")) +
            (purchase_invoice.igst_amount or Decimal("0"))
        )
        
        amount_diff = abs(gstr_record.invoice_value - (purchase_invoice.total_amount or Decimal("0")))
        tax_diff = abs(gstr_total_tax - books_total_tax)
        
        # Check for date mismatch
        date_match = True
        if gstr_record.invoice_date and purchase_invoice.invoice_date:
            # Allow 1-day difference for timing issues
            date_diff = abs((gstr_record.invoice_date - purchase_invoice.invoice_date).days)
            date_match = date_diff <= 1
        
        # Determine match status
        if amount_diff <= tolerance and tax_diff <= tolerance and date_match:
            return ReconciliationResult(
                gstr_record=gstr_record,
                purchase_invoice=purchase_invoice,
                match_status=GSTR2MatchStatus.MATCHED,
                amount_difference=amount_diff,
                tax_difference=tax_diff,
                notes="Fully matched",
            )
        
        if not date_match:
            return ReconciliationResult(
                gstr_record=gstr_record,
                purchase_invoice=purchase_invoice,
                match_status=GSTR2MatchStatus.DATE_MISMATCH,
                amount_difference=amount_diff,
                tax_difference=tax_diff,
                notes=f"Date mismatch: GSTR={gstr_record.invoice_date}, Books={purchase_invoice.invoice_date}",
            )
        
        return ReconciliationResult(
            gstr_record=gstr_record,
            purchase_invoice=purchase_invoice,
            match_status=GSTR2MatchStatus.AMOUNT_MISMATCH,
            amount_difference=amount_diff,
            tax_difference=tax_diff,
            notes=f"Amount difference: Rs. {amount_diff}, Tax difference: Rs. {tax_diff}",
        )
    
    def _fuzzy_match(
        self,
        company_id: str,
        gstr_record: GSTR2Record,
    ) -> Optional[PurchaseInvoice]:
        """Attempt fuzzy matching for purchase invoice."""
        # Try matching by invoice number alone (different GSTIN format)
        invoice = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.invoice_number == gstr_record.invoice_number,
        ).first()
        
        if invoice:
            return invoice
        
        # Try matching by amount and approximate date
        if gstr_record.invoice_date:
            from_date = gstr_record.invoice_date.replace(day=1)
            to_date = gstr_record.invoice_date.replace(day=28)  # Safe for all months
            
            invoice = self.db.query(PurchaseInvoice).filter(
                PurchaseInvoice.company_id == company_id,
                PurchaseInvoice.total_amount == gstr_record.invoice_value,
                PurchaseInvoice.invoice_date >= from_date,
                PurchaseInvoice.invoice_date <= to_date,
            ).first()
        
        return invoice
    
    def reconcile_period(
        self,
        company_id: str,
        gstr_records: List[GSTR2Record],
    ) -> Dict:
        """
        Reconcile all GSTR-2B records for a period.
        """
        results = []
        summary = {
            "total_records": len(gstr_records),
            "matched": 0,
            "amount_mismatch": 0,
            "date_mismatch": 0,
            "not_in_books": 0,
            "not_in_gstr": 0,
        }
        
        for record in gstr_records:
            result = self.reconcile_record(company_id, record)
            results.append(result)
            
            summary[result.match_status.value.lower().replace(" ", "_")] = \
                summary.get(result.match_status.value.lower().replace(" ", "_"), 0) + 1
        
        # Find invoices in books but not in GSTR
        gstr_invoice_numbers = {r.invoice_number for r in gstr_records}
        gstr_gstins = {r.supplier_gstin for r in gstr_records}
        
        unmatched_in_books = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.vendor_gstin.in_(gstr_gstins),
            ~PurchaseInvoice.invoice_number.in_(gstr_invoice_numbers),
        ).count()
        
        summary["not_in_gstr"] = unmatched_in_books
        
        return {
            "summary": summary,
            "results": [
                {
                    "supplier_gstin": r.gstr_record.supplier_gstin,
                    "supplier_name": r.gstr_record.supplier_name,
                    "invoice_number": r.gstr_record.invoice_number,
                    "invoice_date": r.gstr_record.invoice_date.isoformat() if r.gstr_record.invoice_date else None,
                    "gstr_value": float(r.gstr_record.invoice_value),
                    "gstr_tax": float(r.gstr_record.cgst + r.gstr_record.sgst + r.gstr_record.igst),
                    "books_value": float(r.purchase_invoice.total_amount) if r.purchase_invoice else None,
                    "books_tax": float(
                        (r.purchase_invoice.cgst_amount or 0) +
                        (r.purchase_invoice.sgst_amount or 0) +
                        (r.purchase_invoice.igst_amount or 0)
                    ) if r.purchase_invoice else None,
                    "match_status": r.match_status.value,
                    "amount_diff": float(r.amount_difference),
                    "tax_diff": float(r.tax_difference),
                    "notes": r.notes,
                }
                for r in results
            ],
        }
    
    # ==================== ITC SUMMARY ====================
    
    def get_itc_reconciliation_summary(
        self,
        company_id: str,
        return_period: str,
        gstr_records: List[GSTR2Record],
    ) -> Dict:
        """
        Get ITC reconciliation summary showing:
        - ITC as per books
        - ITC as per GSTR-2B
        - Eligible ITC (matched)
        - ITC to reverse (not in 2B)
        - ITC to claim (in 2B, not in books)
        """
        # Calculate ITC from GSTR-2B
        itc_as_per_2b = {
            "cgst": sum(r.cgst for r in gstr_records),
            "sgst": sum(r.sgst for r in gstr_records),
            "igst": sum(r.igst for r in gstr_records),
            "cess": sum(r.cess for r in gstr_records),
        }
        itc_as_per_2b["total"] = sum(itc_as_per_2b.values())
        
        # Calculate ITC from books (purchase invoices for the period)
        # Parse return period (MMYYYY)
        month = int(return_period[:2])
        year = int(return_period[2:])
        
        from_date = date(year, month, 1)
        if month == 12:
            to_date = date(year + 1, 1, 1)
        else:
            to_date = date(year, month + 1, 1)
        
        purchases = self.db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == company_id,
            PurchaseInvoice.invoice_date >= from_date,
            PurchaseInvoice.invoice_date < to_date,
        ).all()
        
        itc_as_per_books = {
            "cgst": sum((p.cgst_amount or Decimal("0")) for p in purchases),
            "sgst": sum((p.sgst_amount or Decimal("0")) for p in purchases),
            "igst": sum((p.igst_amount or Decimal("0")) for p in purchases),
            "cess": Decimal("0"),  # Would need cess field in PurchaseInvoice
        }
        itc_as_per_books["total"] = sum(itc_as_per_books.values())
        
        # Reconcile to find eligible/ineligible
        reconciliation = self.reconcile_period(company_id, gstr_records)
        
        matched_tax = sum(
            r["gstr_tax"]
            for r in reconciliation["results"]
            if r["match_status"] == "matched"
        )
        
        not_in_books_tax = sum(
            r["gstr_tax"]
            for r in reconciliation["results"]
            if r["match_status"] == "not_in_books"
        )
        
        mismatched_tax = sum(
            r["tax_diff"]
            for r in reconciliation["results"]
            if r["match_status"] in ["amount_mismatch", "date_mismatch"]
        )
        
        return {
            "return_period": return_period,
            "itc_as_per_gstr2b": {k: float(v) for k, v in itc_as_per_2b.items()},
            "itc_as_per_books": {k: float(v) for k, v in itc_as_per_books.items()},
            "eligible_itc": matched_tax,
            "itc_to_reverse": float(itc_as_per_books["total"]) - matched_tax - mismatched_tax,
            "itc_to_claim": not_in_books_tax,
            "discrepancy": float(itc_as_per_2b["total"] - itc_as_per_books["total"]),
            "reconciliation_summary": reconciliation["summary"],
        }
