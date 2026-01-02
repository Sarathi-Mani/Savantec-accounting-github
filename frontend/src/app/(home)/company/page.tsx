"use client";

import { useAuth } from "@/context/AuthContext";
import { companiesApi, Company, getErrorMessage } from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CompanyProfilePage() {
  const { company, refreshCompanies, companies } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    trade_name: "",
    gstin: "",
    pan: "",
    cin: "",
    email: "",
    phone: "",
    website: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    state_code: "",
    pincode: "",
    country: "India",
    business_type: "",
    invoice_prefix: "INV",
    invoice_terms: "",
    invoice_notes: "",
  });

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || "",
        trade_name: company.trade_name || "",
        gstin: company.gstin || "",
        pan: company.pan || "",
        cin: company.cin || "",
        email: company.email || "",
        phone: company.phone || "",
        website: company.website || "",
        address_line1: company.address_line1 || "",
        address_line2: company.address_line2 || "",
        city: company.city || "",
        state: company.state || "",
        state_code: company.state_code || "",
        pincode: company.pincode || "",
        country: company.country || "India",
        business_type: company.business_type || "",
        invoice_prefix: company.invoice_prefix || "INV",
        invoice_terms: company.invoice_terms || "",
        invoice_notes: company.invoice_notes || "",
      });
      setIsCreating(false);
    } else if (companies.length === 0) {
      setIsCreating(true);
    }
  }, [company, companies]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError("Company name is required");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (isCreating) {
        await companiesApi.create(formData);
      } else if (company) {
        await companiesApi.update(company.id, formData);
      }
      await refreshCompanies();
      setSuccess(true);
      setIsEditing(false);
      setIsCreating(false);
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to save company"));
    } finally {
      setLoading(false);
    }
  };

  const isFormMode = isEditing || isCreating;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">
            {isCreating ? "Create Company" : "Company Profile"}
          </h1>
          <p className="text-sm text-dark-6">
            {isCreating ? "Set up your business profile" : "Manage your company details"}
          </p>
        </div>
        <div className="flex gap-3">
          {!isCreating && company && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-6 py-3 font-medium text-primary transition hover:bg-primary hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </button>
          )}
          {isFormMode && (
            <>
              {!isCreating && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (company) {
                      setFormData({
                        name: company.name || "",
                        trade_name: company.trade_name || "",
                        gstin: company.gstin || "",
                        pan: company.pan || "",
                        cin: company.cin || "",
                        email: company.email || "",
                        phone: company.phone || "",
                        website: company.website || "",
                        address_line1: company.address_line1 || "",
                        address_line2: company.address_line2 || "",
                        city: company.city || "",
                        state: company.state || "",
                        state_code: company.state_code || "",
                        pincode: company.pincode || "",
                        country: company.country || "India",
                        business_type: company.business_type || "",
                        invoice_prefix: company.invoice_prefix || "INV",
                        invoice_terms: company.invoice_terms || "",
                        invoice_notes: company.invoice_notes || "",
                      });
                    }
                  }}
                  className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                form="company-form"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {loading ? "Saving..." : isCreating ? "Create Company" : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          Company profile saved successfully!
        </div>
      )}

      <form id="company-form" onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Business Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="Your Company Name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Trade Name
                </label>
                <input
                  type="text"
                  name="trade_name"
                  value={formData.trade_name}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="Trade / Brand name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Business Type
                </label>
                <select
                  name="business_type"
                  value={formData.business_type}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                >
                  <option value="">Select type</option>
                  <option value="proprietorship">Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="llp">LLP</option>
                  <option value="pvt_ltd">Private Limited</option>
                  <option value="public_ltd">Public Limited</option>
                  <option value="opc">One Person Company</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  GSTIN
                </label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 uppercase outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  PAN
                </label>
                <input
                  type="text"
                  name="pan"
                  value={formData.pan}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="AAAAA0000A"
                  maxLength={10}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 uppercase outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  CIN (if applicable)
                </label>
                <input
                  type="text"
                  name="cin"
                  value={formData.cin}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="Corporate Identity Number"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Contact Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="company@example.com"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="+91 9876543210"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="https://www.example.com"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Business Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="Street address"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="Building, floor, etc."
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="City"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="State"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  State Code
                </label>
                <input
                  type="text"
                  name="state_code"
                  value={formData.state_code}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="e.g., 27 for Maharashtra"
                  maxLength={2}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="Pincode"
                  maxLength={6}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Invoice Settings</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  name="invoice_prefix"
                  value={formData.invoice_prefix}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  placeholder="INV"
                  maxLength={10}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              {company && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Next Invoice Number
                  </label>
                  <div className="rounded-lg border border-stroke bg-gray-100 px-4 py-3 dark:border-dark-3 dark:bg-dark-2">
                    {formData.invoice_prefix}-{String(company.invoice_counter + 1).padStart(5, "0")}
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Default Invoice Terms
                </label>
                <textarea
                  name="invoice_terms"
                  value={formData.invoice_terms}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  rows={3}
                  placeholder="Payment terms, late fees, etc."
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Default Invoice Notes
                </label>
                <textarea
                  name="invoice_notes"
                  value={formData.invoice_notes}
                  onChange={handleChange}
                  disabled={!isFormMode}
                  rows={3}
                  placeholder="Thank you message, bank details, etc."
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary disabled:bg-gray-100 dark:border-dark-3 dark:disabled:bg-dark-2"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          {isFormMode && (
            <div className="flex justify-end gap-4">
              {!isCreating && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (company) {
                      setFormData({
                        name: company.name || "",
                        trade_name: company.trade_name || "",
                        gstin: company.gstin || "",
                        pan: company.pan || "",
                        cin: company.cin || "",
                        email: company.email || "",
                        phone: company.phone || "",
                        website: company.website || "",
                        address_line1: company.address_line1 || "",
                        address_line2: company.address_line2 || "",
                        city: company.city || "",
                        state: company.state || "",
                        state_code: company.state_code || "",
                        pincode: company.pincode || "",
                        country: company.country || "India",
                        business_type: company.business_type || "",
                        invoice_prefix: company.invoice_prefix || "INV",
                        invoice_terms: company.invoice_terms || "",
                        invoice_notes: company.invoice_notes || "",
                      });
                    }
                  }}
                  className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                {loading ? "Saving..." : isCreating ? "Create Company" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Quick Links */}
      {!isFormMode && company && (
        <div className="mt-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h3 className="mb-4 font-semibold text-dark dark:text-white">Quick Settings</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/company/bank-accounts"
              className="flex items-center gap-3 rounded-lg border border-stroke p-4 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3"
            >
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <div>
                <p className="font-medium text-dark dark:text-white">Bank Accounts</p>
                <p className="text-xs text-dark-6">Manage payment details</p>
              </div>
            </Link>
            
            <Link
              href="/company/inventory-settings"
              className="flex items-center gap-3 rounded-lg border border-stroke p-4 transition hover:border-primary hover:bg-primary/5 dark:border-dark-3"
            >
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <div>
                <p className="font-medium text-dark dark:text-white">Inventory Settings</p>
                <p className="text-xs text-dark-6">Auto stock reduction & warehouses</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
