"use client";

import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

const exportTypes = [
  { id: "customers", name: "Customers", icon: "👥" },
  { id: "products", name: "Products", icon: "📦" },
  { id: "invoices", name: "Sales Invoices", icon: "📄" },
  { id: "purchases", name: "Purchase Invoices", icon: "🧾" },
  { id: "transactions", name: "Journal Entries", icon: "📒" },
  { id: "trial_balance", name: "Trial Balance", icon: "⚖️" },
];

export default function ExportPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const handleExport = async (type: string) => {
    setLoading(type);
    try {
      let url = `/companies/${company?.id}/export/${type}`;
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${type}_export.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error exporting:", error);
      alert("Export failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Export Data" />

      <div className="mb-6 rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
        <h4 className="mb-4 font-medium text-black dark:text-white">Date Range (Optional)</h4>
        <div className="flex gap-4">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exportTypes.map((type) => (
          <div key={type.id} className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{type.icon}</span>
                <h4 className="font-medium text-black dark:text-white">{type.name}</h4>
              </div>
              <button
                onClick={() => handleExport(type.id)}
                disabled={loading === type.id}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-gray hover:bg-opacity-90 disabled:opacity-50"
              >
                {loading === type.id ? "..." : "Export"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

