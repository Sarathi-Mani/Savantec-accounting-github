"use client";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface DCItem {
  id: string;
  product_id: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  godown_id: string;
}

interface DeliveryChallan {
  id: string;
  dc_number: string;
  dc_date: string;
  dc_type: string;
  status: string;
  customer_id: string;
  customer_name: string;
  invoice_id: string;
  invoice_number: string;
  quotation_id: string;
  original_dc_id: string;
  return_reason: string;
  from_godown_id: string;
  to_godown_id: string;
  transporter_name: string;
  vehicle_number: string;
  eway_bill_number: string;
  delivery_to_address: string;
  delivery_to_city: string;
  delivery_to_state: string;
  delivery_to_pincode: string;
  stock_updated: boolean;
  delivered_at: string;
  received_by: string;
  notes: string;
  created_at: string;
  items: DCItem[];
}

export default function DeliveryChallanDetailPage() {
  const { company } = useAuth();
  const router = useRouter();
  const params = useParams();
  const dcId = params.id as string;

  const [dc, setDc] = useState<DeliveryChallan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  useEffect(() => {
    const fetchDC = async () => {
      const token = getToken();
      if (!company?.id || !token || !dcId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/delivery-challans/${dcId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.ok) {
          setDc(await response.json());
        }
      } catch (error) {
        console.error("Failed to fetch delivery challan:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDC();
  }, [company?.id, dcId]);

  const performAction = async (action: string, body: any = {}) => {
    const token = getToken();
    if (!company?.id || !token || !dcId) return;

    setActionLoading(action);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/delivery-challans/${dcId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        setDc(await response.json());
      } else {
        const errorData = await response.json();
        alert(errorData.detail || `Failed to ${action}`);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    const token = getToken();
    if (!company?.id || !token || !dcId) return;
    if (!confirm("Are you sure you want to delete this delivery challan?")) return;

    setActionLoading("delete");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/delivery-challans/${dcId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        router.push("/delivery-challans");
      } else {
        const errorData = await response.json();
        alert(errorData.detail || "Failed to delete delivery challan");
      }
    } catch (error) {
      console.error("Failed to delete delivery challan:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      case "dispatched":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "in_transit":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "delivered":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getTypeColor = (type: string) => {
    if (type === "dc_out") {
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
    }
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!dc) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <p className="text-lg text-dark-6">Delivery Challan not found</p>
        <Link href="/delivery-challans" className="mt-4 text-primary hover:underline">
          Back to Delivery Challans
        </Link>
      </div>
    );
  }

  const isDraft = dc.status === "draft";
  const canDispatch = dc.status === "draft";
  const canMarkInTransit = dc.status === "dispatched";
  const canMarkDelivered = ["dispatched", "in_transit"].includes(dc.status);
  const canCancel = !["cancelled", "delivered"].includes(dc.status);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-dark dark:text-white">{dc.dc_number}</h1>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                getTypeColor(dc.dc_type)
              )}
            >
              {dc.dc_type === "dc_out" ? "DC Out" : "DC In"}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize",
                getStatusColor(dc.status)
              )}
            >
              {dc.status.replace("_", " ")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <button
              onClick={handleDelete}
              disabled={actionLoading === "delete"}
              className="rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
            >
              {actionLoading === "delete" ? "Deleting..." : "Delete"}
            </button>
          )}

          {canDispatch && (
            <button
              onClick={() => performAction("dispatch")}
              disabled={actionLoading === "dispatch"}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {actionLoading === "dispatch" ? "..." : "Mark Dispatched"}
            </button>
          )}

          {canMarkInTransit && (
            <button
              onClick={() => performAction("in-transit")}
              disabled={actionLoading === "in-transit"}
              className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-yellow-600 disabled:opacity-50"
            >
              {actionLoading === "in-transit" ? "..." : "Mark In Transit"}
            </button>
          )}

          {canMarkDelivered && (
            <button
              onClick={() => performAction("delivered", { received_by: "Customer" })}
              disabled={actionLoading === "delivered"}
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
            >
              {actionLoading === "delivered" ? "..." : "Mark Delivered"}
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => performAction("cancel", { reason: "Cancelled by user" })}
              disabled={actionLoading === "cancel"}
              className="rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
            >
              {actionLoading === "cancel" ? "..." : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {/* DC Info */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">DC Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-6">Date:</span>
              <span className="text-dark dark:text-white">{dayjs(dc.dc_date).format("DD MMM YYYY")}</span>
            </div>
            {dc.invoice_number && (
              <div className="flex justify-between">
                <span className="text-dark-6">Invoice:</span>
                <Link href={`/invoices/${dc.invoice_id}`} className="text-primary hover:underline">
                  {dc.invoice_number}
                </Link>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-dark-6">Stock Updated:</span>
              <span className={dc.stock_updated ? "text-green-600" : "text-dark-6"}>
                {dc.stock_updated ? "Yes" : "No"}
              </span>
            </div>
            {dc.delivered_at && (
              <div className="flex justify-between">
                <span className="text-dark-6">Delivered:</span>
                <span className="text-dark dark:text-white">
                  {dayjs(dc.delivered_at).format("DD MMM YYYY")}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Customer</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-6">Name:</span>
              <span className="text-dark dark:text-white">{dc.customer_name || "-"}</span>
            </div>
            {dc.delivery_to_address && (
              <div>
                <span className="text-dark-6">Delivery Address:</span>
                <p className="mt-1 text-dark dark:text-white">
                  {dc.delivery_to_address}
                  {dc.delivery_to_city && `, ${dc.delivery_to_city}`}
                  {dc.delivery_to_state && `, ${dc.delivery_to_state}`}
                  {dc.delivery_to_pincode && ` - ${dc.delivery_to_pincode}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transport Details */}
      {(dc.transporter_name || dc.vehicle_number || dc.eway_bill_number) && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Transport Details</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {dc.transporter_name && (
              <div>
                <span className="text-sm text-dark-6">Transporter:</span>
                <p className="text-dark dark:text-white">{dc.transporter_name}</p>
              </div>
            )}
            {dc.vehicle_number && (
              <div>
                <span className="text-sm text-dark-6">Vehicle:</span>
                <p className="text-dark dark:text-white">{dc.vehicle_number}</p>
              </div>
            )}
            {dc.eway_bill_number && (
              <div>
                <span className="text-sm text-dark-6">E-Way Bill:</span>
                <p className="text-dark dark:text-white">{dc.eway_bill_number}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return Reason (for DC In) */}
      {dc.dc_type === "dc_in" && dc.return_reason && (
        <div className="mb-6 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <h4 className="font-medium text-amber-800 dark:text-amber-400">Return Reason</h4>
          <p className="mt-1 text-amber-700 dark:text-amber-300">{dc.return_reason}</p>
        </div>
      )}

      {/* Line Items */}
      <div className="mb-6 overflow-hidden rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2">
                <th className="px-4 py-3 text-left text-sm font-medium text-dark dark:text-white">#</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-dark dark:text-white">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-dark dark:text-white">HSN</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-dark dark:text-white">Quantity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-dark dark:text-white">Unit</th>
              </tr>
            </thead>
            <tbody>
              {dc.items?.map((item, index) => (
                <tr key={item.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-4 py-3 text-dark-6">{index + 1}</td>
                  <td className="px-4 py-3 text-dark dark:text-white">{item.description}</td>
                  <td className="px-4 py-3 text-dark-6">{item.hsn_code || "-"}</td>
                  <td className="px-4 py-3 text-right text-dark dark:text-white">{item.quantity}</td>
                  <td className="px-4 py-3 text-dark-6">{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {dc.notes && (
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h3 className="mb-2 font-semibold text-dark dark:text-white">Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-dark-6">{dc.notes}</p>
        </div>
      )}
    </div>
  );
}

