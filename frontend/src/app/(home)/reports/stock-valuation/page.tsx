"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface StockItem {
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  rate: number;
  value: number;
  method: string;
}

export default function StockValuationPage() {
  const { company } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [method, setMethod] = useState("fifo");

  useEffect(() => {
    if (company?.id) { fetchValuation(); }
  }, [company, method]);

  const fetchValuation = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/companies/${company?.id}/reports/stock-valuation?method=${method}`);
      setItems(response.data.items || []);
      setTotalValue(response.data.total_value || 0);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName="Stock Valuation" />

      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          {["fifo", "lifo", "average", "standard"].map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={`px-4 py-2 rounded uppercase ${method === m ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>{m}</button>
          ))}
        </div>
        <div className="text-right">
          <p className="text-sm text-body">Total Stock Value</p>
          <p className="text-2xl font-bold text-primary">₹{totalValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Product</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">SKU</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Quantity</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Unit</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Rate</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{item.product_name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{item.sku}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{item.quantity}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{item.unit}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">₹{item.rate.toLocaleString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right font-bold">₹{item.value.toLocaleString()}</td>
                </tr>
              ))}
              {items.length === 0 && !loading && (<tr><td colSpan={6} className="px-4 py-5 text-center text-body">No stock items found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

