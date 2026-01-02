"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface HSNEntry {
  hsn_code: string;
  description: string;
  uqc: string;
  quantity: number;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  total_tax: number;
}

export default function HSNSummaryPage() {
  const { company } = useAuth();
  const [data, setData] = useState<HSNEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (company?.id) { fetchData(); }
  }, [company, fromDate, toDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/companies/${company?.id}/gst/hsn-summary`;
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await api.get(url);
      setData(response.data.items || []);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const totals = data.reduce((acc, item) => ({
    taxable: acc.taxable + item.taxable_value,
    igst: acc.igst + item.igst,
    cgst: acc.cgst + item.cgst,
    sgst: acc.sgst + item.sgst,
    total_tax: acc.total_tax + item.total_tax,
  }), { taxable: 0, igst: 0, cgst: 0, sgst: 0, total_tax: 0 });

  return (
    <>
      <Breadcrumb pageName="HSN/SAC Summary" />

      <div className="mb-4 flex gap-4">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
        <button className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">Export JSON</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">HSN/SAC</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Description</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">UQC</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Qty</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Taxable</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">IGST</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">CGST</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">SGST</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark font-mono">{item.hsn_code}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{item.description}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{item.uqc}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{item.quantity}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">₹{item.taxable_value.toLocaleString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">₹{item.igst.toLocaleString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">₹{item.cgst.toLocaleString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">₹{item.sgst.toLocaleString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right font-bold">₹{item.total_tax.toLocaleString()}</td>
                </tr>
              ))}
              {data.length > 0 && (
                <tr className="bg-gray-2 dark:bg-meta-4 font-bold">
                  <td colSpan={4} className="px-4 py-5">TOTAL</td>
                  <td className="px-4 py-5 text-right">₹{totals.taxable.toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{totals.igst.toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{totals.cgst.toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{totals.sgst.toLocaleString()}</td>
                  <td className="px-4 py-5 text-right">₹{totals.total_tax.toLocaleString()}</td>
                </tr>
              )}
              {data.length === 0 && !loading && (<tr><td colSpan={9} className="px-4 py-5 text-center text-body">No HSN/SAC data found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

