"use client";

import { useAuth } from "@/context/AuthContext";
import { invoicesApi, Invoice, getErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ActionType = "cancel" | "delete" | "refund" | "void" | "write_off" | null;

export default function InvoiceDetailPage() {
  const { company } = useAuth();
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [stockAllocating, setStockAllocating] = useState(false);
  const [stockAllocationMessage, setStockAllocationMessage] = useState<string | null>(null);
  
  // Modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!company?.id || !invoiceId) return;
      try {
        const data = await invoicesApi.get(company.id, invoiceId);
        setInvoice(data);
      } catch (error) {
        console.error("Failed to fetch invoice:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [company?.id, invoiceId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

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
      case "draft":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "refunded":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "void":
        return "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400";
      case "write_off":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getActionTitle = (action: ActionType) => {
    switch (action) {
      case "cancel": return "Cancel Invoice";
      case "delete": return "Delete Invoice";
      case "refund": return "Refund Invoice";
      case "void": return "Void Invoice";
      case "write_off": return "Write Off Invoice";
      default: return "";
    }
  };

  const getActionDescription = (action: ActionType) => {
    switch (action) {
      case "cancel": return "This will cancel the invoice. The invoice will remain in records but marked as cancelled.";
      case "delete": return "This will permanently delete the invoice. This action cannot be undone.";
      case "refund": return "This will mark the invoice as refunded. Any payments will be reversed.";
      case "void": return "This will void the invoice for accounting purposes. The invoice remains in records.";
      case "write_off": return "This will mark the invoice as uncollectible (bad debt). The balance will be written off.";
      default: return "";
    }
  };

  const getActionButtonColor = (action: ActionType) => {
    switch (action) {
      case "delete": return "bg-red-600 hover:bg-red-700";
      case "cancel": return "bg-gray-600 hover:bg-gray-700";
      case "refund": return "bg-orange-600 hover:bg-orange-700";
      case "void": return "bg-slate-600 hover:bg-slate-700";
      case "write_off": return "bg-rose-600 hover:bg-rose-700";
      default: return "bg-primary hover:bg-opacity-90";
    }
  };

  const openActionModal = (action: ActionType) => {
    setActionType(action);
    setActionReason("");
    setActionError(null);
    setShowActionModal(true);
  };

  const closeActionModal = () => {
    setShowActionModal(false);
    setActionType(null);
    setActionReason("");
    setActionError(null);
  };

  const handleDownloadPdf = async () => {
    if (!company?.id || !invoice) return;
    try {
      const blob = await invoicesApi.downloadPdf(company.id, invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download PDF:", error);
    }
  };

  const handleFinalize = async () => {
    if (!company?.id || !invoice) return;
    setActionLoading(true);
    try {
      const updated = await invoicesApi.finalize(company.id, invoice.id);
      setInvoice(updated);
    } catch (error) {
      console.error("Failed to finalize invoice:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!company?.id || !invoice) return;
    setActionLoading(true);
    try {
      await invoicesApi.markPaid(company.id, invoice.id);
      const updated = await invoicesApi.get(company.id, invoice.id);
      setInvoice(updated);
    } catch (error) {
      console.error("Failed to mark as paid:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAllocateStock = async () => {
    if (!company?.id || !invoice) return;
    setStockAllocating(true);
    setStockAllocationMessage(null);
    try {
      const result = await invoicesApi.allocateStock(company.id, invoice.id);
      // Refresh invoice to get updated stock status
      const updated = await invoicesApi.get(company.id, invoice.id);
      setInvoice(updated);
      setStockAllocationMessage(result.message || "Stock allocated successfully");
    } catch (error: any) {
      setStockAllocationMessage(getErrorMessage(error, "Failed to allocate stock"));
    } finally {
      setStockAllocating(false);
    }
  };

  const executeAction = async () => {
    if (!company?.id || !invoice || !actionType) return;
    
    setActionLoading(true);
    setActionError(null);

    try {
      switch (actionType) {
        case "cancel":
          const cancelled = await invoicesApi.cancel(company.id, invoice.id, actionReason || undefined);
          setInvoice(cancelled);
          break;
        case "delete":
          await invoicesApi.delete(company.id, invoice.id);
          router.push("/invoices");
          return;
        case "refund":
          const refunded = await invoicesApi.refund(company.id, invoice.id, actionReason || undefined);
          setInvoice(refunded);
          break;
        case "void":
          const voided = await invoicesApi.void(company.id, invoice.id, actionReason || undefined);
          setInvoice(voided);
          break;
        case "write_off":
          const writtenOff = await invoicesApi.writeOff(company.id, invoice.id, actionReason || undefined);
          setInvoice(writtenOff);
          break;
      }
      closeActionModal();
    } catch (error: any) {
      setActionError(getErrorMessage(error, `Failed to ${actionType} invoice`));
    } finally {
      setActionLoading(false);
    }
  };

  // Check what actions are available based on status
  const canDelete = invoice?.status === "draft";
  const canCancel = invoice && !["paid", "refunded", "void", "cancelled"].includes(invoice.status);
  const canRefund = invoice && ["paid", "partially_paid"].includes(invoice.status);
  const canVoid = invoice && !["void"].includes(invoice.status) && (invoice.amount_paid === 0 || invoice.status === "refunded");
  const canWriteOff = invoice && ["pending", "partially_paid", "overdue"].includes(invoice.status);
  const canFinalize = invoice?.status === "draft";
  const canMarkPaid = invoice && ["pending", "partially_paid", "overdue"].includes(invoice.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Invoice not found</p>
        <Link href="/invoices" className="mt-4 inline-block text-primary hover:underline">
          Back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Action Confirmation Modal */}
      {showActionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
              {getActionTitle(actionType)}
            </h3>
            <p className="mb-4 text-sm text-dark-6">
              {getActionDescription(actionType)}
            </p>
            
            {actionError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {actionError}
              </div>
            )}

            {actionType !== "delete" && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Reason (optional)
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={`Enter reason for ${actionType?.replace("_", " ")}...`}
                  rows={3}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeActionModal}
                disabled={actionLoading}
                className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={actionLoading}
                className={cn(
                  "rounded-lg px-4 py-2 font-medium text-white transition disabled:opacity-50",
                  getActionButtonColor(actionType)
                )}
              >
                {actionLoading ? "Processing..." : `Confirm ${getActionTitle(actionType)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link href="/invoices" className="text-dark-6 hover:text-primary">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-dark dark:text-white">
              Invoice {invoice.invoice_number}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={cn("rounded-full px-3 py-1 text-sm font-medium capitalize", getStatusColor(invoice.status))}>
                {invoice.status.replace("_", " ")}
              </span>
              
              {/* Stock Status Indicator */}
              {(() => {
                const hasStockItems = invoice.items.some((item: any) => item.product_id);
                if (!hasStockItems) return null;
                
                const anyReserved = invoice.items.some((item: any) => item.stock_reserved);
                const anyReduced = invoice.items.some((item: any) => item.stock_reduced);
                
                if (anyReduced) {
                  return (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      ✓ Stock Reduced
                    </span>
                  );
                } else if (anyReserved) {
                  return (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      ⏳ Stock Reserved
                    </span>
                  );
                }
                // Not tracked - show button to allocate if not cancelled/void/refunded
                const canAllocate = !["cancelled", "void", "refunded"].includes(invoice.status);
                if (canAllocate) {
                  return (
                    <button
                      onClick={handleAllocateStock}
                      disabled={stockAllocating}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                    >
                      {stockAllocating ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Allocating...
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Allocate Stock
                        </>
                      )}
                    </button>
                  );
                }
                return (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                    Stock: Not Tracked
                  </span>
                );
              })()}
            </div>
          </div>
          <p className="text-sm text-dark-6">
            Created on {dayjs(invoice.created_at).format("DD MMM YYYY, hh:mm A")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canFinalize && (
            <button
              onClick={handleFinalize}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Finalize
            </button>
          )}
          {canMarkPaid && (
            <button
              onClick={handleMarkPaid}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Mark Paid
            </button>
          )}
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2.5 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-3"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PDF
          </button>
          <Link
            href={`/invoices/new?duplicate=${invoice.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2.5 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-3"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </Link>
          
          {/* Create DC Button */}
          {!["cancelled", "void", "refunded", "draft"].includes(invoice.status) && (
            <Link
              href={`/delivery-challans/new?type=dc_out&invoice_id=${invoice.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500 bg-white px-4 py-2.5 font-medium text-indigo-500 transition hover:bg-indigo-50 dark:border-indigo-400 dark:bg-gray-dark dark:text-indigo-400 dark:hover:bg-indigo-900/20"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Create DC Out
            </Link>
          )}
          
          {/* More Actions Dropdown */}
          {(canCancel || canRefund || canVoid || canWriteOff || canDelete) && (
            <div className="relative group">
              <button className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2.5 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-3">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                More
              </button>
              <div className="invisible absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-stroke bg-white py-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 dark:border-dark-3 dark:bg-gray-dark">
                {canRefund && (
                  <button
                    onClick={() => openActionModal("refund")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-orange-600 hover:bg-gray-100 dark:hover:bg-dark-3"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Refund
                  </button>
                )}
                {canWriteOff && (
                  <button
                    onClick={() => openActionModal("write_off")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 hover:bg-gray-100 dark:hover:bg-dark-3"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Write Off
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => openActionModal("cancel")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-3"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                )}
                {canVoid && (
                  <button
                    onClick={() => openActionModal("void")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-dark-3"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Void
                  </button>
                )}
                {canDelete && (
                  <>
                    <hr className="my-2 border-stroke dark:border-dark-3" />
                    <button
                      onClick={() => openActionModal("delete")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-dark-3"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock Allocation Message */}
      {stockAllocationMessage && (
        <div className={cn(
          "mb-6 rounded-lg p-4",
          stockAllocationMessage.includes("Failed") || stockAllocationMessage.includes("error")
            ? "bg-red-50 dark:bg-red-900/20"
            : "bg-blue-50 dark:bg-blue-900/20"
        )}>
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-sm font-medium",
              stockAllocationMessage.includes("Failed") || stockAllocationMessage.includes("error")
                ? "text-red-800 dark:text-red-200"
                : "text-blue-800 dark:text-blue-200"
            )}>
              {stockAllocationMessage}
            </p>
            <button
              onClick={() => setStockAllocationMessage(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Stock Status Info Banner */}
      {(() => {
        const hasStockItems = invoice.items.some((item: any) => item.product_id);
        const anyReserved = invoice.items.some((item: any) => item.stock_reserved);
        const anyReduced = invoice.items.some((item: any) => item.stock_reduced);
        
        if (!hasStockItems) return null;
        
        if (anyReduced) {
          return (
            <div className="mb-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-green-800 dark:text-green-200">
                  <p className="font-medium">Stock has been reduced from inventory and COGS recorded</p>
                  <p className="mt-1 text-green-700 dark:text-green-300">
                    Inventory was reduced when this invoice was marked as PAID. Cost of Goods Sold (COGS) has been automatically recorded in accounting. Check the item details below to see which warehouses were used.
                  </p>
                </div>
              </div>
            </div>
          );
        } else if (anyReserved) {
          return (
            <div className="mb-6 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">Stock is reserved but not yet reduced</p>
                  <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                    Inventory will be automatically reduced and COGS recorded when you mark this invoice as <strong>PAID</strong>. The stock reduction is tracked per warehouse.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        
        // Stock not tracked - show info banner with allocate option
        const canAllocate = !["cancelled", "void", "refunded"].includes(invoice.status);
        if (canAllocate) {
          return (
            <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">Stock tracking not enabled for this invoice</p>
                    <p className="mt-1 text-blue-700 dark:text-blue-300">
                      This invoice was created without stock tracking. Click "Allocate Stock" to enable stock tracking and automatically allocate inventory from warehouses based on your priority settings.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAllocateStock}
                  disabled={stockAllocating}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {stockAllocating ? "Allocating..." : "Allocate Stock"}
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Customer Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-dark-6">Customer Name</p>
                <p className="font-medium text-dark dark:text-white">
                  {invoice.customer_name || "Walk-in Customer"}
                </p>
              </div>
              {invoice.customer_gstin && (
                <div>
                  <p className="text-sm text-dark-6">GSTIN</p>
                  <p className="font-medium text-dark dark:text-white">{invoice.customer_gstin}</p>
                </div>
              )}
              {invoice.customer_email && (
                <div>
                  <p className="text-sm text-dark-6">Email</p>
                  <p className="font-medium text-dark dark:text-white">{invoice.customer_email}</p>
                </div>
              )}
              {invoice.customer_phone && (
                <div>
                  <p className="text-sm text-dark-6">Phone</p>
                  <p className="font-medium text-dark dark:text-white">{invoice.customer_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
            <div className="border-b border-stroke p-6 dark:border-dark-3">
              <h2 className="text-lg font-semibold text-dark dark:text-white">Invoice Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stroke dark:border-dark-3">
                    <th className="px-6 py-3 text-left text-sm font-medium text-dark-6">Description</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-dark-6">HSN</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">Qty</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">Rate</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">GST</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-dark dark:text-white">{item.description}</p>
                          {item.warehouse_allocation && item.warehouse_allocation.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.warehouse_allocation.map((alloc: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                >
                                  {alloc.godown_name || "Main"}: {alloc.quantity}
                                </span>
                              ))}
                              {item.stock_reserved && !item.stock_reduced && (
                                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                  Reserved
                                </span>
                              )}
                              {item.stock_reduced && (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Stock Reduced
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-dark-6">{item.hsn_code || "-"}</td>
                      <td className="px-6 py-4 text-right text-dark-6">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-6 py-4 text-right text-dark-6">{formatCurrency(item.unit_price)}</td>
                      <td className="px-6 py-4 text-right text-dark-6">{item.gst_rate}%</td>
                      <td className="px-6 py-4 text-right font-medium text-dark dark:text-white">
                        {formatCurrency(item.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              {invoice.notes && (
                <div className="mb-4">
                  <h3 className="mb-2 font-medium text-dark dark:text-white">Notes</h3>
                  <p className="whitespace-pre-wrap text-sm text-dark-6">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h3 className="mb-2 font-medium text-dark dark:text-white">Terms & Conditions</h3>
                  <p className="whitespace-pre-wrap text-sm text-dark-6">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-dark-6">Invoice Date</span>
                <span className="text-dark dark:text-white">
                  {dayjs(invoice.invoice_date).format("DD MMM YYYY")}
                </span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">Due Date</span>
                  <span className="text-dark dark:text-white">
                    {dayjs(invoice.due_date).format("DD MMM YYYY")}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-dark-6">Invoice Type</span>
                <span className="text-dark dark:text-white uppercase">{invoice.invoice_type}</span>
              </div>
              <hr className="border-stroke dark:border-dark-3" />
              <div className="flex justify-between text-sm">
                <span className="text-dark-6">Subtotal</span>
                <span className="text-dark dark:text-white">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">Discount</span>
                  <span className="text-red-500">-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              {invoice.cgst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">CGST</span>
                  <span className="text-dark dark:text-white">{formatCurrency(invoice.cgst_amount)}</span>
                </div>
              )}
              {invoice.sgst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">SGST</span>
                  <span className="text-dark dark:text-white">{formatCurrency(invoice.sgst_amount)}</span>
                </div>
              )}
              {invoice.igst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">IGST</span>
                  <span className="text-dark dark:text-white">{formatCurrency(invoice.igst_amount)}</span>
                </div>
              )}
              <hr className="border-stroke dark:border-dark-3" />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-dark dark:text-white">Total</span>
                <span className="text-primary">{formatCurrency(invoice.total_amount)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">Paid</span>
                  <span className="text-green-600">-{formatCurrency(invoice.amount_paid)}</span>
                </div>
              )}
              {invoice.balance_due > 0 && invoice.status !== "refunded" && invoice.status !== "void" && invoice.status !== "cancelled" && (
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-dark dark:text-white">Balance Due</span>
                  <span className="text-red-500">{formatCurrency(invoice.balance_due)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Payments</h2>
              <div className="space-y-3">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-stroke p-3 dark:border-dark-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-dark dark:text-white">
                        {formatCurrency(payment.amount)}
                      </span>
                      <span className="text-xs text-dark-6 uppercase">{payment.payment_mode}</span>
                    </div>
                    <p className="text-xs text-dark-6">
                      {dayjs(payment.payment_date).format("DD MMM YYYY, hh:mm A")}
                    </p>
                    {payment.reference_number && (
                      <p className="text-xs text-dark-6">Ref: {payment.reference_number}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
