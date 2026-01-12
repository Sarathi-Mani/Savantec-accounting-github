"""API routes module."""
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.customers import router as customers_router
from app.api.products import router as products_router
from app.api.invoices import router as invoices_router
from app.api.gst import router as gst_router
from app.api.dashboard import router as dashboard_router
from app.api.quotations import router as quotations_router
from app.api.delivery_challans import router as delivery_challans_router
from app.api.contacts import router as contacts_router
from app.api.enquiries import router as enquiries_router
from app.api.sales_tickets import router as sales_tickets_router
from app.api.sales_dashboard import router as sales_dashboard_router
from app.api.alternative_products import router as alternative_products_router

# IMPORTANT: Make sure these imports are at the SAME level as others
from app.api.brands import router as brands_router
from app.api.categories import router as categories_router

__all__ = [
    "auth_router",
    "companies_router",
    "customers_router",
    "products_router",
    "invoices_router",
    "gst_router",
    "dashboard_router",
    "quotations_router",
    "delivery_challans_router",
    "contacts_router",
    "enquiries_router",
    "sales_tickets_router",
    "sales_dashboard_router",
    "alternative_products_router",
    "brands_router",  # This must match the imported name above
    "categories_router",  # This must match the imported name above
]

