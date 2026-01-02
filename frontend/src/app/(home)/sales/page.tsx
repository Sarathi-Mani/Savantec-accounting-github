"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768";

interface FunnelStage {
  stage: string;
  stage_label: string;
  count: number;
  value: number;
}

interface ConversionRates {
  overall: {
    total_tickets: number;
    won: number;
    lost: number;
    open: number;
    win_rate: number;
  };
  enquiry_to_quote: {
    total: number;
    converted: number;
    rate: number;
  };
  quote_to_invoice: {
    total: number;
    converted: number;
    rate: number;
  };
}

interface MonthlyTrend {
  month: string;
  month_label: string;
  enquiries: number;
  quotations: number;
  invoices: number;
  won_value: number;
}

interface DashboardData {
  this_month: {
    enquiries: number;
    won_value: number;
    enquiries_change: number;
    won_change: number;
  };
  pipeline: {
    count: number;
    value: number;
  };
  pending_followups: number;
  funnel: {
    funnel: FunnelStage[];
    total_count: number;
    total_value: number;
  };
  conversion_rates: ConversionRates;
  deal_cycle: {
    average_days: number;
    min_days: number;
    max_days: number;
    sample_size: number;
  };
}

const stageColors: Record<string, string> = {
  enquiry: "bg-blue-500",
  quotation: "bg-indigo-500",
  sales_order: "bg-purple-500",
  delivery: "bg-orange-500",
  invoiced: "bg-yellow-500",
  paid: "bg-green-500",
};

export default function SalesDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");

  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null;

  useEffect(() => {
    if (companyId) {
      fetchDashboardData();
      fetchMonthlyTrend();
    }
  }, [companyId]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/companies/${companyId}/sales-dashboard/summary`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError("Failed to load dashboard");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyTrend = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/companies/${companyId}/sales-dashboard/monthly-trend?months=6`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setMonthlyTrend(result);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleTicketSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketSearch.trim()) {
      window.location.href = `/sales/tickets?search=${encodeURIComponent(ticketSearch)}`;
    }
  };

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <p className="text-yellow-800 dark:text-yellow-400">Please select a company first.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track your sales pipeline and performance</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/enquiries/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Enquiry
          </Link>
        </div>
      </div>

      {/* Ticket Search */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
        <h2 className="text-lg font-semibold mb-3">Track a Sales Ticket</h2>
        <form onSubmit={handleTicketSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="Enter ticket number (e.g., TKT-202412-0001)"
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-white"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 font-medium"
          >
            Track
          </button>
        </form>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      ) : data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pipeline Value</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(data.pipeline.value)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {data.pipeline.count} open deals
                  </p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Won This Month</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(data.this_month.won_value)}
                  </p>
                  <p className={`text-sm mt-1 ${data.this_month.won_change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {data.this_month.won_change >= 0 ? "↑" : "↓"} {Math.abs(data.this_month.won_change)}% vs last month
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data.conversion_rates.overall.win_rate}%
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {data.conversion_rates.overall.won} won / {data.conversion_rates.overall.lost} lost
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg Deal Cycle</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data.deal_cycle.average_days} days
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {data.deal_cycle.min_days} - {data.deal_cycle.max_days} day range
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pipeline Funnel */}
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">Pipeline Funnel</h2>
              <div className="space-y-3">
                {data.funnel.funnel.map((stage, index) => {
                  const maxValue = Math.max(...data.funnel.funnel.map(s => s.value));
                  const widthPercent = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
                  
                  return (
                    <div key={stage.stage} className="relative">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{stage.stage_label}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {stage.count} deals · {formatCurrency(stage.value)}
                        </span>
                      </div>
                      <div className="h-8 bg-gray-100 dark:bg-dark-2 rounded-lg overflow-hidden">
                        <div
                          className={`h-full ${stageColors[stage.stage] || "bg-gray-500"} transition-all duration-500`}
                          style={{ width: `${Math.max(widthPercent, 5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t dark:border-dark-3 flex justify-between">
                <span className="font-semibold dark:text-white">Total Pipeline</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {data.funnel.total_count} deals · {formatCurrency(data.funnel.total_value)}
                </span>
              </div>
            </div>

            {/* Conversion Rates */}
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">Conversion Rates</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Enquiry → Quotation</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {data.conversion_rates.enquiry_to_quote.rate}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-dark-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${data.conversion_rates.enquiry_to_quote.rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {data.conversion_rates.enquiry_to_quote.converted} of {data.conversion_rates.enquiry_to_quote.total} enquiries
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Quotation → Invoice</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {data.conversion_rates.quote_to_invoice.rate}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-dark-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${data.conversion_rates.quote_to_invoice.rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {data.conversion_rates.quote_to_invoice.converted} of {data.conversion_rates.quote_to_invoice.total} quotations
                  </p>
                </div>

                <div className="pt-4 border-t dark:border-dark-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Overall Win Rate</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      {data.conversion_rates.overall.win_rate}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-dark-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${data.conversion_rates.overall.win_rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          {monthlyTrend.length > 0 && (
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">Monthly Trend</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b dark:border-dark-3">
                      <th className="text-left py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Month</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Enquiries</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Quotations</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Invoices</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Won Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrend.map((month) => (
                      <tr key={month.month} className="border-b dark:border-dark-3 last:border-0">
                        <td className="py-3 font-medium dark:text-white">{month.month_label}</td>
                        <td className="py-3 text-right dark:text-gray-300">{month.enquiries}</td>
                        <td className="py-3 text-right dark:text-gray-300">{month.quotations}</td>
                        <td className="py-3 text-right dark:text-gray-300">{month.invoices}</td>
                        <td className="py-3 text-right font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(month.won_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/enquiries"
              className="bg-white dark:bg-gray-dark rounded-lg shadow p-4 hover:shadow-md transition flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">View Enquiries</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.this_month.enquiries} this month</p>
              </div>
            </Link>

            <Link
              href="/sales/tickets"
              className="bg-white dark:bg-gray-dark rounded-lg shadow p-4 hover:shadow-md transition flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">View All Tickets</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.pipeline.count} open tickets</p>
              </div>
            </Link>

            <Link
              href="/enquiries?follow_up=pending"
              className="bg-white dark:bg-gray-dark rounded-lg shadow p-4 hover:shadow-md transition flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Pending Follow-ups</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.pending_followups} due this week</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

