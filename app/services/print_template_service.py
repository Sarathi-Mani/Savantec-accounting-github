"""
Print Template Service - Customizable print templates for documents.

Features:
- Multiple templates per document type
- Jinja2-based templating
- Custom styling and layout
- PDF generation support
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from sqlalchemy.orm import Session

from app.database.models import generate_uuid


class DocumentType(str, Enum):
    """Types of documents that can have templates."""
    INVOICE = "invoice"
    PURCHASE_INVOICE = "purchase_invoice"
    QUOTATION = "quotation"
    PURCHASE_ORDER = "purchase_order"
    SALES_ORDER = "sales_order"
    DELIVERY_NOTE = "delivery_note"
    RECEIPT_NOTE = "receipt_note"
    PAYMENT_RECEIPT = "payment_receipt"
    PAYSLIP = "payslip"
    DEBIT_NOTE = "debit_note"
    CREDIT_NOTE = "credit_note"


class PageSize(str, Enum):
    """Standard page sizes."""
    A4 = "A4"
    A5 = "A5"
    LETTER = "Letter"
    LEGAL = "Legal"
    CUSTOM = "Custom"


class Orientation(str, Enum):
    """Page orientation."""
    PORTRAIT = "portrait"
    LANDSCAPE = "landscape"


@dataclass
class PageMargins:
    """Page margins in mm."""
    top: int = 15
    right: int = 15
    bottom: int = 15
    left: int = 15


@dataclass
class PrintTemplate:
    """Print template configuration."""
    id: str
    company_id: str
    document_type: DocumentType
    name: str
    is_default: bool = False
    
    # Page settings
    page_size: PageSize = PageSize.A4
    orientation: Orientation = Orientation.PORTRAIT
    margins: PageMargins = field(default_factory=PageMargins)
    
    # Template content
    header_html: str = ""
    body_html: str = ""
    footer_html: str = ""
    styles_css: str = ""
    
    # Options
    show_logo: bool = True
    show_qr_code: bool = True
    show_signature: bool = True
    show_terms: bool = True
    
    # Colors
    primary_color: str = "#2563eb"
    secondary_color: str = "#64748b"
    
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


# Default template HTML snippets
DEFAULT_INVOICE_HEADER = """
<div class="header">
    {% if company.logo_url and show_logo %}
    <img src="{{ company.logo_url }}" class="logo" alt="{{ company.name }}">
    {% endif %}
    <div class="company-info">
        <h1>{{ company.name }}</h1>
        {% if company.gstin %}<p>GSTIN: {{ company.gstin }}</p>{% endif %}
        <p>{{ company.address_line1 }}</p>
        {% if company.address_line2 %}<p>{{ company.address_line2 }}</p>{% endif %}
        <p>{{ company.city }}, {{ company.state }} - {{ company.pincode }}</p>
        {% if company.phone %}<p>Phone: {{ company.phone }}</p>{% endif %}
    </div>
</div>
"""

DEFAULT_INVOICE_BODY = """
<div class="invoice-header">
    <h2>TAX INVOICE</h2>
    <div class="invoice-details">
        <p><strong>Invoice No:</strong> {{ invoice.invoice_number }}</p>
        <p><strong>Date:</strong> {{ invoice.invoice_date | date }}</p>
        <p><strong>Due Date:</strong> {{ invoice.due_date | date }}</p>
    </div>
</div>

<div class="customer-section">
    <h3>Bill To:</h3>
    <p><strong>{{ customer.name }}</strong></p>
    {% if customer.gstin %}<p>GSTIN: {{ customer.gstin }}</p>{% endif %}
    <p>{{ customer.billing_address_line1 }}</p>
    <p>{{ customer.billing_city }}, {{ customer.billing_state }} - {{ customer.billing_pincode }}</p>
</div>

<table class="items-table">
    <thead>
        <tr>
            <th>#</th>
            <th>Description</th>
            <th>HSN/SAC</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>GST</th>
            <th>Amount</th>
        </tr>
    </thead>
    <tbody>
        {% for item in items %}
        <tr>
            <td>{{ loop.index }}</td>
            <td>{{ item.description }}</td>
            <td>{{ item.hsn_code }}</td>
            <td>{{ item.quantity }}</td>
            <td>{{ item.unit_price | currency }}</td>
            <td>{{ item.gst_rate }}%</td>
            <td>{{ item.total | currency }}</td>
        </tr>
        {% endfor %}
    </tbody>
</table>

