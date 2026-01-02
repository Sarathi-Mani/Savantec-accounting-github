"use client";

import { useAuth } from "@/context/AuthContext";
import { companiesApi, BankAccount, getErrorMessage } from "@/services/api";
import { useEffect, useState } from "react";

export default function BankAccountsPage() {
  const { company, refreshCompanies } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyFormData = {
    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc_code: "",
    branch: "",
    upi_id: "",
    is_default: false,
    opening_balance: 0,
  };

  const [formData, setFormData] = useState(emptyFormData);

  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }
      try {
        const accounts = await companiesApi.listBankAccounts(company.id);
        setBankAccounts(accounts);
      } catch (error) {
        console.error("Failed to fetch bank accounts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBankAccounts();
  }, [company?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
    setError(null);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingId(account.id);
    setFormData({
      bank_name: account.bank_name,
      account_name: account.account_name,
      account_number: account.account_number,
      ifsc_code: account.ifsc_code,
      branch: account.branch || "",
      upi_id: account.upi_id || "",
      is_default: account.is_default,
      opening_balance: account.opening_balance || 0,
    });
    setShowForm(true);
    setError(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.bank_name || !formData.account_name || !formData.account_number || !formData.ifsc_code) {
      setError("Please fill in all required fields");
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      if (editingId) {
        // Update existing
        const updatedAccount = await companiesApi.updateBankAccount(company.id, editingId, formData);
        setBankAccounts((prev) =>
          prev.map((acc) => (acc.id === editingId ? updatedAccount : acc))
        );
      } else {
        // Create new
        const newAccount = await companiesApi.addBankAccount(company.id, formData);
        setBankAccounts((prev) => [...prev, newAccount]);
      }
      resetForm();
      await refreshCompanies();
    } catch (error: any) {
      setError(getErrorMessage(error, `Failed to ${editingId ? "update" : "add"} bank account`));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!company?.id) return;

    try {
      await companiesApi.deleteBankAccount(company.id, accountId);
      setBankAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
      setDeleteConfirm(null);
      await refreshCompanies();
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to delete bank account"));
    }
  };

  const handleSetDefault = async (account: BankAccount) => {
    if (!company?.id || account.is_default) return;

    try {
      await companiesApi.updateBankAccount(company.id, account.id, { is_default: true });
      setBankAccounts((prev) =>
        prev.map((acc) => ({
          ...acc,
          is_default: acc.id === account.id ? true : false,
        }))
      );
      await refreshCompanies();
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to set default"));
    }
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Bank Accounts</h1>
          <p className="text-sm text-dark-6">Manage bank accounts for payment collection</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Bank Account
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
              Delete Bank Account
            </h3>
            <p className="mb-4 text-sm text-dark-6">
              Are you sure you want to delete this bank account? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
            {editingId ? "Edit Bank Account" : "Add Bank Account"}
          </h2>
          
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                  placeholder="HDFC Bank"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Account Holder Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="account_name"
                  value={formData.account_name}
                  onChange={handleChange}
                  placeholder="Account holder name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleChange}
                  placeholder="1234567890123456"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ifsc_code"
                  value={formData.ifsc_code}
                  onChange={handleChange}
                  placeholder="HDFC0001234"
                  maxLength={11}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 uppercase outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Branch
                </label>
                <input
                  type="text"
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  placeholder="Branch name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  UPI ID
                </label>
                <input
                  type="text"
                  name="upi_id"
                  value={formData.upi_id}
                  onChange={handleChange}
                  placeholder="yourname@bank"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  name="opening_balance"
                  value={formData.opening_balance}
                  onChange={handleChange}
                  placeholder="0"
                  step="0.01"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
                <p className="mt-1 text-xs text-gray-500">Current balance as of today</p>
              </div>
              <div className="flex items-center sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_default"
                    checked={formData.is_default}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-dark dark:text-white">Set as default bank account</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                {formLoading ? "Saving..." : editingId ? "Update Account" : "Add Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bank Accounts List */}
      <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-dark-6">No bank accounts added yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              Add your first bank account
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stroke dark:divide-dark-3">
            {bankAccounts.map((account) => (
              <div key={account.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-dark dark:text-white">{account.bank_name}</h3>
                        {account.is_default && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-dark-6">{account.account_name}</p>
                      <div className="mt-2 grid gap-1 text-sm">
                        <p>
                          <span className="text-dark-6">A/C: </span>
                          <span className="font-medium text-dark dark:text-white">
                            XXXX{account.account_number.slice(-4)}
                          </span>
                        </p>
                        <p>
                          <span className="text-dark-6">IFSC: </span>
                          <span className="font-medium text-dark dark:text-white">{account.ifsc_code}</span>
                        </p>
                        {account.branch && (
                          <p>
                            <span className="text-dark-6">Branch: </span>
                            <span className="text-dark dark:text-white">{account.branch}</span>
                          </p>
                        )}
                        {account.upi_id && (
                          <p>
                            <span className="text-dark-6">UPI: </span>
                            <span className="font-medium text-primary">{account.upi_id}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Balance Display */}
                  <div className="mr-4 text-right">
                    <p className="text-sm text-dark-6">Current Balance</p>
                    <p className="text-xl font-bold text-dark dark:text-white">
                      {formatCurrency(account.current_balance || 0)}
                    </p>
                    {account.opening_balance !== account.current_balance && (
                      <p className="text-xs text-gray-500">
                        Opening: {formatCurrency(account.opening_balance || 0)}
                      </p>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {!account.is_default && (
                      <button
                        onClick={() => handleSetDefault(account)}
                        className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                        title="Set as default"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(account)}
                      className="rounded p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      title="Edit"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(account.id)}
                      className="rounded p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
