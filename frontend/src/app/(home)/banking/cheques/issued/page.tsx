"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Cheque {
  id: string;
  cheque_type: string;
  cheque_number: string;
  cheque_date: string;
  amount: number;
  payee_name: string;
  status: string;
  drawn_on_bank?: string;
  notes?: string;
  party_id?: string;
  party_type?: string;
  created_at?: string;
  stop_date?: string;
  stop_reason?: string;
}

interface ChequeBook {
  id: string;
  book_name: string;
  current_cheque: string;
  bank_account_id: string;
  is_active: boolean;
}

interface Vendor {
  id: string;
  name: string;
}

type ModalMode = "create" | "view" | "edit";

export default function IssuedChequesPage() {
  const { company } = useAuth();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [chequeBooks, setChequeBooks] = useState<ChequeBook[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cheque_book_id: "",
    cheque_number: "",
    cheque_date: new Date().toISOString().split("T")[0],
    amount: "",
    payee_name: "",
    party_id: "",
    party_type: "vendor",
    notes: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchCheques();
      fetchChequeBooks();
      fetchVendors();
    }
  }, [company]);

  const fetchCheques = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/companies/${company?.id}/cheques?cheque_type=issued`
      );
      setCheques(response.data);
    } catch (error) {
      console.error("Error fetching cheques:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChequeBooks = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/cheque-books`);
      setChequeBooks(response.data.filter((book: ChequeBook) => book.is_active));
    } catch (error) {
      console.error("Error fetching cheque books:", error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/vendors`);
      setVendors(response.data.customers || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "cheque_book_id" && value && modalMode === "create") {
      const selectedBook = chequeBooks.find((b) => b.id === value);
      if (selectedBook) {
        setFormData((prev) => ({
          ...prev,
          cheque_book_id: value,
          cheque_number: selectedBook.current_cheque,
        }));
      }
    }

    if (name === "party_id" && value && formData.party_type === "vendor") {
      const selectedVendor = vendors.find((v) => v.id === value);
      if (selectedVendor) {
        setFormData((prev) => ({
          ...prev,
          party_id: value,
          payee_name: selectedVendor.name,
        }));
      }
    }
  };

  const resetForm = () => {
    setFormData({
      cheque_book_id: "",
      cheque_number: "",
      cheque_date: new Date().toISOString().split("T")[0],
      amount: "",
      payee_name: "",
      party_id: "",
      party_type: "vendor",
      notes: "",
    });
    setError(null);
    setSelectedCheque(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode("create");
    setShowModal(true);
  };

  const openViewModal = (cheque: Cheque) => {
    setSelectedCheque(cheque);
    setModalMode("view");
    setShowModal(true);
  };

  const openEditModal = (cheque: Cheque) => {
    setSelectedCheque(cheque);
    setFormData({
      cheque_book_id: "",
      cheque_number: cheque.cheque_number,
      cheque_date: cheque.cheque_date.split("T")[0],
      amount: cheque.amount.toString(),
      payee_name: cheque.payee_name,
      party_id: cheque.party_id || "",
      party_type: cheque.party_type || "vendor",
      notes: cheque.notes || "",
    });
    setModalMode("edit");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    if (modalMode === "create" && !formData.cheque_book_id) {
      setError("Please select a cheque book");
      setSaving(false);
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      setSaving(false);
      return;
    }
    if (!formData.payee_name.trim()) {
      setError("Please enter payee name");
      setSaving(false);
      return;
    }

    try {
      if (modalMode === "create") {
        const payload: any = {
          cheque_book_id: formData.cheque_book_id,
          cheque_date: new Date(formData.cheque_date).toISOString(),
          amount: parseFloat(formData.amount),
          payee_name: formData.payee_name.trim(),
          notes: formData.notes.trim() || null,
        };
        if (formData.cheque_number) {
          payload.cheque_number = formData.cheque_number;
        }
        if (formData.party_id) {
          payload.party_id = formData.party_id;
          payload.party_type = formData.party_type;
        }
        await api.post(`/companies/${company?.id}/cheques/issue`, payload);
        setSuccess("Cheque issued successfully!");
        fetchChequeBooks();
      } else if (modalMode === "edit" && selectedCheque) {
        const payload: any = {
          cheque_date: new Date(formData.cheque_date).toISOString(),
          amount: parseFloat(formData.amount),
          payee_name: formData.payee_name.trim(),
          notes: formData.notes.trim() || null,
        };
        if (formData.party_id) {
          payload.party_id = formData.party_id;
          payload.party_type = formData.party_type;
        }
        await api.put(`/companies/${company?.id}/cheques/${selectedCheque.id}`, payload);
        setSuccess("Cheque updated successfully!");
      }

      setShowModal(false);
      resetForm();
      fetchCheques();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error:", error);
      setError(error.response?.data?.detail || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cheque: Cheque) => {
    if (!confirm(`Are you sure you want to delete cheque ${cheque.cheque_number}?`)) return;

    try {
      await api.delete(`/companies/${company?.id}/cheques/${cheque.id}`);
      fetchCheques();
      setSuccess("Cheque deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to delete cheque");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleStopPayment = async (cheque: Cheque) => {
    const reason = prompt("Enter reason for stopping payment:");
    if (!reason) return;

    try {
      await api.post(`/companies/${company?.id}/cheques/${cheque.id}/stop-payment?stop_reason=${encodeURIComponent(reason)}`);
      fetchCheques();
      setSuccess("Payment stopped successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to stop payment");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCancel = async (cheque: Cheque) => {
    if (!confirm(`Are you sure you want to cancel cheque ${cheque.cheque_number}?`)) return;

    try {
      await api.post(`/companies/${company?.id}/cheques/${cheque.id}/cancel`);
      fetchCheques();
      setSuccess("Cheque cancelled successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to cancel cheque");
      setTimeout(() => setError(null), 3000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "cleared": return "bg-success bg-opacity-10 text-success";
      case "bounced": return "bg-danger bg-opacity-10 text-danger";
      case "issued": return "bg-warning bg-opacity-10 text-warning";
      case "deposited": return "bg-primary bg-opacity-10 text-primary";
      case "stopped": return "bg-meta-1 bg-opacity-10 text-meta-1";
      case "cancelled": return "bg-body bg-opacity-10 text-body";
      default: return "bg-gray-2 text-body";
    }
  };

  const canEdit = (cheque: Cheque) => !["cleared", "deposited"].includes(cheque.status);
  const canDelete = (cheque: Cheque) => !["cleared", "deposited"].includes(cheque.status);

  return (
    <>
      <Breadcrumb pageName="Issued Cheques" />

      {success && (
        <div className="mb-4 rounded-lg bg-success bg-opacity-10 p-4 text-success">
          {success}
        </div>
      )}
      {error && !showModal && (
        <div className="mb-4 rounded-lg bg-danger bg-opacity-10 p-4 text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-body dark:text-bodydark">
          Cheques issued by your company to vendors and others.
        </p>
        <button
          onClick={openCreateModal}
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90"
        >
          + Issue Cheque
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Cheque No.</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Payee</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : cheques.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-body">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-12 w-12 text-body opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No issued cheques found</p>
                      <p className="text-sm">Issue a cheque from your cheque book to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                cheques.map((cheque) => (
                  <tr key={cheque.id} className="hover:bg-gray-1 dark:hover:bg-meta-4 cursor-pointer" onClick={() => openViewModal(cheque)}>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark font-medium">
                      {cheque.cheque_number}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      {new Date(cheque.cheque_date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      {cheque.payee_name}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark font-medium">
                      ₹{cheque.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${getStatusColor(cheque.status)}`}>
                        {cheque.status}
                      </span>
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openViewModal(cheque)}
                          className="rounded bg-primary bg-opacity-10 px-3 py-1 text-sm font-medium text-primary hover:bg-opacity-20"
                          title="View"
                        >
                          View
                        </button>
                        {canEdit(cheque) && (
                          <button
                            onClick={() => openEditModal(cheque)}
                            className="rounded bg-warning bg-opacity-10 px-3 py-1 text-sm font-medium text-warning hover:bg-opacity-20"
                            title="Edit"
                          >
                            Edit
                          </button>
                        )}
                        {cheque.status === "issued" && (
                          <button
                            onClick={() => handleStopPayment(cheque)}
                            className="rounded bg-meta-1 bg-opacity-10 px-3 py-1 text-sm font-medium text-meta-1 hover:bg-opacity-20"
                            title="Stop Payment"
                          >
                            Stop
                          </button>
                        )}
                        {canDelete(cheque) && (
                          <button
                            onClick={() => handleDelete(cheque)}
                            className="rounded bg-danger bg-opacity-10 px-3 py-1 text-sm font-medium text-danger hover:bg-opacity-20"
                            title="Delete"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Create/View/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 dark:bg-boxdark max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-black dark:text-white">
                {modalMode === "create" ? "Issue Cheque" : modalMode === "view" ? "Cheque Details" : "Edit Cheque"}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-body hover:text-danger"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-danger bg-opacity-10 p-3 text-sm text-danger">
                {error}
              </div>
            )}

            {/* View Mode */}
            {modalMode === "view" && selectedCheque && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-body">Cheque Number</p>
                    <p className="font-medium text-black dark:text-white">{selectedCheque.cheque_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-body">Cheque Date</p>
                    <p className="font-medium text-black dark:text-white">
                      {new Date(selectedCheque.cheque_date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-body">Amount</p>
                    <p className="font-medium text-black dark:text-white text-lg">
                      ₹{selectedCheque.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-body">Status</p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${getStatusColor(selectedCheque.status)}`}>
                      {selectedCheque.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-body">Payee Name</p>
                  <p className="font-medium text-black dark:text-white">{selectedCheque.payee_name}</p>
                </div>
                {selectedCheque.notes && (
                  <div>
                    <p className="text-sm text-body">Notes</p>
                    <p className="text-black dark:text-white">{selectedCheque.notes}</p>
                  </div>
                )}
                {selectedCheque.stop_reason && (
                  <div className="p-3 bg-danger bg-opacity-10 rounded">
                    <p className="text-sm text-danger">Stop Reason</p>
                    <p className="text-danger">{selectedCheque.stop_reason}</p>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  {canEdit(selectedCheque) && (
                    <button
                      onClick={() => openEditModal(selectedCheque)}
                      className="rounded bg-warning px-6 py-2 font-medium text-white hover:bg-opacity-90"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="rounded border border-stroke px-6 py-2 font-medium text-body hover:bg-gray-2 dark:border-strokedark"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Create/Edit Mode */}
            {(modalMode === "create" || modalMode === "edit") && (
              <>
                {modalMode === "create" && chequeBooks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-body mb-4">No active cheque books found.</p>
                    <a href="/banking/cheques/books" className="text-primary hover:underline">
                      Create a cheque book first →
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {modalMode === "create" && (
                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                          Cheque Book <span className="text-danger">*</span>
                        </label>
                        <select
                          name="cheque_book_id"
                          value={formData.cheque_book_id}
                          onChange={handleInputChange}
                          className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                          required
                        >
                          <option value="">Select Cheque Book</option>
                          {chequeBooks.map((book) => (
                            <option key={book.id} value={book.id}>
                              {book.book_name || "Unnamed Book"} (Next: {book.current_cheque})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                          Cheque Number {modalMode === "edit" && "(Read Only)"}
                        </label>
                        <input
                          type="text"
                          name="cheque_number"
                          value={formData.cheque_number}
                          onChange={handleInputChange}
                          placeholder="Auto from cheque book"
                          className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                          readOnly={modalMode === "edit"}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                          Cheque Date <span className="text-danger">*</span>
                        </label>
                        <input
                          type="date"
                          name="cheque_date"
                          value={formData.cheque_date}
                          onChange={handleInputChange}
                          className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                        Amount <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                        required
                      />
                    </div>

                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                        Pay To (Vendor)
                      </label>
                      <select
                        name="party_id"
                        value={formData.party_id}
                        onChange={handleInputChange}
                        className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                      >
                        <option value="">Select Vendor (Optional)</option>
                        {vendors.map((vendor) => (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                        Payee Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        name="payee_name"
                        value={formData.payee_name}
                        onChange={handleInputChange}
                        placeholder="Name as written on cheque"
                        className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                        required
                      />
                    </div>

                    <div className="mb-6">
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        placeholder="Optional notes or reference"
                        rows={2}
                        className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowModal(false); resetForm(); }}
                        className="rounded border border-stroke px-6 py-2 font-medium text-body hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 rounded bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                            {modalMode === "create" ? "Issuing..." : "Saving..."}
                          </>
                        ) : (
                          modalMode === "create" ? "Issue Cheque" : "Save Changes"
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
