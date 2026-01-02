"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  total_amount: number;
  status: string;
  payment_status: string;
}

export default function PurchaseInvoicesPage() {
  const { company } = useAuth();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchInvoices();
    }
  }, [company]);

  const fetchInvoices = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/purchases`
      );
      // Handle paginated response - backend returns { items: [], total: ..., page: ... }
      setInvoices(response.data?.items || response.data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-success bg-opacity-10 text-success";
      case "partial": return "bg-warning bg-opacity-10 text-warning";
      case "unpaid": return "bg-danger bg-opacity-10 text-danger";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Purchase Invoices" />

      <div className="flex justify-end mb-4">
        <Link
          href="/purchase/invoices/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Create Bill
        </Link>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Invoice #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Vendor</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {invoice.invoice_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {invoice.vendor_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    ₹{invoice.total_amount.toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(invoice.payment_status)}`}>
                      {invoice.payment_status}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <Link href={`/purchase/invoices/${invoice.id}`} className="text-primary hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-body">
                    No purchase invoices found.
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

