"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768/api";

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
  
  // Additional fields from Laravel
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
  items?: EnquiryItem[];
  pending_remarks?: string;
  quotation_no?: string;
  quotation_date?: string;
}

interface EnquiryItem {
  id?: string;
  item_id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  suitable_item?: string;
  purchase_price?: number;
  sales_price?: number;
  image?: string;
  existing_image?: string;
  custom_item?: string;
  product_name?: string; // Added for display
}

export default function EditEnquiryPage() {
  const router = useRouter();
  const params = useParams();
  const enquiryId = params.id as string;
  
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<EnquiryItem[]>([]);
  
  const [formData, setFormData] = useState({
    status: "pending",
    pending_remarks: "",
    quotation_no: "",
    quotation_date: new Date().toISOString().split("T")[0],
  });

  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null;

  useEffect(() => {
    if (companyId && enquiryId) {
      fetchEnquiry();
    }
  }, [companyId, enquiryId]);

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

    if (!response.ok) throw new Error("Failed to fetch enquiry");

    const data = await response.json();
    setEnquiry(data);
    
    // Set form data
    setFormData({
      status: data.status || "pending",
      pending_remarks: data.pending_remarks || "",
      quotation_no: data.quotation_no || "",
      quotation_date: data.quotation_date || new Date().toISOString().split("T")[0],
    });
    
    // Set items - get price data from products_interested
    // products_interested contains the price information
    if (data.products_interested && Array.isArray(data.products_interested)) {
      console.log("Products interested data:", data.products_interested);
      
      setItems(data.products_interested.map((item: any, index: number) => {
        // Try to match with items data if available
        const matchedItem = data.items && data.items[index] 
          ? data.items[index] 
          : null;
        
        return {
          id: matchedItem?.id || `item-${index}`,
          item_id: item.product_id,
          product_id: item.product_id,
          product_name: item.description || "Custom Item",
          description: item.description || "",
          quantity: item.quantity || 1,
          suitable_item: item.suitable_item || "",
          purchase_price: item.purchase_price || 0,
          sales_price: item.sales_price || 0,
          image: item.image_url,
          existing_image: item.image_url,
          notes: item.notes || `Item ${index + 1}`,
        };
      }));
    } else if (data.items && Array.isArray(data.items)) {
      // Fallback to items if products_interested doesn't exist
      console.log("No products_interested, using items data:", data.items);
      setItems(data.items.map((item: any) => ({
        id: item.id,
        item_id: item.product_id,
        product_id: item.product_id,
        product_name: item.description || "Custom Item",
        description: item.description || "",
        quantity: item.quantity || 1,
        suitable_item: "", // Default empty since not in items table
        purchase_price: 0, // Default 0 since not in items table
        sales_price: 0, // Default 0 since not in items table
        image: item.image_url,
        existing_image: item.image_url,
        notes: item.notes || "",
      })));
    } else {
      // No items found
      setItems([]);
    }
    
  } catch (err) {
    setError("Failed to load enquiry");
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  const handleItemChange = (index: number, field: keyof EnquiryItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate form
  if (!formData.status) {
    alert("Please select a status.");
    return;
  }
  
  if (items.length === 0) {
    alert("Please ensure there is at least one item.");
    return;
  }

  setSaving(true);
  setError("");

  try {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Authentication required. Please login again.");
      setSaving(false);
      return;
    }

    // Prepare the request body
    const requestBody = {
      status: formData.status,
      pending_remarks: formData.pending_remarks,
      quotation_no: formData.quotation_no,
      quotation_date: formData.quotation_date,
      items: items.map((item, index) => ({
        id: item.id || null,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        suitable_item: item.suitable_item || "",
        purchase_price: item.purchase_price || 0,
        sales_price: item.sales_price || 0,
        notes: item.description || `Item ${index + 1}`,
        existing_image: item.existing_image || null,
      })),
    };

    console.log("Sending update request with body:", JSON.stringify(requestBody, null, 2));
    console.log("URL:", `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}/edit`);

    const response = await fetch(
      `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}/edit`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log("Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText };
      }
      throw new Error(errorData.detail || `Failed to update enquiry (Status: ${response.status})`);
    }

    const data = await response.json();
    console.log("Success response:", data);
    
    alert("Enquiry updated successfully!");
    router.push(`/enquiries/${enquiryId}`);
    
  } catch (err: any) {
    console.error("Error updating enquiry:", err);
    setError(err.message || "Failed to update enquiry.");
  } finally {
    setSaving(false);
  }
};
  const handleConvertToQuotation = async () => {
    if (formData.status !== "ready_for_quotation") {
      alert('Please select "Ready for Quotation" status first.');
      return;
    }

    if (!formData.quotation_no) {
      alert("Please enter a quotation number.");
      return;
    }

    if (confirm("Are you sure you want to convert this enquiry to quotation?")) {
      try {
        const token = localStorage.getItem("access_token");
        
        // First, update the enquiry with the current data
        await handleSubmit(new Event("submit") as any);
        
        // Then, convert to quotation
        const convertResponse = await fetch(
          `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}/convert-to-quotation`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              validity_days: 30,
              notes: enquiry?.description || "",
              terms: "",
            }),
          }
        );

        if (!convertResponse.ok) {
          const data = await convertResponse.json();
          throw new Error(data.detail || `Failed to convert to quotation (Status: ${convertResponse.status})`);
        }

        const data = await convertResponse.json();
        alert("Enquiry converted to quotation successfully!");
        router.push(`/quotations/${data.quotation_id}`);
        
      } catch (err: any) {
        console.error("Error converting to quotation:", err);
        setError(err.message || "Failed to convert to quotation.");
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading enquiry...</p>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400">Enquiry not found.</p>
          <Link href="/enquiries" className="mt-2 inline-block text-indigo-600 hover:text-indigo-800">
            ← Back to Enquiries
          </Link>
        </div>
      </div>
    );
  }

  const showPrices = formData.status !== "ignored";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/enquiries" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Enquiry</h1>
          <p className="text-gray-500 dark:text-gray-400">Update enquiry details</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400 whitespace-pre-line">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Enquiry Number
            </label>
            <input
              type="text"
              value={enquiry.enquiry_number}
              readOnly
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-dark-2 dark:border-dark-3 dark:text-gray-300 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Company Information (Read Only) */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Information</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-3">
              <tbody className="divide-y divide-gray-200 dark:divide-dark-3">
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-2 w-1/4">
                    Company Name
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {enquiry.company?.name || enquiry.customer_name || enquiry.prospect_company || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-2 w-1/4">
                    Enquiry Date
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {formatDate(enquiry.enquiry_date)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-2">
                    Sales Engineer
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {enquiry.salesman?.name || enquiry.sales_person_name || "Not Assigned"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-2">
                    Kind Attn.
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {enquiry.contact_person || enquiry.prospect_name || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-2">
                    Email
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {enquiry.prospect_email || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-2">
                    Phone
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {enquiry.prospect_phone || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-2">
                    Remarks
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {enquiry.remarks || enquiry.description || "N/A"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Section */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Items</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-3">
              <thead className="bg-gray-50 dark:bg-dark-2">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Suitable Item
                  </th>
                  {showPrices && (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Purchase Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sales Price
                      </th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Image
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-dark divide-y divide-gray-200 dark:divide-dark-3">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {index + 1}
                    </td>
                    {/* Item Name - READ ONLY */}
                    <td className="px-4 py-3">
                      <div className="px-3 py-1 text-sm text-gray-900 dark:text-white min-h-[38px] flex items-center">
                        {item.product_name || item.description || "No item name"}
                      </div>
                    </td>
                    {/* Quantity - READ ONLY */}
                    <td className="px-4 py-3">
                      <div className="px-3 py-1 text-sm text-gray-900 dark:text-white min-h-[38px] flex items-center">
                        {item.quantity}
                      </div>
                    </td>
                    {/* Description - READ ONLY */}
                    <td className="px-4 py-3">
                      <div className="px-3 py-1  text-sm text-gray-900 dark:text-white min-h-[76px] flex items-start">
                        {item.description || "No description"}
                      </div>
                    </td>
                    {/* Suitable Item - EDITABLE */}
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.suitable_item || ""}
                        onChange={(e) => handleItemChange(index, "suitable_item", e.target.value)}
                        className="w-full px-3 py-1 border rounded focus:ring-1 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white text-sm"
                        placeholder="Enter suitable item..."
                      />
                    </td>
                    {/* Purchase Price - EDITABLE (only when shown) */}
                    {showPrices && (
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.purchase_price || 0}
                          onChange={(e) => handleItemChange(index, "purchase_price", parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-1 border rounded focus:ring-1 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white text-sm"
                          placeholder="0.00"
                        />
                      </td>
                    )}
                    {/* Sales Price - EDITABLE (only when shown) */}
                    {showPrices && (
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.sales_price || 0}
                          onChange={(e) => handleItemChange(index, "sales_price", parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-1 border rounded focus:ring-1 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white text-sm"
                          placeholder="0.00"
                        />
                      </td>
                    )}
                    {/* Item Image - READ ONLY */}
                    <td className="px-4 py-3">
                      <div className="text-center">
                        {item.existing_image ? (
                          <a
                            href={item.existing_image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <img
                              src={item.existing_image}
                              alt="Item"
                              className="h-16 w-16 object-cover rounded border dark:border-dark-3"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const container = (e.target as HTMLImageElement).parentElement;
                                if (container) {
                                  container.innerHTML = '<div class="text-yellow-600 text-sm"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.698-.833-2.464 0L4.342 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg> Image</div>';
                                }
                              }}
                            />
                          </a>
                        ) : (
                          <div className="text-gray-400 text-sm">
                            <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            No image
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status and Pending Remarks Section */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pending Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pending Remarks
              </label>
              {formData.status === "ready_for_purchase" ? (
                <textarea
                  value={formData.pending_remarks}
                  onChange={(e) => setFormData({ ...formData, pending_remarks: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                  placeholder="Enter pending remarks..."
                />
              ) : (
                <div className="px-4 py-2 border rounded-lg bg-gray-50 dark:bg-dark-2 dark:border-dark-3 dark:text-gray-300 min-h-[80px]">
                  {formData.pending_remarks || "No pending remarks"}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                required
              >
                <option value="ready_for_quotation">Ready for Quotation</option>
                <option value="ready_for_purchase">Ready for Purchase</option>
                <option value="ignored">Ignore Enquiry</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quotation Section (Visible only for "Ready for Quotation") */}
        {formData.status === "ready_for_quotation" && (
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quotation Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quotation Number
                </label>
                <input
                  type="text"
                  value={formData.quotation_no}
                  onChange={(e) => setFormData({ ...formData, quotation_no: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                  placeholder="e.g., QUOT-2024-001"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter quotation number (e.g., QUOT-2024-001)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quotation Date
                </label>
                <input
                  type="date"
                  value={formData.quotation_date}
                  onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                />
              </div>
            </div>
            
            {/* Convert to Quotation Button */}
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={handleConvertToQuotation}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 inline-flex"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Convert to Quotation
              </button>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t dark:border-dark-3">
          <Link
            href="/enquiries"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-dark-3 dark:text-gray-300 dark:hover:bg-dark-3"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Updating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Update Enquiry
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}