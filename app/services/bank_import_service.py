"""Bank import service for CSV parsing and transaction creation."""
import csv
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional, Tuple, Dict, Any, Union
from sqlalchemy.orm import Session
from app.database.models import (
    BankImport, BankImportRow, Company, BankAccount, Transaction,
    BankImportStatus, BankImportRowStatus, Account
)
from app.schemas.accounting import (
    TransactionCreate, TransactionEntryCreate, ReferenceType
)
from app.services.accounting_service import AccountingService


class BankCSVParser:
    """Base class for bank CSV parsers."""
    
    bank_name: str = "Generic"
    
    def can_parse(self, headers: List[str], sample_rows: List[List[str]]) -> bool:
        """Check if this parser can handle the CSV format."""
        raise NotImplementedError
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        """Parse a single row and return standardized data."""
        raise NotImplementedError
    
    def _parse_date(self, date_str: str, formats: List[str]) -> Optional[datetime]:
        """Try to parse date with multiple formats."""
        if not date_str:
            return None
        
        date_str = date_str.strip()
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return None
    
    def _parse_amount(self, amount_str: str) -> Decimal:
        """Parse amount string to Decimal."""
        if not amount_str:
            return Decimal("0")
        
        # Remove currency symbols, commas, spaces
        cleaned = re.sub(r'[₹,\s]', '', amount_str.strip())
        
        # Handle CR/DR suffixes
        cleaned = cleaned.replace('CR', '').replace('Dr', '').replace('Cr', '').replace('DR', '')
        
        if not cleaned or cleaned == '-':
            return Decimal("0")
        
        try:
            return Decimal(cleaned)
        except InvalidOperation:
            return Decimal("0")


class HDFCParser(BankCSVParser):
    """Parser for HDFC Bank CSV statements."""
    
    bank_name = "HDFC"
    
    def can_parse(self, headers: List[str], sample_rows: List[List[str]]) -> bool:
        """HDFC format: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance"""
        header_str = ','.join(h.lower() for h in headers)
        return 'narration' in header_str and ('withdrawal' in header_str or 'deposit' in header_str)
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        # Find the right column names (HDFC uses various formats)
        date_col = next((k for k in row.keys() if 'date' in k.lower() and 'value' not in k.lower()), None)
        value_date_col = next((k for k in row.keys() if 'value' in k.lower() and 'dt' in k.lower()), None)
        desc_col = next((k for k in row.keys() if 'narration' in k.lower()), None)
        ref_col = next((k for k in row.keys() if 'chq' in k.lower() or 'ref' in k.lower()), None)
        withdrawal_col = next((k for k in row.keys() if 'withdrawal' in k.lower()), None)
        deposit_col = next((k for k in row.keys() if 'deposit' in k.lower()), None)
        balance_col = next((k for k in row.keys() if 'balance' in k.lower() or 'closing' in k.lower()), None)
        
        if not desc_col:
            return None
        
        txn_date = self._parse_date(
            row.get(date_col, ''),
            ['%d/%m/%y', '%d/%m/%Y', '%d-%m-%Y', '%d-%m-%y']
        )
        
        value_date = self._parse_date(
            row.get(value_date_col, ''),
            ['%d/%m/%y', '%d/%m/%Y', '%d-%m-%Y', '%d-%m-%y']
        ) if value_date_col else None
        
        return {
            'row_number': row_number,
            'transaction_date': txn_date,
            'value_date': value_date or txn_date,
            'description': row.get(desc_col, '').strip(),
            'reference_number': row.get(ref_col, '').strip() if ref_col else None,
            'debit_amount': self._parse_amount(row.get(withdrawal_col, '')),
            'credit_amount': self._parse_amount(row.get(deposit_col, '')),
            'balance': self._parse_amount(row.get(balance_col, '')) if balance_col else None,
            'raw_data': dict(row),
        }


