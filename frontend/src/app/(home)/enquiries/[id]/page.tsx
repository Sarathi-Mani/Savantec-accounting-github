"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768/api";

interface EnquiryItem {
  description: string;
  quantity: number;
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
  description?: string;
  expected_value: number;
  customer_name?: string;
  contact_name?: string;
  sales_person_name?: string;
  ticket_number?: string;
  prospect_name?: string;
  prospect_email?: string;
  prospect_phone?: string;
  prospect_company?: string;
  
  // Additional fields
  company?: {
    name: string;
  };
  company_id?: string;
  contact_person?: string;
  kind_attn?: string;
  mail_id?: string;
  phone_no?: string;
  product?: string;
  quantity?: number;
  remarks?: string;
  salesman?: {
    name: string;
  };
  salesman_id?: string;
  items?: any[]; // From items relationship
  products_interested?: EnquiryItem[]; // This contains the price data
  pending_remarks?: string;
  quotation_no?: string;
  quotation_date?: string;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  assigned: { label: "Assigned", color: "bg-blue-100 text-blue-800" },
  quoted: { label: "Quoted", color: "bg-indigo-100 text-indigo-800" },
  purchased: { label: "Purchased", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  ignored: { label: "Ignored", color: "bg-gray-100 text-gray-800" },
  ready_for_purchase: { label: "Ready for Purchase", color: "bg-blue-100 text-blue-800" },
  ready_for_quotation: { label: "Ready for Quotation", color: "bg-indigo-100 text-indigo-800" },
  proposal_sent: { label: "Proposal Sent", color: "bg-purple-100 text-purple-800" },
};

export default function EnquiryDetailView() {
  const params = useParams();
  const router = useRouter();
  const enquiryId = params.id as string;

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [items, setItems] = useState<EnquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageModal, setImageModal] = useState<{ show: boolean; src: string; title: string }>({
    show: false,
    src: "",
    title: "",
  });

  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null;
useEffect(() => {
  if (companyId && enquiryId) {
    console.log("Fetching enquiry with ID:", enquiryId);
    fetchEnquiry();
  } else {
    console.log("Cannot fetch: companyId =", companyId, "enquiryId =", enquiryId);
  }
}, [companyId, enquiryId]); // Make sure enquiryId is in dependencies

