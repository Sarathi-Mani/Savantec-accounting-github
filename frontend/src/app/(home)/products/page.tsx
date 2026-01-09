"use client";

import { useAuth } from "@/context/AuthContext";
import { productsApi, Product, ProductListResponse } from "@/services/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProductsPage() {
  const { company } = useAuth();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  useEffect(() => {
    const fetchProducts = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await productsApi.list(company.id, {
          page,
          page_size: 10,
          search: search || undefined,
          is_service: typeFilter === "" ? undefined : typeFilter === "service",
        });
        setData(result);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [company?.id, page, search, typeFilter]);

  const handleDelete = async (productId: string) => {
    if (!company?.id || !confirm("Are you sure you want to delete this product?")) return;
    try {
      await productsApi.delete(company.id, productId);
      setData((prev) =>
        prev
          ? {
            ...prev,
            products: prev.products.filter((p) => p.id !== productId),
            total: prev.total - 1,
          }
          : null
      );
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = data ? Math.ceil(data.total / 10) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Products & Services</h1>
          <p className="text-sm text-dark-6">Manage your products and services • Stock items auto-synced</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </Link>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">Products and Stock are unified</p>
            <p className="mt-1 text-blue-600 dark:text-blue-300">
              Products include inventory tracking. Services don't have stock. View inventory at Inventory → Stock Items.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark sm:flex-row">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
        >
          <option value="">All Types</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : !company ? (
          <div className="py-20 text-center text-dark-6">No company selected</div>
        ) : data?.products.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-dark-6">No products found</p>
            <Link href="/products/new" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
              Add your first product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Product</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Brand</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">HSN/SAC</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Type</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Price</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-dark-6">GST</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Stock</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.products.map((product) => (
                  <tr key={product.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-dark dark:text-white">{product.name}</p>
                        {product.description && (
                          <p className="text-sm text-dark-6 line-clamp-1">{product.description}</p>
                        )}
                        {product.sku && <p className="text-xs text-dark-6">SKU: {product.sku}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {product.brand ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-dark-6 dark:bg-dark-3">
                          {product.brand.name}
                        </span>
                      ) : (
                        <span className="text-xs text-dark-6">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {product.category ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-dark-6 dark:bg-dark-3">
                          {product.category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-dark-6">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-dark-6">{product.hsn_code || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${product.is_service
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}
                      >
                        {product.is_service ? "Service" : "Product"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-dark dark:text-white">
                        ₹{parseFloat(product.unit_price.toString()).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-dark-6">{product.gst_rate}%</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!product.is_service && product.current_stock !== null ? (
                        <span className={`font-medium ${parseFloat(product.current_stock.toString()) < 10 ? 'text-red-500' : 'text-green-500'}`}>
                          {parseFloat(product.current_stock.toString())}
                        </span>
                      ) : (
                        <span className="text-dark-6">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/products/${product.id}/edit`}
                          className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-dark-3"
                          title="Edit"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stroke px-6 py-4 dark:border-dark-3">
            <p className="text-sm text-dark-6">
              Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-dark-3"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-dark-3"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
