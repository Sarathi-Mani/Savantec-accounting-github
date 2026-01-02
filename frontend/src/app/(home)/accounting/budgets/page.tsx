"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Budget {
  id: string;
  name: string;
  financial_year: string;
  period: string;
  total_budget: number;
  total_actual: number;
  variance: number;
  variance_percent: number;
  status: string;
}

export default function BudgetsPage() {
  const { company } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchBudgets();
    }
  }, [company]);

  const fetchBudgets = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/budgets`
      );
      setBudgets(response.data);
    } catch (error) {
      console.error("Error fetching budgets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "under_budget": return "bg-success bg-opacity-10 text-success";
      case "on_track": return "bg-primary bg-opacity-10 text-primary";
      case "over_budget": return "bg-danger bg-opacity-10 text-danger";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Budget vs Actual" />

      <div className="flex justify-end mb-4">
        <button className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">
          + Create Budget
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Budget Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">FY</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Period</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Budgeted</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Actual</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Variance</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => (
                <tr key={budget.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {budget.name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {budget.financial_year}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {budget.period}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                    ₹{budget.total_budget.toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                    ₹{budget.total_actual.toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                    <span className={budget.variance < 0 ? "text-danger" : "text-success"}>
                      ₹{Math.abs(budget.variance).toLocaleString()} ({budget.variance_percent}%)
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(budget.status)}`}>
                      {budget.status?.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
              {budgets.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No budgets found. Create budgets to track actual vs planned expenses.
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

