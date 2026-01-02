"use client";

import { useAuth } from "@/context/AuthContext";
import { customersApi, productsApi, Customer, Product } from "@/services/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface QuotationItem {
  product_id?: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  gst_rate: number;
}

export default function NewQuotationPage() {
  const { company } = useAuth();
  const router = useRouter();
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState({
    customer_id: "",
    quotation_date: new Date().toISOString().split("T")[0],
    validity_days: 30,
    place_of_supply: company?.state_code || "",
    subject: "",
    notes: "",
    terms: company?.invoice_terms || "",
  });

  const isInterState =
    formData.place_of_supply &&
    company?.state_code &&
    formData.place_of_supply !== company.state_code;

  const [items, setItems] = useState<QuotationItem[]>([
    { description: "", hsn_code: "", quantity: 1, unit: "unit", unit_price: 0, discount_percent: 0, gst_rate: 18 },
  ]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) return;
      try {
        const [customersData, productsData] = await Promise.all([
          customersApi.list(company.id, { page_size: 100 }),
          productsApi.list(company.id, { page_size: 100 }),
        ]);
        setCustomers(customersData.customers);
        setProducts(productsData.products);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, [company?.id]);

  const addItem = () => {
    setItems([...items, { description: "", hsn_code: "", quantity: 1, unit: "unit", unit_price: 0, discount_percent: 0, gst_rate: 18 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product_id: product.id,
        description: product.name,
        hsn_code: product.hsn_code || "",
        unit: product.unit,
        unit_price: product.unit_price,
        gst_rate: parseInt(product.gst_rate),
      };
      setItems(newItems);
    }
  };

  const calculateItemTotal = (item: QuotationItem) => {
    const baseAmount = item.quantity * item.unit_price;
    const discountAmount = (baseAmount * item.discount_percent) / 100;
    const taxableAmount = baseAmount - discountAmount;
    const gstAmount = (taxableAmount * item.gst_rate) / 100;
    return taxableAmount + gstAmount;
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach((item) => {
      const baseAmount = item.quantity * item.unit_price;
      const discountAmount = (baseAmount * item.discount_percent) / 100;
      const taxableAmount = baseAmount - discountAmount;
      const gstAmount = (taxableAmount * item.gst_rate) / 100;

      subtotal += taxableAmount;
      totalDiscount += discountAmount;

      if (isInterState) {
        totalIgst += gstAmount;
      } else {
        totalCgst += gstAmount / 2;
        totalSgst += gstAmount / 2;
      }
    });

    return {
      subtotal,
      totalDiscount,
      totalCgst,
      totalSgst,
      totalIgst,
      total: subtotal + (isInterState ? totalIgst : totalCgst + totalSgst),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!company?.id || !token) return;

    const validItems = items.filter((item) => item.description && item.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one item with description and quantity");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/quotations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            items: validItems,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        router.push(`/quotations/${data.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to create quotation");
      }
    } catch (err) {
      setError("Failed to create quotation");
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">New Quotation</h1>
        <p className="text-sm text-dark-6">Create a quotation for your customer</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Basic Information</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Customer</label>
              <select
                value={formData.customer_id}
                onChange={(e) => {
                  setFormData({ ...formData, customer_id: e.target.value });
                  const customer = customers.find((c) => c.id === e.target.value);
                  if (customer?.billing_state_code) {
                    setFormData((prev) => ({
                      ...prev,
                      customer_id: e.target.value,
                      place_of_supply: customer.billing_state_code || "",
                    }));
                  }
                }}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Quotation Date</label>
              <input
                type="date"
                value={formData.quotation_date}
                onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Valid For (Days)</label>
              <input
                type="number"
                value={formData.validity_days}
                onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) || 30 })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                min={1}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Subject / Title</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Quotation for Office Furniture"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark dark:text-white">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Product</th>
                  <th className="px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Description</th>
                  <th className="w-20 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">HSN</th>
                  <th className="w-20 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Qty</th>
                  <th className="w-24 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Rate</th>
                  <th className="w-20 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Disc %</th>
                  <th className="w-20 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">GST %</th>
                  <th className="w-28 px-2 py-3 text-right text-sm font-medium text-dark dark:text-white">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-stroke dark:border-dark-3">
                    <td className="px-2 py-2">
                      <select
                        value={item.product_id || ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            selectProduct(index, e.target.value);
                          }
                        }}
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      >
                        <option value="">Select</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        placeholder="Item description"
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.hsn_code}
                        onChange={(e) => updateItem(index, "hsn_code", e.target.value)}
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.discount_percent}
                        onChange={(e) => updateItem(index, "discount_percent", parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={item.gst_rate}
                        onChange={(e) => updateItem(index, "gst_rate", parseInt(e.target.value))}
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-dark dark:text-white">
                      {formatCurrency(calculateItemTotal(item))}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded p-1 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={items.length === 1}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-6">Subtotal:</span>
                <span className="font-medium text-dark dark:text-white">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(totals.totalDiscount)}</span>
                </div>
              )}
              {isInterState ? (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">IGST:</span>
                  <span className="font-medium text-dark dark:text-white">{formatCurrency(totals.totalIgst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">CGST:</span>
                    <span className="font-medium text-dark dark:text-white">{formatCurrency(totals.totalCgst)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">SGST:</span>
                    <span className="font-medium text-dark dark:text-white">{formatCurrency(totals.totalSgst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-stroke pt-2 dark:border-dark-3">
                <span className="font-semibold text-dark dark:text-white">Total:</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes and Terms */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="Additional notes for the customer..."
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
            />
          </div>
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Terms & Conditions</label>
            <textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              rows={4}
              placeholder="Terms and conditions..."
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Create Quotation
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