class ICICIParser(BankCSVParser):
    """Parser for ICICI Bank CSV statements."""
    
    bank_name = "ICICI"
    
    def can_parse(self, headers: List[str], sample_rows: List[List[str]]) -> bool:
        """ICICI format: S No., Value Date, Transaction Date, Cheque Number, Transaction Remarks, Withdrawal Amount, Deposit Amount, Balance"""
        header_str = ','.join(h.lower() for h in headers)
        return 'transaction remarks' in header_str or ('particulars' in header_str and 'icici' in header_str.lower())
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        date_col = next((k for k in row.keys() if 'transaction date' in k.lower()), None)
        if not date_col:
            date_col = next((k for k in row.keys() if 'date' in k.lower() and 'value' not in k.lower()), None)
        
        value_date_col = next((k for k in row.keys() if 'value date' in k.lower()), None)
        desc_col = next((k for k in row.keys() if 'remarks' in k.lower() or 'particulars' in k.lower()), None)
        ref_col = next((k for k in row.keys() if 'cheque' in k.lower()), None)
        withdrawal_col = next((k for k in row.keys() if 'withdrawal' in k.lower() or 'debit' in k.lower()), None)
        deposit_col = next((k for k in row.keys() if 'deposit' in k.lower() or 'credit' in k.lower()), None)
        balance_col = next((k for k in row.keys() if 'balance' in k.lower()), None)
        
        if not desc_col:
            return None
        
        txn_date = self._parse_date(
            row.get(date_col, ''),
            ['%d-%m-%Y', '%d/%m/%Y', '%d-%m-%y', '%d/%m/%y', '%Y-%m-%d']
        )
        
        value_date = self._parse_date(
            row.get(value_date_col, ''),
            ['%d-%m-%Y', '%d/%m/%Y', '%d-%m-%y', '%d/%m/%y', '%Y-%m-%d']
        ) if value_date_col else None
        
        return {
            'row_number': row_number,
            'transaction_date': txn_date,
            'value_date': value_date or txn_date,
            'description': row.get(desc_col, '').strip(),
            'reference_number': row.get(ref_col, '').strip() if ref_col else None,
            'debit_amount': self._parse_amount(row.get(withdrawal_col, '')),
            'credit_amount': self._parse_amount(row.get(deposit_col, '')),
            'balance': self._parse_amount(row.get(balance_col, '')) if balance_col else None,
            'raw_data': dict(row),
        }


class SBIParser(BankCSVParser):
    """Parser for SBI Bank CSV statements."""
    
    bank_name = "SBI"
    
    def can_parse(self, headers: List[str], sample_rows: List[List[str]]) -> bool:
        """SBI format: Txn Date, Value Date, Description, Ref No./Cheque No., Debit, Credit, Balance"""
        header_str = ','.join(h.lower() for h in headers)
        return ('txn date' in header_str or 'transaction date' in header_str) and 'description' in header_str
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        date_col = next((k for k in row.keys() if 'txn date' in k.lower() or 'transaction date' in k.lower()), None)
        value_date_col = next((k for k in row.keys() if 'value date' in k.lower()), None)
        desc_col = next((k for k in row.keys() if 'description' in k.lower()), None)
        ref_col = next((k for k in row.keys() if 'ref' in k.lower() or 'cheque' in k.lower()), None)
        debit_col = next((k for k in row.keys() if 'debit' in k.lower() or 'withdrawal' in k.lower()), None)
        credit_col = next((k for k in row.keys() if 'credit' in k.lower() or 'deposit' in k.lower()), None)
        balance_col = next((k for k in row.keys() if 'balance' in k.lower()), None)
        
        if not desc_col:
            return None
        
        # SBI often uses "DD MMM YYYY" format
        txn_date = self._parse_date(
            row.get(date_col, ''),
            ['%d %b %Y', '%d-%b-%Y', '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d']
        )
        
        value_date = self._parse_date(
            row.get(value_date_col, ''),
            ['%d %b %Y', '%d-%b-%Y', '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d']
        ) if value_date_col else None
        
        return {
            'row_number': row_number,
            'transaction_date': txn_date,
            'value_date': value_date or txn_date,
            'description': row.get(desc_col, '').strip(),
            'reference_number': row.get(ref_col, '').strip() if ref_col else None,
            'debit_amount': self._parse_amount(row.get(debit_col, '')),
            'credit_amount': self._parse_amount(row.get(credit_col, '')),
            'balance': self._parse_amount(row.get(balance_col, '')) if balance_col else None,
            'raw_data': dict(row),
        }