<div class="totals-section">
    <table class="totals-table">
        <tr>
            <td>Subtotal</td>
            <td>{{ invoice.subtotal | currency }}</td>
        </tr>
        {% if invoice.cgst_amount %}
        <tr>
            <td>CGST</td>
            <td>{{ invoice.cgst_amount | currency }}</td>
        </tr>
        {% endif %}
        {% if invoice.sgst_amount %}
        <tr>
            <td>SGST</td>
            <td>{{ invoice.sgst_amount | currency }}</td>
        </tr>
        {% endif %}
        {% if invoice.igst_amount %}
        <tr>
            <td>IGST</td>
            <td>{{ invoice.igst_amount | currency }}</td>
        </tr>
        {% endif %}
        <tr class="total-row">
            <td><strong>Total</strong></td>
            <td><strong>{{ invoice.total_amount | currency }}</strong></td>
        </tr>
    </table>
    <p class="amount-in-words">{{ invoice.total_amount | amount_in_words }}</p>
</div>

{% if show_qr_code and invoice.payment_qr_code %}
<div class="qr-section">
    <p>Scan to Pay</p>
    <img src="{{ invoice.payment_qr_code }}" class="qr-code" alt="Payment QR">
</div>
{% endif %}
"""

DEFAULT_INVOICE_FOOTER = """
<div class="footer">
    {% if show_terms %}
    <div class="terms">
        <h4>Terms & Conditions</h4>
        <ol>
            <li>Payment is due within {{ invoice.payment_terms or 30 }} days.</li>
            <li>Goods once sold cannot be returned.</li>
            <li>Interest @ 18% p.a. will be charged on delayed payments.</li>
        </ol>
    </div>
    {% endif %}
    
    {% if show_signature %}
    <div class="signature-section">
        <p>For {{ company.name }}</p>
        <div class="signature-line"></div>
        <p>Authorized Signatory</p>
    </div>
    {% endif %}
</div>
"""

DEFAULT_STYLES = """
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid {{ primary_color }};
}

.logo {
    max-width: 150px;
    max-height: 80px;
}

.company-info {
    text-align: right;
}

.company-info h1 {
    font-size: 20px;
    color: {{ primary_color }};
}

.invoice-header {
    text-align: center;
    margin-bottom: 20px;
}

.invoice-header h2 {
    font-size: 18px;
    color: {{ primary_color }};
    margin-bottom: 10px;
}

.items-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
}

.items-table th,
.items-table td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}

.items-table th {
    background-color: {{ primary_color }};
    color: white;
    font-weight: bold;
}

.items-table tr:nth-child(even) {
    background-color: #f9f9f9;
}

.totals-section {
    margin-top: 20px;
}

.totals-table {
    width: 300px;
    margin-left: auto;
}

.totals-table td {
    padding: 5px 10px;
}

.total-row {
    font-size: 14px;
    border-top: 2px solid {{ primary_color }};
}

.amount-in-words {
    font-style: italic;
    margin-top: 10px;
    text-align: right;
}

.footer {
    margin-top: 30px;
    padding-top: 15px;
    border-top: 1px solid #ddd;
}

.signature-section {
    text-align: right;
    margin-top: 50px;
}

