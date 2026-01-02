"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  alternativeProductsApi,
  productsApi,
  AlternativeProduct,
  MappedProduct,
  Product,
} from "@/services/api";

export default function AlternativeProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alternativeProductId = params.id as string;

  const [product, setProduct] = useState<AlternativeProduct | null>(null);
  const [mappedProducts, setMappedProducts] = useState<MappedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mapping modal state
  const [showMapModal, setShowMapModal] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [mappingNotes, setMappingNotes] = useState("");
  const [mappingPriority, setMappingPriority] = useState(0);
  const [comparisonNotes, setComparisonNotes] = useState("");
  const [mappingLoading, setMappingLoading] = useState(false);

  const companyId =
    typeof window !== "undefined" ? localStorage.getItem("company_id") : null;

  useEffect(() => {
    if (companyId && alternativeProductId) {
      fetchProductData();
    }
  }, [companyId, alternativeProductId]);

  const fetchProductData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [productData, mappedData] = await Promise.all([
        alternativeProductsApi.get(companyId, alternativeProductId),
        alternativeProductsApi.getMappedProducts(companyId, alternativeProductId),
      ]);
      setProduct(productData);
      setMappedProducts(mappedData);
    } catch (err: any) {
      setError(err.message || "Failed to fetch product details");
    } finally {
      setLoading(false);
    }
  };

  const openMapModal = async () => {
    if (!companyId) return;
    setShowMapModal(true);
    setSearchQuery("");
    setSelectedProductId(null);
    setMappingNotes("");
    setMappingPriority(0);
    setComparisonNotes("");

    try {
      const data = await productsApi.list(companyId, { page_size: 100 });
      // Filter out already mapped products
      const mappedIds = new Set(mappedProducts.map((m) => m.product_id));
      setAvailableProducts(data.products.filter((p) => !mappedIds.has(p.id)));
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const handleMapProduct = async () => {
    if (!companyId || !selectedProductId) return;
    setMappingLoading(true);
    try {
      await alternativeProductsApi.mapProduct(companyId, alternativeProductId, {
        product_id: selectedProductId,
        notes: mappingNotes || undefined,
        priority: mappingPriority,
        comparison_notes: comparisonNotes || undefined,
      });
      setShowMapModal(false);
      fetchProductData();
    } catch (err: any) {
      alert(err.message || "Failed to map product");
    } finally {
      setMappingLoading(false);
    }
  };

  const handleUnmapProduct = async (productId: string) => {
    if (!companyId) return;
    if (!confirm("Are you sure you want to remove this mapping?")) return;
    try {
      await alternativeProductsApi.unmapProduct(companyId, alternativeProductId, productId);
      fetchProductData();
    } catch (err: any) {
      alert(err.message || "Failed to remove mapping");
    }
  };

  const handleDelete = async () => {
    if (!companyId) return;
    if (!confirm("Are you sure you want to delete this alternative product?")) return;
    try {
      await alternativeProductsApi.delete(companyId, alternativeProductId);
      router.push("/inventory/alternative-products");
    } catch (err: any) {
      alert(err.message || "Failed to delete product");
    }
  };

  const filteredProducts = availableProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!companyId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Please select a company first.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        {error || "Product not found"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/inventory/alternative-products"
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {product.name}
                </h1>
                {!product.is_active && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    Inactive
                  </span>
                )}
              </div>
              {(product.manufacturer || product.model_number) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {product.manufacturer}{product.manufacturer && product.model_number && " · "}{product.model_number}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/inventory/alternative-products/${alternativeProductId}/edit`}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details Card */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Details
            </h2>
            <dl className="space-y-4">
              {product.category && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Category</dt>
                  <dd className="mt-1">
                    <span className="px-2 py-1 text-sm font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {product.category}
                    </span>
                  </dd>
                </div>
              )}
              {product.reference_price && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Reference Price</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    ₹{Number(product.reference_price).toLocaleString()}
                  </dd>
                </div>
              )}
              {product.reference_url && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Reference URL</dt>
                  <dd className="mt-1">
                    <a
                      href={product.reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm break-all"
                    >
                      {product.reference_url}
                    </a>
                  </dd>
                </div>
              )}
              {product.description && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Description</dt>
                  <dd className="mt-1 text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    {product.description}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="mt-1 text-gray-700 dark:text-gray-300 text-sm">
                  {new Date(product.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Mapped Products */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Mapped Products ({mappedProducts.length})
              </h2>
              <button
                onClick={openMapModal}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Map Product
              </button>
            </div>

            {mappedProducts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No products mapped to this alternative yet.
                </p>
                <button
                  onClick={openMapModal}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                >
                  Map Your First Product
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {mappedProducts.map((mp) => (
                  <div key={mp.mapping_id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {mp.product_name}
                          </h3>
                          {mp.priority > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              Priority: {mp.priority}
                            </span>
                          )}
                        </div>
                        {mp.product_sku && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            SKU: {mp.product_sku}
                          </p>
                        )}
                        {mp.product_unit_price && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            Price: ₹{Number(mp.product_unit_price).toLocaleString()}
                          </p>
                        )}
                        {mp.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {mp.notes}
                          </p>
                        )}
                        {mp.comparison_notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 italic">
                            {mp.comparison_notes}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnmapProduct(mp.product_id)}
                        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Remove mapping"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Product Modal */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Map Company Product
              </h3>
              <button
                onClick={() => setShowMapModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Product
                </label>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Product List */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No products found
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                        selectedProductId === p.id ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="product"
                        checked={selectedProductId === p.id}
                        onChange={() => setSelectedProductId(p.id)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {p.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {p.sku && `SKU: ${p.sku} · `}₹{Number(p.unit_price).toLocaleString()}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={mappingNotes}
                  onChange={(e) => setMappingNotes(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Any notes about this mapping"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority (lower = higher priority)
                </label>
                <input
                  type="number"
                  min="0"
                  value={mappingPriority}
                  onChange={(e) => setMappingPriority(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Comparison Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comparison Notes (optional)
                </label>
                <textarea
                  value={comparisonNotes}
                  onChange={(e) => setComparisonNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  placeholder="How does this compare?"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowMapModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleMapProduct}
                disabled={!selectedProductId || mappingLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {mappingLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Map Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

