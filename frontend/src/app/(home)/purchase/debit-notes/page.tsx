"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface DebitNote {
  id: string;
  note_number: string;
  note_date: string;
  vendor_name: string;
  original_invoice: string;
  total_amount: number;
  reason: string;
}

export default function DebitNotesPage() {
  const { company } = useAuth();
  const [notes, setNotes] = useState<DebitNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchNotes();
    }
  }, [company]);

  const fetchNotes = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/debit-notes`
      );
      setNotes(response.data);
    } catch (error) {
      console.error("Error fetching debit notes:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Debit Notes" />

      <div className="flex justify-end mb-4">
        <Link
          href="/purchase/debit-notes/new"
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Create Debit Note
        </Link>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Note #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Vendor</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Original Invoice</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Reason</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.note_number}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(note.note_date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.vendor_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.original_invoice}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    ₹{note.total_amount.toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {note.reason}
                  </td>
                </tr>
              ))}
              {notes.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-body">
                    No debit notes found. Create debit notes for purchase returns or price adjustments.
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

