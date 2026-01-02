"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { accountingApi, Transaction, TransactionStatus, ReferenceType, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";

const STATUS_COLORS: Record<TransactionStatus, string> = {
  draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  posted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  reversed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment",
  manual: "Manual Entry",
  bank_import: "Bank Import",
  opening_balance: "Opening Balance",
  transfer: "Transfer",
  cheque: "Cheque",
  purchase_order: "Purchase Order",
  sales_order: "Sales Order",
  purchase_invoice: "Purchase Invoice",
};

export default function TransactionsPage() {
  const { company } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [reconciledFilter, setReconciledFilter] = useState<string>("");

  // Action modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (company?.id) {
      fetchTransactions();
    }
  }, [company?.id, page, statusFilter, typeFilter, fromDate, toDate, reconciledFilter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await accountingApi.listTransactions(company!.id, {
        page,
        page_size: pageSize,
        status: statusFilter as TransactionStatus || undefined,
        reference_type: typeFilter as ReferenceType || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        is_reconciled: reconciledFilter === "" ? undefined : reconciledFilter === "true",
      });
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load transactions"));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handlePost = async (transaction: Transaction) => {
    try {
      setActionLoading(true);
      await accountingApi.postTransaction(company!.id, transaction.id);
      fetchTransactions();
      setSelectedTransaction(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to post transaction"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverse = async (transaction: Transaction) => {
    const reason = prompt("Enter reason for reversal (optional):");
    try {
      setActionLoading(true);
      await accountingApi.reverseTransaction(company!.id, transaction.id, reason || undefined);
      fetchTransactions();
      setSelectedTransaction(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reverse transaction"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconcile = async (transaction: Transaction) => {
    try {
      setActionLoading(true);
      await accountingApi.reconcileTransaction(company!.id, transaction.id);
      fetchTransactions();
      setSelectedTransaction(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reconcile transaction"));
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/accounting" className="hover:text-primary">
              Accounting
            </Link>
            <span>/</span>
            <span>Transactions</span>
          </div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Transactions</h1>
        </div>
        <Link
          href="/accounting/transactions/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition hover:bg-opacity-90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Journal Entry
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-stroke bg-white p-4 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="reversed">Reversed</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="manual">Manual Entry</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="bank_import">Bank Import</option>
              <option value="cheque">Cheque</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
              Reconciled
            </label>
            <select
              value={reconciledFilter}
              onChange={(e) => {
                setReconciledFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            >
              <option value="">All</option>
              <option value="true">Reconciled</option>
              <option value="false">Not Reconciled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">No transactions found</p>
            <Link
              href="/accounting/transactions/new"
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              Create your first journal entry
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-2">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-red-600 dark:text-red-400">
                      Debit
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-green-600 dark:text-green-400">
                      Credit
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-dark-3">
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="hover:bg-gray-50 dark:hover:bg-dark-2"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                          {txn.transaction_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-dark dark:text-white">
                        {dayjs(txn.transaction_date).format("DD MMM YYYY")}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-dark dark:text-white">
                        {txn.description || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {REFERENCE_TYPE_LABELS[txn.reference_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">
                        {formatCurrency(txn.total_debit)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(txn.total_credit)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[txn.status]}`}
                        >
                          {txn.is_reconciled && (
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedTransaction(txn)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-primary dark:hover:bg-dark-3"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-stroke px-4 py-3 dark:border-dark-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded border border-stroke px-3 py-1 text-sm font-medium text-dark disabled:opacity-50 dark:border-dark-3 dark:text-white"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded border border-stroke px-3 py-1 text-sm font-medium text-dark disabled:opacity-50 dark:border-dark-3 dark:text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark dark:text-white">
                {selectedTransaction.transaction_number}
              </h2>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-dark-3"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
                <p className="font-medium text-dark dark:text-white">
                  {dayjs(selectedTransaction.transaction_date).format("DD MMM YYYY")}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Type</span>
                <p className="font-medium text-dark dark:text-white">
                  {REFERENCE_TYPE_LABELS[selectedTransaction.reference_type]}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Description</span>
                <p className="font-medium text-dark dark:text-white">
                  {selectedTransaction.description || "-"}
                </p>
              </div>
            </div>

            {/* Entries Table */}
            <div className="mb-4 overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-2">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      Account
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Debit
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Credit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-dark-3">
                  {selectedTransaction.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2">
                        <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
                          {entry.account_code}
                        </span>{" "}
                        <span className="text-dark dark:text-white">{entry.account_name}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-dark dark:text-white">
                        {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-dark dark:text-white">
                        {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : "-"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold dark:bg-dark-2">
                    <td className="px-4 py-2 text-dark dark:text-white">Total</td>
                    <td className="px-4 py-2 text-right text-dark dark:text-white">
                      {formatCurrency(selectedTransaction.total_debit)}
                    </td>
                    <td className="px-4 py-2 text-right text-dark dark:text-white">
                      {formatCurrency(selectedTransaction.total_credit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {selectedTransaction.status === "draft" && (
                <button
                  onClick={() => handlePost(selectedTransaction)}
                  disabled={actionLoading}
                  className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  Post Transaction
                </button>
              )}
              {selectedTransaction.status === "posted" && !selectedTransaction.reversed_by_id && (
                <button
                  onClick={() => handleReverse(selectedTransaction)}
                  disabled={actionLoading}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  Reverse Transaction
                </button>
              )}
              {selectedTransaction.status === "posted" && !selectedTransaction.is_reconciled && (
                <button
                  onClick={() => handleReconcile(selectedTransaction)}
                  disabled={actionLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  Mark Reconciled
                </button>
              )}
              <button
                onClick={() => setSelectedTransaction(null)}
                className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
