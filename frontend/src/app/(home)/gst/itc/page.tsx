"use client";

import { useAuth } from "@/context/AuthContext";
import { gstIntegrationApi, ITCSummary, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";
import { useState } from "react";

export default function ITCPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<any>(null);
  const [gstr2aData, setGstr2aData] = useState<string>("");

  const fetchITCSummary = async () => {
    if (!company?.id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await gstIntegrationApi.getITCSummary(company.id, fromDate, toDate);
      setSummary(data);
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to fetch ITC summary"));
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!company?.id) return;
    
    let parsedData;
    try {
      parsedData = JSON.parse(gstr2aData);
    } catch (e) {
      setError("Invalid JSON format for GSTR-2A data");
      return;
    }

    setReconciling(true);
    setError(null);

    try {
      const result = await gstIntegrationApi.reconcileITC(company.id, parsedData);
      setReconciliationResult(result);
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to reconcile ITC"));
    } finally {
      setReconciling(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  if (!company.gstin) {
    return (
      <div className="rounded-lg bg-yellow-50 p-8 text-center dark:bg-yellow-900/20">
        <svg className="mx-auto mb-4 h-16 w-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="mb-2 text-lg font-semibold text-yellow-800 dark:text-yellow-300">GSTIN Required</h2>
        <p className="text-yellow-700 dark:text-yellow-400">
          Please add your company GSTIN in the company profile to view ITC details.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Input Tax Credit (ITC)</h1>
        <p className="text-sm text-dark-6">View and reconcile Input Tax Credit from purchases</p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">ITC allows you to claim credit for GST paid on purchases</p>
            <p className="mt-1 text-blue-600 dark:text-blue-300">
              Reconcile with GSTR-2A data to ensure all eligible ITC is claimed and matched with supplier data.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Period Selection */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">ITC Summary</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchITCSummary}
              disabled={loading}
              className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Get Summary"}
            </button>
          </div>
        </div>
      </div>

      {/* ITC Summary Results */}
      {summary && (
        <div className="mb-6 rounded-lg bg-white shadow-1 dark:bg-gray-dark">
          <div className="border-b border-stroke p-6 dark:border-dark-3">
            <h3 className="text-lg font-semibold text-dark dark:text-white">
              ITC Summary ({dayjs(summary.period?.from_date).format("DD MMM YYYY")} - {dayjs(summary.period?.to_date).format("DD MMM YYYY")})
            </h3>
          </div>

          <div className="p-6">
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              {/* Claimed ITC */}
              <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                <h4 className="mb-4 text-sm font-medium text-dark-6">ITC Claimed</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">CGST:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.claimed?.cgst || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">SGST:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.claimed?.sgst || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">IGST:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.claimed?.igst || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">CESS:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.claimed?.cess || 0))}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-stroke pt-2 dark:border-dark-3">
                    <span className="font-semibold text-dark dark:text-white">Total:</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(parseFloat(summary.claimed?.total || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Available ITC */}
              <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                <h4 className="mb-4 text-sm font-medium text-dark-6">ITC Available</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">CGST:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.available?.cgst || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">SGST:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.available?.sgst || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">IGST:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.available?.igst || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">CESS:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {formatCurrency(parseFloat(summary.available?.cess || 0))}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-stroke pt-2 dark:border-dark-3">
                    <span className="font-semibold text-dark dark:text-white">Total:</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(parseFloat(summary.available?.total || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {summary.message && (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                {summary.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ITC Reconciliation */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">ITC Reconciliation with GSTR-2A</h2>
        <p className="mb-4 text-sm text-dark-6">
          Upload GSTR-2A data (JSON format) to reconcile your claimed ITC with supplier-uploaded data.
        </p>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            GSTR-2A Data (JSON)
          </label>
          <textarea
            value={gstr2aData}
            onChange={(e) => setGstr2aData(e.target.value)}
            rows={8}
            placeholder='[{"supplier_gstin": "22AAAAA0000A1Z5", "invoice_no": "INV-001", "invoice_date": "2025-12-01", "cgst": 1000, "sgst": 1000, "igst": 0, "cess": 0, ...}]'
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 font-mono text-sm outline-none focus:border-primary dark:border-dark-3"
          />
          <p className="mt-2 text-xs text-dark-6">
            Paste GSTR-2A data in JSON format. This will match your purchase invoices with supplier data.
          </p>
        </div>

        <button
          onClick={handleReconcile}
          disabled={reconciling || !gstr2aData.trim()}
          className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
        >
          {reconciling ? "Reconciling..." : "Reconcile ITC"}
        </button>
      </div>

      {/* Reconciliation Results */}
      {reconciliationResult && (
        <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
          <div className="border-b border-stroke p-6 dark:border-dark-3">
            <h3 className="text-lg font-semibold text-dark dark:text-white">Reconciliation Results</h3>
          </div>

          <div className="p-6">
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                <p className="text-sm text-green-700 dark:text-green-400">Matched</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {reconciliationResult.matched_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-400">Unmatched</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {reconciliationResult.unmatched_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <p className="text-sm text-blue-700 dark:text-blue-400">Difference</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(parseFloat(reconciliationResult.difference || 0))}
                </p>
              </div>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-dark-6">Total ITC Claimed</p>
                <p className="text-lg font-semibold text-dark dark:text-white">
                  {formatCurrency(parseFloat(reconciliationResult.total_itc_claimed || 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-dark-6">Total ITC Available</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(parseFloat(reconciliationResult.total_itc_available || 0))}
                </p>
              </div>
            </div>

            {reconciliationResult.unmatched_invoices && reconciliationResult.unmatched_invoices.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold text-dark dark:text-white">Unmatched Invoices</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stroke dark:border-dark-3">
                        <th className="px-4 py-2 text-left text-dark-6">Supplier GSTIN</th>
                        <th className="px-4 py-2 text-left text-dark-6">Invoice No</th>
                        <th className="px-4 py-2 text-left text-dark-6">Date</th>
                        <th className="px-4 py-2 text-right text-dark-6">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationResult.unmatched_invoices.slice(0, 10).map((inv: any, idx: number) => (
                        <tr key={idx} className="border-b border-stroke dark:border-dark-3">
                          <td className="px-4 py-2 text-dark dark:text-white">{inv.supplier_gstin || "—"}</td>
                          <td className="px-4 py-2 text-dark dark:text-white">{inv.invoice_no || "—"}</td>
                          <td className="px-4 py-2 text-dark-6">{inv.invoice_date || "—"}</td>
                          <td className="px-4 py-2 text-right text-dark dark:text-white">
                            {formatCurrency(parseFloat(inv.total || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
