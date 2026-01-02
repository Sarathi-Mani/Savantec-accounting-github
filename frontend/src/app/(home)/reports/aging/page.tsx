"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface AgingEntry {
  party_name: string;
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  total: number;
}

export default function AgingReportPage() {
  const { company } = useAuth();
  const searchParams = useSearchParams();
  const [reportType, setReportType] = useState(searchParams.get("type") || "receivables");
  const [data, setData] = useState<AgingEntry[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) { fetchAging(); }
  }, [company, reportType]);

  const fetchAging = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/companies/${company?.id}/reports/aging/${reportType}`);
      setData(response.data.entries || []);
      setTotals(response.data.totals || {});
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName={`${reportType === "receivables" ? "Receivables" : "Payables"} Aging`} />

      <div className="mb-4 flex gap-2">
        <button onClick={() => setReportType("receivables")} className={`px-4 py-2 rounded ${reportType === "receivables" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>Receivables</button>
        <button onClick={() => setReportType("payables")} className={`px-4 py-2 rounded ${reportType === "payables" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>Payables</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">{reportType === "receivables" ? "Customer" : "Vendor"}</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Current</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">1-30 Days</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">31-60 Days</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">61-90 Days</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">&gt;90 Days</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <tr key={i}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{entry.party_name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{entry.current > 0 ? `₹${entry.current.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{entry.days_1_30 > 0 ? `₹${entry.days_1_30.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-warning">{entry.days_31_60 > 0 ? `₹${entry.days_31_60.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-warning">{entry.days_61_90 > 0 ? `₹${entry.days_61_90.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-danger">{entry.over_90 > 0 ? `₹${entry.over_90.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right font-bold">₹{entry.total.toLocaleString()}</td>
                </tr>
              ))}
              {data.length > 0 && (
                <tr className="bg-gray-2 dark:bg-meta-4 font-bold">
                  <td className="px-4 py-5">TOTAL</td>
                  <td className="px-4 py-5 text-right">₹{(totals.current || 0).toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{(totals.days_1_30 || 0).toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{(totals.days_31_60 || 0).toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{(totals.days_61_90 || 0).toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{(totals.over_90 || 0).toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{(totals.total || 0).toLocaleString()}</td>
                </tr>
              )}
              {data.length === 0 && !loading && (<tr><td colSpan={7} className="px-4 py-5 text-center text-success">✓ No outstanding {reportType}.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

