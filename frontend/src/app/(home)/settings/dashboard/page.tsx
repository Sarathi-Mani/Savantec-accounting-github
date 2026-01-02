"use client";

import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";

const availableWidgets = [
  { id: "sales_summary", name: "Sales Summary", enabled: true },
  { id: "receivables", name: "Receivables Overview", enabled: true },
  { id: "payables", name: "Payables Overview", enabled: true },
  { id: "cash_flow", name: "Cash Flow", enabled: true },
  { id: "top_customers", name: "Top Customers", enabled: false },
  { id: "top_products", name: "Top Products", enabled: false },
  { id: "gst_summary", name: "GST Summary", enabled: true },
  { id: "stock_alerts", name: "Stock Alerts", enabled: false },
  { id: "pending_orders", name: "Pending Orders", enabled: false },
];

export default function DashboardSettingsPage() {
  const [widgets, setWidgets] = useState(availableWidgets);

  const toggleWidget = (id: string) => {
    setWidgets(widgets.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ));
  };

  const saveSettings = () => {
    alert("Dashboard settings saved!");
  };

  return (
    <>
      <Breadcrumb pageName="Dashboard Settings" />

      <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <h3 className="mb-4 font-medium text-black dark:text-white">Dashboard Widgets</h3>
        <p className="mb-6 text-body">Enable or disable widgets that appear on your dashboard.</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              onClick={() => toggleWidget(widget.id)}
              className={`cursor-pointer rounded border p-4 transition-all ${
                widget.enabled 
                  ? "border-primary bg-primary bg-opacity-5" 
                  : "border-stroke bg-white dark:border-strokedark dark:bg-boxdark"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-black dark:text-white">{widget.name}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  widget.enabled ? "border-primary bg-primary" : "border-stroke"
                }`}>
                  {widget.enabled && <span className="text-white text-xs">✓</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={saveSettings} className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}
