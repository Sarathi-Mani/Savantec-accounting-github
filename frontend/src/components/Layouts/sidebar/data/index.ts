import * as Icons from "../icons";

export const NAV_DATA = [
  {
    label: "OVERVIEW",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: Icons.HomeIcon,
        items: [],
      },
      {
        title: "Business Overview",
        url: "/business",
        icon: Icons.PieChart,
        items: [],
      },
      {
        title: "Quick Entry",
        url: "/quick-entry",
        icon: Icons.FourCircle,
        items: [],
      },
    ],
  },
  {
    label: "USERS",
    items: [
      {
        title: "Employees",
        icon: Icons.Users,
        items: [
          { title: "All Employees", url: "/payroll/employees" },
          { title: "Add Employee", url: "/payroll/employees/new" },
          { title: "Departments", url: "/payroll/departments" },
          { title: "Roles", url: "/payroll/designations" },
        ],
      },
    ]
  },
  {
    label : "PRODUCTS",
    items : [
      {
        title: "brand",
        icon: Icons.Tags,
        items: [
          { title: "All Brands", url: "/products/brands"},
          { title: "Add Brand", url: "/products/brands/new"}
        ]
      },
      {
        title: "Categories",
        icon: Icons.Folder,
        items: [
          { title: "All Categories", url: "/products/categories"},
          { title: "Add Category", url: "/products/categories/new"}
        ]
      },
      {
        title: "Products",
        icon: Icons.FourCircle,
        items: [
          { title: "All Products", url: "/products" },
          { title: "Stock Groups", url: "/inventory/groups" },
          { title: "Price Levels", url: "/inventory/price-levels" },
          { title: "Discounts", url: "/inventory/discounts" },
        ],
      },
    ]
  },
  {
    label: "SALES PIPELINE",
    items: [
      {
        title: "Sales Dashboard",
        url: "/sales",
        icon: Icons.PieChart,
        items: [],
      },
      {
        title: "Enquiries",
        icon: Icons.MessageSquare,
        items: [
          { title: "All Enquiries", url: "/enquiries" },
          { title: "New Enquiry", url: "/enquiries/new" },
        ],
      },
      {
        title: "Sales Tickets",
        url: "/sales/tickets",
        icon: Icons.Ticket,
        items: [],
      },
      {
        title: "Contacts",
        url: "/contacts",
        icon: Icons.UserCircle,
        items: [],
      },
    ],
  },
  {
    label: "SALES",
    items: [
      {
        title: "Quotations",
        icon: Icons.FileText,
        items: [
          { title: "All Quotations", url: "/quotations" },
          { title: "Create Quotation", url: "/quotations/new" },
        ],
      },
      {
        title: "Invoices",
        icon: Icons.Invoice,
        items: [
          { title: "All Invoices", url: "/invoices" },
          { title: "Create Invoice", url: "/invoices/new" },
          { title: "Credit Notes", url: "/invoices/credit-notes" },
        ],
      },
      {
        title: "Delivery Challans",
        icon: Icons.Truck,
        items: [
          { title: "All Challans", url: "/delivery-challans" },
          { title: "DC Out (Dispatch)", url: "/delivery-challans/new?type=dc_out" },
          { title: "DC In (Returns)", url: "/delivery-challans/new?type=dc_in" },
        ],
      },
      {
        title: "Customers",
        url: "/customers",
        icon: Icons.User,
        items: [],
      },
      {
        title: "Sales Orders",
        url: "/orders/sales",
        icon: Icons.ListOrdered,
        items: [],
      },
      {
        title: "Delivery Notes",
        url: "/delivery-notes",
        icon: Icons.Truck,
        items: [],
      },
      {
        title: "Bill Allocation",
        url: "/accounting/bill-allocation",
        icon: Icons.Receipt,
        items: [],
      },
    ],
  },
  {
    label: "PURCHASE",
    items: [
      {
        title: "Purchase Invoices",
        icon: Icons.ReceiptText,
        items: [
          { title: "All Bills", url: "/purchase/invoices" },
          { title: "Create Bill", url: "/purchase/invoices/new" },
          { title: "Debit Notes", url: "/purchase/debit-notes" },
        ],
      },
      {
        title: "Vendors",
        url: "/vendors",
        icon: Icons.Building,
        items: [],
      },
      {
        title: "Purchase Orders",
        url: "/orders/purchase",
        icon: Icons.ShoppingCart,
        items: [],
      },
      {
        title: "Receipt Notes",
        url: "/receipt-notes",
        icon: Icons.Download,
        items: [],
      },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      {
        title: "Stock Overview",
        url: "/inventory",
        icon: Icons.Box,
        items: [],
      },
      {
        title: "Alternative Products",
        icon: Icons.ArrowUpDown,
        items: [
          { title: "All Alternatives", url: "/inventory/alternative-products" },
          { title: "New Alternative", url: "/inventory/alternative-products/new" },
        ],
      },
      {
        title: "Stock Movements",
        icon: Icons.ArrowUpDown,
        items: [
          { title: "Stock In", url: "/inventory/stock-in" },
          { title: "Stock Out", url: "/inventory/stock-out" },
          { title: "Stock Transfer", url: "/inventory/transfer" },
        ],
      },
      {
        title: "Godowns",
        url: "/inventory/godowns",
        icon: Icons.Warehouse,
        items: [],
      },
      {
        title: "Serial Numbers",
        url: "/inventory/serial-numbers",
        icon: Icons.Barcode,
        items: [],
      },
      {
        title: "Manufacturing",
        icon: Icons.Factory,
        items: [
          { title: "Production Orders", url: "/inventory/manufacturing" },
          { title: "Bill of Materials", url: "/inventory/bom" },
        ],
      },
      {
        title: "Stock Verification",
        url: "/inventory/verification",
        icon: Icons.CheckSquare,
        items: [],
      },
      {
        title: "Reorder Report",
        url: "/inventory/reorder-report",
        icon: Icons.AlertTriangle,
        items: [],
      },
    ],
  },
  {
    label: "BANKING",
    items: [
      {
        title: "Bank Reconciliation",
        url: "/banking/reconciliation",
        icon: Icons.Bank,
        items: [],
      },
      {
        title: "Cheque Management",
        icon: Icons.Cheque,
        items: [
          { title: "Cheque Books", url: "/banking/cheques/books" },
          { title: "Issued Cheques", url: "/banking/cheques/issued" },
          { title: "Received Cheques", url: "/banking/cheques/received" },
        ],
      },
      {
        title: "Post-Dated Cheques",
        url: "/banking/pdc",
        icon: Icons.Calendar,
        items: [],
      },
      {
        title: "Recurring Transactions",
        url: "/banking/recurring",
        icon: Icons.Repeat,
        items: [],
      },
      {
        title: "Cash Flow Forecast",
        url: "/banking/cash-forecast",
        icon: Icons.TrendingUp,
        items: [],
      },
      {
        title: "Bank Import",
        url: "/accounting/bank-import",
        icon: Icons.Download,
        items: [],
      },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      {
        title: "Monthly View",
        url: "/accounting/monthly",
        icon: Icons.Calendar,
        items: [],
      },
      {
        title: "Transactions",
        icon: Icons.ScrollText,
        items: [
          { title: "All Transactions", url: "/accounting/transactions" },
          { title: "Journal Entry", url: "/accounting/transactions/new" },
          { title: "Payment", url: "/accounting/payment" },
          { title: "Receipt", url: "/accounting/receipt" },
          { title: "Contra", url: "/accounting/contra" },
        ],
      },
      {
        title: "Chart of Accounts",
        url: "/accounting/chart-of-accounts",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Period Locks",
        url: "/accounting/period-locks",
        icon: Icons.Lock,
        items: [],
      },
      {
        title: "Audit Log",
        url: "/accounting/audit-log",
        icon: Icons.ClipboardCheck,
        items: [],
      },
    ],
  },
  {
    label: "PAYROLL",
    items: [
      {
        title: "Payroll Dashboard",
        url: "/payroll",
        icon: Icons.Rupee,
        items: [],
      },
      {
        title: "Attendance",
        icon: Icons.UserCheck,
        items: [
          { title: "Mark Attendance", url: "/payroll/attendance" },
          { title: "Attendance Report", url: "/payroll/attendance/report" },
        ],
      },
      {
        title: "Leave Management",
        icon: Icons.CalendarX,
        items: [
          { title: "Leave Types", url: "/payroll/leaves/types" },
          { title: "Leave Balances", url: "/payroll/leaves/balances" },
          { title: "Applications", url: "/payroll/leaves/applications" },
        ],
      },
      {
        title: "Run Payroll",
        url: "/payroll/run",
        icon: Icons.Play,
        items: [],
      },
      {
        title: "Payslips",
        url: "/payroll/payslips",
        icon: Icons.FileText,
        items: [],
      },
      {
        title: "Loans & Advances",
        url: "/payroll/loans",
        icon: Icons.Coins,
        items: [],
      },
      {
        title: "Statutory Reports",
        icon: Icons.Percent,
        items: [
          { title: "PF Report", url: "/payroll/reports?type=pf" },
          { title: "ESI Report", url: "/payroll/reports?type=esi" },
          { title: "PT Report", url: "/payroll/reports?type=pt" },
          { title: "TDS Report", url: "/payroll/reports?type=tds" },
          { title: "Form 16", url: "/payroll/form16" },
        ],
      },
      {
        title: "Payroll Settings",
        url: "/payroll/settings",
        icon: Icons.Settings,
        items: [],
      },
    ],
  },
  {
    label: "REPORTS",
    items: [
      {
        title: "Books & Registers",
        icon: Icons.BookOpen,
        items: [
          { title: "Day Book", url: "/reports/day-book" },
          { title: "Journal", url: "/reports/journal" },
          { title: "Ledger", url: "/reports/ledger" },
          { title: "Cash Book", url: "/reports/cash-bank-book?type=cash" },
          { title: "Bank Book", url: "/reports/cash-bank-book?type=bank" },
        ],
      },
      {
        title: "Financial Reports",
        icon: Icons.Scale,
        items: [
          { title: "Trial Balance", url: "/accounting/reports/trial-balance" },
          { title: "Profit & Loss", url: "/accounting/reports/profit-loss" },
          { title: "Balance Sheet", url: "/accounting/reports/balance-sheet" },
          { title: "Cash Flow", url: "/accounting/reports/cash-flow" },
          { title: "Ratio Analysis", url: "/reports/ratios" },
        ],
      },
      {
        title: "Outstanding Reports",
        icon: Icons.Clock,
        items: [
          { title: "Receivables Aging", url: "/reports/aging?type=receivables" },
          { title: "Payables Aging", url: "/reports/aging?type=payables" },
          { title: "Outstanding Summary", url: "/reports/outstanding" },
        ],
      },
      {
        title: "Inventory Reports",
        icon: Icons.Box,
        items: [
          { title: "Stock Summary", url: "/inventory/warehouse-report" },
          { title: "Stock Valuation", url: "/reports/stock-valuation" },
          { title: "Movement Analysis", url: "/reports/stock-movement" },
        ],
      },
      {
        title: "GST Reports",
        icon: Icons.Tax,
        items: [
          { title: "GSTR-1", url: "/gst-reports/gstr1" },
          { title: "GSTR-3B", url: "/gst-reports/gstr3b" },
          { title: "HSN Summary", url: "/gst/hsn-summary" },
          { title: "ITC Reconciliation", url: "/gst/itc" },
          { title: "E-Invoice", url: "/gst/e-invoice" },
          { title: "E-Way Bill", url: "/gst/eway-bill" },
        ],
      },
      {
        title: "Budget Reports",
        icon: Icons.Calculator,
        items: [
          { title: "Budget vs Actual", url: "/accounting/budgets" },
          { title: "Cost Center Analysis", url: "/accounting/cost-centers" },
        ],
      },
      {
        title: "Sales Analysis",
        icon: Icons.BarChart,
        items: [
          { title: "Sales Summary", url: "/reports/sales-analysis" },
          { title: "Customer-wise Sales", url: "/reports/sales-by-customer" },
          { title: "Product-wise Sales", url: "/reports/sales-by-product" },
        ],
      },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      {
        title: "Company Profile",
        url: "/company",
        icon: Icons.Building,
        items: [],
      },
      {
        title: "Bank Accounts",
        url: "/company/bank-accounts",
        icon: Icons.Bank,
        items: [],
      },
      {
        title: "Inventory Settings",
        url: "/company/inventory-settings",
        icon: Icons.Settings,
        items: [],
      },
      {
        title: "Multi-Currency",
        icon: Icons.Currency,
        items: [
          { title: "Currencies", url: "/settings/currencies" },
          { title: "Exchange Rates", url: "/settings/exchange-rates" },
        ],
      },
      {
        title: "Templates",
        icon: Icons.FileSpreadsheet,
        items: [
          { title: "Print Templates", url: "/settings/templates" },
          { title: "Narration Templates", url: "/settings/narration-templates" },
          { title: "Account Mappings", url: "/settings/account-mappings" },
        ],
      },
      {
        title: "Import / Export",
        icon: Icons.ArrowUpDown,
        items: [
          { title: "Import Data", url: "/settings/import" },
          { title: "Export Data", url: "/settings/export" },
          { title: "Backup & Restore", url: "/settings/backup" },
        ],
      },
      {
        title: "Dashboard Settings",
        url: "/settings/dashboard",
        icon: Icons.Layout,
        items: [],
      },
      {
        title: "Notifications",
        url: "/settings/notifications",
        icon: Icons.Bell,
        items: [],
      },
    ],
  },
];