 const fetchEnquiry = async () => {
  try {
    setLoading(true);
    const response = await fetch(
      `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Response not OK:", response.status, response.statusText);
      throw new Error("Failed to fetch enquiry");
    }

    const data = await response.json();
    
    // DEBUG: Check what's coming from API
    console.log("=== DEBUG VIEW PAGE ===");
    console.log("Full API response:", data);
    console.log("products_interested exists?", "products_interested" in data);
    console.log("products_interested value:", data.products_interested);
    console.log("Type of products_interested:", typeof data.products_interested);
    console.log("Is it array?", Array.isArray(data.products_interested));
    console.log("=== END DEBUG ===");
    
    setEnquiry(data);

    // Extract items from products_interested (contains price data)
    if (data.products_interested && Array.isArray(data.products_interested)) {
      console.log("Setting items from products_interested. Count:", data.products_interested.length);
      console.log("First item:", data.products_interested[0]);
      
      setItems(data.products_interested.map((item: any) => ({
        description: item.description || "",
        quantity: item.quantity || 1,
        suitable_item: item.suitable_item || "",
        purchase_price: item.purchase_price || 0,
        sales_price: item.sales_price || 0,
        image_url: item.image_url,
        notes: item.notes || "",
        product_id: item.product_id,
      })));
    } else if (data.items && Array.isArray(data.items)) {
      // Fallback to items relationship
      console.log("No products_interested, using items. Count:", data.items.length);
      setItems(data.items.map((item: any) => ({
        description: item.description || "",
        quantity: item.quantity || 1,
        suitable_item: "", // Not in items table
        purchase_price: 0, // Not in items table
        sales_price: 0, // Not in items table
        image_url: item.image_url,
        notes: item.notes || "",
        product_id: item.product_id,
      })));
    } else {
      console.log("No items found in response");
      setItems([]);
    }
  } catch (err) {
    setError("Failed to load enquiry");
    console.error("Error fetching enquiry:", err);
  } finally {
    setLoading(false);
  }
};

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) return null;
    
    // Check different possible image paths
    if (imagePath.startsWith('http')) return imagePath;
    
    // For relative paths starting with /
    if (imagePath.startsWith('/')) {
      // Check if it's already a full URL with API_BASE
      if (imagePath.includes(API_BASE.replace('http://', ''))) {
        return imagePath;
      }
      // If it's a relative path starting with /uploads
      if (imagePath.startsWith('/uploads')) {
        return `${API_BASE}${imagePath}`;
      }
      // For other relative paths
      return `${API_BASE}/storage${imagePath}`;
    }
    
    // For stored images without leading slash
    return `${API_BASE}/storage/enquiry_items/${imagePath}`;
  };

  const getCompanyName = () => {
    if (enquiry?.company?.name) return enquiry.company.name;
    if (enquiry?.customer_name) return enquiry.customer_name;
    if (enquiry?.prospect_company) return enquiry.prospect_company;
    return "N/A";
  };

  const getContactPerson = () => {
    if (enquiry?.contact_person) return enquiry.contact_person;
    if (enquiry?.kind_attn) return enquiry.kind_attn;
    if (enquiry?.prospect_name) return enquiry.prospect_name;
    if (enquiry?.contact_name) return enquiry.contact_name;
    return "N/A";
  };

  const getEmail = () => {
    if (enquiry?.mail_id) return enquiry.mail_id;
    if (enquiry?.prospect_email) return enquiry.prospect_email;
    return null;
  };

  const getPhone = () => {
    if (enquiry?.phone_no) return enquiry.phone_no;
    if (enquiry?.prospect_phone) return enquiry.prospect_phone;
    return null;
  };

  const getSalesPerson = () => {
    if (enquiry?.salesman?.name) return enquiry.salesman.name;
    if (enquiry?.sales_person_name) return enquiry.sales_person_name;
    return "Not Assigned";
  };

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a company first.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
        <p className="text-gray-600">Loading enquiry details...</p>
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || "Enquiry not found"}</p>
          <Link href="/enquiries" className="mt-2 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Enquiries
          </Link>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalPurchase = items.reduce((sum, item) => sum + (item.purchase_price || 0) * (item.quantity || 1), 0);
  const totalSales = items.reduce((sum, item) => sum + (item.sales_price || 0) * (item.quantity || 1), 0);
  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const itemCount = items.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/enquiries"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to List
          </Link>
          
          <Link
            href={`/enquiries/${enquiryId}/edit`}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 px-3 py-2 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Enquiry
          </Link>
        </div>
        
        <div className="text-right">
          <h1 className="text-2xl font-bold text-gray-900">Enquiry Details</h1>
          <div className="mt-2 flex items-center gap-3 justify-end">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig[enquiry.status]?.color || 'bg-gray-100 text-gray-800'}`}>
              {statusConfig[enquiry.status]?.label || enquiry.status}
            </span>
            <span className="text-sm text-gray-600">#{enquiry.enquiry_number}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1 - Basic Information */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            </div>
            <div className="p-6">
              <table className="w-full">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 text-sm text-gray-600 w-2/5">Enquiry Number</td>
                    <td className="py-3 font-semibold text-gray-900">{enquiry.enquiry_number}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-gray-600">Enquiry Date</td>
                    <td className="py-3 font-semibold text-gray-900">{formatDate(enquiry.enquiry_date)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-gray-600">Subject</td>
                    <td className="py-3 font-semibold text-gray-900">{enquiry.subject || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm text-gray-600">Company Name</td>
                    <td className="py-3 font-semibold text-gray-900">{getCompanyName()}</td>
                  </tr>
                  
                  <tr>
                    <td className="py-3 text-sm text-gray-600">Contact Person</td>
                    <td className="py-3 text-gray-900">{getContactPerson()}</td>
                  </tr>
                  
                  {getEmail() && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Email</td>
                      <td className="py-3">
                        <a href={`mailto:${getEmail()}`} className="text-blue-600 hover:text-blue-800">
                          {getEmail()}
                        </a>
                      </td>
                    </tr>
                  )}
                  
                  {getPhone() && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Phone</td>
                      <td className="py-3 text-gray-900">{getPhone()}</td>
                    </tr>
                  )}
                  
                  {enquiry.source && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Source</td>
                      <td className="py-3 text-gray-900">{enquiry.source}</td>
                    </tr>
                  )}
                  
                  {enquiry.priority && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Priority</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          enquiry.priority === 'high' ? 'bg-red-100 text-red-800' :
                          enquiry.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {enquiry.priority.charAt(0).toUpperCase() + enquiry.priority.slice(1)}
                        </span>
                      </td>
                    </tr>
                  )}
                  
