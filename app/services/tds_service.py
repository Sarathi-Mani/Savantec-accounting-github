"""TDS Service - Handles Tax Deducted at Source calculations and tracking."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP

from app.database.models import (
    TDSSection, TDSEntry, Company, Customer, PurchaseInvoice,
    Account, Transaction, TransactionEntry, AccountType, TransactionStatus, ReferenceType
)


# Default TDS Sections as per Income Tax Act
DEFAULT_TDS_SECTIONS = [
    {
        "section_code": "194A",
        "description": "Interest other than interest on securities",
        "rate_individual": Decimal("10"),
        "rate_company": Decimal("10"),
        "threshold_single": Decimal("0"),
        "threshold_annual": Decimal("40000"),  # 50000 for senior citizens
        "nature_of_payment": "Interest"
    },
    {
        "section_code": "194C",
        "description": "Payment to contractor/sub-contractor",
        "rate_individual": Decimal("1"),
        "rate_company": Decimal("2"),
        "threshold_single": Decimal("30000"),
        "threshold_annual": Decimal("100000"),
        "nature_of_payment": "Contractor Payment"
    },
    {
        "section_code": "194H",
        "description": "Commission or Brokerage",
        "rate_individual": Decimal("5"),
        "rate_company": Decimal("5"),
        "threshold_single": Decimal("0"),
        "threshold_annual": Decimal("15000"),
        "nature_of_payment": "Commission/Brokerage"
    },
    {
        "section_code": "194I(a)",
        "description": "Rent - Plant and Machinery",
        "rate_individual": Decimal("2"),
        "rate_company": Decimal("2"),
        "threshold_single": Decimal("0"),
        "threshold_annual": Decimal("240000"),
        "nature_of_payment": "Rent - Plant & Machinery"
    },
    {
        "section_code": "194I(b)",
        "description": "Rent - Land, Building, Furniture",
        "rate_individual": Decimal("10"),
        "rate_company": Decimal("10"),
        "threshold_single": Decimal("0"),
        "threshold_annual": Decimal("240000"),
        "nature_of_payment": "Rent - Land/Building"
    },
    {
        "section_code": "194J",
        "description": "Professional/Technical Fees",
        "rate_individual": Decimal("10"),
        "rate_company": Decimal("10"),
        "threshold_single": Decimal("0"),
        "threshold_annual": Decimal("30000"),
        "nature_of_payment": "Professional/Technical Fees"
    },
    {
        "section_code": "194Q",
        "description": "Purchase of goods",
        "rate_individual": Decimal("0.1"),
        "rate_company": Decimal("0.1"),
        "threshold_single": Decimal("0"),
        "threshold_annual": Decimal("5000000"),
        "nature_of_payment": "Purchase of Goods"
    },
]


class TDSService:
    """Service for TDS operations and compliance."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _round_amount(self, amount: Decimal) -> Decimal:
        """Round amount to nearest rupee."""
        return Decimal(amount).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    
    def _get_financial_year_quarter(self, date_obj: datetime) -> Tuple[str, str]:
        """Get financial year and quarter for a date."""
        year = date_obj.year
        month = date_obj.month
        
        if month < 4:
            fy_start = year - 1
            fy_end = year
        else:
            fy_start = year
            fy_end = year + 1
        
        financial_year = f"{fy_start}-{fy_end}"
        
        if month in [4, 5, 6]:
            quarter = "Q1"
        elif month in [7, 8, 9]:
            quarter = "Q2"
        elif month in [10, 11, 12]:
            quarter = "Q3"
        else:
            quarter = "Q4"
        
        return financial_year, quarter
    
    # ==================== TDS SECTIONS ====================
    
    def initialize_tds_sections(self, company: Company) -> List[TDSSection]:
        """Initialize default TDS sections for a company."""
        existing = self.db.query(TDSSection).filter(
            TDSSection.company_id == company.id
        ).first()
        
        if existing:
            return self.get_tds_sections(company)
        
        sections = []
        for section_data in DEFAULT_TDS_SECTIONS:
            section = TDSSection(
                company_id=company.id,
                **section_data
            )
            self.db.add(section)
            sections.append(section)
        
        self.db.commit()
        return sections
    
    def create_tds_section(
        self,
        company: Company,
        section_code: str,
        description: str,
        rate_individual: Decimal,
        rate_company: Decimal,
        threshold_single: Decimal = Decimal("0"),
        threshold_annual: Decimal = Decimal("0"),
        nature_of_payment: Optional[str] = None,
    ) -> TDSSection:
        """Create a custom TDS section."""
        section = TDSSection(
            company_id=company.id,
            section_code=section_code,
            description=description,
            rate_individual=rate_individual,
            rate_company=rate_company,
            threshold_single=threshold_single,
            threshold_annual=threshold_annual,
            nature_of_payment=nature_of_payment,
        )
        self.db.add(section)
        self.db.commit()
        self.db.refresh(section)
        return section
    
    def get_tds_sections(self, company: Company) -> List[TDSSection]:
        """Get all TDS sections for a company."""
        return self.db.query(TDSSection).filter(
            TDSSection.company_id == company.id,
            TDSSection.is_active == True
        ).order_by(TDSSection.section_code).all()
    
    def get_tds_section(self, section_id: str, company: Company) -> Optional[TDSSection]:
        """Get a TDS section by ID."""
        return self.db.query(TDSSection).filter(
            TDSSection.id == section_id,
            TDSSection.company_id == company.id
        ).first()
    
    def get_tds_section_by_code(self, section_code: str, company: Company) -> Optional[TDSSection]:
        """Get a TDS section by code."""
        return self.db.query(TDSSection).filter(
            TDSSection.section_code == section_code,
            TDSSection.company_id == company.id
        ).first()
    
    # ==================== TDS CALCULATION ====================
    
    def calculate_tds(
        self,
        company: Company,
        vendor: Customer,
        section_id: str,
        amount: Decimal,
        check_threshold: bool = True,
    ) -> Dict[str, Any]:
        """Calculate TDS for a payment."""
        section = self.get_tds_section(section_id, company)
        if not section:
            return {
                "tds_applicable": False,
                "reason": "TDS section not found"
            }
        
        # Determine rate based on vendor type
        if vendor.gstin and len(vendor.gstin) == 15:
            rate = section.rate_company
        else:
            rate = section.rate_individual
        
        # Higher rate if no PAN
        if not vendor.pan:
            rate = section.rate_no_pan
        
        # Check threshold
        if check_threshold and section.threshold_single > 0:
            if amount < section.threshold_single:
                return {
                    "tds_applicable": False,
                    "reason": f"Amount below threshold ({section.threshold_single})"
                }
        
        # Check annual threshold
        if check_threshold and section.threshold_annual > 0:
            fy, _ = self._get_financial_year_quarter(datetime.utcnow())
            annual_payments = self._get_annual_payments_to_vendor(company, vendor.id, fy)
            
            if annual_payments + amount < section.threshold_annual:
                return {
                    "tds_applicable": False,
                    "reason": f"Annual payments below threshold ({section.threshold_annual})"
                }
        
        # Calculate TDS
        tds_amount = self._round_amount(amount * rate / 100)
        
        return {
            "tds_applicable": True,
            "section_code": section.section_code,
            "section_description": section.description,
            "gross_amount": float(amount),
            "tds_rate": float(rate),
            "tds_amount": float(tds_amount),
            "net_payable": float(amount - tds_amount),
            "pan_status": "Available" if vendor.pan else "Not Available",
        }
    
    def _get_annual_payments_to_vendor(
        self,
        company: Company,
        vendor_id: str,
        financial_year: str
    ) -> Decimal:
        """Get total payments to a vendor in a financial year."""
        # Parse FY
        fy_parts = financial_year.split("-")
        fy_start = datetime(int(fy_parts[0]), 4, 1)
        fy_end = datetime(int(fy_parts[1]), 3, 31, 23, 59, 59)
        
        result = self.db.query(func.sum(TDSEntry.gross_amount)).filter(
            TDSEntry.company_id == company.id,
            TDSEntry.vendor_id == vendor_id,
            TDSEntry.deduction_date >= fy_start,
            TDSEntry.deduction_date <= fy_end,
        ).scalar()
        
        return result or Decimal("0")
    
    # ==================== TDS ENTRIES ====================
    
    def create_tds_entry(
        self,
        company: Company,
        vendor_id: str,
        section_id: str,
        gross_amount: Decimal,
        deduction_date: datetime,
        purchase_invoice_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> TDSEntry:
        """Create a TDS entry manually."""
        vendor = self.db.query(Customer).filter(Customer.id == vendor_id).first()
        section = self.get_tds_section(section_id, company)
        
        if not vendor or not section:
            raise ValueError("Vendor or TDS section not found")
        
        # Calculate TDS
        calc = self.calculate_tds(company, vendor, section_id, gross_amount)
        if not calc.get("tds_applicable"):
            raise ValueError(calc.get("reason", "TDS not applicable"))
        
        fy, quarter = self._get_financial_year_quarter(deduction_date)
        
        entry = TDSEntry(
            company_id=company.id,
            purchase_invoice_id=purchase_invoice_id,
            vendor_id=vendor_id,
            vendor_name=vendor.name,
            vendor_pan=vendor.pan,
            tds_section_id=section_id,
            section_code=section.section_code,
            gross_amount=gross_amount,
            tds_rate=Decimal(str(calc["tds_rate"])),
            tds_amount=Decimal(str(calc["tds_amount"])),
            deduction_date=deduction_date,
            financial_year=fy,
            quarter=quarter,
            notes=notes,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry
    
    def get_tds_entries(
        self,
        company: Company,
        vendor_id: Optional[str] = None,
        section_code: Optional[str] = None,
        financial_year: Optional[str] = None,
        quarter: Optional[str] = None,
        is_deposited: Optional[bool] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[TDSEntry]:
        """Get TDS entries with filters."""
        query = self.db.query(TDSEntry).filter(TDSEntry.company_id == company.id)
        
        if vendor_id:
            query = query.filter(TDSEntry.vendor_id == vendor_id)
        if section_code:
            query = query.filter(TDSEntry.section_code == section_code)
        if financial_year:
            query = query.filter(TDSEntry.financial_year == financial_year)
        if quarter:
            query = query.filter(TDSEntry.quarter == quarter)
        if is_deposited is not None:
            query = query.filter(TDSEntry.is_deposited == is_deposited)
        if from_date:
            query = query.filter(TDSEntry.deduction_date >= from_date)
        if to_date:
            query = query.filter(TDSEntry.deduction_date <= to_date)
        
        return query.order_by(TDSEntry.deduction_date.desc()).all()
    
    # ==================== TDS DEPOSIT ====================
    
    def record_tds_deposit(
        self,
        company: Company,
        entry_ids: List[str],
        challan_number: str,
        challan_date: datetime,
        bsr_code: str,
        deposit_date: Optional[datetime] = None,
    ) -> List[TDSEntry]:
        """Record TDS deposit (payment to government)."""
        entries = self.db.query(TDSEntry).filter(
            TDSEntry.id.in_(entry_ids),
            TDSEntry.company_id == company.id,
            TDSEntry.is_deposited == False,
        ).all()
        
        if not entries:
            raise ValueError("No valid entries found for deposit")
        
        total_tds = Decimal("0")
        
        for entry in entries:
            entry.challan_number = challan_number
            entry.challan_date = challan_date
            entry.bsr_code = bsr_code
            entry.is_deposited = True
            entry.deposit_date = deposit_date or datetime.utcnow()
            total_tds += entry.tds_amount
        
        # Create accounting entry for TDS payment
        self._create_tds_payment_entry(company, total_tds, challan_number, challan_date)
        
        self.db.commit()
        return entries
    
    def _create_tds_payment_entry(
        self,
        company: Company,
        amount: Decimal,
        challan_number: str,
        challan_date: datetime,
    ) -> Optional[Transaction]:
        """Create accounting entry for TDS deposit."""
        # Get accounts
        tds_payable = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "2200"
        ).first()
        
        bank_account = self.db.query(Account).filter(
            Account.company_id == company.id,
            Account.code == "1010"
        ).first()
        
        if not tds_payable or not bank_account:
            return None
        
        transaction = Transaction(
            company_id=company.id,
            transaction_number=f"TDS-{challan_number}",
            transaction_date=challan_date,
            description=f"TDS Payment - Challan {challan_number}",
            reference_type=ReferenceType.PAYMENT,
            status=TransactionStatus.POSTED,
            total_debit=amount,
            total_credit=amount,
        )
        self.db.add(transaction)
        self.db.flush()
        
        # Debit: TDS Payable (reducing liability)
        entry1 = TransactionEntry(
            transaction_id=transaction.id,
            account_id=tds_payable.id,
            debit_amount=amount,
            credit_amount=Decimal("0"),
            description=f"TDS Deposit - {challan_number}"
        )
        self.db.add(entry1)
        
        # Credit: Bank (reducing asset)
        entry2 = TransactionEntry(
            transaction_id=transaction.id,
            account_id=bank_account.id,
            debit_amount=Decimal("0"),
            credit_amount=amount,
            description=f"TDS Deposit - {challan_number}"
        )
        self.db.add(entry2)
        
        # Balances are calculated from transaction entries, not stored
        return transaction
    
    # ==================== REPORTS ====================
    
    def get_tds_summary(
        self,
        company: Company,
        financial_year: str,
        quarter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get TDS summary for returns filing."""
        query = self.db.query(TDSEntry).filter(
            TDSEntry.company_id == company.id,
            TDSEntry.financial_year == financial_year,
        )
        
        if quarter:
            query = query.filter(TDSEntry.quarter == quarter)
        
        entries = query.all()
        
        # Group by section
        section_wise = {}
        total_deducted = Decimal("0")
        total_deposited = Decimal("0")
        total_pending = Decimal("0")
        
        for entry in entries:
            code = entry.section_code
            if code not in section_wise:
                section_wise[code] = {
                    "section_code": code,
                    "description": entry.tds_section.description if entry.tds_section else "",
                    "total_deducted": Decimal("0"),
                    "total_deposited": Decimal("0"),
                    "count": 0,
                }
            
            section_wise[code]["total_deducted"] += entry.tds_amount
            section_wise[code]["count"] += 1
            
            if entry.is_deposited:
                section_wise[code]["total_deposited"] += entry.tds_amount
                total_deposited += entry.tds_amount
            
            total_deducted += entry.tds_amount
        
        total_pending = total_deducted - total_deposited
        
        return {
            "financial_year": financial_year,
            "quarter": quarter,
            "total_entries": len(entries),
            "total_deducted": float(total_deducted),
            "total_deposited": float(total_deposited),
            "total_pending": float(total_pending),
            "section_wise": [
                {
                    **data,
                    "total_deducted": float(data["total_deducted"]),
                    "total_deposited": float(data["total_deposited"]),
                    "pending": float(data["total_deducted"] - data["total_deposited"]),
                }
                for data in section_wise.values()
            ]
        }
    
    def get_vendor_tds_statement(
        self,
        company: Company,
        vendor_id: str,
        financial_year: str,
    ) -> Dict[str, Any]:
        """Get TDS statement for a vendor (for Form 16A/26AS)."""
        vendor = self.db.query(Customer).filter(Customer.id == vendor_id).first()
        if not vendor:
            raise ValueError("Vendor not found")
        
        entries = self.db.query(TDSEntry).filter(
            TDSEntry.company_id == company.id,
            TDSEntry.vendor_id == vendor_id,
            TDSEntry.financial_year == financial_year,
        ).order_by(TDSEntry.deduction_date).all()
        
        total_gross = Decimal("0")
        total_tds = Decimal("0")
        
        for entry in entries:
            total_gross += entry.gross_amount
            total_tds += entry.tds_amount
        
        return {
            "vendor": {
                "id": vendor.id,
                "name": vendor.name,
                "pan": vendor.pan,
                "gstin": vendor.gstin,
            },
            "financial_year": financial_year,
            "entries": [
                {
                    "date": entry.deduction_date.isoformat(),
                    "section": entry.section_code,
                    "gross_amount": float(entry.gross_amount),
                    "tds_rate": float(entry.tds_rate),
                    "tds_amount": float(entry.tds_amount),
                    "challan_number": entry.challan_number,
                    "challan_date": entry.challan_date.isoformat() if entry.challan_date else None,
                    "is_deposited": entry.is_deposited,
                }
                for entry in entries
            ],
            "total_gross_amount": float(total_gross),
            "total_tds_deducted": float(total_tds),
        }
    
    def get_pending_tds_deposits(self, company: Company) -> List[Dict[str, Any]]:
        """Get all pending TDS deposits."""
        entries = self.db.query(TDSEntry).filter(
            TDSEntry.company_id == company.id,
            TDSEntry.is_deposited == False,
        ).order_by(TDSEntry.deduction_date).all()
        
        # Group by quarter
        quarterly = {}
        for entry in entries:
            key = f"{entry.financial_year}_{entry.quarter}"
            if key not in quarterly:
                quarterly[key] = {
                    "financial_year": entry.financial_year,
                    "quarter": entry.quarter,
                    "entries": [],
                    "total_amount": Decimal("0"),
                }
            quarterly[key]["entries"].append(entry)
            quarterly[key]["total_amount"] += entry.tds_amount
        
        result = []
        for data in quarterly.values():
            due_date = self._get_tds_due_date(data["financial_year"], data["quarter"])
            result.append({
                "financial_year": data["financial_year"],
                "quarter": data["quarter"],
                "due_date": due_date.isoformat() if due_date else None,
                "total_amount": float(data["total_amount"]),
                "entry_count": len(data["entries"]),
                "entry_ids": [e.id for e in data["entries"]],
            })
        
        return result
    
    def _get_tds_due_date(self, financial_year: str, quarter: str) -> Optional[date]:
        """Get TDS deposit due date for a quarter."""
        fy_parts = financial_year.split("-")
        start_year = int(fy_parts[0])
        end_year = int(fy_parts[1])
        
        # Due dates: 7th of next month after quarter end
        # Q1 (Apr-Jun): 7th July
        # Q2 (Jul-Sep): 7th October  
        # Q3 (Oct-Dec): 7th January
        # Q4 (Jan-Mar): 30th April (for March, due date is 30th April)
        
        due_dates = {
            "Q1": date(start_year, 7, 7),
            "Q2": date(start_year, 10, 7),
            "Q3": date(end_year, 1, 7),
            "Q4": date(end_year, 4, 30),
        }
        
        return due_dates.get(quarter)
