"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { companiesApi, productsApi, getErrorMessage } from "@/services/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768";

interface Company {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  image?: string;
}

interface EnquiryItem {
  product_id: string;
  description: string;
  quantity: number;
  image: File | null;
  existing_image_url?: string;
}

export default function NewEnquiryPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [enquiryItems, setEnquiryItems] = useState<EnquiryItem[]>([
    {
      product_id: "",
      description: "",
      quantity: 1,
      image: null,
    },
  ]);

  const [formData, setFormData] = useState({
    enquiry_no: "",
    enquiry_date: new Date().toISOString().split("T")[0],
    company_id: "",
    kind_attn: "",
    mail_id: "",
    phone_no: "",
    remarks: "",
    salesman_id: "", // Will be set based on user role
    status: "pending",
  });

  useEffect(() => {
    // Generate suggested enquiry number
    const suggestedNumber = `ENQ-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")}`;
    setFormData((prev) => ({ ...prev, enquiry_no: suggestedNumber }));
    
    // Fetch data
    fetchCompanies();
    if (company?.id) {
      fetchProducts();
    }
  }, [company?.id]);

  const fetchCompanies = async () => {
    try {
      console.log("Fetching companies...");
      const data = await companiesApi.list();
      console.log("Companies data:", data);
      setCompanies(data || []);
    } catch (err: any) {
      console.error("Failed to fetch companies:", err);
      setError(getErrorMessage(err, "Failed to load companies"));
    }
  };

  const fetchProducts = async () => {
    if (!company?.id) return;
    
    try {
      console.log("Fetching products for company:", company.id);
      const response = await productsApi.list(company.id, { page_size: 100 });
      console.log("Products response:", response);
      setProducts(response.products || []);
    } catch (err: any) {
      console.error("Failed to fetch products:", err);
      setError(getErrorMessage(err, "Failed to load products"));
    }
  };

  const addItem = () => {
    setEnquiryItems([
      ...enquiryItems,
      {
        product_id: "",
        description: "",
        quantity: 1,
        image: null,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (enquiryItems.length <= 1) {
      alert("At least one item is required.");
      return;
    }
    setEnquiryItems(enquiryItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof EnquiryItem, value: string | number | File | null) => {
    const updated = [...enquiryItems];
    
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        product_id: value as string,
        description: product?.description || product?.name || updated[index].description,
        existing_image_url: product?.image || undefined,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setEnquiryItems(updated);
  };

  const handleImageUpload = (index: number, file: File) => {
    updateItem(index, "image", file);
  };

  const removeUploadedImage = (index: number) => {
    updateItem(index, "image", null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate form
    if (!formData.company_id) {
      setError("Please select a company.");
      setLoading(false);
      return;
    }

    let hasValidItem = false;
    const itemErrors: string[] = [];

    enquiryItems.forEach((item, index) => {
      const itemNumber = index + 1;
      
      if (!item.product_id && !item.description) {
        itemErrors.push(`Item ${itemNumber}: Please select an item or enter description`);
      } else {
        hasValidItem = true;
      }

      if (!item.description.trim()) {
        itemErrors.push(`Item ${itemNumber}: Description is required`);
      }

      if (!item.quantity || item.quantity < 1) {
        itemErrors.push(`Item ${itemNumber}: Quantity must be at least 1`);
      }
    });

    if (!hasValidItem) {
      setError("Please add at least one valid item.");
      setLoading(false);
      return;
    }

    if (itemErrors.length > 0) {
      setError("Please fix the following errors:\n\n" + itemErrors.join("\n"));
      setLoading(false);
      return;
    }

   try {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Authentication required. Please login again.");
      setLoading(false);
      return;
    }

    const formDataToSend = new FormData();
    
    // Append basic form data (match the form field names in the API)
    formDataToSend.append("enquiry_no", formData.enquiry_no);
    formDataToSend.append("enquiry_date", formData.enquiry_date);
    formDataToSend.append("company_id_form", formData.company_id); // Note: changed from company_id
    formDataToSend.append("kind_attn", formData.kind_attn || "");
    formDataToSend.append("mail_id", formData.mail_id || "");
    formDataToSend.append("phone_no", formData.phone_no || "");
    formDataToSend.append("remarks", formData.remarks || "");
    formDataToSend.append("salesman_id", formData.salesman_id || "");
    formDataToSend.append("status", formData.status);

    // Prepare items data
    const itemsData = enquiryItems.map((item, index) => ({
      product_id: item.product_id || "",
      description: item.description,
      quantity: item.quantity,
      notes: `Item ${index + 1}`,
      // Include product name for reference
      product_name: products.find(p => p.id === item.product_id)?.name || ""
    }));
    formDataToSend.append("items", JSON.stringify(itemsData));

    // Append image files
    enquiryItems.forEach((item, index) => {
      if (item.image) {
        formDataToSend.append("files", item.image);
      }
    });

    // Use the new formdata endpoint
    const response = await fetch(
      `${API_BASE}/api/companies/${company?.id}/enquiries/formdata`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - let browser set it with boundary
        },
        body: formDataToSend,
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || `Failed to create enquiry (Status: ${response.status})`);
    }

    const data = await response.json();
    alert("Enquiry created successfully!");
    router.push(`/enquiries`);
  } catch (err: any) {
    console.error("Error creating enquiry:", err);
    setError(err.message || "Failed to create enquiry.");
  } finally {
    setLoading(false);
  }

  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!company) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <p className="text-yellow-800 dark:text-yellow-400">Please select a company first.</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Enquiry</h1>
          <p className="text-gray-500 dark:text-gray-400">Create a new sales enquiry</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400 whitespace-pre-line">{error}</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-2">
            Note: You might need to create the enquiries endpoint in your backend.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information Section */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enquiry Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="enquiry_no"
                value={formData.enquiry_no}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                placeholder="e.g., ENQ-2024-0001"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="enquiry_date"
                value={formData.enquiry_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Company Information Section */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <select
                name="company_id"
                value={formData.company_id}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kind Attn.
                </label>
                <input
                  type="text"
                  name="kind_attn"
                  value={formData.kind_attn}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                  placeholder="Person Name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mail-ID
                </label>
                <input
                  type="email"
                  name="mail_id"
                  value={formData.mail_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                  placeholder="Email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone No
                </label>
                <input
                  type="tel"
                  name="phone_no"
                  value={formData.phone_no}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                  placeholder="Phone Number"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Remarks
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                placeholder="Additional remarks..."
              />
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>
          </div>

          <div className="space-y-6">
            {enquiryItems.map((item, index) => (
              <div key={index} className="border p-4 rounded-lg bg-gray-50 dark:bg-dark-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-primary font-medium dark:text-white">
                    Item <span className="item-number">{index + 1}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 text-sm flex items-center gap-1"
                    disabled={enquiryItems.length <= 1}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Select Product
                        </label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItem(index, "product_id", e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                        >
                          <option value="">Select Product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} {product.sku ? `(${product.sku})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                          placeholder="Item description..."
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Qty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        min="1"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                        placeholder="Qty"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Image
                      </label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="file"
                            id={`item_image_${index}`}
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleImageUpload(index, e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById(`item_image_${index}`)?.click()}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-dark-3 dark:text-gray-300 dark:hover:bg-dark-3 text-sm flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Pick Image
                          </button>
                          {item.image && (
                            <button
                              type="button"
                              onClick={() => removeUploadedImage(index)}
                              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        
                        <div className="mt-2 space-y-2">
                          {item.existing_image_url && (
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Existing Product Image:</p>
                              <img
                                src={item.existing_image_url}
                                alt="Existing Product"
                                className="max-w-full h-auto max-h-32 border border-gray-200 dark:border-gray-700 rounded"
                              />
                            </div>
                          )}
                          
                          {item.image && (
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Uploaded Image Preview:</p>
                              <img
                                src={URL.createObjectURL(item.image)}
                                alt="Uploaded Preview"
                                className="max-w-full h-auto max-h-32 border border-gray-200 dark:border-gray-700 rounded"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link
            href="/enquiries"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-dark-3 dark:text-gray-300 dark:hover:bg-dark-3"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Enquiry
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}