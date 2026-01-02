"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { accountingApi, CashFlowResponse, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";

export default function CashFlowPage() {
  const { company } = useAuth();
  const [report, setReport] = useState<CashFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState(dayjs().startOf("month" as any).format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));

  useEffect(() => {
    if (company?.id) {
      fetchReport();
    }
  }, [company?.id, fromDate, toDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await accountingApi.getCashFlow(company!.id, fromDate, toDate);
      setReport(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load cash flow statement"));
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

  const setQuickDate = (period: string) => {
    const now = dayjs();
    switch (period) {
      case "thisMonth":
        setFromDate(now.startOf("month" as any).format("YYYY-MM-DD"));
        setToDate(now.format("YYYY-MM-DD"));
        break;
      case "lastMonth":
        setFromDate(now.subtract(1, "month").startOf("month" as any).format("YYYY-MM-DD"));
        setToDate(now.subtract(1, "month").endOf("month" as any).format("YYYY-MM-DD"));
        break;
      case "thisQuarter":
        setFromDate(now.startOf("quarter" as any).format("YYYY-MM-DD"));
        setToDate(now.format("YYYY-MM-DD"));
        break;
      case "thisYear":
        setFromDate(now.startOf("year" as any).format("YYYY-MM-DD"));
        setToDate(now.format("YYYY-MM-DD"));
        break;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/accounting" className="hover:text-primary">
            Accounting
          </Link>
          <span>/</span>
          <Link href="/accounting/reports" className="hover:text-primary">
            Reports
          </Link>
          <span>/</span>
          <span>Cash Flow</span>
        </div>
        <h1 className="text-2xl font-bold text-dark dark:text-white">Cash Flow Statement</h1>
      </div>

      {/* Date Filters */}
      <div className="mb-6 rounded-xl border border-stroke bg-white p-4 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">From:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">To:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setQuickDate("thisMonth")}
              className="rounded border border-stroke px-3 py-1 text-sm text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              This Month
            </button>
            <button
              onClick={() => setQuickDate("lastMonth")}
              className="rounded border border-stroke px-3 py-1 text-sm text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Last Month
            </button>
            <button
              onClick={() => setQuickDate("thisQuarter")}
              className="rounded border border-stroke px-3 py-1 text-sm text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              This Quarter
            </button>
            <button
              onClick={() => setQuickDate("thisYear")}
              className="rounded border border-stroke px-3 py-1 text-sm text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              This Year
            </button>
          </div>
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
            <p className="text-gray-500 dark:text-gray-400">Cash Flow Statement</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {dayjs(report.from_date).format("DD MMM YYYY")} - {dayjs(report.to_date).format("DD MMM YYYY")}
            </p>
          </div>

          <div className="p-6">
            {/* Opening Cash */}
            <div className="mb-6 flex justify-between rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
              <span className="font-medium text-dark dark:text-white">Opening Cash Balance</span>
              <span className="font-bold text-dark dark:text-white">
                {formatCurrency(report.opening_cash)}
              </span>
            </div>

            {/* Operating Activities */}
            <div className="mb-6">
              <h3 className="mb-3 font-semibold text-green-600 dark:text-green-400">
                Cash from Operating Activities
              </h3>
              <div className="space-y-2">
                {report.operating_activities.entries.map((entry, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-dark dark:text-white">{entry.description}</span>
                    <span
                      className={`font-medium ${
                        entry.amount >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {entry.amount >= 0 ? "+" : ""}
                      {formatCurrency(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-stroke pt-3 font-bold dark:border-dark-3">
                <span className="text-dark dark:text-white">Net Operating Cash</span>
                <span
                  className={
                    report.operating_activities.total >= 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {formatCurrency(report.operating_activities.total)}
                </span>
              </div>
            </div>

            {/* Investing Activities */}
            <div className="mb-6">
              <h3 className="mb-3 font-semibold text-blue-600 dark:text-blue-400">
                Cash from Investing Activities
              </h3>
              {report.investing_activities.entries.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {report.investing_activities.entries.map((entry, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-dark dark:text-white">{entry.description}</span>
                        <span
                          className={`font-medium ${
                            entry.amount >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {entry.amount >= 0 ? "+" : ""}
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-stroke pt-3 font-bold dark:border-dark-3">
                    <span className="text-dark dark:text-white">Net Investing Cash</span>
                    <span
                      className={
                        report.investing_activities.total >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {formatCurrency(report.investing_activities.total)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No investing activities</p>
              )}
            </div>

            {/* Financing Activities */}
            <div className="mb-6">
              <h3 className="mb-3 font-semibold text-purple-600 dark:text-purple-400">
                Cash from Financing Activities
              </h3>
              {report.financing_activities.entries.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {report.financing_activities.entries.map((entry, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-dark dark:text-white">{entry.description}</span>
                        <span
                          className={`font-medium ${
                            entry.amount >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {entry.amount >= 0 ? "+" : ""}
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-stroke pt-3 font-bold dark:border-dark-3">
                    <span className="text-dark dark:text-white">Net Financing Cash</span>
                    <span
                      className={
                        report.financing_activities.total >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {formatCurrency(report.financing_activities.total)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No financing activities</p>
              )}
            </div>

            {/* Net Change */}
            <div className="mb-4 flex justify-between border-t-2 border-stroke pt-4 font-bold dark:border-dark-3">
              <span className="text-dark dark:text-white">Net Change in Cash</span>
              <span
                className={report.net_cash_change >= 0 ? "text-green-600" : "text-red-600"}
              >
                {report.net_cash_change >= 0 ? "+" : ""}
                {formatCurrency(report.net_cash_change)}
              </span>
            </div>

            {/* Closing Cash */}
            <div
              className={`rounded-lg p-4 ${
                report.closing_cash >= 0
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-red-50 dark:bg-red-900/20"
              }`}
            >
              <div className="flex justify-between text-lg font-bold">
                <span className="text-dark dark:text-white">Closing Cash Balance</span>
                <span className={report.closing_cash >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(report.closing_cash)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
