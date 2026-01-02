"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Entry {
  date: string;
  voucher_number: string;
  particulars: string;
  receipt: number;
  payment: number;
  balance: number;
}

export default function CashBankBookPage() {
  const { company } = useAuth();
  const searchParams = useSearchParams();
  const [bookType, setBookType] = useState(searchParams.get("type") || "cash");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [totals, setTotals] = useState({ receipts: 0, payments: 0, opening: 0, closing: 0 });

  useEffect(() => {
    if (company?.id) { fetchBook(); }
  }, [company, bookType, fromDate, toDate]);

  const fetchBook = async () => {
    setLoading(true);
    try {
      let url = `/companies/${company?.id}/reports/cash-bank-book?book_type=${bookType}`;
      if (fromDate) url += `&from_date=${fromDate}`;
      if (toDate) url += `&to_date=${toDate}`;
      
      const response = await api.get(url);
      setEntries(response.data.entries || []);
      setTotals(response.data.totals || { receipts: 0, payments: 0, opening: 0, closing: 0 });
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName={bookType === "cash" ? "Cash Book" : "Bank Book"} />

      <div className="mb-4 flex gap-4 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setBookType("cash")} className={`px-4 py-2 rounded ${bookType === "cash" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>Cash Book</button>
          <button onClick={() => setBookType("bank")} className={`px-4 py-2 rounded ${bookType === "bank" ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>Bank Book</button>
        </div>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
      </div>

      <div className="mb-4 grid grid-cols-4 gap-4">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Opening</p>
          <p className="text-xl font-bold text-black dark:text-white">₹{totals.opening.toLocaleString()}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Receipts</p>
          <p className="text-xl font-bold text-success">₹{totals.receipts.toLocaleString()}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Payments</p>
          <p className="text-xl font-bold text-danger">₹{totals.payments.toLocaleString()}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Closing</p>
          <p className="text-xl font-bold text-primary">₹{totals.closing.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Voucher</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Particulars</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Receipt</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Payment</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{e.voucher_number}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{e.particulars}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-success">{e.receipt > 0 ? `₹${e.receipt.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-danger">{e.payment > 0 ? `₹${e.payment.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right font-bold">₹{e.balance.toLocaleString()}</td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (<tr><td colSpan={6} className="px-4 py-5 text-center text-body">No entries found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

