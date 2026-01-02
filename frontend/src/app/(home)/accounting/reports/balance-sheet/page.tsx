"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { accountingApi, BalanceSheetResponse, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";

export default function BalanceSheetPage() {
  const { company } = useAuth();
  const [report, setReport] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asOfDate, setAsOfDate] = useState(dayjs().format("YYYY-MM-DD"));

  useEffect(() => {
    if (company?.id) {
      fetchReport();
    }
  }, [company?.id, asOfDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await accountingApi.getBalanceSheet(company!.id, asOfDate);
      setReport(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load balance sheet"));
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

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/accounting" className="hover:text-primary">
              Accounting
            </Link>
            <span>/</span>
            <Link href="/accounting/reports" className="hover:text-primary">
              Reports
            </Link>
            <span>/</span>
            <span>Balance Sheet</span>
          </div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Balance Sheet</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">As of:</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : report ? (
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
          {/* Report Header */}
          <div className="border-b border-stroke p-6 text-center dark:border-dark-3">
            <h2 className="text-lg font-bold text-dark dark:text-white">{company?.name}</h2>
            <p className="text-gray-500 dark:text-gray-400">Balance Sheet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              As of {dayjs(report.as_of_date).format("DD MMMM YYYY")}
            </p>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2">
            {/* Assets Column */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-blue-600 dark:text-blue-400">
                Assets
              </h3>
              <div className="space-y-2">
                {report.assets.accounts.map((acc) => (
                  <div key={acc.account_id || acc.account_name} className="flex justify-between">
                    <span className="text-dark dark:text-white">{acc.account_name}</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(acc.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t-2 border-blue-200 pt-3 font-bold dark:border-blue-800">
                <span className="text-dark dark:text-white">Total Assets</span>
                <span className="text-blue-600">{formatCurrency(report.total_assets)}</span>
              </div>
            </div>

            {/* Liabilities & Equity Column */}
            <div>
              {/* Liabilities */}
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-semibold text-red-600 dark:text-red-400">
                  Liabilities
                </h3>
                <div className="space-y-2">
                  {report.liabilities.accounts.map((acc) => (
                    <div key={acc.account_id || acc.account_name} className="flex justify-between">
                      <span className="text-dark dark:text-white">{acc.account_name}</span>
                      <span className="font-medium text-dark dark:text-white">
                        {formatCurrency(acc.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t border-stroke pt-2 font-bold dark:border-dark-3">
                  <span className="text-dark dark:text-white">Total Liabilities</span>
                  <span className="text-red-600">{formatCurrency(report.liabilities.total)}</span>
                </div>
              </div>

              {/* Equity */}
              <div>
                <h3 className="mb-4 text-lg font-semibold text-purple-600 dark:text-purple-400">
                  Equity
                </h3>
                <div className="space-y-2">
                  {report.equity.accounts.map((acc) => (
                    <div key={acc.account_id || acc.account_name} className="flex justify-between">
                      <span className="text-dark dark:text-white">{acc.account_name}</span>
                      <span className="font-medium text-dark dark:text-white">
                        {formatCurrency(acc.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t border-stroke pt-2 font-bold dark:border-dark-3">
                  <span className="text-dark dark:text-white">Total Equity</span>
                  <span className="text-purple-600">{formatCurrency(report.equity.total)}</span>
                </div>
              </div>

              {/* Total Liabilities & Equity */}
              <div className="mt-4 flex justify-between border-t-2 border-gray-300 pt-3 font-bold dark:border-gray-600">
                <span className="text-dark dark:text-white">Total Liabilities & Equity</span>
                <span className="text-dark dark:text-white">
                  {formatCurrency(report.total_liabilities_equity)}
                </span>
              </div>
            </div>
          </div>

          {/* Balance Status */}
          <div className="border-t border-stroke p-4 dark:border-dark-3">
            {report.is_balanced ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Balance Sheet is balanced</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-red-600">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">
                  Warning: Balance sheet does not balance - Difference:{" "}
                  {formatCurrency(Math.abs(report.total_assets - report.total_liabilities_equity))}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
