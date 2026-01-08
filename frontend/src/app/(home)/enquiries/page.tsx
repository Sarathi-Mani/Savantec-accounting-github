"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768";


interface EnquiryItem {
  description?: string;
  quantity?: number;
  suitable_item?: string;
  purchase_price?: number;
  sales_price?: number;
  image_url?: string;
  notes?: string;
  product_id?: string;
}



interface Enquiry {
  id: string;
  enquiry_number: string;
  enquiry_date: string;
  subject: string;
  status: string;
  priority: string;
  source: string;
  totalQty?:string;
  products_interested?: EnquiryItem[];
  items?: EnquiryItem[];
  description?: string; 
  expected_value: number;
  customer_name?: string;
  contact_name?: string;
  sales_person_name?: string;
  ticket_number?: string;
  prospect_name?: string;
  prospect_company?: string;
  
  // Additional fields from Laravel
  company?: {
    name: string;
  };
  contact_person?: string;
  product?: string;
  quantity?: number;
  remarks?: string;
  salesman?: {
    name: string;
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  quoted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  purchased: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  ignored: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  proposal_sent: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  negotiation: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  won: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  on_hold: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

// Helper function to determine if actions should be shown
const shouldShowActions = (status: string): boolean => {
  // Show actions for statuses that can be edited/deleted
  
  return true;
};

// Helper function to determine if delete is allowed
// Helper function to determine if edit is allowed
const canEditEnquiry = (status: string): boolean => {
  // Allow edit for statuses that haven't been completed/cancelled/won/lost
  const nonEditableStatuses = ['completed', 'cancelled', 'won', 'lost', 'purchased'];
  return !nonEditableStatuses.includes(status);
};

// Helper function to determine if delete is allowed
const canDeleteEnquiry = (status: string): boolean => {
  // Only allow delete for certain statuses (similar to Laravel's permission check)
  const deletableStatuses = ['pending', 'new', 'assigned', 'on_hold'];
  return deletableStatuses.includes(status);
};

// Helper function to get status badge class
const getStatusBadgeClass = (status: string): string => {
  const statusClassMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    quoted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    purchased: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    ignored: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    contacted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    proposal_sent: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    negotiation: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    won: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    on_hold: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };
  
  return statusClassMap[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
};



export default function EnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filters state
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [salesmanFilter, setSalesmanFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  
  // Dropdown data
  const [companies, setCompanies] = useState<any[]>([]);
  const [salesmen, setSalesmen] = useState<any[]>([]);
  
  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null;

  useEffect(() => {
    if (companyId) {
      fetchEnquiries();
      fetchDropdownData();
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchEnquiries();
    }
  }, [statusFilter, sourceFilter, salesmanFilter, companyFilter, fromDate, toDate]);

  const fetchDropdownData = async () => {
    try {
      // Fetch companies
      const companiesResponse = await fetch(
        `${API_BASE}/companies`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      
      if (companiesResponse.ok) {
        const companiesData = await companiesResponse.json();
        setCompanies(companiesData);
      }
      
      // Fetch employees/salesmen
      const salesmenResponse = await fetch(
        `${API_BASE}/companies/${companyId}/employees`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      
      if (salesmenResponse.ok) {
        const salesmenData = await salesmenResponse.json();
        setSalesmen(salesmenData);
      }
    } catch (err) {
      console.error("Failed to fetch dropdown data:", err);
    }
  };

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (search) params.append("search", search);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (salesmanFilter) params.append("sales_person_id", salesmanFilter);
      if (companyFilter) params.append("company_id", companyFilter);

      const response = await fetch(
        `${API_BASE}/companies/${companyId}/enquiries?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch enquiries");

      const data = await response.json();
      setEnquiries(data);
    } catch (err) {
      setError("Failed to load enquiries");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEnquiry = async (enquiryId: string, enquiryNumber: string) => {
    if (window.confirm(`Are you sure you want to delete enquiry ${enquiryNumber}? This action cannot be undone.`)) {
      try {
        const response = await fetch(
          `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
          }
        );

        if (response.ok) {
          alert("Enquiry deleted successfully!");
          fetchEnquiries(); // Refresh the list
        } else {
          throw new Error("Failed to delete enquiry");
        }
      } catch (err) {
        alert("Failed to delete enquiry. Please try again.");
        console.error(err);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEnquiries();
  };

  const handleReset = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setStatusFilter("");
    setSourceFilter("");
    setSalesmanFilter("");
    setCompanyFilter("");
    fetchEnquiries();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <p className="text-yellow-800 dark:text-yellow-400">Please select a company first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Enquiries</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track and manage sales enquiries</p>
        </div>
        <Link
          href="/enquiries/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Enquiry
        </Link>
      </div>

      {/* Filters Card - Merged from Laravel */}
      <div className="bg-white dark:bg-gray-dark rounded-lg shadow">
        <div className="p-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* From Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                />
              </div>

              {/* Company Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company
                </label>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="quoted">Quoted</option>
                  <option value="purchased">Purchased</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                  <option value="ignored">Ignored</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Sales Engineer Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sales Engineer
                </label>
                <select
                  value={salesmanFilter}
                  onChange={(e) => setSalesmanFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                >
                  <option value="">All Sales Engineers</option>
                  {salesmen.map((salesman) => (
                    <option key={salesman.id} value={salesman.id}>
                      {salesman.first_name} {salesman.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                >
                  <option value="">All Sources</option>
                  <option value="website">Website</option>
                  <option value="phone_call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="referral">Referral</option>
                  <option value="walk_in">Walk In</option>
                  <option value="trade_show">Trade Show</option>
                  <option value="social_media">Social Media</option>
                  <option value="advertisement">Advertisement</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search enquiries..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Apply
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2 dark:bg-dark-3 dark:text-gray-300 dark:hover:bg-dark-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading enquiries...</p>
        </div>
      ) : enquiries.length === 0 ? (
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-8 text-center">
          <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No enquiries yet</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Create your first enquiry to start tracking sales leads.</p>
          <Link
            href="/enquiries/new"
            className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Create Enquiry
          </Link>
        </div>
      ) : (
        /* Table - Merged columns from Laravel */
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-3">
            
<thead className="bg-gray-50 dark:bg-dark-2">
  <tr>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Date
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Enquiry No
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Company / Customer
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Contact Person
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Quantity
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Status
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Sales Engineer
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Remarks
    </th>
    
    {/* Always show Actions column */}
    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      Actions
    </th>
  </tr>
</thead>

<tbody className="bg-white dark:bg-gray-dark divide-y divide-gray-200 dark:divide-dark-3">
  {enquiries.map((enquiry) => {
    // Determine actions for this specific enquiry
    const isCompleted = enquiry.status === 'completed';
    const showEditDelete = canEditEnquiry(enquiry.status) || canDeleteEnquiry(enquiry.status);
    
    return (
      <tr key={enquiry.id} className="hover:bg-gray-50 dark:hover:bg-dark-2">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900 dark:text-white">
            {formatDate(enquiry.enquiry_date)}
          </div>
        </td>
        <td className="px-6 py-4">
          <Link
            href={`/enquiries/${enquiry.id}`}
            className="text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {enquiry.enquiry_number}
          </Link>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-gray-900 dark:text-white font-medium">
            {enquiry.company?.name || enquiry.customer_name || enquiry.prospect_company || "-"}
          </div>
          {enquiry.prospect_name && enquiry.prospect_name !== (enquiry.company?.name || enquiry.customer_name) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {enquiry.prospect_name}
            </div>
          )}
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-gray-900 dark:text-white">
            {enquiry.prospect_name || enquiry.contact_name || "-"}
          </div>
        </td>
        
     <td className="px-6 py-4">
  <div className="text-sm text-gray-900 dark:text-white">
    {(() => {
      let totalQty = 0;
      if (enquiry.products_interested && Array.isArray(enquiry.products_interested)) {
        totalQty = enquiry.products_interested.reduce((sum: number, item: EnquiryItem) => sum + (item.quantity || 0), 0);
      } else if (enquiry.items && Array.isArray(enquiry.items)) {
        totalQty = enquiry.items.reduce((sum: number, item: EnquiryItem) => sum + (item.quantity || 0), 0);
      }
      return totalQty > 0 ? totalQty : "-";
    })()}
  </div>
</td>
        <td className="px-6 py-4">
          <div className="flex flex-col gap-1">
            <span
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                getStatusBadgeClass(enquiry.status)
              }`}
            >
              {enquiry.status.replace("_", " ")}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-gray-900 dark:text-white">
            {enquiry.salesman?.name || enquiry.sales_person_name || "-"}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
            { enquiry.description || "-"}
          </div>
        </td>
        
        
        {/* Actions column - always show but conditionally render buttons */}
        <td className="px-6 py-4 text-right">
          <div className="flex justify-end gap-2">
            {/* If status is completed, show only View button */}
            {isCompleted ? (
              <Link
                href={`/enquiries/${enquiry.id}`}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 p-1"
                title="View (Completed - Read Only)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </Link>
            ) : (
              <>
                {/* Edit button - only for editable statuses */}
                {canEditEnquiry(enquiry.status) && (
                  <Link
                    href={`/enquiries/${enquiry.id}/edit`}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                    title="Edit"
                  >
                   Assign
                  </Link>
                )}
                
                
              </>
            )}
          </div>
        </td>
      </tr>
    );
  })}
</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}