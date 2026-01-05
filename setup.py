# setup.py
import sys
import os

# Add project root to path
sys.path.insert(0, os.getcwd())

print("=" * 60)
print("CREATING DATABASE TABLES")
print("=" * 60)

try:
    # Import connection and models
    from app.database.connection import Base, engine
    
    # Import all models to register them
    import app.database.models
    
    print("✓ Models imported successfully")
    
    # Create all tables
    print("\nCreating tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created")
    
    # Verify creation
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n✅ SUCCESS: Created {len(tables)} tables")
    print("-" * 40)
    
    # List tables in categories
    table_categories = {
        "Users & Companies": ['users', 'companies'],
        "Customers & Contacts": ['customers', 'contacts'],
        "Products & Inventory": ['products', 'items', 'batches', 'stock_entries'],
        "Accounting": ['accounts', 'transactions', 'transaction_entries'],
        "Sales": ['invoices', 'invoice_items', 'payments', 'quotations'],
        "Purchase": ['purchase_invoices', 'purchase_invoice_items'],
        "Banking": ['bank_accounts', 'cheques'],
        "Multi-currency": ['currencies', 'exchange_rates'],
        "Payroll": ['employees', 'payroll_runs', 'attendance'],
    }
    
    for category, expected_tables in table_categories.items():
        category_tables = [t for t in tables if t in expected_tables]
        if category_tables:
            print(f"\n{category}:")
            for table in sorted(category_tables):
                columns = inspector.get_columns(table)
                print(f"  {table} ({len(columns)} columns)")
    
    # Show remaining tables
    all_expected = [t for tables in table_categories.values() for t in tables]
    remaining = [t for t in tables if t not in all_expected]
    if remaining:
        print(f"\nOther tables ({len(remaining)}):")
        for table in sorted(remaining):
            print(f"  {table}")
    
    print("\n" + "=" * 60)
    print("DATABASE SETUP COMPLETE!")
    print("You can now start your application:")
    print("python main.py")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()