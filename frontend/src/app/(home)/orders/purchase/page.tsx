"use client";

import { useAuth } from "@/context/AuthContext";
import { ordersApi, vendorsApi, PurchaseOrder, Customer, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function PurchaseOrdersPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [ordersData, vendorsData] = await Promise.all([
          ordersApi.listPurchaseOrders(company.id, statusFilter ? { status: statusFilter as any } : undefined),
          vendorsApi.list(company.id, { page_size: 100 }),
        ]);
        setOrders(ordersData);
        setVendors(vendorsData.customers);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [company?.id, statusFilter]);

  const handleConfirmOrder = async (orderId: string) => {
    if (!company?.id || !confirm("Are you sure you want to confirm this purchase order?")) return;
    
    setActionLoading(orderId);
    try {
      await ordersApi.confirmPurchaseOrder(company.id, orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "confirmed" } : o))
      );
    } catch (error) {
      console.error("Failed to confirm order:", error);
      alert(getErrorMessage(error, "Failed to confirm order"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!company?.id || !confirm("Are you sure you want to cancel this purchase order?")) return;
    
    setActionLoading(orderId);
    try {
      await ordersApi.cancelPurchaseOrder(company.id, orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
      );
    } catch (error) {
      console.error("Failed to cancel order:", error);
      alert(getErrorMessage(error, "Failed to cancel order"));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "completed":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getVendorName = (vendorId?: string) => {
    if (!vendorId) return "—";
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.name || "Unknown";
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Purchase Orders</h1>
          <p className="text-sm text-dark-6">Manage orders to vendors/suppliers</p>
        </div>
        <Link
          href="/orders/purchase/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create PO
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark sm:flex-row">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-dark-6">No purchase orders found</p>
            <Link
              href="/orders/purchase/new"
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              Create your first purchase order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">PO #</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Vendor</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Expected</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Amount</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-dark-6">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-stroke last:border-0 dark:border-dark-3 hover:bg-gray-50 dark:hover:bg-dark-3">
                    <td className="px-6 py-4">
                      <Link
                        href={`/orders/purchase/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-6">
                      {dayjs(order.order_date).format("DD MMM YYYY")}
                    </td>
                    <td className="px-6 py-4 text-sm text-dark dark:text-white">
                      {getVendorName(order.vendor_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-6">
                      {order.expected_date ? dayjs(order.expected_date).format("DD MMM YYYY") : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-dark dark:text-white">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* View Button */}
                        <Link
                          href={`/orders/purchase/${order.id}`}
                          className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-dark-3"
                          title="View Details"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        
                        {/* Edit Button - only for draft */}
                        {order.status === "draft" && (
                          <Link
                            href={`/orders/purchase/${order.id}/edit`}
                            className="rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Edit Order"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                        )}
                        
                        {/* Confirm Button - only for draft */}
                        {order.status === "draft" && (
                          <button
                            onClick={() => handleConfirmOrder(order.id)}
                            disabled={actionLoading === order.id}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="Confirm Order"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        
                        {/* Cancel Button - for draft or confirmed */}
                        {(order.status === "draft" || order.status === "confirmed") && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={actionLoading === order.id}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Cancel Order"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
