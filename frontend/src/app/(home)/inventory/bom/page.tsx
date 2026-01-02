"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface BOM {
  id: string;
  finished_product_name: string;
  bom_name: string;
  quantity: number;
  components_count: number;
  total_cost: number;
  is_active: boolean;
}

export default function BOMPage() {
  const { company } = useAuth();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchBOMs();
    }
  }, [company]);

  const fetchBOMs = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/bill-of-materials`
      );
      setBoms(response.data);
    } catch (error) {
      console.error("Error fetching BOMs:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Bill of Materials" />

      <div className="flex justify-end mb-4">
        <Link
          href="/inventory/bom/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Create BOM
        </Link>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Finished Product</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">BOM Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Output Qty</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Components</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Est. Cost</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {boms.map((bom) => (
                <tr key={bom.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {bom.finished_product_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {bom.bom_name || "Default"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {bom.quantity}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {bom.components_count} items
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    ₹{(bom.total_cost || 0).toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                      bom.is_active 
                        ? "bg-success bg-opacity-10 text-success" 
                        : "bg-danger bg-opacity-10 text-danger"
                    }`}>
                      {bom.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button className="text-primary hover:underline mr-2">View</button>
                    <button className="text-primary hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
              {boms.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No Bill of Materials found. Create a BOM to define raw materials needed for finished products.
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

