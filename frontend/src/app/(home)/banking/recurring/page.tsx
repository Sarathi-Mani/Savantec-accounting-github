"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface RecurringTransaction {
  id: string;
  name: string;
  description?: string;
  voucher_type: string;
  amount: number;
  frequency: string;
  start_date?: string;
  end_date?: string;
  next_date: string;
  day_of_month?: number;
  is_active: boolean;
  occurrences_created?: number;
  total_occurrences?: number;
  category?: string;
  debit_account_id?: string;
  debit_account_name?: string;
  credit_account_id?: string;
  credit_account_name?: string;
  last_transaction_id?: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface AccountMapping {
  id: string;
  category: string;
  name: string;
  mapping_type: string;
  debit_account_id?: string;
  credit_account_id?: string;
}

const VOUCHER_TYPES = [
  { value: "payment", label: "Payment" },
  { value: "receipt", label: "Receipt" },
  { value: "journal", label: "Journal Entry" },
  { value: "contra", label: "Contra" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
];

const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent/Lease" },
  { value: "utilities", label: "Utilities" },
  { value: "internet", label: "Internet/Telecom" },
  { value: "insurance", label: "Insurance" },
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "salary", label: "Salary" },
  { value: "subscription", label: "Subscription" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other_expense", label: "Other Expense" },
];

const INCOME_CATEGORIES = [
  { value: "subscription_income", label: "Subscription Income" },
  { value: "rental_income", label: "Rental Income" },
  { value: "service_income", label: "Service Income" },
  { value: "interest_income", label: "Interest Income" },
  { value: "other_income", label: "Other Income" },
];

