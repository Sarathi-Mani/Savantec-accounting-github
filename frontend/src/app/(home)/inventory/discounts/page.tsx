"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface DiscountRule {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  min_quantity: number;
  max_quantity: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

export default function DiscountsPage() {
  const { company } = useAuth();
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchDiscounts();
    }
  }, [company]);

  const fetchDiscounts = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/discount-rules`
      );
      setDiscounts(response.data);
    } catch (error) {
      console.error("Error fetching discounts:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Discount Rules" />

      <div className="flex justify-end mb-4">
        <Link
          href="/inventory/discounts/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Add Discount Rule
        </Link>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Rule Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Value</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Qty Range</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Validity</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((rule) => (
                <tr key={rule.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {rule.name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {rule.discount_type}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {rule.discount_type === "percentage" ? `${rule.discount_value}%` : `₹${rule.discount_value}`}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {rule.min_quantity || 0} - {rule.max_quantity || "∞"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {rule.valid_from ? new Date(rule.valid_from).toLocaleDateString() : "Always"} - 
                    {rule.valid_to ? new Date(rule.valid_to).toLocaleDateString() : "Always"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                      rule.is_active 
                        ? "bg-success bg-opacity-10 text-success" 
                        : "bg-danger bg-opacity-10 text-danger"
                    }`}>
                      {rule.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <Link href={`/inventory/discounts/${rule.id}`} className="text-primary hover:underline mr-3">
                      View
                    </Link>
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to delete this discount rule?")) {
                          try {
                            await api.delete(`/companies/${company?.id}/discount-rules/${rule.id}`);
                            fetchDiscounts();
                          } catch (error) {
                            console.error("Error deleting discount rule:", error);
                            alert("Failed to delete discount rule");
                          }
                        }
                      }}
                      className="text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {discounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No discount rules found. Create quantity-based or value-based discounts.
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

