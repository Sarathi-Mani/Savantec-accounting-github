"use client";

import { useAuth } from "@/context/AuthContext";
import { ordersApi, vendorsApi, productsApi, PurchaseOrder, Customer, Product, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface OrderItemForm {
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
}

export default function EditPurchaseOrderPage() {
  const { company } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  
  const [vendors, setVendors] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>("draft");

  // Form state
  const [formData, setFormData] = useState({
    vendor_id: "",
    order_date: dayjs().format("YYYY-MM-DD"),
    expected_date: "",
    notes: "",
    terms: "",
  });
  const [items, setItems] = useState<OrderItemForm[]>([
    { description: "", quantity: 1, unit: "Nos", rate: 0, gst_rate: 18 },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id || !orderId) {
        setInitialLoading(false);
        return;
      }

      try {
        const [orderData, vendorsData, productsData] = await Promise.all([
          ordersApi.getPurchaseOrder(company.id, orderId),
          vendorsApi.list(company.id, { page_size: 100 }),
          productsApi.list(company.id, { page_size: 100 }),
        ]);
        
        setVendors(vendorsData.customers);
        setProducts(productsData.products);
        setOrderStatus(orderData.status);
        
        // Populate form with existing order data
        setFormData({
          vendor_id: orderData.vendor_id || "",
          order_date: dayjs(orderData.order_date).format("YYYY-MM-DD"),
          expected_date: orderData.expected_date ? dayjs(orderData.expected_date).format("YYYY-MM-DD") : "",
          notes: orderData.notes || "",
          terms: orderData.terms || "",
        });
        
        // Populate items
        if (orderData.items && orderData.items.length > 0) {
          setItems(orderData.items.map(item => ({
            product_id: undefined, // Product ID not returned in items, could be enhanced
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || "Nos",
            rate: item.rate,
            gst_rate: item.gst_rate || 18,
          })));
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setError(getErrorMessage(error, "Failed to load order"));
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [company?.id, orderId]);

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, unit: "Nos", rate: 0, gst_rate: 18 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof OrderItemForm, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        description: product.name,
        rate: product.unit_price,
        unit: product.unit,
        gst_rate: parseFloat(product.gst_rate) || 18,
      };
      setItems(newItems);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    items.forEach((item) => {
      const lineTotal = item.quantity * item.rate;
      subtotal += lineTotal;
      tax += (lineTotal * item.gst_rate) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !orderId) return;

    if (!formData.vendor_id) {
      setError("Please select a vendor/supplier");
      return;
    }

    if (items.some((item) => !item.description || item.rate <= 0)) {
      setError("Please fill in all item details");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await ordersApi.updatePurchaseOrder(company.id, orderId, {
        vendor_id: formData.vendor_id,
        items: items.map((item) => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          gst_rate: item.gst_rate,
        })),
        order_date: formData.order_date,
        expected_date: formData.expected_date || undefined,
        notes: formData.notes || undefined,
        terms: formData.terms || undefined,
      });
      router.push(`/orders/purchase/${orderId}`);
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to update purchase order"));
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (orderStatus !== "draft") {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <svg className="mx-auto mb-4 h-16 w-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-lg font-semibold text-dark dark:text-white">Cannot Edit This Order</p>
        <p className="mt-2 text-dark-6">Only draft orders can be edited. This order is {orderStatus}.</p>
        <Link
          href={`/orders/purchase/${orderId}`}
          className="mt-4 inline-block text-primary hover:underline"
        >
          View Order Details
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/orders/purchase/${orderId}`}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-dark-3"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white">Edit Purchase Order</h1>
            <p className="text-sm text-dark-6">Update your purchase order details</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vendor & Order Info */}
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Order Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Vendor/Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.gstin && `(${v.gstin})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Order Date</label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Expected Delivery</label>
                  <input
                    type="date"
                    value={formData.expected_date}
                    onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-dark dark:text-white">Line Items</h2>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-dark-6">Item {index + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-6">
                      <div className="sm:col-span-3">
                        <label className="mb-1 block text-xs text-dark-6">Product / Description</label>
                        <select
                          value={item.product_id || ""}
                          onChange={(e) => handleProductSelect(index, e.target.value)}
                          className="mb-2 w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        >
                          <option value="">Select product or type below</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} - {formatCurrency(product.unit_price)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Rate</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Amount</label>
                        <div className="rounded border border-stroke bg-gray-100 px-3 py-2 text-sm font-medium dark:border-dark-3 dark:bg-dark-2">
                          {formatCurrency(item.quantity * item.rate)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        >
                          <option value="Nos">Nos</option>
                          <option value="Pcs">Pieces</option>
                          <option value="KG">KG</option>
                          <option value="Ltr">Litre</option>
                          <option value="Mtr">Metre</option>
                          <option value="SqFt">Sq.Ft</option>
                          <option value="Hr">Hour</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">GST Rate %</label>
                        <select
                          value={item.gst_rate}
                          onChange={(e) => handleItemChange(index, "gst_rate", parseFloat(e.target.value))}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Tax Amount</label>
                        <div className="rounded border border-stroke bg-gray-100 px-3 py-2 text-sm font-medium dark:border-dark-3 dark:bg-dark-2">
                          {formatCurrency((item.quantity * item.rate * item.gst_rate) / 100)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Additional Info</h2>
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Internal notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Terms & Conditions</label>
                  <textarea
                    rows={3}
                    placeholder="Payment terms, delivery terms..."
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            <div className="sticky top-24 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Order Summary</h2>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">Subtotal</span>
                  <span className="text-dark dark:text-white">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">GST</span>
                  <span className="text-dark dark:text-white">{formatCurrency(totals.tax)}</span>
                </div>
                <hr className="border-stroke dark:border-dark-3" />
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-dark dark:text-white">Total</span>
                  <span className="text-primary">{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Link
                  href={`/orders/purchase/${orderId}`}
                  className="block w-full rounded-lg border border-stroke py-3 text-center font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
