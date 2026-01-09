"use client";

import { useAuth } from "@/context/AuthContext";
import { productsApi, brandsApi, categoriesApi, getErrorMessage } from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface Brand {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export default function NewProductPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [formData, setFormData] = useState({
    // Basic Information
    name: "",
    description: "",
    sku: "",
    hsn_code: "",
    brand_id: "",
    category_id: "",
    
    // Product Type
    is_service: false,
    
    // Pricing
    unit_price: "",
    unit: "unit",
    
    // Tax
    gst_rate: "18",
    is_inclusive: false,
    
    // Inventory Fields (for physical products only)
    opening_stock: "0",
    current_stock: "0",  // This will be auto-calculated from opening_stock + transactions
    min_stock_level: "0",
    standard_cost: "",
  });

  useEffect(() => {
    const fetchBrandsAndCategories = async () => {
      if (!company?.id) return;

      try {
        setLoadingBrands(true);
        const brandsResult = await brandsApi.list(company.id, { page: 1, page_size: 100 });
        setBrands(brandsResult.brands);

        setLoadingCategories(true);
        const categoriesResult = await categoriesApi.list(company.id, { page: 1, page_size: 100 });
        setCategories(categoriesResult.categories);
      } catch (error) {
        console.error("Failed to fetch brands/categories:", error);
      } finally {
        setLoadingBrands(false);
        setLoadingCategories(false);
      }
    };

    fetchBrandsAndCategories();
  }, [company?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
        // When switching to service, reset inventory fields
        ...(name === 'is_service' && checked ? {
          opening_stock: "0",
          current_stock: "0",
          min_stock_level: "0"
        } : {})
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    setError(null);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Allow only numbers and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.name.trim()) {
      setError("Product name is required");
      return;
    }

    if (!formData.unit_price || parseFloat(formData.unit_price) <= 0) {
      setError("Valid unit price is required");
      return;
    }

    // Validate HSN code if provided
    if (formData.hsn_code && (!/^\d{4,8}$/.test(formData.hsn_code))) {
      setError("HSN/SAC code must be 4-8 digits");
      return;
    }

    // Convert numeric fields
    const unitPrice = parseFloat(formData.unit_price);
    const openingStock = parseFloat(formData.opening_stock) || 0;
    const minStockLevel = parseFloat(formData.min_stock_level) || 0;
    const standardCost = formData.standard_cost ? parseFloat(formData.standard_cost) : undefined;

    setLoading(true);
    setError(null);

    try {
      await productsApi.create(company.id, {
        name: formData.name.trim(),
        description: formData.description || undefined,
        sku: formData.sku || undefined,
        hsn_code: formData.hsn_code || undefined,
        unit_price: unitPrice,
        unit: formData.unit,
        gst_rate: formData.gst_rate,
        is_inclusive: formData.is_inclusive,
        is_service: formData.is_service,
        brand_id: formData.brand_id || undefined,
        category_id: formData.category_id || undefined,
        // Inventory fields
        opening_stock: openingStock,
        min_stock_level: minStockLevel,
        standard_cost: standardCost,
      });
      router.push("/products");
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to create product"));
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold text-dark dark:text-white">Add Product</h1>
        <p className="text-sm text-dark-6">Add a new product or service</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
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
                  required
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
              <div className="grid gap-4 md:grid-cols-2">
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
                    HSN/SAC Code (4-8 digits)
                  </label>
                  <input
                    type="text"
                    name="hsn_code"
                    value={formData.hsn_code}
                    onChange={handleChange}
                    placeholder="Enter 4-8 digit HSN/SAC code"
                    pattern="\d{4,8}"
                    maxLength={8}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Brand
                  </label>
                  <select
                    name="brand_id"
                    value={formData.brand_id}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    disabled={loadingBrands}
                  >
                    <option value="">Select Brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <Link
                      href="/products/brands/new"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add New Brand
                    </Link>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Category
                  </label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    disabled={loadingCategories}
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <Link
                      href="/products/categories/new"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add New Category
                    </Link>
                  </div>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Unit Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={formData.unit_price}
                  onChange={handleNumberChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
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

          {/* Inventory Section (Only for physical products) */}
          {!formData.is_service && (
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Inventory Settings</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Opening Stock
                  </label>
                  <input
                    type="number"
                    name="opening_stock"
                    value={formData.opening_stock}
                    onChange={handleNumberChange}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                  <p className="mt-1 text-xs text-dark-6">Initial stock quantity when adding product</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Minimum Stock Level
                  </label>
                  <input
                    type="number"
                    name="min_stock_level"
                    value={formData.min_stock_level}
                    onChange={handleNumberChange}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                  <p className="mt-1 text-xs text-dark-6">Get notified when stock goes below this level</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Standard Cost (₹)
                  </label>
                  <input
                    type="number"
                    name="standard_cost"
                    value={formData.standard_cost}
                    onChange={handleNumberChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                  <p className="mt-1 text-xs text-dark-6">Standard/Base cost for inventory valuation</p>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {formData.unit_price && parseFloat(formData.unit_price) > 0 && (
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
              <p className="mb-2 text-sm font-medium text-dark-6">Price Preview</p>
              <div className="grid gap-2 text-sm md:grid-cols-2">
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
                <div className="md:col-span-2">
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
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Product"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}