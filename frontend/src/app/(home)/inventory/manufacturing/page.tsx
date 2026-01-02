"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface ManufacturingOrder {
  id: string;
  order_number: string;
  product_name: string;
  planned_quantity: number;
  produced_quantity: number;
  status: string;
  start_date: string;
  completion_date: string;
}

export default function ManufacturingPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (company?.id) {
      fetchOrders();
    }
  }, [company, filter]);

  const fetchOrders = async () => {
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const response = await api.get(
        `/companies/${company?.id}/manufacturing-orders${params}`
      );
      setOrders(response.data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success bg-opacity-10 text-success";
      case "in_progress": return "bg-primary bg-opacity-10 text-primary";
      case "draft": return "bg-warning bg-opacity-10 text-warning";
      case "cancelled": return "bg-danger bg-opacity-10 text-danger";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Manufacturing / Production Orders" />

      <div className="flex justify-end mb-4">
        <Link
          href="/inventory/manufacturing/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + New Production Order
        </Link>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        {["all", "draft", "in_progress", "completed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded capitalize ${filter === s ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Order #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Product</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Planned Qty</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Produced Qty</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Start Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {order.order_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {order.product_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {order.planned_quantity}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {order.produced_quantity}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {order.start_date ? new Date(order.start_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(order.status)}`}>
                      {order.status?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button className="text-primary hover:underline">View</button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No manufacturing orders found. Create production orders to convert raw materials to finished goods.
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