export default function RecurringTransactionsPage() {
  const { company } = useAuth();
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountMappings, setAccountMappings] = useState<AccountMapping[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    voucher_type: "payment",
    amount: "",
    frequency: "monthly",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    day_of_month: "",
    total_occurrences: "",
    auto_create: true,
    reminder_days: "3",
    category: "",
    debit_account_id: "",
    credit_account_id: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchTransactions();
      fetchAccounts();
      fetchAccountMappings();
    }
  }, [company]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/companies/${company?.id}/recurring-transactions`
      );
      setTransactions(response.data);
    } catch (error) {
      console.error("Error fetching recurring transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/accounts`);
      setAccounts(response.data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const fetchAccountMappings = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/account-mappings`);
      setAccountMappings(response.data);
    } catch (error) {
      console.error("Error fetching account mappings:", error);
    }
  };

  // Auto-fill accounts when category changes
  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({ ...prev, category }));
    
    // Find matching account mapping
    const mappingType = ["payment", "purchase"].includes(formData.voucher_type) 
      ? "recurring_expense" 
      : "recurring_income";
    
    const mapping = accountMappings.find(
      m => m.category === category && m.mapping_type === mappingType
    );
    
    if (mapping) {
      setFormData(prev => ({
        ...prev,
        category,
        debit_account_id: mapping.debit_account_id || "",
        credit_account_id: mapping.credit_account_id || "",
      }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      voucher_type: "payment",
      amount: "",
      frequency: "monthly",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      day_of_month: "",
      total_occurrences: "",
      auto_create: true,
      reminder_days: "3",
      category: "",
      debit_account_id: "",
      credit_account_id: "",
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    // Validation
    if (!formData.name.trim()) {
      setError("Name is required");
      setSaving(false);
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      setSaving(false);
      return;
    }

    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        voucher_type: formData.voucher_type,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        start_date: new Date(formData.start_date).toISOString(),
        auto_create: formData.auto_create,
        reminder_days: parseInt(formData.reminder_days) || 3,
      };

      if (formData.end_date) {
        payload.end_date = new Date(formData.end_date).toISOString();
      }
      if (formData.day_of_month) {
        payload.day_of_month = parseInt(formData.day_of_month);
      }
      if (formData.total_occurrences) {
        payload.total_occurrences = parseInt(formData.total_occurrences);
      }
      // Account mapping fields
      if (formData.category) {
        payload.category = formData.category;
      }
      if (formData.debit_account_id) {
        payload.debit_account_id = formData.debit_account_id;
      }
      if (formData.credit_account_id) {
        payload.credit_account_id = formData.credit_account_id;
      }

      await api.post(`/companies/${company?.id}/recurring-transactions`, payload);
      
      setSuccess("Recurring transaction created successfully!");
      setShowModal(false);
      resetForm();
      fetchTransactions();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error creating recurring transaction:", error);
      setError(error.response?.data?.detail || "Failed to create recurring transaction");
    } finally {
      setSaving(false);
    }
  };

  const handlePauseResume = async (txn: RecurringTransaction) => {
    try {
      const action = txn.is_active ? "pause" : "resume";
      await api.post(`/companies/${company?.id}/recurring-transactions/${txn.id}/${action}`);
      fetchTransactions();
      setSuccess(`Recurring transaction ${action}d successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error updating recurring transaction:", error);
      setError(error.response?.data?.detail || "Failed to update transaction");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async (txn: RecurringTransaction) => {
    if (!confirm(`Are you sure you want to delete "${txn.name}"?`)) return;
    
    try {
      await api.delete(`/companies/${company?.id}/recurring-transactions/${txn.id}`);
      fetchTransactions();
      setSuccess("Recurring transaction deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error deleting recurring transaction:", error);
      setError(error.response?.data?.detail || "Failed to delete transaction");
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Recurring Transactions" />

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 rounded-lg bg-success bg-opacity-10 p-4 text-success">
          {success}
        </div>
      )}
      {error && !showModal && (
        <div className="mb-4 rounded-lg bg-danger bg-opacity-10 p-4 text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-body dark:text-bodydark">
          Set up automatic payments, receipts, or journal entries that repeat on a schedule.
        </p>
        <button 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90"
        >
          + Add Recurring Transaction
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Accounts</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Frequency</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Next Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-5 text-center">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-body">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-12 w-12 text-body opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <p>No recurring transactions found</p>
                      <p className="text-sm">Set up recurring payments, receipts, or journal entries.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <div>
                        <p className="font-medium text-black dark:text-white">{txn.name}</p>
                        {txn.description && (
                          <p className="text-sm text-body">{txn.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                        txn.voucher_type === "payment" ? "bg-danger bg-opacity-10 text-danger" :
                        txn.voucher_type === "receipt" ? "bg-success bg-opacity-10 text-success" :
                        "bg-primary bg-opacity-10 text-primary"
                      }`}>
                        {txn.voucher_type?.charAt(0).toUpperCase() + txn.voucher_type?.slice(1)}
                      </span>
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark font-medium">
                      ₹{txn.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      {txn.debit_account_name || txn.credit_account_name ? (
                        <div className="text-xs">
                          {txn.debit_account_name && (
                            <div className="text-danger">Dr: {txn.debit_account_name}</div>
                          )}
                          {txn.credit_account_name && (
                            <div className="text-success">Cr: {txn.credit_account_name}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-body">Not configured</span>
                      )}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark capitalize">
                      {txn.frequency?.replace("_", "-")}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      {txn.next_date ? new Date(txn.next_date).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        txn.is_active 
                          ? "bg-success bg-opacity-10 text-success" 
                          : "bg-warning bg-opacity-10 text-warning"
                      }`}>
                        {txn.is_active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePauseResume(txn)}
                          className={`rounded px-3 py-1 text-sm font-medium ${
                            txn.is_active
                              ? "bg-warning bg-opacity-10 text-warning hover:bg-opacity-20"
                              : "bg-success bg-opacity-10 text-success hover:bg-opacity-20"
                          }`}
                        >
                          {txn.is_active ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => handleDelete(txn)}
                          className="rounded bg-danger bg-opacity-10 px-3 py-1 text-sm font-medium text-danger hover:bg-opacity-20"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Recurring Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 dark:bg-boxdark max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-black dark:text-white">
                Add Recurring Transaction
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-body hover:text-danger"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-danger bg-opacity-10 p-3 text-sm text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Monthly Rent Payment"
                  className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Transaction Type <span className="text-danger">*</span>
                  </label>
                  <select
                    name="voucher_type"
                    value={formData.voucher_type}
                    onChange={handleInputChange}
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  >
                    {VOUCHER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Amount <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Frequency <span className="text-danger">*</span>
                  </label>
                  <select
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleInputChange}
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Day of Month
                  </label>
                  <input
                    type="number"
                    name="day_of_month"
                    value={formData.day_of_month}
                    onChange={handleInputChange}
                    placeholder="1-31"
                    min="1"
                    max="31"
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Start Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Total Occurrences
                  </label>
                  <input
                    type="number"
                    name="total_occurrences"
                    value={formData.total_occurrences}
                    onChange={handleInputChange}
                    placeholder="Leave empty for unlimited"
                    min="1"
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Reminder Days Before
                  </label>
                  <input
                    type="number"
                    name="reminder_days"
                    value={formData.reminder_days}
                    onChange={handleInputChange}
                    min="0"
                    max="30"
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  />
                </div>
              </div>

              {/* Account Mapping Section */}
              <div className="mb-4 p-4 rounded-lg border border-stroke bg-gray-50 dark:border-strokedark dark:bg-meta-4">
                <h4 className="text-sm font-semibold text-black dark:text-white mb-3">
                  Accounting Configuration
                </h4>
                <p className="text-xs text-body mb-4">
                  Select a category to auto-fill accounts, or manually select debit/credit accounts.
                </p>
                
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full rounded border border-stroke bg-white px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark"
                  >
                    <option value="">-- Select Category --</option>
                    {["payment", "purchase"].includes(formData.voucher_type) ? (
                      <>
                        <optgroup label="Expenses">
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      <>
                        <optgroup label="Income">
                          {INCOME_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                      Debit Account
                    </label>
                    <select
                      name="debit_account_id"
                      value={formData.debit_account_id}
                      onChange={handleInputChange}
                      className="w-full rounded border border-stroke bg-white px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark text-sm"
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                      Credit Account
                    </label>
                    <select
                      name="credit_account_id"
                      value={formData.credit_account_id}
                      onChange={handleInputChange}
                      className="w-full rounded border border-stroke bg-white px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark text-sm"
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="auto_create"
                    checked={formData.auto_create}
                    onChange={handleInputChange}
                    className="h-5 w-5 rounded border-stroke"
                  />
                  <span className="text-sm text-black dark:text-white">
                    Auto-create voucher when due
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-stroke px-6 py-2 font-medium text-body hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Saving...
                    </>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
