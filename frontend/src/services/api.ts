import axios from "axios";

/**
 * Extract error message from API error response
 * Handles both string errors and Pydantic validation error arrays
 */
export function getErrorMessage(error: any, fallback: string = "An error occurred"): string {
  const detail = error.response?.data?.detail;
  
  if (Array.isArray(detail)) {
    // Pydantic validation errors come as array of objects
    const firstError = detail[0];
    return firstError?.msg || firstError?.message || fallback;
  } else if (typeof detail === "string") {
    return detail;
  } else if (typeof detail === "object" && detail?.msg) {
    return detail.msg;
  }
  
  return error.message || fallback;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        localStorage.removeItem("company_id");
        window.location.href = "/auth/sign-in";
      }
    }
    return Promise.reject(error);
  }
);

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  branch?: string;
  upi_id?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  opening_balance: number;
  current_balance: number;
  linked_account_id?: string;
}

export interface Company {
  id: string;
  name: string;
  trade_name?: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  email?: string;
  phone?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  country: string;
  business_type?: string;
  logo_url?: string;
  signature_url?: string;
  invoice_prefix: string;
  invoice_counter: number;
  invoice_terms?: string;
  invoice_notes?: string;
  default_bank_id?: string;
  auto_reduce_stock?: boolean;
  warehouse_priorities?: { priority_order: string[] };
  is_active: boolean;
  created_at: string;
  updated_at: string;
  bank_accounts: BankAccount[];
}

export interface DashboardSummary {
  company: {
    id: string;
    name: string;
    gstin: string;
  };
  invoices: {
    total: number;
    current_month: number;
  };
  revenue: {
    total: number;
    current_month: number;
    pending: number;
    paid: number;
  };
  overdue: {
    count: number;
    amount: number;
  };
  gst: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  trade_name?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_state_code?: string;
  billing_pincode?: string;
  billing_country: string;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_state_code?: string;
  shipping_pincode?: string;
  shipping_country: string;
  customer_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  page: number;
  page_size: number;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  sku?: string;
  hsn_code?: string;
  unit_price: number;
  unit: string;
  gst_rate: string;
  is_inclusive: boolean;
  is_service: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Stock info (unified model - products include inventory)
  current_stock?: number;
  min_stock_level?: number;
  opening_stock?: number;
  standard_cost?: number;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  page_size: number;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string;
  description: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  taxable_amount: number;
  total_amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number?: string;
  upi_transaction_id?: string;
  notes?: string;
  is_verified: boolean;
  verified_at?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id?: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  invoice_type: string;
  place_of_supply?: string;
  place_of_supply_name?: string;
  is_reverse_charge: boolean;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  payment_link?: string;
  upi_qr_data?: string;
  notes?: string;
  terms?: string;
  irn?: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
  payments: Payment[];
  customer_name?: string;
  customer_gstin?: string;
  customer_email?: string;
  customer_phone?: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  page_size: number;
  total_amount: number;
  total_paid: number;
  total_pending: number;
}

export interface GSTSummary {
  month: number;
  year: number;
  total_invoices: number;
  total_taxable_value: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_cess: number;
  total_tax: number;
}

export interface GSTR1Report {
  gstin: string;
  fp: string;
  b2b: any[];
  b2cl: any[];
  b2cs: any[];
  hsn: any;
  doc_issue: any;
}

export interface GSTR3BReport {
  gstin: string;
  ret_period: string;
  sup_details: any;
  inter_sup: any;
  itc_elg: any;
}

// Auth API
export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await api.post("/auth/login", data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<TokenResponse> => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post("/auth/logout");
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post("/auth/forgot-password", null, { params: { email } });
  },

  updateProfile: async (data: { full_name?: string; phone?: string }): Promise<User> => {
    const response = await api.put("/auth/me", data);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};

// Companies API
export const companiesApi = {
  list: async (): Promise<Company[]> => {
    const response = await api.get("/companies");
    return response.data;
  },

  get: async (companyId: string): Promise<Company> => {
    const response = await api.get(`/companies/${companyId}`);
    return response.data;
  },

  create: async (data: Partial<Company>): Promise<Company> => {
    const response = await api.post("/companies", data);
    return response.data;
  },

  update: async (companyId: string, data: Partial<Company>): Promise<Company> => {
    const response = await api.put(`/companies/${companyId}`, data);
    return response.data;
  },

  delete: async (companyId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}`);
  },

  // Bank Accounts
  listBankAccounts: async (companyId: string): Promise<BankAccount[]> => {
    const response = await api.get(`/companies/${companyId}/bank-accounts`);
    return response.data;
  },

  addBankAccount: async (companyId: string, data: Partial<BankAccount>): Promise<BankAccount> => {
    const response = await api.post(`/companies/${companyId}/bank-accounts`, data);
    return response.data;
  },

  getBankAccount: async (companyId: string, bankAccountId: string): Promise<BankAccount> => {
    const response = await api.get(`/companies/${companyId}/bank-accounts/${bankAccountId}`);
    return response.data;
  },

  updateBankAccount: async (companyId: string, bankAccountId: string, data: Partial<BankAccount>): Promise<BankAccount> => {
    const response = await api.put(`/companies/${companyId}/bank-accounts/${bankAccountId}`, data);
    return response.data;
  },

  deleteBankAccount: async (companyId: string, bankAccountId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/bank-accounts/${bankAccountId}`);
  },

  // Dev Reset - clears all business data
  devReset: async (companyId: string): Promise<{ message: string; deleted: Record<string, number>; preserved: string[] }> => {
    const response = await api.post(`/companies/${companyId}/dev-reset`);
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  getSummary: async (companyId: string): Promise<DashboardSummary> => {
    const response = await api.get(`/companies/${companyId}/dashboard/summary`);
    return response.data;
  },

  getRecentInvoices: async (companyId: string, limit = 5): Promise<Invoice[]> => {
    const response = await api.get(`/companies/${companyId}/dashboard/recent-invoices`, {
      params: { limit },
    });
    return response.data;
  },

  getOutstandingInvoices: async (companyId: string, limit = 10): Promise<Invoice[]> => {
    const response = await api.get(`/companies/${companyId}/dashboard/outstanding-invoices`, {
      params: { limit },
    });
    return response.data;
  },
};

// Invoices API
export const invoicesApi = {
  list: async (
    companyId: string,
    params?: {
      page?: number;
      page_size?: number;
      status?: string;
      customer_id?: string;
      from_date?: string;
      to_date?: string;
      search?: string;
    }
  ): Promise<InvoiceListResponse> => {
    const response = await api.get(`/companies/${companyId}/invoices`, { params });
    return response.data;
  },

  get: async (companyId: string, invoiceId: string): Promise<Invoice> => {
    const response = await api.get(`/companies/${companyId}/invoices/${invoiceId}`);
    return response.data;
  },

  create: async (companyId: string, data: any): Promise<Invoice> => {
    const response = await api.post(`/companies/${companyId}/invoices`, data);
    return response.data;
  },

  update: async (companyId: string, invoiceId: string, data: any): Promise<Invoice> => {
    const response = await api.put(`/companies/${companyId}/invoices/${invoiceId}`, data);
    return response.data;
  },

  finalize: async (companyId: string, invoiceId: string): Promise<Invoice> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/finalize`);
    return response.data;
  },

  cancel: async (companyId: string, invoiceId: string, reason?: string): Promise<Invoice> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/cancel`, 
      reason ? { reason } : undefined
    );
    return response.data;
  },

  delete: async (companyId: string, invoiceId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/invoices/${invoiceId}`);
  },

  refund: async (companyId: string, invoiceId: string, reason?: string, refundAmount?: number): Promise<Invoice> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/refund`, {
      reason,
      refund_amount: refundAmount,
    });
    return response.data;
  },

  void: async (companyId: string, invoiceId: string, reason?: string): Promise<Invoice> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/void`, 
      reason ? { reason } : undefined
    );
    return response.data;
  },

  writeOff: async (companyId: string, invoiceId: string, reason?: string): Promise<Invoice> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/write-off`, 
      reason ? { reason } : undefined
    );
    return response.data;
  },

  addItem: async (companyId: string, invoiceId: string, data: any): Promise<InvoiceItem> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/items`, data);
    return response.data;
  },

  removeItem: async (companyId: string, invoiceId: string, itemId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/invoices/${invoiceId}/items/${itemId}`);
  },

  recordPayment: async (companyId: string, invoiceId: string, data: any): Promise<Payment> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/payments`, data);
    return response.data;
  },

  listPayments: async (companyId: string, invoiceId: string): Promise<Payment[]> => {
    const response = await api.get(`/companies/${companyId}/invoices/${invoiceId}/payments`);
    return response.data;
  },

  downloadPdf: async (companyId: string, invoiceId: string): Promise<Blob> => {
    const response = await api.get(`/companies/${companyId}/invoices/${invoiceId}/pdf`, {
      responseType: "blob",
    });
    return response.data;
  },

  getQR: async (companyId: string, invoiceId: string) => {
    const response = await api.get(`/companies/${companyId}/invoices/${invoiceId}/qr`);
    return response.data;
  },

  markPaid: async (companyId: string, invoiceId: string, upiTransactionId?: string) => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/mark-paid`, null, {
      params: { upi_transaction_id: upiTransactionId },
    });
    return response.data;
  },

  allocateStock: async (companyId: string, invoiceId: string): Promise<{
    invoice_id: string;
    invoice_number: string;
    items_allocated: number;
    items_skipped: number;
    already_tracked: boolean;
    stock_finalized: boolean;
    message: string;
    allocations: Array<{
      item_id: string;
      description: string;
      allocation: Array<{ godown_id: string | null; quantity: number }>;
    }>;
  }> => {
    const response = await api.post(`/companies/${companyId}/invoices/${invoiceId}/allocate-stock`);
    return response.data;
  },
};

