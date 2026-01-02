"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface OutstandingInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  party_name: string;
  total_amount: number;
  outstanding_amount: number;
  due_date: string;
  days_overdue: number;
}

export default function BillAllocationPage() {
  const { company } = useAuth();
  const [receivables, setReceivables] = useState<OutstandingInvoice[]>([]);
  const [payables, setPayables] = useState<OutstandingInvoice[]>([]);
  const [activeTab, setActiveTab] = useState<"receivables" | "payables">("receivables");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchOutstanding();
    }
  }, [company]);

  const fetchOutstanding = async () => {
    try {
      const [recRes, payRes] = await Promise.all([
        api.get(`/companies/${company?.id}/bill-allocation/outstanding?type=receivables`),
        api.get(`/companies/${company?.id}/bill-allocation/outstanding?type=payables`),
      ]);
      setReceivables(recRes.data);
      setPayables(payRes.data);
    } catch (error) {
      console.error("Error fetching outstanding:", error);
    } finally {
      setLoading(false);
    }
  };

  const data = activeTab === "receivables" ? receivables : payables;

  const totalOutstanding = data.reduce((sum, inv) => sum + inv.outstanding_amount, 0);

  return (
    <>
      <Breadcrumb pageName="Bill-wise Outstanding" />

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Outstanding</p>
          <p className="text-2xl font-bold text-black dark:text-white">
            ₹{totalOutstanding.toLocaleString()}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Number of Bills</p>
          <p className="text-2xl font-bold text-black dark:text-white">
            {data.length}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Overdue Bills</p>
          <p className="text-2xl font-bold text-danger">
            {data.filter(d => d.days_overdue > 0).length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab("receivables")}
          className={`px-6 py-2 rounded font-medium ${activeTab === "receivables" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          Receivables
        </button>
        <button
          onClick={() => setActiveTab("payables")}
          className={`px-6 py-2 rounded font-medium ${activeTab === "payables" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          Payables
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Invoice #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">
                  {activeTab === "receivables" ? "Customer" : "Vendor"}
                </th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Invoice Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Outstanding</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Due Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((inv) => (
                <tr key={inv.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {inv.invoice_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(inv.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {inv.party_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                    ₹{inv.total_amount.toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right font-bold">
                    ₹{inv.outstanding_amount.toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {inv.days_overdue > 0 ? (
                      <span className="text-danger">{inv.days_overdue} days overdue</span>
                    ) : (
                      <span className="text-success">Current</span>
                    )}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button className="text-primary hover:underline">
                      Allocate Payment
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-5 text-center text-success">
                    ✓ No outstanding {activeTab}. All bills are settled.
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

