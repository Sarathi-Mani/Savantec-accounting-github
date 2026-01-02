"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

export default function OutstandingSummaryPage() {
  const { company } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) { fetchSummary(); }
  }, [company]);

  const fetchSummary = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/reports/outstanding-summary`);
      setSummary(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName="Outstanding Summary" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Receivables */}
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">Receivables Summary</h3>
          </div>
          <div className="p-6.5">
            <div className="mb-4">
              <p className="text-sm text-body">Total Outstanding</p>
              <p className="text-3xl font-bold text-success">₹{(summary?.receivables?.total || 0).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-body">Number of Invoices</p>
                <p className="text-xl font-bold">{summary?.receivables?.count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-body">Overdue Amount</p>
                <p className="text-xl font-bold text-danger">₹{(summary?.receivables?.overdue || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payables */}
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">Payables Summary</h3>
          </div>
          <div className="p-6.5">
            <div className="mb-4">
              <p className="text-sm text-body">Total Outstanding</p>
              <p className="text-3xl font-bold text-danger">₹{(summary?.payables?.total || 0).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-body">Number of Bills</p>
                <p className="text-xl font-bold">{summary?.payables?.count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-body">Overdue Amount</p>
                <p className="text-xl font-bold text-warning">₹{(summary?.payables?.overdue || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Net Position */}
      <div className="mt-6 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <h3 className="mb-4 font-medium text-black dark:text-white">Net Position</h3>
        <div className="text-center">
          <p className="text-sm text-body">Net Receivable / (Payable)</p>
          <p className={`text-4xl font-bold ${(summary?.net_position || 0) >= 0 ? "text-success" : "text-danger"}`}>
            ₹{Math.abs(summary?.net_position || 0).toLocaleString()}
            {(summary?.net_position || 0) < 0 && " (Payable)"}
          </p>
        </div>
      </div>
    </>
  );
}

