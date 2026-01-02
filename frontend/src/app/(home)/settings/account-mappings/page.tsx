"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface AccountMapping {
  id: string;
  mapping_type: string;
  category: string;
  name: string;
  debit_account_id?: string;
  debit_account_code?: string;
  debit_account_name?: string;
  credit_account_id?: string;
  credit_account_code?: string;
  credit_account_name?: string;
  is_system: boolean;
  is_active: boolean;
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

const MAPPING_TYPE_LABELS: Record<string, string> = {
  recurring_expense: "Recurring Expenses",
  recurring_income: "Recurring Income",
};

const MAPPING_TYPE_DESCRIPTIONS: Record<string, string> = {
  recurring_expense:
    "Configure default accounts for recurring expense payments like rent, utilities, and subscriptions.",
  recurring_income:
    "Configure default accounts for recurring income like subscription fees and rental income.",
};

export default function AccountMappingsPage() {
  const { company } = useAuth();
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("recurring_expense");

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mappingsRes, accountsRes] = await Promise.all([
        api.get(`/companies/${company?.id}/account-mappings`),
        api.get(`/companies/${company?.id}/accounts`),
      ]);
      setMappings(mappingsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load account mappings");
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = async (
    mappingId: string,
    field: "debit_account_id" | "credit_account_id",
    value: string
  ) => {
    setSaving(mappingId);
    setError(null);

    try {
      const payload: any = {};
      payload[field] = value || null;

      await api.put(`/companies/${company?.id}/account-mappings/${mappingId}`, payload);

      setSuccess("Account mapping updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (error: any) {
      console.error("Error updating mapping:", error);
      setError(error.response?.data?.detail || "Failed to update mapping");
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Are you sure you want to reset all account mappings to defaults? This will overwrite any custom configurations."
      )
    ) {
      return;
    }

    setResetting(true);
    setError(null);

    try {
      await api.post(`/companies/${company?.id}/account-mappings/reset`);
      setSuccess("Account mappings reset to defaults");
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (error: any) {
      console.error("Error resetting mappings:", error);
      setError(error.response?.data?.detail || "Failed to reset mappings");
    } finally {
      setResetting(false);
    }
  };

  const filteredMappings = mappings.filter((m) => m.mapping_type === activeTab);

  const expenseAccounts = accounts.filter(
    (acc) => acc.code.startsWith("5") || acc.code.startsWith("6")
  );
  const incomeAccounts = accounts.filter((acc) => acc.code.startsWith("4"));
  const assetAccounts = accounts.filter((acc) => acc.code.startsWith("1"));
  const liabilityAccounts = accounts.filter((acc) => acc.code.startsWith("2"));

  return (
    <>
      <Breadcrumb pageName="Account Mapping Templates" />

      {/* Info Section */}
      <div className="mb-6 rounded-lg border border-stroke bg-blue-50 p-4 dark:border-strokedark dark:bg-boxdark">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
          Default Account Templates
        </h3>
        <p className="text-sm text-body dark:text-bodydark">
          These templates define the default debit and credit accounts for different types of
          transactions. When you create a recurring transaction with a specific category, these
          accounts will be automatically selected.
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-4 rounded-lg bg-success bg-opacity-10 p-4 text-success">{success}</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-danger bg-opacity-10 p-4 text-danger">{error}</div>
      )}

      {/* Action Bar */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 rounded bg-warning px-4 py-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
        >
          {resetting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              Resetting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset to Defaults
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b border-stroke dark:border-strokedark">
        {Object.entries(MAPPING_TYPE_LABELS).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === type
                ? "border-b-2 border-primary text-primary"
                : "text-body hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="mb-4 text-sm text-body dark:text-bodydark">
        {MAPPING_TYPE_DESCRIPTIONS[activeTab]}
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                  <th className="px-4 py-4 font-medium text-black dark:text-white">Category</th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Debit Account
                    <span className="ml-1 text-xs text-danger">(Dr)</span>
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Credit Account
                    <span className="ml-1 text-xs text-success">(Cr)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-body">
                      No mappings found. Click &quot;Reset to Defaults&quot; to create default templates.
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map((mapping) => (
                    <tr key={mapping.id} className="border-b border-stroke dark:border-strokedark">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-black dark:text-white">{mapping.name}</p>
                          <p className="text-xs text-body capitalize">
                            {mapping.category.replace(/_/g, " ")}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={mapping.debit_account_id || ""}
                          onChange={(e) =>
                            handleAccountChange(mapping.id, "debit_account_id", e.target.value)
                          }
                          disabled={saving === mapping.id}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                        >
                          <option value="">-- Select Account --</option>
                          {activeTab === "recurring_expense" ? (
                            <>
                              <optgroup label="Expense Accounts">
                                {expenseAccounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Liability Accounts">
                                {liabilityAccounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name}
                                  </option>
                                ))}
                              </optgroup>
                            </>
                          ) : (
                            <optgroup label="Asset Accounts (Bank/Cash)">
                              {assetAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        {saving === mapping.id && (
                          <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={mapping.credit_account_id || ""}
                          onChange={(e) =>
                            handleAccountChange(mapping.id, "credit_account_id", e.target.value)
                          }
                          disabled={saving === mapping.id}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                        >
                          <option value="">-- Select Account --</option>
                          {activeTab === "recurring_expense" ? (
                            <optgroup label="Asset Accounts (Bank/Cash)">
                              {assetAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </optgroup>
                          ) : (
                            <optgroup label="Income Accounts">
                              {incomeAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 rounded-lg border border-stroke bg-white p-6 dark:border-strokedark dark:bg-boxdark">
        <h4 className="text-lg font-semibold text-black dark:text-white mb-4">
          How Account Templates Work
        </h4>
        <div className="space-y-4 text-sm text-body dark:text-bodydark">
          <div>
            <strong className="text-black dark:text-white">Recurring Expenses:</strong>
            <p>
              When you create a recurring expense (like rent), the debit account (expense) and credit
              account (bank/cash) are automatically selected based on the category you choose.
            </p>
            <div className="mt-2 p-3 bg-gray-50 rounded dark:bg-meta-4 font-mono text-xs">
              <div className="text-danger">Dr. Rent Expense (6200) ₹50,000</div>
              <div className="text-success pl-4">Cr. Bank (1010) ₹50,000</div>
            </div>
          </div>
          <div>
            <strong className="text-black dark:text-white">Recurring Income:</strong>
            <p>
              For recurring income (like subscription fees), the debit account (bank) receives money
              and the credit account (revenue) records the income.
            </p>
            <div className="mt-2 p-3 bg-gray-50 rounded dark:bg-meta-4 font-mono text-xs">
              <div className="text-danger">Dr. Bank (1010) ₹10,000</div>
              <div className="text-success pl-4">Cr. Service Revenue (4100) ₹10,000</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

