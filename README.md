# 🧾 GST Invoice Pro

A comprehensive GST-compliant invoicing solution for Indian businesses. Create professional invoices, generate UPI payment QR codes, track payments, and generate GSTR-1 & GSTR-3B reports.

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)
![React](https://img.shields.io/badge/React-19.0-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ Features

- 🏢 **Multi-Tenant Architecture** - Manage multiple businesses from one account
- 📄 **GST-Compliant Invoices** - Generate invoices with proper HSN codes, tax breakup (CGST/SGST/IGST)
- 💳 **UPI Payment Integration** - Auto-generate UPI QR codes and payment links
- 📊 **GST Reports** - Generate GSTR-1 and GSTR-3B return-ready reports
- 📱 **PDF Export** - Download beautifully formatted PDF invoices
- 💰 **Payment Tracking** - Track invoice status (Draft, Pending, Paid, Overdue)
- 🔐 **Supabase Authentication** - Secure user authentication with Supabase

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Navigate to project root**
```bash
cd sellfiz-micro-invoice
```

2. **Create virtual environment**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**
```bash
# Edit .env with your Supabase credentials and database URL
```

5. **Run the backend**
```bash
python main.py
```

The API will be available at http://localhost:8000

### Frontend Setup

1. **Navigate to frontend folder**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Run the frontend**
```bash
npm start
```

The app will be available at http://localhost:3000

## 📚 API Documentation

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

### Authentication

```bash
# Register
POST /api/auth/register
{
    "email": "user@example.com",
    "password": "password123",
    "full_name": "John Doe"
}

# Login
POST /api/auth/login
{
    "email": "user@example.com",
    "password": "password123"
}
```

### Invoices

```bash
# Create Invoice
POST /api/companies/{company_id}/invoices
{
    "customer_id": "uuid",
    "items": [
        {
            "description": "Product Name",
            "hsn_code": "84713010",
            "quantity": 1,
            "unit_price": 10000,
            "gst_rate": 18
        }
    ]
}

# Get Invoice PDF
GET /api/companies/{company_id}/invoices/{invoice_id}/pdf

# Get UPI QR Code
GET /api/companies/{company_id}/invoices/{invoice_id}/qr
```

### GST Reports

```bash
# Get GSTR-1 Report
GET /api/companies/{company_id}/gst/gstr1?month=12&year=2024

# Download GSTR-1 JSON
GET /api/companies/{company_id}/gst/gstr1/download?month=12&year=2024

# Get GSTR-3B Report
GET /api/companies/{company_id}/gst/gstr3b?month=12&year=2024
```

## 🏗️ Project Structure

```
sellfiz-micro-invoice/
├── app/                    # FastAPI Backend
│   ├── api/               # API routes
│   ├── auth/              # Authentication
│   ├── database/          # Database models
│   ├── schemas/           # Pydantic schemas
│   └── services/          # Business logic
├── frontend/              # React Frontend (Horizon UI)
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── services/      # API services
│   │   ├── views/         # Page components
│   │   └── routes.js      # Route definitions
│   └── package.json
├── main.py                # FastAPI entry point
├── requirements.txt
└── README.md
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# App Settings
APP_NAME=GST Invoice Pro
DEBUG=true
SECRET_KEY=your-secret-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Database
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Frontend Environment (.env in frontend/)

```env
REACT_APP_API_URL=http://localhost:8000/api
```

## 📊 GST Compliance

### GSTR-1 Report Includes:
- B2B Invoices (with customer GSTIN)
- B2C Large (> ₹2.5L inter-state)
- B2C Small (summary by state and rate)
- HSN Summary
- Document Summary

### GSTR-3B Report Includes:
- Outward supplies breakdown
- Tax liability calculation
- Inter-state supplies summary

## 🛠️ Development

### Running Both Backend and Frontend

Terminal 1 (Backend):
```bash
cd sellfiz-micro-invoice
venv\Scripts\activate
python main.py
```

Terminal 2 (Frontend):
```bash
cd sellfiz-micro-invoice/frontend
npm start
```

---

Built with ❤️ for Indian Businesses
