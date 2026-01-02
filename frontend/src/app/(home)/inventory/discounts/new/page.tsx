"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { productsApi } from "@/services/api";
import api from "@/services/api";
import type { Product } from "@/services/api";

export default function NewDiscountRulePage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    discount_type: "percentage",
    discount_value: 0,
    min_quantity: "",
    max_quantity: "",
    valid_from: "",
    valid_to: "",
    product_id: "",
    category_id: "",
  });

  useEffect(() => {
    const fetchProducts = async () => {
      if (!company?.id) return;
      try {
        setLoading(true);
        const data = await productsApi.list(company.id, { page_size: 100 });
        setProducts(data.products || []);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [company?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.name || !formData.discount_value) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value.toString()),
      };

      if (formData.min_quantity) {
        payload.min_quantity = parseFloat(formData.min_quantity);
      }
      if (formData.max_quantity) {
        payload.max_quantity = parseFloat(formData.max_quantity);
      }
      if (formData.valid_from) {
        payload.valid_from = new Date(formData.valid_from).toISOString();
      }
      if (formData.valid_to) {
        payload.valid_to = new Date(formData.valid_to).toISOString();
      }
      if (formData.product_id) {
        payload.product_id = formData.product_id;
      }
      if (formData.category_id) {
        payload.category_id = formData.category_id;
      }

      await api.post(`/companies/${company.id}/discount-rules`, payload);
      router.push("/inventory/discounts");
    } catch (error: any) {
      console.error("Error creating discount rule:", error);
      alert(error.response?.data?.detail || "Failed to create discount rule");
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
      <Breadcrumb pageName="Create Discount Rule" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <h3 className="text-xl font-semibold mb-4">Discount Rule Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rule Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder="e.g., Bulk Order Discount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Discount Type *</label>
              <select
                required
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Discount Value *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder={formData.discount_type === "percentage" ? "e.g., 10" : "e.g., 100"}
              />
              <span className="text-xs text-body mt-1">
                {formData.discount_type === "percentage" ? "Percentage (e.g., 10 for 10%)" : "Fixed amount in ₹"}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Product</label>
              <select
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">All Products</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Minimum Quantity</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder="e.g., 10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Maximum Quantity</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.max_quantity}
                onChange={(e) => setFormData({ ...formData, max_quantity: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder="Leave empty for unlimited"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Valid From</label>
              <input
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Valid To</label>
              <input
                type="date"
                value={formData.valid_to}
                onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link
            href="/inventory/discounts"
            className="px-6 py-2 border border-stroke rounded hover:bg-gray-2 dark:hover:bg-meta-4"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Discount Rule"}
          </button>
        </div>
      </form>
    </>
  );
}

