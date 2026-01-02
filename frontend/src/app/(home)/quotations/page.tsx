"use client";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Quotation {
  id: string;
  quotation_number: string;
  quotation_date: string;
  validity_date: string;
  customer_id: string;
  customer_name: string;
  status: string;
  subject: string;
  subtotal: number;
  total_tax: number;
  total_amount: number;
}

interface QuotationListResponse {
  items: Quotation[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function QuotationsPage() {
  const { company } = useAuth();
  const [data, setData] = useState<QuotationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  useEffect(() => {
    const fetchQuotations = async () => {
      const token = getToken();
      if (!company?.id || !token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("page", page.toString());
        params.append("page_size", "10");
        if (statusFilter) params.append("status", statusFilter);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/quotations?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.ok) {
          setData(await response.json());
        }
      } catch (error) {
        console.error("Failed to fetch quotations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotations();
  }, [company?.id, page, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      case "sent":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "expired":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "converted":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
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

  const totalPages = data ? data.total_pages : 0;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Quotations</h1>
          <p className="text-sm text-dark-6">Manage your quotations and convert to invoices</p>
        </div>
        <Link
          href="/quotations/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Quotation
        </Link>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex flex-col gap-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark sm:flex-row">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-stroke dark:border-dark-3">
                <th className="px-4 py-4 text-left font-medium text-dark dark:text-white">
                  Quotation #
                </th>
                <th className="px-4 py-4 text-left font-medium text-dark dark:text-white">
                  Customer
                </th>
                <th className="px-4 py-4 text-left font-medium text-dark dark:text-white">
                  Date
                </th>
                <th className="px-4 py-4 text-left font-medium text-dark dark:text-white">
                  Valid Until
                </th>
                <th className="px-4 py-4 text-left font-medium text-dark dark:text-white">
                  Amount
                </th>
                <th className="px-4 py-4 text-left font-medium text-dark dark:text-white">
                  Status
                </th>
                <th className="px-4 py-4 text-center font-medium text-dark dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <tr key={i} className="border-b border-stroke dark:border-dark-3">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                      </td>
                    </tr>
                  ))
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-dark-6">
                    No quotations found. Create your first quotation to get started.
                  </td>
                </tr>
              ) : (
                data?.items?.map((quotation) => (
                  <tr
                    key={quotation.id}
                    className="border-b border-stroke transition hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-2"
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/quotations/${quotation.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {quotation.quotation_number}
                      </Link>
                      {quotation.subject && (
                        <p className="text-xs text-dark-6">{quotation.subject}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-dark dark:text-white">
                      {quotation.customer_name || "Walk-in Customer"}
                    </td>
                    <td className="px-4 py-4 text-dark-6">
                      {dayjs(quotation.quotation_date).format("DD MMM YYYY")}
                    </td>
                    <td className="px-4 py-4 text-dark-6">
                      {quotation.validity_date
                        ? dayjs(quotation.validity_date).format("DD MMM YYYY")
                        : "-"}
                    </td>
                    <td className="px-4 py-4 font-medium text-dark dark:text-white">
                      {formatCurrency(quotation.total_amount)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize",
                          getStatusColor(quotation.status)
                        )}
                      >
                        {quotation.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/quotations/${quotation.id}`}
                          className="rounded p-1.5 text-dark-6 transition hover:bg-gray-100 hover:text-primary dark:hover:bg-dark-2"
                          title="View"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stroke px-4 py-4 dark:border-dark-3">
            <p className="text-sm text-dark-6">
              Page {page} of {totalPages} ({data?.total} items)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-3 dark:hover:bg-dark-2"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-3 dark:hover:bg-dark-2"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

