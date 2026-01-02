"use client";

import { useAuth } from "@/context/AuthContext";
import { customersApi, Customer, getErrorMessage } from "@/services/api";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditCustomerPage() {
  const { company } = useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    trade_name: "",
    gstin: "",
    pan: "",
    email: "",
    phone: "",
    contact_person: "",
    customer_type: "b2c",
    billing_address_line1: "",
    billing_address_line2: "",
    billing_city: "",
    billing_state: "",
    billing_state_code: "",
    billing_pincode: "",
    billing_country: "India",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_state_code: "",
    shipping_pincode: "",
    shipping_country: "India",
  });

  const [sameAsBilling, setSameAsBilling] = useState(true);

  // State codes mapping for auto-fill
  const stateCodeToName: Record<string, string> = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
  };

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!company?.id || !customerId) return;
      try {
        const customer = await customersApi.get(company.id, customerId);
        setFormData({
          name: customer.name || "",
          trade_name: customer.trade_name || "",
          gstin: customer.gstin || "",
          pan: customer.pan || "",
          email: customer.email || "",
          phone: customer.phone || "",
          contact_person: customer.contact_person || "",
          customer_type: customer.customer_type || "b2c",
          billing_address_line1: customer.billing_address_line1 || "",
          billing_address_line2: customer.billing_address_line2 || "",
          billing_city: customer.billing_city || "",
          billing_state: customer.billing_state || "",
          billing_state_code: customer.billing_state_code || "",
          billing_pincode: customer.billing_pincode || "",
          billing_country: customer.billing_country || "India",
          shipping_address_line1: customer.shipping_address_line1 || "",
          shipping_address_line2: customer.shipping_address_line2 || "",
          shipping_city: customer.shipping_city || "",
          shipping_state: customer.shipping_state || "",
          shipping_state_code: customer.shipping_state_code || "",
          shipping_pincode: customer.shipping_pincode || "",
          shipping_country: customer.shipping_country || "India",
        });
        
        // Check if shipping is same as billing
        const isSame = 
          customer.billing_address_line1 === customer.shipping_address_line1 &&
          customer.billing_city === customer.shipping_city &&
          customer.billing_state_code === customer.shipping_state_code;
        setSameAsBilling(isSame);
      } catch (error) {
        console.error("Failed to fetch customer:", error);
        setError("Failed to load customer");
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [company?.id, customerId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !customerId) return;

    if (!formData.name.trim()) {
      setError("Customer name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        ...formData,
        gstin: formData.gstin || undefined,
        pan: formData.pan || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
      };

      if (sameAsBilling) {
        data.shipping_address_line1 = data.billing_address_line1;
        data.shipping_address_line2 = data.billing_address_line2;
        data.shipping_city = data.billing_city;
        data.shipping_state = data.billing_state;
        data.shipping_state_code = data.billing_state_code;
        data.shipping_pincode = data.billing_pincode;
        data.shipping_country = data.billing_country;
      }

      await customersApi.update(company.id, customerId, data);
      router.push("/customers");
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to update customer"));
    } finally {
      setSaving(false);
    }
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Edit Customer</h1>
        <p className="text-sm text-dark-6">Update customer details</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Basic Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter customer name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
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
                  placeholder="Trade / Business name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
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
                  <option value="b2c">Consumer (B2C)</option>
                  <option value="b2b">Business (B2B)</option>
                  <option value="export">Export</option>
                  <option value="sez">SEZ</option>
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
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 uppercase outline-none focus:border-primary dark:border-dark-3"
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
                  placeholder="AAAAA0000A"
                  maxLength={10}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 uppercase outline-none focus:border-primary dark:border-dark-3"
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
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
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
                  placeholder="+91 9876543210"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  placeholder="Primary contact name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Billing Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="billing_address_line1"
                  value={formData.billing_address_line1}
                  onChange={handleChange}
                  placeholder="Street address"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="billing_address_line2"
                  value={formData.billing_address_line2}
                  onChange={handleChange}
                  placeholder="Apartment, building, etc."
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  City
                </label>
                <input
                  type="text"
                  name="billing_city"
                  value={formData.billing_city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  name="billing_state_code"
                  value={formData.billing_state_code}
                  onChange={(e) => {
                    const code = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      billing_state_code: code,
                      billing_state: stateCodeToName[code] || "",
                    }));
                  }}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="">Select State</option>
                  <option value="01">01 - Jammu & Kashmir</option>
                  <option value="02">02 - Himachal Pradesh</option>
                  <option value="03">03 - Punjab</option>
                  <option value="04">04 - Chandigarh</option>
                  <option value="05">05 - Uttarakhand</option>
                  <option value="06">06 - Haryana</option>
                  <option value="07">07 - Delhi</option>
                  <option value="08">08 - Rajasthan</option>
                  <option value="09">09 - Uttar Pradesh</option>
                  <option value="10">10 - Bihar</option>
                  <option value="11">11 - Sikkim</option>
                  <option value="12">12 - Arunachal Pradesh</option>
                  <option value="13">13 - Nagaland</option>
                  <option value="14">14 - Manipur</option>
                  <option value="15">15 - Mizoram</option>
                  <option value="16">16 - Tripura</option>
                  <option value="17">17 - Meghalaya</option>
                  <option value="18">18 - Assam</option>
                  <option value="19">19 - West Bengal</option>
                  <option value="20">20 - Jharkhand</option>
                  <option value="21">21 - Odisha</option>
                  <option value="22">22 - Chhattisgarh</option>
                  <option value="23">23 - Madhya Pradesh</option>
                  <option value="24">24 - Gujarat</option>
                  <option value="26">26 - Dadra & Nagar Haveli and Daman & Diu</option>
                  <option value="27">27 - Maharashtra</option>
                  <option value="29">29 - Karnataka</option>
                  <option value="30">30 - Goa</option>
                  <option value="31">31 - Lakshadweep</option>
                  <option value="32">32 - Kerala</option>
                  <option value="33">33 - Tamil Nadu</option>
                  <option value="34">34 - Puducherry</option>
                  <option value="35">35 - Andaman & Nicobar Islands</option>
                  <option value="36">36 - Telangana</option>
                  <option value="37">37 - Andhra Pradesh</option>
                  <option value="38">38 - Ladakh</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Pincode
                </label>
                <input
                  type="text"
                  name="billing_pincode"
                  value={formData.billing_pincode}
                  onChange={handleChange}
                  placeholder="Pincode"
                  maxLength={6}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-white">Shipping Address</h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
                />
                <span className="text-sm text-dark-6">Same as billing</span>
              </label>
            </div>
            {!sameAsBilling && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    name="shipping_address_line1"
                    value={formData.shipping_address_line1}
                    onChange={handleChange}
                    placeholder="Street address"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    name="shipping_address_line2"
                    value={formData.shipping_address_line2}
                    onChange={handleChange}
                    placeholder="Apartment, building, etc."
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    City
                  </label>
                  <input
                    type="text"
                    name="shipping_city"
                    value={formData.shipping_city}
                    onChange={handleChange}
                    placeholder="City"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    State
                  </label>
                  <select
                    name="shipping_state_code"
                    value={formData.shipping_state_code}
                    onChange={(e) => {
                      const code = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        shipping_state_code: code,
                        shipping_state: stateCodeToName[code] || "",
                      }));
                    }}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  >
                    <option value="">Select State</option>
                    <option value="01">01 - Jammu & Kashmir</option>
                    <option value="02">02 - Himachal Pradesh</option>
                    <option value="03">03 - Punjab</option>
                    <option value="04">04 - Chandigarh</option>
                    <option value="05">05 - Uttarakhand</option>
                    <option value="06">06 - Haryana</option>
                    <option value="07">07 - Delhi</option>
                    <option value="08">08 - Rajasthan</option>
                    <option value="09">09 - Uttar Pradesh</option>
                    <option value="10">10 - Bihar</option>
                    <option value="11">11 - Sikkim</option>
                    <option value="12">12 - Arunachal Pradesh</option>
                    <option value="13">13 - Nagaland</option>
                    <option value="14">14 - Manipur</option>
                    <option value="15">15 - Mizoram</option>
                    <option value="16">16 - Tripura</option>
                    <option value="17">17 - Meghalaya</option>
                    <option value="18">18 - Assam</option>
                    <option value="19">19 - West Bengal</option>
                    <option value="20">20 - Jharkhand</option>
                    <option value="21">21 - Odisha</option>
                    <option value="22">22 - Chhattisgarh</option>
                    <option value="23">23 - Madhya Pradesh</option>
                    <option value="24">24 - Gujarat</option>
                    <option value="26">26 - Dadra & Nagar Haveli and Daman & Diu</option>
                    <option value="27">27 - Maharashtra</option>
                    <option value="29">29 - Karnataka</option>
                    <option value="30">30 - Goa</option>
                    <option value="31">31 - Lakshadweep</option>
                    <option value="32">32 - Kerala</option>
                    <option value="33">33 - Tamil Nadu</option>
                    <option value="34">34 - Puducherry</option>
                    <option value="35">35 - Andaman & Nicobar Islands</option>
                    <option value="36">36 - Telangana</option>
                    <option value="37">37 - Andhra Pradesh</option>
                    <option value="38">38 - Ladakh</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="shipping_pincode"
                    value={formData.shipping_pincode}
                    onChange={handleChange}
                    placeholder="Pincode"
                    maxLength={6}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
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
              {saving ? "Saving..." : "Update Customer"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
