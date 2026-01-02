"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { companiesApi, inventoryApi, Godown, getErrorMessage } from "@/services/api";

export default function InventorySettingsPage() {
  const { company, refreshCompanies } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  
  const [settings, setSettings] = useState({
    auto_reduce_stock: true,
    warehouse_priorities: [] as string[],
  });
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const godownsData = await inventoryApi.listGodowns(company!.id);
      setGodowns(godownsData);
      
      // Initialize settings from company
      const priorities = company?.warehouse_priorities?.priority_order || ["main"];
      setSettings({
        auto_reduce_stock: company?.auto_reduce_stock !== false,
        warehouse_priorities: priorities,
      });
      
      // Ensure all godowns are in the list
      const existingIds = new Set(priorities);
      const missingGodowns = godownsData
        .filter(g => !existingIds.has(g.id))
        .map(g => g.id);
      
      if (missingGodowns.length > 0) {
        setSettings(prev => ({
          ...prev,
          warehouse_priorities: [...prev.warehouse_priorities, ...missingGodowns]
        }));
      }
      
      // Add "main" if not present
      if (!priorities.includes("main")) {
        setSettings(prev => ({
          ...prev,
          warehouse_priorities: ["main", ...prev.warehouse_priorities]
        }));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load settings"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess(false);
      
      await companiesApi.update(company!.id, {
        auto_reduce_stock: settings.auto_reduce_stock,
        warehouse_priorities: {
          priority_order: settings.warehouse_priorities
        }
      });
      
      await refreshCompanies();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newPriorities = [...settings.warehouse_priorities];
    const draggedItem = newPriorities[draggedIndex];
    newPriorities.splice(draggedIndex, 1);
    newPriorities.splice(index, 0, draggedItem);
    
    setSettings({ ...settings, warehouse_priorities: newPriorities });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getWarehouseName = (warehouseId: string) => {
    if (warehouseId === "main") return "Main Location (Default)";
    const godown = godowns.find(g => g.id === warehouseId);
    return godown?.name || "Unknown Warehouse";
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPriorities = [...settings.warehouse_priorities];
    [newPriorities[index - 1], newPriorities[index]] = [newPriorities[index], newPriorities[index - 1]];
    setSettings({ ...settings, warehouse_priorities: newPriorities });
  };

  const moveDown = (index: number) => {
    if (index === settings.warehouse_priorities.length - 1) return;
    const newPriorities = [...settings.warehouse_priorities];
    [newPriorities[index], newPriorities[index + 1]] = [newPriorities[index + 1], newPriorities[index]];
    setSettings({ ...settings, warehouse_priorities: newPriorities });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Inventory Settings</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Configure automatic stock reduction and warehouse priorities
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/company"
            className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Back
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          Settings saved successfully!
        </div>
      )}

      {/* Auto Reduce Stock Setting */}
      <div className="mb-6 rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-dark dark:text-white">Automatic Stock Reduction</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Automatically reduce inventory when creating invoices
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.auto_reduce_stock}
              onChange={(e) => setSettings({ ...settings, auto_reduce_stock: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-700"></div>
          </label>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <div className="flex gap-3">
            <svg className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">How it works:</p>
              <ul className="mt-2 space-y-1 text-blue-700 dark:text-blue-300">
                <li>• Invoice created → Stock is reserved (not yet reduced)</li>
                <li>• Invoice marked as PAID → Stock entries are created and inventory reduced</li>
                <li>• Invoice cancelled/refunded → Stock is automatically restored</li>
                <li>• Negative stock is allowed if warehouse doesn't have enough</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Priority */}
      {settings.auto_reduce_stock && (
        <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-dark dark:text-white">Warehouse Priority Order</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Stock will be reduced from warehouses in this order. Drag to reorder.
            </p>
          </div>

          <div className="space-y-2">
            {settings.warehouse_priorities.map((warehouseId, index) => (
              <div
                key={warehouseId}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between rounded-lg border-2 border-dashed p-4 transition ${
                  draggedIndex === index
                    ? "border-primary bg-primary/10"
                    : "border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                } cursor-move hover:border-primary hover:bg-primary/5`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-dark dark:text-white">
                      {getWarehouseName(warehouseId)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {index === 0 ? "First priority" : `Priority ${index + 1}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="rounded p-1 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-dark-3"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === settings.warehouse_priorities.length - 1}
                    className="rounded p-1 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-dark-3"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="ml-2 cursor-grab text-gray-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {godowns.length === 0 && (
            <div className="mt-4 rounded-lg bg-yellow-50 p-4 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
              <p className="text-sm">
                No warehouses/godowns created yet. Stock will be reduced from Main Location by default.{" "}
                <Link href="/inventory/godowns" className="font-medium underline">
                  Create godowns
                </Link>
              </p>
            </div>
          )}

          <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>How priority works:</strong> When an invoice is created, the system will first try to allocate 
              stock from the #1 priority warehouse. If stock is insufficient, it will move to #2, and so on. 
              The system can split a single invoice item across multiple warehouses if needed.
            </p>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="mt-6 rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-4 font-semibold text-dark dark:text-white">Related Settings</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/inventory/godowns"
            className="flex items-center gap-3 rounded-lg border border-stroke p-3 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3"
          >
            <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="font-medium text-dark dark:text-white">Manage Warehouses/Godowns</span>
          </Link>
          
          <Link
            href="/inventory/warehouse-report"
            className="flex items-center gap-3 rounded-lg border border-stroke p-3 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3"
          >
            <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="font-medium text-dark dark:text-white">View Warehouse Report</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
