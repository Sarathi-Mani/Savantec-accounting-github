"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { invoicesApi, customersApi, creditNotesApi, getErrorMessage } from "@/services/api";
import type { Customer, Invoice, InvoiceItem } from "@/services/api";

interface ReturnItem {
  invoice_item_id: string;
  description: string;
  quantity: number;
  max_quantity: number;
  unit_price: number;
  gst_rate: number;
  selected: boolean;
}

export default function NewCreditNotePage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customer_id: "",
    original_invoice_id: "",
    note_date: new Date().toISOString().split("T")[0],
    reason: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) return;
      try {
        setLoading(true);
        const customersData = await customersApi.list(company.id, { page_size: 100 });
        setCustomers(customersData.customers || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [company?.id]);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!company?.id || !formData.customer_id) {
        setSalesInvoices([]);
        return;
      }
      try {
        const data = await invoicesApi.list(company.id, { 
          customer_id: formData.customer_id,
          status: "paid" // Only show paid invoices that can be refunded
        });
        // Filter out already refunded invoices
        const eligibleInvoices = (data.invoices || []).filter(
          inv => inv.status !== 'refunded' && inv.status !== 'cancelled'
        );
        setSalesInvoices(eligibleInvoices);
      } catch (error) {
        console.error("Error fetching invoices:", error);
        setSalesInvoices([]);
      }
    };
    fetchInvoices();
  }, [company?.id, formData.customer_id]);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      if (!company?.id || !formData.original_invoice_id) {
        setSelectedInvoice(null);
        setReturnItems([]);
        return;
      }
      try {
        const invoice = await invoicesApi.get(company.id, formData.original_invoice_id);
        setSelectedInvoice(invoice);
        
        // Populate return items from invoice items
        const items: ReturnItem[] = (invoice.items || []).map((item: InvoiceItem) => ({
          invoice_item_id: item.id,
          description: item.description,
          quantity: item.quantity,
          max_quantity: item.quantity,
          unit_price: item.unit_price,
          gst_rate: item.gst_rate,
          selected: true,
        }));
        setReturnItems(items);
      } catch (error) {
        console.error("Error fetching invoice details:", error);
        setSelectedInvoice(null);
        setReturnItems([]);
      }
    };
    fetchInvoiceDetails();
  }, [company?.id, formData.original_invoice_id]);

  const handleItemToggle = (index: number) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index].selected = !updated[index].selected;
      return updated;
    });
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index].quantity = Math.min(Math.max(0, quantity), updated[index].max_quantity);
      return updated;
    });
  };

  const calculateTotals = () => {
    const selectedItems = returnItems.filter(item => item.selected && item.quantity > 0);
    const taxable = selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const gst = selectedItems.reduce((sum, item) => {
      const itemTaxable = item.quantity * item.unit_price;
      return sum + (itemTaxable * item.gst_rate / 100);
    }, 0);
    return { taxable, gst, total: taxable + gst };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    setError(null);
    setSuccess(null);

    if (!formData.original_invoice_id) {
      setError("Please select an invoice to create credit note for");
      return;
    }

    const selectedItems = returnItems.filter(item => item.selected && item.quantity > 0);
    if (selectedItems.length === 0) {
      setError("Please select at least one item to return");
      return;
    }

    if (!formData.reason.trim()) {
      setError("Please provide a reason for the credit note");
      return;
    }

    setSubmitting(true);
    try {
      const result = await creditNotesApi.create(company.id, {
        original_invoice_id: formData.original_invoice_id,
        note_date: formData.note_date,
        reason: formData.reason,
        items: selectedItems.map(item => ({
          invoice_item_id: item.invoice_item_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          gst_rate: item.gst_rate,
        })),
      });
      
      setSuccess(`Credit note ${result.note_number} created successfully!`);
      setTimeout(() => {
        router.push("/invoices/credit-notes");
      }, 1500);
    } catch (error: any) {
      console.error("Error creating credit note:", error);
      setError(getErrorMessage(error, "Failed to create credit note"));
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-body">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Create Credit Note" />

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <h3 className="text-xl font-semibold mb-4">Credit Note Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Customer *</label>
              <select
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value, original_invoice_id: "" })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Original Invoice *</label>
              <select
                required
                value={formData.original_invoice_id}
                onChange={(e) => setFormData({ ...formData, original_invoice_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                disabled={!formData.customer_id}
              >
                <option value="">Select Invoice</option>
                {salesInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - ₹{invoice.total_amount?.toLocaleString()} ({invoice.status})
                  </option>
                ))}
              </select>
              {formData.customer_id && salesInvoices.length === 0 && (
                <p className="text-sm text-dark-6 mt-1">No eligible invoices found for this customer</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Note Date *</label>
              <input
                type="date"
                required
                value={formData.note_date}
                onChange={(e) => setFormData({ ...formData, note_date: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Reason *</label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder="e.g., Goods returned, Price adjustment"
              />
            </div>
          </div>
        </div>

        {/* Return Items Section */}
        {selectedInvoice && returnItems.length > 0 && (
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
            <h3 className="text-xl font-semibold mb-4">Items to Return</h3>
            <p className="text-sm text-dark-6 mb-4">Select items and quantities to include in the credit note</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke dark:border-strokedark">
                    <th className="px-2 py-3 text-left">
                      <input 
                        type="checkbox" 
                        checked={returnItems.every(item => item.selected)}
                        onChange={(e) => {
                          setReturnItems(prev => prev.map(item => ({ ...item, selected: e.target.checked })));
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">GST %</th>
                    <th className="px-4 py-3 text-center">Return Qty</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.map((item, index) => (
                    <tr key={item.invoice_item_id} className="border-b border-stroke dark:border-strokedark">
                      <td className="px-2 py-3">
                        <input 
                          type="checkbox" 
                          checked={item.selected}
                          onChange={() => handleItemToggle(index)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">₹{item.unit_price.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{item.gst_rate}%</td>
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="number"
                          min={0}
                          max={item.max_quantity}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                          disabled={!item.selected}
                          className="w-20 rounded border border-stroke px-2 py-1 text-center dark:border-strokedark dark:bg-form-input disabled:opacity-50"
                        />
                        <span className="text-xs text-dark-6 ml-1">/ {item.max_quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.selected ? `₹${(item.quantity * item.unit_price * (1 + item.gst_rate / 100)).toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-dark-6">Taxable Amount:</span>
                  <span className="font-medium">₹{totals.taxable.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-6">GST:</span>
                  <span className="font-medium">₹{totals.gst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-stroke pt-2 dark:border-strokedark">
                  <span className="font-semibold">Total Credit:</span>
                  <span className="font-bold text-primary">₹{totals.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link
            href="/invoices/credit-notes"
            className="px-6 py-2 border border-stroke rounded hover:bg-gray-2 dark:hover:bg-meta-4"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || returnItems.filter(i => i.selected && i.quantity > 0).length === 0}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Credit Note"}
          </button>
        </div>
      </form>
    </>
  );
}
