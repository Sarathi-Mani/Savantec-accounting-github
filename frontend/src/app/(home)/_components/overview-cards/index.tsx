"use client";

import { useAuth } from "@/context/AuthContext";
import { dashboardApi, DashboardSummary } from "@/services/api";
import { useEffect, useState } from "react";
import { OverviewCard } from "./card";
import * as icons from "./icons";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function OverviewCardsGroup() {
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
        console.error("Failed to fetch dashboard summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [company?.id]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[140px] animate-pulse rounded-[10px] bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <p className="text-center text-dark-6">
          No company selected. Please create or select a company to view dashboard.
        </p>
      </div>
    );
  }

  const totalRevenue = summary?.revenue.total || 0;
  const monthlyRevenue = summary?.revenue.current_month || 0;
  const growthRate = totalRevenue > 0 ? ((monthlyRevenue / totalRevenue) * 100) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
      <OverviewCard
        label="Total Revenue"
        data={{
          value: formatCurrency(totalRevenue),
          growthRate: parseFloat(growthRate.toFixed(1)),
        }}
        Icon={icons.Profit}
      />

      <OverviewCard
        label="Pending Amount"
        data={{
          value: formatCurrency(summary?.revenue.pending || 0),
          growthRate: 0,
        }}
        Icon={icons.Views}
      />

      <OverviewCard
        label="Total Invoices"
        data={{
          value: formatNumber(summary?.invoices.total || 0),
          growthRate: summary?.invoices.current_month || 0,
        }}
        Icon={icons.Product}
      />

      <OverviewCard
        label="GST Collected"
        data={{
          value: formatCurrency(summary?.gst.total || 0),
          growthRate: 0,
        }}
        Icon={icons.Users}
      />
    </div>
  );
}
