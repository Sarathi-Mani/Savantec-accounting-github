"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { accountingApi, AccountSummary, getErrorMessage } from "@/services/api";

export default function AccountingDashboard() {
  const { company } = useAuth();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (company?.id) {
      fetchSummary();
    }
  }, [company?.id]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await accountingApi.getAccountSummary(company!.id);
      setSummary(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load account summary"));
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Accounting</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage your accounts, transactions, and financial reports
          </p>
        </div>
        <Link
          href="/accounting/monthly"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-opacity-90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Monthly View
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Cash Balance</p>
                <p className="text-xl font-bold text-dark dark:text-white">
                  {formatCurrency(summary.cash_balance)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receivables</p>
                <p className="text-xl font-bold text-dark dark:text-white">
                  {formatCurrency(summary.accounts_receivable)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Payables</p>
                <p className="text-xl font-bold text-dark dark:text-white">
                  {formatCurrency(summary.accounts_payable)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Net Profit</p>
                <p className="text-xl font-bold text-dark dark:text-white">
                  {formatCurrency(summary.total_revenue - summary.total_expenses)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/accounting/transfer"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-primary"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-primary dark:text-white">Transfer Funds</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Cash ↔ Bank</p>
          </div>
        </Link>

        <Link
          href="/accounting/opening-balance"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-primary"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-primary dark:text-white">Opening Balance</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Set initial balances</p>
          </div>
        </Link>

        <Link
          href="/accounting/transactions/new"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-primary"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-primary dark:text-white">Journal Entry</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manual entry</p>
          </div>
        </Link>

        <Link
          href="/accounting/bank-import"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-primary"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-primary dark:text-white">Import CSV</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Bank statements</p>
          </div>
        </Link>
      </div>

      {/* Quick Links */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Chart of Accounts */}
        <Link
          href="/accounting/chart-of-accounts"
          className="group rounded-xl border border-stroke bg-white p-6 shadow-default transition hover:border-primary dark:border-dark-3 dark:bg-gray-dark dark:hover:border-primary"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-dark group-hover:text-primary dark:text-white">
                Chart of Accounts
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage your account structure
              </p>
            </div>
          </div>
        </Link>

        {/* Transactions */}
        <Link
          href="/accounting/transactions"
          className="group rounded-xl border border-stroke bg-white p-6 shadow-default transition hover:border-primary dark:border-dark-3 dark:bg-gray-dark dark:hover:border-primary"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-dark group-hover:text-primary dark:text-white">
                Transactions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                View and create journal entries
              </p>
            </div>
          </div>
        </Link>

        {/* Reports */}
        <Link
          href="/accounting/reports"
          className="group rounded-xl border border-stroke bg-white p-6 shadow-default transition hover:border-primary dark:border-dark-3 dark:bg-gray-dark dark:hover:border-primary"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-dark group-hover:text-primary dark:text-white">
                Financial Reports
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Trial Balance, P&L, Balance Sheet
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Balance Overview */}
      {summary && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Assets vs Liabilities */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <h3 className="mb-4 font-semibold text-dark dark:text-white">Balance Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Assets</span>
                  <span className="font-medium text-green-600">{formatCurrency(summary.total_assets)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${Math.min(100, (summary.total_assets / (summary.total_assets + summary.total_liabilities || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Liabilities</span>
                  <span className="font-medium text-red-600">{formatCurrency(summary.total_liabilities)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width: `${Math.min(100, (summary.total_liabilities / (summary.total_assets + summary.total_liabilities || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Equity</span>
                  <span className="font-medium text-blue-600">{formatCurrency(summary.total_equity)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${Math.min(100, (summary.total_equity / (summary.total_assets || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Revenue vs Expenses */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <h3 className="mb-4 font-semibold text-dark dark:text-white">Income Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Revenue</span>
                  <span className="font-medium text-green-600">{formatCurrency(summary.total_revenue)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${Math.min(100, (summary.total_revenue / (summary.total_revenue + summary.total_expenses || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Expenses</span>
                  <span className="font-medium text-red-600">{formatCurrency(summary.total_expenses)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width: `${Math.min(100, (summary.total_expenses / (summary.total_revenue + summary.total_expenses || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="border-t border-stroke pt-3 dark:border-dark-3">
                <div className="flex justify-between">
                  <span className="font-medium text-dark dark:text-white">Net Profit</span>
                  <span className={`font-bold ${summary.total_revenue - summary.total_expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.total_revenue - summary.total_expenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
