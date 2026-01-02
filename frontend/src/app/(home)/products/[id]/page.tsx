"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  productsApi,
  alternativeProductsApi,
  Product,
  AlternativeForProduct,
} from "@/services/api";
import { useAuth } from "@/context/AuthContext";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { company } = useAuth();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeForProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const companyId = company?.id || (typeof window !== "undefined" ? localStorage.getItem("company_id") : null);

  useEffect(() => {
    if (companyId && productId) {
      fetchProductData();
    }
  }, [companyId, productId]);

  const fetchProductData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [productData, alternativesData] = await Promise.all([
        productsApi.get(companyId, productId),
        alternativeProductsApi.getAlternativesForProduct(companyId, productId),
      ]);
      setProduct(productData);
      setAlternatives(alternativesData);
    } catch (err: any) {
      setError(err.message || "Failed to fetch product details");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!companyId) return;
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await productsApi.delete(companyId, productId);
      router.push("/products");
    } catch (err: any) {
      alert(err.message || "Failed to delete product");
    }
  };

  if (!companyId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Please select a company first.
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
              href="/products"
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
                {product.is_service && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    Service
                  </span>
                )}
                {!product.is_active && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    Inactive
                  </span>
                )}
              </div>
              {product.sku && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  SKU: {product.sku}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/products/${productId}/edit`}
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
        {/* Product Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Details
            </h2>
            <dl className="space-y-4">
              {product.hsn_code && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">HSN/SAC Code</dt>
                  <dd className="mt-1 text-gray-900 dark:text-white font-medium">{product.hsn_code}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Unit Price</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  ₹{Number(product.unit_price).toLocaleString()} / {product.unit}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">GST Rate</dt>
                <dd className="mt-1 text-gray-900 dark:text-white">{product.gst_rate}%</dd>
              </div>
              {product.is_inclusive && (
                <div>
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    Price includes GST
                  </span>
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
            </dl>
          </div>

          {/* Stock Info */}
          {!product.is_service && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Stock
              </h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Current Stock</dt>
                  <dd className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {product.current_stock ?? 0} {product.unit}
                  </dd>
                </div>
                {product.min_stock_level !== undefined && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Minimum Stock Level</dt>
                    <dd className="mt-1 text-gray-900 dark:text-white">
                      {product.min_stock_level} {product.unit}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Alternative Products */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Alternative Products ({alternatives.length})
              </h2>
              <Link
                href="/inventory/alternative-products"
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Manage Alternatives
              </Link>
            </div>

            {alternatives.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No alternative products mapped yet.
                </p>
                <Link
                  href="/inventory/alternative-products"
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                >
                  Browse Alternatives
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {alternatives.map((alt) => (
                  <div key={alt.mapping_id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/inventory/alternative-products/${alt.alternative_id}`}
                          className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          {alt.alternative_name}
                        </Link>
                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          {alt.manufacturer && <span>{alt.manufacturer}</span>}
                          {alt.model_number && <span>Model: {alt.model_number}</span>}
                        </div>
                        {alt.reference_price && (
                          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                            Ref. Price: ₹{Number(alt.reference_price).toLocaleString()}
                          </p>
                        )}
                        {alt.notes && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {alt.notes}
                          </p>
                        )}
                        {alt.comparison_notes && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500 italic">
                            {alt.comparison_notes}
                          </p>
                        )}
                      </div>
                      {alt.priority > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          Priority: {alt.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

