"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import api from "@/services/api";

interface PermissionCategory {
  value: string;
  label: string;
}

interface PermissionModule {
  id: string;
  name: string;
  category: string;
  permissions: string[];
}

interface FormData {
  name: string;
  code: string;
  grade: string;
  description: string;
  permissions: string[];
}

// Predefined Roles interface
interface PredefinedRole {
  id: string;
  name: string;
  code: string;
  grade: string;
  description: string;
  permissions: string[];
  color: string;
}

// First, define permissionModules
const permissionModules: PermissionModule[] = [
  // INVENTORY Category
  {
    id: "module_tax",
    name: "Tax",
    category: "inventory,others",
    permissions: ["tax_view", "tax_add", "tax_edit", "tax_delete"],
  },
  {
    id: "module_units",
    name: "Units",
    category: "inventory",
    permissions: ["unit_view", "unit_add", "unit_edit", "unit_delete"],
  },
  {
    id: "module_items",
    name: "Items",
    category: "inventory",
    permissions: [
      "item_view",
      "item_add",
      "item_edit",
      "item_delete",
      "item_category_view",
      "item_category_add",
      "item_category_edit",
      "item_category_delete",
      "print_labels",
      "import_items",
    ],
  },
  {
    id: "module_stock_transfer",
    name: "Stock Transfer",
    category: "inventory",
    permissions: [
      "stock_transfer_view",
      "stock_transfer_add",
      "stock_transfer_edit",
      "stock_transfer_delete",
    ],
  },
  {
    id: "module_stock_journal",
    name: "Stock Journal",
    category: "inventory",
    permissions: [
      "stock_journal_view",
      "stock_journal_add",
      "stock_journal_edit",
      "stock_journal_delete",
    ],
  },
  {
    id: "module_stock_adjustment",
    name: "Stock Adjustment",
    category: "inventory",
    permissions: [
      "stock_adjustment_view",
      "stock_adjustment_add",
      "stock_adjustment_edit",
      "stock_adjustment_delete",
    ],
  },
  {
    id: "module_brand",
    name: "Brand",
    category: "inventory",
    permissions: ["brand_view", "brand_add", "brand_edit", "brand_delete"],
  },
  {
    id: "module_variant",
    name: "Variant",
    category: "inventory",
    permissions: ["variant_view", "variant_add", "variant_edit", "variant_delete"],
  },

  // SALES Category
  {
    id: "module_customers",
    name: "Customers",
    category: "sales",
    permissions: [
      "customer_view",
      "customer_add",
      "customer_edit",
      "customer_delete",
      "import_customers",
    ],
  },
  {
    id: "module_customer_advance",
    name: "Customers Advance Payments",
    category: "sales",
    permissions: [
      "customer_advance_view",
      "customer_advance_add",
      "customer_advance_edit",
      "customer_advance_delete",
    ],
  },
  {
    id: "module_sales",
    name: "Sales",
    category: "sales",
    permissions: [
      "sales_view",
      "sales_add",
      "sales_edit",
      "sales_delete",
      "sales_payments_view",
      "sales_payments_add",
      "sales_payments_delete",
      "show_all_users_sales_invoices",
      "show_item_purchase_price",
    ],
  },
  {
    id: "module_proforma_invoice",
    name: "Proforma Invoice",
    category: "sales",
    permissions: [
      "proforma_invoice_view",
      "proforma_invoice_add",
      "proforma_invoice_edit",
      "proforma_invoice_delete",
    ],
  },
  {
    id: "module_delivery_challan_in",
    name: "Delivery Challan In",
    category: "sales",
    permissions: [
      "delivery_challan_in_view",
      "delivery_challan_in_add",
      "delivery_challan_in_edit",
      "delivery_challan_in_delete",
    ],
  },
  {
    id: "module_delivery_challan_out",
    name: "Delivery Challan Out",
    category: "sales",
    permissions: [
      "delivery_challan_out_view",
      "delivery_challan_out_add",
      "delivery_challan_out_edit",
      "delivery_challan_out_delete",
    ],
  },
  {
    id: "module_salesorder",
    name: "Salesorder",
    category: "sales",
    permissions: [
      "salesorder_view",
      "salesorder_add",
      "salesorder_edit",
      "salesorder_delete",
    ],
  },
  {
    id: "module_discount_coupon",
    name: "Discount Coupon",
    category: "sales",
    permissions: [
      "discount_coupon_view",
      "discount_coupon_add",
      "discount_coupon_edit",
      "discount_coupon_delete",
    ],
  },
  {
    id: "module_quotation",
    name: "Quotation",
    category: "sales",
    permissions: [
      "quotation_view",
      "quotation_add",
      "quotation_edit",
      "quotation_delete",
      "show_all_users_quotations",
    ],
  },
  {
    id: "module_sales_return",
    name: "Sales Return",
    category: "sales",
    permissions: [
      "sales_return_view",
      "sales_return_add",
      "sales_return_edit",
      "sales_return_delete",
      "sales_return_payments_view",
      "sales_return_payments_add",
      "sales_return_payments_delete",
      "show_all_users_sales_return_invoices",
    ],
  },

  // PURCHASE Category
  {
    id: "module_suppliers",
    name: "Suppliers",
    category: "purchase",
    permissions: [
      "supplier_view",
      "supplier_add",
      "supplier_edit",
      "supplier_delete",
      "import_suppliers",
    ],
  },
  {
    id: "module_supplier_advance",
    name: "Supplier Advance Payments",
    category: "purchase",
    permissions: [
      "supplier_advance_view",
      "supplier_advance_add",
      "supplier_advance_edit",
      "supplier_advance_delete",
    ],
  },
  {
    id: "module_purchase",
    name: "Purchase",
    category: "purchase",
    permissions: [
      "purchase_view",
      "purchase_add",
      "purchase_edit",
      "purchase_delete",
      "purchase_payments_view",
      "purchase_payments_add",
      "purchase_payments_delete",
      "show_all_users_purchase_invoices",
    ],
  },
  {
    id: "module_purchase_order",
    name: "Purchase Order",
    category: "purchase",
    permissions: [
      "purchase_order_view",
      "purchase_order_add",
      "purchase_order_edit",
      "purchase_order_delete",
    ],
  },
  {
    id: "module_purchase_return",
    name: "Purchase Return",
    category: "purchase",
    permissions: [
      "purchase_return_view",
      "purchase_return_add",
      "purchase_return_edit",
      "purchase_return_delete",
      "purchase_return_payments_view",
      "purchase_return_payments_add",
      "purchase_return_payments_delete",
      "show_all_users_purchase_return_invoices",
    ],
  },

  // ACCOUNTS Category
  {
    id: "module_accounts",
    name: "Accounts",
    category: "accounts",
    permissions: [
      "account_view",
      "account_add",
      "account_edit",
      "account_delete",
      "money_deposit_view",
      "money_deposit_add",
      "money_deposit_edit",
      "money_deposit_delete",
      "cash_flow_view",
      "cash_flow_add",
      "cash_flow_edit",
      "cash_flow_delete",
      "money_transfer_view",
      "money_transfer_add",
      "money_transfer_edit",
      "money_transfer_delete",
      "chart_of_accounts_view",
      "chart_of_accounts_add",
      "chart_of_accounts_edit",
      "chart_of_accounts_delete",
      "entries_view",
      "entries_add",
      "entries_edit",
      "entries_delete",
      "cash_transactions",
    ],
  },
  {
    id: "module_expense",
    name: "Expense",
    category: "accounts",
    permissions: [
      "expense_view",
      "expense_add",
      "expense_edit",
      "expense_delete",
      "expense_category_view",
      "expense_category_add",
      "expense_category_edit",
      "expense_category_delete",
      "expense_item_view",
      "expense_item_add",
      "expense_item_edit",
      "expense_item_delete",
      "show_all_users_expenses",
    ],
  },
  {
    id: "module_payment_types",
    name: "Payment Types",
    category: "accounts",
    permissions: [
      "payment_type_view",
      "payment_type_add",
      "payment_type_edit",
      "payment_type_delete",
    ],
  },

  // REPORTS Category
  {
    id: "module_reports",
    name: "Reports",
    category: "reports",
    permissions: [
      "report_delivery_sheet",
      "report_load_sheet",
      "report_customer_orders",
      "report_customer",
      "report_supplier",
      "report_sales_tax",
      "report_purchase_tax",
      "report_supplier_items",
      "report_sales",
      "report_sales_register",
      "report_purchase_register",
      "report_sales_return",
      "report_seller_points",
      "report_purchase",
      "report_overseas_ledger",
      "report_purchase_return",
      "report_expense",
      "report_expense_outstanding",
      "report_expense_payment",
      "report_expense_gst",
      "report_profit",
      "report_stock",
      "report_stock_ledger",
      "report_sales_item",
      "report_return_items",
      "report_purchase_payments",
      "report_sales_payments",
      "report_gstr1",
      "report_gstr2",
      "report_sales_gst",
      "report_purchase_gst",
      "report_quotation_items",
      "report_purchase_order_item",
      "report_hsn_summary",
      "report_balance_sheet",
      "report_trial_balance",
      "report_ledger_statement",
      "report_ledger_entries",
      "report_reconciliation",
    ],
  },

  // OTHERS Category
  {
    id: "module_users",
    name: "Users",
    category: "others",
    permissions: ["user_view", "user_add", "user_edit", "user_delete"],
  },
  {
    id: "module_roles",
    name: "Roles",
    category: "others",
    permissions: ["role_view", "role_add", "role_edit", "role_delete"],
  },
  {
    id: "module_company",
    name: "Company",
    category: "others",
    permissions: ["company_view", "company_add", "company_edit", "company_delete"],
  },
  {
    id: "module_store",
    name: "Store(Own Store)",
    category: "others",
    permissions: ["store_edit"],
  },
  {
    id: "module_dashboard",
    name: "Dashboard",
    category: "others",
    permissions: [
      "dashboard_view",
      "dashboard_info1",
      "dashboard_info2",
      "dashboard_chart",
      "dashboard_items",
      "dashboard_stock_alert",
      "dashboard_trending",
      "dashboard_recent_sales",
    ],
  },
];

