"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface ReorderItem {
  id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  reorder_level: number;
  reorder_quantity: number;
  maximum_level: number;
  supplier_name: string;
  last_purchase_rate: number;
}

export default function ReorderReportPage() {
  const { company } = useAuth();
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchReorderItems();
    }
  }, [company]);

  const fetchReorderItems = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/inventory/reorder-report`
      );
      setItems(response.data);
    } catch (error) {
      console.error("Error fetching reorder items:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Reorder Level Report" />

      <div className="mb-4 rounded-sm border border-warning bg-warning bg-opacity-10 p-4">
        <p className="text-warning">
          Items shown below have current stock at or below their reorder level and need to be reordered.
        </p>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Product</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">SKU</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Current Stock</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Reorder Level</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Shortage</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Reorder Qty</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Est. Cost</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {item.product_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {item.sku}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className="text-danger font-bold">{item.current_stock}</span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {item.reorder_level}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-danger">
                    {item.reorder_level - item.current_stock}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {item.reorder_quantity}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    ₹{((item.reorder_quantity || 0) * (item.last_purchase_rate || 0)).toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button className="text-primary hover:underline">Create PO</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-5 text-center text-success">
                    ✓ All items are adequately stocked. No reorders needed.
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

