"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface PayrollAccountConfig {
  id: string;
  component_type: string;
  component_name: string;
  account_id?: string;
  account_code?: string;
  account_name?: string;
  is_debit: boolean;
  contra_account_id?: string;
  contra_account_code?: string;
  contra_account_name?: string;
  is_active: boolean;
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  earning: "Earnings (Debit)",
  deduction: "Deductions (Credit)",
  employer_contribution: "Employer Contributions",
  net_pay: "Net Pay",
};

export default function PayrollSettingsPage() {
  const { company } = useAuth();
  const [configs, setConfigs] = useState<PayrollAccountConfig[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configsRes, accountsRes] = await Promise.all([
        api.get(`/companies/${company?.id}/payroll-account-configs`),
        api.get(`/companies/${company?.id}/accounts`),
      ]);
      setConfigs(configsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load payroll account configurations");
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = async (
    configId: string,
    accountId: string,
    isContra: boolean = false
  ) => {
    setSaving(configId);
    setError(null);

    try {
      const payload: any = {};
      if (isContra) {
        payload.contra_account_id = accountId || null;
      } else {
        payload.account_id = accountId || null;
      }

      await api.put(
        `/companies/${company?.id}/payroll-account-configs/${configId}`,
        payload
      );

      setSuccess("Account mapping updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
    } catch (error: any) {
      console.error("Error updating config:", error);
      setError(error.response?.data?.detail || "Failed to update configuration");
    } finally {
      setSaving(null);
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    const type = config.component_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(config);
    return acc;
  }, {} as Record<string, PayrollAccountConfig[]>);

  const getAccountOptions = (isDebit: boolean) => {
    return accounts.filter((acc) => {
      if (isDebit) {
        // Debit accounts are typically expenses (6xxx) or assets (1xxx)
        return acc.code.startsWith("6") || acc.code.startsWith("1");
      } else {
        // Credit accounts are typically liabilities (2xxx)
        return acc.code.startsWith("2") || acc.code.startsWith("1");
      }
    });
  };

  return (
    <>
      <Breadcrumb pageName="Payroll Account Settings" />

      {/* Info Section */}
      <div className="mb-6 rounded-lg border border-stroke bg-blue-50 p-4 dark:border-strokedark dark:bg-boxdark">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
          Payroll Accounting Configuration
        </h3>
        <p className="text-sm text-body dark:text-bodydark">
          Configure which accounts are used when payroll is finalized. These mappings ensure proper
          double-entry bookkeeping entries are created for salary expenses, deductions, and liabilities.
        </p>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-4 rounded-lg bg-success bg-opacity-10 p-4 text-success">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-danger bg-opacity-10 p-4 text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedConfigs).map(([type, typeConfigs]) => (
            <div
              key={type}
              className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
            >
              <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
                <h4 className="text-lg font-semibold text-black dark:text-white">
                  {COMPONENT_TYPE_LABELS[type] || type}
                </h4>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-2 text-left dark:bg-meta-4">
                        <th className="px-4 py-3 font-medium text-black dark:text-white">
                          Component
                        </th>
                        <th className="px-4 py-3 font-medium text-black dark:text-white">
                          {type === "employer_contribution" ? "Expense Account (Dr)" : "Account"}
                        </th>
                        {type === "employer_contribution" && (
                          <th className="px-4 py-3 font-medium text-black dark:text-white">
                            Liability Account (Cr)
                          </th>
                        )}
                        <th className="px-4 py-3 font-medium text-black dark:text-white text-center">
                          Side
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeConfigs.map((config) => (
                        <tr key={config.id} className="border-b border-stroke dark:border-strokedark">
                          <td className="px-4 py-4">
                            <span className="font-medium text-black dark:text-white">
                              {config.component_name}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={config.account_id || ""}
                              onChange={(e) => handleAccountChange(config.id, e.target.value, false)}
                              disabled={saving === config.id}
                              className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                            >
                              <option value="">-- Select Account --</option>
                              {getAccountOptions(config.is_debit).map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                            {saving === config.id && (
                              <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                            )}
                          </td>
                          {type === "employer_contribution" && (
                            <td className="px-4 py-4">
                              <select
                                value={config.contra_account_id || ""}
                                onChange={(e) => handleAccountChange(config.id, e.target.value, true)}
                                disabled={saving === config.id}
                                className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                              >
                                <option value="">-- Select Account --</option>
                                {accounts
                                  .filter((acc) => acc.code.startsWith("2"))
                                  .map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.code} - {acc.name}
                                    </option>
                                  ))}
                              </select>
                            </td>
                          )}
                          <td className="px-4 py-4 text-center">
                            <span
                              className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                                config.is_debit
                                  ? "bg-danger bg-opacity-10 text-danger"
                                  : "bg-success bg-opacity-10 text-success"
                              }`}
                            >
                              {config.is_debit ? "Debit" : "Credit"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 rounded-lg border border-stroke bg-white p-6 dark:border-strokedark dark:bg-boxdark">
        <h4 className="text-lg font-semibold text-black dark:text-white mb-4">
          Understanding Payroll Accounting Entries
        </h4>
        <div className="space-y-4 text-sm text-body dark:text-bodydark">
          <div>
            <strong className="text-black dark:text-white">Earnings (Salary Expense):</strong>
            <p>Debited to expense accounts (6xxx) to record salary costs.</p>
          </div>
          <div>
            <strong className="text-black dark:text-white">Deductions:</strong>
            <p>Credited to liability accounts (2xxx) as amounts payable to government/institutions.</p>
          </div>
          <div>
            <strong className="text-black dark:text-white">Employer Contributions:</strong>
            <p>
              Debited to expense accounts (employer&apos;s cost) and credited to liability accounts
              (amount to be paid).
            </p>
          </div>
          <div>
            <strong className="text-black dark:text-white">Net Pay:</strong>
            <p>Credited to Salary Payable (2400) - the amount to be paid to employees.</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg dark:bg-meta-4">
          <h5 className="font-semibold text-black dark:text-white mb-2">Example Journal Entry:</h5>
          <div className="font-mono text-xs">
            <div className="text-danger">Dr. Salaries & Wages (6100) ₹1,00,000</div>
            <div className="text-danger">Dr. PF Employer Contribution (6101) ₹12,000</div>
            <div className="text-success pl-4">Cr. Salary Payable (2400) ₹88,000</div>
            <div className="text-success pl-4">Cr. PF Payable (2410) ₹24,000</div>
          </div>
        </div>
      </div>
    </>
  );
}