// Helper function to get module permissions
const getModulePermissions = (moduleId: string): string[] => {
  const module = permissionModules.find(m => m.id === moduleId);
  return module ? module.permissions : [];
};

// Helper function to get all permissions by type
const getAllPermissionsByType = (type: string): string[] => {
  return permissionModules.flatMap(module => 
    module.permissions.filter(p => p.includes(`_${type}`))
  );
};

// Helper function to get specific module
const getModuleById = (moduleId: string): PermissionModule | undefined => {
  return permissionModules.find(m => m.id === moduleId);
};

// Now define predefinedRoles using the helper functions
const predefinedRoles: PredefinedRole[] = [
  {
    id: "super_admin",
    name: "Super Admin (Director)",
    code: "SA01",
    grade: "A1",
    description: "All details and approval authority",
    permissions: ["all"], // Special flag for all permissions
    color: "bg-red-500"
  },
  {
    id: "admin_manager",
    name: "Admin Manager",
    code: "AM01",
    grade: "A2",
    description: "All details and approval for all items, customer, vendor creation approval, leave, permission approval",
    permissions: [
      // All view permissions
      ...getAllPermissionsByType("view"),
      // All add permissions
      ...getAllPermissionsByType("add"),
      // All edit permissions
      ...getAllPermissionsByType("edit"),
      // All delete permissions
      ...getAllPermissionsByType("delete"),
      // Specific approvals
      "customer_approval",
      "vendor_approval",
      "leave_approval",
      "permission_approval"
    ],
    color: "bg-blue-500"
  },
  {
    id: "admin_executive",
    name: "Admin Executive (Quotation Team)",
    code: "AE01",
    grade: "B1",
    description: "Quotation, sales order, proforma, DC, invoice, item compare, item, customer – create, enquiry",
    permissions: [
      // Quotation permissions
      ...getModulePermissions("module_quotation"),
      // Sales permissions
      ...getModulePermissions("module_salesorder"),
      ...getModulePermissions("module_proforma_invoice"),
      ...getModulePermissions("module_delivery_challan_in"),
      ...getModulePermissions("module_delivery_challan_out"),
      ...getModulePermissions("module_sales").filter(p => !p.includes("show_all_users")),
      // Customer permissions
      ...getModulePermissions("module_customers"),
      // Item permissions
      ...getModulePermissions("module_items").filter(p => !p.includes("import")),
      // Additional permissions
      "enquiry_view", "enquiry_add", "enquiry_edit", "enquiry_delete",
      "item_compare_view", "item_compare_add"
    ],
    color: "bg-green-500"
  },
  {
    id: "accountant",
    name: "Accountant",
    code: "ACC01",
    grade: "B2",
    description: "Sales Invoice, proforma, DC, purchase invoice, sales order, cash & bank entries, journal, stock journal, vendor creation, all details for IT filing, expenses, asset, liabilities, etc",
    permissions: [
      // Sales and purchase invoices
      ...getModulePermissions("module_sales"),
      ...getModulePermissions("module_proforma_invoice"),
      ...getModulePermissions("module_delivery_challan_in"),
      ...getModulePermissions("module_delivery_challan_out"),
      ...getModulePermissions("module_purchase"),
      ...getModulePermissions("module_purchase_return"),
      ...getModulePermissions("module_salesorder"),
      // Accounts permissions
      ...getModulePermissions("module_accounts"),
      // Expense permissions
      ...getModulePermissions("module_expense"),
      // Vendor permissions
      ...getModulePermissions("module_suppliers"),
      ...getModulePermissions("module_supplier_advance"),
      // Stock journal
      ...getModulePermissions("module_stock_journal"),
      // Reports for accounting
      "report_balance_sheet", "report_trial_balance", "report_ledger_statement",
      "report_ledger_entries", "report_reconciliation", "report_gstr1", "report_gstr2",
      "report_sales_gst", "report_purchase_gst", "report_sales_tax", "report_purchase_tax",
      "report_expense_gst", "report_profit"
    ],
    color: "bg-purple-500"
  },
  {
    id: "sales_engineer",
    name: "Sales Engineer",
    code: "SE01",
    grade: "C1",
    description: "Enquiry, quotation, view-(quotation, DC, invoice, proforma, sales order, sales outstanding, stock, item compare), their customer details, visit plan, km travelled",
    permissions: [
      // Enquiry
      "enquiry_view", "enquiry_add", "enquiry_edit", "enquiry_delete",
      // Quotation (view and add only, no delete)
      ...getModulePermissions("module_quotation").filter(p => !p.includes("delete")),
      // View permissions only for sales modules
      ...getModulePermissions("module_salesorder").filter(p => p.includes("view")),
      ...getModulePermissions("module_proforma_invoice").filter(p => p.includes("view")),
      ...getModulePermissions("module_delivery_challan_in").filter(p => p.includes("view")),
      ...getModulePermissions("module_delivery_challan_out").filter(p => p.includes("view")),
      ...getModulePermissions("module_sales").filter(p => p.includes("view") || p.includes("payments_view")),
      // Customer (view and edit only, no delete)
      ...getModulePermissions("module_customers").filter(p => !p.includes("delete") && !p.includes("import")),
      // Stock view
      ...getModulePermissions("module_items").filter(p => p.includes("view")),
      "item_compare_view",
      "report_stock", "report_stock_ledger",
      // Sales outstanding
      "report_customer_orders",
      // Visit plan and travel
      "visit_plan_view", "visit_plan_add", "visit_plan_edit",
      "travel_log_view", "travel_log_add", "travel_log_edit",
      // Reports for sales
      "report_sales", "report_sales_item", "report_seller_points"
    ],
    color: "bg-orange-500"
  },
  {
    id: "internal_sales_engineer",
    name: "Internal Sales Engineer",
    code: "ISE01",
    grade: "C2",
    description: "Same as Sales Engineer permissions",
    permissions: [
      // Enquiry
      "enquiry_view", "enquiry_add", "enquiry_edit", "enquiry_delete",
      // Quotation (view and add only, no delete)
      ...getModulePermissions("module_quotation").filter(p => !p.includes("delete")),
      // View permissions only for sales modules
      ...getModulePermissions("module_salesorder").filter(p => p.includes("view")),
      ...getModulePermissions("module_proforma_invoice").filter(p => p.includes("view")),
      ...getModulePermissions("module_delivery_challan_in").filter(p => p.includes("view")),
      ...getModulePermissions("module_delivery_challan_out").filter(p => p.includes("view")),
      ...getModulePermissions("module_sales").filter(p => p.includes("view") || p.includes("payments_view")),
      // Customer (view and edit only, no delete)
      ...getModulePermissions("module_customers").filter(p => !p.includes("delete") && !p.includes("import")),
      // Stock view
      ...getModulePermissions("module_items").filter(p => p.includes("view")),
      "item_compare_view",
      "report_stock", "report_stock_ledger",
      // Sales outstanding
      "report_customer_orders",
      // Visit plan and travel
      "visit_plan_view", "visit_plan_add", "visit_plan_edit",
      "travel_log_view", "travel_log_add", "travel_log_edit",
      // Reports for sales
      "report_sales", "report_sales_item", "report_seller_points"
    ],
    color: "bg-yellow-500"
  },
  {
    id: "store_incharge",
    name: "Store Incharge",
    code: "ST01",
    grade: "C3",
    description: "Stock update, stock journal, purchase request, view-quotation, DC, invoice, proforma, sales order",
    permissions: [
      // Stock management
      ...getModulePermissions("module_stock_transfer"),
      ...getModulePermissions("module_stock_journal"),
      ...getModulePermissions("module_stock_adjustment"),
      // Purchase request
      "purchase_request_view", "purchase_request_add", "purchase_request_edit", "purchase_request_delete",
      // View only permissions
      ...getModulePermissions("module_quotation").filter(p => p.includes("view")),
      ...getModulePermissions("module_salesorder").filter(p => p.includes("view")),
      ...getModulePermissions("module_proforma_invoice").filter(p => p.includes("view")),
      ...getModulePermissions("module_delivery_challan_in").filter(p => p.includes("view")),
      ...getModulePermissions("module_delivery_challan_out").filter(p => p.includes("view")),
      ...getModulePermissions("module_sales").filter(p => p.includes("view")),
      ...getModulePermissions("module_purchase").filter(p => p.includes("view")),
      // Item permissions (full access)
      ...getModulePermissions("module_items"),
      ...getModulePermissions("module_brand"),
      ...getModulePermissions("module_variant"),
      ...getModulePermissions("module_units"),
      // Stock reports
      "report_stock", "report_stock_ledger", "report_delivery_sheet", "report_load_sheet"
    ],
    color: "bg-teal-500"
  },
  {
    id: "purchase_manager",
    name: "Purchase Manager",
    code: "PM01",
    grade: "B3",
    description: "Purchase request, vendor creation, purchase order, purchase invoice, purchase quotation & compare, view stock list, enquiry check and purchase",
    permissions: [
      // Purchase management
      ...getModulePermissions("module_purchase"),
      ...getModulePermissions("module_purchase_order"),
      ...getModulePermissions("module_purchase_return"),
      // Vendor management
      ...getModulePermissions("module_suppliers"),
      ...getModulePermissions("module_supplier_advance"),
      // Purchase request
      "purchase_request_view", "purchase_request_add", "purchase_request_edit", "purchase_request_delete",
      // Stock view
      ...getModulePermissions("module_items").filter(p => p.includes("view")),
      "item_compare_view",
      "report_stock", "report_stock_ledger", "report_supplier_items",
      // Enquiry check
      "enquiry_view",
      // Purchase quotation
      "purchase_quotation_view", "purchase_quotation_add", "purchase_quotation_edit", "purchase_quotation_delete",
      // Purchase reports
      "report_purchase", "report_purchase_register", "report_purchase_return", "report_purchase_payments",
      "report_purchase_tax", "report_purchase_gst", "report_hsn_summary"
    ],
    color: "bg-indigo-500"
  },
  {
    id: "admin_sales_coordinator",
    name: "Admin & Sales Coordinator",
    code: "ASC01",
    grade: "C4",
    description: "Enquiry check, process to get purchase rate, process to quotation team",
    permissions: [
      // Enquiry management
      "enquiry_view", "enquiry_add", "enquiry_edit", "enquiry_delete",
      // Quotation process
      ...getModulePermissions("module_quotation").filter(p => !p.includes("delete")),
      // Purchase rate checking
      ...getModulePermissions("module_purchase").filter(p => p.includes("view")),
      ...getModulePermissions("module_items").filter(p => p.includes("view")),
      "item_compare_view",
      // Customer view
      ...getModulePermissions("module_customers").filter(p => p.includes("view")),
      // Supplier view
      ...getModulePermissions("module_suppliers").filter(p => p.includes("view")),
      // Reports for coordination
      "report_customer_orders", "report_enquiry_status", "report_quotation_items",
      "report_sales_item", "report_purchase_order_item"
    ],
    color: "bg-pink-500"
  }
];

