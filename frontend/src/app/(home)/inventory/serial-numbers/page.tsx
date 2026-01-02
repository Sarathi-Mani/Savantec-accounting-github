"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface SerialNumber {
  id: string;
  serial_number: string;
  product_name: string;
  status: string;
  purchase_date: string;
  sales_date: string;
  customer_name: string;
  warranty_expiry: string;
}

export default function SerialNumbersPage() {
  const { company } = useAuth();
  const [serials, setSerials] = useState<SerialNumber[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (company?.id) {
      fetchSerials();
      fetchSummary();
    }
  }, [company, filter]);

  const fetchSerials = async () => {
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const response = await api.get(
        `/companies/${company?.id}/serial-numbers${params}`
      );
      setSerials(response.data);
    } catch (error) {
      console.error("Error fetching serials:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/serial-numbers/summary`
      );
      setSummary(response.data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-success bg-opacity-10 text-success";
      case "sold": return "bg-primary bg-opacity-10 text-primary";
      case "damaged": return "bg-danger bg-opacity-10 text-danger";
      case "reserved": return "bg-warning bg-opacity-10 text-warning";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Serial Numbers / IMEI" />

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Total</p>
            <p className="text-xl font-bold text-black dark:text-white">{summary.total || 0}</p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Available</p>
            <p className="text-xl font-bold text-success">{summary.available || 0}</p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Sold</p>
            <p className="text-xl font-bold text-primary">{summary.sold || 0}</p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Damaged/Returned</p>
            <p className="text-xl font-bold text-danger">{(summary.damaged || 0) + (summary.returned || 0)}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        {["all", "available", "sold", "damaged", "reserved"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded capitalize ${filter === s ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Serial/IMEI</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Product</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Purchase Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Sold To</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Warranty</th>
              </tr>
            </thead>
            <tbody>
              {serials.map((serial) => (
                <tr key={serial.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark font-mono">
                    {serial.serial_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {serial.product_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(serial.status)}`}>
                      {serial.status}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {serial.purchase_date ? new Date(serial.purchase_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {serial.customer_name || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {serial.warranty_expiry ? new Date(serial.warranty_expiry).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
              {serials.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-body">
                    No serial numbers found. Enable serial tracking for products to track individual units.
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

