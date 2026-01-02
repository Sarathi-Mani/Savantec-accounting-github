"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { inventoryApi, StockItem, StockSummary, getErrorMessage } from "@/services/api";

export default function InventoryDashboard() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [recentItems, setRecentItems] = useState<StockItem[]>([]);

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryData, lowStock, items] = await Promise.all([
        inventoryApi.getSummary(company!.id),
        inventoryApi.listItems(company!.id, { low_stock: true }),
        inventoryApi.listItems(company!.id),
      ]);
      setSummary(summaryData);
      setLowStockItems(lowStock);
      setRecentItems(items.slice(0, 10));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load inventory data"));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Inventory</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage your stock items, godowns, and movements
          </p>
        </div>
        <Link
          href="/inventory/items/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-opacity-90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
                <p className="text-2xl font-bold text-dark dark:text-white">{summary.total_items}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stock Value</p>
                <p className="text-2xl font-bold text-dark dark:text-white">{formatCurrency(summary.total_value)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.low_stock_count}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{summary.out_of_stock_count}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link
          href="/inventory/stock-in"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-green-500 hover:bg-green-50 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-green-500 dark:hover:bg-green-900/10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-green-600 dark:text-white">Stock In</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Receive goods</p>
          </div>
        </Link>

        <Link
          href="/inventory/stock-out"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-red-500 hover:bg-red-50 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-red-500 dark:hover:bg-red-900/10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-red-600 dark:text-white">Stock Out</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Issue goods</p>
          </div>
        </Link>

        <Link
          href="/inventory/transfer"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-blue-500 hover:bg-blue-50 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-blue-500 dark:hover:bg-blue-900/10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-blue-600 dark:text-white">Transfer</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Between godowns</p>
          </div>
        </Link>

        <Link
          href="/inventory/godowns"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-purple-500 hover:bg-purple-50 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-purple-500 dark:hover:bg-purple-900/10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-purple-600 dark:text-white">Godowns</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Warehouses</p>
          </div>
        </Link>

        <Link
          href="/inventory/warehouse-report"
          className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke bg-white p-4 transition hover:border-cyan-500 hover:bg-cyan-50 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-cyan-500 dark:hover:bg-cyan-900/10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-dark group-hover:text-cyan-600 dark:text-white">Reports</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Stock by warehouse</p>
          </div>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alert */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
            <h3 className="font-semibold text-dark dark:text-white">Low Stock Alert</h3>
            <Link href="/inventory/items?low_stock=true" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="p-6">
            {lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/10">
                    <div>
                      <p className="font-medium text-dark dark:text-white">{item.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Min: {item.min_stock_level} {item.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-yellow-600">
                        {item.current_stock} {item.unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400">No low stock items</p>
            )}
          </div>
        </div>

        {/* Recent Items */}
        <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
            <h3 className="font-semibold text-dark dark:text-white">Stock Items</h3>
            <Link href="/inventory/items" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="p-6">
            {recentItems.length > 0 ? (
              <div className="space-y-3">
                {recentItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-dark dark:text-white">{item.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.sku || item.hsn_code || "No code"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-dark dark:text-white">
                        {item.current_stock} {item.unit}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(item.standard_cost)}/unit
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">No items yet</p>
                <Link href="/inventory/items/new" className="mt-2 inline-block text-primary hover:underline">
                  Add your first item
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
