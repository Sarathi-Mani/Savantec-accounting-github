"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import { inventoryApi, StockItem, Godown, StockEntry, getErrorMessage } from "@/services/api";

// Dynamically import ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface WarehouseStock {
  godown_id: string | null;
  godown_name: string;
  quantity: number;
  value: number;
}

interface ProductWarehouseData {
  product_id: string;
  product_name: string;
  total_stock: number;
  warehouses: WarehouseStock[];
}

export default function WarehouseReportPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedGodown, setSelectedGodown] = useState<string>("");
  const [viewMode, setViewMode] = useState<"product" | "warehouse">("product");

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, godownsData, entriesData] = await Promise.all([
        inventoryApi.listItems(company!.id),
        inventoryApi.listGodowns(company!.id),
        inventoryApi.listEntries(company!.id, {}),
      ]);
      setItems(itemsData);
      setGodowns(godownsData);
      setEntries(entriesData);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  // Calculate stock by warehouse for a specific product
  const getProductWarehouseDistribution = (productId: string): WarehouseStock[] => {
    const productEntries = entries.filter(e => e.product_id === productId);
    const warehouseMap = new Map<string, { quantity: number; value: number }>();
    
    // Initialize with "Main Location"
    warehouseMap.set("main", { quantity: 0, value: 0 });
    
    // Initialize godowns
    godowns.forEach(g => {
      warehouseMap.set(g.id, { quantity: 0, value: 0 });
    });

    // Sum up quantities
    productEntries.forEach(entry => {
      const key = entry.godown_id || "main";
      const current = warehouseMap.get(key) || { quantity: 0, value: 0 };
      warehouseMap.set(key, {
        quantity: current.quantity + Number(entry.quantity),
        value: current.value + Number(entry.value),
      });
    });

    const result: WarehouseStock[] = [];
    
    // Add main location
    const mainStock = warehouseMap.get("main");
    if (mainStock && mainStock.quantity !== 0) {
      result.push({
        godown_id: null,
        godown_name: "Main Location",
        quantity: mainStock.quantity,
        value: mainStock.value,
      });
    }

    // Add godowns
    godowns.forEach(g => {
      const stock = warehouseMap.get(g.id);
      if (stock && stock.quantity !== 0) {
        result.push({
          godown_id: g.id,
          godown_name: g.name,
          quantity: stock.quantity,
          value: stock.value,
        });
      }
    });

    return result;
  };

  // Calculate products in a specific warehouse
  const getWarehouseProducts = (godownId: string | null) => {
    const warehouseEntries = entries.filter(e => 
      godownId === null ? !e.godown_id : e.godown_id === godownId
    );
    
    const productMap = new Map<string, { quantity: number; value: number }>();
    
    warehouseEntries.forEach(entry => {
      const current = productMap.get(entry.product_id) || { quantity: 0, value: 0 };
      productMap.set(entry.product_id, {
        quantity: current.quantity + Number(entry.quantity),
        value: current.value + Number(entry.value),
      });
    });

    return Array.from(productMap.entries())
      .map(([productId, data]) => {
        const product = items.find(i => i.id === productId);
        return {
          product_id: productId,
          product_name: product?.name || "Unknown",
          unit: product?.unit || "unit",
          quantity: data.quantity,
          value: data.value,
        };
      })
      .filter(p => p.quantity !== 0);
  };

  // Product distribution chart data
  const getProductChartData = () => {
    if (!selectedProduct) return null;
    
    const distribution = getProductWarehouseDistribution(selectedProduct);
    if (distribution.length === 0) return null;

    return {
      series: distribution.map(d => Math.abs(d.quantity)),
      options: {
        chart: { type: "pie" as const },
        labels: distribution.map(d => d.godown_name),
        colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
        legend: { position: "bottom" as const },
        responsive: [{
          breakpoint: 480,
          options: {
            chart: { width: 300 },
            legend: { position: "bottom" as const }
          }
        }]
      }
    };
  };

  // Warehouse inventory chart data
  const getWarehouseChartData = () => {
    const godownId = selectedGodown === "main" ? null : selectedGodown;
    const products = getWarehouseProducts(godownId);
    if (products.length === 0) return null;

    return {
      series: products.map(p => Math.abs(p.quantity)),
      options: {
        chart: { type: "pie" as const },
        labels: products.map(p => p.product_name),
        colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"],
        legend: { position: "bottom" as const },
        responsive: [{
          breakpoint: 480,
          options: {
            chart: { width: 300 },
            legend: { position: "bottom" as const }
          }
        }]
      }
    };
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

  const productChartData = getProductChartData();
  const warehouseChartData = getWarehouseChartData();
  const selectedProductData = selectedProduct ? getProductWarehouseDistribution(selectedProduct) : [];
  const selectedWarehouseProducts = selectedGodown ? getWarehouseProducts(selectedGodown === "main" ? null : selectedGodown) : [];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Warehouse Inventory Report</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            View stock distribution across warehouses
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

      {/* View Mode Toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setViewMode("product")}
          className={`rounded-lg px-4 py-2 font-medium transition ${
            viewMode === "product"
              ? "bg-primary text-white"
              : "bg-gray-100 text-dark hover:bg-gray-200 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-3"
          }`}
        >
          By Product
        </button>
        <button
          onClick={() => setViewMode("warehouse")}
          className={`rounded-lg px-4 py-2 font-medium transition ${
            viewMode === "warehouse"
              ? "bg-primary text-white"
              : "bg-gray-100 text-dark hover:bg-gray-200 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-3"
          }`}
        >
          By Warehouse
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Selection Panel */}
        <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          {viewMode === "product" ? (
            <>
              <h2 className="mb-4 text-lg font-bold text-dark dark:text-white">
                Select Product
              </h2>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              >
                <option value="">Choose a product...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Total: {item.current_stock} {item.unit})
                  </option>
                ))}
              </select>

              {selectedProduct && selectedProductData.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 font-medium text-dark dark:text-white">
                    Warehouse Distribution
                  </h3>
                  <div className="space-y-2">
                    {selectedProductData.map((w, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-dark-2"
                      >
                        <div>
                          <p className="font-medium text-dark dark:text-white">{w.godown_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Value: {formatCurrency(Math.abs(w.value))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${w.quantity >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {w.quantity.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">{items.find(i => i.id === selectedProduct)?.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct && selectedProductData.length === 0 && (
                <div className="mt-6 rounded-lg bg-yellow-50 p-4 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                  No stock entries found for this product
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="mb-4 text-lg font-bold text-dark dark:text-white">
                Select Warehouse
              </h2>
              <select
                value={selectedGodown}
                onChange={(e) => setSelectedGodown(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
              >
                <option value="">Choose a warehouse...</option>
                <option value="main">Main Location (Default)</option>
                {godowns.map((godown) => (
                  <option key={godown.id} value={godown.id}>
                    {godown.name}
                  </option>
                ))}
              </select>

              {selectedGodown && selectedWarehouseProducts.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 font-medium text-dark dark:text-white">
                    Products in Warehouse
                  </h3>
                  <div className="space-y-2">
                    {selectedWarehouseProducts.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-dark-2"
                      >
                        <div>
                          <p className="font-medium text-dark dark:text-white">{p.product_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Value: {formatCurrency(Math.abs(p.value))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${p.quantity >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {p.quantity.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">{p.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedGodown && selectedWarehouseProducts.length === 0 && (
                <div className="mt-6 rounded-lg bg-yellow-50 p-4 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                  No products found in this warehouse
                </div>
              )}
            </>
          )}
        </div>

        {/* Chart Panel */}
        <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-bold text-dark dark:text-white">
            {viewMode === "product" ? "Stock Distribution" : "Product Distribution"}
          </h2>

          {viewMode === "product" && productChartData ? (
            <div className="flex justify-center">
              <ReactApexChart
                options={productChartData.options}
                series={productChartData.series}
                type="pie"
                height={350}
              />
            </div>
          ) : viewMode === "warehouse" && warehouseChartData ? (
            <div className="flex justify-center">
              <ReactApexChart
                options={warehouseChartData.options}
                series={warehouseChartData.series}
                type="pie"
                height={350}
              />
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="mt-2">
                  {viewMode === "product" 
                    ? "Select a product to view warehouse distribution" 
                    : "Select a warehouse to view product distribution"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-stroke bg-white p-5 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
              <p className="text-xl font-bold text-dark dark:text-white">{items.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-stroke bg-white p-5 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Warehouses</p>
              <p className="text-xl font-bold text-dark dark:text-white">{godowns.length + 1}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-stroke bg-white p-5 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Stock Entries</p>
              <p className="text-xl font-bold text-dark dark:text-white">{entries.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-stroke bg-white p-5 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Stock Value</p>
              <p className="text-xl font-bold text-dark dark:text-white">
                {formatCurrency(items.reduce((sum, i) => sum + (i.current_stock * i.standard_cost), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