// Customers API
export const customersApi = {
  list: async (
    companyId: string,
    params?: {
      page?: number;
      page_size?: number;
      search?: string;
      customer_type?: string;
    }
  ): Promise<CustomerListResponse> => {
    const response = await api.get(`/companies/${companyId}/customers`, { params });
    return response.data;
  },

  search: async (companyId: string, q: string, limit = 10): Promise<Customer[]> => {
    const response = await api.get(`/companies/${companyId}/customers/search`, {
      params: { q, limit },
    });
    return response.data;
  },

  get: async (companyId: string, customerId: string): Promise<Customer> => {
    const response = await api.get(`/companies/${companyId}/customers/${customerId}`);
    return response.data;
  },

  create: async (companyId: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await api.post(`/companies/${companyId}/customers`, data);
    return response.data;
  },

  update: async (companyId: string, customerId: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await api.put(`/companies/${companyId}/customers/${customerId}`, data);
    return response.data;
  },

  delete: async (companyId: string, customerId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/customers/${customerId}`);
  },
};

// Vendors API (vendors use the Customer model)
export const vendorsApi = {
  list: async (
    companyId: string,
    params?: {
      page?: number;
      page_size?: number;
      search?: string;
    }
  ): Promise<CustomerListResponse> => {
    const response = await api.get(`/companies/${companyId}/vendors`, { params });
    return response.data;
  },

  search: async (companyId: string, q: string, limit = 10): Promise<Customer[]> => {
    const response = await api.get(`/companies/${companyId}/vendors/search`, {
      params: { q, limit },
    });
    return response.data;
  },

  get: async (companyId: string, vendorId: string): Promise<Customer> => {
    const response = await api.get(`/companies/${companyId}/vendors/${vendorId}`);
    return response.data;
  },

  create: async (companyId: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await api.post(`/companies/${companyId}/vendors`, data);
    return response.data;
  },

  update: async (companyId: string, vendorId: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await api.put(`/companies/${companyId}/vendors/${vendorId}`, data);
    return response.data;
  },

  delete: async (companyId: string, vendorId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/vendors/${vendorId}`);
  },
};