class AxisParser(BankCSVParser):
    """Parser for Axis Bank CSV statements."""
    
    bank_name = "Axis"
    
    def can_parse(self, headers: List[str], sample_rows: List[List[str]]) -> bool:
        """Axis format: Tran Date, CHQNO, PARTICULARS, DR, CR, BAL, SOL"""
        header_str = ','.join(h.lower() for h in headers)
        return ('tran date' in header_str or 'trans date' in header_str) and 'particulars' in header_str
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        date_col = next((k for k in row.keys() if 'tran' in k.lower() and 'date' in k.lower()), None)
        desc_col = next((k for k in row.keys() if 'particulars' in k.lower()), None)
        ref_col = next((k for k in row.keys() if 'chq' in k.lower()), None)
        debit_col = next((k for k in row.keys() if k.lower() in ['dr', 'debit', 'withdrawal']), None)
        credit_col = next((k for k in row.keys() if k.lower() in ['cr', 'credit', 'deposit']), None)
        balance_col = next((k for k in row.keys() if k.lower() in ['bal', 'balance']), None)
        
        if not desc_col:
            return None
        
        txn_date = self._parse_date(
            row.get(date_col, ''),
            ['%d-%m-%Y', '%d/%m/%Y', '%d-%m-%y', '%d/%m/%y']
        )
        
        return {
            'row_number': row_number,
            'transaction_date': txn_date,
            'value_date': txn_date,
            'description': row.get(desc_col, '').strip(),
            'reference_number': row.get(ref_col, '').strip() if ref_col else None,
            'debit_amount': self._parse_amount(row.get(debit_col, '')),
            'credit_amount': self._parse_amount(row.get(credit_col, '')),
            'balance': self._parse_amount(row.get(balance_col, '')) if balance_col else None,
            'raw_data': dict(row),
        }


class GenericParser(BankCSVParser):
    """Generic parser for unknown bank formats."""
    
    bank_name = "Generic"
    
    def can_parse(self, headers: List[str], sample_rows: List[List[str]]) -> bool:
        """Always returns True as fallback."""
        return True
    
    def _safe_lower(self, s: Any) -> str:
        """Safely convert to lowercase string."""
        if s is None:
            return ""
        return str(s).lower()
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        # Filter out None keys
        valid_keys = [k for k in row.keys() if k is not None]
        
        # Try to find common column patterns
        date_col = next((k for k in valid_keys if 'date' in self._safe_lower(k)), None)
        desc_col = next((k for k in valid_keys if any(x in self._safe_lower(k) for x in ['description', 'narration', 'particulars', 'remarks'])), None)
        ref_col = next((k for k in valid_keys if any(x in self._safe_lower(k) for x in ['ref', 'chq', 'cheque', 'reference'])), None)
        
        # Try to find debit/credit columns
        debit_col = next((k for k in valid_keys if any(x in self._safe_lower(k) for x in ['debit', 'withdrawal', 'dr'])), None)
        credit_col = next((k for k in valid_keys if any(x in self._safe_lower(k) for x in ['credit', 'deposit', 'cr'])), None)
        balance_col = next((k for k in valid_keys if 'balance' in self._safe_lower(k)), None)
        
        if not desc_col:
            # Use first non-date column as description
            for k in valid_keys:
                if k and 'date' not in self._safe_lower(k):
                    desc_col = k
                    break
        
        if not desc_col:
            return None
        
        txn_date = self._parse_date(
            row.get(date_col, ''),
            ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d/%m/%y', '%d-%m-%y', '%d %b %Y', '%d-%b-%Y']
        ) if date_col else None
        
        return {
            'row_number': row_number,
            'transaction_date': txn_date,
            'value_date': txn_date,
            'description': row.get(desc_col, '').strip() if desc_col else '',
            'reference_number': row.get(ref_col, '').strip() if ref_col else None,
            'debit_amount': self._parse_amount(row.get(debit_col, '')) if debit_col else Decimal("0"),
            'credit_amount': self._parse_amount(row.get(credit_col, '')) if credit_col else Decimal("0"),
            'balance': self._parse_amount(row.get(balance_col, '')) if balance_col else None,
            'raw_data': {k: v for k, v in row.items() if k is not None},
        }


