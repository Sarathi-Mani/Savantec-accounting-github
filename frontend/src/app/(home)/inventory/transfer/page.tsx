"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { inventoryApi, StockItem, Godown, getErrorMessage } from "@/services/api";

export default function StockTransferPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);

  const [formData, setFormData] = useState({
    product_id: "",
    from_godown_id: "",
    to_godown_id: "",
    quantity: "",
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
      setItems(itemsData);
      setGodowns(godownsData);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.product_id || !formData.from_godown_id || !formData.to_godown_id || !formData.quantity) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.from_godown_id === formData.to_godown_id) {
      setError("Source and destination godowns cannot be the same");
      return;
    }

    try {
      setSaving(true);
      setError("");
      
      await inventoryApi.transferStock(company!.id, {
        product_id: formData.product_id,
        quantity: parseFloat(formData.quantity),
        from_godown_id: formData.from_godown_id,
        to_godown_id: formData.to_godown_id,
        notes: formData.notes || undefined,
      });

      const selectedItem = items.find(i => i.id === formData.product_id);
      const fromGodown = godowns.find(g => g.id === formData.from_godown_id);
      const toGodown = godowns.find(g => g.id === formData.to_godown_id);
      
      setSuccess(
        `Transferred ${formData.quantity} ${selectedItem?.unit || "units"} of ${selectedItem?.name} from ${fromGodown?.name} to ${toGodown?.name}`
      );
      
      // Reset form
      setFormData({
        product_id: "",
        from_godown_id: "",
        to_godown_id: "",
        quantity: "",
        notes: "",
      });

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to transfer stock"));
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
          <h1 className="text-2xl font-bold text-dark dark:text-white">Stock Transfer</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Transfer stock between godowns/warehouses
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
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              required
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Current: {item.current_stock} {item.unit})
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Current Stock:</strong> {selectedItem.current_stock} {selectedItem.unit}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                From Godown *
              </label>
              <select
                value={formData.from_godown_id}
                onChange={(e) => setFormData({ ...formData, from_godown_id: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                required
              >
                <option value="">Select source godown</option>
                {godowns.map((godown) => (
                  <option key={godown.id} value={godown.id}>
                    {godown.name} {godown.is_default && "(Default)"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                To Godown *
              </label>
              <select
                value={formData.to_godown_id}
                onChange={(e) => setFormData({ ...formData, to_godown_id: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                required
              >
                <option value="">Select destination godown</option>
                {godowns.map((godown) => (
                  <option key={godown.id} value={godown.id}>
                    {godown.name} {godown.is_default && "(Default)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
              step="0.001"
              required
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
              placeholder="Optional notes about the transfer"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {saving ? "Transferring..." : "Transfer Stock"}
          </button>
        </form>
      </div>
    </div>
  );
}
