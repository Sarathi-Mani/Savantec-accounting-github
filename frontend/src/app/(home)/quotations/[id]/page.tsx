"use client";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface QuotationItem {
  id: string;
  product_id: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  taxable_amount: number;
  total_amount: number;
}

interface Quotation {
  id: string;
  quotation_number: string;
  quotation_date: string;
  validity_date: string;
  customer_id: string;
  customer_name: string;
  status: string;
  subject: string;
  place_of_supply: string;
  place_of_supply_name: string;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
  notes: string;
  terms: string;
  email_sent_at: string;
  approved_at: string;
  converted_invoice_id: string;
  created_at: string;
  items: QuotationItem[];
}

export default function QuotationDetailPage() {
  const { company } = useAuth();
  const router = useRouter();
  const params = useParams();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  useEffect(() => {
    const fetchQuotation = async () => {
      const token = getToken();
      if (!company?.id || !token || !quotationId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/quotations/${quotationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.ok) {
          setQuotation(await response.json());
        }
      } catch (error) {
        console.error("Failed to fetch quotation:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotation();
  }, [company?.id, quotationId]);

  const performAction = async (action: string, body: any = {}) => {
    const token = getToken();
    if (!company?.id || !token || !quotationId) return;

    setActionLoading(action);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/quotations/${quotationId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (action === "convert") {
          router.push(`/invoices/${data.invoice_id}`);
        } else {
          setQuotation(data);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.detail || `Failed to ${action} quotation`);
      }
    } catch (error) {
      console.error(`Failed to ${action} quotation:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    const token = getToken();
    if (!company?.id || !token || !quotationId) return;
    if (!confirm("Are you sure you want to delete this quotation?")) return;

    setActionLoading("delete");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/quotations/${quotationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        router.push("/quotations");
      } else {
        const errorData = await response.json();
        alert(errorData.detail || "Failed to delete quotation");
      }
    } catch (error) {
      console.error("Failed to delete quotation:", error);
    } finally {
      setActionLoading(null);
    }
  };

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
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <p className="text-lg text-dark-6">Quotation not found</p>
        <Link href="/quotations" className="mt-4 text-primary hover:underline">
          Back to Quotations
        </Link>
      </div>
    );
  }

  const isInterState = quotation.igst_amount > 0;
  const canEdit = quotation.status === "draft";
  const canSend = ["draft", "sent"].includes(quotation.status);
  const canApprove = ["draft", "sent"].includes(quotation.status);
  const canConvert = ["draft", "sent", "approved"].includes(quotation.status) && quotation.status !== "converted";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-dark dark:text-white">{quotation.quotation_number}</h1>
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize",
                getStatusColor(quotation.status)
              )}
            >
              {quotation.status}
            </span>
          </div>
          {quotation.subject && <p className="mt-1 text-dark-6">{quotation.subject}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button
              onClick={handleDelete}
              disabled={actionLoading === "delete"}
              className="rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
            >
              {actionLoading === "delete" ? "Deleting..." : "Delete"}
            </button>
          )}

          {canSend && (
            <button
              onClick={() => performAction("send", {})}
              disabled={actionLoading === "send"}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              {actionLoading === "send" ? "Sending..." : "Mark as Sent"}
            </button>
          )}

          {canApprove && (
            <>
              <button
                onClick={() => performAction("approve", { approved_by: "Customer" })}
                disabled={actionLoading === "approve"}
                className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
              >
                {actionLoading === "approve" ? "..." : "Approve"}
              </button>
              <button
                onClick={() => performAction("reject", { reason: "Customer rejected" })}
                disabled={actionLoading === "reject"}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading === "reject" ? "..." : "Reject"}
              </button>
            </>
          )}

          {canConvert && (
            <button
              onClick={() => performAction("convert", {})}
              disabled={actionLoading === "convert"}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {actionLoading === "convert" ? "Converting..." : "Convert to Invoice"}
            </button>
          )}
        </div>
      </div>

      {/* Quotation Info */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Quotation Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-6">Date:</span>
              <span className="text-dark dark:text-white">
                {dayjs(quotation.quotation_date).format("DD MMM YYYY")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-6">Valid Until:</span>
              <span className="text-dark dark:text-white">
                {quotation.validity_date ? dayjs(quotation.validity_date).format("DD MMM YYYY") : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-6">Place of Supply:</span>
              <span className="text-dark dark:text-white">{quotation.place_of_supply_name || "-"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Customer</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-6">Name:</span>
              <span className="text-dark dark:text-white">{quotation.customer_name || "Walk-in Customer"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-6 overflow-hidden rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2">
                <th className="px-4 py-3 text-left text-sm font-medium text-dark dark:text-white">#</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-dark dark:text-white">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-dark dark:text-white">HSN</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-dark dark:text-white">Qty</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-dark dark:text-white">Rate</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-dark dark:text-white">GST</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-dark dark:text-white">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items?.map((item, index) => (
                <tr key={item.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-4 py-3 text-dark-6">{index + 1}</td>
                  <td className="px-4 py-3 text-dark dark:text-white">{item.description}</td>
                  <td className="px-4 py-3 text-dark-6">{item.hsn_code || "-"}</td>
                  <td className="px-4 py-3 text-right text-dark dark:text-white">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-dark dark:text-white">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right text-dark-6">{item.gst_rate}%</td>
                  <td className="px-4 py-3 text-right font-medium text-dark dark:text-white">
                    {formatCurrency(item.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-stroke p-6 dark:border-dark-3">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-6">Subtotal:</span>
                <span className="text-dark dark:text-white">{formatCurrency(quotation.subtotal)}</span>
              </div>
              {quotation.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(quotation.discount_amount)}</span>
                </div>
              )}
              {isInterState ? (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">IGST:</span>
                  <span className="text-dark dark:text-white">{formatCurrency(quotation.igst_amount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">CGST:</span>
                    <span className="text-dark dark:text-white">{formatCurrency(quotation.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">SGST:</span>
                    <span className="text-dark dark:text-white">{formatCurrency(quotation.sgst_amount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-stroke pt-2 text-lg font-bold dark:border-dark-3">
                <span className="text-dark dark:text-white">Total:</span>
                <span className="text-primary">{formatCurrency(quotation.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes and Terms */}
      <div className="grid gap-6 sm:grid-cols-2">
        {quotation.notes && (
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h3 className="mb-2 font-semibold text-dark dark:text-white">Notes</h3>
            <p className="whitespace-pre-wrap text-sm text-dark-6">{quotation.notes}</p>
          </div>
        )}
        {quotation.terms && (
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h3 className="mb-2 font-semibold text-dark dark:text-white">Terms & Conditions</h3>
            <p className="whitespace-pre-wrap text-sm text-dark-6">{quotation.terms}</p>
          </div>
        )}
      </div>

      {/* Converted Invoice Link */}
      {quotation.converted_invoice_id && (
        <div className="mt-6 rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
          <p className="text-sm text-purple-700 dark:text-purple-400">
            This quotation has been converted to an invoice.{" "}
            <Link href={`/invoices/${quotation.converted_invoice_id}`} className="font-medium underline">
              View Invoice →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