class CustomMappingParser(BankCSVParser):
    """Parser using custom column mapping."""
    
    bank_name = "Custom"
    
    def __init__(self, mapping: Dict[str, str]):
        """
        mapping: {
            'date': 'column_name_for_date',
            'description': 'column_name_for_description',
            'debit': 'column_name_for_debit',
            'credit': 'column_name_for_credit',
            'reference': 'column_name_for_reference' (optional),
            'balance': 'column_name_for_balance' (optional)
        }
        """
        self.mapping = mapping
    
    def can_parse(self, headers: List[str], sample_rows: List[List[str]]) -> bool:
        return True
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        date_col = self.mapping.get('date')
        desc_col = self.mapping.get('description')
        debit_col = self.mapping.get('debit')
        credit_col = self.mapping.get('credit')
        ref_col = self.mapping.get('reference')
        balance_col = self.mapping.get('balance')
        
        if not desc_col:
            return None
        
        txn_date = self._parse_date(
            row.get(date_col, '') if date_col else '',
            ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d/%m/%y', '%d-%m-%y', '%d %b %Y', '%d-%b-%Y', '%m/%d/%Y']
        )
        
        return {
            'row_number': row_number,
            'transaction_date': txn_date,
            'value_date': txn_date,
            'description': row.get(desc_col, '').strip() if desc_col else '',
            'reference_number': row.get(ref_col, '').strip() if ref_col else None,
            'debit_amount': self._parse_amount(row.get(debit_col, '')) if debit_col else Decimal("0"),
            'credit_amount': self._parse_amount(row.get(credit_col, '')) if credit_col else Decimal("0"),
            'balance': self._parse_amount(row.get(balance_col, '')) if balance_col else None,
            'raw_data': {k: v for k, v in row.items() if k is not None},
        }