// Products API
export const productsApi = {
  list: async (
    companyId: string,
    params?: {
      page?: number;
      page_size?: number;
      search?: string;
      is_service?: boolean;
    }
  ): Promise<ProductListResponse> => {
    const response = await api.get(`/companies/${companyId}/products`, { params });
    return response.data;
  },

  search: async (companyId: string, q: string, limit = 10): Promise<Product[]> => {
    const response = await api.get(`/companies/${companyId}/products/search`, {
      params: { q, limit },
    });
    return response.data;
  },

  get: async (companyId: string, productId: string): Promise<Product> => {
    const response = await api.get(`/companies/${companyId}/products/${productId}`);
    return response.data;
  },

  create: async (companyId: string, data: Partial<Product>): Promise<Product> => {
    const response = await api.post(`/companies/${companyId}/products`, data);
    return response.data;
  },

  update: async (companyId: string, productId: string, data: Partial<Product>): Promise<Product> => {
    const response = await api.put(`/companies/${companyId}/products/${productId}`, data);
    return response.data;
  },

  delete: async (companyId: string, productId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/products/${productId}`);
  },
};

// GST API
export const gstApi = {
  getSummary: async (companyId: string, month: number, year: number): Promise<GSTSummary> => {
    const response = await api.get(`/companies/${companyId}/gst/summary`, {
      params: { month, year },
    });
    return response.data;
  },

  getGSTR1: async (companyId: string, month: number, year: number): Promise<GSTR1Report> => {
    const response = await api.get(`/companies/${companyId}/gst/gstr1`, {
      params: { month, year },
    });
    return response.data;
  },

  downloadGSTR1: async (companyId: string, month: number, year: number): Promise<Blob> => {
    const response = await api.get(`/companies/${companyId}/gst/gstr1/download`, {
      params: { month, year },
      responseType: "blob",
    });
    return response.data;
  },

  getGSTR3B: async (companyId: string, month: number, year: number): Promise<GSTR3BReport> => {
    const response = await api.get(`/companies/${companyId}/gst/gstr3b`, {
      params: { month, year },
    });
    return response.data;
  },

  downloadGSTR3B: async (companyId: string, month: number, year: number): Promise<Blob> => {
    const response = await api.get(`/companies/${companyId}/gst/gstr3b/download`, {
      params: { month, year },
      responseType: "blob",
    });
    return response.data;
  },

  getStateCodes: async () => {
    const response = await api.get("/companies/dummy/gst/state-codes");
    return response.data;
  },
};

// ============== Accounting Types ==============

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type TransactionStatus = "draft" | "posted" | "reversed";
export type ReferenceType = "invoice" | "payment" | "manual" | "bank_import" | "opening_balance" | "transfer";
export type BankImportRowStatus = "pending" | "matched" | "created" | "ignored";

export interface Account {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description?: string;
  account_type: AccountType;
  parent_id?: string;
  opening_balance: number | string;
  current_balance: number | string;
  is_system: boolean;
  is_active: boolean;
  bank_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  company_id: string;
  transaction_number: string;
  transaction_date: string;
  description?: string;
  reference_type: ReferenceType;
  reference_id?: string;
  status: TransactionStatus;
  is_reconciled: boolean;
  reconciled_at?: string;
  total_debit: number;
  total_credit: number;
  reversed_by_id?: string;
  reverses_id?: string;
  entries: TransactionEntry[];
  created_at: string;
  updated_at: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface BankImportRow {
  id: string;
  import_id: string;
  row_number: number;
  transaction_date?: string;
  value_date?: string;
  description?: string;
  reference_number?: string;
  debit_amount: number;
  credit_amount: number;
  balance?: number;
  status: BankImportRowStatus;
  transaction_id?: string;
  mapped_account_id?: string;
  created_at: string;
}

export interface BankImportResponse {
  id: string;
  company_id: string;
  bank_account_id?: string;
  file_name: string;
  bank_name?: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  matched_rows: number;
  created_rows: number;
  ignored_rows: number;
  error_message?: string;
  import_date: string;
  completed_at?: string;
  created_at: string;
  rows?: BankImportRow[];
}

export interface AccountLedgerEntry {
  transaction_id: string;
  transaction_number: string;
  transaction_date: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  reference_type: ReferenceType;
  reference_id?: string;
  is_reconciled: boolean;
}

export interface AccountLedgerResponse {
  account: Account;
  entries: AccountLedgerEntry[];
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
}

export interface TrialBalanceEntry {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  debit_balance: number;
  credit_balance: number;
}

export interface TrialBalanceResponse {
  as_of_date: string;
  entries: TrialBalanceEntry[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface ProfitLossSection {
  name: string;
  accounts: { account_id: string; account_name: string; amount: number }[];
  total: number;
}

export interface ProfitLossResponse {
  from_date: string;
  to_date: string;
  revenue: ProfitLossSection;
  expenses: ProfitLossSection;
  gross_profit: number;
  net_profit: number;
}

export interface BalanceSheetSection {
  name: string;
  accounts: { account_id: string | null; account_name: string; amount: number }[];
  total: number;
}

export interface BalanceSheetResponse {
  as_of_date: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  total_assets: number;
  total_liabilities_equity: number;
  is_balanced: boolean;
}

export interface CashFlowEntry {
  description: string;
  amount: number;
}

export interface CashFlowSection {
  name: string;
  entries: CashFlowEntry[];
  total: number;
}

export interface CashFlowResponse {
  from_date: string;
  to_date: string;
  operating_activities: CashFlowSection;
  investing_activities: CashFlowSection;
  financing_activities: CashFlowSection;
  net_cash_change: number;
  opening_cash: number;
  closing_cash: number;
}

export interface AccountSummary {
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_revenue: number;
  total_expenses: number;
  cash_balance: number;
  accounts_receivable: number;
  accounts_payable: number;
}

// ============== Accounting API ==============

export const accountingApi = {
  // Accounts
  listAccounts: async (companyId: string, accountType?: AccountType): Promise<Account[]> => {
    const response = await api.get(`/companies/${companyId}/accounts`, {
      params: accountType ? { account_type: accountType } : {},
    });
    return response.data;
  },

  createAccount: async (companyId: string, data: {
    code: string;
    name: string;
    description?: string;
    account_type: AccountType;
    parent_id?: string;
    opening_balance?: number;
    bank_account_id?: string;
  }): Promise<Account> => {
    const response = await api.post(`/companies/${companyId}/accounts`, data);
    return response.data;
  },

  getAccount: async (companyId: string, accountId: string): Promise<Account> => {
    const response = await api.get(`/companies/${companyId}/accounts/${accountId}`);
    return response.data;
  },

  updateAccount: async (companyId: string, accountId: string, data: Partial<Account>): Promise<Account> => {
    const response = await api.put(`/companies/${companyId}/accounts/${accountId}`, data);
    return response.data;
  },

  deleteAccount: async (companyId: string, accountId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/accounts/${accountId}`);
  },

  getAccountLedger: async (
    companyId: string,
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<AccountLedgerResponse> => {
    const response = await api.get(`/companies/${companyId}/accounts/${accountId}/ledger`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },

  // Transactions
  listTransactions: async (
    companyId: string,
    params?: {
      page?: number;
      page_size?: number;
      limit?: number;
      account_id?: string;
      reference_type?: ReferenceType | string;
      from_date?: string;
      to_date?: string;
      status?: TransactionStatus;
      is_reconciled?: boolean;
    }
  ): Promise<TransactionListResponse> => {
    const response = await api.get(`/companies/${companyId}/transactions`, { params });
    return response.data;
  },

  createTransaction: async (
    companyId: string,
    data: {
      transaction_date: string;
      description?: string;
      reference_type?: ReferenceType;
      reference_id?: string;
      entries: {
        account_id: string;
        description?: string;
        debit_amount: number;
        credit_amount: number;
      }[];
    },
    autoPost?: boolean
  ): Promise<Transaction> => {
    const response = await api.post(`/companies/${companyId}/transactions`, data, {
      params: { auto_post: autoPost },
    });
    return response.data;
  },

  getTransaction: async (companyId: string, transactionId: string): Promise<Transaction> => {
    const response = await api.get(`/companies/${companyId}/transactions/${transactionId}`);
    return response.data;
  },

  postTransaction: async (companyId: string, transactionId: string): Promise<Transaction> => {
    const response = await api.post(`/companies/${companyId}/transactions/${transactionId}/post`);
    return response.data;
  },

  reverseTransaction: async (companyId: string, transactionId: string, reason?: string): Promise<Transaction> => {
    const response = await api.post(`/companies/${companyId}/transactions/${transactionId}/reverse`, null, {
      params: { reason },
    });
    return response.data;
  },

  reconcileTransaction: async (companyId: string, transactionId: string): Promise<void> => {
    await api.post(`/companies/${companyId}/transactions/${transactionId}/reconcile`);
  },

  // Bank Import
  previewBankStatement: async (
    companyId: string,
    file: File
  ): Promise<{
    filename: string;
    headers: string[];
    sample_rows: Record<string, string>[];
    detected_bank: string | null;
    row_count: number;
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/companies/${companyId}/bank-import/preview`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  uploadBankStatement: async (
    companyId: string,
    file: File,
    bankAccountId?: string,
    bankName?: string,
    columnMapping?: {
      date_column?: string;
      description_column?: string;
      debit_column?: string;
      credit_column?: string;
      reference_column?: string;
      balance_column?: string;
    }
  ): Promise<BankImportResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/companies/${companyId}/bank-import`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      params: { 
        bank_account_id: bankAccountId, 
        bank_name: bankName,
        ...columnMapping
      },
    });
    return response.data;
  },

  listBankImports: async (companyId: string, page?: number, pageSize?: number): Promise<BankImportResponse[]> => {
    const response = await api.get(`/companies/${companyId}/bank-imports`, {
      params: { page, page_size: pageSize },
    });
    return response.data;
  },

  getBankImport: async (companyId: string, importId: string): Promise<BankImportResponse> => {
    const response = await api.get(`/companies/${companyId}/bank-imports/${importId}`);
    return response.data;
  },

  processBankImport: async (
    companyId: string,
    importId: string,
    mappings: { row_id: string; account_id: string; action: string; transaction_id?: string }[],
    bankAccountId?: string
  ): Promise<{ message: string; created: number; matched: number; ignored: number }> => {
    const response = await api.post(
      `/companies/${companyId}/bank-imports/${importId}/process`,
      { mappings },
      { params: { bank_account_id: bankAccountId } }
    );
    return response.data;
  },

  deleteBankImport: async (companyId: string, importId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/bank-imports/${importId}`);
  },

  // Reports
  getTrialBalance: async (companyId: string, asOfDate?: string): Promise<TrialBalanceResponse> => {
    const response = await api.get(`/companies/${companyId}/reports/trial-balance`, {
      params: { as_of_date: asOfDate },
    });
    return response.data;
  },

  getProfitLoss: async (companyId: string, fromDate: string, toDate: string): Promise<ProfitLossResponse> => {
    const response = await api.get(`/companies/${companyId}/reports/profit-loss`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },

  getBalanceSheet: async (companyId: string, asOfDate?: string): Promise<BalanceSheetResponse> => {
    const response = await api.get(`/companies/${companyId}/reports/balance-sheet`, {
      params: { as_of_date: asOfDate },
    });
    return response.data;
  },

  getCashFlow: async (companyId: string, fromDate: string, toDate: string): Promise<CashFlowResponse> => {
    const response = await api.get(`/companies/${companyId}/reports/cash-flow`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },

  getAccountSummary: async (companyId: string, asOfDate?: string): Promise<AccountSummary> => {
    const response = await api.get(`/companies/${companyId}/reports/account-summary`, {
      params: { as_of_date: asOfDate },
    });
    return response.data;
  },
};

// Quick Entry Types
export interface QuickEntry {
  id: string;
  entry_type: "money_in" | "money_out" | "transfer";
  entry_date: string;
  amount: number;
  category?: string;
  party_id?: string;
  party_type?: string;
  party_name?: string;
  payment_mode?: string;
  description?: string;
  reference_number?: string;
  is_gst_applicable: boolean;
  gst_rate?: number;
  gst_amount: number;
  transaction_id?: string;
  created_at: string;
}

export interface QuickEntryCreate {
  entry_type: "money_in" | "money_out" | "transfer";
  amount: number;
  entry_date?: string;
  category?: string;
  party_id?: string;
  party_type?: string;
  payment_account_id?: string;
  payment_mode?: string;
  description?: string;
  reference_number?: string;
  gst_rate?: number;
  from_account_id?: string;
  to_account_id?: string;
  cheque_number?: string;
  drawer_name?: string;
  payee_name?: string;
  drawn_on_bank?: string;
  drawn_on_branch?: string;
  bank_account_id?: string;
}

export interface CategoryOption {
  value: string;
  label: string;
  type: "income" | "expense";
}

export interface PaymentAccountOption {
  id: string;
  name: string;
  code: string;
  type: "cash" | "bank";
}

export interface PartyOption {
  id: string;
  name: string;
  type: "customer" | "vendor";
  gstin?: string;
}

export interface QuickEntryOptions {
  categories: CategoryOption[];
  payment_accounts: PaymentAccountOption[];
  parties: PartyOption[];
}

export interface QuickEntrySummary {
  period: { from_date: string; to_date: string };
  money_in: { total: number; by_category: Record<string, number> };
  money_out: { total: number; by_category: Record<string, number> };
  net: number;
}

// Quick Entry API
export const quickEntryApi = {
  create: async (companyId: string, data: QuickEntryCreate): Promise<QuickEntry> => {
    const response = await api.post(`/companies/${companyId}/quick-entry`, data);
    return response.data;
  },

  list: async (
    companyId: string,
    params?: {
      entry_type?: string;
      category?: string;
      from_date?: string;
      to_date?: string;
      limit?: number;
    }
  ): Promise<QuickEntry[]> => {
    const response = await api.get(`/companies/${companyId}/quick-entry`, { params });
    return response.data;
  },

  getOptions: async (companyId: string): Promise<QuickEntryOptions> => {
    const response = await api.get(`/companies/${companyId}/quick-entry/options`);
    return response.data;
  },

  getSummary: async (
    companyId: string,
    fromDate: string,
    toDate: string
  ): Promise<QuickEntrySummary> => {
    const response = await api.get(`/companies/${companyId}/quick-entry/summary`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },
};

// ============== Orders Types ==============

export type OrderStatus = "draft" | "confirmed" | "completed" | "cancelled";

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  rate: number;
  gst_rate?: number;
  tax_amount?: number;
  total_amount?: number;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date?: string;
  customer_id?: string;
  customer_name?: string;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  quantity_ordered?: number;
  quantity_delivered?: number;
  notes?: string;
  created_at: string;
  items?: OrderItem[];
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  expected_date?: string;
  vendor_id?: string;
  vendor_name?: string;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  quantity_ordered?: number;
  quantity_received?: number;
  notes?: string;
  terms?: string;
  created_at: string;
  items?: OrderItem[];
}

export interface PurchaseOrderUpdate {
  vendor_id?: string;
  items?: OrderItemInput[];
  order_date?: string;
  expected_date?: string;
  notes?: string;
  terms?: string;
}

export interface DeliveryNote {
  id: string;
  delivery_number: string;
  delivery_date: string;
  customer_id?: string;
  sales_order_id?: string;
  transporter_name?: string;
  vehicle_number?: string;
  notes?: string;
  created_at: string;
}

export interface ReceiptNote {
  id: string;
  receipt_number: string;
  receipt_date: string;
  vendor_id?: string;
  purchase_order_id?: string;
  vendor_invoice_number?: string;
  notes?: string;
  created_at: string;
}

export interface OrderItemInput {
  product_id?: string;  // Unified with Product model
  description: string;
  quantity: number;
  unit?: string;
  rate: number;
  gst_rate?: number;
}

export interface SalesOrderCreate {
  customer_id: string;
  items: OrderItemInput[];
  order_date?: string;
  expected_delivery_date?: string;
  notes?: string;
  terms?: string;
}

export interface PurchaseOrderCreate {
  vendor_id: string;
  items: OrderItemInput[];
  order_date?: string;
  expected_date?: string;
  notes?: string;
  terms?: string;
}

// ============== Orders API ==============

export const ordersApi = {
  // Sales Orders
  listSalesOrders: async (
    companyId: string,
    params?: { customer_id?: string; status?: OrderStatus }
  ): Promise<SalesOrder[]> => {
    const response = await api.get(`/companies/${companyId}/orders/sales`, { params });
    return response.data;
  },

  getSalesOrder: async (companyId: string, orderId: string): Promise<SalesOrder> => {
    const response = await api.get(`/companies/${companyId}/orders/sales/${orderId}`);
    return response.data;
  },

  createSalesOrder: async (companyId: string, data: SalesOrderCreate): Promise<SalesOrder> => {
    const response = await api.post(`/companies/${companyId}/orders/sales`, data);
    return response.data;
  },

  confirmSalesOrder: async (companyId: string, orderId: string): Promise<{ message: string }> => {
    const response = await api.post(`/companies/${companyId}/orders/sales/${orderId}/confirm`);
    return response.data;
  },

  cancelSalesOrder: async (companyId: string, orderId: string): Promise<{ message: string }> => {
    const response = await api.post(`/companies/${companyId}/orders/sales/${orderId}/cancel`);
    return response.data;
  },

  // Purchase Orders
  listPurchaseOrders: async (
    companyId: string,
    params?: { vendor_id?: string; status?: OrderStatus }
  ): Promise<PurchaseOrder[]> => {
    const response = await api.get(`/companies/${companyId}/orders/purchase`, { params });
    return response.data;
  },

  createPurchaseOrder: async (companyId: string, data: PurchaseOrderCreate): Promise<PurchaseOrder> => {
    const response = await api.post(`/companies/${companyId}/orders/purchase`, data);
    return response.data;
  },

  getPurchaseOrder: async (companyId: string, orderId: string): Promise<PurchaseOrder> => {
    const response = await api.get(`/companies/${companyId}/orders/purchase/${orderId}`);
    return response.data;
  },

  updatePurchaseOrder: async (
    companyId: string,
    orderId: string,
    data: PurchaseOrderUpdate
  ): Promise<PurchaseOrder> => {
    const response = await api.put(`/companies/${companyId}/orders/purchase/${orderId}`, data);
    return response.data;
  },

  confirmPurchaseOrder: async (companyId: string, orderId: string): Promise<{ message: string }> => {
    const response = await api.post(`/companies/${companyId}/orders/purchase/${orderId}/confirm`);
    return response.data;
  },

  cancelPurchaseOrder: async (companyId: string, orderId: string): Promise<{ message: string }> => {
    const response = await api.post(`/companies/${companyId}/orders/purchase/${orderId}/cancel`);
    return response.data;
  },

  // Delivery Notes
  listDeliveryNotes: async (
    companyId: string,
    params?: { sales_order_id?: string }
  ): Promise<DeliveryNote[]> => {
    const response = await api.get(`/companies/${companyId}/orders/delivery-notes`, { params });
    return response.data;
  },

  createDeliveryNote: async (
    companyId: string,
    data: {
      sales_order_id?: string;
      customer_id: string;
      items: { product_id?: string; description: string; quantity: number; unit?: string }[];
      godown_id?: string;
      delivery_date?: string;
      transporter_name?: string;
      vehicle_number?: string;
      notes?: string;
    }
  ): Promise<DeliveryNote> => {
    const response = await api.post(`/companies/${companyId}/orders/delivery-notes`, data);
    return response.data;
  },

  getDeliveryNote: async (companyId: string, noteId: string): Promise<DeliveryNote> => {
    const response = await api.get(`/companies/${companyId}/orders/delivery-notes/${noteId}`);
    return response.data;
  },

  deleteDeliveryNote: async (companyId: string, noteId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/orders/delivery-notes/${noteId}`);
  },

  // Receipt Notes
  listReceiptNotes: async (
    companyId: string,
    params?: { purchase_order_id?: string }
  ): Promise<ReceiptNote[]> => {
    const response = await api.get(`/companies/${companyId}/orders/receipt-notes`, { params });
    return response.data;
  },

  createReceiptNote: async (
    companyId: string,
    data: {
      purchase_order_id?: string;
      vendor_id: string;
      items: { product_id?: string; description: string; quantity: number; unit?: string; rate?: number; rejected_quantity?: number; rejection_reason?: string }[];
      godown_id?: string;
      receipt_date?: string;
      vendor_invoice_number?: string;
      vendor_invoice_date?: string;
      notes?: string;
    }
  ): Promise<ReceiptNote> => {
    const response = await api.post(`/companies/${companyId}/orders/receipt-notes`, data);
    return response.data;
  },

  getReceiptNote: async (companyId: string, noteId: string): Promise<ReceiptNote> => {
    const response = await api.get(`/companies/${companyId}/orders/receipt-notes/${noteId}`);
    return response.data;
  },

  deleteReceiptNote: async (companyId: string, noteId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/orders/receipt-notes/${noteId}`);
  },
};

// ============== GST Integration Types ==============

export interface EInvoiceDetails {
  invoice_id: string;
  invoice_number: string;
  has_irn: boolean;
  irn?: string;
  ack_number?: string;
  ack_date?: string;
  signed_qr?: string;
  einvoice_data?: any;
}

export interface EWayBillCheck {
  invoice_id: string;
  invoice_number: string;
  total_value: number;
  eway_bill_required: boolean;
  threshold: number;
}

export interface EWayBillResult {
  success: boolean;
  message: string;
  eway_bill_number?: string;
  valid_until?: string;
}

export interface ITCSummary {
  total_itc_available: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  itc_by_category: Record<string, number>;
}

// ============== GST Integration API ==============

export const gstIntegrationApi = {
  // E-Invoice
  generateEInvoice: async (
    companyId: string,
    invoiceId: string
  ): Promise<{ success: boolean; message: string; irn?: string; ack_number?: string }> => {
    const response = await api.post(`/companies/${companyId}/gst/e-invoice/generate`, {
      invoice_id: invoiceId,
    });
    return response.data;
  },

  cancelEInvoice: async (
    companyId: string,
    invoiceId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(
      `/companies/${companyId}/gst/e-invoice/cancel`,
      { invoice_id: invoiceId },
      { params: { reason } }
    );
    return response.data;
  },

  getEInvoiceDetails: async (companyId: string, invoiceId: string): Promise<EInvoiceDetails> => {
    const response = await api.get(`/companies/${companyId}/gst/e-invoice/${invoiceId}`);
    return response.data;
  },

  // E-Way Bill
  generateEWayBill: async (
    companyId: string,
    data: {
      invoice_id: string;
      transporter_id?: string;
      transporter_name?: string;
      vehicle_number?: string;
      vehicle_type?: string;
      transport_mode?: string;
      distance_km?: number;
    }
  ): Promise<EWayBillResult> => {
    const response = await api.post(`/companies/${companyId}/gst/eway-bill/generate`, data);
    return response.data;
  },

  checkEWayBillRequired: async (companyId: string, invoiceId: string): Promise<EWayBillCheck> => {
    const response = await api.get(`/companies/${companyId}/gst/eway-bill/check/${invoiceId}`);
    return response.data;
  },

  // ITC
  getITCSummary: async (
    companyId: string,
    fromDate: string,
    toDate: string
  ): Promise<ITCSummary> => {
    const response = await api.get(`/companies/${companyId}/gst/itc/summary`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },

  reconcileITC: async (
    companyId: string,
    gstr2aData: any[]
  ): Promise<{ matched: number; unmatched: number; discrepancies: any[] }> => {
    const response = await api.post(`/companies/${companyId}/gst/itc/reconcile`, {
      gstr2a_data: gstr2aData,
    });
    return response.data;
  },

  // GSTR-1 Summary
  getGSTR1Summary: async (
    companyId: string,
    fromDate: string,
    toDate: string
  ): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/gst/gstr1/summary`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },
};

