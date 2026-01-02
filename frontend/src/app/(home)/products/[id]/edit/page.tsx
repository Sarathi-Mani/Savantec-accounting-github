"use client";

import { useAuth } from "@/context/AuthContext";
import { productsApi, Product, getErrorMessage } from "@/services/api";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditProductPage() {
  const { company } = useAuth();
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    hsn_code: "",
    unit_price: "",
    unit: "unit",
    gst_rate: "18",
    is_inclusive: false,
    is_service: false,
  });

  useEffect(() => {
    const fetchProduct = async () => {
      if (!company?.id || !productId) return;
      try {
        const product = await productsApi.get(company.id, productId);
        setFormData({
          name: product.name || "",
          description: product.description || "",
          sku: product.sku || "",
          hsn_code: product.hsn_code || "",
          unit_price: product.unit_price?.toString() || "",
          unit: product.unit || "unit",
          gst_rate: product.gst_rate || "18",
          is_inclusive: product.is_inclusive || false,
          is_service: product.is_service || false,
        });
      } catch (error) {
        console.error("Failed to fetch product:", error);
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [company?.id, productId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !productId) return;

    if (!formData.name.trim()) {
      setError("Product name is required");
      return;
    }

    if (!formData.unit_price || parseFloat(formData.unit_price) <= 0) {
      setError("Valid unit price is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await productsApi.update(company.id, productId, {
        ...formData,
        unit_price: parseFloat(formData.unit_price),
        hsn_code: formData.hsn_code || undefined,
        sku: formData.sku || undefined,
        description: formData.description || undefined,
      });
      router.push("/products");
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to update product"));
    } finally {
      setSaving(false);
    }
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Edit Product</h1>
        <p className="text-sm text-dark-6">Update product details</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter product name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Product description"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    SKU / Item Code
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="SKU-001"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    HSN/SAC Code
                  </label>
                  <input
                    type="text"
                    name="hsn_code"
                    value={formData.hsn_code}
                    onChange={handleChange}
                    placeholder="4-8 digit code"
                    maxLength={8}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_service"
                    checked={formData.is_service}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-dark dark:text-white">This is a service (not a physical product)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Pricing & Tax</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Unit Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={formData.unit_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Unit
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="unit">Unit</option>
                  <option value="pcs">Pieces</option>
                  <option value="kg">KG</option>
                  <option value="gm">Gram</option>
                  <option value="ltr">Litre</option>
                  <option value="ml">ML</option>
                  <option value="mtr">Metre</option>
                  <option value="sqft">Sq.Ft</option>
                  <option value="sqm">Sq.M</option>
                  <option value="box">Box</option>
                  <option value="pack">Pack</option>
                  <option value="hr">Hour</option>
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  GST Rate
                </label>
                <select
                  name="gst_rate"
                  value={formData.gst_rate}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_inclusive"
                    checked={formData.is_inclusive}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-dark dark:text-white">Price is inclusive of GST</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          {formData.unit_price && parseFloat(formData.unit_price) > 0 && (
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
              <p className="mb-2 text-sm font-medium text-dark-6">Price Preview</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-dark-6">Base Price: </span>
                  <span className="font-medium text-dark dark:text-white">
                    ₹{formData.is_inclusive
                      ? (parseFloat(formData.unit_price) / (1 + parseInt(formData.gst_rate) / 100)).toFixed(2)
                      : parseFloat(formData.unit_price).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-dark-6">GST ({formData.gst_rate}%): </span>
                  <span className="font-medium text-dark dark:text-white">
                    ₹{formData.is_inclusive
                      ? (parseFloat(formData.unit_price) - parseFloat(formData.unit_price) / (1 + parseInt(formData.gst_rate) / 100)).toFixed(2)
                      : (parseFloat(formData.unit_price) * parseInt(formData.gst_rate) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-dark-6">Final Price: </span>
                  <span className="font-semibold text-primary">
                    ₹{formData.is_inclusive
                      ? parseFloat(formData.unit_price).toFixed(2)
                      : (parseFloat(formData.unit_price) * (1 + parseInt(formData.gst_rate) / 100)).toFixed(2)}
                    /{formData.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Update Product"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
