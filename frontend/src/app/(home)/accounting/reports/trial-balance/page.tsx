"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { accountingApi, TrialBalanceResponse, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";

export default function TrialBalancePage() {
  const { company } = useAuth();
  const [report, setReport] = useState<TrialBalanceResponse | null>(null);
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
      const data = await accountingApi.getTrialBalance(company!.id, asOfDate);
      setReport(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load trial balance"));
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
            <span>Trial Balance</span>
          </div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Trial Balance</h1>
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
            <p className="text-gray-500 dark:text-gray-400">Trial Balance</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              As of {dayjs(report.as_of_date).format("DD MMMM YYYY")}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-2">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Account
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-dark-3">
                {report.entries.map((entry) => (
                  <tr key={entry.account_id} className="hover:bg-gray-50 dark:hover:bg-dark-2">
                    <td className="px-6 py-3">
                      <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
                        {entry.account_code}
                      </span>{" "}
                      <span className="text-dark dark:text-white">{entry.account_name}</span>
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-dark dark:text-white">
                      {entry.debit_balance > 0 ? formatCurrency(entry.debit_balance) : "-"}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-dark dark:text-white">
                      {entry.credit_balance > 0 ? formatCurrency(entry.credit_balance) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-dark-2">
                <tr className="font-bold">
                  <td className="px-6 py-4 text-dark dark:text-white">Total</td>
                  <td className="px-6 py-4 text-right text-dark dark:text-white">
                    {formatCurrency(report.total_debit)}
                  </td>
                  <td className="px-6 py-4 text-right text-dark dark:text-white">
                    {formatCurrency(report.total_credit)}
                  </td>
                </tr>
              </tfoot>
            </table>
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
                <span className="font-medium">Trial Balance is balanced</span>
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
                  Warning: Difference of {formatCurrency(Math.abs(report.total_debit - report.total_credit))}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
