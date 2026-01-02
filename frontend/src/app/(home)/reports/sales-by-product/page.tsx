"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface ProductSales {
  product_name: string;
  sku: string;
  quantity_sold: number;
  total_amount: number;
}

export default function SalesByProductPage() {
  const { company } = useAuth();
  const [data, setData] = useState<ProductSales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) { fetchData(); }
  }, [company]);

  const fetchData = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/reports/sales-by-product`);
      setData(response.data.products || []);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const total = data.reduce((sum, p) => sum + p.total_amount, 0);

  return (
    <>
      <Breadcrumb pageName="Sales by Product" />

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Product</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">SKU</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Qty Sold</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={i}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{p.product_name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{p.sku}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{p.quantity_sold}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">₹{p.total_amount.toLocaleString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{total > 0 ? ((p.total_amount / total) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
              {data.length === 0 && !loading && (<tr><td colSpan={5} className="px-4 py-5 text-center text-body">No sales data found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

