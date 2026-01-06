"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { customersApi, getErrorMessage } from "@/services/api";

interface ContactPerson {
  name: string;
  email: string;
  phone: string;
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

export default function CreateCustomerPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [showGstOptions, setShowGstOptions] = useState(false);

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
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

    // Validate opening balance is a valid number if provided
    if (formData.opening_balance && isNaN(parseFloat(formData.opening_balance))) {
      setError("Please enter a valid opening balance amount");
      return false;
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
    
    if (!company?.id) {
      setError("Please select a company first");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare data for API
      const apiData = {
        name: formData.name,
        contact: formData.contact,
        email: formData.email || undefined,
        mobile: formData.mobile || undefined,
        tax_number: formData.tax_number || undefined,
        gst_registration_type: formData.gst_registration_type || undefined,
        pan_number: formData.pan_number || undefined,
        vendor_code: formData.vendor_code || undefined,
        opening_balance: formData.opening_balance ? parseFloat(formData.opening_balance) : undefined,
        opening_balance_type: formData.opening_balance_type || undefined,
        credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
        credit_days: formData.credit_days ? parseInt(formData.credit_days) : undefined,
        contact_persons: formData.contact_persons.filter(p => p.name.trim() || p.email.trim() || p.phone.trim()),
        billing_address: formData.billing_address || undefined,
        billing_city: formData.billing_city || undefined,
        billing_state: formData.billing_state || undefined,
        billing_country: formData.billing_country,
        billing_zip: formData.billing_zip || undefined,
        shipping_address: sameAsBilling ? formData.billing_address : (formData.shipping_address || undefined),
        shipping_city: sameAsBilling ? formData.billing_city : (formData.shipping_city || undefined),
        shipping_state: sameAsBilling ? formData.billing_state : (formData.shipping_state || undefined),
        shipping_country: sameAsBilling ? formData.billing_country : formData.shipping_country,
        shipping_zip: sameAsBilling ? formData.billing_zip : (formData.shipping_zip || undefined),
      };

      await customersApi.create(company.id, apiData);
      router.push("/customers");
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to create customer"));
    } finally {
      setLoading(false);
    }
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Create New Customer</h1>
          <p className="text-sm text-dark-6">Add a new customer to your business</p>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      Opening Balance
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
              </div>
            </div>
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

        {/* Shipping Address - Only show if shipping is enabled */}
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
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}