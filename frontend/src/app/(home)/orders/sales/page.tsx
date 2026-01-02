"use client";

import { useAuth } from "@/context/AuthContext";
import { ordersApi, customersApi, productsApi, SalesOrder, Customer, Product, getErrorMessage } from "@/services/api";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

interface OrderItemForm {
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
}

export default function SalesOrdersPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customer_id: "",
    order_date: dayjs().format("YYYY-MM-DD"),
    expected_delivery_date: "",
    notes: "",
  });
  const [items, setItems] = useState<OrderItemForm[]>([
    { description: "", quantity: 1, unit: "Nos", rate: 0, gst_rate: 18 },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [ordersData, customersData, productsData] = await Promise.all([
          ordersApi.listSalesOrders(company.id, statusFilter ? { status: statusFilter as any } : undefined),
          customersApi.list(company.id, { page_size: 100 }),
          productsApi.list(company.id, { page_size: 100 }),
        ]);
        setOrders(ordersData);
        setCustomers(customersData.customers);
        setProducts(productsData.products);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [company?.id, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "completed":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

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

  const resetForm = () => {
    setFormData({
      customer_id: "",
      order_date: dayjs().format("YYYY-MM-DD"),
      expected_delivery_date: "",
      notes: "",
    });
    setItems([{ description: "", quantity: 1, unit: "Nos", rate: 0, gst_rate: 18 }]);
    setShowForm(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.customer_id) {
      setError("Please select a customer");
      return;
    }

    if (items.some((item) => !item.description || item.rate <= 0)) {
      setError("Please fill in all item details");
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      const newOrder = await ordersApi.createSalesOrder(company.id, {
        customer_id: formData.customer_id,
        items: items.map((item) => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          gst_rate: item.gst_rate,
        })),
        order_date: formData.order_date,
        expected_delivery_date: formData.expected_delivery_date || undefined,
        notes: formData.notes || undefined,
      });
      setOrders([newOrder, ...orders]);
      resetForm();
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to create sales order"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleConfirm = async (orderId: string) => {
    if (!company?.id) return;
    setActionLoading(orderId);
    try {
      await ordersApi.confirmSalesOrder(company.id, orderId);
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: "confirmed" as const } : o)));
    } catch (error: any) {
      alert(getErrorMessage(error, "Failed to confirm order"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!company?.id) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    setActionLoading(orderId);
    try {
      await ordersApi.cancelSalesOrder(company.id, orderId);
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as const } : o)));
    } catch (error: any) {
      alert(getErrorMessage(error, "Failed to cancel order"));
    } finally {
      setActionLoading(null);
    }
  };

  const getCustomerName = (customerId?: string) => {
    if (!customerId) return "—";
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || "Unknown";
  };

  const totals = calculateTotals();

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Sales Orders</h1>
          <p className="text-sm text-dark-6">Manage customer orders before invoicing</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Order
          </button>
        )}
      </div>

      {/* Create Order Form */}
      {showForm && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">New Sales Order</h2>
          
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>

            {/* Order Items */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-dark dark:text-white">Order Items</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-sm text-primary hover:underline"
                >
                  + Add Item
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <th className="px-2 py-2 text-left text-sm font-medium text-dark-6">Product</th>
                      <th className="px-2 py-2 text-left text-sm font-medium text-dark-6">Description</th>
                      <th className="px-2 py-2 text-right text-sm font-medium text-dark-6">Qty</th>
                      <th className="px-2 py-2 text-right text-sm font-medium text-dark-6">Rate</th>
                      <th className="px-2 py-2 text-right text-sm font-medium text-dark-6">GST %</th>
                      <th className="px-2 py-2 text-right text-sm font-medium text-dark-6">Amount</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b border-stroke dark:border-dark-3">
                        <td className="px-2 py-2">
                          <select
                            value={item.product_id || ""}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                            className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                          >
                            <option value="">Select...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, "description", e.target.value)}
                            className="w-full rounded border border-stroke bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-dark-3"
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-20 rounded border border-stroke bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-primary dark:border-dark-3"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value) || 0)}
                            className="w-24 rounded border border-stroke bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-primary dark:border-dark-3"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={item.gst_rate}
                            onChange={(e) => handleItemChange(index, "gst_rate", parseFloat(e.target.value))}
                            className="w-20 rounded border border-stroke bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-primary dark:border-dark-3"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-medium text-dark dark:text-white">
                          {formatCurrency(item.quantity * item.rate)}
                        </td>
                        <td className="px-2 py-2">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">Subtotal:</span>
                    <span className="font-medium text-dark dark:text-white">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">Tax:</span>
                    <span className="font-medium text-dark dark:text-white">{formatCurrency(totals.tax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-stroke pt-2 dark:border-dark-3">
                    <span className="font-medium text-dark dark:text-white">Total:</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                placeholder="Any additional notes..."
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                {formLoading ? "Creating..." : "Create Order"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark sm:flex-row">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-dark-6">No sales orders found</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              Create your first order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Order #</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Customer</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Amount</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-dark-6">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                    <td className="px-6 py-4">
                      <span className="font-medium text-dark dark:text-white">{order.order_number}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-6">
                      {dayjs(order.order_date).format("DD MMM YYYY")}
                    </td>
                    <td className="px-6 py-4 text-sm text-dark dark:text-white">
                      {getCustomerName(order.customer_id)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-dark dark:text-white">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {order.status === "draft" && (
                          <>
                            <button
                              onClick={() => handleConfirm(order.id)}
                              disabled={actionLoading === order.id}
                              className="rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400"
                            >
                              {actionLoading === order.id ? "..." : "Confirm"}
                            </button>
                            <button
                              onClick={() => handleCancel(order.id)}
                              disabled={actionLoading === order.id}
                              className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {order.status === "confirmed" && (
                          <span className="text-xs text-dark-6">Ready to invoice</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
