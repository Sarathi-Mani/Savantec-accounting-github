"""GST Invoice Pro - Main FastAPI Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database.connection import init_db
from app.api import (
    auth_router,
    companies_router,
    customers_router,
    products_router,
    invoices_router,
    gst_router,
    dashboard_router,
    quotations_router,
    delivery_challans_router,
    contacts_router,
    enquiries_router,
    sales_tickets_router,
    sales_dashboard_router,
    alternative_products_router,
    # Add these imports
    brands_router,
    categories_router,
)
from app.api.accounting import router as accounting_router
from app.api.quick_entry import router as quick_entry_router
from app.api.inventory import router as inventory_router
from app.api.orders import router as orders_router
from app.api.gst_integration import router as gst_integration_router
from app.api.purchases import router as purchases_router
from app.api.tds import router as tds_router
from app.api.vendors import router as vendors_router
from app.api.business_dashboard import router as business_dashboard_router
from app.api.payroll import router as payroll_router
from app.api.currencies import router as currencies_router
from app.api.cost_centers import router as cost_centers_router
from app.api.gst_reconciliation import router as gst_reconciliation_router
from app.api.banking import router as banking_router
from app.api.reports_advanced import router as reports_advanced_router
from app.api.additional_endpoints import router as additional_router
from app.api.attendance_leave import router as attendance_leave_router

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    GST Invoice Pro - A comprehensive GST-compliant invoicing solution for Indian businesses.
    
    ## Features
    - 🏢 Multi-tenant architecture
    - 📄 GST-compliant invoice generation
    - 💳 UPI QR code payment links
    - 📊 GSTR-1 and GSTR-3B report generation
    - 📱 PDF invoice download
    - 💰 Payment tracking
    
    ## Authentication
    Use Bearer token authentication. Get token from /auth/login endpoint.
    """,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS middleware - Allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:6767",  # React dev server
        "http://127.0.0.1:6767",
        "http://localhost:6768",
        "http://127.0.0.1:6768",
        "https://accounts-demo.sellfiz.com",  # Production frontend
        "https://accounts-demo-api.sellfiz.com",  # Production API
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
os.makedirs("static", exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include API routers
app.include_router(auth_router, prefix="/api")
app.include_router(companies_router, prefix="/api")
app.include_router(customers_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(invoices_router, prefix="/api")
app.include_router(gst_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(accounting_router, prefix="/api")
app.include_router(quick_entry_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(gst_integration_router, prefix="/api")
app.include_router(purchases_router, prefix="/api")
app.include_router(tds_router, prefix="/api")
app.include_router(vendors_router, prefix="/api")
app.include_router(business_dashboard_router, prefix="/api")
app.include_router(payroll_router, prefix="/api")
app.include_router(currencies_router, prefix="/api")
app.include_router(cost_centers_router, prefix="/api")
app.include_router(gst_reconciliation_router, prefix="/api")
app.include_router(banking_router, prefix="/api")
app.include_router(reports_advanced_router, prefix="/api")
app.include_router(additional_router, prefix="/api")
app.include_router(attendance_leave_router, prefix="/api")
app.include_router(quotations_router, prefix="/api")
app.include_router(delivery_challans_router, prefix="/api")
app.include_router(contacts_router)
app.include_router(enquiries_router)
app.include_router(sales_tickets_router)
app.include_router(sales_dashboard_router)
app.include_router(alternative_products_router, prefix="/api")

# ADD THESE TWO LINES for brands and categories
app.include_router(brands_router, prefix="/api")
app.include_router(categories_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    print(f"[OK] {settings.APP_NAME} v{settings.APP_VERSION} started!")
    print(f"[API] Docs: http://localhost:6768/api/docs")
    print(f"[WEB] Frontend: http://localhost:6767")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@app.get("/api")
async def api_info():
    """API information endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "endpoints": {
            "auth": "/api/auth",
            "companies": "/api/companies",
            "customers": "/api/companies/{company_id}/customers",
            "vendors": "/api/companies/{company_id}/vendors",
            "products": "/api/companies/{company_id}/products",
            "invoices": "/api/companies/{company_id}/invoices",
            "purchases": "/api/companies/{company_id}/purchases",
            "tds": "/api/companies/{company_id}/tds",
            "gst": "/api/companies/{company_id}/gst",
            "dashboard": "/api/companies/{company_id}/dashboard",
            "accounting": "/api/companies/{company_id}/accounts",
            "transactions": "/api/companies/{company_id}/transactions",
            "bank_import": "/api/companies/{company_id}/bank-import",
            "reports": "/api/companies/{company_id}/reports",
            # Add these endpoints
            "brands": "/api/companies/{company_id}/brands",
            "categories": "/api/companies/{company_id}/categories"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=6768,
        reload=settings.DEBUG
    )
    