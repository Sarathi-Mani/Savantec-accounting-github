"""GST Report schemas - GSTR-1 and GSTR-3B."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class B2BInvoice(BaseModel):
    """B2B Invoice for GSTR-1."""
    customer_gstin: str
    customer_name: str
    invoice_number: str
    invoice_date: date
    invoice_value: Decimal
    place_of_supply: str
    is_reverse_charge: bool
    taxable_value: Decimal
    igst_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    cess_amount: Decimal


class B2CLInvoice(BaseModel):
    """B2C Large Invoice for GSTR-1 (>2.5L inter-state)."""
    place_of_supply: str
    invoice_number: str
    invoice_date: date
    invoice_value: Decimal
    taxable_value: Decimal
    igst_amount: Decimal
    cess_amount: Decimal


class B2CSInvoice(BaseModel):
    """B2C Small summary for GSTR-1."""
    place_of_supply: str
    gst_rate: Decimal
    taxable_value: Decimal
    igst_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    cess_amount: Decimal


class HSNSummary(BaseModel):
    """HSN-wise summary for GSTR-1."""
    hsn_code: str
    description: str
    uqc: str  # Unit Quantity Code
    total_quantity: Decimal
    total_value: Decimal
    taxable_value: Decimal
    igst_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    cess_amount: Decimal


class DocumentSummary(BaseModel):
    """Document summary for GSTR-1."""
    document_type: str  # Invoices, Debit Notes, Credit Notes
    from_serial: str
    to_serial: str
    total_number: int
    cancelled: int
    net_issued: int


class GSTR1Response(BaseModel):
    """GSTR-1 Return format."""
    gstin: str
    return_period: str  # MMYYYY format
    
    # B2B Invoices
    b2b_invoices: List[B2BInvoice] = []
    b2b_total: Decimal = Decimal("0")
    
    # B2C Large (>2.5L inter-state)
    b2cl_invoices: List[B2CLInvoice] = []
    b2cl_total: Decimal = Decimal("0")
    
    # B2C Small (summary)
    b2cs_summary: List[B2CSInvoice] = []
    b2cs_total: Decimal = Decimal("0")
    
    # HSN Summary
    hsn_summary: List[HSNSummary] = []
    
    # Document Summary
    document_summary: List[DocumentSummary] = []
    
    # Totals
    total_taxable_value: Decimal = Decimal("0")
    total_igst: Decimal = Decimal("0")
    total_cgst: Decimal = Decimal("0")
    total_sgst: Decimal = Decimal("0")
    total_cess: Decimal = Decimal("0")
    total_tax: Decimal = Decimal("0")


class GSTR3BLiability(BaseModel):
    """Tax liability for GSTR-3B."""
    description: str
    taxable_value: Decimal
    igst: Decimal
    cgst: Decimal
    sgst: Decimal
    cess: Decimal


class GSTR3BITC(BaseModel):
    """Input Tax Credit for GSTR-3B."""
    description: str
    igst: Decimal
    cgst: Decimal
    sgst: Decimal
    cess: Decimal


class GSTR3BResponse(BaseModel):
    """GSTR-3B Return format."""
    gstin: str
    return_period: str  # MMYYYY format
    legal_name: str
    
    # 3.1 - Outward supplies
    outward_taxable_supplies: GSTR3BLiability
    outward_taxable_zero_rated: GSTR3BLiability
    outward_nil_rated_exempt: GSTR3BLiability
    inward_reverse_charge: GSTR3BLiability
    non_gst_outward: GSTR3BLiability
    
    # 3.2 - Inter-state supplies
    inter_state_supplies_to_unregistered: List[dict] = []
    inter_state_supplies_to_composition: List[dict] = []
    
    # 4 - ITC Available
    itc_available: GSTR3BITC
    itc_reversed: GSTR3BITC
    net_itc: GSTR3BITC
    
    # 5 - Exempt, Nil, Non-GST
    inter_state_exempt: Decimal = Decimal("0")
    intra_state_exempt: Decimal = Decimal("0")
    
    # 6.1 - Tax Payable and Paid
    total_tax_liability: Decimal = Decimal("0")
    total_itc_available: Decimal = Decimal("0")
    tax_payable: Decimal = Decimal("0")
    
    # Interest, Late Fee
    interest_payable: Decimal = Decimal("0")
    late_fee_payable: Decimal = Decimal("0")


class GSTSummary(BaseModel):
    """GST Summary for dashboard."""
    period: str
    start_date: date
    end_date: date
    
    # Sales summary
    total_sales: Decimal
    taxable_sales: Decimal
    exempt_sales: Decimal
    zero_rated_sales: Decimal
    
    # Tax collected
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal
    total_cess: Decimal
    total_tax: Decimal
    
    # Invoice counts
    total_invoices: int
    b2b_invoices: int
    b2c_invoices: int
    
    # By rate
    gst_by_rate: List[dict] = []  # [{rate: 18, taxable: 1000, tax: 180}, ...]


class GSTReportRequest(BaseModel):
    """Request for GST report generation."""
    company_id: str
    return_type: str  # gstr1, gstr3b
    month: int  # 1-12
    year: int
    generate_json: bool = False
    generate_excel: bool = False

