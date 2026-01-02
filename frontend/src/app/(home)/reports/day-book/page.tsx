"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Voucher {
  id: string;
  voucher_number: string;
  voucher_type: string;
  narration: string;
  debit_amount: number;
  credit_amount: number;
}

export default function DayBookPage() {
  const { company } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });

  useEffect(() => {
    if (company?.id) { fetchDayBook(); }
  }, [company, selectedDate]);

  const fetchDayBook = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/reports/day-book?date=${selectedDate}`);
      setVouchers(response.data.vouchers || []);
      setTotals(response.data.totals || { debit: 0, credit: 0 });
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName="Day Book" />

      <div className="mb-4 flex justify-between items-center">
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
        <button className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">Export Excel</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Debit</p>
          <p className="text-xl font-bold text-black dark:text-white">₹{totals.debit.toLocaleString()}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Credit</p>
          <p className="text-xl font-bold text-black dark:text-white">₹{totals.credit.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Voucher #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Narration</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Debit</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{v.voucher_number}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{v.voucher_type}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{v.narration}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{v.debit_amount > 0 ? `₹${v.debit_amount.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{v.credit_amount > 0 ? `₹${v.credit_amount.toLocaleString()}` : "-"}</td>
                </tr>
              ))}
              {vouchers.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-5 text-center text-body">No vouchers for this date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