// ============== Purchase Invoice Types ==============

export interface PurchaseInvoiceItem {
  id: string;
  product_id?: string;
  description: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  taxable_amount: number;
  total_amount: number;
  itc_eligible: boolean;
  stock_received: boolean;
}

export interface PurchaseInvoice {
  id: string;
  company_id: string;
  vendor_id?: string;
  vendor_name?: string;
  vendor_gstin?: string;
  invoice_number: string;
  vendor_invoice_number?: string;
  invoice_date: string;
  vendor_invoice_date?: string;
  due_date?: string;
  place_of_supply?: string;
  place_of_supply_name?: string;
  is_reverse_charge: boolean;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
  tds_applicable: boolean;
  tds_rate: number;
  tds_amount: number;
  net_payable: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  itc_eligible: boolean;
  notes?: string;
  created_at: string;
  items: PurchaseInvoiceItem[];
}

export interface PurchaseListResponse {
  items: PurchaseInvoice[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PurchasePayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface InputGSTSummary {
  period: { from: string; to: string };
  total_invoices: number;
  total_taxable_value: number;
  cgst_input: number;
  sgst_input: number;
  igst_input: number;
  total_itc_available: number;
}

// ============== Purchase Invoice API ==============

export const purchasesApi = {
  list: async (
    companyId: string,
    params?: {
      page?: number;
      page_size?: number;
      status?: string;
      vendor_id?: string;
      from_date?: string;
      to_date?: string;
    }
  ): Promise<PurchaseListResponse> => {
    const response = await api.get(`/companies/${companyId}/purchases`, { params });
    return response.data;
  },

  get: async (companyId: string, invoiceId: string): Promise<PurchaseInvoice> => {
    const response = await api.get(`/companies/${companyId}/purchases/${invoiceId}`);
    return response.data;
  },

  create: async (companyId: string, data: {
    vendor_id: string;
    vendor_invoice_number?: string;
    vendor_invoice_date?: string;
    invoice_date?: string;
    due_date?: string;
    place_of_supply?: string;
    is_reverse_charge?: boolean;
    tds_section_id?: string;
    purchase_order_id?: string;
    receipt_note_id?: string;
    notes?: string;
    auto_receive_stock?: boolean;
    godown_id?: string;
    items: Array<{
      product_id?: string;
      description: string;
      hsn_code?: string;
      quantity: number;
      unit?: string;
      unit_price: number;
      gst_rate?: number;
      discount_percent?: number;
      itc_eligible?: boolean;
    }>;
  }): Promise<PurchaseInvoice> => {
    const response = await api.post(`/companies/${companyId}/purchases`, data);
    return response.data;
  },

  approve: async (companyId: string, invoiceId: string): Promise<PurchaseInvoice> => {
    const response = await api.post(`/companies/${companyId}/purchases/${invoiceId}/approve`);
    return response.data;
  },

  recordPayment: async (
    companyId: string,
    invoiceId: string,
    data: {
      amount: number;
      payment_date?: string;
      payment_mode?: string;
      reference_number?: string;
      bank_account_id?: string;
      notes?: string;
    }
  ): Promise<PurchasePayment> => {
    const response = await api.post(`/companies/${companyId}/purchases/${invoiceId}/payments`, data);
    return response.data;
  },

  receiveStock: async (
    companyId: string,
    invoiceId: string,
    godown_id?: string
  ): Promise<{ message: string; entries_created: number }> => {
    const response = await api.post(`/companies/${companyId}/purchases/${invoiceId}/receive-stock`, null, {
      params: godown_id ? { godown_id } : {},
    });
    return response.data;
  },

  cancel: async (companyId: string, invoiceId: string, reason?: string): Promise<PurchaseInvoice> => {
    const response = await api.post(`/companies/${companyId}/purchases/${invoiceId}/cancel`, reason ? { reason } : undefined);
    return response.data;
  },

  getInputGSTSummary: async (
    companyId: string,
    fromDate: string,
    toDate: string
  ): Promise<InputGSTSummary> => {
    const response = await api.get(`/companies/${companyId}/purchases/reports/input-gst`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },
};

// Inventory Types
export interface StockGroup {
  id: string;
  name: string;
  parent_id?: string;
  description?: string;
  is_active: boolean;
}

export interface Godown {
  id: string;
  name: string;
  code?: string;
  address?: string;
  parent_id?: string;
  is_default: boolean;
  is_active: boolean;
}

// StockItem now uses Product fields (unified model)
export interface StockItem {
  id: string;
  name: string;
  sku?: string;  // Was 'code'
  barcode?: string;
  stock_group_id?: string;
  unit: string;  // Was 'primary_unit'
  hsn_code?: string;
  gst_rate: string;  // Changed to string to match Product
  opening_stock: number;
  current_stock: number;
  min_stock_level: number;
  standard_cost: number;
  unit_price: number;  // Was 'standard_selling_price'
  enable_batch: boolean;
  enable_expiry: boolean;
  is_active: boolean;
  is_service: boolean;
  created_at?: string;
}

export interface StockEntry {
  id: string;
  product_id: string;  // Changed from stock_item_id
  godown_id?: string;
  entry_date: string;
  movement_type: string;
  quantity: number;
  unit?: string;
  rate: number;
  value: number;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface StockSummary {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

// Inventory API
export const inventoryApi = {
  // Stock Groups
  listGroups: async (companyId: string): Promise<StockGroup[]> => {
    const response = await api.get(`/companies/${companyId}/inventory/groups`);
    return response.data;
  },

  createGroup: async (companyId: string, data: Partial<StockGroup>): Promise<StockGroup> => {
    const response = await api.post(`/companies/${companyId}/inventory/groups`, data);
    return response.data;
  },

  // Godowns
  listGodowns: async (companyId: string): Promise<Godown[]> => {
    const response = await api.get(`/companies/${companyId}/inventory/godowns`);
    return response.data;
  },

  createGodown: async (companyId: string, data: Partial<Godown>): Promise<Godown> => {
    const response = await api.post(`/companies/${companyId}/inventory/godowns`, data);
    return response.data;
  },

  // Stock Items
  listItems: async (
    companyId: string,
    params?: { group_id?: string; search?: string; low_stock?: boolean }
  ): Promise<StockItem[]> => {
    const response = await api.get(`/companies/${companyId}/inventory/items`, { params });
    return response.data;
  },

  getItem: async (companyId: string, itemId: string): Promise<StockItem> => {
    const response = await api.get(`/companies/${companyId}/inventory/items/${itemId}`);
    return response.data;
  },

  createItem: async (companyId: string, data: Partial<StockItem>): Promise<StockItem> => {
    const response = await api.post(`/companies/${companyId}/inventory/items`, data);
    return response.data;
  },

  updateItem: async (companyId: string, itemId: string, data: Partial<StockItem>): Promise<StockItem> => {
    const response = await api.put(`/companies/${companyId}/inventory/items/${itemId}`, data);
    return response.data;
  },

  // Stock Movements
  stockIn: async (
    companyId: string,
    data: {
      product_id: string;
      quantity: number;
      rate: number;
      godown_id?: string;
      reference_number?: string;
      notes?: string;
    }
  ): Promise<StockEntry> => {
    const response = await api.post(`/companies/${companyId}/inventory/stock-in`, data);
    return response.data;
  },

  stockOut: async (
    companyId: string,
    data: {
      product_id: string;
      quantity: number;
      rate?: number;
      godown_id?: string;
      reference_number?: string;
      notes?: string;
    }
  ): Promise<StockEntry> => {
    const response = await api.post(`/companies/${companyId}/inventory/stock-out`, data);
    return response.data;
  },

  transferStock: async (
    companyId: string,
    data: {
      product_id: string;
      quantity: number;
      from_godown_id: string;
      to_godown_id: string;
      notes?: string;
    }
  ): Promise<void> => {
    await api.post(`/companies/${companyId}/inventory/transfer`, data);
  },

  listEntries: async (
    companyId: string,
    params?: { item_id?: string; godown_id?: string; from_date?: string; to_date?: string; limit?: number }
  ): Promise<StockEntry[]> => {
    const response = await api.get(`/companies/${companyId}/inventory/entries`, { params });
    return response.data;
  },

  // Summary
  getSummary: async (companyId: string): Promise<StockSummary> => {
    const response = await api.get(`/companies/${companyId}/inventory/summary`);
    return response.data;
  },

  getValuation: async (companyId: string): Promise<{ items: any[]; total_value: number }> => {
    const response = await api.get(`/companies/${companyId}/inventory/valuation`);
    return response.data;
  },

  // Stock by warehouse for a product
  getStockByWarehouse: async (
    companyId: string,
    productId: string
  ): Promise<{
    product_id: string;
    warehouses: { godown_id: string | null; godown_name: string; quantity: number }[];
  }> => {
    const response = await api.get(`/companies/${companyId}/inventory/stock-by-warehouse/${productId}`);
    return response.data;
  },
};

// ============== Business Dashboard Types ==============

export interface BusinessSummary {
  total_sales: number;
  total_purchases: number;
  net_position: number;
  period: { from: string; to: string; type: string };
}

export interface GSTSummaryDashboard {
  output_gst: number;
  input_gst: number;
  net_payable: number;
  cgst_output: number;
  sgst_output: number;
  igst_output: number;
  cgst_input: number;
  sgst_input: number;
  igst_input: number;
  due_date?: string;
  period: { from: string; to: string; type: string };
}

export interface TDSSummary {
  total_deducted: number;
  total_deposited: number;
  pending_deposit: number;
  due_date?: string;
  entries_count: number;
  period: { from: string; to: string; type: string };
}

export interface ITCSummaryDashboard {
  available: number;
  utilized: number;
  lapsed: number;
  expiring_soon: number;
  period: { from: string; to: string; type: string };
}

export interface RecentActivity {
  type: string;
  reference: string;
  amount: number;
  party?: string;
  date: string;
  status?: string;
}

export interface OutstandingSummary {
  receivables: { total: number; count: number; overdue: number };
  payables: { total: number; count: number; overdue: number };
  net_position: number;
}

// ============== Business Dashboard API ==============

export const businessDashboardApi = {
  getSummary: async (
    companyId: string,
    period: "month" | "quarter" | "year" = "month"
  ): Promise<BusinessSummary> => {
    const response = await api.get(`/companies/${companyId}/business/summary`, {
      params: { period },
    });
    return response.data;
  },

  getGSTSummary: async (
    companyId: string,
    period: "month" | "quarter" | "year" = "month"
  ): Promise<GSTSummaryDashboard> => {
    const response = await api.get(`/companies/${companyId}/business/gst-summary`, {
      params: { period },
    });
    return response.data;
  },

  getTDSSummary: async (
    companyId: string,
    period: "month" | "quarter" | "year" = "month"
  ): Promise<TDSSummary> => {
    const response = await api.get(`/companies/${companyId}/business/tds-summary`, {
      params: { period },
    });
    return response.data;
  },

  getITCSummary: async (
    companyId: string,
    period: "month" | "quarter" | "year" = "month"
  ): Promise<ITCSummaryDashboard> => {
    const response = await api.get(`/companies/${companyId}/business/itc-summary`, {
      params: { period },
    });
    return response.data;
  },

  getRecentActivity: async (
    companyId: string,
    limit: number = 10
  ): Promise<{ activities: RecentActivity[] }> => {
    const response = await api.get(`/companies/${companyId}/business/recent-activity`, {
      params: { limit },
    });
    return response.data;
  },

  getOutstanding: async (companyId: string): Promise<OutstandingSummary> => {
    const response = await api.get(`/companies/${companyId}/business/outstanding`);
    return response.data;
  },
};

// ============== Payroll Types ==============

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  parent_id?: string;
  is_active: boolean;
}

export interface Designation {
  id: string;
  name: string;
  code?: string;
  description?: string;
  level: number;
  is_active: boolean;
}

export interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  department_id?: string;
  designation_id?: string;
  employee_type: string;
  date_of_joining: string;
  work_state?: string;
  ctc?: number;
  pan?: string;
  uan?: string;
  pf_applicable: boolean;
  esi_applicable: boolean;
  pt_applicable: boolean;
  tax_regime: string;
  status: string;
}

export interface EmployeeCreate {
  employee_code: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  current_address?: string;
  current_city?: string;
  current_state?: string;
  current_pincode?: string;
  pan?: string;
  aadhaar?: string;
  department_id?: string;
  designation_id?: string;
  employee_type?: string;
  date_of_joining: string;
  work_state?: string;
  ctc?: number;
  uan?: string;
  pf_number?: string;
  esi_number?: string;
  pf_applicable?: boolean;
  esi_applicable?: boolean;
  pt_applicable?: boolean;
  tax_regime?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
}

export interface SalaryComponent {
  id: string;
  code: string;
  name: string;
  description?: string;
  component_type: string;
  calculation_type: string;
  percentage?: number;
  max_amount?: number;
  is_taxable: boolean;
  is_part_of_ctc: boolean;
  is_statutory: boolean;
  display_order: number;
  is_active: boolean;
}

export interface PayrollRun {
  id: string;
  pay_period_month: number;
  pay_period_year: number;
  pay_date?: string;
  status: string;
  total_employees: number;
  processed_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net_pay: number;
  total_pf_employee: number;
  total_pf_employer: number;
  total_esi_employee: number;
  total_esi_employer: number;
  total_pt: number;
  total_tds: number;
}

export interface Payslip {
  payslip_id: string;
  employee: {
    id: string;
    employee_code: string;
    name: string;
    department?: string;
    designation?: string;
    pan?: string;
    uan?: string;
    bank_account?: string;
    bank_name?: string;
  };
  pay_period: {
    month: number;
    year: number;
    pay_date?: string;
  };
  working_days: {
    total: number;
    worked: number;
    absent: number;
    lop: number;
  };
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  employer_contributions: Record<string, number>;
  summary: {
    gross_salary: number;
    total_deductions: number;
    net_pay: number;
  };
  statutory: {
    pf_employee: number;
    pf_employer: number;
    esi_employee: number;
    esi_employer: number;
    professional_tax: number;
    tds: number;
  };
}

export interface EmployeeLoan {
  id: string;
  loan_number: string;
  employee_id: string;
  loan_type: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  disbursement_date?: string;
  total_repayable: number;
  amount_repaid: number;
  outstanding_balance: number;
  emis_paid: number;
  emis_pending: number;
  status: string;
}

export interface PayrollSettings {
  pf_enabled: boolean;
  pf_contribution_rate: number;
  pf_wage_ceiling: number;
  pf_establishment_id?: string;
  esi_enabled: boolean;
  esi_employee_rate: number;
  esi_employer_rate: number;
  esi_wage_ceiling: number;
  esi_establishment_id?: string;
  pt_enabled: boolean;
  pt_state?: string;
  tds_enabled: boolean;
  default_tax_regime: string;
  pay_day: number;
  working_days_per_month: number;
}

// ============== Payroll API ==============

export const payrollApi = {
  // Departments
  listDepartments: async (companyId: string): Promise<Department[]> => {
    const response = await api.get(`/companies/${companyId}/payroll/departments`);
    return response.data;
  },

  createDepartment: async (
    companyId: string,
    data: { name: string; code?: string; description?: string }
  ): Promise<Department> => {
    const response = await api.post(`/companies/${companyId}/payroll/departments`, data);
    return response.data;
  },

  // Designations
  listDesignations: async (companyId: string): Promise<Designation[]> => {
    const response = await api.get(`/companies/${companyId}/payroll/designations`);
    return response.data;
  },

  createDesignation: async (
    companyId: string,
    data: { name: string; code?: string; level?: number }
  ): Promise<Designation> => {
    const response = await api.post(`/companies/${companyId}/payroll/designations`, data);
    return response.data;
  },

  // Employees
  listEmployees: async (
    companyId: string,
    params?: { status_filter?: string; department_id?: string }
  ): Promise<Employee[]> => {
    const response = await api.get(`/companies/${companyId}/payroll/employees`, { params });
    return response.data;
  },

  getEmployee: async (companyId: string, employeeId: string): Promise<Employee> => {
    const response = await api.get(`/companies/${companyId}/payroll/employees/${employeeId}`);
    return response.data;
  },

  createEmployee: async (companyId: string, data: EmployeeCreate): Promise<Employee> => {
    const response = await api.post(`/companies/${companyId}/payroll/employees`, data);
    return response.data;
  },

  updateEmployee: async (
    companyId: string,
    employeeId: string,
    data: Partial<EmployeeCreate>
  ): Promise<Employee> => {
    const response = await api.put(`/companies/${companyId}/payroll/employees/${employeeId}`, data);
    return response.data;
  },

  deactivateEmployee: async (companyId: string, employeeId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/payroll/employees/${employeeId}`);
  },

  // Salary Components
  listSalaryComponents: async (
    companyId: string,
    componentType?: string
  ): Promise<SalaryComponent[]> => {
    const response = await api.get(`/companies/${companyId}/payroll/salary-components`, {
      params: { component_type: componentType },
    });
    return response.data;
  },

  initializeSalaryComponents: async (companyId: string): Promise<void> => {
    await api.post(`/companies/${companyId}/payroll/salary-components/initialize`);
  },

  // Salary Structure
  createSalaryStructure: async (
    companyId: string,
    employeeId: string,
    data: { ctc: number; effective_from: string; components?: Record<string, number> }
  ): Promise<void> => {
    await api.post(`/companies/${companyId}/payroll/employees/${employeeId}/salary-structure`, data);
  },

  getSalaryStructure: async (
    companyId: string,
    employeeId: string
  ): Promise<{ employee_id: string; employee_name: string; ctc: number; components: any[] }> => {
    const response = await api.get(
      `/companies/${companyId}/payroll/employees/${employeeId}/salary-structure`
    );
    return response.data;
  },

  // Payroll Run
  listPayrollRuns: async (companyId: string, year?: number): Promise<PayrollRun[]> => {
    const response = await api.get(`/companies/${companyId}/payroll/run`, {
      params: { year },
    });
    return response.data;
  },

  createPayrollRun: async (
    companyId: string,
    data: { month: number; year: number; pay_date?: string }
  ): Promise<PayrollRun> => {
    const response = await api.post(`/companies/${companyId}/payroll/run`, data);
    return response.data;
  },

  getPayrollRun: async (companyId: string, month: number, year: number): Promise<PayrollRun> => {
    const response = await api.get(`/companies/${companyId}/payroll/run/${month}/${year}`);
    return response.data;
  },

  processPayroll: async (
    companyId: string,
    payrollRunId: string,
    workingDays?: number
  ): Promise<{ message: string; processed_employees: number; total_net_pay: number }> => {
    const response = await api.post(
      `/companies/${companyId}/payroll/run/${payrollRunId}/process`,
      null,
      { params: { working_days: workingDays || 30 } }
    );
    return response.data;
  },

  finalizePayroll: async (companyId: string, payrollRunId: string): Promise<void> => {
    await api.post(`/companies/${companyId}/payroll/run/${payrollRunId}/finalize`);
  },

  // Payslips
  getPayslip: async (
    companyId: string,
    employeeId: string,
    month: number,
    year: number
  ): Promise<Payslip> => {
    const response = await api.get(
      `/companies/${companyId}/payroll/payslip/${employeeId}/${month}/${year}`
    );
    return response.data;
  },

  listPayslips: async (
    companyId: string,
    month: number,
    year: number
  ): Promise<
    {
      employee_id: string;
      employee_code: string;
      employee_name: string;
      gross_salary: number;
      total_deductions: number;
      net_pay: number;
    }[]
  > => {
    const response = await api.get(`/companies/${companyId}/payroll/payslips/${month}/${year}`);
    return response.data;
  },

  // Loans
  listLoans: async (
    companyId: string,
    params?: { employee_id?: string; status_filter?: string }
  ): Promise<EmployeeLoan[]> => {
    const response = await api.get(`/companies/${companyId}/payroll/loans`, { params });
    return response.data;
  },

  createLoan: async (
    companyId: string,
    data: {
      employee_id: string;
      loan_type: string;
      principal_amount: number;
      tenure_months: number;
      interest_rate?: number;
      reason?: string;
    }
  ): Promise<EmployeeLoan> => {
    const response = await api.post(`/companies/${companyId}/payroll/loans`, data);
    return response.data;
  },

  getLoanStatement: async (companyId: string, loanId: string): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/payroll/loans/${loanId}`);
    return response.data;
  },

  approveLoan: async (companyId: string, loanId: string): Promise<void> => {
    await api.post(`/companies/${companyId}/payroll/loans/${loanId}/approve`);
  },

  disburseLoan: async (companyId: string, loanId: string): Promise<void> => {
    await api.post(`/companies/${companyId}/payroll/loans/${loanId}/disburse`);
  },

  // Reports
  getPFReport: async (
    companyId: string,
    month: number,
    year: number
  ): Promise<{ summary: any; ecr_data: any[] }> => {
    const response = await api.get(`/companies/${companyId}/payroll/reports/pf/${month}/${year}`);
    return response.data;
  },

  getESIReport: async (
    companyId: string,
    month: number,
    year: number
  ): Promise<{ summary: any; challan_data: any[] }> => {
    const response = await api.get(`/companies/${companyId}/payroll/reports/esi/${month}/${year}`);
    return response.data;
  },

  getPTReport: async (companyId: string, month: number, year: number): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/payroll/reports/pt/${month}/${year}`);
    return response.data;
  },

  // Settings
  getSettings: async (companyId: string): Promise<PayrollSettings> => {
    const response = await api.get(`/companies/${companyId}/payroll/settings`);
    return response.data;
  },

  updateSettings: async (companyId: string, data: Partial<PayrollSettings>): Promise<void> => {
    await api.put(`/companies/${companyId}/payroll/settings`, data);
  },
};

// ============== Alternative Products Types ==============

export interface AlternativeProduct {
  id: string;
  company_id: string;
  name: string;
  manufacturer?: string;
  model_number?: string;
  description?: string;
  category?: string;
  specifications?: Record<string, any>;
  reference_url?: string;
  reference_price?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  mapped_products_count: number;
}

export interface AlternativeProductCreate {
  name: string;
  manufacturer?: string;
  model_number?: string;
  description?: string;
  category?: string;
  specifications?: Record<string, any>;
  reference_url?: string;
  reference_price?: number;
}

export interface AlternativeProductUpdate {
  name?: string;
  manufacturer?: string;
  model_number?: string;
  description?: string;
  category?: string;
  specifications?: Record<string, any>;
  reference_url?: string;
  reference_price?: number;
  is_active?: boolean;
}

export interface AlternativeProductListResponse {
  alternative_products: AlternativeProduct[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProductMapping {
  id: string;
  product_id: string;
  alternative_product_id: string;
  notes?: string;
  priority: number;
  comparison_notes?: string;
  created_at: string;
}

export interface MappedProduct {
  mapping_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_unit_price?: number;
  notes?: string;
  priority: number;
  comparison_notes?: string;
  created_at: string;
}

export interface AlternativeForProduct {
  mapping_id: string;
  alternative_id: string;
  alternative_name: string;
  manufacturer?: string;
  model_number?: string;
  reference_price?: number;
  notes?: string;
  priority: number;
  comparison_notes?: string;
}

// ============== Alternative Products API ==============

export const alternativeProductsApi = {
  list: async (
    companyId: string,
    params?: {
      page?: number;
      page_size?: number;
      search?: string;
      category?: string;
      manufacturer?: string;
      is_active?: boolean;
    }
  ): Promise<AlternativeProductListResponse> => {
    const response = await api.get(`/companies/${companyId}/alternative-products`, { params });
    return response.data;
  },

  get: async (companyId: string, alternativeProductId: string): Promise<AlternativeProduct> => {
    const response = await api.get(
      `/companies/${companyId}/alternative-products/${alternativeProductId}`
    );
    return response.data;
  },

  create: async (
    companyId: string,
    data: AlternativeProductCreate
  ): Promise<AlternativeProduct> => {
    const response = await api.post(`/companies/${companyId}/alternative-products`, data);
    return response.data;
  },

  update: async (
    companyId: string,
    alternativeProductId: string,
    data: AlternativeProductUpdate
  ): Promise<AlternativeProduct> => {
    const response = await api.put(
      `/companies/${companyId}/alternative-products/${alternativeProductId}`,
      data
    );
    return response.data;
  },

  delete: async (
    companyId: string,
    alternativeProductId: string,
    hardDelete: boolean = false
  ): Promise<void> => {
    await api.delete(
      `/companies/${companyId}/alternative-products/${alternativeProductId}`,
      { params: { hard_delete: hardDelete } }
    );
  },

  // Get categories for filtering
  getCategories: async (companyId: string): Promise<string[]> => {
    const response = await api.get(`/companies/${companyId}/alternative-products/categories`);
    return response.data;
  },

  // Get manufacturers for filtering
  getManufacturers: async (companyId: string): Promise<string[]> => {
    const response = await api.get(`/companies/${companyId}/alternative-products/manufacturers`);
    return response.data;
  },

  // Map a product to an alternative product
  mapProduct: async (
    companyId: string,
    alternativeProductId: string,
    data: { product_id: string; notes?: string; priority?: number; comparison_notes?: string }
  ): Promise<ProductMapping> => {
    const response = await api.post(
      `/companies/${companyId}/alternative-products/${alternativeProductId}/map-product`,
      data
    );
    return response.data;
  },

  // Unmap a product from an alternative product
  unmapProduct: async (
    companyId: string,
    alternativeProductId: string,
    productId: string
  ): Promise<void> => {
    await api.delete(
      `/companies/${companyId}/alternative-products/${alternativeProductId}/map-product/${productId}`
    );
  },

  // Get all products mapped to an alternative product
  getMappedProducts: async (
    companyId: string,
    alternativeProductId: string
  ): Promise<MappedProduct[]> => {
    const response = await api.get(
      `/companies/${companyId}/alternative-products/${alternativeProductId}/mapped-products`
    );
    return response.data;
  },

  // Get all alternatives for a company product
  getAlternativesForProduct: async (
    companyId: string,
    productId: string
  ): Promise<AlternativeForProduct[]> => {
    const response = await api.get(`/companies/${companyId}/products/${productId}/alternatives`);
    return response.data;
  },
};

// ============== Credit Notes Types ==============

export interface CreditNoteItem {
  invoice_item_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
}

export interface CreditNoteCreate {
  original_invoice_id: string;
  note_date?: string;
  reason: string;
  items: CreditNoteItem[];
}

export interface CreditNote {
  id: string;
  note_number: string;
  note_date: string;
  customer_name: string;
  original_invoice: string;
  total_amount: number;
  reason: string;
}

export interface CreditNoteResponse {
  id: string;
  note_number: string;
  note_date: string;
  customer_name: string;
  original_invoice_id: string;
  original_invoice_number: string;
  taxable_amount: number;
  gst_amount: number;
  total_amount: number;
  reason: string;
  items: any[];
  message: string;
}

// ============== Credit Notes API ==============

export const creditNotesApi = {
  list: async (companyId: string): Promise<CreditNote[]> => {
    const response = await api.get(`/companies/${companyId}/credit-notes`);
    return response.data;
  },

  create: async (companyId: string, data: CreditNoteCreate): Promise<CreditNoteResponse> => {
    const response = await api.post(`/companies/${companyId}/credit-notes`, data);
    return response.data;
  },
};

// ============== Debit Notes Types ==============

export interface DebitNoteItem {
  purchase_item_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
}

export interface DebitNoteCreate {
  original_invoice_id: string;
  note_date?: string;
  reason: string;
  items: DebitNoteItem[];
}

export interface DebitNote {
  id: string;
  note_number: string;
  note_date: string;
  vendor_name: string;
  original_invoice: string;
  total_amount: number;
  reason: string;
}

export interface DebitNoteResponse {
  id: string;
  note_number: string;
  note_date: string;
  vendor_name: string;
  original_invoice_id: string;
  original_invoice_number: string;
  taxable_amount: number;
  gst_amount: number;
  total_amount: number;
  reason: string;
  items: any[];
  message: string;
}

// ============== Debit Notes API ==============

export const debitNotesApi = {
  list: async (companyId: string): Promise<DebitNote[]> => {
    const response = await api.get(`/companies/${companyId}/debit-notes`);
    return response.data;
  },

  create: async (companyId: string, data: DebitNoteCreate): Promise<DebitNoteResponse> => {
    const response = await api.post(`/companies/${companyId}/debit-notes`, data);
    return response.data;
  },
};

// ============== Cost Centers Types ==============

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  parent_id?: string;
  level: number;
  is_active: boolean;
}

export interface CostCenterCreate {
  code: string;
  name: string;
  description?: string;
  parent_id?: string;
  department_id?: string;
}

export interface CostCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  allocation_type: string;
  is_active: boolean;
}

export interface CostCategoryCreate {
  code: string;
  name: string;
  description?: string;
  allocation_type?: string;
}

export interface Budget {
  id: string;
  name: string;
  financial_year: string;
  from_date: string;
  to_date: string;
  period_type: string;
  status: string;
  total_budgeted: number;
  total_actual: number;
  total_variance: number;
}

export interface BudgetCreate {
  name: string;
  financial_year: string;
  from_date: string;
  to_date: string;
  period_type?: string;
  description?: string;
}

export interface BudgetLine {
  id: string;
  account_id: string;
  cost_center_id?: string;
  period_month?: number;
  budgeted_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percentage: number;
}

export interface BudgetLineCreate {
  account_id: string;
  budgeted_amount: number;
  period_month?: number;
  period_quarter?: number;
  cost_center_id?: string;
  notes?: string;
}

// ============== Cost Centers API ==============

export const costCentersApi = {
  // Cost Centers
  list: async (companyId: string, activeOnly: boolean = true): Promise<CostCenter[]> => {
    const response = await api.get(`/companies/${companyId}/cost-centers`, {
      params: { active_only: activeOnly },
    });
    return response.data;
  },

  create: async (companyId: string, data: CostCenterCreate): Promise<CostCenter> => {
    const response = await api.post(`/companies/${companyId}/cost-centers`, data);
    return response.data;
  },

  get: async (companyId: string, costCenterId: string): Promise<CostCenter> => {
    const response = await api.get(`/companies/${companyId}/cost-centers/${costCenterId}`);
    return response.data;
  },

  update: async (companyId: string, costCenterId: string, data: CostCenterCreate): Promise<CostCenter> => {
    const response = await api.put(`/companies/${companyId}/cost-centers/${costCenterId}`, data);
    return response.data;
  },

  delete: async (companyId: string, costCenterId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/cost-centers/${costCenterId}`);
  },

