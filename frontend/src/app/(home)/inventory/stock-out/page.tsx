"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { inventoryApi, StockItem, Godown, getErrorMessage } from "@/services/api";

export default function StockOutPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);

  const [formData, setFormData] = useState({
    product_id: "",
    godown_id: "",
    quantity: "",
    rate: "",
    reference_number: "",
    notes: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, godownsData] = await Promise.all([
        inventoryApi.listItems(company!.id),
        inventoryApi.listGodowns(company!.id),
      ]);
      setItems(itemsData.filter(i => i.current_stock > 0));
      setGodowns(godownsData);
      
      // Set default godown if there's one
      const defaultGodown = godownsData.find(g => g.is_default);
      if (defaultGodown) {
        setFormData(prev => ({ ...prev, godown_id: defaultGodown.id }));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedItem = items.find(i => i.id === formData.product_id);
    if (!selectedItem) {
      setError("Please select an item");
      return;
    }

    if (parseFloat(formData.quantity) > selectedItem.current_stock) {
      setError(`Insufficient stock. Available: ${selectedItem.current_stock} ${selectedItem.unit}`);
      return;
    }

    try {
      setSaving(true);
      setError("");
      
      await inventoryApi.stockOut(company!.id, {
        product_id: formData.product_id,
        quantity: parseFloat(formData.quantity),
        rate: formData.rate ? parseFloat(formData.rate) : undefined,
        godown_id: formData.godown_id || undefined,
        reference_number: formData.reference_number || undefined,
        notes: formData.notes || undefined,
      });

      const selectedGodown = godowns.find(g => g.id === formData.godown_id);
      setSuccess(`Issued ${formData.quantity} ${selectedItem.unit} of ${selectedItem.name}${selectedGodown ? ` from ${selectedGodown.name}` : ""}`);
      
      // Refresh items and reset form but keep godown
      fetchData();
      setFormData({
        product_id: "",
        godown_id: formData.godown_id,
        quantity: "",
        rate: "",
        reference_number: "",
        notes: "",
      });

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to record stock out"));
    } finally {
      setSaving(false);
    }
  };

  const selectedItem = items.find(i => i.id === formData.product_id);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Stock Out</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Record goods issued/sold
          </p>
        </div>
        <Link
          href="/inventory"
          className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          Back
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Item *
            </label>
            <select
              value={formData.product_id}
              onChange={(e) => {
                const item = items.find(i => i.id === e.target.value);
                setFormData({
                  ...formData,
                  product_id: e.target.value,
                  rate: item?.unit_price?.toString() || "",
                });
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              required
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Available: {item.current_stock} {item.unit})
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="flex justify-between text-sm text-blue-700 dark:text-blue-400">
                <span><strong>Available:</strong> {selectedItem.current_stock} {selectedItem.unit}</span>
                <span><strong>Selling Price:</strong> ₹{selectedItem.unit_price}/{selectedItem.unit}</span>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Godown / Warehouse
            </label>
            <select
              value={formData.godown_id}
              onChange={(e) => setFormData({ ...formData, godown_id: e.target.value })}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
            >
              <option value="">Main Location (Default)</option>
              {godowns.map((godown) => (
                <option key={godown.id} value={godown.id}>
                  {godown.name} {godown.is_default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Quantity *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                placeholder="0"
                min="0.001"
                max={selectedItem?.current_stock}
                step="0.001"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Rate (₹)
              </label>
              <input
                type="number"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {formData.quantity && formData.rate && (
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <p className="text-lg font-bold text-red-700 dark:text-red-400">
                Total Value: ₹{(parseFloat(formData.quantity) * parseFloat(formData.rate)).toLocaleString("en-IN")}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Reference / Invoice No.
            </label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              placeholder="e.g., INV-001 or SO-001"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              rows={2}
              placeholder="Optional notes"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-red-600 py-3 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Recording..." : "Record Stock Out"}
          </button>
        </form>
      </div>
    </div>
  );
}
