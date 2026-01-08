"use client";

import { useAuth } from "@/context/AuthContext";
import { customersApi, Customer, CustomerListResponse } from "@/services/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CustomersPage() {
  const { company } = useAuth();
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await customersApi.list(company.id, {
          page,
          page_size: 10,
          search: search || undefined,
          customer_type: typeFilter || undefined,
        });
        setData(result);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [company?.id, page, search, typeFilter]);

  const handleDelete = async (customerId: string) => {
    if (!company?.id || !confirm("Are you sure you want to delete this customer?")) return;
    try {
      await customersApi.delete(company.id, customerId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              customers: prev.customers.filter((c) => c.id !== customerId),
              total: prev.total - 1,
            }
          : null
      );
    } catch (error) {
      console.error("Failed to delete customer:", error);
    }
  };

  const getStatusColor = (outstanding: number, creditLimit: number) => {
    if (outstanding > creditLimit) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300";
    if (outstanding > 0) return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300";
    return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
  };

  const getStatusText = (outstanding: number, creditLimit: number) => {
    if (outstanding > creditLimit) return "Overdue";
    if (outstanding > 0) return "Pending";
    return "Paid";
  };

  const totalPages = data ? Math.ceil(data.total / 10) : 0;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "b2b":
        return "B2B";
      case "b2c":
        return "B2C";
      case "export":
        return "Export";
      case "sez":
        return "SEZ";
      default:
        return type;
    }
  };

  // Helper to format contact persons
  const formatContactPersons = (customer: Customer) => {
    if (!customer.contact_persons || customer.contact_persons.length === 0) {
      return "-";
    }
    
    return customer.contact_persons.map((person, index) => (
      <div key={index} className="mb-1 last:mb-0">
        <div className="font-medium text-dark dark:text-white">{person.name}</div>
        {person.email && <div className="text-xs text-dark-6">{person.email}</div>}
        {person.phone && <div className="text-xs text-dark-6">{person.phone}</div>}
      </div>
    ));
  };

  return (
    <div className="min-h-screen">
      {/* Main content area */}
      <div className="p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white">Customers</h1>
            <p className="text-sm text-dark-6">Manage your customers</p>
          </div>
          <Link
            href="/customers/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Customer
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search customers..."
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
            <option value="b2b">Business (B2B)</option>
            <option value="b2c">Consumer (B2C)</option>
            <option value="export">Export</option>
            <option value="sez">SEZ</option>
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
          ) : data?.customers.length === 0 ? (
            <div className="py-20 text-center">
              <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-dark-6">No customers found</p>
              <Link href="/customers/new" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
                Add your first customer
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stroke dark:border-dark-3">
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Customer ID</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Customer Name</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Mobile</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Contact Person</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">GSTIN</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Due Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                      <td className="px-6 py-4">
                        <div className="font-medium text-primary dark:text-primary-light">
                          {customer.customer_code || <span className="text-dark-6">N/A</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-dark dark:text-white">{customer.name}</p>
                          {customer.trade_name && (
                            <p className="text-sm text-dark-6">{customer.trade_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-dark dark:text-white">
                          {customer.mobile || customer.contact || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-dark dark:text-white">
                          {customer.email || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-[200px]">
                          {formatContactPersons(customer)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-dark-6">
                        {customer.tax_number || customer.gstin || "-"}
                      </td>
                      <td className="px-6 py-4">
                       // In customers/page.tsx - fix line 220
<span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-dark-6 dark:bg-dark-3">
  {getTypeLabel(customer.customer_type || "")}
</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-dark dark:text-white">
                          ₹{(customer.outstanding_balance || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </div>
                        <div className="text-xs text-dark-6">
                          Credit: ₹{(customer.credit_limit || 0).toLocaleString("en-IN")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                          customer.outstanding_balance || 0,
                          customer.credit_limit || 0
                        )}`}>
                          {getStatusText(
                            customer.outstanding_balance || 0,
                            customer.credit_limit || 0
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit */}
                          <Link
                            href={`/customers/${customer.id}/edit`}
                            className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-dark-3"
                            title="Edit"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          
                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          
                          {/* Advance */}
                          <Link
                            href={`/customers/${customer.id}/advance`}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                            title="Advance Payments"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </Link>
                          
                          {/* View Payments */}
                          <Link
                            href={`/customers/${customer.id}/payments`}
                            className="rounded p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                            title="View Payments"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          
                          {/* Receive Due */}
                          <Link
                            href={`/customers/${customer.id}/receive-due`}
                            className="rounded p-1.5 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                            title="Receive Due Payments"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                          </Link>
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
    </div>
  );
}