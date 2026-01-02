"""PDF generation service using ReportLab."""
from io import BytesIO
from decimal import Decimal
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfgen import canvas
import qrcode
import base64

from app.database.models import Invoice, Company, Customer, INDIAN_STATE_CODES


class PDFService:
    """Service for generating PDF invoices."""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='InvoiceTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=10,
            textColor=colors.HexColor('#1a365d')
        ))
        
        self.styles.add(ParagraphStyle(
            name='CompanyName',
            parent=self.styles['Heading2'],
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=5,
            textColor=colors.HexColor('#2d3748')
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading3'],
            fontSize=10,
            spaceBefore=10,
            spaceAfter=5,
            textColor=colors.HexColor('#4a5568')
        ))
        
        self.styles.add(ParagraphStyle(
            name='SmallText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#718096')
        ))
        
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=9,
            alignment=TA_CENTER,
            textColor=colors.white
        ))
        
        self.styles.add(ParagraphStyle(
            name='AmountRight',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_RIGHT
        ))
    
    def _number_to_words(self, num: Decimal) -> str:
        """Convert number to words (Indian format)."""
        ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                'Seventeen', 'Eighteen', 'Nineteen']
        tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
        
        def two_digit(n):
            if n < 20:
                return ones[n]
            return tens[n // 10] + ('' if n % 10 == 0 else ' ' + ones[n % 10])
        
        def three_digit(n):
            if n < 100:
                return two_digit(n)
            return ones[n // 100] + ' Hundred' + ('' if n % 100 == 0 else ' and ' + two_digit(n % 100))
        
        num = int(num)
        if num == 0:
            return 'Zero'
        
        crore = num // 10000000
        num %= 10000000
        lakh = num // 100000
        num %= 100000
        thousand = num // 1000
        num %= 1000
        hundred = num
        
        result = []
        if crore:
            result.append(three_digit(crore) + ' Crore')
        if lakh:
            result.append(two_digit(lakh) + ' Lakh')
        if thousand:
            result.append(two_digit(thousand) + ' Thousand')
        if hundred:
            result.append(three_digit(hundred))
        
        return ' '.join(result) + ' Rupees Only'
    
    def _generate_qr_image(self, data: str) -> BytesIO:
        """Generate QR code image."""
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer
    
    def generate_invoice_pdf(
        self,
        invoice: Invoice,
        company: Company,
        customer: Customer = None
    ) -> BytesIO:
        """Generate a GST-compliant invoice PDF."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=15*mm,
            bottomMargin=20*mm
        )
        
        elements = []
        
        # Header - Tax Invoice
        elements.append(Paragraph("TAX INVOICE", self.styles['InvoiceTitle']))
        elements.append(Spacer(1, 5))
        
        # Company Details
        elements.append(Paragraph(company.name, self.styles['CompanyName']))
        if company.trade_name and company.trade_name != company.name:
            elements.append(Paragraph(f"({company.trade_name})", self.styles['SmallText']))
        
        # Company Address
        address_parts = []
        if company.address_line1:
            address_parts.append(company.address_line1)
        if company.address_line2:
            address_parts.append(company.address_line2)
        if company.city:
            city_state = company.city
            if company.state:
                city_state += f", {company.state}"
            if company.pincode:
                city_state += f" - {company.pincode}"
            address_parts.append(city_state)
        
        if address_parts:
            elements.append(Paragraph(
                '<br/>'.join(address_parts),
                ParagraphStyle('Address', parent=self.styles['Normal'], fontSize=9, alignment=TA_CENTER)
            ))
        
        # Company Contact & GSTIN
        contact_parts = []
        if company.phone:
            contact_parts.append(f"Phone: {company.phone}")
        if company.email:
            contact_parts.append(f"Email: {company.email}")
        if contact_parts:
            elements.append(Paragraph(
                ' | '.join(contact_parts),
                ParagraphStyle('Contact', parent=self.styles['SmallText'], alignment=TA_CENTER)
            ))
        
        if company.gstin:
            elements.append(Paragraph(
                f"<b>GSTIN:</b> {company.gstin}",
                ParagraphStyle('GSTIN', parent=self.styles['Normal'], fontSize=10, alignment=TA_CENTER)
            ))
        
        elements.append(Spacer(1, 10))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0')))
        elements.append(Spacer(1, 10))
        
        # Invoice Details & Customer Details in two columns
        invoice_date = invoice.invoice_date.strftime('%d-%b-%Y') if invoice.invoice_date else ''
        due_date = invoice.due_date.strftime('%d-%b-%Y') if invoice.due_date else 'On Receipt'
        
        invoice_details = [
            ['Invoice No:', invoice.invoice_number],
            ['Invoice Date:', invoice_date],
            ['Due Date:', due_date],
            ['Place of Supply:', f"{invoice.place_of_supply} - {invoice.place_of_supply_name}"],
        ]
        
        customer_name = customer.name if customer else "Walk-in Customer"
        customer_gstin = customer.gstin if customer else ""
        customer_address = ""
        if customer:
            addr_parts = []
            if customer.billing_address_line1:
                addr_parts.append(customer.billing_address_line1)
            if customer.billing_city:
                addr_parts.append(customer.billing_city)
            if customer.billing_state:
                addr_parts.append(customer.billing_state)
            customer_address = ", ".join(addr_parts)
        
        customer_details = [
            ['Bill To:', customer_name],
            ['Address:', customer_address or '-'],
            ['GSTIN:', customer_gstin or 'Unregistered'],
            ['State:', customer.billing_state if customer else '-'],
        ]
        
        # Create two-column layout
        col_width = 85*mm
        left_table = Table(invoice_details, colWidths=[30*mm, 55*mm])
        left_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        right_table = Table(customer_details, colWidths=[25*mm, 60*mm])
        right_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        details_table = Table([[left_table, right_table]], colWidths=[col_width, col_width])
        elements.append(details_table)
        elements.append(Spacer(1, 15))
        
        # Items Table
        is_inter_state = company.state_code != invoice.place_of_supply
        
        if is_inter_state:
            headers = ['#', 'Description', 'HSN', 'Qty', 'Rate', 'Taxable', 'IGST%', 'IGST', 'Total']
            col_widths = [8*mm, 45*mm, 15*mm, 12*mm, 20*mm, 22*mm, 12*mm, 18*mm, 22*mm]
        else:
            headers = ['#', 'Description', 'HSN', 'Qty', 'Rate', 'Taxable', 'CGST%', 'SGST%', 'Tax', 'Total']
            col_widths = [8*mm, 40*mm, 13*mm, 10*mm, 18*mm, 20*mm, 11*mm, 11*mm, 16*mm, 20*mm]
        
        data = [headers]
        
        for idx, item in enumerate(invoice.items, 1):
            if is_inter_state:
                row = [
                    str(idx),
                    item.description[:40],
                    item.hsn_code or '-',
                    f"{item.quantity:.2f}",
                    f"₹{item.unit_price:,.2f}",
                    f"₹{item.taxable_amount:,.2f}",
                    f"{item.igst_rate:.0f}%",
                    f"₹{item.igst_amount:,.2f}",
                    f"₹{item.total_amount:,.2f}"
                ]
            else:
                row = [
                    str(idx),
                    item.description[:35],
                    item.hsn_code or '-',
                    f"{item.quantity:.2f}",
                    f"₹{item.unit_price:,.2f}",
                    f"₹{item.taxable_amount:,.2f}",
                    f"{item.cgst_rate:.0f}%",
                    f"{item.sgst_rate:.0f}%",
                    f"₹{item.cgst_amount + item.sgst_amount:,.2f}",
                    f"₹{item.total_amount:,.2f}"
                ]
            data.append(row)
        
        items_table = Table(data, colWidths=col_widths, repeatRows=1)
        items_table.setStyle(TableStyle([
            # Header style
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            
            # Data style
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # #
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),    # Description
            ('ALIGN', (2, 1), (-1, -1), 'CENTER'), # Rest centered/right
            ('ALIGN', (-1, 1), (-1, -1), 'RIGHT'), # Total
            ('ALIGN', (-2, 1), (-2, -1), 'RIGHT'), # Tax
            ('ALIGN', (-3, 1) if is_inter_state else (-4, 1), (-3, -1) if is_inter_state else (-4, -1), 'RIGHT'), # Taxable
            
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
            
            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(items_table)
        elements.append(Spacer(1, 15))
        
        # Totals Section
        totals_data = [
            ['Subtotal:', f"₹{invoice.subtotal:,.2f}"],
        ]
        
        if invoice.discount_amount > 0:
            totals_data.append(['Discount:', f"- ₹{invoice.discount_amount:,.2f}"])
        
        if is_inter_state:
            totals_data.append([f'IGST:', f"₹{invoice.igst_amount:,.2f}"])
        else:
            totals_data.append([f'CGST:', f"₹{invoice.cgst_amount:,.2f}"])
            totals_data.append([f'SGST:', f"₹{invoice.sgst_amount:,.2f}"])
        
        if invoice.cess_amount > 0:
            totals_data.append(['Cess:', f"₹{invoice.cess_amount:,.2f}"])
        
        totals_data.append(['Total Tax:', f"₹{invoice.total_tax:,.2f}"])
        totals_data.append(['Grand Total:', f"₹{invoice.total_amount:,.2f}"])
        
        totals_table = Table(totals_data, colWidths=[130*mm, 40*mm])
        totals_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#2d3748')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(totals_table)
        elements.append(Spacer(1, 10))
        
        # Amount in words
        amount_words = self._number_to_words(invoice.total_amount)
        elements.append(Paragraph(
            f"<b>Amount in Words:</b> {amount_words}",
            ParagraphStyle('AmountWords', parent=self.styles['Normal'], fontSize=9)
        ))
        
        elements.append(Spacer(1, 15))
        
        # Bank Details and QR Code section
        bank_details = []
        if company.bank_accounts:
            default_bank = next(
                (b for b in company.bank_accounts if b.is_default),
                company.bank_accounts[0]
            )
            bank_details = [
                ['Bank Details', ''],
                ['Bank Name:', default_bank.bank_name],
                ['Account Name:', default_bank.account_name],
                ['Account No:', default_bank.account_number],
                ['IFSC Code:', default_bank.ifsc_code],
            ]
            if default_bank.upi_id:
                bank_details.append(['UPI ID:', default_bank.upi_id])
        
        if bank_details:
            bank_table = Table(bank_details, colWidths=[25*mm, 55*mm])
            bank_table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('SPAN', (0, 0), (-1, 0)),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf2f7')),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            
            # Add QR code if available
            qr_element = []
            if invoice.upi_qr_data:
                qr_buffer = self._generate_qr_image(invoice.upi_qr_data)
                qr_image = Image(qr_buffer, width=30*mm, height=30*mm)
                qr_element = [[qr_image], [Paragraph("Scan to Pay", self.styles['SmallText'])]]
            
            if qr_element:
                qr_table = Table(qr_element)
                qr_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ]))
                
                payment_table = Table([[bank_table, qr_table]], colWidths=[90*mm, 40*mm])
            else:
                payment_table = bank_table
            
            elements.append(payment_table)
        
        elements.append(Spacer(1, 20))
        
        # Terms and Notes
        if invoice.terms:
            elements.append(Paragraph("<b>Terms & Conditions:</b>", self.styles['SectionHeader']))
            elements.append(Paragraph(invoice.terms, self.styles['SmallText']))
            elements.append(Spacer(1, 10))
        
        if invoice.notes:
            elements.append(Paragraph("<b>Notes:</b>", self.styles['SectionHeader']))
            elements.append(Paragraph(invoice.notes, self.styles['SmallText']))
        
        elements.append(Spacer(1, 30))
        
        # Signature section
        sig_data = [
            ['', f"For {company.name}"],
            ['', ''],
            ['', ''],
            ['Customer Signature', 'Authorized Signatory'],
        ]
        
        sig_table = Table(sig_data, colWidths=[85*mm, 85*mm])
        sig_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
        ]))
        
        elements.append(sig_table)
        
        # Footer
        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
        elements.append(Paragraph(
            "This is a computer-generated invoice and does not require a physical signature.",
            ParagraphStyle('Footer', parent=self.styles['SmallText'], alignment=TA_CENTER)
        ))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        return buffer
    
    def generate_invoice_pdf_base64(
        self,
        invoice: Invoice,
        company: Company,
        customer: Customer = None
    ) -> str:
        """Generate invoice PDF and return as base64 string."""
        pdf_buffer = self.generate_invoice_pdf(invoice, company, customer)
        return base64.b64encode(pdf_buffer.getvalue()).decode()

