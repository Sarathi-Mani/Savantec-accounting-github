"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import dayjs from "dayjs";
import { accountingApi, Account, ReferenceType, getErrorMessage } from "@/services/api";

interface RecentTransfer {
  id: string;
  date: string;
  from_account: string;
  to_account: string;
  amount: number;
  description: string;
}

export default function TransferPage() {
  const { company } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [transferDate, setTransferDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  // Recent transfers for quick reference
  const [recentTransfers, setRecentTransfers] = useState<RecentTransfer[]>([]);

  // Filter transferable accounts (cash, bank accounts mainly)
  const transferableAccounts = accounts.filter(
    (a) => a.account_type === "asset" && 
           (a.code.startsWith("1001") || a.code.startsWith("1002") || 
            a.name.toLowerCase().includes("cash") || 
            a.name.toLowerCase().includes("bank"))
  );

  // All asset accounts for more flexibility
  const assetAccounts = accounts.filter((a) => a.account_type === "asset");

  useEffect(() => {
    if (company?.id) {
      fetchAccounts();
      fetchRecentTransfers();
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

  const fetchRecentTransfers = async () => {
    try {
      const data = await accountingApi.listTransactions(company!.id, {
        reference_type: "transfer",
        limit: 10,
      });
      
      // Parse transfers from transaction data
      const transfers: RecentTransfer[] = data.transactions
        .filter((t) => t.reference_type === "transfer")
        .map((t) => {
          const debitEntry = t.entries?.find((e) => e.debit_amount > 0);
          const creditEntry = t.entries?.find((e) => e.credit_amount > 0);
          return {
            id: t.id,
            date: t.transaction_date,
            from_account: creditEntry?.account_name || "Unknown",
            to_account: debitEntry?.account_name || "Unknown",
            amount: debitEntry?.debit_amount || 0,
            description: t.description || "",
          };
        });
      setRecentTransfers(transfers);
    } catch (err) {
      // Ignore - recent transfers are not critical
    }
  };

  const handleTransfer = async () => {
    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      setError("Please fill in all required fields");
      return;
    }

    if (fromAccountId === toAccountId) {
      setError("From and To accounts must be different");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const fromAccount = accounts.find((a) => a.id === fromAccountId);
      const toAccount = accounts.find((a) => a.id === toAccountId);

      // Create journal entry for transfer
      // Debit the receiving account, Credit the source account
      const transactionData = {
        transaction_date: transferDate,
        description: description || `Transfer from ${fromAccount?.name} to ${toAccount?.name}`,
        reference_type: "transfer" as ReferenceType,
        entries: [
          {
            account_id: toAccountId,
            description: `Transfer from ${fromAccount?.name}`,
            debit_amount: Number(amount),
            credit_amount: 0,
          },
          {
            account_id: fromAccountId,
            description: `Transfer to ${toAccount?.name}`,
            debit_amount: 0,
            credit_amount: Number(amount),
          },
        ],
      };

      const transaction = await accountingApi.createTransaction(company!.id, transactionData);
      
      // Auto-post the transfer
      await accountingApi.postTransaction(company!.id, transaction.id);

      setSuccess(
        `Successfully transferred ₹${Number(amount).toLocaleString("en-IN")} from ${fromAccount?.name} to ${toAccount?.name}`
      );

      // Reset form
      setFromAccountId("");
      setToAccountId("");
      setAmount("");
      setDescription("");
      setReference("");

      // Refresh recent transfers
      fetchRecentTransfers();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create transfer"));
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

  // Quick transfer presets
  const quickTransfers = [
    { label: "Cash to Bank", fromType: "cash", toType: "bank" },
    { label: "Bank to Cash", fromType: "bank", toType: "cash" },
  ];

  const applyQuickTransfer = (fromType: string, toType: string) => {
    const cashAccount = transferableAccounts.find(
      (a) => a.name.toLowerCase().includes("cash") && !a.name.toLowerCase().includes("bank")
    );
    const bankAccount = transferableAccounts.find(
      (a) => a.name.toLowerCase().includes("bank") || a.code.startsWith("1002")
    );

    if (fromType === "cash" && cashAccount) {
      setFromAccountId(cashAccount.id);
    } else if (fromType === "bank" && bankAccount) {
      setFromAccountId(bankAccount.id);
    }

    if (toType === "cash" && cashAccount) {
      setToAccountId(cashAccount.id);
    } else if (toType === "bank" && bankAccount) {
      setToAccountId(bankAccount.id);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">
            Transfer Funds
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Move money between Cash, Bank, and other asset accounts
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transfer Form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
            {/* Quick Transfer Buttons */}
            <div className="border-b border-stroke p-4 dark:border-dark-3">
              <p className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                Quick Transfer:
              </p>
              <div className="flex flex-wrap gap-2">
                {quickTransfers.map((qt) => (
                  <button
                    key={qt.label}
                    onClick={() => applyQuickTransfer(qt.fromType, qt.toType)}
                    className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-medium text-dark transition hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white dark:hover:border-primary"
                  >
                    {qt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* Transfer Details */}
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    placeholder="e.g., TXN12345"
                  />
                </div>
              </div>

              {/* From / To Visual */}
              <div className="mb-6 flex flex-col items-center gap-4 md:flex-row">
                {/* From Account */}
                <div className="flex-1 w-full">
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    From Account *
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  >
                    <option value="">Select source account</option>
                    <optgroup label="Cash & Bank">
                      {transferableAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other Assets">
                      {assetAccounts
                        .filter((a) => !transferableAccounts.find((t) => t.id === a.id))
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                {/* Arrow */}
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary md:mt-6">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </div>

                {/* To Account */}
                <div className="flex-1 w-full">
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    To Account *
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  >
                    <option value="">Select destination account</option>
                    <optgroup label="Cash & Bank">
                      {transferableAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other Assets">
                      {assetAccounts
                        .filter((a) => !transferableAccounts.find((t) => t.id === a.id))
                        .map((acc) => (
                          <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : "")}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 pl-8 text-xl font-bold text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  placeholder="e.g., Cash deposit to bank"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleTransfer}
                disabled={saving || !fromAccountId || !toAccountId || !amount}
                className="w-full rounded-lg bg-primary py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing Transfer...
                  </span>
                ) : (
                  "Transfer Funds"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Transfers */}
        <div>
          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="border-b border-stroke p-4 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">Recent Transfers</h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-4">
              {recentTransfers.length > 0 ? (
                <div className="space-y-3">
                  {recentTransfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="rounded-lg border border-stroke p-3 dark:border-dark-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium text-dark dark:text-white">
                          {formatCurrency(transfer.amount)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {dayjs(transfer.date).format("DD MMM")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {transfer.from_account} → {transfer.to_account}
                      </div>
                      {transfer.description && (
                        <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
                          {transfer.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  No recent transfers
                </p>
              )}
            </div>
            <div className="border-t border-stroke p-4 dark:border-dark-3">
              <Link
                href="/accounting/transactions?type=transfer"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all transfers →
              </Link>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-4 rounded-lg border border-stroke bg-blue-50 p-4 dark:border-dark-3 dark:bg-blue-900/20">
            <h4 className="mb-2 text-sm font-medium text-blue-700 dark:text-blue-400">
              Common Transfers:
            </h4>
            <ul className="space-y-1 text-xs text-blue-600 dark:text-blue-300">
              <li>• Cash deposit to bank account</li>
              <li>• ATM withdrawal (Bank → Cash)</li>
              <li>• Transfer between bank accounts</li>
              <li>• Petty cash replenishment</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