const permissionCategories: PermissionCategory[] = [
  { value: "all", label: "All" },
  { value: "inventory", label: "Inventory" },
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
  { value: "accounts", label: "Accounts" },
  { value: "reports", label: "Reports" },
  { value: "others", label: "Others" },
];

const permissionLabels: Record<string, string> = {
  // Basic actions
  view: "View",
  add: "Add",
  edit: "Edit",
  delete: "Delete",

  // Special permissions
  import_customers: "Import Customers",
  import_suppliers: "Import Suppliers",
  import_items: "Import Items",
  print_labels: "Print Labels",
  show_all_users_sales_invoices: "Show all users Sales Invoices",
  show_item_purchase_price: "Show Item Purchase Price (While making invoice)",
  show_all_users_quotations: "Show all users Quotations",
  show_all_users_sales_return_invoices: "Show all users Sales Return Invoices",
  show_all_users_purchase_invoices: "Show all users Purchase Invoices",
  show_all_users_purchase_return_invoices: "Show all users Purchase Return Invoices",
  show_all_users_expenses: "Show All Users Expenses",
  
  // Category permissions
  item_category_view: "Category View",
  item_category_add: "Category Add",
  item_category_edit: "Category Edit",
  item_category_delete: "Category Delete",
  expense_category_view: "Category View",
  expense_category_add: "Category Add",
  expense_category_edit: "Category Edit",
  expense_category_delete: "Category Delete",
  
  // Item permissions
  expense_item_view: "view Expense Item",
  expense_item_add: "Add Expense Item",
  expense_item_edit: "Edit Expense Item",
  expense_item_delete: "Delete Expense Item",
  
  // Payment permissions
  sales_payments_view: "Sales Payments View",
  sales_payments_add: "Sales Payments Add",
  sales_payments_delete: "Sales Payments Delete",
  sales_return_payments_view: "Sales Return Payments View",
  sales_return_payments_add: "Sales Return Payments Add",
  sales_return_payments_delete: "Sales Return Payments Delete",
  purchase_payments_view: "Purchase Payments View",
  purchase_payments_add: "Purchase Payments Add",
  purchase_payments_delete: "Purchase Payments Delete",
  purchase_return_payments_view: "Purchase Return Payments View",
  purchase_return_payments_add: "Purchase Return Payments Add",
  purchase_return_payments_delete: "Purchase Return Payments Delete",
  
  // Accounts permissions
  money_deposit_view: "View Money Deposit",
  money_deposit_add: "Add Money Deposit ",
  money_deposit_edit: "Edit Money Deposit",
  money_deposit_delete: "Delete Money Deposit",
  cash_flow_view: "View Cash Flow",
  cash_flow_add: "Add Cash Flow",
  cash_flow_edit: "Edit Cash Flow",
  cash_flow_delete: "Delete Cash Flow",
  money_transfer_view: "View Money Transfer",
  money_transfer_add: "Add Money Transfer",
  money_transfer_edit: "Edit Money Transfer",
  money_transfer_delete: "Delete Money Transfer",
  chart_of_accounts_view: "View Chart of Accounts",
  chart_of_accounts_add: "Add Chart of Accounts",
  chart_of_accounts_edit: "Edit Chart of Accounts",
  chart_of_accounts_delete: "Delete Chart of Accounts",
  entries_view: "View Entries",
  entries_add: "Add Entries",
  entries_edit: "Edit Entries",
  entries_delete: "Delete Entries",
  cash_transactions: "Cash Transactions",
  
  // Customer/Supplier advance
  customer_advance_view: "View",
  customer_advance_add: "Add",
  customer_advance_edit: "Edit",
  customer_advance_delete: "Delete",
  supplier_advance_view: "View",
  supplier_advance_add: "Add",
  supplier_advance_edit: "Edit",
  supplier_advance_delete: "Delete",
  
  // Store permissions
  store_edit: "Edit",
  
  // Dashboard permissions
  dashboard_view: "View Dashboard",
  dashboard_info1: "Info Box 1",
  dashboard_info2: "Info Box 2",
  dashboard_chart: "Purchase and Sales Chart",
  dashboard_items: "Recent Items",
  dashboard_stock_alert: "Stock Alert",
  dashboard_trending: "Trending Items",
  dashboard_recent_sales: "Recent Sales",
};

