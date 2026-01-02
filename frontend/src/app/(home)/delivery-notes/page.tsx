"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { ordersApi, DeliveryNote as ApiDeliveryNote } from "@/services/api";

interface DeliveryNote extends ApiDeliveryNote {
  customer_name?: string;
  sales_order_number?: string;
  total_items?: number;
  status?: string;
}

export default function DeliveryNotesPage() {
  const { company } = useAuth();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchNotes();
    }
  }, [company]);

  const fetchNotes = async () => {
    if (!company?.id) return;
    try {
      const data = await ordersApi.listDeliveryNotes(company.id);
      setNotes(data as DeliveryNote[]);
    } catch (error) {
      console.error("Error fetching delivery notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "bg-success bg-opacity-10 text-success";
      case "in_transit": return "bg-warning bg-opacity-10 text-warning";
      case "pending": return "bg-primary bg-opacity-10 text-primary";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Delivery Notes" />

      <div className="flex justify-end mb-4">
        <Link
          href="/delivery-notes/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Create Delivery Note
        </Link>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Delivery #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Customer</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Sales Order</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Items</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.delivery_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(note.delivery_date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.customer_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.sales_order_number || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.total_items}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(note.status || "pending")}`}>
                      {note.status || "pending"}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <div className="flex gap-2">
                      <Link href={`/delivery-notes/${note.id}`} className="text-primary hover:underline">
                        View
                      </Link>
                      <button
                        onClick={async () => {
                          if (confirm("Are you sure you want to delete this delivery note? This will reverse stock movements.")) {
                            try {
                              await ordersApi.deleteDeliveryNote(company?.id || "", note.id);
                              fetchNotes();
                            } catch (error) {
                              console.error("Error deleting delivery note:", error);
                              alert("Failed to delete delivery note");
                            }
                          }
                        }}
                        className="text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {notes.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No delivery notes found. Create delivery challans for goods dispatch.
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

