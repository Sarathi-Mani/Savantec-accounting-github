"use client";

import { useAuth } from "@/context/AuthContext";
import { dashboardApi, DashboardSummary } from "@/services/api";
import { useEffect, useState } from "react";

export function GstSummaryCard() {
  const { company } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      try {
        const data = await dashboardApi.getSummary(company.id);
        setSummary(data);
      } catch (error) {
        console.error("Failed to fetch GST summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [company?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      </div>
    );
  }

  const gstData = [
    {
      label: "CGST Collected",
      value: summary?.gst.cgst || 0,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: "SGST Collected",
      value: summary?.gst.sgst || 0,
      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    {
      label: "IGST Collected",
      value: summary?.gst.igst || 0,
      color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    },
    {
      label: "Total GST",
      value: summary?.gst.total || 0,
      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    },
  ];

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          GST Summary
        </h2>
        <a
          href="/gst-reports"
          className="text-sm font-medium text-primary hover:underline"
        >
          View Reports
        </a>
      </div>

      {!company ? (
        <p className="text-center text-dark-6 py-8">
          No company selected
        </p>
      ) : (
        <div className="space-y-4">
          {gstData.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border border-stroke p-4 dark:border-dark-3"
            >
              <span className="text-sm font-medium text-dark-6">{item.label}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${item.color}`}>
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {company && (
        <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
          <p className="text-xs text-dark-6">
            GST figures are calculated from all finalized invoices. Generate GSTR-1/3B reports for filing.
          </p>
        </div>
      )}
    </div>
  );
}
