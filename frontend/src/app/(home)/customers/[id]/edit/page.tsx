"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { customersApi, getErrorMessage } from "@/services/api";

interface ContactPerson {
  id?: string;
  name: string;
  email: string;
  phone: string;
}

interface OpeningBalanceItem {
  id?: string;
  date: string;
  voucher_name: string;
  days: string;
  amount: string;
}

interface FormData {
  // Basic Info
  name: string;
  contact: string;
  email: string;
  mobile: string;
  tax_number: string;
  gst_registration_type: string;
  pan_number: string;
  vendor_code: string;
  
  // Opening Balance
  opening_balance: string;
  opening_balance_type: "outstanding" | "advance";
  opening_balance_mode: "single" | "split";
  opening_balance_split: OpeningBalanceItem[];
  
  // Additional Info
  credit_limit: string;
  credit_days: string;
  
  // Contact Persons
  contact_persons: ContactPerson[];
  
  // Billing Address
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_country: string;
  billing_zip: string;
  
  // Shipping Address
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_country: string;
  shipping_zip: string;
  
  // Customer Code
  customer_code: string;
  
  // Customer Type
  customer_type: string;
  
  // Status
  is_active: boolean;
}

const GST_REGISTRATION_TYPES = [
  "Unknown",
  "Composition",
  "Regular",
  "Unregistered/Consumer",
  "Government entity/TDS",
  "Regular - SEZ",
  "Regular-Deemed Exporter",
  "Regular-Exports (EOU)",
  "e-Commerce Operator",
  "Input Service Distributor",
  "Embassy/UN Body",
  "Non-Resident Taxpayer"
] as const;

