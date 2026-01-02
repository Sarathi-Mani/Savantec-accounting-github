"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { inventoryApi, StockItem, getErrorMessage } from "@/services/api";

export default function StockItemsPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);

  // New item modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",  // Changed from code
    unit: "unit",  // Changed from primary_unit
    hsn_code: "",
    gst_rate: "18",  // Changed to string
    opening_stock: 0,
    standard_cost: 0,
    unit_price: 0,  // Changed from standard_selling_price
    min_stock_level: 0,
  });

  useEffect(() => {
    if (company?.id) {
      fetchItems();
    }
  }, [company?.id, search, showLowStock]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.listItems(company!.id, {
        search: search || undefined,
        low_stock: showLowStock || undefined,
      });
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load items"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await inventoryApi.createItem(company!.id, formData);
      setShowModal(false);
      setFormData({
        name: "",
        sku: "",
        unit: "unit",
        hsn_code: "",
        gst_rate: "18",
        opening_stock: 0,
        standard_cost: 0,
        unit_price: 0,
        min_stock_level: 0,
      });
      fetchItems();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create item"));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Products with Inventory</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {items.length} items • Products and stock are unified
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory"
            className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Back
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-opacity-90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">Products and Stock Items are now unified</p>
            <p className="mt-1 text-blue-600 dark:text-blue-300">
              This view shows non-service products with inventory tracking. Create products from the Products page - they will appear here if not marked as services.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLowStock}
            onChange={(e) => setShowLowStock(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-dark dark:text-white">Low stock only</span>
        </label>
      </div>

      {/* Items Table */}
      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Item</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Code</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Stock</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Cost</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Price</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-dark-3">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item) => {
                  const isLowStock = item.current_stock <= item.min_stock_level;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-dark-2">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-dark dark:text-white">{item.name}</p>
                          {item.hsn_code && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">HSN: {item.hsn_code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-dark dark:text-white">{item.sku || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isLowStock ? "text-red-600" : "text-dark dark:text-white"}`}>
                          {item.current_stock} {item.unit}
                        </span>
                        {isLowStock && (
                          <p className="text-xs text-red-500">Below min: {item.min_stock_level}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-dark dark:text-white">
                        {formatCurrency(item.standard_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-dark dark:text-white">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-dark dark:text-white">
                        {formatCurrency(item.current_stock * item.standard_cost)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark dark:text-white">Add Stock Item</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">SKU/Code</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  >
                    <option value="unit">Unit</option>
                    <option value="Nos">Nos (Numbers)</option>
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Kg">Kg (Kilogram)</option>
                    <option value="Gm">Gm (Grams)</option>
                    <option value="Ltr">Ltr (Liters)</option>
                    <option value="Mtr">Mtr (Meters)</option>
                    <option value="Box">Box</option>
                    <option value="Pack">Pack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">HSN Code</label>
                  <input
                    type="text"
                    value={formData.hsn_code}
                    onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">GST Rate %</label>
                  <select
                    value={formData.gst_rate}
                    onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">Cost Price (₹)</label>
                  <input
                    type="number"
                    value={formData.standard_cost}
                    onChange={(e) => setFormData({ ...formData, standard_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">Opening Stock</label>
                  <input
                    type="number"
                    value={formData.opening_stock}
                    onChange={(e) => setFormData({ ...formData, opening_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">Min Stock Level</label>
                  <input
                    type="number"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