                  {enquiry.expected_value > 0 && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Expected Value</td>
                      <td className="py-3 font-semibold text-green-600">₹{enquiry.expected_value.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Description Card */}
          {(enquiry.description || enquiry.remarks) && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Description & Remarks</h2>
              </div>
              <div className="p-6">
                {enquiry.description && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{enquiry.description}</p>
                    </div>
                  </div>
                )}
                {enquiry.remarks && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Remarks</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{enquiry.remarks}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Column 2 - Status Information */}
        <div className="space-y-6">
          {/* Status Information Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Status Information</h2>
            </div>
            <div className="p-6">
              <table className="w-full">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 text-sm text-gray-600 w-2/5">Status</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig[enquiry.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {statusConfig[enquiry.status]?.label || enquiry.status}
                      </span>
                    </td>
                  </tr>
                  
                  {enquiry.pending_remarks && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Pending Remarks</td>
                      <td className="py-3 text-gray-900">{enquiry.pending_remarks}</td>
                    </tr>
                  )}
                  
                  <tr>
                    <td className="py-3 text-sm text-gray-600">Sales Engineer</td>
                    <td className="py-3">
                      <div className="flex flex-col space-y-1">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                          {getSalesPerson()}
                        </span>
                      </div>
                    </td>
                  </tr>
                  
                  {itemCount > 0 && (
                    <>
                      <tr>
                        <td className="py-3 text-sm text-gray-600">Total Items</td>
                        <td className="py-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                            {itemCount} items
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 text-sm text-gray-600">Total Quantity</td>
                        <td className="py-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                            {totalQty} units
                          </span>
                        </td>
                      </tr>
                    </>
                  )}
                  
                  {enquiry.quotation_no && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Quotation Number</td>
                      <td className="py-3 font-semibold text-blue-600">{enquiry.quotation_no}</td>
                    </tr>
                  )}
                  
                  {enquiry.quotation_date && (
                    <tr>
                      <td className="py-3 text-sm text-gray-600">Quotation Date</td>
                      <td className="py-3 text-gray-900">{formatDate(enquiry.quotation_date)}</td>
                    </tr>
                  )}
                  
                  <tr>
                    <td className="py-3 text-sm text-gray-600">Created At</td>
                    <td className="py-3 text-gray-900">{formatDateTime(enquiry.created_at)}</td>
                  </tr>
                  
                  <tr>
                    <td className="py-3 text-sm text-gray-600">Last Updated</td>
                    <td className="py-3 text-gray-900">{formatDateTime(enquiry.updated_at)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
            </div>
            <div className="p-6 space-y-3">
              <Link
                href={`/enquiries/${enquiryId}/edit`}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Enquiry
              </Link>
              
              {enquiry.status === 'ready_for_quotation' && enquiry.quotation_no && (
                <button
                  onClick={() => alert('Convert to quotation functionality')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Convert to Quotation
                </button>
              )}
              
              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      {items.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Enquiry Items</h2>
            <div className="flex items-center gap-4">
              {totalPurchase > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium">
                  Purchase Total: ₹{totalPurchase.toFixed(2)}
                </span>
              )}
              {totalSales > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                  Sales Total: ₹{totalSales.toFixed(2)}
                </span>
              )}
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                {items.length} items • {totalQty} units
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/12">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-2/5">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/12">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">Suitable Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">Purchase Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">Sales Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/12">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const imageUrl = getImageUrl(item.image_url);
                  const purchaseTotal = (item.purchase_price || 0) * (item.quantity || 1);
                  const salesTotal = (item.sales_price || 0) * (item.quantity || 1);
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-center text-gray-900 font-medium">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.description}</div>
                        {item.notes && (
                          <div className="text-sm text-gray-500 mt-1">{item.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                          {item.quantity || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{item.suitable_item || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-gray-900 font-medium">₹{item.purchase_price ? item.purchase_price.toFixed(2) : '0.00'}</div>
                          {item.quantity > 1 && (
                            <div className="text-sm text-gray-500">Total: ₹{purchaseTotal.toFixed(2)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-gray-900 font-medium">₹{item.sales_price ? item.sales_price.toFixed(2) : '0.00'}</div>
                          {item.quantity > 1 && (
                            <div className="text-sm text-gray-500">Total: ₹{salesTotal.toFixed(2)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {imageUrl ? (
                          <button
                            onClick={() => setImageModal({
                              show: true,
                              src: imageUrl,
                              title: `${item.description || 'Item'} Image`
                            })}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-200 rounded-lg hover:bg-blue-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">No image</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                
                {/* Totals Row */}
                {items.length > 0 && (
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <td colSpan={2} className="px-6 py-4 text-right text-gray-900">Totals:</td>
                    <td className="px-6 py-4 text-center text-gray-900">{totalQty}</td>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-gray-900 text-red-600">₹{totalPurchase.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-900 text-green-600">₹{totalSales.toFixed(2)}</td>
                    <td className="px-6 py-4"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {items.some(item => item.image_url) && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Click "View" to see item images
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="font-medium text-yellow-800">No Items Found</h3>
              <p className="text-sm text-yellow-700 mt-1">This enquiry doesn't contain any items or the items data is incomplete.</p>
              <Link 
                href={`/enquiries/${enquiryId}/edit`}
                className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add items to this enquiry
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imageModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{imageModal.title}</h3>
              <button
                onClick={() => setImageModal({ show: false, src: "", title: "" })}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 flex items-center justify-center bg-gray-100 min-h-[300px]">
              <div className="relative max-h-[60vh] max-w-full">
                <img 
                  src={imageModal.src} 
                  alt={imageModal.title}
                  className="max-h-[60vh] max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/api/placeholder/400/300';
                    e.currentTarget.alt = 'Image not available';
                  }}
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <a
                href={imageModal.src}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Image
              </a>
              <button
                onClick={() => setImageModal({ show: false, src: "", title: "" })}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}