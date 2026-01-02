"use client";

import { useAuth } from "@/context/AuthContext";
import { invoicesApi, gstIntegrationApi, Invoice, EInvoiceDetails, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

export default function EInvoicePage() {
  const { company } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<EInvoiceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch finalized invoices (paid/pending status)
        const result = await invoicesApi.list(company.id, {
          page_size: 100,
        });
        // Filter to show only invoices that can have E-Invoice
        setInvoices(result.invoices.filter(inv => 
          inv.status !== 'draft' && inv.status !== 'cancelled'
        ));
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
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

  const getEInvoiceStatus = (invoice: Invoice) => {
    if (invoice.irn) {
      return { label: "Generated", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    }
    return { label: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  };

  const handleGenerateEInvoice = async (invoiceId: string) => {
    if (!company?.id) return;
    
    setActionLoading(invoiceId);
    setError(null);
    setSuccess(null);

    try {
      const result = await gstIntegrationApi.generateEInvoice(company.id, invoiceId);
      if (result.success) {
        setSuccess(`E-Invoice generated successfully! IRN: ${result.irn}`);
        // Update the invoice in the list
        setInvoices(invoices.map(inv => 
          inv.id === invoiceId ? { ...inv, irn: result.irn } : inv
        ));
      } else {
        setError(result.message || "Failed to generate E-Invoice");
      }
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to generate E-Invoice"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (invoice: Invoice) => {
    if (!company?.id) return;
    
    setSelectedInvoice(invoice);
    setDetailsLoading(true);

    try {
      const details = await gstIntegrationApi.getEInvoiceDetails(company.id, invoice.id);
      setInvoiceDetails(details);
    } catch (error) {
      console.error("Failed to fetch E-Invoice details:", error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCancelEInvoice = async () => {
    if (!company?.id || !selectedInvoice || !cancelReason.trim()) return;

    setActionLoading(selectedInvoice.id);
    setError(null);

    try {
      const result = await gstIntegrationApi.cancelEInvoice(company.id, selectedInvoice.id, cancelReason);
      if (result.success) {
        setSuccess("E-Invoice cancelled successfully");
        setInvoices(invoices.map(inv => 
          inv.id === selectedInvoice.id ? { ...inv, irn: undefined } : inv
        ));
        setShowCancelModal(false);
        setSelectedInvoice(null);
        setCancelReason("");
      } else {
        setError(result.message || "Failed to cancel E-Invoice");
      }
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to cancel E-Invoice"));
    } finally {
      setActionLoading(null);
    }
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">E-Invoice Management</h1>
        <p className="text-sm text-dark-6">Generate and manage E-Invoices (IRN) for GST compliance</p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">E-Invoice is mandatory for businesses with turnover above ₹5 Crore</p>
            <p className="mt-1 text-blue-600 dark:text-blue-300">
              Note: This is a simulation. Actual E-Invoice generation requires integration with the GST portal.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Invoices List */}
      <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-dark-6">No finalized invoices found</p>
            <p className="mt-2 text-sm text-dark-6">Create and finalize invoices to generate E-Invoices</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Invoice #</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Customer</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Amount</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-dark-6">E-Invoice</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">IRN</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const status = getEInvoiceStatus(invoice);
                  return (
                    <tr key={invoice.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                      <td className="px-6 py-4">
                        <span className="font-medium text-dark dark:text-white">{invoice.invoice_number}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-6">
                        {dayjs(invoice.invoice_date).format("DD MMM YYYY")}
                      </td>
                      <td className="px-6 py-4 text-sm text-dark dark:text-white">
                        {invoice.customer_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-dark dark:text-white">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.irn ? (
                          <span className="font-mono text-xs text-dark-6">{invoice.irn.substring(0, 20)}...</span>
                        ) : (
                          <span className="text-dark-6">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {!invoice.irn ? (
                            <button
                              onClick={() => handleGenerateEInvoice(invoice.id)}
                              disabled={actionLoading === invoice.id}
                              className="rounded bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                            >
                              {actionLoading === invoice.id ? "..." : "Generate"}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleViewDetails(invoice)}
                                className="rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setShowCancelModal(true);
                                }}
                                className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedInvoice && invoiceDetails && !showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                E-Invoice Details
              </h3>
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  setInvoiceDetails(null);
                }}
                className="text-dark-6 hover:text-dark"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-dark-6">Invoice Number</label>
                  <p className="font-medium text-dark dark:text-white">{invoiceDetails.invoice_number}</p>
                </div>
                {invoiceDetails.has_irn && (
                  <>
                    <div>
                      <label className="text-sm text-dark-6">IRN (Invoice Reference Number)</label>
                      <p className="break-all font-mono text-xs text-dark dark:text-white">{invoiceDetails.irn}</p>
                    </div>
                    {invoiceDetails.ack_number && (
                      <div>
                        <label className="text-sm text-dark-6">Acknowledgement Number</label>
                        <p className="font-medium text-dark dark:text-white">{invoiceDetails.ack_number}</p>
                      </div>
                    )}
                    {invoiceDetails.ack_date && (
                      <div>
                        <label className="text-sm text-dark-6">Acknowledgement Date</label>
                        <p className="font-medium text-dark dark:text-white">
                          {dayjs(invoiceDetails.ack_date).format("DD MMM YYYY, HH:mm")}
                        </p>
                      </div>
                    )}
                    {invoiceDetails.signed_qr && (
                      <div>
                        <label className="text-sm text-dark-6">Signed QR Data</label>
                        <p className="break-all font-mono text-xs text-dark-6">{invoiceDetails.signed_qr.substring(0, 100)}...</p>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setSelectedInvoice(null);
                      setInvoiceDetails(null);
                    }}
                    className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-opacity-90"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
              Cancel E-Invoice
            </h3>
            <p className="mb-4 text-sm text-dark-6">
              Are you sure you want to cancel the E-Invoice for <strong>{selectedInvoice.invoice_number}</strong>?
            </p>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                placeholder="Enter reason for cancellation..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedInvoice(null);
                  setCancelReason("");
                }}
                className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelEInvoice}
                disabled={!cancelReason.trim() || actionLoading === selectedInvoice.id}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === selectedInvoice.id ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
