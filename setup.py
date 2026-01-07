# setup.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text, inspect
from app.database.connection import engine

def setup_customer_tables():
    """Setup Customer and OpeningBalanceItem tables with all required fields."""
    
    print("Setting up Customer tables...")
    print("="*60)
    
    try:
        inspector = inspect(engine)
        
        # Get existing columns in customers table
        existing_columns = [col['name'] for col in inspector.get_columns('customers')]
        print(f"Existing columns in 'customers': {len(existing_columns)}")
        
        # Define ALL columns that should be in the Customer model (NO DUPLICATES)
        columns_to_add = [
            # Basic contact fields
            {
                'name': 'contact',
                'type': 'VARCHAR(20)',
                'default': None,
                'nullable': True,
                'description': 'Primary contact number'
            },
            {
                'name': 'mobile',
                'type': 'VARCHAR(20)',
                'default': None,
                'nullable': True,
                'description': 'Additional mobile number'
            },
            
            # Tax information fields
            {
                'name': 'tax_number',
                'type': 'VARCHAR(15)',
                'default': None,
                'nullable': True,
                'description': 'GST Number'
            },
            {
                'name': 'gst_registration_type',
                'type': 'VARCHAR(50)',
                'default': None,
                'nullable': True,
                'description': 'GST Registration Type'
            },
            {
                'name': 'pan_number',
                'type': 'VARCHAR(10)',
                'default': None,
                'nullable': True,
                'description': 'PAN Number'
            },
            
            # Vendor information
            {
                'name': 'vendor_code',
                'type': 'VARCHAR(50)',
                'default': None,
                'nullable': True,
                'description': 'Vendor Code'
            },
            
            # Financial fields
            {
                'name': 'opening_balance',
                'type': 'NUMERIC(15,2)',
                'default': '0',
                'nullable': True,
                'description': 'Opening Balance'
            },
            {
                'name': 'opening_balance_type',
                'type': 'VARCHAR(20)',
                'default': "'outstanding'",
                'nullable': True,
                'description': 'Opening Balance Type: outstanding/advance'
            },
            {
                'name': 'opening_balance_mode',
                'type': 'VARCHAR(20)',
                'default': "'single'",
                'nullable': True,
                'description': 'Opening Balance Mode: single/split'
            },
            
            # Address fields (simplified versions)
            {
                'name': 'billing_address',
                'type': 'TEXT',
                'default': None,
                'nullable': True,
                'description': 'Complete billing address'
            },
            {
                'name': 'billing_zip',
                'type': 'VARCHAR(10)',
                'default': None,
                'nullable': True,
                'description': 'Billing ZIP/Pincode'
            },
            {
                'name': 'shipping_address',
                'type': 'TEXT',
                'default': None,
                'nullable': True,
                'description': 'Complete shipping address'
            },
            {
                'name': 'shipping_zip',
                'type': 'VARCHAR(10)',
                'default': None,
                'nullable': True,
                'description': 'Shipping ZIP/Pincode'
            },
        ]
        
        # Filter out columns that already exist
        columns_to_add = [col for col in columns_to_add if col['name'] not in existing_columns]
        
        added_count = 0
        with engine.begin() as conn:
            for column in columns_to_add:
                # Build ALTER TABLE statement
                sql = f"ALTER TABLE customers ADD COLUMN {column['name']} {column['type']}"
                
                if column['default']:
                    sql += f" DEFAULT {column['default']}"
                
                print(f"Adding column: {column['name']} ({column['description']})...")
                conn.execute(text(sql))
                print(f"  ✅ Added column: {column['name']}")
                added_count += 1
        
        # Update existing phone column to have contact data if contact is empty
        print("\nChecking data migration...")
        with engine.begin() as conn:
            # Check if contact column exists but is empty
            check_sql = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'customers' AND column_name = 'phone'
            """)
            phone_exists = conn.execute(check_sql).fetchone()
            
            if phone_exists:
                print("Found 'phone' column. Checking if 'contact' needs data...")
                
                # Copy phone data to contact where contact is NULL
                update_sql = text("""
                    UPDATE customers 
                    SET contact = phone 
                    WHERE contact IS NULL AND phone IS NOT NULL
                """)
                result = conn.execute(update_sql)
                print(f"  ✅ Copied data from 'phone' to 'contact' for {result.rowcount} records")
        
        # Create opening_balance_items table if it doesn't exist
        existing_tables = inspector.get_table_names()
        if 'opening_balance_items' not in existing_tables:
            print("\nCreating 'opening_balance_items' table...")
            
            create_table_sql = """
            CREATE TABLE opening_balance_items (
                id VARCHAR(36) PRIMARY KEY,
                customer_id VARCHAR(36) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                date TIMESTAMP NOT NULL,
                voucher_name VARCHAR(255) NOT NULL,
                days INTEGER,
                amount NUMERIC(14,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            
            with engine.begin() as conn:
                conn.execute(text(create_table_sql))
            
            # Create indexes
            index_sqls = [
                "CREATE INDEX idx_opening_balance_customer ON opening_balance_items(customer_id);",
                "CREATE INDEX idx_opening_balance_company ON opening_balance_items(company_id);",
                "CREATE INDEX idx_opening_balance_date ON opening_balance_items(date);"
            ]
            
            with engine.begin() as conn:
                for idx_sql in index_sqls:
                    conn.execute(text(idx_sql))
            
            print("  ✅ Created 'opening_balance_items' table with indexes")
        else:
            print("\n  ⏭️ 'opening_balance_items' table already exists")
        
        print(f"\n" + "="*60)
        print(f"✅ Setup completed!")
        print(f"   Added {added_count} new columns to customers table")
        
        # Show final structure
        print(f"\nCurrent columns in 'customers' table:")
        final_columns = [col['name'] for col in inspector.get_columns('customers')]
        for i, col in enumerate(sorted(final_columns), 1):
            print(f"  {i:2}. {col}")
        
        # Check which fields are still missing for frontend
        print(f"\n" + "="*60)
        print("FRONTEND COMPATIBILITY CHECK:")
        print("="*60)
        
        # These are the exact fields from your frontend React form
        frontend_required_fields = [
            'name',                    # Customer Name (exists)
            'contact',                 # Primary Contact (added)
            'email',                   # Email (exists)
            'mobile',                  # Mobile (added)
            'tax_number',              # GST Number (added) 
            'gst_registration_type',   # GST Registration Type (added)
            'pan_number',              # PAN Number (added)
            'vendor_code',             # Vendor Code (added)
            'opening_balance',         # Opening Balance (added)
            'opening_balance_type',    # Opening Balance Type (added)
            'opening_balance_mode',    # Opening Balance Mode (added)
            'credit_limit',            # Credit Limit (exists)
            'credit_days',             # Credit Days (exists)
            'billing_address',         # Billing Address (added)
            'billing_city',            # Billing City (exists as billing_city)
            'billing_state',           # Billing State (exists as billing_state)
            'billing_country',         # Billing Country (exists as billing_country)
            'billing_zip',             # Billing ZIP (added)
            'shipping_address',        # Shipping Address (added)
            'shipping_city',           # Shipping City (exists as shipping_city)
            'shipping_state',          # Shipping State (exists as shipping_state)
            'shipping_country',        # Shipping Country (exists as shipping_country)
            'shipping_zip',            # Shipping ZIP (added)
            'customer_type',           # Customer Type (exists)
            'trade_name',              # Trade Name (exists)
            'contact_person',          # Contact Person (exists)
        ]
        
        print("\nField Status:")
        missing_fields = []
        for field in frontend_required_fields:
            if field in final_columns:
                print(f"  ✅ {field}")
            else:
                # Check for alternative names
                alt_names = {
                    'billing_city': 'billing_city',
                    'billing_state': 'billing_state', 
                    'billing_country': 'billing_country',
                    'shipping_city': 'shipping_city',
                    'shipping_state': 'shipping_state',
                    'shipping_country': 'shipping_country',
                }
                
                if field in alt_names and alt_names[field] in final_columns:
                    print(f"  ✅ {field} (as '{alt_names[field]}')")
                else:
                    print(f"  ❌ {field} - MISSING")
                    missing_fields.append(field)
        
        if missing_fields:
            print(f"\n⚠️  Missing fields for frontend: {len(missing_fields)}")
            for field in missing_fields:
                print(f"    - {field}")
        else:
            print(f"\n🎉 All frontend fields are available!")
        
        print(f"\n" + "="*60)
        print("NEXT STEPS:")
        print("1. Update your Customer model in models.py to include all new fields")
        print("2. Update your Pydantic schemas to match")
        print("3. Test the customer creation form")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def show_customer_schema():
    """Show the current customer table schema."""
    
    print("\n" + "="*60)
    print("CURRENT CUSTOMER TABLE SCHEMA")
    print("="*60)
    
    try:
        inspector = inspect(engine)
        
        print("\nColumns in 'customers' table:")
        print("-"*60)
        
        columns = inspector.get_columns('customers')
        for col in sorted(columns, key=lambda x: x['name']):
            nullable = "NULL" if col['nullable'] else "NOT NULL"
            default = f"DEFAULT {col['default']}" if col['default'] else ""
            print(f"{col['name']:30} {str(col['type']):25} {nullable:10} {default}")
        
        print(f"\nTotal columns: {len(columns)}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    setup_customer_tables()
    show_customer_schema()