"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { productsApi, inventoryApi } from "@/services/api";
import api from "@/services/api";
import type { Product, Godown } from "@/services/api";

interface VerificationItem {
  product_id: string;
  product_name: string;
  book_quantity: number;
  physical_quantity: number;
  variance_quantity: number;
  rate: number;
  variance_value: number;
  reason?: string;
}

export default function NewStockVerificationPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [stockData, setStockData] = useState<Record<string, { quantity: number; rate: number }>>({});

  const [formData, setFormData] = useState({
    godown_id: "",
    adjustment_date: new Date().toISOString().split("T")[0],
    reason: "",
    notes: "",
  });

  const [items, setItems] = useState<VerificationItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) return;
      try {
        setLoading(true);
        const [productsData, godownsData] = await Promise.all([
          productsApi.list(company.id, { page_size: 100 }),
          inventoryApi.listGodowns(company.id),
        ]);
        setProducts(productsData.products || []);
        setGodowns(godownsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [company?.id]);

  const fetchStockForProduct = async (productId: string) => {
    if (!company?.id || !productId) return;

    try {
      const params = new URLSearchParams();
      if (formData.godown_id) params.append("godown_id", formData.godown_id);
      
      const response = await api.get(
        `/companies/${company.id}/inventory/items/${productId}/stock?${params.toString()}`
      );
      
      const stock = response.data?.quantity || 0;
      const rate = response.data?.rate || 0;
      
      setStockData((prev) => ({
        ...prev,
        [productId]: { quantity: stock, rate },
      }));

      // Update item if it exists
      const itemIndex = items.findIndex((item) => item.product_id === productId);
      if (itemIndex >= 0) {
        const newItems = [...items];
        newItems[itemIndex].book_quantity = stock;
        newItems[itemIndex].rate = rate;
        newItems[itemIndex].variance_quantity = newItems[itemIndex].physical_quantity - stock;
        newItems[itemIndex].variance_value = newItems[itemIndex].variance_quantity * rate;
        setItems(newItems);
      }
    } catch (error) {
      console.error("Error fetching stock:", error);
    }
  };

  const addItem = () => {
    setItems([...items, {
      product_id: "",
      product_name: "",
      book_quantity: 0,
      physical_quantity: 0,
      variance_quantity: 0,
      rate: 0,
      variance_value: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const selectProduct = async (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItems = [...items];
    newItems[index].product_id = productId;
    newItems[index].product_name = product.name;
    newItems[index].rate = product.standard_cost || product.unit_price || 0;
    setItems(newItems);

    // Fetch current stock
    await fetchStockForProduct(productId);
  };

  const updatePhysicalQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].physical_quantity = quantity;
    newItems[index].variance_quantity = quantity - newItems[index].book_quantity;
    newItems[index].variance_value = newItems[index].variance_quantity * newItems[index].rate;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (items.length === 0) {
      alert("Please add at least one item for verification");
      return;
    }

    if (items.some((item) => !item.product_id)) {
      alert("Please select products for all items");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        godown_id: formData.godown_id || undefined,
        adjustment_date: formData.adjustment_date ? new Date(formData.adjustment_date).toISOString() : undefined,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
        items: items.map((item) => ({
          product_id: item.product_id,
          physical_quantity: item.physical_quantity,
          reason: item.reason || undefined,
        })),
      };

      await api.post(`/companies/${company.id}/stock-adjustments`, payload);
      router.push("/inventory/verification");
    } catch (error: any) {
      console.error("Error creating stock verification:", error);
      alert(error.response?.data?.detail || "Failed to create stock verification");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAllStock = async () => {
    if (!formData.godown_id) {
      alert("Please select a godown first");
      return;
    }

    for (const item of items) {
      if (item.product_id) {
        await fetchStockForProduct(item.product_id);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-body">Loading...</div>
      </div>
    );
  }

  const totalVariance = items.reduce((sum, item) => sum + item.variance_value, 0);

  return (
    <>
      <Breadcrumb pageName="New Stock Verification" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <h3 className="text-xl font-semibold mb-4">Verification Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Godown</label>
              <select
                value={formData.godown_id}
                onChange={(e) => setFormData({ ...formData, godown_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">All Godowns</option>
                {godowns.map((godown) => (
                  <option key={godown.id} value={godown.id}>
                    {godown.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Verification Date *</label>
              <input
                type="date"
                required
                value={formData.adjustment_date}
                onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Reason</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder="e.g., Physical stock count, Year-end verification"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Items to Verify</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={verifyAllStock}
                className="px-4 py-2 bg-secondary text-white rounded hover:bg-opacity-90"
                disabled={!formData.godown_id || items.length === 0}
              >
                Verify All Stock
              </button>
              <button
                type="button"
                onClick={addItem}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90"
              >
                + Add Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-2 dark:bg-meta-4">
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">Book Qty</th>
                  <th className="px-4 py-2 text-right">Physical Qty</th>
                  <th className="px-4 py-2 text-right">Variance</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Variance Value</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={item.product_id}
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
                    <td className="px-4 py-2 text-right">
                      <span className={item.book_quantity < 0 ? "text-danger" : ""}>
                        {item.book_quantity.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.001"
                        value={item.physical_quantity}
                        onChange={(e) => updatePhysicalQuantity(index, parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input text-right"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={item.variance_quantity < 0 ? "text-danger" : item.variance_quantity > 0 ? "text-success" : ""}>
                        {item.variance_quantity.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      ₹{item.rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={item.variance_value < 0 ? "text-danger" : item.variance_value > 0 ? "text-success" : ""}>
                        ₹{item.variance_value.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {items.length > 0 && (
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
              <tfoot>
                <tr className="bg-gray-2 dark:bg-meta-4 font-bold">
                  <td colSpan={5} className="px-4 py-2 text-right">Total Variance Value:</td>
                  <td className="px-4 py-2 text-right">
                    <span className={totalVariance < 0 ? "text-danger" : totalVariance > 0 ? "text-success" : ""}>
                      ₹{totalVariance.toFixed(2)}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link
            href="/inventory/verification"
            className="px-6 py-2 border border-stroke rounded hover:bg-gray-2 dark:hover:bg-meta-4"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Verification"}
          </button>
        </div>
      </form>
    </>
  );
}

