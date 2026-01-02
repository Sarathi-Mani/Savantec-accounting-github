"use client";

import { useAuth } from "@/context/AuthContext";
import { dashboardApi, Invoice } from "@/services/api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

export function OutstandingInvoicesCard() {
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
        const data = await dashboardApi.getOutstandingInvoices(company.id, 5);
        setInvoices(data);
      } catch (error) {
        console.error("Failed to fetch outstanding invoices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [company?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isOverdue = (dueDate: string | undefined) => {
    if (!dueDate) return false;
    return dayjs(dueDate).isBefore(dayjs(), "day");
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
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
          Outstanding Invoices
        </h2>
        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {invoices.length} Pending
        </span>
      </div>

      {!company ? (
        <p className="text-center text-dark-6 py-8">
          No company selected
        </p>
      ) : invoices.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-dark-6">All invoices are paid! 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className={cn(
                "rounded-lg border p-4",
                isOverdue(invoice.due_date)
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10"
                  : "border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-dark dark:text-white">
                    {invoice.invoice_number}
                  </p>
                  <p className="text-sm text-dark-6">
                    {invoice.customer_name || "Walk-in Customer"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-dark dark:text-white">
                    {formatCurrency(invoice.balance_due)}
                  </p>
                  {invoice.due_date && (
                    <p
                      className={cn(
                        "text-xs",
                        isOverdue(invoice.due_date)
                          ? "text-red-600 dark:text-red-400"
                          : "text-dark-6"
                      )}
                    >
                      {isOverdue(invoice.due_date) ? "Overdue: " : "Due: "}
                      {dayjs(invoice.due_date).format("DD MMM YYYY")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
