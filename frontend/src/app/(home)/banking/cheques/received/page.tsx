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
  drawer_name: string;
  drawn_on_bank?: string;
  drawn_on_branch?: string;
  status: string;
  notes?: string;
  party_id?: string;
  party_type?: string;
  deposit_date?: string;
  bounce_date?: string;
  bounce_reason?: string;
  bounce_charges?: number;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
}

interface Customer {
  id: string;
  name: string;
}

type ModalMode = "create" | "view" | "edit";

export default function ReceivedChequesPage() {
  const { company } = useAuth();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cheque_number: "",
    cheque_date: new Date().toISOString().split("T")[0],
    amount: "",
    drawer_name: "",
    drawn_on_bank: "",
    drawn_on_branch: "",
    party_id: "",
    party_type: "customer",
    notes: "",
  });

  const [depositData, setDepositData] = useState({
    bank_account_id: "",
    deposit_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (company?.id) {
      fetchCheques();
      fetchBankAccounts();
      fetchCustomers();
    }
  }, [company]);

  const fetchCheques = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/companies/${company?.id}/cheques?cheque_type=received`
      );
      setCheques(response.data);
    } catch (error) {
      console.error("Error fetching cheques:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/bank-accounts`);
      setBankAccounts(response.data);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/customers`);
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "party_id" && value) {
      const selectedCustomer = customers.find((c) => c.id === value);
      if (selectedCustomer) {
        setFormData((prev) => ({
          ...prev,
          party_id: value,
          drawer_name: selectedCustomer.name,
        }));
      }
    }
  };

  const resetForm = () => {
    setFormData({
      cheque_number: "",
      cheque_date: new Date().toISOString().split("T")[0],
      amount: "",
      drawer_name: "",
      drawn_on_bank: "",
      drawn_on_branch: "",
      party_id: "",
      party_type: "customer",
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
      cheque_number: cheque.cheque_number,
      cheque_date: cheque.cheque_date.split("T")[0],
      amount: cheque.amount.toString(),
      drawer_name: cheque.drawer_name,
      drawn_on_bank: cheque.drawn_on_bank || "",
      drawn_on_branch: cheque.drawn_on_branch || "",
      party_id: cheque.party_id || "",
      party_type: cheque.party_type || "customer",
      notes: cheque.notes || "",
    });
    setModalMode("edit");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    if (!formData.cheque_number.trim()) {
      setError("Please enter cheque number");
      setSaving(false);
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      setSaving(false);
      return;
    }
    if (!formData.drawer_name.trim()) {
      setError("Please enter drawer name");
      setSaving(false);
      return;
    }

    try {
      const payload: any = {
        cheque_number: formData.cheque_number.trim(),
        cheque_date: new Date(formData.cheque_date).toISOString(),
        amount: parseFloat(formData.amount),
        drawer_name: formData.drawer_name.trim(),
        drawn_on_bank: formData.drawn_on_bank.trim() || null,
        drawn_on_branch: formData.drawn_on_branch.trim() || null,
        notes: formData.notes.trim() || null,
      };

      if (formData.party_id) {
        payload.party_id = formData.party_id;
        payload.party_type = formData.party_type;
      }

      if (modalMode === "create") {
        await api.post(`/companies/${company?.id}/cheques/receive`, payload);
        setSuccess("Cheque received successfully!");
      } else if (modalMode === "edit" && selectedCheque) {
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

  const openDepositModal = (cheque: Cheque) => {
    setSelectedCheque(cheque);
    setDepositData({
      bank_account_id: "",
      deposit_date: new Date().toISOString().split("T")[0],
    });
    setShowDepositModal(true);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque || !depositData.bank_account_id) return;

    setSaving(true);
    try {
      await api.post(
        `/companies/${company?.id}/cheques/${selectedCheque.id}/deposit?bank_account_id=${depositData.bank_account_id}`
      );
      setShowDepositModal(false);
      setSelectedCheque(null);
      fetchCheques();
      setSuccess("Cheque deposited successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error depositing cheque:", error);
      setError(error.response?.data?.detail || "Failed to deposit cheque");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleBounce = async (cheque: Cheque) => {
    const reason = prompt("Enter bounce reason:");
    if (!reason) return;

    const chargesStr = prompt("Enter bounce charges (0 if none):", "0");
    const charges = parseFloat(chargesStr || "0");

    try {
      await api.post(
        `/companies/${company?.id}/cheques/${cheque.id}/bounce?bounce_reason=${encodeURIComponent(reason)}&bounce_charges=${charges}`
      );
      fetchCheques();
      setSuccess("Cheque marked as bounced!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to mark cheque as bounced");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleClear = async (cheque: Cheque) => {
    if (!confirm(`Mark cheque ${cheque.cheque_number} as cleared?`)) return;

    try {
      await api.post(`/companies/${company?.id}/cheques/${cheque.id}/clear`);
      fetchCheques();
      setSuccess("Cheque marked as cleared!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to mark cheque as cleared");
      setTimeout(() => setError(null), 3000);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "cleared": return "bg-success bg-opacity-10 text-success";
      case "bounced": return "bg-danger bg-opacity-10 text-danger";
      case "received": return "bg-warning bg-opacity-10 text-warning";
      case "deposited": return "bg-primary bg-opacity-10 text-primary";
      case "cancelled": return "bg-body bg-opacity-10 text-body";
      default: return "bg-gray-2 text-body";
    }
  };

  const canEdit = (cheque: Cheque) => !["cleared", "deposited"].includes(cheque.status);
  const canDelete = (cheque: Cheque) => !["cleared", "deposited"].includes(cheque.status);

  return (
    <>
      <Breadcrumb pageName="Received Cheques" />

      {success && (
        <div className="mb-4 rounded-lg bg-success bg-opacity-10 p-4 text-success">
          {success}
        </div>
      )}
      {error && !showModal && !showDepositModal && (
        <div className="mb-4 rounded-lg bg-danger bg-opacity-10 p-4 text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-body dark:text-bodydark">
          Cheques received from customers and others.
        </p>
        <button
          onClick={openCreateModal}
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90"
        >
          + Receive Cheque
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Cheque No.</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Drawer</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Bank</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Amount</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : cheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-body">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-12 w-12 text-body opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No received cheques found</p>
                      <p className="text-sm">Record a cheque received from a customer to get started.</p>
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
                      {cheque.drawer_name}
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      {cheque.drawn_on_bank || "-"}
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
                        {cheque.status === "received" && (
                          <button
                            onClick={() => openDepositModal(cheque)}
                            className="rounded bg-success bg-opacity-10 px-3 py-1 text-sm font-medium text-success hover:bg-opacity-20"
                            title="Deposit"
                          >
                            Deposit
                          </button>
                        )}
                        {cheque.status === "deposited" && (
                          <>
                            <button
                              onClick={() => handleClear(cheque)}
                              className="rounded bg-success bg-opacity-10 px-3 py-1 text-sm font-medium text-success hover:bg-opacity-20"
                              title="Mark Cleared"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => handleBounce(cheque)}
                              className="rounded bg-danger bg-opacity-10 px-3 py-1 text-sm font-medium text-danger hover:bg-opacity-20"
                              title="Mark Bounced"
                            >
                              Bounce
                            </button>
                          </>
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
                {modalMode === "create" ? "Receive Cheque" : modalMode === "view" ? "Cheque Details" : "Edit Cheque"}
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
                  <p className="text-sm text-body">Drawer Name</p>
                  <p className="font-medium text-black dark:text-white">{selectedCheque.drawer_name}</p>
                </div>
                {selectedCheque.drawn_on_bank && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-body">Bank</p>
                      <p className="text-black dark:text-white">{selectedCheque.drawn_on_bank}</p>
                    </div>
                    {selectedCheque.drawn_on_branch && (
                      <div>
                        <p className="text-sm text-body">Branch</p>
                        <p className="text-black dark:text-white">{selectedCheque.drawn_on_branch}</p>
                      </div>
                    )}
                  </div>
                )}
                {selectedCheque.notes && (
                  <div>
                    <p className="text-sm text-body">Notes</p>
                    <p className="text-black dark:text-white">{selectedCheque.notes}</p>
                  </div>
                )}
                {selectedCheque.deposit_date && (
                  <div>
                    <p className="text-sm text-body">Deposited On</p>
                    <p className="text-black dark:text-white">
                      {new Date(selectedCheque.deposit_date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                )}
                {selectedCheque.bounce_reason && (
                  <div className="p-3 bg-danger bg-opacity-10 rounded">
                    <p className="text-sm text-danger font-medium">Bounce Details</p>
                    <p className="text-danger">Reason: {selectedCheque.bounce_reason}</p>
                    {selectedCheque.bounce_charges && selectedCheque.bounce_charges > 0 && (
                      <p className="text-danger">Charges: ₹{selectedCheque.bounce_charges}</p>
                    )}
                    {selectedCheque.bounce_date && (
                      <p className="text-danger text-sm">
                        Date: {new Date(selectedCheque.bounce_date).toLocaleDateString("en-IN")}
                      </p>
                    )}
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
                  {selectedCheque.status === "received" && (
                    <button
                      onClick={() => { setShowModal(false); openDepositModal(selectedCheque); }}
                      className="rounded bg-success px-6 py-2 font-medium text-white hover:bg-opacity-90"
                    >
                      Deposit
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
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                      Cheque Number <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="cheque_number"
                      value={formData.cheque_number}
                      onChange={handleInputChange}
                      placeholder="e.g., 123456"
                      className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                      required
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
                    Received From (Customer)
                  </label>
                  <select
                    name="party_id"
                    value={formData.party_id}
                    onChange={handleInputChange}
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  >
                    <option value="">Select Customer (Optional)</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    Drawer Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="drawer_name"
                    value={formData.drawer_name}
                    onChange={handleInputChange}
                    placeholder="Name of person/company who issued the cheque"
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                      Drawn On Bank
                    </label>
                    <input
                      type="text"
                      name="drawn_on_bank"
                      value={formData.drawn_on_bank}
                      onChange={handleInputChange}
                      placeholder="e.g., HDFC Bank"
                      className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                      Branch
                    </label>
                    <input
                      type="text"
                      name="drawn_on_branch"
                      value={formData.drawn_on_branch}
                      onChange={handleInputChange}
                      placeholder="e.g., MG Road"
                      className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                    />
                  </div>
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
                        {modalMode === "create" ? "Saving..." : "Updating..."}
                      </>
                    ) : (
                      modalMode === "create" ? "Receive Cheque" : "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Deposit Cheque Modal */}
      {showDepositModal && selectedCheque && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-boxdark">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-black dark:text-white">
                Deposit Cheque
              </h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-body hover:text-danger"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-2 dark:bg-meta-4 rounded-lg">
              <p className="text-sm text-body">Cheque Details:</p>
              <p className="font-medium">{selectedCheque.cheque_number} - ₹{selectedCheque.amount?.toLocaleString("en-IN")}</p>
              <p className="text-sm">{selectedCheque.drawer_name}</p>
            </div>

            <form onSubmit={handleDeposit}>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                  Deposit To Bank Account <span className="text-danger">*</span>
                </label>
                <select
                  value={depositData.bank_account_id}
                  onChange={(e) => setDepositData({ ...depositData, bank_account_id: e.target.value })}
                  className="w-full rounded border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                  required
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name} - {account.bank_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="rounded border border-stroke px-6 py-2 font-medium text-body hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !depositData.bank_account_id}
                  className="flex items-center gap-2 rounded bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Depositing...
                    </>
                  ) : (
                    "Deposit"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
