"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { ordersApi, vendorsApi, productsApi, inventoryApi } from "@/services/api";
import type { Customer as Vendor, Product, Godown } from "@/services/api";

interface ReceiptNoteItem {
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  rejected_quantity: number;
  rejection_reason?: string;
}

export default function NewReceiptNotePage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);

  const [formData, setFormData] = useState({
    vendor_id: "",
    purchase_order_id: "",
    receipt_date: new Date().toISOString().split("T")[0],
    godown_id: "",
    vendor_invoice_number: "",
    vendor_invoice_date: "",
    notes: "",
  });

  const [items, setItems] = useState<ReceiptNoteItem[]>([
    { description: "", quantity: 1, unit: "Nos", rate: 0, rejected_quantity: 0 },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) return;
      try {
        setLoading(true);
        const [vendorsData, productsData, godownsData] = await Promise.all([
          vendorsApi.list(company.id, { page_size: 100 }),
          productsApi.list(company.id, { page_size: 100 }),
          inventoryApi.listGodowns(company.id),
        ]);
        setVendors(vendorsData.customers || []);
        setProducts(productsData.products || []);
        setGodowns(godownsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setVendors([]);
        setProducts([]);
        setGodowns([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [company?.id]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit: "Nos", rate: 0, rejected_quantity: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ReceiptNoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItem(index, "product_id", productId);
      updateItem(index, "description", product.name);
      updateItem(index, "unit", product.unit || "Nos");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.vendor_id) {
      alert("Please select a vendor");
      return;
    }

    if (items.some((item) => !item.description || item.quantity <= 0)) {
      alert("Please fill in all item details");
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.createReceiptNote(company.id, {
        vendor_id: formData.vendor_id,
        purchase_order_id: formData.purchase_order_id || undefined,
        items: items.map((item) => ({
          product_id: item.product_id || undefined,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          rejected_quantity: item.rejected_quantity || 0,
          rejection_reason: item.rejection_reason || undefined,
        })),
        godown_id: formData.godown_id || undefined,
        receipt_date: formData.receipt_date || undefined,
        vendor_invoice_number: formData.vendor_invoice_number || undefined,
        vendor_invoice_date: formData.vendor_invoice_date || undefined,
        notes: formData.notes || undefined,
      });

      router.push("/receipt-notes");
    } catch (error: any) {
      console.error("Error creating receipt note:", error);
      alert(error.response?.data?.detail || "Failed to create receipt note");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-body">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Create Receipt Note / GRN" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <h3 className="text-xl font-semibold mb-4">Receipt Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Vendor *</label>
              <select
                required
                value={formData.vendor_id}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">Select Vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Receipt Date *</label>
              <input
                type="date"
                required
                value={formData.receipt_date}
                onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Godown</label>
              <select
                value={formData.godown_id}
                onChange={(e) => setFormData({ ...formData, godown_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">Select Godown</option>
                {godowns.map((godown) => (
                  <option key={godown.id} value={godown.id}>
                    {godown.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Vendor Invoice Number</label>
              <input
                type="text"
                value={formData.vendor_invoice_number}
                onChange={(e) => setFormData({ ...formData, vendor_invoice_number: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Vendor Invoice Date</label>
              <input
                type="date"
                value={formData.vendor_invoice_date}
                onChange={(e) => setFormData({ ...formData, vendor_invoice_date: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            />
          </div>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90"
            >
              + Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-2 dark:bg-meta-4">
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Quantity</th>
                  <th className="px-4 py-2 text-left">Unit</th>
                  <th className="px-4 py-2 text-left">Rate</th>
                  <th className="px-4 py-2 text-left">Rejected Qty</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2">
                      <select
                        value={item.product_id || ""}
                        onChange={(e) => selectProduct(index, e.target.value)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      >
                        <option value="">Select Product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                        placeholder="Item description"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        required
                        value={item.unit}
                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rejected_quantity}
                        onChange={(e) => updateItem(index, "rejected_quantity", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-danger hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link
            href="/receipt-notes"
            className="px-6 py-2 border border-stroke rounded hover:bg-gray-2 dark:hover:bg-meta-4"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Receipt Note"}
          </button>
        </div>
      </form>
    </>
  );
}