// Add new permission labels for added permissions
const additionalPermissionLabels: Record<string, string> = {
  // Approval permissions
  "customer_approval": "Customer Creation Approval",
  "vendor_approval": "Vendor Creation Approval",
  "leave_approval": "Leave Approval",
  "permission_approval": "Permission Approval",
  
  // Enquiry permissions
  "enquiry_view": "View Enquiries",
  "enquiry_add": "Add Enquiry",
  "enquiry_edit": "Edit Enquiry",
  "enquiry_delete": "Delete Enquiry",
  
  // Purchase permissions
  "purchase_request_view": "View Purchase Requests",
  "purchase_request_add": "Add Purchase Request",
  "purchase_request_edit": "Edit Purchase Request",
  "purchase_request_delete": "Delete Purchase Request",
  "purchase_quotation_view": "View Purchase Quotation",
  "purchase_quotation_add": "Add Purchase Quotation",
  "purchase_quotation_edit": "Edit Purchase Quotation",
  "purchase_quotation_delete": "Delete Purchase Quotation",
  
  // Item compare
  "item_compare_view": "View Item Compare",
  "item_compare_add": "Add Item Compare",
  
  // Visit and travel
  "visit_plan_view": "View Visit Plan",
  "visit_plan_add": "Add Visit Plan",
  "visit_plan_edit": "Edit Visit Plan",
  "travel_log_view": "View Travel Log",
  "travel_log_add": "Add Travel Log",
  "travel_log_edit": "Edit Travel Log",
  
  // Additional reports
  "report_enquiry_status": "Enquiry Status Report",
  "report_customer_orders": "Customer Orders Report",
};

