"""
Reset Database - Drop all tables and recreate them
WARNING: This will delete ALL data!
"""
import sys
sys.path.insert(0, '.')

from sqlalchemy import text
from app.database.connection import engine, Base

# Import all models to register them with Base
from app.database.models import (
    User, Company, BankAccount, Customer, Product, Invoice, InvoiceItem, Payment,
    Account, Transaction, TransactionEntry, BankImport, BankImportRow,
    StockGroup, Godown, Batch, StockEntry, BillOfMaterial, BOMComponent,
    SalesOrder, SalesOrderItem, PurchaseOrder, PurchaseOrderItem,
    DeliveryNote, DeliveryNoteItem, ReceiptNote, ReceiptNoteItem, QuickEntry,
    # New models for Purchase Invoice and TDS
    TDSSection, PurchaseInvoice, PurchaseInvoiceItem, PurchasePayment, TDSEntry,
    # Multi-currency and cost center
    Currency, ExchangeRate, ForexGainLoss,
    CostCenter, CostCategory, BudgetMaster, BudgetLine,
    # NEW: Inventory enhancements
    ProductUnit, PriceLevel, ProductPrice, SerialNumber, 
    StockAdjustment, StockAdjustmentItem, DiscountRule,
    ManufacturingOrder, ManufacturingConsumption, ManufacturingByproduct,
    # NEW: Banking
    ChequeBook, Cheque, PostDatedCheque, BankReconciliation, 
    ReconciliationEntry, RecurringTransaction,
    # NEW: Accounting
    BillAllocation, PeriodLock, AuditLog, NarrationTemplate, Scenario,
    # NEW: Account Mapping Templates
    AccountMapping, PayrollAccountConfig,
    # NEW: Miscellaneous
    Attachment, Notification, DashboardWidget, ExportLog,
    # NEW: Quotations and Delivery Challans
    Quotation, QuotationItem, DeliveryChallan, DeliveryChallanItem,
    # NEW: Sales Pipeline
    Contact, Enquiry, SalesTicket, SalesTicketLog,
    # NEW: Alternative Products
    AlternativeProduct, ProductAlternativeMapping,
)
# Import payroll models
from app.database.payroll_models import (
    Department, Designation, Employee, SalaryComponent, EmployeeSalaryStructure,
    PayrollRun, PayrollEntry, EmployeeLoan, LoanRepayment,
    EmployeeTaxDeclaration, ProfessionalTaxSlab, PayrollSettings,
    # NEW: Attendance and Leave
    Attendance, LeaveType, LeaveBalance, LeaveApplication, OvertimeRule, Holiday,
)
# Import bank statement models
from app.database.bank_statement_models import (
    BankStatementEntry, BankStatementEntryStatus, MonthlyBankReconciliation,
)

def reset_database():
    print("=" * 60)
    print("DATABASE RESET SCRIPT")
    print("=" * 60)
    print("\nWARNING: This will DELETE ALL DATA in the database!")
    
    confirm = input("\nType 'YES' to confirm: ")
    if confirm != "YES":
        print("Aborted.")
        return
    
    print("\n[1/3] Dropping all tables...")
    
    with engine.connect() as conn:
        # Disable foreign key checks temporarily
        conn.execute(text("SET session_replication_role = 'replica';"))
        conn.commit()
        
        # Get all table names
        result = conn.execute(text("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        """))
        tables = [row[0] for row in result]
        
        # Drop all tables
        for table in tables:
            try:
                conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                print(f"  Dropped: {table}")
            except Exception as e:
                print(f"  Error dropping {table}: {e}")
        
        conn.commit()
        
        # Drop enum types
        print("\n[2/3] Dropping enum types...")
        enums = [
            'invoicestatus', 'referencetype', 'vouchertype', 'entrytype',
            'orderstatus', 'stockmovementtype', 'accounttype', 'invoicetype',
            'transactionstatus', 'paymentmode', 'purchaseinvoicestatus',
            # Payroll enums
            'employeetype', 'employeestatus', 'gender', 'maritalstatus',
            'payfrequency', 'salarycomponenttype', 'componentcalculationtype',
            'payrollrunstatus', 'loanstatus', 'loantype', 'taxregime',
            # Multi-currency and cost center enums
            'exchangeratesource', 'costcenterallocationtype', 
            'budgetstatus', 'budgetperiod',
            # NEW: Inventory enums
            'serialnumberstatus', 'stockadjustmentstatus', 'discounttype',
            'manufacturingorderstatus',
            # NEW: Banking enums
            'chequestatus', 'chequetype', 'recurringfrequency',
            # NEW: Accounting enums  
            'billallocationtype', 'accountmappingtype',
            # NEW: Misc enums
            'notificationtype',
            # NEW: Attendance/Leave enums
            'attendancestatus', 'leaveapplicationstatus',
            # NEW: Quotation and Delivery Challan enums
            'quotationstatus', 'deliverychallantype', 'deliverychallanstatus',
            # NEW: Sales Pipeline enums
            'enquirysource', 'enquirystatus', 'salesticketstatus', 'salesticketstage', 'salesticketlogaction',
        ]
        for enum in enums:
            try:
                conn.execute(text(f'DROP TYPE IF EXISTS {enum} CASCADE'))
                print(f"  Dropped enum: {enum}")
            except Exception as e:
                print(f"  Error dropping enum {enum}: {e}")
        
        conn.commit()
        
        # Re-enable foreign key checks
        conn.execute(text("SET session_replication_role = 'origin';"))
        conn.commit()
    
    print("\n[3/3] Creating all tables from models...")
    Base.metadata.create_all(bind=engine)
    print("  All tables created successfully!")
    
    print("\n" + "=" * 60)
    print("DATABASE RESET COMPLETE!")
    print("=" * 60)
    print("\nYou can now restart your server and create a new user.")

if __name__ == "__main__":
    reset_database()