export default function EditCustomerPage() {
  const { company } = useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [showGstOptions, setShowGstOptions] = useState(false);
  const [showOpeningBalanceSplit, setShowOpeningBalanceSplit] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    // Basic Info
    name: "",
    contact: "",
    email: "",
    mobile: "",
    tax_number: "",
    gst_registration_type: "",
    pan_number: "",
    vendor_code: "",
    
    // Opening Balance
    opening_balance: "",
    opening_balance_type: "outstanding",
    opening_balance_mode: "single",
    opening_balance_split: [],
    
    // Additional Info
    credit_limit: "",
    credit_days: "",
    
    // Contact Persons
    contact_persons: [{ name: "", email: "", phone: "" }],
    
    // Billing Address
    billing_address: "",
    billing_city: "",
    billing_state: "",
    billing_country: "India",
    billing_zip: "",
    
    // Shipping Address
    shipping_address: "",
    shipping_city: "",
    shipping_state: "",
    shipping_country: "India",
    shipping_zip: "",
    
    // Customer Code
    customer_code: "",
    
    // Customer Type
    customer_type: "b2b",
    
    // Status
    is_active: true,
  });

  // Fetch customer data on component mount
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!company?.id || !customerId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const customer = await customersApi.get(company.id, customerId);
        
        // Format opening balance split items
        const openingBalanceSplit = customer.opening_balance_items?.map(item => ({
          id: item.id,
          date: item.date || "",
          voucher_name: item.voucher_name || "",
          days: item.days ? item.days.toString() : "",
          amount: item.amount ? item.amount.toString() : ""
        })) || [];

        // Format contact persons
        const contactPersons = customer.contact_persons?.map(person => ({
          id: person.id,
          name: person.name || "",
          email: person.email || "",
          phone: person.phone || ""
        })) || [{ name: "", email: "", phone: "" }];

        // Set form data
        setFormData({
          name: customer.name || "",
          contact: customer.contact || "",
          email: customer.email || "",
          mobile: customer.mobile || "",
          tax_number: customer.tax_number || "",
          gst_registration_type: customer.gst_registration_type || "",
          pan_number: customer.pan_number || "",
          vendor_code: customer.vendor_code || "",
          
          opening_balance: customer.opening_balance?.toString() || "",
          opening_balance_type: (customer.opening_balance_type as "outstanding" | "advance") || "outstanding",
          opening_balance_mode: (customer.opening_balance_mode as "single" | "split") || "single",
          opening_balance_split: openingBalanceSplit,
          
          credit_limit: customer.credit_limit?.toString() || "",
          credit_days: customer.credit_days?.toString() || "",
          
          contact_persons: contactPersons,
          
          billing_address: customer.billing_address || "",
          billing_city: customer.billing_city || "",
          billing_state: customer.billing_state || "",
          billing_country: customer.billing_country || "India",
          billing_zip: customer.billing_zip || "",
          
          shipping_address: customer.shipping_address || "",
          shipping_city: customer.shipping_city || "",
          shipping_state: customer.shipping_state || "",
          shipping_country: customer.shipping_country || "India",
          shipping_zip: customer.shipping_zip || "",
          
          customer_code: customer.customer_code || "",
          customer_type: customer.customer_type || "b2b",
          is_active: customer.is_active !== false,
        });

        // Check if shipping is same as billing
        if (customer.shipping_address === customer.billing_address &&
            customer.shipping_city === customer.billing_city &&
            customer.shipping_state === customer.billing_state &&
            customer.shipping_country === customer.billing_country &&
            customer.shipping_zip === customer.billing_zip) {
          setSameAsBilling(true);
        }
      } catch (error) {
        console.error("Failed to fetch customer:", error);
        setError(getErrorMessage(error, "Failed to load customer data"));
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [company?.id, customerId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    setError(null);
  };

  const handleContactPersonChange = (index: number, field: keyof ContactPerson, value: string) => {
    const updatedContactPersons = [...formData.contact_persons];
    updatedContactPersons[index] = {
      ...updatedContactPersons[index],
      [field]: value
    };
    setFormData(prev => ({ ...prev, contact_persons: updatedContactPersons }));
  };

  const addContactPerson = () => {
    setFormData(prev => ({
      ...prev,
      contact_persons: [...prev.contact_persons, { name: "", email: "", phone: "" }]
    }));
  };

  const removeContactPerson = (index: number) => {
    if (formData.contact_persons.length > 1) {
      const updatedContactPersons = formData.contact_persons.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, contact_persons: updatedContactPersons }));
    }
  };

  const handleOpeningBalanceItemChange = (index: number, field: keyof OpeningBalanceItem, value: string) => {
    const updatedItems = [...formData.opening_balance_split];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setFormData(prev => ({ ...prev, opening_balance_split: updatedItems }));
    
    // Calculate total amount
    if (field === 'amount') {
      const total = updatedItems.reduce((sum, item) => {
        return sum + (parseFloat(item.amount) || 0);
      }, 0);
      setFormData(prev => ({ 
        ...prev, 
        opening_balance_split: updatedItems,
        opening_balance: total.toFixed(2)
      }));
    }
  };

  const addOpeningBalanceItem = () => {
    setFormData(prev => ({
      ...prev,
      opening_balance_split: [
        ...prev.opening_balance_split,
        { date: "", voucher_name: "", days: "", amount: "" }
      ]
    }));
  };

  const removeOpeningBalanceItem = (index: number) => {
    const updatedItems = formData.opening_balance_split.filter((_, i) => i !== index);
    const total = updatedItems.reduce((sum, item) => {
      return sum + (parseFloat(item.amount) || 0);
    }, 0);
    
    setFormData(prev => ({ 
      ...prev, 
      opening_balance_split: updatedItems,
      opening_balance: total.toFixed(2)
    }));
  };

  const copyBillingToShipping = () => {
    setFormData(prev => ({
      ...prev,
      shipping_address: prev.billing_address,
      shipping_city: prev.billing_city,
      shipping_state: prev.billing_state,
      shipping_country: prev.billing_country,
      shipping_zip: prev.billing_zip,
    }));
    setSameAsBilling(true);
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Customer name is required");
      return false;
    }

    if (!formData.contact.trim()) {
      setError("Primary contact number is required");
      return false;
    }

    // Validate contact number format
    const contactRegex = /^[0-9]{10}$/;
    if (formData.contact && !contactRegex.test(formData.contact.replace(/\D/g, ''))) {
      setError("Please enter a valid 10-digit contact number");
      return false;
    }

    // Validate email if provided
    if (formData.email && !isValidEmail(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }

    // Validate PAN number format (10 characters: 5 letters, 4 numbers, 1 letter)
    if (formData.pan_number && !isValidPAN(formData.pan_number)) {
      setError("Please enter a valid PAN number (e.g., ABCDE1234F)");
      return false;
    }

    // Validate GST number format (15 characters if provided)
    if (formData.tax_number && formData.tax_number.trim() !== "") {
      if (!isValidGST(formData.tax_number)) {
        setError("Please enter a valid 15-digit GST number");
        return false;
      }
      
      // If GST is provided, validate PAN matches GST (first 2-10 characters of GST should match PAN)
      if (formData.pan_number) {
        const gstPanPart = formData.tax_number.slice(2, 12); // Characters 3-12 in GST
        const cleanPan = formData.pan_number.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (gstPanPart !== cleanPan) {
          setError("PAN number should match the PAN part in GST number");
          return false;
        }
      }
    }

    // Validate opening balance items if in split mode
    if (formData.opening_balance_mode === "split") {
      if (formData.opening_balance_split.length === 0) {
        setError("Please add at least one opening balance item in split mode");
        return false;
      }
      
      let totalAmount = 0;
      for (const [index, item] of formData.opening_balance_split.entries()) {
        // Validate date
        if (!item.date) {
          setError(`Please select a date for item ${index + 1}`);
          return false;
        }
        
        // Validate voucher name
        if (!item.voucher_name.trim()) {
          setError(`Please enter a voucher name for item ${index + 1}`);
          return false;
        }
        
        // Validate days
        if (item.days && isNaN(parseInt(item.days))) {
          setError(`Please enter valid days for item ${index + 1}`);
          return false;
        }
        
        // Validate amount
        const amount = parseFloat(item.amount);
        if (!item.amount || isNaN(amount) || amount <= 0) {
          setError(`Please enter a valid amount for item ${index + 1}`);
          return false;
        }
        
        totalAmount += amount;
      }
      
      // Update the total opening balance from split items
      setFormData(prev => ({
        ...prev,
        opening_balance: totalAmount.toFixed(2)
      }));
    } else {
      // Single mode validation
      if (formData.opening_balance && isNaN(parseFloat(formData.opening_balance))) {
        setError("Please enter a valid opening balance amount");
        return false;
      }
    }

    // Validate contact persons emails
    for (const [index, person] of formData.contact_persons.entries()) {
      if (person.email && !isValidEmail(person.email)) {
        setError(`Please enter a valid email address for contact person ${index + 1}`);
        return false;
      }
      
      if (person.phone && !contactRegex.test(person.phone.replace(/\D/g, ''))) {
        setError(`Please enter a valid 10-digit phone number for contact person ${index + 1}`);
        return false;
      }
    }

    return true;
  };

  const isValidEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const isValidPAN = (pan: string): boolean => {
    const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return re.test(pan.toUpperCase());
  };

  const isValidGST = (gst: string): boolean => {
    const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return re.test(gst.toUpperCase());
  };

  const handleGSTTypeSelect = (type: string) => {
    setFormData(prev => ({ ...prev, gst_registration_type: type }));
    setShowGstOptions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!company?.id || !customerId) {
      setError("Company or customer not found");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Prepare data for API
      const apiData: any = {
        name: formData.name,
        contact: formData.contact,
        email: formData.email || "",
        mobile: formData.mobile || "",
        tax_number: formData.tax_number || "",
        gst_registration_type: formData.gst_registration_type || "",
        pan_number: formData.pan_number || "",
        vendor_code: formData.vendor_code || "",
        customer_code: formData.customer_code || "",
        customer_type: formData.customer_type || "b2b",
        is_active: formData.is_active,
        
        // Convert numeric fields to strings
        opening_balance: formData.opening_balance ? String(parseFloat(formData.opening_balance)) : "0",
        credit_limit: formData.credit_limit ? String(parseFloat(formData.credit_limit)) : "0",
        credit_days: formData.credit_days ? String(parseInt(formData.credit_days)) : "0",
        
        opening_balance_type: formData.opening_balance_type || "",
        opening_balance_mode: formData.opening_balance_mode || "",
        
        // For opening_balance_split - also convert to strings
        opening_balance_split: formData.opening_balance_mode === "split" ? 
          formData.opening_balance_split.map(item => ({
            id: item.id, // Include id for existing items
            date: item.date,
            voucher_name: item.voucher_name,
            days: item.days ? String(parseInt(item.days)) : "0",
            amount: String(parseFloat(item.amount))
          })) : [],
        
        // Contact persons
        contact_persons: formData.contact_persons
          .filter(p => p.name.trim() || p.email.trim() || p.phone.trim())
          .map(p => ({
            id: p.id, // Include id for existing persons
            name: p.name || "",
            email: p.email || "",
            phone: p.phone || ""
          })),
        
        // Address fields
        billing_address: formData.billing_address || "",
        billing_city: formData.billing_city || "",
        billing_state: formData.billing_state || "",
        billing_country: formData.billing_country || "India",
        billing_zip: formData.billing_zip || "",
        
        shipping_address: sameAsBilling ? formData.billing_address : (formData.shipping_address || ""),
        shipping_city: sameAsBilling ? formData.billing_city : (formData.shipping_city || ""),
        shipping_state: sameAsBilling ? formData.billing_state : (formData.shipping_state || ""),
        shipping_country: sameAsBilling ? formData.billing_country : (formData.shipping_country || "India"),
        shipping_zip: sameAsBilling ? formData.billing_zip : (formData.shipping_zip || ""),
      };
      
      console.log("=== DEBUG: Update Data Being Sent ===");
      console.log(JSON.stringify(apiData, null, 2));
      
      await customersApi.update(company.id, customerId, apiData);
    
      router.push("/customers");
    } catch (error: any) {
      console.error("=== DEBUG: API Error Details ===");
      console.error("Full error:", error);
      console.error("Error response:", error.response?.data);
      setError(getErrorMessage(error, "Failed to update customer"));
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalOpeningBalance = () => {
    if (formData.opening_balance_mode === "split") {
      return formData.opening_balance_split.reduce((sum, item) => {
        return sum + (parseFloat(item.amount) || 0);
      }, 0);
    }
    return parseFloat(formData.opening_balance) || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  if (!customerId) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Customer not found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Edit Customer</h1>
          <p className="text-sm text-dark-6">Update customer information</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/customers")}
          className="inline-flex items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          <span>←</span> Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Customer Code and Status */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Customer Identification</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Customer Code
                  </label>
                  <input
                    type="text"
                    name="customer_code"
                    value={formData.customer_code}
                    onChange={handleChange}
                    placeholder="Enter customer code"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Status</h2>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary dark:border-dark-3"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm font-medium text-dark dark:text-white">
                    Active Customer
                  </label>
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Customer Type
                  </label>
                  <select
                    name="customer_type"
                    value={formData.customer_type}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  >
                    <option value="b2b">Business (B2B)</option>
                    <option value="b2c">Consumer (B2C)</option>
                    <option value="export">Export</option>
                    <option value="sez">SEZ</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column - Basic Info */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter customer name"
                    required
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      Primary Contact <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contact"
                      value={formData.contact}
                      onChange={handleChange}
                      placeholder="Enter contact number"
                      required
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      Primary Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter email address"
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      Mobile
                    </label>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleChange}
                      placeholder="Enter mobile number"
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      Vendor Code
                    </label>
                    <input
                      type="text"
                      name="vendor_code"
                      value={formData.vendor_code}
                      onChange={handleChange}
                      placeholder="Enter vendor code"
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Additional Info */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Tax & Financial Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    name="pan_number"
                    value={formData.pan_number}
                    onChange={handleChange}
                    placeholder="Enter PAN number (e.g., ABCDE1234F)"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    GST Number
                  </label>
                  <input
                    type="text"
                    name="tax_number"
                    value={formData.tax_number}
                    onChange={handleChange}
                    placeholder="Enter 15-digit GST number"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                    maxLength={15}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div className="relative">
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    GST Registration Type
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.gst_registration_type}
                      onClick={() => setShowGstOptions(!showGstOptions)}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, gst_registration_type: e.target.value }));
                        setShowGstOptions(true);
                      }}
                      placeholder="Select GST registration type"
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 pr-10 outline-none focus:border-primary dark:border-dark-3"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGstOptions(!showGstOptions)}
                      className="absolute right-3 top-3 text-gray-500"
                    >
                      ▼
                    </button>
                    
                    {showGstOptions && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-stroke bg-white shadow-lg dark:border-dark-3 dark:bg-gray-dark">
                        {GST_REGISTRATION_TYPES.filter(type => 
                          type.toLowerCase().includes(formData.gst_registration_type.toLowerCase())
                        ).map((type) => (
                          <div
                            key={type}
                            onClick={() => handleGSTTypeSelect(type)}
                            className="cursor-pointer px-4 py-3 hover:bg-gray-100 dark:hover:bg-dark-3"
                          >
                            {type}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opening Balance Section */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Opening Balance</h2>
          
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Opening Balance Mode
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="opening_balance_mode"
                      value="single"
                      checked={formData.opening_balance_mode === "single"}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    Single Amount
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="opening_balance_mode"
                      value="split"
                      checked={formData.opening_balance_mode === "split"}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    Bill-wise Split
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Balance Type
                </label>
                <select
                  name="opening_balance_type"
                  value={formData.opening_balance_type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="outstanding">Outstanding (Customer Owes)</option>
                  <option value="advance">Advance (You Owe Customer)</option>
                </select>
              </div>
            </div>

            {formData.opening_balance_mode === "single" ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Opening Balance Amount
                </label>
                <input
                  type="number"
                  name="opening_balance"
                  value={formData.opening_balance}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium text-dark dark:text-white">Bill-wise Opening Balance Items</h3>
                  <button
                    type="button"
                    onClick={addOpeningBalanceItem}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
                  >
                    <span>+</span> Add Item
                  </button>
                </div>

                {formData.opening_balance_split.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stroke p-8 text-center dark:border-dark-3">
                    <p className="text-dark-6">No opening balance items added</p>
                    <button
                      type="button"
                      onClick={addOpeningBalanceItem}
                      className="mt-2 inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <span>+</span> Add your first item
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.opening_balance_split.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-stroke p-4 transition hover:border-primary dark:border-dark-3"
                      >
                        <div className="grid items-center gap-4 md:grid-cols-12">
                          <div className="md:col-span-11">
                            <div className="grid gap-4 sm:grid-cols-4">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                                  {index === 0 ? "Date" : ""}
                                </label>
                                <input
                                  type="date"
                                  value={item.date}
                                  onChange={(e) => handleOpeningBalanceItemChange(index, "date", e.target.value)}
                                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-dark-3"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                                  {index === 0 ? "Voucher Name" : ""}
                                </label>
                                <input
                                  type="text"
                                  value={item.voucher_name}
                                  onChange={(e) => handleOpeningBalanceItemChange(index, "voucher_name", e.target.value)}
                                  placeholder="Enter voucher name"
                                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-dark-3"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                                  {index === 0 ? "Days" : ""}
                                </label>
                                <input
                                  type="number"
                                  value={item.days}
                                  onChange={(e) => handleOpeningBalanceItemChange(index, "days", e.target.value)}
                                  placeholder="Enter days"
                                  min="0"
                                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-dark-3"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                                  {index === 0 ? "Amount" : ""}
                                </label>
                                <input
                                  type="number"
                                  value={item.amount}
                                  onChange={(e) => handleOpeningBalanceItemChange(index, "amount", e.target.value)}
                                  placeholder="0.00"
                                  step="0.01"
                                  min="0"
                                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-dark-3"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-1 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => removeOpeningBalanceItem(index)}
                              className="rounded-lg bg-red-500 p-2 text-white transition hover:bg-red-600"
                            >
                              <span>−</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-dark-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-dark dark:text-white">Total Opening Balance:</span>
                    <span className="text-lg font-semibold text-primary">
                      ₹{calculateTotalOpeningBalance().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column - Credit Info */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Credit Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    name="credit_limit"
                    value={formData.credit_limit}
                    onChange={handleChange}
                    placeholder="Enter credit limit"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Credit Days */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Payment Terms</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Credit Days
                  </label>
                  <input
                    type="number"
                    name="credit_days"
                    value={formData.credit_days}
                    onChange={handleChange}
                    placeholder="Enter credit days"
                    min="0"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Persons Section */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark dark:text-white">Contact Persons</h2>
            <button
              type="button"
              onClick={addContactPerson}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
            >
              <span>+</span> Add Contact Person
            </button>
          </div>

          <div className="space-y-4">
            {formData.contact_persons.map((person, index) => (
              <div
                key={index}
                className="rounded-lg border border-stroke p-4 transition hover:border-primary dark:border-dark-3"
              >
                <div className="grid items-center gap-4 md:grid-cols-12">
                  <div className="md:col-span-11">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                          {index === 0 ? "Name" : ""}
                        </label>
                        <input
                          type="text"
                          value={person.name}
                          onChange={(e) => handleContactPersonChange(index, "name", e.target.value)}
                          placeholder="Enter contact person name"
                          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                          {index === 0 ? "Email" : ""}
                        </label>
                        <input
                          type="email"
                          value={person.email}
                          onChange={(e) => handleContactPersonChange(index, "email", e.target.value)}
                          placeholder="Enter email address"
                          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                          {index === 0 ? "Phone" : ""}
                        </label>
                        <input
                          type="tel"
                          value={person.phone}
                          onChange={(e) => handleContactPersonChange(index, "phone", e.target.value)}
                          placeholder="Enter phone number"
                          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-1 flex items-center justify-center">
                    {formData.contact_persons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContactPerson(index)}
                        className="rounded-lg bg-red-500 p-2 text-white transition hover:bg-red-600"
                      >
                        <span>−</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Billing Address */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Billing Address</h2>
          
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Address
              </label>
              <textarea
                name="billing_address"
                value={formData.billing_address}
                onChange={handleChange}
                placeholder="Enter billing address"
                rows={2}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  City
                </label>
                <input
                  type="text"
                  name="billing_city"
                  value={formData.billing_city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  State
                </label>
                <input
                  type="text"
                  name="billing_state"
                  value={formData.billing_state}
                  onChange={handleChange}
                  placeholder="Enter state"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Country
                </label>
                <input
                  type="text"
                  name="billing_country"
                  value={formData.billing_country}
                  onChange={handleChange}
                  placeholder="Enter country"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Pincode
                </label>
                <input
                  type="text"
                  name="billing_zip"
                  value={formData.billing_zip}
                  onChange={handleChange}
                  placeholder="Enter pincode"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark dark:text-white">Shipping Address</h2>
            <button
              type="button"
              onClick={copyBillingToShipping}
              className="inline-flex items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Copy from Billing
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Address
              </label>
              <textarea
                name="shipping_address"
                value={formData.shipping_address}
                onChange={handleChange}
                placeholder="Enter shipping address"
                rows={2}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  City
                </label>
                <input
                  type="text"
                  name="shipping_city"
                  value={formData.shipping_city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  State
                </label>
                <input
                  type="text"
                  name="shipping_state"
                  value={formData.shipping_state}
                  onChange={handleChange}
                  placeholder="Enter state"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Country
                </label>
                <input
                  type="text"
                  name="shipping_country"
                  value={formData.shipping_country}
                  onChange={handleChange}
                  placeholder="Enter country"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Pincode
                </label>
                <input
                  type="text"
                  name="shipping_zip"
                  value={formData.shipping_zip}
                  onChange={handleChange}
                  placeholder="Enter pincode"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {saving ? "Updating..." : "Update Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}