// Merge with existing permission labels
Object.assign(permissionLabels, additionalPermissionLabels);

export default function CreateDesignationPage() {
  const router = useRouter();
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const [indeterminateModules, setIndeterminateModules] = useState<Record<string, boolean>>({});
  const [showPredefinedRoles, setShowPredefinedRoles] = useState(true);
  const [selectedPredefinedRole, setSelectedPredefinedRole] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    code: "",
    grade: "",
    description: "",
    permissions: [],
  });

  // Initialize all modules as unchecked
  useEffect(() => {
    const initialActiveModules: Record<string, boolean> = {};
    const initialIndeterminateModules: Record<string, boolean> = {};
    
    permissionModules.forEach(module => {
      initialActiveModules[module.id] = false;
      initialIndeterminateModules[module.id] = false;
    });
    
    setActiveModules(initialActiveModules);
    setIndeterminateModules(initialIndeterminateModules);
  }, []);

  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle predefined role selection
  const handlePredefinedRoleSelect = (role: PredefinedRole) => {
    if (role.permissions[0] === "all") {
      // For Super Admin - select all permissions
      const allPermissions = permissionModules.flatMap(m => m.permissions);
      // Also add all additional permissions
      const allAdditionalPermissions = Object.keys(additionalPermissionLabels);
      setFormData(prev => ({
        ...prev,
        name: role.name,
        code: role.code,
        grade: role.grade,
        description: role.description,
        permissions: [...new Set([...allPermissions, ...allAdditionalPermissions])],
      }));
      
      // Set all modules as active
      const newActiveModules: Record<string, boolean> = {};
      const newIndeterminateModules: Record<string, boolean> = {};
      
      permissionModules.forEach(module => {
        newActiveModules[module.id] = true;
        newIndeterminateModules[module.id] = false;
      });
      
      setActiveModules(newActiveModules);
      setIndeterminateModules(newIndeterminateModules);
    } else {
      setFormData(prev => ({
        ...prev,
        name: role.name,
        code: role.code,
        grade: role.grade,
        description: role.description,
        permissions: role.permissions,
      }));
      
      // Update module states based on selected permissions
      const newActiveModules: Record<string, boolean> = {};
      const newIndeterminateModules: Record<string, boolean> = {};
      
      permissionModules.forEach(module => {
        const modulePerms = module.permissions;
        const selectedModulePerms = role.permissions.filter(p => modulePerms.includes(p));
        
        if (selectedModulePerms.length === 0) {
          newActiveModules[module.id] = false;
          newIndeterminateModules[module.id] = false;
        } else if (selectedModulePerms.length === modulePerms.length) {
          newActiveModules[module.id] = true;
          newIndeterminateModules[module.id] = false;
        } else {
          newActiveModules[module.id] = false;
          newIndeterminateModules[module.id] = true;
        }
      });
      
      setActiveModules(newActiveModules);
      setIndeterminateModules(newIndeterminateModules);
    }
    
    setSelectedPredefinedRole(role.id);
    setShowPredefinedRoles(false);
  };

  // Handle category selection
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  // Handle select all permissions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    
    if (isChecked) {
      // Get all permissions from visible modules
      const allPermissions: string[] = [];
      const newActiveModules: Record<string, boolean> = { ...activeModules };
      const newIndeterminateModules: Record<string, boolean> = { ...indeterminateModules };
      
      getVisibleModules().forEach(module => {
        newActiveModules[module.id] = true;
        newIndeterminateModules[module.id] = false;
        allPermissions.push(...module.permissions);
      });
      
      setActiveModules(newActiveModules);
      setIndeterminateModules(newIndeterminateModules);
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...allPermissions])],
      }));
    } else {
      // Get all permissions from visible modules to remove
      const permissionsToRemove: string[] = [];
      const newActiveModules: Record<string, boolean> = { ...activeModules };
      const newIndeterminateModules: Record<string, boolean> = { ...indeterminateModules };
      
      getVisibleModules().forEach(module => {
        newActiveModules[module.id] = false;
        newIndeterminateModules[module.id] = false;
        permissionsToRemove.push(...module.permissions);
      });
      
      setActiveModules(newActiveModules);
      setIndeterminateModules(newIndeterminateModules);
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !permissionsToRemove.includes(p)),
      }));
    }
    
    // Clear predefined role selection when manually editing
    setSelectedPredefinedRole(null);
  };

  // Handle module checkbox change
  const handleModuleChange = (moduleId: string, modulePermissions: string[]) => {
    const isCurrentlyActive = activeModules[moduleId];
    const isCurrentlyIndeterminate = indeterminateModules[moduleId];
    
    if (isCurrentlyActive || isCurrentlyIndeterminate) {
      // Uncheck module and all its permissions
      setActiveModules(prev => ({ ...prev, [moduleId]: false }));
      setIndeterminateModules(prev => ({ ...prev, [moduleId]: false }));
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !modulePermissions.includes(p)),
      }));
    } else {
      // Check module and all its permissions
      setActiveModules(prev => ({ ...prev, [moduleId]: true }));
      setIndeterminateModules(prev => ({ ...prev, [moduleId]: false }));
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...modulePermissions])],
      }));
    }
    
    // Clear predefined role selection when manually editing
    setSelectedPredefinedRole(null);
  };

  // Handle individual permission change
  const handlePermissionChange = (permission: string, moduleId: string, modulePermissions: string[]) => {
    const isCurrentlyChecked = formData.permissions.includes(permission);
    const newPermissions = isCurrentlyChecked
      ? formData.permissions.filter(p => p !== permission)
      : [...formData.permissions, permission];
    
    setFormData(prev => ({
      ...prev,
      permissions: newPermissions,
    }));
    
    // Update module checkbox state
    const modulePerms = modulePermissions;
    const checkedModulePerms = newPermissions.filter(p => modulePerms.includes(p));
    
    if (checkedModulePerms.length === 0) {
      setActiveModules(prev => ({ ...prev, [moduleId]: false }));
      setIndeterminateModules(prev => ({ ...prev, [moduleId]: false }));
    } else if (checkedModulePerms.length === modulePerms.length) {
      setActiveModules(prev => ({ ...prev, [moduleId]: true }));
      setIndeterminateModules(prev => ({ ...prev, [moduleId]: false }));
    } else {
      setActiveModules(prev => ({ ...prev, [moduleId]: false }));
      setIndeterminateModules(prev => ({ ...prev, [moduleId]: true }));
    }
    
    // Clear predefined role selection when manually editing
    setSelectedPredefinedRole(null);
  };

  // Get visible modules based on selected category
  const getVisibleModules = () => {
    if (selectedCategory === "all") {
      return permissionModules;
    }
    return permissionModules.filter(module => 
      module.category.split(',').includes(selectedCategory)
    );
  };

  // Get permission display label
  const getPermissionLabel = (permission: string): string => {
    const key = permission.toLowerCase();
    
    // Check for exact match first
    if (permissionLabels[key]) {
      return permissionLabels[key];
    }
    
    // Try to extract the permission type and module
    const parts = permission.split('_');
    
    // Handle report permissions
    if (permission.startsWith('report_')) {
      const reportName = permission.replace('report_', '').replace(/_/g, ' ');
      return `${reportName.charAt(0).toUpperCase()}${reportName.slice(1)} Report`;
    }
    
    // Handle other permissions by capitalizing
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert("Role name is required");
      return;
    }
    
    setLoading(true);
    
    try {
      // First create the designation
      const designationData = {
        name: formData.name,
        code: formData.code,
        grade: formData.grade,
        description: formData.description,
      };
      
      const designationResponse = await api.post(
        `/companies/${company?.id}/payroll/designations`,
        designationData
      );
      
      const designationId = designationResponse.data.id;
      
      // Then assign permissions (if your API supports it)
      if (formData.permissions.length > 0) {
        try {
          await api.post(
            `/companies/${company?.id}/roles`,
            {
              name: formData.name,
              description: formData.description,
              permissions: formData.permissions,
              designation_id: designationId,
            }
          );
        } catch (permissionError) {
          console.warn("Could not assign permissions:", permissionError);
          // Continue even if permissions fail, as designation was created
        }
      }
      
      router.push("/designations");
      router.refresh();
      
    } catch (error) {
      console.error("Error creating role:", error);
      alert("Failed to create role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Check if all visible permissions are selected
  const isAllVisiblePermissionsSelected = () => {
    const visibleModules = getVisibleModules();
    const allVisiblePermissions = visibleModules.flatMap(m => m.permissions);
    return allVisiblePermissions.every(p => formData.permissions.includes(p));
  };

  // Check if some visible permissions are selected
  const isSomeVisiblePermissionsSelected = () => {
    const visibleModules = getVisibleModules();
    const allVisiblePermissions = visibleModules.flatMap(m => m.permissions);
    const selectedVisiblePermissions = allVisiblePermissions.filter(p => formData.permissions.includes(p));
    return selectedVisiblePermissions.length > 0 && selectedVisiblePermissions.length < allVisiblePermissions.length;
  };

  return (
    <>
      <Breadcrumb pageName="Create New Role" />

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
          <h3 className="text-xl font-semibold text-black dark:text-white">
            Role Information
          </h3>
        </div>
        
        <div className="p-6">
        {showPredefinedRoles && (
  <div className="mb-8">
    <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
      Select Predefined Role Template
    </h3>
    <p className="mb-6 text-gray-600 dark:text-gray-300">
      Choose from our standard role templates or create a custom role
    </p>
    
    {/* Simplified Role Cards - Icon + Name only */}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {predefinedRoles.map((role) => (
        <div
          key={role.id}
          className={`rounded-lg border-2 p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
            selectedPredefinedRole === role.id
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 dark:border-strokedark'
          }`}
          onClick={() => handlePredefinedRoleSelect(role)}
        >
          <div className="flex items-center gap-3">
            {/* Role Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${role.color} flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">
                {role.name.charAt(0)}
              </span>
            </div>
            
            {/* Role Name */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-black dark:text-white truncate">
                {role.name}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {role.permissions[0] === "all" 
                  ? "All permissions" 
                  : `${role.permissions.length} permissions`}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
    
    <div className="mt-8 pt-6 border-t border-stroke dark:border-strokedark">
      <button
        type="button"
        onClick={() => setShowPredefinedRoles(false)}
        className="rounded-lg border border-primary px-6 py-3 font-medium text-primary hover:bg-primary hover:text-white"
      >
        Create Custom Role Instead
      </button>
    </div>
  </div>
)}

          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  {selectedPredefinedRole ? 'Edit Selected Role' : 'Custom Role Details'}
                </h3>
                {!showPredefinedRoles && (
                  <button
                    type="button"
                    onClick={() => setShowPredefinedRoles(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    ← Back to Templates
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-3 block text-black dark:text-white">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                    placeholder="Enter Role Name"
                    required
                  />
                </div>
                
                <div>
                  <label className="mb-3 block text-black dark:text-white">
                    Code
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                    placeholder="Enter Code (Optional)"
                  />
                </div>
                
                <div>
                  <label className="mb-3 block text-black dark:text-white">
                    Grade
                  </label>
                  <input
                    type="text"
                    name="grade"
                    value={formData.grade}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                    placeholder="Enter Grade (Optional)"
                  />
                </div>
                
                <div>
                  <label className="mb-3 block text-black dark:text-white">
                    Selected Permissions Count
                  </label>
                  <div className="rounded-lg border-[1.5px] border-stroke bg-gray-50 px-5 py-3 dark:border-form-strokedark dark:bg-gray-800">
                    <span className="font-bold text-primary">
                      {formData.permissions.length} permissions selected
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <label className="mb-3 block text-black dark:text-white">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  placeholder="Enter Description (Optional)"
                />
              </div>
            </div>

            {/* Permissions Section */}
            <div className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
                Assign Permissions to Role
              </h3>

              {/* Category Buttons */}
              <div className="mb-6 flex flex-wrap gap-2">
                {permissionCategories.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => handleCategorySelect(category.value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedCategory === category.value
                        ? "bg-primary text-white"
                        : "border border-primary bg-transparent text-primary hover:bg-primary hover:text-white"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              {/* Select All Checkbox */}
              <div className="mb-6 flex justify-between items-center">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="checkAll"
                    checked={isAllVisiblePermissionsSelected()}
                    ref={input => {
                      if (input) {
                        input.indeterminate = isSomeVisiblePermissionsSelected();
                      }
                    }}
                    onChange={handleSelectAll}
                    className="h-5 w-5 rounded border-gray-300 bg-gray-100 text-primary focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label
                    htmlFor="checkAll"
                    className="ml-2 font-bold text-black dark:text-white"
                  >
                    Select All Visible Permissions
                  </label>
                </div>
                {selectedPredefinedRole && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Using template: {predefinedRoles.find(r => r.id === selectedPredefinedRole)?.name}
                  </span>
                )}
              </div>

              {/* Permissions Table */}
              <div className="overflow-x-auto rounded-lg border border-stroke dark:border-strokedark">
                <table className="w-full">
                  <thead className="bg-gray-2 dark:bg-meta-4">
                    <tr>
                      <th className="px-6 py-4 text-left font-medium text-black dark:text-white">
                        #
                      </th>
                      <th className="px-6 py-4 text-left font-medium text-black dark:text-white">
                        Modules
                      </th>
                      <th className="px-6 py-4 text-left font-medium text-black dark:text-white">
                        Specific Permissions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVisibleModules().map((module, index) => (
                      <tr 
                        key={module.id}
                        className="border-b border-stroke transition-colors hover:bg-gray-2/50 dark:border-strokedark dark:hover:bg-meta-4/30"
                      >
                        <td className="px-6 py-4">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id={module.id}
                              checked={activeModules[module.id] || false}
                              ref={input => {
                                if (input) {
                                  input.indeterminate = indeterminateModules[module.id];
                                }
                              }}
                              onChange={() => handleModuleChange(module.id, module.permissions)}
                              className="h-5 w-5 rounded border-gray-300 bg-gray-100 text-primary focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                            />
                            <label
                              htmlFor={module.id}
                              className="ml-2 font-bold text-black dark:text-white"
                            >
                              {module.name}
                            </label>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {module.permissions.map((permission) => (
                              <div key={permission} className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`permission_${permission}`}
                                  checked={formData.permissions.includes(permission)}
                                  onChange={() => handlePermissionChange(permission, module.id, module.permissions)}
                                  className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-primary focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                                />
                                <label
                                  htmlFor={`permission_${permission}`}
                                  className="ml-2 text-sm text-black dark:text-white"
                                >
                                  {getPermissionLabel(permission)}
                                </label>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.push("/payroll/designations")}
                className="rounded-lg border border-stroke px-6 py-3 font-medium text-black hover:bg-gray-1 dark:border-strokedark dark:text-white dark:hover:bg-meta-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Create Role"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}