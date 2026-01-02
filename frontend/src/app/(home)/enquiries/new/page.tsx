"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768";

interface Customer {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
  customer_id: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
}

interface EnquiryProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  notes: string;
}

export default function NewEnquiryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<EnquiryProduct[]>([]);
  const [isNewProspect, setIsNewProspect] = useState(true);

  const [formData, setFormData] = useState({
    subject: "",
    customer_id: "",
    contact_id: "",
    sales_person_id: "",
    prospect_name: "",
    prospect_email: "",
    prospect_phone: "",
    prospect_company: "",
    source: "other",
    source_details: "",
    description: "",
    requirements: "",
    expected_value: "",
    expected_close_date: "",
    priority: "medium",
    notes: "",
  });

  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null;

  useEffect(() => {
    if (companyId) {
      fetchCustomers();
      fetchEmployees();
      fetchProducts();
    }
  }, [companyId]);

  useEffect(() => {
    if (formData.customer_id) {
      fetchContacts(formData.customer_id);
    } else {
      setContacts([]);
    }
  }, [formData.customer_id]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/customers?page_size=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        // API returns { customers: [...], total, page, page_size }
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/products?page_size=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        // API returns { products: [...], total, page, page_size }
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const fetchContacts = async (customerId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/companies/${companyId}/customers/${customerId}/contacts`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      );
      if (response.ok) {
        const data = await response.json();
        // Contacts API returns array directly
        setContacts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/employees?page_size=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        // API returns { employees: [...], total, page, page_size }
        setEmployees(data.employees || data || []);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  const addProduct = () => {
    setSelectedProducts([
      ...selectedProducts,
      { product_id: "", product_name: "", quantity: 1, notes: "" },
    ]);
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof EnquiryProduct, value: string | number) => {
    const updated = [...selectedProducts];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        product_id: value as string,
        product_name: product?.name || "",
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSelectedProducts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        ...formData,
        expected_value: parseFloat(formData.expected_value) || 0,
        expected_close_date: formData.expected_close_date || null,
        customer_id: isNewProspect ? null : formData.customer_id || null,
        contact_id: isNewProspect ? null : formData.contact_id || null,
        products_interested: selectedProducts.filter((p) => p.product_id),
      };

      const response = await fetch(`${API_BASE}/companies/${companyId}/enquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create enquiry");
      }

      const data = await response.json();
      router.push(`/enquiries/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/enquiries" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Enquiry</h1>
          <p className="text-gray-500 dark:text-gray-400">Create a new sales enquiry</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Subject */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Enquiry Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subject / Title *
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                placeholder="e.g., Enquiry for Office Furniture"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source</label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                >
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source Details
                </label>
                <input
                  type="text"
                  name="source_details"
                  value={formData.source_details}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                  placeholder="e.g., Campaign name, referrer"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                placeholder="Describe the enquiry..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requirements</label>
              <textarea
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                placeholder="Specific requirements..."
              />
            </div>
          </div>
        </div>

        {/* Customer / Prospect */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer / Prospect</h2>
          
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setIsNewProspect(true)}
              className={`px-4 py-2 rounded-lg ${
                isNewProspect
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-2 dark:text-gray-300 dark:hover:bg-dark-3"
              }`}
            >
              New Prospect
            </button>
            <button
              type="button"
              onClick={() => setIsNewProspect(false)}
              className={`px-4 py-2 rounded-lg ${
                !isNewProspect
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-2 dark:text-gray-300 dark:hover:bg-dark-3"
              }`}
            >
              Existing Customer
            </button>
          </div>

          {isNewProspect ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prospect Name
                </label>
                <input
                  type="text"
                  name="prospect_name"
                  value={formData.prospect_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  name="prospect_company"
                  value={formData.prospect_company}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  name="prospect_email"
                  value={formData.prospect_email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input
                  type="tel"
                  name="prospect_phone"
                  value={formData.prospect_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                <select
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact</label>
                <select
                  name="contact_id"
                  value={formData.contact_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                  disabled={!formData.customer_id}
                >
                  <option value="">Select contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Products of Interest */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Products of Interest</h2>
            <button
              type="button"
              onClick={addProduct}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              + Add Product
            </button>
          </div>

          {selectedProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-lg">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p>No products added yet</p>
              <p className="text-sm">Click "Add Product" to add products the customer is interested in</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedProducts.map((item, index) => (
                <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 dark:bg-dark-2 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Product
                      </label>
                      <select
                        value={item.product_id}
                        onChange={(e) => updateProduct(index, "product_id", e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateProduct(index, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateProduct(index, "notes", e.target.value)}
                        placeholder="e.g., specific color, size"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-3 dark:border-dark-3 dark:text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(index)}
                    className="mt-6 p-2 text-red-600 hover:bg-red-100 rounded-lg dark:hover:bg-red-900/30"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Values & Assignment */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Values & Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected Value (₹)
              </label>
              <input
                type="number"
                name="expected_value"
                value={formData.expected_value}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected Close Date
              </label>
              <input
                type="date"
                name="expected_close_date"
                value={formData.expected_close_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sales Person</label>
              <select
                name="sales_person_id"
                value={formData.sales_person_id}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              >
                <option value="">Select sales person...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
            placeholder="Any additional notes..."
          />
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
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Enquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}

