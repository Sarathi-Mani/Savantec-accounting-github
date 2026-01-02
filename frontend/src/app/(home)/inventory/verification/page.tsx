"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface StockAdjustment {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  godown_name: string;
  total_items: number;
  total_variance_value: number;
  status: string;
}

export default function StockVerificationPage() {
  const { company } = useAuth();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchAdjustments();
    }
  }, [company]);

  const fetchAdjustments = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/stock-adjustments`
      );
      // Handle both array and object with items
      const data = response.data?.items || response.data || [];
      setAdjustments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching adjustments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "posted": return "bg-success bg-opacity-10 text-success";
      case "approved": return "bg-primary bg-opacity-10 text-primary";
      case "verified": return "bg-warning bg-opacity-10 text-warning";
      case "draft": return "bg-gray-2 text-body";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Physical Stock Verification" />

      <div className="flex justify-end mb-4">
        <Link
          href="/inventory/verification/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + New Verification
        </Link>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Adjustment #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Godown</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Items</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Variance Value</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj) => (
                <tr key={adj.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {adj.adjustment_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(adj.adjustment_date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {adj.godown_name || "Main"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {adj.total_items}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={adj.total_variance_value < 0 ? "text-danger" : "text-success"}>
                      ₹{Math.abs(adj.total_variance_value || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(adj.status)}`}>
                      {adj.status}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button className="text-primary hover:underline">View</button>
                  </td>
                </tr>
              ))}
              {adjustments.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No stock verification records found. Start a physical verification to reconcile book vs actual stock.
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

