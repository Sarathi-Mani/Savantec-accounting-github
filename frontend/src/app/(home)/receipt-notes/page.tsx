"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { ordersApi, ReceiptNote as ApiReceiptNote } from "@/services/api";

interface ReceiptNote extends ApiReceiptNote {
  vendor_name?: string;
  purchase_order_number?: string;
  total_items?: number;
  status?: string;
}

export default function ReceiptNotesPage() {
  const { company } = useAuth();
  const [notes, setNotes] = useState<ReceiptNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchNotes();
    }
  }, [company]);

  const fetchNotes = async () => {
    if (!company?.id) return;
    try {
      const data = await ordersApi.listReceiptNotes(company.id);
      setNotes(data as ReceiptNote[]);
    } catch (error) {
      console.error("Error fetching receipt notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "received": return "bg-success bg-opacity-10 text-success";
      case "partial": return "bg-warning bg-opacity-10 text-warning";
      case "pending": return "bg-primary bg-opacity-10 text-primary";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Receipt Notes / GRN" />

      <div className="flex justify-end mb-4">
        <Link
          href="/receipt-notes/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Create Receipt Note
        </Link>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Receipt #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Vendor</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">PO Number</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Items</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.receipt_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(note.receipt_date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.vendor_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.purchase_order_number || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.total_items}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(note.status || "pending")}`}>
                      {note.status}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <div className="flex gap-2">
                      <Link href={`/receipt-notes/${note.id}`} className="text-primary hover:underline">
                        View
                      </Link>
                      <button
                        onClick={async () => {
                          if (confirm("Are you sure you want to delete this receipt note? This will reverse stock movements.")) {
                            try {
                              await ordersApi.deleteReceiptNote(company?.id || "", note.id);
                              fetchNotes();
                            } catch (error) {
                              console.error("Error deleting receipt note:", error);
                              alert("Failed to delete receipt note");
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
                    No receipt notes (GRN) found. Create goods receipt notes when receiving goods from vendors.
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

