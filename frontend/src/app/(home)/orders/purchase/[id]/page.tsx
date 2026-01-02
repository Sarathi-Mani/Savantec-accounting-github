"use client";

import { useAuth } from "@/context/AuthContext";
import { ordersApi, vendorsApi, PurchaseOrder, Customer, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ViewPurchaseOrderPage() {
  const { company } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [vendor, setVendor] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id || !orderId) {
        setLoading(false);
        return;
      }

      try {
        const orderData = await ordersApi.getPurchaseOrder(company.id, orderId);
        setOrder(orderData);

        // Fetch vendor details
        if (orderData.vendor_id) {
          try {
            const vendorData = await vendorsApi.get(company.id, orderData.vendor_id);
            setVendor(vendorData);
          } catch {
            // Vendor might be deleted
          }
        }
      } catch (err) {
        console.error("Failed to fetch order:", err);
        setError(getErrorMessage(err, "Failed to load purchase order"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [company?.id, orderId]);

  const handleConfirm = async () => {
    if (!company?.id || !orderId || !confirm("Are you sure you want to confirm this purchase order?")) return;
    
    setActionLoading(true);
    try {
      await ordersApi.confirmPurchaseOrder(company.id, orderId);
      setOrder(prev => prev ? { ...prev, status: "confirmed" } : null);
    } catch (err) {
      alert(getErrorMessage(err, "Failed to confirm order"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!company?.id || !orderId || !confirm("Are you sure you want to cancel this purchase order?")) return;
    
    setActionLoading(true);
    try {
      await ordersApi.cancelPurchaseOrder(company.id, orderId);
      setOrder(prev => prev ? { ...prev, status: "cancelled" } : null);
    } catch (err) {
      alert(getErrorMessage(err, "Failed to cancel order"));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "fulfilled":
      case "partially_fulfilled":
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
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-red-500">{error || "Purchase order not found"}</p>
        <Link href="/orders/purchase" className="mt-4 inline-block text-primary hover:underline">
          Back to Purchase Orders
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/orders/purchase"
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-dark-3"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-dark dark:text-white">
                {order.order_number}
              </h1>
              <p className="text-sm text-dark-6">
                Created on {dayjs(order.created_at).format("DD MMM YYYY, h:mm A")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-full px-4 py-1.5 text-sm font-medium ${getStatusColor(order.status)}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, " ")}
          </span>
          
          {order.status === "draft" && (
            <>
              <Link
                href={`/orders/purchase/${orderId}/edit`}
                className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Edit
              </Link>
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? "..." : "Confirm"}
              </button>
            </>
          )}
          
          {(order.status === "draft" || order.status === "confirmed") && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? "..." : "Cancel"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Info */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Order Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-dark-6">Order Date</p>
                <p className="font-medium text-dark dark:text-white">
                  {dayjs(order.order_date).format("DD MMM YYYY")}
                </p>
              </div>
              <div>
                <p className="text-sm text-dark-6">Expected Delivery</p>
                <p className="font-medium text-dark dark:text-white">
                  {order.expected_date ? dayjs(order.expected_date).format("DD MMM YYYY") : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Vendor Info */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Vendor</h2>
            {vendor ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-dark-6">Name</p>
                  <p className="font-medium text-dark dark:text-white">{vendor.name}</p>
                </div>
                {vendor.gstin && (
                  <div>
                    <p className="text-sm text-dark-6">GSTIN</p>
                    <p className="font-medium text-dark dark:text-white">{vendor.gstin}</p>
                  </div>
                )}
                {vendor.email && (
                  <div>
                    <p className="text-sm text-dark-6">Email</p>
                    <p className="font-medium text-dark dark:text-white">{vendor.email}</p>
                  </div>
                )}
                {vendor.phone && (
                  <div>
                    <p className="text-sm text-dark-6">Phone</p>
                    <p className="font-medium text-dark dark:text-white">{vendor.phone}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-dark-6">Vendor information not available</p>
            )}
          </div>

          {/* Line Items */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Line Items</h2>
            {order.items && order.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <th className="px-2 py-3 text-left text-sm font-medium text-dark-6">#</th>
                      <th className="px-2 py-3 text-left text-sm font-medium text-dark-6">Description</th>
                      <th className="px-2 py-3 text-right text-sm font-medium text-dark-6">Qty</th>
                      <th className="px-2 py-3 text-right text-sm font-medium text-dark-6">Rate</th>
                      <th className="px-2 py-3 text-right text-sm font-medium text-dark-6">GST %</th>
                      <th className="px-2 py-3 text-right text-sm font-medium text-dark-6">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={item.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                        <td className="px-2 py-3 text-sm text-dark-6">{index + 1}</td>
                        <td className="px-2 py-3 text-sm text-dark dark:text-white">{item.description}</td>
                        <td className="px-2 py-3 text-right text-sm text-dark dark:text-white">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-dark dark:text-white">
                          {formatCurrency(item.rate)}
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-dark dark:text-white">
                          {item.gst_rate}%
                        </td>
                        <td className="px-2 py-3 text-right text-sm font-medium text-dark dark:text-white">
                          {formatCurrency(item.total_amount || (item.quantity * item.rate * (1 + (item.gst_rate || 0) / 100)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-dark-6">No items in this order</p>
            )}
          </div>

          {/* Notes & Terms */}
          {(order.notes || order.terms) && (
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Additional Info</h2>
              <div className="space-y-4">
                {order.notes && (
                  <div>
                    <p className="text-sm font-medium text-dark-6">Notes</p>
                    <p className="mt-1 text-dark dark:text-white whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}
                {order.terms && (
                  <div>
                    <p className="text-sm font-medium text-dark-6">Terms & Conditions</p>
                    <p className="mt-1 text-dark dark:text-white whitespace-pre-wrap">{order.terms}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <div className="sticky top-24 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Order Summary</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-dark-6">Subtotal</span>
                <span className="text-dark dark:text-white">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-6">GST</span>
                <span className="text-dark dark:text-white">{formatCurrency(order.tax_amount)}</span>
              </div>
              <hr className="border-stroke dark:border-dark-3" />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-dark dark:text-white">Total</span>
                <span className="text-primary">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>

            {/* Fulfillment Info */}
            {(order.quantity_ordered || order.quantity_received) && (
              <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                <h3 className="mb-2 text-sm font-semibold text-dark dark:text-white">Fulfillment</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">Qty Ordered</span>
                    <span className="text-dark dark:text-white">{order.quantity_ordered || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">Qty Received</span>
                    <span className="text-dark dark:text-white">{order.quantity_received || 0}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-3">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{
                        width: `${Math.min(100, ((order.quantity_received || 0) / (order.quantity_ordered || 1)) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