.signature-line {
    width: 200px;
    height: 1px;
    background-color: #333;
    margin: 40px 0 5px auto;
}
"""


class PrintTemplateService:
    """Service for managing print templates."""
    
    # In-memory template storage (would be DB in production)
    _templates: Dict[str, Dict[str, List[PrintTemplate]]] = {}
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_template(
        self,
        company_id: str,
        document_type: DocumentType,
        name: str,
        is_default: bool = False,
        header_html: Optional[str] = None,
        body_html: Optional[str] = None,
        footer_html: Optional[str] = None,
        styles_css: Optional[str] = None,
        **kwargs,
    ) -> PrintTemplate:
        """Create a new print template."""
        template_id = generate_uuid()
        
        # Use defaults if not provided
        if document_type == DocumentType.INVOICE:
            header_html = header_html or DEFAULT_INVOICE_HEADER
            body_html = body_html or DEFAULT_INVOICE_BODY
            footer_html = footer_html or DEFAULT_INVOICE_FOOTER
            styles_css = styles_css or DEFAULT_STYLES
        
        template = PrintTemplate(
            id=template_id,
            company_id=company_id,
            document_type=document_type,
            name=name,
            is_default=is_default,
            header_html=header_html or "",
            body_html=body_html or "",
            footer_html=footer_html or "",
            styles_css=styles_css or DEFAULT_STYLES,
            **kwargs,
        )
        
        # Store in cache
        if company_id not in self._templates:
            self._templates[company_id] = {}
        
        doc_type_key = document_type.value
        if doc_type_key not in self._templates[company_id]:
            self._templates[company_id][doc_type_key] = []
        
        # If this is default, unset others
        if is_default:
            for t in self._templates[company_id][doc_type_key]:
                t.is_default = False
        
        self._templates[company_id][doc_type_key].append(template)
        
        return template
    
    def get_template(self, template_id: str) -> Optional[PrintTemplate]:
        """Get template by ID."""
        for company_templates in self._templates.values():
            for doc_templates in company_templates.values():
                for template in doc_templates:
                    if template.id == template_id:
                        return template
        return None
    
    def get_default_template(
        self,
        company_id: str,
        document_type: DocumentType,
    ) -> Optional[PrintTemplate]:
        """Get default template for a document type."""
        if company_id not in self._templates:
            return None
        
        doc_type_key = document_type.value
        if doc_type_key not in self._templates[company_id]:
            return None
        
        templates = self._templates[company_id][doc_type_key]
        
        # Find default
        for template in templates:
            if template.is_default:
                return template
        
        # Return first if no default set
        return templates[0] if templates else None
    
    def list_templates(
        self,
        company_id: str,
        document_type: Optional[DocumentType] = None,
    ) -> List[PrintTemplate]:
        """List templates for a company."""
        if company_id not in self._templates:
            return []
        
        if document_type:
            return self._templates[company_id].get(document_type.value, [])
        
        # All templates
        all_templates = []
        for templates in self._templates[company_id].values():
            all_templates.extend(templates)
        return all_templates
    
    def update_template(
        self,
        template_id: str,
        **kwargs,
    ) -> Optional[PrintTemplate]:
        """Update template settings."""
        template = self.get_template(template_id)
        if not template:
            return None
        
        for key, value in kwargs.items():
            if hasattr(template, key):
                setattr(template, key, value)
        
        template.updated_at = datetime.utcnow()
        return template
    
    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        for company_templates in self._templates.values():
            for doc_templates in company_templates.values():
                for i, template in enumerate(doc_templates):
                    if template.id == template_id:
                        doc_templates.pop(i)
                        return True
        return False
    
    def render_template(
        self,
        template: PrintTemplate,
        context: Dict[str, Any],
    ) -> str:
        """
        Render a template with given context.
        
        Returns full HTML document.
        """
        from jinja2 import Template, Environment
        
        # Custom filters
        def currency_filter(value):
            if value is None:
                return "₹0.00"
            return f"₹{float(value):,.2f}"
        
        def date_filter(value, format="%d/%m/%Y"):
            if value is None:
                return ""
            if isinstance(value, str):
                return value
            return value.strftime(format)
        
        def amount_in_words_filter(value):
            # Simplified - would use a proper library
            if value is None:
                return ""
            return f"Rupees {int(float(value))} Only"
        
        # Create Jinja environment with filters
        env = Environment()
        env.filters['currency'] = currency_filter
        env.filters['date'] = date_filter
        env.filters['amount_in_words'] = amount_in_words_filter
        
        # Add template settings to context
        context['show_logo'] = template.show_logo
        context['show_qr_code'] = template.show_qr_code
        context['show_signature'] = template.show_signature
        context['show_terms'] = template.show_terms
        context['primary_color'] = template.primary_color
        context['secondary_color'] = template.secondary_color
        
        # Render each section
        header_template = env.from_string(template.header_html)
        body_template = env.from_string(template.body_html)
        footer_template = env.from_string(template.footer_html)
        styles_template = env.from_string(template.styles_css)
        
        header_html = header_template.render(**context)
        body_html = body_template.render(**context)
        footer_html = footer_template.render(**context)
        styles_css = styles_template.render(**context)
        
        # Build full HTML document
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Document</title>
    <style>
        @page {{
            size: {template.page_size.value} {template.orientation.value};
            margin: {template.margins.top}mm {template.margins.right}mm {template.margins.bottom}mm {template.margins.left}mm;
        }}
        {styles_css}
    </style>
</head>
<body>
    {header_html}
    {body_html}
    {footer_html}
</body>
</html>
"""
        return html
    
    def initialize_default_templates(self, company_id: str) -> List[PrintTemplate]:
        """Initialize default templates for a company."""
        created = []
        
        for doc_type in [DocumentType.INVOICE, DocumentType.PURCHASE_INVOICE, DocumentType.PAYSLIP]:
            template = self.create_template(
                company_id=company_id,
                document_type=doc_type,
                name="Default",
                is_default=True,
            )
            created.append(template)
        
        return created
