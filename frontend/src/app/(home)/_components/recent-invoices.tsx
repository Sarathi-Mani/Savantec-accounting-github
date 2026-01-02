"use client";

import { useAuth } from "@/context/AuthContext";
import { dashboardApi, Invoice } from "@/services/api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

export function RecentInvoicesCard() {
  const { company } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      try {
        const data = await dashboardApi.getRecentInvoices(company.id, 5);
        setInvoices(data);
      } catch (error) {
        console.error("Failed to fetch recent invoices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [company?.id]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "partially_paid":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "overdue":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "cancelled":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Recent Invoices
        </h2>
        <a
          href="/invoices"
          className="text-sm font-medium text-primary hover:underline"
        >
          View All
        </a>
      </div>

      {!company ? (
        <p className="text-center text-dark-6 py-8">
          No company selected
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-center text-dark-6 py-8">
          No invoices yet. Create your first invoice!
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stroke dark:border-dark-3">
                <th className="pb-3 text-left text-sm font-medium text-dark-6">
                  Invoice #
                </th>
                <th className="pb-3 text-left text-sm font-medium text-dark-6">
                  Customer
                </th>
                <th className="pb-3 text-left text-sm font-medium text-dark-6">
                  Date
                </th>
                <th className="pb-3 text-right text-sm font-medium text-dark-6">
                  Amount
                </th>
                <th className="pb-3 text-right text-sm font-medium text-dark-6">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-stroke last:border-0 dark:border-dark-3"
                >
                  <td className="py-4 text-sm font-medium text-dark dark:text-white">
                    {invoice.invoice_number}
                  </td>
                  <td className="py-4 text-sm text-dark-6">
                    {invoice.customer_name || "Walk-in Customer"}
                  </td>
                  <td className="py-4 text-sm text-dark-6">
                    {dayjs(invoice.invoice_date).format("DD MMM YYYY")}
                  </td>
                  <td className="py-4 text-right text-sm font-medium text-dark dark:text-white">
                    {formatCurrency(invoice.total_amount)}
                  </td>
                  <td className="py-4 text-right">
                    <span
                      className={cn(
                        "inline-block rounded-full px-3 py-1 text-xs font-medium capitalize",
                        getStatusColor(invoice.status)
                      )}
                    >
                      {invoice.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
