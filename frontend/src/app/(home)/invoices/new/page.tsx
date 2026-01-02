"use client";

import { useAuth } from "@/context/AuthContext";
import { invoicesApi, customersApi, productsApi, inventoryApi, Customer, Product, Godown, getErrorMessage } from "@/services/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface WarehouseAllocation {
  godown_id: string | null;
  quantity: number;
}

interface InvoiceItem {
  product_id?: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  gst_rate: number;
  is_inclusive: boolean;
  warehouse_allocation?: WarehouseAllocation[];
}

export default function NewInvoicePage() {
  const { company } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!duplicateId);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [showAdvancedStock, setShowAdvancedStock] = useState(false);
  const [warehouseStock, setWarehouseStock] = useState<Record<string, any>>({});

  const [formData, setFormData] = useState({
    customer_id: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    invoice_type: "b2c",
    place_of_supply: company?.state_code || "",
    notes: "",
    terms: company?.invoice_terms || "",
  });

  // Check if inter-state (IGST) or intra-state (CGST+SGST)
  const isInterState = formData.place_of_supply && company?.state_code && 
    formData.place_of_supply !== company.state_code;

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", hsn_code: "", quantity: 1, unit: "unit", unit_price: 0, discount_percent: 0, gst_rate: 18, is_inclusive: false },
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

        // If duplicating an invoice, load its data
        if (duplicateId) {
          try {
            const sourceInvoice = await invoicesApi.get(company.id, duplicateId);
            
            // Set form data from source invoice
            setFormData({
              customer_id: sourceInvoice.customer_id || "",
              invoice_date: new Date().toISOString().split("T")[0], // Use today's date
              due_date: "",
              invoice_type: sourceInvoice.invoice_type || "b2c",
              place_of_supply: sourceInvoice.place_of_supply || company.state_code || "",
              notes: sourceInvoice.notes || "",
              terms: sourceInvoice.terms || "",
            });

            // Set items from source invoice
            if (sourceInvoice.items && sourceInvoice.items.length > 0) {
              setItems(
                sourceInvoice.items.map((item: any) => ({
                  product_id: item.product_id || undefined,
                  description: item.description || "",
                  hsn_code: item.hsn_code || "",
                  quantity: item.quantity || 1,
                  unit: item.unit || "unit",
                  unit_price: item.unit_price || 0,
                  discount_percent: item.discount_percent || 0,
                  gst_rate: item.gst_rate || 18,
                  is_inclusive: false, // Reset to exclusive for new invoice
                }))
              );
            }
          } catch (err) {
            console.error("Failed to load invoice for duplication:", err);
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, [company?.id, duplicateId]);

  const addItem = () => {
    setItems([...items, { description: "", hsn_code: "", quantity: 1, unit: "unit", unit_price: 0, discount_percent: 0, gst_rate: 18, is_inclusive: false }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Re-allocate if quantity changes and we're in advanced mode
    if (field === "quantity" && showAdvancedStock && newItems[index].product_id) {
      const productId = newItems[index].product_id!;
      const stockData = warehouseStock[productId];
      
      if (stockData && company?.warehouse_priorities) {
        const allocation = autoAllocateStock(
          value,
          stockData,
          company.warehouse_priorities?.priority_order || ["main"]
        );
        newItems[index].warehouse_allocation = allocation;
      }
    }
    
    setItems(newItems);
  };

  const selectProduct = async (index: number, productId: string) => {
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
        is_inclusive: product.is_inclusive,
      };
      setItems(newItems);

      // Fetch warehouse stock for this product and auto-allocate
      if (!product.is_service && company?.id && company.auto_reduce_stock) {
        try {
          const stockData = await inventoryApi.getStockByWarehouse(company.id, productId);
          setWarehouseStock(prev => ({
            ...prev,
            [productId]: stockData.warehouses
          }));

          // Auto-allocate based on warehouse priorities
          if (showAdvancedStock) {
            const allocation = autoAllocateStock(
              newItems[index].quantity,
              stockData.warehouses,
              company.warehouse_priorities?.priority_order || ["main"]
            );
            newItems[index].warehouse_allocation = allocation;
            setItems(newItems);
          }
        } catch (err) {
          console.error("Failed to fetch warehouse stock:", err);
        }
      }
    }
  };

  // Auto-allocate stock across warehouses based on priority
  const autoAllocateStock = (
    quantity: number,
    warehouses: any[],
    priorities: string[]
  ): WarehouseAllocation[] => {
    const allocation: WarehouseAllocation[] = [];
    let remaining = quantity;

    for (const warehouseRef of priorities) {
      if (remaining <= 0) break;

      const godown_id = warehouseRef === "main" ? null : warehouseRef;
      const warehouse = warehouses.find(w => w.godown_id === godown_id);
      
      if (warehouse && warehouse.quantity > 0) {
        const toAllocate = Math.min(warehouse.quantity, remaining);
        allocation.push({
          godown_id: godown_id,
          quantity: toAllocate
        });
        remaining -= toAllocate;
      }
    }

    // If still remaining, allocate from first warehouse (negative stock)
    if (remaining > 0 && priorities.length > 0) {
      const firstWarehouse = priorities[0] === "main" ? null : priorities[0];
      const existing = allocation.find(a => a.godown_id === firstWarehouse);
      if (existing) {
        existing.quantity += remaining;
      } else {
        allocation.push({ godown_id: firstWarehouse, quantity: remaining });
      }
    }

    return allocation;
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const grossAmount = item.quantity * item.unit_price;
    const discountOnGross = (grossAmount * item.discount_percent) / 100;
    const afterDiscount = grossAmount - discountOnGross;

    if (item.is_inclusive && item.gst_rate > 0) {
      // Price is inclusive of GST - extract base price and tax from the total
      const taxRate = item.gst_rate / 100;
      const basePrice = afterDiscount / (1 + taxRate);
      const tax = afterDiscount - basePrice;
      return {
        subtotal: basePrice + discountOnGross, // Original base before discount
        discount: discountOnGross * (1 / (1 + taxRate)), // Discount on base price
        taxable: basePrice,
        tax: tax,
        total: afterDiscount, // Total remains the same (inclusive)
      };
    } else {
      // Price is exclusive of GST - add tax on top
      const taxable = afterDiscount;
      const tax = (taxable * item.gst_rate) / 100;
      return {
        subtotal: grossAmount,
        discount: discountOnGross,
        taxable: taxable,
        tax: tax,
        total: taxable + tax,
      };
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const calc = calculateItemTotal(item);
      subtotal += calc.subtotal;
      totalDiscount += calc.discount;
      totalTax += calc.tax;
    });

    return {
      subtotal,
      discount: totalDiscount,
      taxable: subtotal - totalDiscount,
      tax: totalTax,
      total: subtotal - totalDiscount + totalTax,
    };
  };

  const handleSubmit = async (e: React.FormEvent, finalize = false) => {
    e.preventDefault();
    if (!company?.id) return;

    // Validate items
    const validItems = items.filter((item) => item.description && item.quantity > 0 && item.unit_price > 0);
    if (validItems.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const invoiceData = {
        ...formData,
        customer_id: formData.customer_id || null,
        items: validItems,
        manual_warehouse_override: showAdvancedStock,
        warehouse_allocations: showAdvancedStock 
          ? Object.fromEntries(
              validItems.map((item, idx) => [
                `item_${idx}`, 
                item.warehouse_allocation || []
              ])
            )
          : undefined,
      };

      const invoice = await invoicesApi.create(company.id, invoiceData);

      if (finalize) {
        await invoicesApi.finalize(company.id, invoice.id);
      }

      router.push(`/invoices/${invoice.id}`);
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to create invoice"));
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          {duplicateId ? "Duplicate Invoice" : "Create Invoice"}
        </h1>
        <p className="text-sm text-dark-6">
          {duplicateId ? "Creating a new invoice from an existing one" : "Create a new GST-compliant invoice"}
        </p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer & Invoice Info */}
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Invoice Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Customer
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => {
                      const customerId = e.target.value;
                      const selectedCustomer = customers.find((c) => c.id === customerId);
                      setFormData({ 
                        ...formData, 
                        customer_id: customerId,
                        // Update place of supply based on customer's state code
                        place_of_supply: selectedCustomer?.billing_state_code || company?.state_code || "",
                        // Auto-detect invoice type
                        invoice_type: selectedCustomer?.gstin ? "b2b" : "b2c"
                      });
                    }}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.gstin && `(${customer.gstin})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Invoice Type
                  </label>
                  <select
                    value={formData.invoice_type}
                    onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  >
                    <option value="b2c">B2C (Consumer)</option>
                    <option value="b2b">B2B (Business)</option>
                    <option value="export">Export</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Place of Supply
                  </label>
                  <select
                    value={formData.place_of_supply}
                    onChange={(e) => setFormData({ ...formData, place_of_supply: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  >
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
                    <option value="28">28 - Andhra Pradesh (Old)</option>
                    <option value="29">29 - Karnataka</option>
                    <option value="30">30 - Goa</option>
                    <option value="31">31 - Lakshadweep</option>
                    <option value="32">32 - Kerala</option>
                    <option value="33">33 - Tamil Nadu</option>
                    <option value="34">34 - Puducherry</option>
                    <option value="35">35 - Andaman & Nicobar Islands</option>
                    <option value="36">36 - Telangana</option>
                    <option value="37">37 - Andhra Pradesh (New)</option>
                    <option value="38">38 - Ladakh</option>
                  </select>
                  {isInterState && (
                    <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                      Inter-state supply - IGST will be applied
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-dark dark:text-white">Items</h2>
                <button
                  type="button"
                  onClick={addItem}
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
                          onClick={() => removeItem(index)}
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
                          onChange={(e) => {
                            if (e.target.value) {
                              selectProduct(index, e.target.value);
                            }
                          }}
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
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">HSN/SAC</label>
                        <input
                          type="text"
                          placeholder="HSN Code"
                          value={item.hsn_code}
                          onChange={(e) => updateItem(index, "hsn_code", e.target.value)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Rate</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-5">
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(index, "unit", e.target.value)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        >
                          <option value="unit">Unit</option>
                          <option value="pcs">Pieces</option>
                          <option value="kg">KG</option>
                          <option value="ltr">Litre</option>
                          <option value="mtr">Metre</option>
                          <option value="sqft">Sq.Ft</option>
                          <option value="hr">Hour</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">GST Rate %</label>
                        <select
                          value={item.gst_rate}
                          onChange={(e) => updateItem(index, "gst_rate", parseInt(e.target.value))}
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
                        <label className="mb-1 block text-xs text-dark-6">Discount %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount_percent}
                          onChange={(e) => updateItem(index, "discount_percent", parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">GST Inclusive</label>
                        <label className="flex h-[34px] items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.is_inclusive}
                            onChange={(e) => updateItem(index, "is_inclusive", e.target.checked)}
                            className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
                          />
                          <span className="text-xs text-dark-6">{item.is_inclusive ? "Yes" : "No"}</span>
                        </label>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-dark-6">Item Total</label>
                        <div className="rounded border border-stroke bg-gray-100 px-3 py-2 text-sm font-medium dark:border-dark-3 dark:bg-dark-2">
                          {formatCurrency(calculateItemTotal(item).total)}
                          {item.is_inclusive && <span className="ml-1 text-xs text-green-600">(incl.)</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Advanced Stock Options Toggle */}
              {company?.auto_reduce_stock && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const newState = !showAdvancedStock;
                      setShowAdvancedStock(newState);
                      
                      // Auto-fill all items when showing advanced options
                      if (newState && company.warehouse_priorities) {
                        const newItems = items.map(item => {
                          if (!item.product_id || products.find(p => p.id === item.product_id)?.is_service) {
                            return item;
                          }
                          
                          const productStockData = warehouseStock[item.product_id] || [];
                          if (productStockData.length > 0) {
                            const allocation = autoAllocateStock(
                              item.quantity,
                              productStockData,
                              company.warehouse_priorities?.priority_order || ["main"]
                            );
                            return { ...item, warehouse_allocation: allocation };
                          }
                          return item;
                        });
                        setItems(newItems);
                      }
                    }}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <svg className={`h-4 w-4 transition-transform ${showAdvancedStock ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {showAdvancedStock ? "Hide" : "Show"} Advanced Stock Options
                  </button>
                </div>
              )}
            </div>

            {/* Advanced Warehouse Allocation */}
            {showAdvancedStock && company?.auto_reduce_stock && (
              <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
                <div className="mb-4 flex items-start gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-medium text-dark dark:text-white">Manually Select Warehouses</p>
                    <p className="text-dark-6">Choose which warehouse to reduce stock from for each item. Leave blank for automatic allocation.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.map((item, itemIndex) => {
                    const product = products.find(p => p.id === item.product_id);
                    const isService = product?.is_service;
                    
                    if (isService || !item.product_id) return null;

                    return (
                      <div key={itemIndex} className="rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-2">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-dark dark:text-white">
                              {item.description || `Item ${itemIndex + 1}`}
                            </p>
                            <p className="text-xs text-dark-6">
                              Total needed: {item.quantity} {item.unit}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const productStockData = warehouseStock[item.product_id!] || [];
                              if (productStockData.length > 0 && company?.warehouse_priorities) {
                                const allocation = autoAllocateStock(
                                  item.quantity,
                                  productStockData,
                                  company.warehouse_priorities?.priority_order || ["main"]
                                );
                                const newItems = [...items];
                                newItems[itemIndex].warehouse_allocation = allocation;
                                setItems(newItems);
                              }
                            }}
                            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-opacity-90"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Auto-fill
                          </button>
                        </div>

                        <div className="space-y-2">
                          {/* Get warehouse stock for this product */}
                          {(() => {
                            const productStockData = warehouseStock[item.product_id!] || [];
                            
                            // If no stock data, show all warehouses
                            if (productStockData.length === 0) {
                              return (
                                <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                                  Loading warehouse stock...
                                </div>
                              );
                            }
                            
                            return productStockData.map((warehouse: any) => {
                              const qty = warehouse.quantity;
                              const hasStock = qty > 0;
                              
                              // Only show warehouses with stock > 0
                              if (!hasStock) return null;
                              
                              return (
                                <div key={warehouse.godown_id || "main"} className="flex items-center gap-3">
                                  <div className="w-48">
                                    <p className="text-sm font-medium text-dark dark:text-white">
                                      {warehouse.godown_name}
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      Available: {qty} {item.unit}
                                    </p>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    max={qty}
                                    step="0.001"
                                    placeholder="0"
                                    value={item.warehouse_allocation?.find(a => a.godown_id === warehouse.godown_id)?.quantity || ""}
                                    onChange={(e) => {
                                      const inputQty = parseFloat(e.target.value) || 0;
                                      const newAllocation = [...(item.warehouse_allocation || [])];
                                      const existingIndex = newAllocation.findIndex(a => a.godown_id === warehouse.godown_id);
                                      
                                      if (existingIndex >= 0) {
                                        if (inputQty === 0) {
                                          newAllocation.splice(existingIndex, 1);
                                        } else {
                                          newAllocation[existingIndex].quantity = inputQty;
                                        }
                                      } else if (inputQty > 0) {
                                        newAllocation.push({ godown_id: warehouse.godown_id, quantity: inputQty });
                                      }
                                      
                                      updateItem(itemIndex, "warehouse_allocation", newAllocation);
                                    }}
                                    className="w-32 rounded border border-stroke bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark"
                                  />
                                  <span className="text-sm text-dark-6">{item.unit}</span>
                                </div>
                              );
                            });
                          })()}

                          {/* No stock warning */}
                          {(() => {
                            const productStockData = warehouseStock[item.product_id!] || [];
                            const hasAnyStock = productStockData.some((w: any) => w.quantity > 0);
                            
                            if (productStockData.length > 0 && !hasAnyStock) {
                              return (
                                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                                  <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    No stock available in any warehouse. Stock will go negative.
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Allocation Summary */}
                          <div className="mt-2 flex items-center justify-between rounded bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
                            <span className="text-sm text-blue-700 dark:text-blue-400">
                              Allocated: {(item.warehouse_allocation || []).reduce((sum, a) => sum + a.quantity, 0)} {item.unit}
                            </span>
                            {(item.warehouse_allocation || []).reduce((sum, a) => sum + a.quantity, 0) !== item.quantity && (
                              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                ⚠ Total doesn't match item quantity
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Additional Info</h2>
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Notes for the customer..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Terms & Conditions</label>
                  <textarea
                    rows={3}
                    placeholder="Payment terms..."
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
              <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Summary</h2>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">Subtotal</span>
                  <span className="text-dark dark:text-white">{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">Discount</span>
                    <span className="text-red-500">-{formatCurrency(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-dark-6">Taxable Amount</span>
                  <span className="text-dark dark:text-white">{formatCurrency(totals.taxable)}</span>
                </div>
                {isInterState ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-6">IGST</span>
                    <span className="text-dark dark:text-white">{formatCurrency(totals.tax)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-6">CGST</span>
                      <span className="text-dark dark:text-white">{formatCurrency(totals.tax / 2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-6">SGST</span>
                      <span className="text-dark dark:text-white">{formatCurrency(totals.tax / 2)}</span>
                    </div>
                  </>
                )}
                <hr className="border-stroke dark:border-dark-3" />
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-dark dark:text-white">Total</span>
                  <span className="text-primary">{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg border border-primary bg-transparent py-3 font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save as Draft"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={loading}
                  className="w-full rounded-lg bg-primary py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create & Finalize"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
