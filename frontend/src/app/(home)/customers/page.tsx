"use client";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

import { useAuth } from "@/context/AuthContext";
import { customersApi, Customer, CustomerListResponse } from "@/services/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  Download,
  CreditCard,
  FileText,
  Printer,
  Copy,
  ChevronDown,
} from "lucide-react";

export default function CustomersPage() {
  const { company } = useAuth();
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Column visibility state - with optimized defaults
  const [visibleColumns, setVisibleColumns] = useState({
    customerId: true,
    name: true,
    contact: true,
    email: true,
    contactPerson: false, // Hidden by default
    gstin: false, // Hidden by default
    type: true,
    dueAmount: true,
    status: true,
    actions: true,
  });

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Export functions
  const copyToClipboard = async () => {
    const headers = [
      "Customer ID",
      "Name",
      "Mobile",
      "Email",
      "GSTIN",
      "Type",
      "Due Amount",
      "Credit Limit",
      "Status"
    ];

    const rows = filteredCustomers.map(customer => [
      customer.customer_code || "N/A",
      customer.name,
      customer.mobile || customer.contact || "-",
      customer.email || "-",
      customer.tax_number || customer.gstin || "-",
      getTypeLabel(customer.customer_type || ""),
      customer.outstanding_balance ? `₹${customer.outstanding_balance.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}` : "₹0.00",
      customer.credit_limit ? `₹${customer.credit_limit.toLocaleString("en-IN")}` : "₹0",
      getStatusText(customer.outstanding_balance || 0, customer.credit_limit || 0)
    ]);

    const text = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
    await navigator.clipboard.writeText(text);
    alert("Customer data copied to clipboard");
  };

  const exportExcel = () => {
    if (!filteredCustomers.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredCustomers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "customers.xlsx");
  };

  const exportPDF = () => {
    if (!filteredCustomers.length) return;
    const doc = new jsPDF();

    autoTable(doc, {
      head: [["Customer ID", "Name", "Type", "Due Amount", "Status"]],
      body: filteredCustomers.map(customer => [
        customer.customer_code || "N/A",
        customer.name,
        getTypeLabel(customer.customer_type || ""),
        customer.outstanding_balance ? `₹${customer.outstanding_balance.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}` : "₹0.00",
        getStatusText(customer.outstanding_balance || 0, customer.credit_limit || 0)
      ])
    });

    doc.save("customers.pdf");
  };

  const exportCSV = () => {
    if (!filteredCustomers.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredCustomers);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "customers.csv");
  };

  const printTable = () => window.print();

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
          search: searchTerm || undefined,
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
  }, [company?.id, page, searchTerm, typeFilter]);

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
    if (outstanding > creditLimit) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    if (outstanding > 0) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  };

  const getStatusText = (outstanding: number, creditLimit: number) => {
    if (outstanding > creditLimit) return "Overdue";
    if (outstanding > 0) return "Pending";
    return "Paid";
  };

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

  const formatContactPersons = (customer: Customer) => {
    if (!customer.contact_persons || customer.contact_persons.length === 0) {
      return "-";
    }
    
    // Show only the first contact person to save space
    const firstPerson = customer.contact_persons[0];
    return (
      <div className="truncate" title={`${firstPerson.name}${firstPerson.email ? ` (${firstPerson.email})` : ''}`}>
        <div className="font-medium text-gray-900 dark:text-white truncate">{firstPerson.name}</div>
        {firstPerson.email && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{firstPerson.email}</div>
        )}
        {customer.contact_persons.length > 1 && (
          <div className="text-xs text-primary dark:text-primary-light">
            +{customer.contact_persons.length - 1} more
          </div>
        )}
      </div>
    );
  };

  // Filter customers based on search and filters
  const filteredCustomers = data?.customers.filter((customer) => {
    const matchesSearch =
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customer_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobile?.includes(searchTerm) ||
      customer.contact?.includes(searchTerm);

    const matchesType = !typeFilter || customer.customer_type === typeFilter;
    
    const matchesStatus = !statusFilter || 
      getStatusText(customer.outstanding_balance || 0, customer.credit_limit || 0).toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesType && matchesStatus;
  }) || [];

  const totalPages = data ? Math.ceil(data.total / 10) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your customers ({data?.total || 0} total)
          </p>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, code, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="b2b">Business (B2B)</option>
              <option value="b2c">Consumer (B2C)</option>
              <option value="export">Export</option>
              <option value="sez">SEZ</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>

            <button
              onClick={() => {
                setTypeFilter("");
                setStatusFilter("");
              }}
              className="text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Customers Table Container */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={copyToClipboard}
            className="px-3 py-2 text-sm border bg-primary text-white rounded-lg flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>

          <div className="relative group">
            <button className="px-3 py-2 text-sm border bg-primary text-white rounded-lg flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Columns
              <ChevronDown className="w-4 h-4" />
            </button>

            <div className="absolute right-0 mt-2 hidden group-hover:block bg-white dark:bg-gray-800 border rounded-lg shadow-md p-3 z-10 min-w-[180px]">
              {Object.entries(visibleColumns).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-sm p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                    className="rounded border-gray-300"
                  />
                  <span className="capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button onClick={exportExcel} className="px-3 py-2 text-sm bg-primary text-white rounded-lg flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Excel
          </button>
          <button onClick={exportCSV} className="px-3 py-2 text-sm bg-primary text-white rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button onClick={exportPDF} className="px-3 py-2 text-sm bg-primary text-white rounded-lg flex items-center gap-2">
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button onClick={printTable} className="px-3 py-2 text-sm bg-primary text-white rounded-lg flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>

        {/* Table with horizontal scroll inside container */}
        <div className="overflow-x-auto max-w-full">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  {visibleColumns.customerId && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-32">
                      Customer ID
                    </th>
                  )}
                  {visibleColumns.name && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-48">
                      Name
                    </th>
                  )}
                  {visibleColumns.contact && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-32">
                      Contact
                    </th>
                  )}
                  {visibleColumns.email && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-56">
                      Email
                    </th>
                  )}
                  {visibleColumns.contactPerson && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-48">
                      Contact Person
                    </th>
                  )}
                  {visibleColumns.gstin && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-48">
                      GSTIN
                    </th>
                  )}
                  {visibleColumns.type && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-32">
                      Type
                    </th>
                  )}
                  {visibleColumns.dueAmount && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-40">
                      Due Amount
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-32">
                      Status
                    </th>
                  )}
                  {visibleColumns.actions && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap w-40">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={
                        Object.values(visibleColumns).filter(v => v).length || 10
                      } 
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      {data?.customers.length === 0 ? (
                        <div className="flex flex-col items-center">
                          <Users className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-lg font-medium">No customers yet</p>
                          <p className="text-sm">Add your first customer to get started</p>
                          <Link
                            href="/customers/new"
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            <Plus className="w-5 h-5" />
                            Add Customer
                          </Link>
                        </div>
                      ) : (
                        "No customers match your search criteria"
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      {visibleColumns.customerId && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-primary dark:text-primary-light truncate max-w-[120px]" title={customer.customer_code || "N/A"}>
                            {customer.customer_code || <span className="text-gray-500 dark:text-gray-400">N/A</span>}
                          </div>
                        </td>
                      )}
                      {visibleColumns.name && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="truncate max-w-[180px]">
                            <p className="font-medium text-gray-900 dark:text-white truncate" title={customer.name}>
                              {customer.name}
                            </p>
                            {customer.trade_name && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate" title={customer.trade_name}>
                                {customer.trade_name}
                              </p>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.contact && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white truncate max-w-[120px]" title={customer.mobile || customer.contact || "-"}>
                            {customer.mobile || customer.contact || "-"}
                          </div>
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white truncate max-w-[200px]" title={customer.email || "-"}>
                            {customer.email || "-"}
                          </div>
                        </td>
                      )}
                      {visibleColumns.contactPerson && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="truncate max-w-[180px]">
                            {formatContactPersons(customer)}
                          </div>
                        </td>
                      )}
                      {visibleColumns.gstin && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-gray-500 dark:text-gray-400 truncate max-w-[180px]" title={customer.tax_number || customer.gstin || "-"}>
                            {customer.tax_number || customer.gstin || "-"}
                          </div>
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {getTypeLabel(customer.customer_type || "")}
                          </span>
                        </td>
                      )}
                      {visibleColumns.dueAmount && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-white">
                            ₹{(customer.outstanding_balance || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Credit: ₹{(customer.credit_limit || 0).toLocaleString("en-IN")}
                          </div>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${getStatusColor(
                            customer.outstanding_balance || 0,
                            customer.credit_limit || 0
                          )}`}>
                            {getStatusText(
                              customer.outstanding_balance || 0,
                              customer.credit_limit || 0
                            )}
                          </span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* View */}
                            <Link
                              href={`/customers/${customer.id}`}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            
                            {/* Edit */}
                            <Link
                              href={`/customers/${customer.id}/edit`}
                              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            
                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            
                            {/* Advance Payments */}
                            <Link
                              href={`/customers/${customer.id}/advance`}
                              className="p-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
                              title="Advance Payments"
                            >
                              <CreditCard className="w-4 h-4" />
                            </Link>
                            
                            {/* More Actions Dropdown */}
                            <div className="relative group">
                              <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="absolute right-0 mt-2 hidden group-hover:block bg-white dark:bg-gray-800 border rounded-lg shadow-md p-2 z-10 min-w-[160px]">
                                {/* View Payments */}
                                <Link
                                  href={`/customers/${customer.id}/payments`}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Payments
                                </Link>
                                
                                {/* Receive Due */}
                                <Link
                                  href={`/customers/${customer.id}/receive-due`}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20 rounded"
                                >
                                  <Download className="w-4 h-4" />
                                  Receive Due
                                </Link>
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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