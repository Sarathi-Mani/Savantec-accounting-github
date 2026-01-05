"use client";

import { useAuth } from "@/context/AuthContext";
import { customersApi, productsApi, Customer, Product, salesmenApi, Salesman, CustomerListResponse, ProductListResponse, SalesmanListResponse } from "@/services/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Select from "react-select";

interface QuotationItem {
  item_id: string;
  hsn: string;
  sku: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_type: "percentage" | "fixed";
  tax_percentage: number;
  total_amount: number;
}

interface OtherCharge {
  name: string;
  amount: number;
  type: "fixed" | "percentage";
  tax: number;
}

export default function NewQuotationPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);

  const [formData, setFormData] = useState({
    quotation_code: `QT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0001`,
    quotation_date: new Date().toISOString().split("T")[0],
    expire_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "open" as "open" | "closed" | "po_converted" | "lost",
    customer_id: "",
    contact_person: "",
    salesman_id: "",
    reference: "",
    reference_no: "",
    reference_date: "",
    tax_type: "",
    tax_regime: "",
    payment_terms: "",
    notes: "",
    description: "",
    subtotal: 0,
    total_discount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    grand_total: 0,
    taxable_amount: 0,
    total_tax: 0,
    round_off: 0,
    other_charges_total: 0
  });

  const [items, setItems] = useState<QuotationItem[]>([
    { 
      item_id: "", 
      hsn: "", 
      sku: "", 
      description: "", 
      quantity: 1, 
      unit_price: 0, 
      discount: 0, 
      discount_type: "percentage", 
      tax_percentage: 18, 
      total_amount: 0 
    }
  ]);

  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([
    { name: "", amount: 0, type: "fixed", tax: 18 }
  ]);

  const [globalDiscount, setGlobalDiscount] = useState({
    value: 0,
    type: "percentage" as "percentage" | "fixed"
  });

  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [customerOptions, setCustomerOptions] = useState<any[]>([]);
  const [salesmanOptions, setSalesmanOptions] = useState<any[]>([]);

  // Show toast message
  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) return;
      try {
        const [customersData, productsData, salesmenData] = await Promise.all([
          customersApi.list(company.id, { page_size: 100 }),
          productsApi.list(company.id, { page_size: 100 }),
          salesmenApi.list(company.id, { page_size: 100 })
        ]);

        // CORRECTED: Access the correct properties from API responses
        const customersArray = (customersData as CustomerListResponse).customers || [];
        const productsArray = (productsData as ProductListResponse).products || [];
        const salesmenArray = (salesmenData as SalesmanListResponse).salesmen || [];

        setCustomers(customersArray);
        setProducts(productsArray);
        setSalesmen(salesmenArray);

        // Prepare options for selects
        setProductOptions(
          productsArray.map((product: Product) => ({
            value: product.id,
            label: product.name,
            hsn: product.hsn || product.hsn_code,
            sku: product.sku,
            discount: product.discount || 0,
            discount_type: product.discount_type || 'percentage',
            description: product.description,
            unit_price: product.unit_price || product.sales_price || 0,
            tax_rate: product.tax_rate || product.gst_rate || 18
          }))
        );

        setCustomerOptions(
          customersArray.map((customer: Customer) => ({
            value: customer.id,
            label: `${customer.name} ${customer.phone ? `- ${customer.phone}` : ''} ${customer.email ? `- ${customer.email}` : ''}`,
            customer
          }))
        );

        setSalesmanOptions(
          salesmenArray.map((salesman: Salesman) => ({
            value: salesman.id,
            label: salesman.name
          }))
        );
      } catch (error) {
        console.error("Failed to fetch data:", error);
        showToast('error', "Failed to load data");
      }
    };
    fetchData();
  }, [company?.id]);

  // Calculate totals whenever items or other charges change
  useEffect(() => {
    calculateTotals();
  }, [items, otherCharges, formData.tax_regime]);

  const calculateItemTotal = (item: QuotationItem) => {
    const subtotal = item.quantity * item.unit_price;
    let discountAmount = 0;
    
    if (item.discount_type === "percentage") {
      discountAmount = subtotal * (item.discount / 100);
    } else {
      discountAmount = Math.min(item.discount, subtotal);
    }
    
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (item.tax_percentage / 100);
    const total = taxableAmount + taxAmount;
    
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalItems = 0;
    let totalQuantity = 0;

    // Calculate items totals
    items.forEach(item => {
      if (item.quantity > 0 && item.unit_price > 0) {
        totalItems++;
      }
      totalQuantity += item.quantity;

      const itemCalc = calculateItemTotal(item);
      subtotal += itemCalc.subtotal;
      totalDiscount += itemCalc.discountAmount;
      totalTaxable += itemCalc.taxableAmount;

      // Calculate tax based on tax regime
      if (formData.tax_regime === "cgst_sgst") {
        totalCgst += itemCalc.taxAmount / 2;
        totalSgst += itemCalc.taxAmount / 2;
      } else if (formData.tax_regime === "igst") {
        totalIgst += itemCalc.taxAmount;
      }
    });

    // Calculate other charges
    let otherChargesTotal = 0;
    otherCharges.forEach(charge => {
      let chargeAmount = charge.amount;
      if (charge.type === "percentage") {
        chargeAmount = totalTaxable * (charge.amount / 100);
      }
      
      const chargeTax = chargeAmount * (charge.tax / 100);
      const chargeTotal = chargeAmount + chargeTax;
      otherChargesTotal += chargeTotal;

      // Add tax from other charges
      if (formData.tax_regime === "cgst_sgst") {
        totalCgst += chargeTax / 2;
        totalSgst += chargeTax / 2;
      } else if (formData.tax_regime === "igst") {
        totalIgst += chargeTax;
      }
    });

    const totalTax = totalCgst + totalSgst + totalIgst;
    const totalBeforeRoundOff = subtotal - totalDiscount + otherChargesTotal + totalTax;
    const roundOff = Math.round(totalBeforeRoundOff) - totalBeforeRoundOff;
    const grandTotal = totalBeforeRoundOff + roundOff;

    // CORRECTED: Ensure tax_rate is number, not string | number
    const taxRate = typeof productOptions[0]?.tax_rate === 'string' 
      ? parseFloat(productOptions[0]?.tax_rate) 
      : productOptions[0]?.tax_rate || 18;

    // Update form data
    setFormData(prev => ({
      ...prev,
      subtotal,
      total_discount: totalDiscount,
      taxable_amount: totalTaxable,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      total_tax: totalTax,
      round_off: roundOff,
      grand_total: grandTotal,
      other_charges_total: otherChargesTotal
    }));

    return {
      totalItems,
      totalQuantity,
      subtotal,
      totalDiscount,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      roundOff,
      grandTotal,
      otherChargesTotal
    };
  };

  const addItem = () => {
    setItems([...items, { 
      item_id: "", 
      hsn: "", 
      sku: "", 
      description: "", 
      quantity: 1, 
      unit_price: 0, 
      discount: 0, 
      discount_type: "percentage", 
      tax_percentage: 18, 
      total_amount: 0 
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    
    // Handle discount_type specifically to ensure it's the correct type
    if (field === "discount_type") {
      newItems[index] = { ...newItems[index], [field]: value as "percentage" | "fixed" };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    // If item is selected from dropdown, populate other fields
    if (field === "item_id" && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].hsn = product.hsn || product.hsn_code || "";
        newItems[index].sku = product.sku || "";
        newItems[index].description = product.name;
        newItems[index].unit_price = product.unit_price || product.sales_price || 0;
        newItems[index].discount = product.discount || 0;
        newItems[index].discount_type = (product.discount_type as "percentage" | "fixed") || "percentage";
        // CORRECTED: Ensure tax_percentage is a number
        const productTax = product.tax_rate || product.gst_rate;
        newItems[index].tax_percentage = typeof productTax === 'string' 
          ? parseFloat(productTax) 
          : productTax || 18;
      }
    }
    
    // Recalculate item total
    if (["quantity", "unit_price", "discount", "discount_type", "tax_percentage"].includes(field)) {
      const calc = calculateItemTotal(newItems[index]);
      newItems[index].total_amount = calc.total;
    }
    
    setItems(newItems);
  };

  const addOtherCharge = () => {
    setOtherCharges([...otherCharges, { name: "", amount: 0, type: "fixed", tax: 18 }]);
  };

  const removeOtherCharge = (index: number) => {
    setOtherCharges(otherCharges.filter((_, i) => i !== index));
  };

  const updateOtherCharge = (index: number, field: keyof OtherCharge, value: any) => {
    const newCharges = [...otherCharges];
    // Ensure tax is a number
    if (field === 'tax') {
      newCharges[index] = { ...newCharges[index], [field]: Number(value) };
    } else {
      newCharges[index] = { ...newCharges[index], [field]: value };
    }
    setOtherCharges(newCharges);
  };

  const applyGlobalDiscount = () => {
    if (globalDiscount.value <= 0) {
      showToast('warning', "Please enter a discount value");
      return;
    }

    const newItems = items.map(item => {
      const itemSubtotal = item.quantity * item.unit_price;
      
      if (globalDiscount.type === "percentage") {
        const finalDiscount = Math.min(globalDiscount.value, 100);
        return { ...item, discount: finalDiscount, discount_type: "percentage" as const };
      } else {
        const finalDiscount = Math.min(globalDiscount.value, itemSubtotal);
        return { ...item, discount: finalDiscount, discount_type: "fixed" as const };
      }
    });

    setItems(newItems);
    showToast('success', "Discount applied to all items");
  };

  const handleCustomerChange = (option: any) => {
    if (option) {
      setSelectedCustomer(option.customer);
      setFormData(prev => ({
        ...prev,
        customer_id: option.value,
        contact_person: option.customer.contact_person || ""
      }));

      // Set tax regime based on customer state
      if (option.customer.billing_state_code && company?.state_code) {
        const isSameState = option.customer.billing_state_code === company.state_code;
        setFormData(prev => ({
          ...prev,
          tax_regime: isSameState ? "cgst_sgst" : "igst"
        }));
      }
    } else {
      setSelectedCustomer(null);
      setFormData(prev => ({
        ...prev,
        customer_id: "",
        contact_person: "",
        tax_regime: ""
      }));
    }
  };

  const handleTaxTypeChange = (taxType: string) => {
    const taxMap: Record<string, number> = {
      "tax_0": 0,
      "tax_5": 5,
      "tax_12": 12,
      "tax_18": 18,
      "tax_28": 28
    };

    const taxRate = taxMap[taxType] || 18;
    
    // Apply to all items
    const newItems = items.map(item => ({
      ...item,
      tax_percentage: taxRate
    }));
    setItems(newItems);

    // Apply to other charges
    const newCharges = otherCharges.map(charge => ({
      ...charge,
      tax: taxRate
    }));
    setOtherCharges(newCharges);

    setFormData(prev => ({ ...prev, tax_type: taxType }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!company?.id || !token) {
      showToast('error', "Authentication required");
      return;
    }

    // Validation
    if (!formData.customer_id) {
      showToast('error', "Please select a customer");
      return;
    }

    if (!formData.contact_person.trim()) {
      showToast('error', "Please enter contact person");
      return;
    }

    if (!formData.salesman_id) {
      showToast('error', "Please select a sales engineer");
      return;
    }

    if (!formData.quotation_code.trim()) {
      showToast('error', "Please enter quotation number");
      return;
    }

    const validItems = items.filter(item => 
      item.item_id && item.quantity > 0 && item.unit_price >= 0
    );

    if (validItems.length === 0) {
      showToast('error', "Please add at least one valid item");
      return;
    }

    // Validate other charges
    const invalidCharges = otherCharges.filter(charge => 
      charge.name.trim() === "" && charge.amount > 0
    );

    if (invalidCharges.length > 0) {
      showToast('error', "Please enter name for all charges with amount");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        items: validItems.map(item => ({
          ...item,
          unit: "unit" // You might want to make this dynamic
        })),
        other_charges: otherCharges.filter(charge => charge.name.trim() !== "" || charge.amount > 0)
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/quotations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const data = await response.json();
        showToast('success', "Quotation created successfully");
        router.push(`/quotations/${data.id}`);
      } else {
        const errorData = await response.json();
        showToast('error', errorData.detail || "Failed to create quotation");
      }
    } catch (err) {
      showToast('error', "Failed to create quotation");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  // Toast component
  const Toast = () => {
    if (!toastMessage) return null;

    const bgColor = {
      success: 'bg-green-100 border-green-400 text-green-700',
      error: 'bg-red-100 border-red-400 text-red-700',
      warning: 'bg-yellow-100 border-yellow-400 text-yellow-700'
    }[toastMessage.type];

    return (
      <div className="fixed top-4 right-4 z-50 animate-slide-in">
        <div className={`rounded-lg border px-6 py-4 shadow-lg ${bgColor}`}>
          <div className="flex items-center">
            {toastMessage.type === 'success' && (
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {toastMessage.type === 'error' && (
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            {toastMessage.type === 'warning' && (
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span>{toastMessage.message}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Quotation</h1>
        <p className="text-gray-600 dark:text-gray-400">Create a detailed quotation for your customer</p>
      </div>

      <Toast />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hidden fields for totals */}
        <input type="hidden" name="subtotal" value={formData.subtotal} />
        <input type="hidden" name="total_discount" value={formData.total_discount} />
        <input type="hidden" name="cgst" value={formData.cgst} />
        <input type="hidden" name="sgst" value={formData.sgst} />
        <input type="hidden" name="igst" value={formData.igst} />
        <input type="hidden" name="grand_total" value={formData.grand_total} />
        <input type="hidden" name="taxable_amount" value={formData.taxable_amount} />
        <input type="hidden" name="total_tax" value={formData.total_tax} />
        <input type="hidden" name="round_off" value={formData.round_off} />
        <input type="hidden" name="other_charges_total" value={formData.other_charges_total} />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Quotation Details */}
          <div className="space-y-6">
            {/* Quotation Details Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quotation Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Quotation No *
                  </label>
                  <input
                    type="text"
                    value={formData.quotation_code}
                    onChange={(e) => setFormData({ ...formData, quotation_code: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.quotation_date}
                    onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expire_date}
                    onChange={(e) => setFormData({ ...formData, expire_date: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                    required
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="po_converted">PO Converted</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Information Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Information</h2>
                <button
                  type="button"
                  onClick={() => router.push("/customers/new")}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-500 dark:hover:bg-blue-900/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Customer
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Customer *
                  </label>
                  <Select
                    options={customerOptions}
                    onChange={handleCustomerChange}
                    placeholder="Search Customer..."
                    className="react-select"
                    classNamePrefix="select"
                    isClearable
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                    required
                  />
                </div>

                {selectedCustomer && (
                  <div className="grid gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Email
                        </label>
                        <input
                          type="text"
                          value={selectedCustomer.email || ""}
                          readOnly
                          className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Phone
                        </label>
                        <input
                          type="text"
                          value={selectedCustomer.phone || selectedCustomer.mobile || ""}
                          readOnly
                          className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        GST No
                      </label>
                      <input
                        type="text"
                        value={selectedCustomer.gstin || ""}
                        readOnly
                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        State
                      </label>
                      <input
                        type="text"
                        value={selectedCustomer.billing_state || ""}
                        readOnly
                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Sales & Tax */}
          <div className="space-y-6">
            {/* Sales & Reference Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Sales & Reference</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Sales Engineer *
                  </label>
                  <Select
                    options={salesmanOptions}
                    onChange={(option: any) => setFormData({ ...formData, salesman_id: option?.value || "" })}
                    placeholder="Search Sales Engineer..."
                    className="react-select"
                    classNamePrefix="select"
                    isClearable
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Reference
                    </label>
                    <input
                      type="text"
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Reference No
                    </label>
                    <input
                      type="text"
                      value={formData.reference_no}
                      onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Reference Date
                  </label>
                  <input
                    type="date"
                    value={formData.reference_date}
                    onChange={(e) => setFormData({ ...formData, reference_date: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Tax Information Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Tax Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Tax Type
                  </label>
                  <select
                    value={formData.tax_type}
                    onChange={(e) => handleTaxTypeChange(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  >
                    <option value="">Select Tax Type...</option>
                    <option value="tax_0">Tax 0%</option>
                    <option value="tax_5">Tax 5%</option>
                    <option value="tax_12">Tax 12%</option>
                    <option value="tax_18">Tax 18%</option>
                    <option value="tax_28">Tax 28%</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Apply same tax rate to all items
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    GST Regime
                  </label>
                  <select
                    value={formData.tax_regime}
                    onChange={(e) => setFormData({ ...formData, tax_regime: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  >
                    <option value="">Select GST Regime...</option>
                    <option value="cgst_sgst">CGST + SGST</option>
                    <option value="igst">IGST</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {formData.tax_regime === "cgst_sgst" 
                      ? "Same state - CGST + SGST applicable" 
                      : formData.tax_regime === "igst"
                      ? "Interstate - IGST applicable"
                      : "Select based on customer location"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Items</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/products/new")}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-500 dark:hover:bg-blue-900/20"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Item
              </button>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Item *</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">HSN Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Qty *</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Unit Price *</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Discount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Tax %</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <Select
                        options={productOptions}
                        value={productOptions.find(opt => opt.value === item.item_id)}
                        onChange={(option: any) => updateItem(index, "item_id", option?.value || "")}
                        placeholder="Search Item..."
                        className="react-select"
                        classNamePrefix="select"
                        isClearable
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => updateItem(index, "hsn", e.target.value)}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        placeholder="HSN Code"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.sku}
                        onChange={(e) => updateItem(index, "sku", e.target.value)}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        placeholder="SKU"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        rows={1}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        min={0.01}
                        step={0.01}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => updateItem(index, "discount", parseFloat(e.target.value) || 0)}
                          min={0}
                          step={0.01}
                          className="flex-1 rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        />
                        <select
                          value={item.discount_type}
                          onChange={(e) => updateItem(index, "discount_type", e.target.value as "percentage" | "fixed")}
                          className="w-20 rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">₹</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.tax_percentage}
                        onChange={(e) => updateItem(index, "tax_percentage", parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={formatCurrency(item.total_amount)}
                        readOnly
                        className="w-full rounded border border-gray-300 bg-gray-50 p-2 text-sm font-medium dark:border-gray-600 dark:bg-gray-700"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
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

        {/* Summary and Terms Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Terms & Conditions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Terms & Conditions</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Remarks</label>
                <textarea
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  placeholder="Enter payment terms..."
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Additional Notes</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                  placeholder="Enter additional notes..."
                />
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Items</span>
                <span className="font-medium text-gray-900 dark:text-white">{totals.totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Quantity</span>
                <span className="font-medium text-gray-900 dark:text-white">{totals.totalQuantity.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.subtotal)}</span>
              </div>

              {/* Global Discount */}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">All Items Discount</span>
                <div className="text-right">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="number"
                      value={globalDiscount.value}
                      onChange={(e) => setGlobalDiscount({ ...globalDiscount, value: parseFloat(e.target.value) || 0 })}
                      className="w-24 rounded border border-gray-300 bg-white p-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                      min={0}
                    />
                    <select
                      value={globalDiscount.type}
                      onChange={(e) => setGlobalDiscount({ ...globalDiscount, type: e.target.value as "percentage" | "fixed" })}
                      className="w-20 rounded border border-gray-300 bg-white p-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">₹</option>
                    </select>
                    <button
                      type="button"
                      onClick={applyGlobalDiscount}
                      className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                    >
                      Apply
                    </button>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalDiscount)}</span>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Taxable Amount</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalTaxable)}</span>
              </div>

              {/* Other Charges */}
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Other Charges</h3>
                  <button
                    type="button"
                    onClick={addOtherCharge}
                    className="rounded border border-blue-600 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-900/20"
                  >
                    Add Charge
                  </button>
                </div>
                
                {otherCharges.map((charge, index) => (
                  <div key={index} className="mb-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={charge.name}
                      onChange={(e) => updateOtherCharge(index, "name", e.target.value)}
                      className="flex-1 rounded border border-gray-300 bg-white p-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                      placeholder="Charge Name"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={charge.amount}
                        onChange={(e) => updateOtherCharge(index, "amount", parseFloat(e.target.value) || 0)}
                        className="w-24 rounded border border-gray-300 bg-white p-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                        min={0}
                        step={0.01}
                      />
                      <select
                        value={charge.type}
                        onChange={(e) => updateOtherCharge(index, "type", e.target.value as "fixed" | "percentage")}
                        className="w-16 rounded border border-gray-300 bg-white p-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                      >
                        <option value="fixed">₹</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                    <select
                      value={charge.tax}
                      onChange={(e) => updateOtherCharge(index, "tax", parseInt(e.target.value) || 0)}
                      className="w-16 rounded border border-gray-300 bg-white p-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeOtherCharge(index)}
                      className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">CGST</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalCgst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">SGST</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalSgst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">IGST</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalIgst)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                <span className="font-semibold text-gray-900 dark:text-white">Total Tax</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(totals.totalTax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Round Off</span>
                <span className={`font-medium ${formData.round_off > 0 ? 'text-green-600' : formData.round_off < 0 ? 'text-red-600' : 'text-gray-900'} dark:text-white`}>
                  {formData.round_off > 0 ? '+' : ''}{formatCurrency(formData.round_off)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                <span className="text-lg font-bold text-gray-900 dark:text-white">Grand Total</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-500">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-8 py-3 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-8 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Quotation
              </>
            )}
          </button>
        </div>
      </form>

      {/* Add CSS for react-select */}
      <style jsx global>{`
        .react-select .select__control {
          border: 1px solid #d1d5db;
          background-color: #f9fafb;
          min-height: 42px;
        }
        .dark .react-select .select__control {
          border-color: #4b5563;
          background-color: #374151;
        }
        .react-select .select__single-value {
          color: #111827;
        }
        .dark .react-select .select__single-value {
          color: #fff;
        }
        .react-select .select__menu {
          z-index: 10;
        }
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}