  getHierarchy: async (companyId: string): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/cost-centers/hierarchy`);
    return response.data;
  },

  // Cost Categories
  listCategories: async (companyId: string, activeOnly: boolean = true): Promise<CostCategory[]> => {
    const response = await api.get(`/companies/${companyId}/cost-categories`, {
      params: { active_only: activeOnly },
    });
    return response.data;
  },

  createCategory: async (companyId: string, data: CostCategoryCreate): Promise<CostCategory> => {
    const response = await api.post(`/companies/${companyId}/cost-categories`, data);
    return response.data;
  },

  initializeCategories: async (companyId: string): Promise<{ message: string }> => {
    const response = await api.post(`/companies/${companyId}/cost-categories/initialize`);
    return response.data;
  },

  // Budgets
  listBudgets: async (
    companyId: string,
    params?: { financial_year?: string; status?: string }
  ): Promise<Budget[]> => {
    const response = await api.get(`/companies/${companyId}/budgets`, { params });
    return response.data;
  },

  createBudget: async (companyId: string, data: BudgetCreate): Promise<Budget> => {
    const response = await api.post(`/companies/${companyId}/budgets`, data);
    return response.data;
  },

  getBudget: async (companyId: string, budgetId: string): Promise<Budget> => {
    const response = await api.get(`/companies/${companyId}/budgets/${budgetId}`);
    return response.data;
  },

  approveBudget: async (companyId: string, budgetId: string): Promise<{ message: string; status: string }> => {
    const response = await api.post(`/companies/${companyId}/budgets/${budgetId}/approve`);
    return response.data;
  },

  activateBudget: async (companyId: string, budgetId: string): Promise<{ message: string; status: string }> => {
    const response = await api.post(`/companies/${companyId}/budgets/${budgetId}/activate`);
    return response.data;
  },

  // Budget Lines
  addBudgetLine: async (companyId: string, budgetId: string, data: BudgetLineCreate): Promise<BudgetLine> => {
    const response = await api.post(`/companies/${companyId}/budgets/${budgetId}/lines`, data);
    return response.data;
  },

  getBudgetLines: async (
    companyId: string,
    budgetId: string,
    params?: { account_id?: string; cost_center_id?: string }
  ): Promise<BudgetLine[]> => {
    const response = await api.get(`/companies/${companyId}/budgets/${budgetId}/lines`, { params });
    return response.data;
  },

  deleteBudgetLine: async (companyId: string, budgetId: string, lineId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/budgets/${budgetId}/lines/${lineId}`);
  },

  // Variance Reports
  getVarianceReport: async (companyId: string, budgetId: string): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/budgets/${budgetId}/variance`);
    return response.data;
  },

  getBudgetSummary: async (companyId: string, financialYear: string): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/budgets/summary/${financialYear}`);
    return response.data;
  },
};