class BankImportService:
    """Service for importing bank statements."""
    
    def __init__(self, db: Session):
        self.db = db
        self.parsers = [
            HDFCParser(),
            ICICIParser(),
            SBIParser(),
            AxisParser(),
            GenericParser(),  # Fallback
        ]
    
    def preview_csv(self, content: str) -> Dict[str, Any]:
        """Preview CSV content and return headers and sample rows for mapping."""
        try:
            # Handle BOM
            if content.startswith('\ufeff'):
                content = content[1:]
            
            reader = csv.DictReader(io.StringIO(content))
            headers = [h for h in (reader.fieldnames or []) if h is not None]
            
            # Get sample rows
            sample_rows = []
            for i, row in enumerate(reader):
                if i >= 5:
                    break
                sample_rows.append({k: v for k, v in row.items() if k is not None})
            
            # Try auto-detect
            detected_bank = None
            for parser in self.parsers[:-1]:  # Exclude generic
                if parser.can_parse(headers, [list(r.values()) for r in sample_rows]):
                    detected_bank = parser.bank_name
                    break
            
            return {
                'headers': headers,
                'sample_rows': sample_rows,
                'detected_bank': detected_bank,
                'row_count': sum(1 for _ in csv.DictReader(io.StringIO(content))),
            }
        except Exception as e:
            raise ValueError(f"Failed to parse CSV: {str(e)}")
    
    def detect_bank_format(self, content: str) -> Tuple[BankCSVParser, List[str], List[Dict[str, str]]]:
        """Detect bank format from CSV content."""
        # Try to parse CSV
        try:
            # Handle BOM
            if content.startswith('\ufeff'):
                content = content[1:]
            
            reader = csv.DictReader(io.StringIO(content))
            headers = [h for h in (reader.fieldnames or []) if h is not None]
            
            # Get sample rows
            sample_rows = []
            rows_list = []
            for i, row in enumerate(reader):
                # Filter out None keys
                clean_row = {k: v for k, v in row.items() if k is not None}
                rows_list.append(clean_row)
                if i < 5:
                    sample_rows.append(list(clean_row.values()))
            
            # Find matching parser
            for parser in self.parsers:
                if parser.can_parse(headers, sample_rows):
                    return parser, headers, rows_list
            
            # Fallback to generic
            return self.parsers[-1], headers, rows_list
            
        except Exception as e:
            raise ValueError(f"Failed to parse CSV: {str(e)}")
    
    def create_import(
        self,
        company: Company,
        file_name: str,
        content: str,
        bank_account_id: Optional[str] = None,
        bank_name: Optional[str] = None,
        column_mapping: Optional[Dict[str, str]] = None
    ) -> BankImport:
        """Create a bank import from CSV content.
        
        Args:
            column_mapping: Optional custom mapping like {
                'date': 'Date Column',
                'description': 'Narration',
                'debit': 'Withdrawal',
                'credit': 'Deposit',
                'reference': 'Ref No',
                'balance': 'Balance'
            }
        """
        # Handle BOM
        if content.startswith('\ufeff'):
            content = content[1:]
        
        # Use custom mapping or auto-detect
        if column_mapping:
            parser = CustomMappingParser(column_mapping)
            reader = csv.DictReader(io.StringIO(content))
            headers = [h for h in (reader.fieldnames or []) if h is not None]
            rows = [{k: v for k, v in row.items() if k is not None} for row in reader]
            detected_bank = bank_name or "Custom"
        else:
            parser, headers, rows = self.detect_bank_format(content)
            detected_bank = bank_name or parser.bank_name
        
        # Create import record
        bank_import = BankImport(
            company_id=company.id,
            bank_account_id=bank_account_id,
            file_name=file_name,
            bank_name=detected_bank,
            status=BankImportStatus.PROCESSING,
            total_rows=len(rows),
        )
        
        self.db.add(bank_import)
        self.db.flush()
        
        # Parse and create rows
        processed = 0
        for i, row in enumerate(rows, 1):
            try:
                parsed = parser.parse_row(row, i)
                
                if parsed and (parsed['debit_amount'] > 0 or parsed['credit_amount'] > 0):
                    import_row = BankImportRow(
                        import_id=bank_import.id,
                        row_number=parsed['row_number'],
                        transaction_date=parsed['transaction_date'],
                        value_date=parsed['value_date'],
                        description=parsed['description'],
                        reference_number=parsed['reference_number'],
                        debit_amount=parsed['debit_amount'],
                        credit_amount=parsed['credit_amount'],
                        balance=parsed['balance'],
                        status=BankImportRowStatus.PENDING,
                        raw_data=parsed['raw_data'],
                    )
                    self.db.add(import_row)
                    processed += 1
            except Exception as e:
                # Skip rows that fail to parse
                continue
        
        bank_import.processed_rows = processed
        bank_import.status = BankImportStatus.COMPLETED
        bank_import.completed_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(bank_import)
        return bank_import
    
    def get_import(self, import_id: str, company: Company) -> Optional[BankImport]:
        """Get a bank import by ID."""
        return self.db.query(BankImport).filter(
            BankImport.id == import_id,
            BankImport.company_id == company.id
        ).first()
    
    def get_imports(self, company: Company, page: int = 1, page_size: int = 20) -> Tuple[List[BankImport], int]:
        """Get all imports for a company."""
        query = self.db.query(BankImport).filter(BankImport.company_id == company.id)
        
        total = query.count()
        offset = (page - 1) * page_size
        imports = query.order_by(BankImport.import_date.desc()).offset(offset).limit(page_size).all()
        
        return imports, total
    
    def get_import_rows(
        self,
        bank_import: BankImport,
        status: Optional[BankImportRowStatus] = None
    ) -> List[BankImportRow]:
        """Get rows for an import."""
        query = self.db.query(BankImportRow).filter(BankImportRow.import_id == bank_import.id)
        
        if status:
            query = query.filter(BankImportRow.status == status)
        
        return query.order_by(BankImportRow.row_number).all()
    
    def match_transactions(self, bank_import: BankImport) -> int:
        """Try to match import rows with existing transactions."""
        matched = 0
        rows = self.get_import_rows(bank_import, BankImportRowStatus.PENDING)
        
        for row in rows:
            # Try to find matching transaction by date and amount
            # This is a simple matching - could be enhanced
            if row.transaction_date:
                existing = self.db.query(Transaction).filter(
                    Transaction.company_id == bank_import.company_id,
                    Transaction.transaction_date == row.transaction_date,
                    Transaction.total_debit == (row.credit_amount or row.debit_amount)
                ).first()
                
                if existing:
                    row.transaction_id = existing.id
                    row.status = BankImportRowStatus.MATCHED
                    matched += 1
        
        bank_import.matched_rows = matched
        self.db.commit()
        return matched
    
    def process_rows(
        self,
        bank_import: BankImport,
        mappings: List[Dict],
        company: Company,
        bank_account_id: Optional[str] = None
    ) -> Tuple[int, int, int]:
        """Process import rows with account mappings."""
        accounting_service = AccountingService(self.db)
        
        created = 0
        matched = 0
        ignored = 0
        
        # Get or create bank account for transactions
        if bank_account_id:
            bank_acc = accounting_service.get_account(bank_account_id, company)
        else:
            # Use default bank account
            bank_acc = accounting_service.get_account_by_code("1010", company)
        
        if not bank_acc:
            accounting_service.initialize_chart_of_accounts(company)
            bank_acc = accounting_service.get_account_by_code("1010", company)
        
        for mapping in mappings:
            row = self.db.query(BankImportRow).filter(
                BankImportRow.id == mapping['row_id'],
                BankImportRow.import_id == bank_import.id
            ).first()
            
            if not row:
                continue
            
            action = mapping.get('action', 'ignore')
            
            if action == 'ignore':
                row.status = BankImportRowStatus.IGNORED
                ignored += 1
                
            elif action == 'match':
                row.transaction_id = mapping.get('transaction_id')
                row.status = BankImportRowStatus.MATCHED
                matched += 1
                
            elif action == 'create':
                account_id = mapping.get('account_id')
                if not account_id:
                    continue
                
                # Create journal entry
                entries = []
                
                if row.credit_amount > 0:
                    # Money in: Debit Bank, Credit selected account
                    entries = [
                        TransactionEntryCreate(
                            account_id=bank_acc.id,
                            description=row.description,
                            debit_amount=row.credit_amount,
                            credit_amount=Decimal("0"),
                        ),
                        TransactionEntryCreate(
                            account_id=account_id,
                            description=row.description,
                            debit_amount=Decimal("0"),
                            credit_amount=row.credit_amount,
                        ),
                    ]
                elif row.debit_amount > 0:
                    # Money out: Credit Bank, Debit selected account
                    entries = [
                        TransactionEntryCreate(
                            account_id=account_id,
                            description=row.description,
                            debit_amount=row.debit_amount,
                            credit_amount=Decimal("0"),
                        ),
                        TransactionEntryCreate(
                            account_id=bank_acc.id,
                            description=row.description,
                            debit_amount=Decimal("0"),
                            credit_amount=row.debit_amount,
                        ),
                    ]
                
                if entries:
                    transaction_data = TransactionCreate(
                        transaction_date=row.transaction_date or datetime.utcnow(),
                        description=row.description,
                        reference_type=ReferenceType.BANK_IMPORT,
                        reference_id=row.id,
                        entries=entries,
                    )
                    
                    transaction = accounting_service.create_journal_entry(
                        company,
                        transaction_data,
                        auto_post=True
                    )
                    
                    row.transaction_id = transaction.id
                    row.mapped_account_id = account_id
                    row.status = BankImportRowStatus.CREATED
                    created += 1
        
        bank_import.created_rows = created
        bank_import.matched_rows = matched
        bank_import.ignored_rows = ignored
        
        self.db.commit()
        return created, matched, ignored
    
    def delete_import(self, bank_import: BankImport) -> bool:
        """Delete a bank import and its rows."""
        self.db.delete(bank_import)
        self.db.commit()
        return True
