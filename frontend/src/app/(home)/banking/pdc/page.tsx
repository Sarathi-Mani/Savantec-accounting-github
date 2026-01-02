"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface PDC {
  id: string;
  pdc_type: string;
  cheque_number: string;
  cheque_date: string;
  amount: number;
  bank_name: string;
  party_name: string;
  status: string;
}

export default function PDCPage() {
  const { company } = useAuth();
  const [pdcs, setPdcs] = useState<PDC[]>([]);
  const [maturingPdcs, setMaturingPdcs] = useState<PDC[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (company?.id) {
      fetchPdcs();
      fetchMaturingPdcs();
      fetchSummary();
    }
  }, [company, filter]);

  const fetchPdcs = async () => {
    try {
      const params = filter !== "all" ? `?pdc_type=${filter}` : "";
      const response = await api.get(
        `/companies/${company?.id}/pdc${params}`
      );
      setPdcs(response.data);
    } catch (error) {
      console.error("Error fetching PDCs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaturingPdcs = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/pdc/maturing?days=7`
      );
      setMaturingPdcs(response.data);
    } catch (error) {
      console.error("Error fetching maturing PDCs:", error);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/pdc/summary`
      );
      setSummary(response.data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Post-Dated Cheques" />

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Receivable PDCs</p>
            <p className="text-xl font-bold text-black dark:text-white">
              ₹{(summary.total_receivable || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Payable PDCs</p>
            <p className="text-xl font-bold text-black dark:text-white">
              ₹{(summary.total_payable || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Maturing in 7 Days</p>
            <p className="text-xl font-bold text-warning">
              {maturingPdcs.length}
            </p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Pending Count</p>
            <p className="text-xl font-bold text-black dark:text-white">
              {summary.pending_count || 0}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded ${filter === "all" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("received")}
          className={`px-4 py-2 rounded ${filter === "received" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          Received
        </button>
        <button
          onClick={() => setFilter("issued")}
          className={`px-4 py-2 rounded ${filter === "issued" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          Issued
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Cheque No.</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Party</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Bank</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {pdcs.map((pdc) => (
                <tr key={pdc.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                      pdc.pdc_type === "received" ? "bg-success bg-opacity-10 text-success" : "bg-warning bg-opacity-10 text-warning"
                    }`}>
                      {pdc.pdc_type}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {pdc.cheque_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(pdc.cheque_date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {pdc.party_name || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {pdc.bank_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    ₹{pdc.amount.toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {pdc.status}
                  </td>
                </tr>
              ))}
              {pdcs.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No post-dated cheques found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

