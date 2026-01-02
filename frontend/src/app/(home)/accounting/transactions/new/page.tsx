"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { accountingApi, Account, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";

interface EntryLine {
  id: string;
  account_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
}

export default function NewJournalEntryPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [transactionDate, setTransactionDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [description, setDescription] = useState("");
  const [entries, setEntries] = useState<EntryLine[]>([
    { id: "1", account_id: "", description: "", debit_amount: 0, credit_amount: 0 },
    { id: "2", account_id: "", description: "", debit_amount: 0, credit_amount: 0 },
  ]);
  const [autoPost, setAutoPost] = useState(false);

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
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  };

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        id: Date.now().toString(),
        account_id: "",
        description: "",
        debit_amount: 0,
        credit_amount: 0,
      },
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 2) return;
    setEntries(entries.filter((e) => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof EntryLine, value: string | number) => {
    setEntries(
      entries.map((e) => {
        if (e.id !== id) return e;

        const updated = { ...e, [field]: value };

        // If debit is entered, clear credit and vice versa
        const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        if (field === "debit_amount" && numValue > 0) {
          updated.credit_amount = 0;
        } else if (field === "credit_amount" && numValue > 0) {
          updated.debit_amount = 0;
        }

        return updated;
      })
    );
  };

  const totalDebit = entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      setError("Debits must equal credits");
      return;
    }

    const validEntries = entries.filter(
      (e) => e.account_id && (e.debit_amount > 0 || e.credit_amount > 0)
    );

    if (validEntries.length < 2) {
      setError("At least two entries are required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await accountingApi.createTransaction(
        company!.id,
        {
          transaction_date: new Date(transactionDate).toISOString(),
          description: description || undefined,
          reference_type: "manual",
          entries: validEntries.map((e) => ({
            account_id: e.account_id,
            description: e.description || undefined,
            debit_amount: e.debit_amount,
            credit_amount: e.credit_amount,
          })),
        },
        autoPost
      );

      router.push("/accounting/transactions");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create journal entry"));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Group accounts by type for the dropdown
  const groupedAccounts = accounts.reduce(
    (acc, account) => {
      const type = account.account_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(account);
      return acc;
    },
    {} as Record<string, Account[]>
  );

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
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/accounting" className="hover:text-primary">
            Accounting
          </Link>
          <span>/</span>
          <Link href="/accounting/transactions" className="hover:text-primary">
            Transactions
          </Link>
          <span>/</span>
          <span>New Journal Entry</span>
        </div>
        <h1 className="text-2xl font-bold text-dark dark:text-white">New Journal Entry</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6 rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          {/* Header Info */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block font-medium text-dark dark:text-white">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="mb-2 block font-medium text-dark dark:text-white">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Monthly rent payment"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              />
            </div>
          </div>

          {/* Entries Table */}
          <div className="mb-4 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="pb-3 text-left font-medium text-dark dark:text-white">
                    Account <span className="text-red-500">*</span>
                  </th>
                  <th className="pb-3 text-left font-medium text-dark dark:text-white">
                    Description
                  </th>
                  <th className="pb-3 text-right font-medium text-dark dark:text-white">
                    Debit
                  </th>
                  <th className="pb-3 text-right font-medium text-dark dark:text-white">
                    Credit
                  </th>
                  <th className="pb-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-stroke dark:border-dark-3">
                    <td className="py-3 pr-2">
                      <select
                        value={entry.account_id}
                        onChange={(e) => updateEntry(entry.id, "account_id", e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                        required
                      >
                        <option value="">Select Account</option>
                        {Object.entries(groupedAccounts).map(([type, accs]) => (
                          <optgroup
                            key={type}
                            label={type.charAt(0).toUpperCase() + type.slice(1) + "s"}
                          >
                            {accs.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="text"
                        value={entry.description}
                        onChange={(e) => updateEntry(entry.id, "description", e.target.value)}
                        placeholder="Line description"
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.debit_amount || ""}
                        onChange={(e) =>
                          updateEntry(entry.id, "debit_amount", parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className="w-28 rounded-lg border border-stroke bg-transparent px-3 py-2 text-right text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.credit_amount || ""}
                        onChange={(e) =>
                          updateEntry(entry.id, "credit_amount", parseFloat(e.target.value) || 0)
                        }
                        placeholder="0.00"
                        className="w-28 rounded-lg border border-stroke bg-transparent px-3 py-2 text-right text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      />
                    </td>
                    <td className="py-3 pl-2">
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        disabled={entries.length <= 2}
                        className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/30"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-gray-50 font-bold dark:bg-dark-2">
                  <td colSpan={2} className="py-3 pr-2 text-dark dark:text-white">
                    Totals
                  </td>
                  <td className="py-3 px-2 text-right text-dark dark:text-white">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="py-3 px-2 text-right text-dark dark:text-white">
                    {formatCurrency(totalCredit)}
                  </td>
                  <td></td>
                </tr>
                {/* Difference Row */}
                {!isBalanced && totalDebit + totalCredit > 0 && (
                  <tr className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <td colSpan={2} className="py-2 pr-2 font-medium">
                      Difference (must be zero)
                    </td>
                    <td colSpan={2} className="py-2 px-2 text-right font-bold">
                      {formatCurrency(Math.abs(totalDebit - totalCredit))}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addEntry}
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Line
          </button>
        </div>

        {/* Options & Submit */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-dark dark:text-white">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              className="h-5 w-5 rounded border-stroke text-primary focus:ring-primary dark:border-dark-3"
            />
            <span>Post immediately (update account balances)</span>
          </label>

          <div className="flex gap-3">
            <Link
              href="/accounting/transactions"
              className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !isBalanced}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : autoPost ? "Save & Post" : "Save as Draft"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
