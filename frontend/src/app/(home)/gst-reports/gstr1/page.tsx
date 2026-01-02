"use client";

import { useAuth } from "@/context/AuthContext";
import { gstApi, GSTR1Report, getErrorMessage } from "@/services/api";
import { useState } from "react";

export default function GSTR1Page() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GSTR1Report | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    if (!company?.id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await gstApi.getGSTR1(company.id, month, year);
      setReport(data);
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to generate report"));
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    if (!company?.id) return;
    try {
      const blob = await gstApi.downloadGSTR1(company.id, month, year);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_${company.gstin}_${month.toString().padStart(2, "0")}${year}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download report:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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
          Please add your company GSTIN in the company profile to generate GST reports.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">GSTR-1 Report</h1>
        <p className="text-sm text-dark-6">Details of outward supplies - {company.gstin}</p>
      </div>

      {/* Period Selection */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Select Period</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2.5 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-white">Report Summary</h2>
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download JSON
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                <p className="text-sm text-dark-6">GSTIN</p>
                <p className="font-medium text-dark dark:text-white">{report.gstin}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                <p className="text-sm text-dark-6">Filing Period</p>
                <p className="font-medium text-dark dark:text-white">{report.fp}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                <p className="text-sm text-dark-6">B2B Invoices</p>
                <p className="font-medium text-dark dark:text-white">{report.b2b?.length || 0}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                <p className="text-sm text-dark-6">B2C Invoices</p>
                <p className="font-medium text-dark dark:text-white">{(report.b2cl?.length || 0) + (report.b2cs?.length || 0)}</p>
              </div>
            </div>
          </div>

          {/* B2B Invoices */}
          {report.b2b && report.b2b.length > 0 && (
            <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
              <div className="border-b border-stroke p-6 dark:border-dark-3">
                <h2 className="text-lg font-semibold text-dark dark:text-white">
                  B2B Invoices ({report.b2b.length} recipients)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <th className="px-6 py-3 text-left text-sm font-medium text-dark-6">Customer GSTIN</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">Invoices</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">Taxable Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.b2b.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-stroke last:border-0 dark:border-dark-3">
                        <td className="px-6 py-4 font-medium text-dark dark:text-white">{item.ctin}</td>
                        <td className="px-6 py-4 text-right text-dark-6">{item.inv?.length || 0}</td>
                        <td className="px-6 py-4 text-right text-dark dark:text-white">
                          {formatCurrency(item.inv?.reduce((sum: number, inv: any) => sum + (inv.val || 0), 0) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HSN Summary */}
          {report.hsn && report.hsn.data && report.hsn.data.length > 0 && (
            <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
              <div className="border-b border-stroke p-6 dark:border-dark-3">
                <h2 className="text-lg font-semibold text-dark dark:text-white">HSN-wise Summary</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <th className="px-6 py-3 text-left text-sm font-medium text-dark-6">HSN Code</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">Qty</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">Taxable Value</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">IGST</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">CGST</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-dark-6">SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.hsn.data.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-stroke last:border-0 dark:border-dark-3">
                        <td className="px-6 py-4 font-medium text-dark dark:text-white">{item.hsn_sc}</td>
                        <td className="px-6 py-4 text-right text-dark-6">{item.qty}</td>
                        <td className="px-6 py-4 text-right text-dark dark:text-white">{formatCurrency(item.txval || 0)}</td>
                        <td className="px-6 py-4 text-right text-dark-6">{formatCurrency(item.iamt || 0)}</td>
                        <td className="px-6 py-4 text-right text-dark-6">{formatCurrency(item.camt || 0)}</td>
                        <td className="px-6 py-4 text-right text-dark-6">{formatCurrency(item.samt || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!report.b2b?.length && !report.b2cl?.length && !report.b2cs?.length && (
            <div className="rounded-lg bg-gray-50 p-8 text-center dark:bg-dark-2">
              <p className="text-dark-6">No invoices found for the selected period.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
