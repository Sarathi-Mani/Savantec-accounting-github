"use client";

import { useAuth } from "@/context/AuthContext";
import {
  businessDashboardApi,
  BusinessSummary,
  GSTSummaryDashboard,
  TDSSummary,
  ITCSummaryDashboard,
  RecentActivity,
  OutstandingSummary,
} from "@/services/api";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

type Period = "month" | "quarter" | "year";

export default function BusinessOverviewPage() {
  const { company } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [gstSummary, setGstSummary] = useState<GSTSummaryDashboard | null>(null);
  const [tdsSummary, setTdsSummary] = useState<TDSSummary | null>(null);
  const [itcSummary, setItcSummary] = useState<ITCSummaryDashboard | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingSummary | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [summaryData, gstData, tdsData, itcData, activityData, outstandingData] =
          await Promise.all([
            businessDashboardApi.getSummary(company.id, period),
            businessDashboardApi.getGSTSummary(company.id, period),
            businessDashboardApi.getTDSSummary(company.id, period),
            businessDashboardApi.getITCSummary(company.id, period),
            businessDashboardApi.getRecentActivity(company.id, 10),
            businessDashboardApi.getOutstanding(company.id),
          ]);

        setSummary(summaryData);
        setGstSummary(gstData);
        setTdsSummary(tdsData);
        setItcSummary(itcData);
        setRecentActivity(activityData.activities);
        setOutstanding(outstandingData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [company?.id, period]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "invoice":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        );
      case "purchase_order":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
        );
      case "payment_received":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900/30">
            <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const colors: Record<string, string> = {
      paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      draft: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
      cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };

    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Business Overview</h1>
          <p className="text-sm text-dark-6">
            {summary?.period && (
              <>
                {dayjs(summary.period.from).format("DD MMM")} - {dayjs(summary.period.to).format("DD MMM YYYY")}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {(["month", "quarter", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                period === p
                  ? "bg-primary text-white"
                  : "bg-white text-dark hover:bg-gray-100 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-3"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-6">Total Sales</p>
              <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(summary?.total_sales || 0)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-6">Total Purchases</p>
              <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(summary?.total_purchases || 0)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-6">Net Position</p>
              <p className={`mt-1 text-2xl font-bold ${(summary?.net_position || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(summary?.net_position || 0)}
              </p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${(summary?.net_position || 0) >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <svg className={`h-6 w-6 ${(summary?.net_position || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* GST and TDS Summary */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* GST Summary */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark dark:text-white">GST Summary</h2>
            {gstSummary?.due_date && (
              <span className="text-xs text-dark-6">
                Due: {dayjs(gstSummary.due_date).format("DD MMM")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
              <p className="text-xs text-dark-6">Output GST</p>
              <p className="mt-1 text-lg font-bold text-dark dark:text-white">
                {formatCurrency(gstSummary?.output_gst || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
              <p className="text-xs text-dark-6">Input GST</p>
              <p className="mt-1 text-lg font-bold text-dark dark:text-white">
                {formatCurrency(gstSummary?.input_gst || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <p className="text-xs text-primary">Net Payable</p>
              <p className="mt-1 text-lg font-bold text-primary">
                {formatCurrency(gstSummary?.net_payable || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* TDS Summary */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark dark:text-white">TDS Summary</h2>
            {tdsSummary?.due_date && (
              <span className="text-xs text-dark-6">
                Due: {dayjs(tdsSummary.due_date).format("DD MMM")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
              <p className="text-xs text-dark-6">Deducted</p>
              <p className="mt-1 text-lg font-bold text-dark dark:text-white">
                {formatCurrency(tdsSummary?.total_deducted || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
              <p className="text-xs text-dark-6">Deposited</p>
              <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">
                {formatCurrency(tdsSummary?.total_deposited || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
              <p className="text-xs text-orange-600 dark:text-orange-400">Pending</p>
              <p className="mt-1 text-lg font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(tdsSummary?.pending_deposit || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ITC and Outstanding */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* ITC Summary */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Input Tax Credit</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <p className="text-xs text-green-600 dark:text-green-400">Available</p>
              <p className="mt-1 text-sm font-bold text-green-600 dark:text-green-400">
                {formatCurrency(itcSummary?.available || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-xs text-blue-600 dark:text-blue-400">Utilized</p>
              <p className="mt-1 text-sm font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(itcSummary?.utilized || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-dark-2">
              <p className="text-xs text-dark-6">Lapsed</p>
              <p className="mt-1 text-sm font-bold text-dark dark:text-white">
                {formatCurrency(itcSummary?.lapsed || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Expiring</p>
              <p className="mt-1 text-sm font-bold text-yellow-600 dark:text-yellow-400">
                {formatCurrency(itcSummary?.expiring_soon || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Outstanding Summary */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Outstanding</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-dark-6">Receivables</p>
                <span className="text-xs text-dark-6">{outstanding?.receivables.count || 0} invoices</span>
              </div>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(outstanding?.receivables.total || 0)}
              </p>
              {(outstanding?.receivables.overdue || 0) > 0 && (
                <p className="mt-1 text-xs text-red-500">
                  Overdue: {formatCurrency(outstanding?.receivables.overdue || 0)}
                </p>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-dark-6">Payables</p>
                <span className="text-xs text-dark-6">{outstanding?.payables.count || 0} bills</span>
              </div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(outstanding?.payables.total || 0)}
              </p>
              {(outstanding?.payables.overdue || 0) > 0 && (
                <p className="mt-1 text-xs text-red-500">
                  Overdue: {formatCurrency(outstanding?.payables.overdue || 0)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="py-8 text-center text-dark-6">No recent activity</p>
        ) : (
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-4 border-b border-stroke pb-4 last:border-0 last:pb-0 dark:border-dark-3"
              >
                {getActivityIcon(activity.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-dark dark:text-white">{activity.reference}</p>
                    {getStatusBadge(activity.status)}
                  </div>
                  <p className="text-sm text-dark-6">
                    {activity.party && `${activity.party} • `}
                    {dayjs(activity.date).format("DD MMM YYYY")}
                  </p>
                </div>
                <p className={`text-lg font-semibold ${activity.type === "invoice" || activity.type === "payment_received" ? "text-green-600 dark:text-green-400" : "text-dark dark:text-white"}`}>
                  {formatCurrency(activity.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
