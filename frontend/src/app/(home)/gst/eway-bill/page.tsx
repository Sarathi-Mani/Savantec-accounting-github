"use client";

import { useAuth } from "@/context/AuthContext";
import { invoicesApi, gstIntegrationApi, Invoice, EWayBillCheck, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

export default function EWayBillPage() {
  const { company } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [ewayCheck, setEwayCheck] = useState<EWayBillCheck | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    transporter_id: "",
    transporter_name: "",
    vehicle_number: "",
    vehicle_type: "R", // R = Regular, O = ODC
    transport_mode: "1", // 1 = Road, 2 = Rail, 3 = Air, 4 = Ship
    distance_km: 0,
  });

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await invoicesApi.list(company.id, {
          page_size: 100,
        });
        // Filter to show invoices that could need E-Way Bill (finalized, amount > threshold)
        const eligibleInvoices = result.invoices.filter(inv => 
          inv.status !== 'draft' && 
          inv.status !== 'cancelled' &&
          inv.total_amount >= 50000
        );
        setInvoices(eligibleInvoices);
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [company?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSelectInvoice = async (invoice: Invoice) => {
    if (!company?.id) return;
    
    setSelectedInvoice(invoice);
    setError(null);

    try {
      const check = await gstIntegrationApi.checkEWayBillRequired(company.id, invoice.id);
      setEwayCheck(check);
      setShowForm(true);
    } catch (error) {
      console.error("Failed to check E-Way Bill requirement:", error);
      setShowForm(true);
    }
  };

  const handleGenerateEWayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !selectedInvoice) return;

    if (!formData.vehicle_number.trim()) {
      setError("Vehicle number is required");
      return;
    }

    setFormLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await gstIntegrationApi.generateEWayBill(company.id, {
        invoice_id: selectedInvoice.id,
        transporter_id: formData.transporter_id || undefined,
        transporter_name: formData.transporter_name || undefined,
        vehicle_number: formData.vehicle_number,
        vehicle_type: formData.vehicle_type,
        transport_mode: formData.transport_mode,
        distance_km: formData.distance_km,
      });

      if (result.success) {
        setSuccess(`E-Way Bill generated successfully! Bill No: ${result.eway_bill_number}`);
        setShowForm(false);
        setSelectedInvoice(null);
        resetForm();
      } else {
        setError(result.message || "Failed to generate E-Way Bill");
      }
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to generate E-Way Bill"));
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      transporter_id: "",
      transporter_name: "",
      vehicle_number: "",
      vehicle_type: "R",
      transport_mode: "1",
      distance_km: 0,
    });
    setEwayCheck(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedInvoice(null);
    resetForm();
    setError(null);
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">E-Way Bill</h1>
        <p className="text-sm text-dark-6">Generate E-Way Bills for goods transportation</p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">E-Way Bill is required for movement of goods worth more than ₹50,000</p>
            <p className="mt-1 text-blue-600 dark:text-blue-300">
              Note: This is a simulation. Actual E-Way Bill generation requires integration with the NIC portal.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {/* E-Way Bill Form */}
      {showForm && selectedInvoice && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark dark:text-white">
              Generate E-Way Bill
            </h2>
            <button onClick={handleCancel} className="text-dark-6 hover:text-dark">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Invoice Info */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <span className="text-sm text-dark-6">Invoice</span>
                <p className="font-medium text-dark dark:text-white">{selectedInvoice.invoice_number}</p>
              </div>
              <div>
                <span className="text-sm text-dark-6">Date</span>
                <p className="font-medium text-dark dark:text-white">
                  {dayjs(selectedInvoice.invoice_date).format("DD MMM YYYY")}
                </p>
              </div>
              <div>
                <span className="text-sm text-dark-6">Customer</span>
                <p className="font-medium text-dark dark:text-white">{selectedInvoice.customer_name || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-dark-6">Amount</span>
                <p className="font-medium text-dark dark:text-white">{formatCurrency(selectedInvoice.total_amount)}</p>
              </div>
            </div>
            {ewayCheck && (
              <div className="mt-3 flex items-center gap-2">
                {ewayCheck.eway_bill_required ? (
                  <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    E-Way Bill is required (Value exceeds ₹{ewayCheck.threshold.toLocaleString()})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    E-Way Bill not mandatory
                  </span>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleGenerateEWayBill}>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Transport Mode
                </label>
                <select
                  value={formData.transport_mode}
                  onChange={(e) => setFormData({ ...formData, transport_mode: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="1">Road</option>
                  <option value="2">Rail</option>
                  <option value="3">Air</option>
                  <option value="4">Ship</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Vehicle Type
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="R">Regular</option>
                  <option value="O">Over Dimensional Cargo (ODC)</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Vehicle Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                  placeholder="MH12AB1234"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 uppercase outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Approximate Distance (km)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.distance_km}
                  onChange={(e) => setFormData({ ...formData, distance_km: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Transporter Name
                </label>
                <input
                  type="text"
                  value={formData.transporter_name}
                  onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                  placeholder="Transport company name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Transporter ID (GSTIN)
                </label>
                <input
                  type="text"
                  value={formData.transporter_id}
                  onChange={(e) => setFormData({ ...formData, transporter_id: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 uppercase outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                {formLoading ? "Generating..." : "Generate E-Way Bill"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoices List */}
      <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="border-b border-stroke p-4 dark:border-dark-3">
          <h3 className="font-semibold text-dark dark:text-white">
            Eligible Invoices (₹50,000+)
          </h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-3m-1 4l-3 3m0 0l-3-3m3 3V10" />
            </svg>
            <p className="text-dark-6">No invoices above ₹50,000 found</p>
            <p className="mt-2 text-sm text-dark-6">E-Way Bill is required for goods worth more than ₹50,000</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Invoice #</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Customer</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Amount</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-dark-6">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                    <td className="px-6 py-4">
                      <span className="font-medium text-dark dark:text-white">{invoice.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-6">
                      {dayjs(invoice.invoice_date).format("DD MMM YYYY")}
                    </td>
                    <td className="px-6 py-4 text-sm text-dark dark:text-white">
                      {invoice.customer_name || "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-dark dark:text-white">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        E-Way Required
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSelectInvoice(invoice)}
                          disabled={selectedInvoice?.id === invoice.id}
                          className="rounded bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                        >
                          Generate
                        </button>
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
