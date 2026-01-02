"use client";

import { useAuth } from "@/context/AuthContext";
import { customersApi, productsApi, inventoryApi, Customer, Product, Godown } from "@/services/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface DCItem {
  product_id?: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  godown_id?: string;
}

export default function NewDeliveryChallanPage() {
  const { company } = useAuth();
  const router = useRouter();
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const searchParams = useSearchParams();
  const dcType = searchParams.get("type") || "dc_out";
  const invoiceId = searchParams.get("invoice_id");

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);

  const [formData, setFormData] = useState({
    customer_id: "",
    dc_date: new Date().toISOString().split("T")[0],
    from_godown_id: "",
    to_godown_id: "",
    transporter_name: "",
    vehicle_number: "",
    eway_bill_number: "",
    return_reason: "",
    notes: "",
    auto_update_stock: true,
  });

  const [items, setItems] = useState<DCItem[]>([
    { description: "", hsn_code: "", quantity: 1, unit: "unit", unit_price: 0 },
  ]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) return;
      try {
        const [customersData, productsData, godownsData] = await Promise.all([
          customersApi.list(company.id, { page_size: 100 }),
          productsApi.list(company.id, { page_size: 100 }),
          inventoryApi.listGodowns(company.id),
        ]);
        setCustomers(customersData.customers);
        setProducts(productsData.products);
        setGodowns(godownsData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, [company?.id]);

  const addItem = () => {
    setItems([...items, { description: "", hsn_code: "", quantity: 1, unit: "unit", unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof DCItem, value: any) => {
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
      };
      setItems(newItems);
    }
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
      const endpoint = dcType === "dc_out" ? "dc-out" : "dc-in";
      const body: any = {
        ...formData,
        items: validItems,
      };

      if (invoiceId) {
        body.invoice_id = invoiceId;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/delivery-challans/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const data = await response.json();
        router.push(`/delivery-challans/${data.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to create delivery challan");
      }
    } catch (err) {
      setError("Failed to create delivery challan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          New {dcType === "dc_out" ? "DC Out (Dispatch)" : "DC In (Return)"}
        </h1>
        <p className="text-sm text-dark-6">
          {dcType === "dc_out"
            ? "Create a delivery challan for goods dispatch"
            : "Create a delivery challan for goods return"}
        </p>
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
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
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
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">DC Date</label>
              <input
                type="date"
                value={formData.dc_date}
                onChange={(e) => setFormData({ ...formData, dc_date: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                required
              />
            </div>

            {dcType === "dc_out" ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">From Godown</label>
                <select
                  value={formData.from_godown_id}
                  onChange={(e) => setFormData({ ...formData, from_godown_id: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="">Select Godown</option>
                  {godowns.map((godown) => (
                    <option key={godown.id} value={godown.id}>
                      {godown.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">To Godown</label>
                <select
                  value={formData.to_godown_id}
                  onChange={(e) => setFormData({ ...formData, to_godown_id: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="">Select Godown</option>
                  {godowns.map((godown) => (
                    <option key={godown.id} value={godown.id}>
                      {godown.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Transport Details (for DC Out) */}
        {dcType === "dc_out" && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Transport Details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Transporter Name</label>
                <input
                  type="text"
                  value={formData.transporter_name}
                  onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                  placeholder="Transport company name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Vehicle Number</label>
                <input
                  type="text"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  placeholder="e.g., MH12AB1234"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">E-Way Bill Number</label>
                <input
                  type="text"
                  value={formData.eway_bill_number}
                  onChange={(e) => setFormData({ ...formData, eway_bill_number: e.target.value })}
                  placeholder="For goods > ₹50,000"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>
          </div>
        )}

        {/* Return Reason (for DC In) */}
        {dcType === "dc_in" && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Return Details</h2>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Return Reason</label>
              <textarea
                value={formData.return_reason}
                onChange={(e) => setFormData({ ...formData, return_reason: e.target.value })}
                rows={2}
                placeholder="Reason for goods return..."
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
              />
            </div>
          </div>
        )}

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
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Product</th>
                  <th className="px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Description</th>
                  <th className="w-20 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">HSN</th>
                  <th className="w-24 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Qty</th>
                  <th className="w-20 px-2 py-3 text-left text-sm font-medium text-dark dark:text-white">Unit</th>
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
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                      />
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
        </div>

        {/* Stock Update Option */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.auto_update_stock}
              onChange={(e) => setFormData({ ...formData, auto_update_stock: e.target.checked })}
              className="h-5 w-5 rounded border-stroke text-primary focus:ring-primary dark:border-dark-3"
            />
            <span className="text-dark dark:text-white">
              Automatically update stock on creation
            </span>
          </label>
          <p className="mt-1 text-xs text-dark-6">
            {dcType === "dc_out"
              ? "Stock will be reduced when this DC is created"
              : "Stock will be increased when this DC is created"}
          </p>
        </div>

        {/* Notes */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Additional notes..."
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
          />
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
                Create {dcType === "dc_out" ? "DC Out" : "DC In"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

