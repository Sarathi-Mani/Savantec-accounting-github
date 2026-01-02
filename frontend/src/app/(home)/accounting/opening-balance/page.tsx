"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import dayjs from "dayjs";
import { accountingApi, Account, ReferenceType, getErrorMessage } from "@/services/api";

interface OpeningBalanceEntry {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
}

export default function OpeningBalancePage() {
  const { company } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [balanceDate, setBalanceDate] = useState(
    dayjs().startOf("month").format("YYYY-MM-DD")
  );
  const [entries, setEntries] = useState<OpeningBalanceEntry[]>([]);
  const [description, setDescription] = useState("Opening Balance Entry");

  // Filter for balance sheet accounts (assets, liabilities, equity)
  const balanceSheetAccounts = accounts.filter(
    (a) => ["asset", "liability", "equity"].includes(a.account_type) && !a.is_system
  );

  useEffect(() => {
    if (company?.id) {
      fetchAccounts();
    }
  }, [company?.id]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await accountingApi.listAccounts(company!.id);
      setAccounts(data);
      
      // Initialize entries for balance sheet accounts
      const initialEntries = data
        .filter((a) => ["asset", "liability", "equity"].includes(a.account_type) && !a.is_system)
        .map((a) => ({
          account_id: a.id,
          account_code: a.code,
          account_name: a.name,
          account_type: a.account_type,
          debit: 0,
          credit: 0,
        }));
      setEntries(initialEntries);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (accountId: string, field: "debit" | "credit", value: number) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.account_id === accountId) {
          // Clear the opposite field if setting a value
          if (field === "debit" && value > 0) {
            return { ...e, debit: value, credit: 0 };
          } else if (field === "credit" && value > 0) {
            return { ...e, credit: value, debit: 0 };
          }
          return { ...e, [field]: value };
        }
        return e;
      })
    );
  };

  const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const hasEntries = entries.some((e) => e.debit > 0 || e.credit > 0);

  const handleSave = async () => {
    if (!isBalanced) {
      setError("Debits must equal Credits");
      return;
    }

    const validEntries = entries.filter((e) => e.debit > 0 || e.credit > 0);
    if (validEntries.length === 0) {
      setError("Please enter at least one balance");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Create a journal entry for opening balances
      const transactionData = {
        transaction_date: balanceDate,
        description: description,
        reference_type: "opening_balance" as ReferenceType,
        entries: validEntries.map((e) => ({
          account_id: e.account_id,
          description: `Opening Balance - ${e.account_name}`,
          debit_amount: e.debit,
          credit_amount: e.credit,
        })),
      };

      const transaction = await accountingApi.createTransaction(company!.id, transactionData);
      
      // Auto-post the opening balance entry
      await accountingApi.postTransaction(company!.id, transaction.id);

      setSuccess("Opening balances saved and posted successfully!");
      
      // Reset form
      setEntries((prev) => prev.map((e) => ({ ...e, debit: 0, credit: 0 })));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save opening balances"));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Group accounts by type
  const groupedEntries = {
    asset: entries.filter((e) => e.account_type === "asset"),
    liability: entries.filter((e) => e.account_type === "liability"),
    equity: entries.filter((e) => e.account_type === "equity"),
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">
            Opening Balance
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set initial balances for your accounts at the start of a period
          </p>
        </div>
        <Link
          href="/accounting"
          className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          Back to Accounting
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
        {/* Date & Description */}
        <div className="border-b border-stroke p-6 dark:border-dark-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Opening Balance Date *
              </label>
              <input
                type="date"
                value={balanceDate}
                onChange={(e) => setBalanceDate(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Usually the first day of the month/year
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                placeholder="Opening Balance Entry"
              />
            </div>
          </div>
        </div>

        {/* Balance Entries */}
        <div className="p-6">
          <div className="mb-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>How it works:</strong> Enter the opening balance for each account.
              Assets and Expenses normally have debit balances. Liabilities, Equity, and Income
              normally have credit balances. Totals must balance (Debits = Credits).
            </p>
          </div>

          {/* Assets */}
          <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-dark dark:text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                A
              </span>
              Assets
              <span className="text-sm font-normal text-gray-500">(Normal Debit Balance)</span>
            </h3>
            <div className="space-y-2">
              {groupedEntries.asset.map((entry) => (
                <div
                  key={entry.account_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-stroke p-3 dark:border-dark-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <span className="text-sm font-medium text-dark dark:text-white">
                      {entry.account_code} - {entry.account_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Dr:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.debit || ""}
                      onChange={(e) =>
                        updateEntry(entry.account_id, "debit", parseFloat(e.target.value) || 0)
                      }
                      className="w-32 rounded border border-stroke bg-transparent px-3 py-2 text-right text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Cr:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.credit || ""}
                      onChange={(e) =>
                        updateEntry(entry.account_id, "credit", parseFloat(e.target.value) || 0)
                      }
                      className="w-32 rounded border border-stroke bg-transparent px-3 py-2 text-right text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
              {groupedEntries.asset.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No asset accounts found. Add accounts in Chart of Accounts.
                </p>
              )}
            </div>
          </div>

          {/* Liabilities */}
          <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-dark dark:text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-red-100 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                L
              </span>
              Liabilities
              <span className="text-sm font-normal text-gray-500">(Normal Credit Balance)</span>
            </h3>
            <div className="space-y-2">
              {groupedEntries.liability.map((entry) => (
                <div
                  key={entry.account_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-stroke p-3 dark:border-dark-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <span className="text-sm font-medium text-dark dark:text-white">
                      {entry.account_code} - {entry.account_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Dr:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.debit || ""}
                      onChange={(e) =>
                        updateEntry(entry.account_id, "debit", parseFloat(e.target.value) || 0)
                      }
                      className="w-32 rounded border border-stroke bg-transparent px-3 py-2 text-right text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Cr:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.credit || ""}
                      onChange={(e) =>
                        updateEntry(entry.account_id, "credit", parseFloat(e.target.value) || 0)
                      }
                      className="w-32 rounded border border-stroke bg-transparent px-3 py-2 text-right text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
              {groupedEntries.liability.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No liability accounts found.
                </p>
              )}
            </div>
          </div>

          {/* Equity */}
          <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-dark dark:text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                E
              </span>
              Equity
              <span className="text-sm font-normal text-gray-500">(Normal Credit Balance)</span>
            </h3>
            <div className="space-y-2">
              {groupedEntries.equity.map((entry) => (
                <div
                  key={entry.account_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-stroke p-3 dark:border-dark-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <span className="text-sm font-medium text-dark dark:text-white">
                      {entry.account_code} - {entry.account_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Dr:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.debit || ""}
                      onChange={(e) =>
                        updateEntry(entry.account_id, "debit", parseFloat(e.target.value) || 0)
                      }
                      className="w-32 rounded border border-stroke bg-transparent px-3 py-2 text-right text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Cr:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.credit || ""}
                      onChange={(e) =>
                        updateEntry(entry.account_id, "credit", parseFloat(e.target.value) || 0)
                      }
                      className="w-32 rounded border border-stroke bg-transparent px-3 py-2 text-right text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
              {groupedEntries.equity.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No equity accounts found.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Totals & Actions */}
        <div className="border-t border-stroke p-6 dark:border-dark-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Debits:</span>
                <span className="ml-2 font-bold text-dark dark:text-white">
                  {formatCurrency(totalDebits)}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Credits:</span>
                <span className="ml-2 font-bold text-dark dark:text-white">
                  {formatCurrency(totalCredits)}
                </span>
              </div>
              <div>
                {isBalanced && hasEntries ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Balanced
                  </span>
                ) : hasEntries ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Unbalanced: {formatCurrency(Math.abs(totalDebits - totalCredits))}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !isBalanced || !hasEntries}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Opening Balances"}
            </button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-2">
        <h4 className="mb-2 font-medium text-dark dark:text-white">Tips:</h4>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>Bank Account balances go in Assets (Debit for positive balance)</li>
          <li>Cash in Hand goes in Assets (Debit for positive balance)</li>
          <li>Loans payable go in Liabilities (Credit for amounts owed)</li>
          <li>Owner&apos;s Capital goes in Equity (Credit)</li>
          <li>The difference between Assets and Liabilities should equal Equity</li>
        </ul>
      </div>
    </div>
  );
}
