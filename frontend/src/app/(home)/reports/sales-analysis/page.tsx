"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

export default function SalesAnalysisPage() {
  const { company } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) { fetchSummary(); }
  }, [company]);

  const fetchSummary = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/reports/sales-analysis`);
      setSummary(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName="Sales Analysis" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Sales</p>
          <p className="text-2xl font-bold text-success">₹{(summary?.total_sales || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Invoices</p>
          <p className="text-2xl font-bold text-black dark:text-white">{summary?.total_invoices || 0}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Avg. Invoice Value</p>
          <p className="text-2xl font-bold text-primary">₹{(summary?.avg_invoice || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">GST Collected</p>
          <p className="text-2xl font-bold text-black dark:text-white">₹{(summary?.total_gst || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">Top 5 Customers</h3>
          </div>
          <div className="p-6.5">
            {summary?.top_customers?.map((c: any, i: number) => (
              <div key={i} className="flex justify-between py-2 border-b border-stroke last:border-0 dark:border-strokedark">
                <span>{c.name}</span>
                <span className="font-bold">₹{c.amount.toLocaleString()}</span>
              </div>
            ))}
            {(!summary?.top_customers || summary.top_customers.length === 0) && (
              <p className="text-center text-body">No data available</p>
            )}
          </div>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">Top 5 Products</h3>
          </div>
          <div className="p-6.5">
            {summary?.top_products?.map((p: any, i: number) => (
              <div key={i} className="flex justify-between py-2 border-b border-stroke last:border-0 dark:border-strokedark">
                <span>{p.name}</span>
                <span className="font-bold">₹{p.amount.toLocaleString()}</span>
              </div>
            ))}
            {(!summary?.top_products || summary.top_products.length === 0) && (
              <p className="text-center text-body">No data available</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

