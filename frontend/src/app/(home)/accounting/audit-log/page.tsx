"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  changed_fields: string[];
  old_values: any;
  new_values: any;
  user_id: string;
  user_name: string;
  timestamp: string;
  ip_address: string;
}

export default function AuditLogPage() {
  const { company } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    table: "",
    action: "",
    from_date: "",
    to_date: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchLogs();
    }
  }, [company, filter]);

  const fetchLogs = async () => {
    try {
      let params = new URLSearchParams();
      if (filter.table) params.append("table_name", filter.table);
      if (filter.action) params.append("action", filter.action);
      if (filter.from_date) params.append("from_date", filter.from_date);
      if (filter.to_date) params.append("to_date", filter.to_date);

      const response = await api.get(
        `/companies/${company?.id}/audit-logs?${params.toString()}`
      );
      setLogs(response.data);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create": return "bg-success bg-opacity-10 text-success";
      case "update": return "bg-warning bg-opacity-10 text-warning";
      case "delete": return "bg-danger bg-opacity-10 text-danger";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Audit Log" />

      {/* Filters */}
      <div className="mb-4 rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm text-black dark:text-white">Table</label>
            <select
              value={filter.table}
              onChange={(e) => setFilter({ ...filter, table: e.target.value })}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            >
              <option value="">All Tables</option>
              <option value="transactions">Transactions</option>
              <option value="invoices">Invoices</option>
              <option value="purchase_invoices">Purchase Invoices</option>
              <option value="customers">Customers</option>
              <option value="products">Products</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-black dark:text-white">Action</label>
            <select
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value })}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-black dark:text-white">From Date</label>
            <input
              type="date"
              value={filter.from_date}
              onChange={(e) => setFilter({ ...filter, from_date: e.target.value })}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-black dark:text-white">To Date</label>
            <input
              type="date"
              value={filter.to_date}
              onChange={(e) => setFilter({ ...filter, to_date: e.target.value })}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            />
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Timestamp</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">User</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Table</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Action</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Changed Fields</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-sm">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {log.user_name || "System"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {log.table_name}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-sm">
                    {log.changed_fields?.join(", ") || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button className="text-primary hover:underline text-sm">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-body">
                    No audit logs found for the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

