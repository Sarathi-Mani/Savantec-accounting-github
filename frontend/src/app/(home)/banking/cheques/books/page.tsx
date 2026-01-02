"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface ChequeBook {
  id: string;
  bank_account_id: string;
  book_name: string;
  cheque_series_from: string;
  cheque_series_to: string;
  current_cheque: string;
  total_leaves: number;
  used_leaves: number;
  is_active: boolean;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
}

export default function ChequeBooksPage() {
  const { company } = useAuth();
  const [chequeBooks, setChequeBooks] = useState<ChequeBook[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bank_account_id: "",
    book_name: "",
    cheque_series_from: "",
    cheque_series_to: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchChequeBooks();
      fetchBankAccounts();
    }
  }, [company]);

  const fetchChequeBooks = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/cheque-books`
      );
      setChequeBooks(response.data);
    } catch (error) {
      console.error("Error fetching cheque books:", error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/bank-accounts`
      );
      setBankAccounts(response.data);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(
        `/companies/${company?.id}/cheque-books`,
        formData
      );
      setShowModal(false);
      setFormData({
        bank_account_id: "",
        book_name: "",
        cheque_series_from: "",
        cheque_series_to: "",
      });
      fetchChequeBooks();
    } catch (error) {
      console.error("Error creating cheque book:", error);
      alert("Error creating cheque book");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Cheque Books" />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Add Cheque Book
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Book Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Series From</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Series To</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Current</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Used/Total</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {chequeBooks.map((book) => (
                <tr key={book.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {book.book_name || "Unnamed Book"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {book.cheque_series_from}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {book.cheque_series_to}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {book.current_cheque}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {book.used_leaves}/{book.total_leaves}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                      book.is_active 
                        ? "bg-success bg-opacity-10 text-success" 
                        : "bg-danger bg-opacity-10 text-danger"
                    }`}>
                      {book.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {chequeBooks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-body">
                    No cheque books found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
              Add Cheque Book
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">
                  Bank Account <span className="text-meta-1">*</span>
                </label>
                <select
                  value={formData.bank_account_id}
                  onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                  required
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name} - {account.bank_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Book Name</label>
                <input
                  type="text"
                  value={formData.book_name}
                  onChange={(e) => setFormData({ ...formData, book_name: e.target.value })}
                  placeholder="e.g., Book 1"
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Series From <span className="text-meta-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.cheque_series_from}
                    onChange={(e) => setFormData({ ...formData, cheque_series_from: e.target.value })}
                    placeholder="e.g., 000001"
                    required
                    className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Series To <span className="text-meta-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.cheque_series_to}
                    onChange={(e) => setFormData({ ...formData, cheque_series_to: e.target.value })}
                    placeholder="e.g., 000100"
                    required
                    className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-stroke px-6 py-2 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

