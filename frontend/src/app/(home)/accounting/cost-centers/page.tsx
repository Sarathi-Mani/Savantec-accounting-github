"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface CostCenter {
  id: string;
  name: string;
  code: string;
  category_name: string;
  parent_name: string;
  total_expenses: number;
  budget: number;
  is_active: boolean;
}

export default function CostCentersPage() {
  const { company } = useAuth();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchCostCenters();
    }
  }, [company]);

  const fetchCostCenters = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/cost-centers`
      );
      setCostCenters(response.data);
    } catch (error) {
      console.error("Error fetching cost centers:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalExpenses = costCenters.reduce((sum, cc) => sum + (cc.total_expenses || 0), 0);

  return (
    <>
      <Breadcrumb pageName="Cost Centers" />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Cost Centers</p>
          <p className="text-2xl font-bold text-black dark:text-white">
            {costCenters.length}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Expenses</p>
          <p className="text-2xl font-bold text-black dark:text-white">
            ₹{totalExpenses.toLocaleString()}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Active</p>
          <p className="text-2xl font-bold text-success">
            {costCenters.filter(cc => cc.is_active).length}
          </p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">
          + Add Cost Center
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Code</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Category</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Parent</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Expenses</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Budget</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {costCenters.map((cc) => (
                <tr key={cc.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {cc.name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {cc.code}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {cc.category_name || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {cc.parent_name || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                    ₹{(cc.total_expenses || 0).toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                    ₹{(cc.budget || 0).toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                      cc.is_active 
                        ? "bg-success bg-opacity-10 text-success" 
                        : "bg-danger bg-opacity-10 text-danger"
                    }`}>
                      {cc.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {costCenters.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No cost centers found. Create cost centers to track expenses by department or project.
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

