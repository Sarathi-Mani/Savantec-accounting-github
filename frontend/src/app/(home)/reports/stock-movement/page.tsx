"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Movement {
  product_name: string;
  opening: number;
  purchased: number;
  sold: number;
  adjusted: number;
  closing: number;
}

export default function StockMovementPage() {
  const { company } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (company?.id) { fetchMovements(); }
  }, [company, fromDate, toDate]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      let url = `/companies/${company?.id}/reports/stock-movement`;
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await api.get(url);
      setMovements(response.data.items || []);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName="Stock Movement Analysis" />

      <div className="mb-4 flex gap-4">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Product</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Opening</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Purchased</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Sold</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Adjusted</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m, i) => (
                <tr key={i}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{m.product_name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{m.opening}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-success">+{m.purchased}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-danger">-{m.sold}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{m.adjusted >= 0 ? `+${m.adjusted}` : m.adjusted}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right font-bold">{m.closing}</td>
                </tr>
              ))}
              {movements.length === 0 && !loading && (<tr><td colSpan={6} className="px-4 py-5 text-center text-body">No movement data found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