// ============== Currencies Types ==============

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  decimal_places: number;
  is_base_currency: boolean;
  is_active: boolean;
}

export interface CurrencyCreate {
  code: string;
  name: string;
  symbol?: string;
  decimal_places?: number;
}

export interface ExchangeRateCreate {
  from_currency_code: string;
  to_currency_code: string;
  rate: number;
  rate_date?: string;
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  as_of?: string;
}

export interface ConversionRequest {
  amount: number;
  from_currency: string;
  to_currency: string;
  as_of_date?: string;
}

export interface ConversionResponse {
  from_amount: number;
  from_currency: string;
  to_amount: number;
  to_currency: string;
  exchange_rate: number;
  rate_date: string;
}

// ============== Currencies API ==============

export const currenciesApi = {
  // Currencies
  list: async (companyId: string, activeOnly: boolean = true): Promise<Currency[]> => {
    const response = await api.get(`/companies/${companyId}/currencies`, {
      params: { active_only: activeOnly },
    });
    return response.data;
  },

  create: async (companyId: string, data: CurrencyCreate): Promise<Currency> => {
    const response = await api.post(`/companies/${companyId}/currencies`, data);
    return response.data;
  },

  get: async (companyId: string, code: string): Promise<Currency> => {
    const response = await api.get(`/companies/${companyId}/currencies/${code}`);
    return response.data;
  },

  initialize: async (companyId: string): Promise<{ message: string }> => {
    const response = await api.post(`/companies/${companyId}/currencies/initialize`);
    return response.data;
  },

  // Exchange Rates
  setExchangeRate: async (companyId: string, data: ExchangeRateCreate): Promise<any> => {
    const response = await api.post(`/companies/${companyId}/currencies/exchange-rates`, data);
    return response.data;
  },

  getExchangeRate: async (
    companyId: string,
    fromCode: string,
    toCode: string,
    asOf?: string
  ): Promise<ExchangeRate> => {
    const response = await api.get(`/companies/${companyId}/currencies/exchange-rates/${fromCode}/${toCode}`, {
      params: asOf ? { as_of: asOf } : {},
    });
    return response.data;
  },

  getRateHistory: async (
    companyId: string,
    fromCode: string,
    toCode: string,
    limit: number = 30
  ): Promise<{ rate: number; rate_date: string; source: string }[]> => {
    const response = await api.get(
      `/companies/${companyId}/currencies/exchange-rates/${fromCode}/${toCode}/history`,
      { params: { limit } }
    );
    return response.data;
  },

  // Conversion
  convert: async (companyId: string, data: ConversionRequest): Promise<ConversionResponse> => {
    const response = await api.post(`/companies/${companyId}/currencies/convert`, data);
    return response.data;
  },

  // Forex Reports
  getForexSummary: async (
    companyId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/currencies/forex/summary`, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },

  getCurrencyExposure: async (companyId: string): Promise<any> => {
    const response = await api.get(`/companies/${companyId}/currencies/forex/exposure`);
    return response.data;
  },
};

export default api;
