"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import dayjs from "dayjs";
import { accountingApi, Account, Transaction, getErrorMessage } from "@/services/api";

interface MonthlyData {
  income: number;
  expenses: number;
  openingBalance: number;
  closingBalance: number;
  transactions: Transaction[];
  incomeByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

export default function MonthlyAccountingPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf("month"));
  
  // Data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({
    income: 0,
    expenses: 0,
    openingBalance: 0,
    closingBalance: 0,
    transactions: [],
    incomeByCategory: {},
    expensesByCategory: {},
  });

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company?.id, currentMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const startDate = currentMonth.format("YYYY-MM-DD");
      const endDate = currentMonth.endOf("month").format("YYYY-MM-DD");

      // Fetch accounts and transactions in parallel
      const [accountsData, transactionsData, plData] = await Promise.all([
        accountingApi.listAccounts(company!.id),
        accountingApi.listTransactions(company!.id, {
          from_date: startDate,
          to_date: endDate,
          status: "posted",
          page_size: 100,
        }),
        accountingApi.getProfitLoss(company!.id, startDate, endDate),
      ]);

      setAccounts(accountsData);

      // Calculate income and expenses from P&L data
      let totalIncome = 0;
      let totalExpenses = 0;
      const incomeByCategory: Record<string, number> = {};
      const expensesByCategory: Record<string, number> = {};

      // Process revenue accounts
      if (plData.revenue?.accounts) {
        plData.revenue.accounts.forEach((acc: any) => {
          const amount = parseFloat(acc.amount) || 0;
          totalIncome += amount;
          incomeByCategory[acc.account_name || acc.name] = amount;
        });
      }
      // Also use total if available
      if (plData.revenue?.total) {
        totalIncome = typeof plData.revenue.total === 'string' ? parseFloat(plData.revenue.total) || totalIncome : plData.revenue.total;
      }

      // Process expense accounts
      if (plData.expenses?.accounts) {
        plData.expenses.accounts.forEach((acc: any) => {
          const amount = parseFloat(acc.amount) || 0;
          totalExpenses += amount;
          expensesByCategory[acc.account_name || acc.name] = amount;
        });
      }
      // Also use total if available
      if (plData.expenses?.total) {
        totalExpenses = typeof plData.expenses.total === 'string' ? parseFloat(plData.expenses.total) || totalExpenses : plData.expenses.total;
      }

      // Calculate opening balance (cash + bank at start of month)
      // Use current_balance or balance field from accounts, or calculate from net change
      const cashAccounts = accountsData.filter(
        (a) => a.account_type === "asset" && 
               (a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"))
      );
      
      // Get current balance from accounts
      const currentBalance = cashAccounts.reduce((sum, a) => {
        const balance = typeof a.current_balance === 'string' 
          ? parseFloat(a.current_balance) 
          : (a.current_balance || 0);
        return sum + balance;
      }, 0);
      
      // Net change = Income - Expenses (for this period)
      const netChange = totalIncome - totalExpenses;
      
      // Opening = Closing - Net Change (simplified approach)
      const openingBalance = currentBalance - netChange;

      setMonthlyData({
        income: totalIncome,
        expenses: totalExpenses,
        openingBalance: openingBalance,
        closingBalance: currentBalance,
        transactions: transactionsData.transactions || [],
        incomeByCategory,
        expensesByCategory,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load monthly data"));
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, "month"));
  };

  const goToNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, "month"));
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(dayjs().startOf("month"));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const isCurrentMonth = currentMonth.isSame(dayjs(), "month");
  const netProfit = monthlyData.income - monthlyData.expenses;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Month Navigation */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="rounded-lg border border-stroke p-2 text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="min-w-[200px] text-center">
            <h1 className="text-2xl font-bold text-dark dark:text-white">
              {currentMonth.format("MMMM YYYY")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monthly Summary
            </p>
          </div>

          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            className="rounded-lg border border-stroke p-2 text-dark transition hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="ml-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
            >
              Today
            </button>
          )}
        </div>

        <Link
          href="/accounting"
          className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          Back
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Main Summary Card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
        {/* Opening Balance */}
        <div className="border-b border-stroke bg-gray-50 px-6 py-4 dark:border-dark-3 dark:bg-dark-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Opening Balance</span>
            <span className="text-lg font-semibold text-dark dark:text-white">
              {formatCurrency(monthlyData.openingBalance)}
            </span>
          </div>
        </div>

        {/* Income & Expenses */}
        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Money In */}
            <div className="rounded-xl bg-green-50 p-4 dark:bg-green-900/20">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/50">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
                  </svg>
                </div>
                <span className="font-medium text-green-700 dark:text-green-400">Money In</span>
              </div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                +{formatCurrency(monthlyData.income)}
              </p>
              
              {/* Income breakdown */}
              {Object.keys(monthlyData.incomeByCategory).length > 0 && (
                <div className="mt-3 space-y-1 border-t border-green-200 pt-3 dark:border-green-800">
                  {Object.entries(monthlyData.incomeByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([name, amount]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span className="text-green-600 dark:text-green-400">{name}</span>
                        <span className="text-green-700 dark:text-green-300">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Money Out */}
            <div className="rounded-xl bg-red-50 p-4 dark:bg-red-900/20">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <span className="font-medium text-red-700 dark:text-red-400">Money Out</span>
              </div>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                -{formatCurrency(monthlyData.expenses)}
              </p>

              {/* Expense breakdown */}
              {Object.keys(monthlyData.expensesByCategory).length > 0 && (
                <div className="mt-3 space-y-1 border-t border-red-200 pt-3 dark:border-red-800">
                  {Object.entries(monthlyData.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([name, amount]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span className="text-red-600 dark:text-red-400">{name}</span>
                        <span className="text-red-700 dark:text-red-300">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Net Profit/Loss */}
          <div className={`mt-6 rounded-xl p-4 text-center ${
            netProfit >= 0 
              ? "bg-blue-50 dark:bg-blue-900/20" 
              : "bg-orange-50 dark:bg-orange-900/20"
          }`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {netProfit >= 0 ? "You saved" : "You spent more than earned"}
            </p>
            <p className={`text-4xl font-bold ${
              netProfit >= 0 
                ? "text-blue-600 dark:text-blue-400" 
                : "text-orange-600 dark:text-orange-400"
            }`}>
              {netProfit >= 0 ? "+" : "-"}{formatCurrency(netProfit)}
            </p>
          </div>
        </div>

        {/* Closing Balance */}
        <div className="border-t border-stroke bg-primary/5 px-6 py-4 dark:border-dark-3 dark:bg-primary/10">
          <div className="flex items-center justify-between">
            <span className="font-medium text-dark dark:text-white">Closing Balance</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(monthlyData.closingBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
          <h2 className="font-semibold text-dark dark:text-white">
            Transactions this month
          </h2>
          <Link
            href={`/accounting/transactions?from_date=${currentMonth.format("YYYY-MM-DD")}&to_date=${currentMonth.endOf("month").format("YYYY-MM-DD")}`}
            className="text-sm text-primary hover:underline"
          >
            View all →
          </Link>
        </div>

        {monthlyData.transactions.length > 0 ? (
          <div className="divide-y divide-stroke dark:divide-dark-3">
            {monthlyData.transactions.slice(0, 10).map((txn) => {
              // Determine if it's money in (positive) or money out (negative)
              // Money IN: Revenue credited OR Cash/Bank debited (payment received)
              // Money OUT: Expense debited OR Cash/Bank credited (payment made)
              const hasRevenueCredit = txn.entries?.some((e) => {
                const acc = accounts.find((a) => a.id === e.account_id);
                return acc?.account_type === "revenue" && e.credit_amount > 0;
              });
              const hasCashBankDebit = txn.entries?.some((e) => {
                const acc = accounts.find((a) => a.id === e.account_id);
                // Cash (1000) or Bank (1010) accounts being debited means money IN
                return acc?.account_type === "asset" && 
                       (acc.code === "1000" || acc.code === "1010" || acc.code?.startsWith("1010-")) && 
                       e.debit_amount > 0;
              });
              const hasExpenseDebit = txn.entries?.some((e) => {
                const acc = accounts.find((a) => a.id === e.account_id);
                return acc?.account_type === "expense" && e.debit_amount > 0;
              });
              
              // It's income/inflow if revenue is credited OR cash/bank is debited (payment received)
              const isMoneyIn = hasRevenueCredit || (hasCashBankDebit && !hasExpenseDebit);
              const amount = txn.total_debit || 0;

              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-dark-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isMoneyIn 
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30" 
                        : "bg-red-100 text-red-600 dark:bg-red-900/30"
                    }`}>
                      {isMoneyIn ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l4-4m-4 4l-4-4" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-dark dark:text-white">
                        {txn.description || txn.transaction_number}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {dayjs(txn.transaction_date).format("DD MMM")} • {txn.reference_type}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${
                    isMoneyIn ? "text-green-600" : "text-red-600"
                  }`}>
                    {isMoneyIn ? "+" : "-"}{formatCurrency(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No transactions this month</p>
            <Link
              href="/accounting/transactions/new"
              className="mt-2 inline-block text-primary hover:underline"
            >
              Create your first entry →
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link
          href="/accounting/transfer"
          className="flex items-center gap-3 rounded-xl border border-stroke bg-white p-4 transition hover:border-primary dark:border-dark-3 dark:bg-gray-dark"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <span className="font-medium text-dark dark:text-white">Transfer</span>
        </Link>

        <Link
          href="/accounting/transactions/new"
          className="flex items-center gap-3 rounded-xl border border-stroke bg-white p-4 transition hover:border-primary dark:border-dark-3 dark:bg-gray-dark"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="font-medium text-dark dark:text-white">Add Entry</span>
        </Link>

        <Link
          href={`/accounting/reports/profit-loss?from_date=${currentMonth.format("YYYY-MM-DD")}&to_date=${currentMonth.endOf("month").format("YYYY-MM-DD")}`}
          className="flex items-center gap-3 rounded-xl border border-stroke bg-white p-4 transition hover:border-primary dark:border-dark-3 dark:bg-gray-dark"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-medium text-dark dark:text-white">Full Report</span>
        </Link>
      </div>
    </div>
  );
}
