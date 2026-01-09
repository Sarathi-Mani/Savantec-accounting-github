"use client";

import { useAuth } from "@/context/AuthContext";
import { 
  customersApi, 
  productsApi, 
  Customer, 
  Product, 
  salesmenApi, 
  Salesman, 
  CustomerListResponse, 
  ProductListResponse, 
  SalesmanListResponse, 
  ContactPerson 
} from "@/services/api";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Select from "react-select";

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



interface OtherCharge {
  id: string;
  name: string;
  amount: number;
  type: "fixed" | "percentage";
  tax: number;
}
// Add this interface for Excel cell
interface ExcelCell {
  id: string;
  value: string;
  isFormula: boolean;
  formula?: string;
  computedValue?: number | string;
  row: number;
  col: number;
}

interface FormData {
  quotation_code: string;
  quotation_date: string;
  expire_date: string;
  status: "open" | "closed" | "po_converted" | "lost";
  customer_id?: string;
  contact_person: string;
  salesman_id?: string;
  reference: string;
  reference_no: string;
  reference_date: string;
  tax_type: string;
  tax_regime: string;
  payment_terms: string;
  notes: string;
  description: string;
  subtotal: number;
  total_discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  grand_total: number;
  taxable_amount: number;
  total_tax: number;
  round_off: number;
  other_charges_total: number;
  place_of_supply?: string;
  subject?: string;
  terms?: string;
  validity_days: number;
}

// Simple toast notification component
const Toast = ({ message, type = "success", onClose }: { 
  message: string; 
  type?: "success" | "error" | "info" | "warning";
  onClose: () => void;
}) => {
  const bgColor = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    warning: "bg-yellow-500"
  }[type];

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 text-white hover:text-gray-200">
          ×
        </button>
      </div>
    </div>
  );
};

export default function NewQuotationPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedContactPerson, setSelectedContactPerson] = useState<ContactPerson | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" | "warning" }>>([]);

  // Generate quotation code
  const generateQuotationCode = useCallback(() => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `QT-0001`;
  }, []);


  const [excelGrid, setExcelGrid] = useState<ExcelCell[][]>(() => {
  // Initialize 5x10 grid
  const grid: ExcelCell[][] = [];
  for (let r = 0; r < 5; r++) {
    const row: ExcelCell[] = [];
    for (let c = 0; c < 10; c++) {
      row.push({
        id: `${r}_${c}`,
        value: '',
        isFormula: false,
        row: r,
        col: c,
        computedValue: ''
      });
    }
    grid.push(row);
  }
  return grid;
});

// Add these functions for Excel operations
const updateCell = (row: number, col: number, value: string) => {
  const newGrid = [...excelGrid.map(rowArr => [...rowArr])];
  const cell = newGrid[row][col];
  
  // Check if it's a formula (starts with =)
  if (value.trim().startsWith('=')) {
    cell.isFormula = true;
    cell.formula = value.trim();
    cell.value = value.trim();
    
    // Try to compute the formula
    try {
      cell.computedValue = evaluateFormula(value, newGrid);
    } catch (error) {
      console.error('Formula error:', error);
      cell.computedValue = '#ERROR';
    }
  } else {
    cell.isFormula = false;
    cell.formula = undefined;
    cell.value = value;
    
    // Try to convert to number if it looks like a number
    const numValue = parseFloat(value);
    cell.computedValue = !isNaN(numValue) ? numValue : value;
  }
  
  // Update dependent cells
  updateDependentCells(newGrid);
  
  setExcelGrid(newGrid);
};

const evaluateFormula = (formula: string, grid: ExcelCell[][]): number | string => {
  const expr = formula.substring(1).toUpperCase();
  
  // SUM function
  if (expr.startsWith('SUM(')) {
    const range = expr.match(/SUM\(([A-Z])([0-9]+):([A-Z])([0-9]+)\)/);
    if (range) {
      const startCol = range[1];
      const startRow = parseInt(range[2]) - 1;
      const endCol = range[3];
      const endRow = parseInt(range[4]) - 1;
      
      const startColIndex = startCol.charCodeAt(0) - 65;
      const endColIndex = endCol.charCodeAt(0) - 65;
      
      let sum = 0;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startColIndex; c <= endColIndex; c++) {
          if (r < grid.length && c < grid[r].length) {
            const cellValue = grid[r][c].computedValue;
            const numValue = typeof cellValue === 'number' ? cellValue : 
                            (typeof cellValue === 'string' && !isNaN(Number(cellValue)) ? Number(cellValue) : 0);
            sum += numValue;
          }
        }
      }
      return sum;
    }
  }
  
  // AVG function
  if (expr.startsWith('AVG(')) {
    const range = expr.match(/AVG\(([A-Z])([0-9]+):([A-Z])([0-9]+)\)/);
    if (range) {
      const startCol = range[1];
      const startRow = parseInt(range[2]) - 1;
      const endCol = range[3];
      const endRow = parseInt(range[4]) - 1;
      
      const startColIndex = startCol.charCodeAt(0) - 65;
      const endColIndex = endCol.charCodeAt(0) - 65;
      
      let sum = 0;
      let count = 0;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startColIndex; c <= endColIndex; c++) {
          if (r < grid.length && c < grid[r].length) {
            const cellValue = grid[r][c].computedValue;
            const numValue = typeof cellValue === 'number' ? cellValue : 
                            (typeof cellValue === 'string' && !isNaN(Number(cellValue)) ? Number(cellValue) : null);
            if (numValue !== null) {
              sum += numValue;
              count++;
            }
          }
        }
      }
      return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    }
  }
  
  // COUNT function
  if (expr.startsWith('COUNT(')) {
    const range = expr.match(/COUNT\(([A-Z])([0-9]+):([A-Z])([0-9]+)\)/);
    if (range) {
      const startCol = range[1];
      const startRow = parseInt(range[2]) - 1;
      const endCol = range[3];
      const endRow = parseInt(range[4]) - 1;
      
      const startColIndex = startCol.charCodeAt(0) - 65;
      const endColIndex = endCol.charCodeAt(0) - 65;
      
      let count = 0;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startColIndex; c <= endColIndex; c++) {
          if (r < grid.length && c < grid[r].length) {
            const val = grid[r][c].computedValue;
            if (val !== '' && val !== undefined && val !== null) {
              count++;
            }
          }
        }
      }
      return count;
    }
  }
  
  // MIN function
  if (expr.startsWith('MIN(')) {
    const range = expr.match(/MIN\(([A-Z])([0-9]+):([A-Z])([0-9]+)\)/);
    if (range) {
      const startCol = range[1];
      const startRow = parseInt(range[2]) - 1;
      const endCol = range[3];
      const endRow = parseInt(range[4]) - 1;
      
      const startColIndex = startCol.charCodeAt(0) - 65;
      const endColIndex = endCol.charCodeAt(0) - 65;
      
      let min = Infinity;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startColIndex; c <= endColIndex; c++) {
          if (r < grid.length && c < grid[r].length) {
            const cellValue = grid[r][c].computedValue;
            const numValue = typeof cellValue === 'number' ? cellValue : 
                            (typeof cellValue === 'string' && !isNaN(Number(cellValue)) ? Number(cellValue) : Infinity);
            if (numValue < min) {
              min = numValue;
            }
          }
        }
      }
      return min === Infinity ? 0 : min;
    }
  }
  
  // MAX function
  if (expr.startsWith('MAX(')) {
    const range = expr.match(/MAX\(([A-Z])([0-9]+):([A-Z])([0-9]+)\)/);
    if (range) {
      const startCol = range[1];
      const startRow = parseInt(range[2]) - 1;
      const endCol = range[3];
      const endRow = parseInt(range[4]) - 1;
      
      const startColIndex = startCol.charCodeAt(0) - 65;
      const endColIndex = endCol.charCodeAt(0) - 65;
      
      let max = -Infinity;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startColIndex; c <= endColIndex; c++) {
          if (r < grid.length && c < grid[r].length) {
            const cellValue = grid[r][c].computedValue;
            const numValue = typeof cellValue === 'number' ? cellValue : 
                            (typeof cellValue === 'string' && !isNaN(Number(cellValue)) ? Number(cellValue) : -Infinity);
            if (numValue > max) {
              max = numValue;
            }
          }
        }
      }
      return max === -Infinity ? 0 : max;
    }
  }
  
  // Basic arithmetic
  if (expr.includes('+') || expr.includes('-') || expr.includes('*') || expr.includes('/')) {
    // Use a simpler approach without complex regex replace
    let evalExpr = expr;
    
    // Manually find and replace cell references
    const cellPattern = /([A-Z])(\d+)/g;
    let match;
    
    // Create a copy of matches to avoid infinite loop
    const matches: Array<{match: string, replacement: string}> = [];
    while ((match = cellPattern.exec(expr)) !== null) {
      const col = match[1];
      const row = parseInt(match[2]) - 1;
      const colIndex = col.charCodeAt(0) - 65;
      
      let replacement = '0';
      if (row < grid.length && colIndex < grid[row].length) {
        const cellVal = grid[row][colIndex].computedValue;
        if (typeof cellVal === 'number') {
          replacement = cellVal.toString();
        } else if (typeof cellVal === 'string' && !isNaN(Number(cellVal))) {
          replacement = cellVal;
        }
      }
      
      matches.push({ match: match[0], replacement });
    }
    
    // Replace all matches
    matches.forEach(({ match, replacement }) => {
      evalExpr = evalExpr.replace(new RegExp(match, 'g'), replacement);
    });
    
    // Clean up expression - remove any non-numeric/non-operator characters
    evalExpr = evalExpr.replace(/[^0-9+\-*/().]/g, '');
    
    try {
      // Safer evaluation using Function constructor
      const result = Function('"use strict"; return (' + evalExpr + ')')();
      return typeof result === 'number' && !isNaN(result) ? result : '#ERROR';
    } catch {
      return '#ERROR';
    }
  }
  
  // Cell reference (single cell)
  const cellRef = expr.match(/^([A-Z])([0-9]+)$/);
  if (cellRef) {
    const col = cellRef[1];
    const row = parseInt(cellRef[2]) - 1;
    const colIndex = col.charCodeAt(0) - 65;
    
    if (row < grid.length && colIndex < grid[row].length) {
      const val = grid[row][colIndex].computedValue;
      return val || '';
    }
  }
  
  // Try to evaluate as a simple number
  const simpleNumber = parseFloat(expr);
  if (!isNaN(simpleNumber)) {
    return simpleNumber;
  }
  
  return '#ERROR';
};

const updateDependentCells = (grid: ExcelCell[][]) => {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.isFormula && cell.formula) {
        try {
          cell.computedValue = evaluateFormula(cell.formula, grid);
        } catch (error) {
          console.error('Error evaluating formula:', cell.formula, error);
          cell.computedValue = '#ERROR';
        }
      }
    }
  }
};

const getColumnLetter = (index: number): string => {
  return String.fromCharCode(65 + index);
};

const clearGrid = () => {
  const newGrid = [...excelGrid.map(row => [...row])];
  for (let r = 0; r < newGrid.length; r++) {
    for (let c = 0; c < newGrid[r].length; c++) {
      newGrid[r][c] = {
        ...newGrid[r][c],
        value: '',
        isFormula: false,
        formula: undefined,
        computedValue: ''
      };
    }
  }
  setExcelGrid(newGrid);
};

const exportToCSV = () => {
  let csv = '';
  
  // Add headers
  const headers = ['', ...Array.from({ length: 10 }, (_, i) => getColumnLetter(i))];
  csv += headers.join(',') + '\n';
  
  // Add rows
  excelGrid.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const rowData = [rowNumber, ...row.map(cell => cell.computedValue || '')];
    csv += rowData.join(',') + '\n';
  });
  
  // Create download link
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quotation_notes.csv';
  a.click();
  window.URL.revokeObjectURL(url);
  
  showToast('CSV exported successfully!', 'success');
};

const importFromCSV = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').slice(1); // Skip header row
        
        const newGrid = [...excelGrid.map(row => [...row])];
        
        lines.forEach((line, rowIndex) => {
          if (rowIndex >= 5) return; // Only process first 5 rows
          
          const cells = line.split(',').slice(1); // Skip row number
          cells.forEach((cell, colIndex) => {
            if (colIndex >= 10) return; // Only process first 10 columns
            
            if (rowIndex < newGrid.length && colIndex < newGrid[rowIndex].length) {
              updateCell(rowIndex, colIndex, cell.trim());
            }
          });
        });
        
        showToast('CSV imported successfully!', 'success');
      } catch (error) {
        showToast('Error importing CSV file', 'error');
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
};

// Add this function to your handleSubmit to include Excel data in submission
const getExcelDataAsText = () => {
  let text = '';
  excelGrid.forEach((row, rowIndex) => {
    const rowValues = row.map(cell => cell.computedValue || '').filter(val => val !== '');
    if (rowValues.length > 0) {
      text += `Row ${rowIndex + 1}: ${rowValues.join(' | ')}\n`;
    }
  });
  return text.trim();
};

  const [formData, setFormData] = useState<FormData>({
    quotation_code: generateQuotationCode(),
    quotation_date: new Date().toISOString().split("T")[0],
    expire_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "open",
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
    other_charges_total: 0,
    validity_days: 30
  });

  const [items, setItems] = useState<QuotationItem[]>([
    { 
      product_id: "", 
      hsn_code: "", 
      description: "", 
      quantity: 1, 
      unit: "unit", 
      unit_price: 0, 
      discount_percent: 0, 
      gst_rate: 18 
    }
  ]);

  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([
    { id: Date.now().toString(), name: "", amount: 0, type: "fixed", tax: 18 }
  ]);

  const [globalDiscount, setGlobalDiscount] = useState({
    value: 0,
    type: "percentage" as "percentage" | "fixed"
  });

  // Helper function to show toast
  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove toast after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Prepare options
  const productOptions = useMemo(() => 
    products.map((product) => ({
      value: product.id,
      label: product.name,
      hsn_code: product.hsn || product.hsn_code || "",
      description: product.description,
      unit_price: product.unit_price || product.sales_price || 0,
      discount_percent: product.discount || 0,
      gst_rate: product.tax_rate || product.gst_rate || 18
    })), [products]);

const customerOptions = useMemo(() => 
  customers.map((customer) => ({
    value: customer.id,
    label: `${customer.name}${customer.phone ? ` (${customer.phone})` : ''}${customer.email ? ` - ${customer.email}` : ''}`,
    data: customer // Store the full customer object
  })), [customers]);

  const salesmanOptions = useMemo(() => 
    salesmen.map((salesman) => ({
      value: salesman.id,
      label: salesman.name
    })), [salesmen]);

 const contactPersonOptions = useMemo(() => 
  contactPersons
    .filter(person => !selectedCustomer || person.customer_id === selectedCustomer.id)
    .map((person) => ({
      value: person.id,
      label: `${person.name} ${person.email ? `- ${person.email}` : ''} ${person.phone ? `- ${person.phone}` : ''}`,
      person
    })), [contactPersons, selectedCustomer]);


// Alternative API endpoint
const fetchContactPersons = async (customerId: string) => {
  if (!company?.id) return;
  try {
    // Use this endpoint for contact persons
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/contact-persons?customer_id=${customerId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log("Contact persons response:", data);
      
      // Handle response based on your actual API structure
      let persons: ContactPerson[] = [];
      
      if (Array.isArray(data)) {
        persons = data;
      } else if (data && typeof data === 'object') {
        persons = data.contact_persons || data.data || data.items || [];
      }
      
      setContactPersons(persons);
      
      // Auto-select first contact person if available
      if (persons.length > 0) {
        const firstPerson = persons[0];
        setSelectedContactPerson(firstPerson);
        setFormData(prev => ({
          ...prev,
          contact_person: firstPerson.name || ""
        }));
      }
    }
  } catch (error) {
    console.error("Failed to fetch contact persons:", error);
    setContactPersons([]);
  }
};

useEffect(() => {
  const fetchData = async () => {
    if (!company?.id) return;
    try {
      setLoading(true);
      
      // Fetch customers
      const customersData = await customersApi.list(company.id, { page_size: 100 });
      console.log("Customers API response:", customersData); // Debug log
      
      // Handle different response structures
      let customersArray: Customer[] = [];
      if (Array.isArray(customersData)) {
        customersArray = customersData;
      } else if (customersData && typeof customersData === 'object') {
        // Try different possible response structures
        customersArray = (customersData as any).customers || 
                        (customersData as any).data || 
                        (customersData as any).items || 
                        [];
      }
      
      // Fetch products
      const productsData = await productsApi.list(company.id, { page_size: 100 });
      const productsArray: Product[] = Array.isArray(productsData) ? productsData : 
                                      (productsData as any)?.products || 
                                      (productsData as any)?.data || 
                                      [];
      
      // Fetch salesmen
      const salesmenData = await salesmenApi.list(company.id, { page_size: 100 });
      const salesmenArray: Salesman[] = Array.isArray(salesmenData) ? salesmenData : 
                                       (salesmenData as any)?.salesmen || 
                                       (salesmenData as any)?.data || 
                                       [];

      setCustomers(customersArray);
      setProducts(productsArray);
      setSalesmen(salesmenArray);

      showToast("Data loaded successfully", "success");
    } catch (error) {
      console.error("Failed to fetch data:", error);
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [company?.id]);

  // Calculate item total based on your Laravel logic
  const calculateItemTotal = useCallback((item: QuotationItem) => {
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = subtotal * (item.discount_percent / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (item.gst_rate / 100);
    const total = taxableAmount + taxAmount;
    
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  }, []);

  // Calculate all totals based on your Laravel logic
  const totals = useMemo(() => {
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

      // Calculate tax based on tax regime - using gst_rate from item
      if (formData.tax_regime === "cgst_sgst") {
        totalCgst += itemCalc.taxAmount / 2;
        totalSgst += itemCalc.taxAmount / 2;
      } else if (formData.tax_regime === "igst") {
        totalIgst += itemCalc.taxAmount;
      }
    });

    // Calculate other charges (handled separately in backend)
    let otherChargesTotal = 0;
    otherCharges.forEach(charge => {
      if (!charge.name.trim() && charge.amount === 0) return;
      
      let chargeAmount = charge.amount;
      if (charge.type === "percentage") {
        chargeAmount = totalTaxable * (charge.amount / 100);
      }
      
      const chargeTax = chargeAmount * (charge.tax / 100);
      const chargeTotal = chargeAmount + chargeTax;
      otherChargesTotal += chargeTotal;

      if (formData.tax_regime === "cgst_sgst") {
        totalCgst += chargeTax / 2;
        totalSgst += chargeTax / 2;
      } else if (formData.tax_regime === "igst") {
        totalIgst += chargeTax;
      }
    });

    const totalTax = totalCgst + totalSgst + totalIgst;
    const totalBeforeRoundOff = totalTaxable + otherChargesTotal + totalTax;
    const roundOff = Math.round(totalBeforeRoundOff) - totalBeforeRoundOff;
    const grandTotal = totalBeforeRoundOff + roundOff;

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
  }, [items, otherCharges, formData.tax_regime, calculateItemTotal]);

  const addItem = () => {
    setItems([...items, { 
      product_id: "", 
      hsn_code: "", 
      description: "", 
      quantity: 1, 
      unit: "unit", 
      unit_price: 0, 
      discount_percent: 0, 
      gst_rate: 18 
    }]);
    showToast("New item row added", "info");
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
      showToast("Item removed", "info");
    } else {
      showToast("At least one item is required", "warning");
    }
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    
    if (field === "product_id" && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index] = {
          ...newItems[index],
          product_id: value,
          hsn_code: product.hsn || product.hsn_code || "",
          description: product.description || product.name,
          unit_price: product.unit_price || product.sales_price || 0,
          discount_percent: product.discount || 0,
          gst_rate: product.tax_rate || product.gst_rate || 18
        };
      }
    } else if (field === "gst_rate") {
      // Ensure gst_rate is a number
      newItems[index] = { ...newItems[index], [field]: Number(value) };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    setItems(newItems);
  };

  const addOtherCharge = () => {
    setOtherCharges([...otherCharges, { 
      id: Date.now().toString(), 
      name: "", 
      amount: 0, 
      type: "fixed", 
      tax: 18 
    }]);
  };

  const removeOtherCharge = (id: string) => {
    if (otherCharges.length > 1) {
      setOtherCharges(otherCharges.filter(charge => charge.id !== id));
    }
  };

  const updateOtherCharge = (id: string, field: keyof OtherCharge, value: any) => {
    setOtherCharges(otherCharges.map(charge => 
      charge.id === id 
        ? { ...charge, [field]: value }
        : charge
    ));
  };

  const applyGlobalDiscount = () => {
    if (globalDiscount.value <= 0) {
      showToast("Please enter a discount value", "warning");
      return;
    }

    const newItems = items.map(item => {
      if (globalDiscount.type === "percentage") {
        const finalDiscount = Math.min(globalDiscount.value, 100);
        return { ...item, discount_percent: finalDiscount };
      } else {
        // For fixed discount, convert to percentage for this item
        const itemSubtotal = item.quantity * item.unit_price;
        const percentageDiscount = (globalDiscount.value / itemSubtotal) * 100;
        const finalDiscount = Math.min(percentageDiscount, 100);
        return { ...item, discount_percent: finalDiscount };
      }
    });

    setItems(newItems);
    showToast("Discount applied to all items", "success");
  };

 const handleCustomerChange = async (option: any) => {
  if (option) {
    const customer = option.data; // Use 'data' instead of 'customer'
    console.log("Selected customer:", customer);
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customer_id: option.value,
      contact_person: ""
    }));
    
    // Clear selected contact person
    setSelectedContactPerson(null);
    setContactPersons([]);
    
    // Fetch contact persons for this customer
    console.log("Fetching contact persons for customer:", customer.id);
    await fetchContactPersons(customer.id);
    
    // Set tax regime based on customer state
    if (customer.billing_state && company?.state) {
      const isSameState = customer.billing_state === company.state;
      setFormData(prev => ({
        ...prev,
        tax_regime: isSameState ? "cgst_sgst" : "igst"
      }));
    }
  } else {
    setSelectedCustomer(null);
    setSelectedContactPerson(null);
    setContactPersons([]);
    setFormData(prev => ({
      ...prev,
      customer_id: "",
      contact_person: "",
      tax_regime: ""
    }));
  }
};
  const handleContactPersonChange = (option: any) => {
  if (option) {
    const contactPerson = option.person;
    setSelectedContactPerson(contactPerson);
    setFormData(prev => ({
      ...prev,
      contact_person: contactPerson.name || ""
    }));
  } else {
    setSelectedContactPerson(null);
    setFormData(prev => ({
      ...prev,
      contact_person: ""
    }));
  }
};

// Add this debug function
const debugCustomersApi = async () => {
  if (!company?.id) return;
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${company.id}/customers`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      }
    );
    const data = await response.json();
    console.log("Direct API customers response:", data);
  } catch (error) {
    console.error("Debug API error:", error);
  }
};

// Call it in useEffect
useEffect(() => {
  debugCustomersApi();
  fetchData();
}, [company?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.customer_id) {
      errors.push("Please select a customer");
    }

    if (!formData.contact_person.trim()) {
      errors.push("Please select a contact person");
    }

    if (!formData.salesman_id) {
      errors.push("Please select a sales engineer");
    }

    if (!formData.quotation_code.trim()) {
      errors.push("Please enter quotation number");
    }

    // Validate items
    const validItems = items.filter(item => 
      item.quantity > 0 && item.unit_price >= 0
    );

    if (validItems.length === 0) {
      errors.push("Please add at least one valid item");
    }

    // Validate other charges
    otherCharges.forEach((charge, index) => {
      if (charge.name.trim() === "" && charge.amount > 0) {
        errors.push(`Other Charge ${index + 1}: Please enter charge name`);
      }
    });

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => showToast(error, "error"));
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!company?.id || !token) {
      showToast("Authentication required", "error");
      return;
    }

    setLoading(true);

    try {
      // Prepare items for backend - matching the QuotationItemCreate schema
      const itemsForBackend = items.filter(item => item.quantity > 0 && item.unit_price >= 0)
        .map(item => ({
          product_id: item.product_id || undefined,
          description: item.description || "Item",
          hsn_code: item.hsn_code || "",
          quantity: item.quantity,
          unit: item.unit || "unit",
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_rate: item.gst_rate
        }));

      // Prepare payload matching your backend QuotationCreate schema
      const payload = {
        customer_id: formData.customer_id || undefined,
        quotation_date: new Date(formData.quotation_date).toISOString(),
        validity_days: formData.validity_days,
        place_of_supply: selectedCustomer?.billing_state || undefined,
        subject: `Quotation ${formData.quotation_code}`,
        notes: formData.notes || formData.payment_terms || undefined,
        terms: formData.terms || formData.description || undefined,
        items: itemsForBackend
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
        showToast("Quotation created successfully!", "success");
        router.push(`/quotations/${data.id}`);
      } else {
        const errorData = await response.json();
        console.error("Backend error:", errorData);
        showToast(errorData.detail || "Failed to create quotation", "error");
      }
    } catch (err) {
      console.error("Submission error:", err);
      showToast("Failed to create quotation", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (items.some(item => item.product_id) || formData.customer_id) {
      if (window.confirm("Are you sure? Any unsaved changes will be lost.")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast Container */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Create New Quotation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create a detailed quotation for your customer
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Form Sections */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Quotation Details */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Quotation Details
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quotation No *
                    </label>
                    <input
                      type="text"
                      value={formData.quotation_code}
                      onChange={(e) => setFormData({ ...formData, quotation_code: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.quotation_date}
                      onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Validity Days
                    </label>
                    <input
                      type="number"
                      value={formData.validity_days}
                      onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) || 30 })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
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

              {/* Customer Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Customer Information
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push("/customers/new")}
                    className="mt-2 sm:mt-0 inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-900/20"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Customer
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Customer *
                    </label>
                    <Select
                      options={customerOptions}
                      onChange={handleCustomerChange}
                      placeholder="Search Customer..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isLoading={loading}
                      isClearable
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contact Person *
                    </label>
                    <Select
                      options={contactPersonOptions}
                      value={contactPersonOptions.find(opt => opt.value === selectedContactPerson?.id)}
                      onChange={handleContactPersonChange}
                      placeholder={selectedCustomer ? "Select Contact Person..." : "Please select a customer first"}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isLoading={loading}
                      isClearable
                      isDisabled={!selectedCustomer}
                    />
                    {selectedCustomer && contactPersonOptions.length === 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        No contact persons found for this customer. Please add contact persons in the customer management section.
                      </p>
                    )}
                  </div>

                  {selectedContactPerson && (
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 space-y-3">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Email
                          </label>
                          <input
                            type="text"
                            value={selectedContactPerson.email || ""}
                            readOnly
                            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Phone
                          </label>
                          <input
                            type="text"
                            value={selectedContactPerson.phone || ""}
                            readOnly
                            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Sales & Reference */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Sales & Reference
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sales Engineer *
                    </label>
                    <Select
                      options={salesmanOptions}
                      onChange={(option) => setFormData({ ...formData, salesman_id: option?.value || "" })}
                      placeholder="Search Sales Engineer..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isLoading={loading}
                      isClearable
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reference
                      </label>
                      <input
                        type="text"
                        value={formData.reference}
                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reference No
                      </label>
                      <input
                        type="text"
                        value={formData.reference_no}
                        onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Reference Date
                    </label>
                    <input
                      type="date"
                      value={formData.reference_date}
                      onChange={(e) => setFormData({ ...formData, reference_date: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Details Section */}
              {selectedCustomer && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Customer Details
                  </h2>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={selectedCustomer.name || ""}
                          readOnly
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          GST No
                        </label>
                        <input
                          type="text"
                          value={selectedCustomer.gstin || ""}
                          readOnly
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        type="text"
                        value={selectedCustomer.email || ""}
                        readOnly
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Phone
                        </label>
                        <input
                          type="text"
                          value={selectedCustomer.phone || selectedCustomer.mobile || ""}
                          readOnly
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          State
                        </label>
                        <input
                          type="text"
                          value={selectedCustomer.billing_state || ""}
                          readOnly
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        GST Regime
                      </label>
                      <select
                        value={formData.tax_regime}
                        onChange={(e) => setFormData({ ...formData, tax_regime: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                      >
                        <option value="">Select GST Regime...</option>
                        <option value="cgst_sgst">CGST + SGST</option>
                        <option value="igst">IGST</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formData.tax_regime === "cgst_sgst" 
                          ? "Same state - CGST + SGST applicable" 
                          : formData.tax_regime === "igst"
                          ? "Interstate - IGST applicable"
                          : "Select based on customer location"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tax Type Section */}
           
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Items
              </h2>
              <div className="flex gap-2 mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={() => router.push("/products/new")}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-900/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Item
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      HSN Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Qty *
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Unit Price *
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Discount %
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      GST %
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <Select
                          options={productOptions}
                          value={productOptions.find(opt => opt.value === item.product_id)}
                          onChange={(option) => updateItem(index, "product_id", option?.value || "")}
                          placeholder="Search Item..."
                          className="react-select-container"
                          classNamePrefix="react-select"
                          isClearable
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.hsn_code}
                          onChange={(e) => updateItem(index, "hsn_code", e.target.value)}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                          placeholder="HSN Code"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                          rows={1}
                          placeholder="Description"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          min={0.01}
                          step={0.01}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
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
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.discount_percent}
                          onChange={(e) => updateItem(index, "discount_percent", parseFloat(e.target.value) || 0)}
                          min={0}
                          max={100}
                          step={0.01}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.gst_rate}
                          onChange={(e) => updateItem(index, "gst_rate", Number(e.target.value) || 0)}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
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
                          value={formatCurrency(calculateItemTotal(item).total)}
                          readOnly
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium"
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
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Terms & Conditions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Terms & Conditions
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Remarks (Notes)
                  </label>
                  <textarea
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter payment terms or notes..."
                  />
                </div>
                <div>
                 {/* Excel-like Grid for Additional Notes */}
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      Additional Notes (Excel Grid)
    </h2>
    <div className="flex gap-2 mt-2 sm:mt-0">
      <button
        type="button"
        onClick={clearGrid}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear Grid
      </button>
      <button
        type="button"
        onClick={importFromCSV}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-900/20"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Import CSV
      </button>
      <button
        type="button"
        onClick={exportToCSV}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export CSV
      </button>
    </div>
  </div>

  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Available Formulas:</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
      <code className="bg-gray-100 dark:bg-gray-800 p-2 rounded">=SUM(A1:C3)</code>
      <code className="bg-gray-100 dark:bg-gray-800 p-2 rounded">=AVG(A1:C3)</code>
      <code className="bg-gray-100 dark:bg-gray-800 p-2 rounded">=COUNT(A1:C3)</code>
      <code className="bg-gray-100 dark:bg-gray-800 p-2 rounded">=MIN(A1:C3)</code>
      <code className="bg-gray-100 dark:bg-gray-800 p-2 rounded">=MAX(A1:C3)</code>
      <code className="bg-gray-100 dark:bg-gray-800 p-2 rounded">=A1+B2*C3</code>
    </div>
  </div>

  <div className="overflow-x-auto">
    <div className="inline-block min-w-full">
      {/* Header Row */}
      <div className="flex border-b border-gray-300 dark:border-gray-600">
        <div className="w-12 flex items-center justify-center border-r border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">#</span>
        </div>
        {Array.from({ length: 10 }).map((_, colIndex) => (
          <div key={colIndex} className="w-32 flex items-center justify-center border-r border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-2 last:border-r-0">
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {getColumnLetter(colIndex)}
            </span>
          </div>
        ))}
      </div>

      {/* Data Rows */}
      {excelGrid.map((row, rowIndex) => (
        <div key={rowIndex} className="flex border-b border-gray-300 dark:border-gray-600 last:border-b-0">
          {/* Row Number */}
          <div className="w-12 flex items-center justify-center border-r border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {rowIndex + 1}
            </span>
          </div>

          {/* Cells */}
          {row.map((cell, colIndex) => (
            <div key={cell.id} className="w-32 border-r border-gray-300 dark:border-gray-600 last:border-r-0">
              <input
                type="text"
                value={cell.value}
                onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                placeholder={`${getColumnLetter(colIndex)}${rowIndex + 1}`}
                className={`w-full h-full px-3 py-2 text-sm border-0 focus:ring-2 focus:ring-blue-500 focus:z-10 ${
                  cell.isFormula 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-gray-800'
                } ${cell.computedValue === '#ERROR' ? 'text-red-600 dark:text-red-400' : ''}`}
                title={cell.isFormula ? `Formula: ${cell.formula}` : cell.value}
              />
              {cell.isFormula && cell.computedValue !== '#ERROR' && (
                <div className="text-xs text-gray-500 dark:text-gray-400 px-2 pb-1 truncate">
                  ={cell.computedValue}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>

  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
    <p>• Start with = for formulas (e.g., =SUM(A1:C3), =A1+B2)</p>
    <p>• Use column letters (A-J) and row numbers (1-5)</p>
    <p>• Supports: SUM, AVG, COUNT, MIN, MAX, and basic math operations</p>
  </div>
</div>
                </div>
              </div>
            </div>

            {/* Summary Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Summary
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Items</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{totals.totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Quantity</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{totals.totalQuantity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totals.subtotal)}</span>
                </div>

                {/* Global Discount */}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">All Items Discount</span>
                  <div className="text-right">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="number"
                        value={globalDiscount.value}
                        onChange={(e) => setGlobalDiscount({ ...globalDiscount, value: parseFloat(e.target.value) || 0 })}
                        className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                        min={0}
                      />
                      <select
                        value={globalDiscount.type}
                        onChange={(e) => setGlobalDiscount({ ...globalDiscount, type: e.target.value as "percentage" | "fixed" })}
                        className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">₹</option>
                      </select>
                      <button
                        type="button"
                        onClick={applyGlobalDiscount}
                        className="rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                      >
                        Apply
                      </button>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalDiscount)}</span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Taxable Amount</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalTaxable)}</span>
                </div>

                {/* Other Charges */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Other Charges</h3>
                    <button
                      type="button"
                      onClick={addOtherCharge}
                      className="rounded border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-900/20"
                    >
                      Add Charge
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {otherCharges.map((charge) => (
                      <div key={charge.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={charge.name}
                          onChange={(e) => updateOtherCharge(charge.id, "name", e.target.value)}
                          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm"
                          placeholder="Charge Name"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={charge.amount}
                            onChange={(e) => updateOtherCharge(charge.id, "amount", parseFloat(e.target.value) || 0)}
                            className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm"
                            min={0}
                            step={0.01}
                          />
                          <select
                            value={charge.type}
                            onChange={(e) => updateOtherCharge(charge.id, "type", e.target.value as "fixed" | "percentage")}
                            className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                          >
                            <option value="fixed">₹</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                        <select
                          value={charge.tax}
                          onChange={(e) => updateOtherCharge(charge.id, "tax", Number(e.target.value) || 0)}
                          className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeOtherCharge(charge.id)}
                          className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">CGST</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalCgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">SGST</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalSgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">IGST</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totals.totalIgst)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                  <span className="font-semibold text-gray-900 dark:text-white">Total Tax</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(totals.totalTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Round Off</span>
                  <span className={`text-sm font-medium ${totals.roundOff > 0 ? 'text-green-600' : totals.roundOff < 0 ? 'text-red-600' : 'text-gray-900'} dark:text-white`}>
                    {totals.roundOff > 0 ? '+' : ''}{formatCurrency(totals.roundOff)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                  <span className="font-bold text-gray-900 dark:text-white">Grand Total</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-500">{formatCurrency(totals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-3 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-8 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
      </div>

      {/* Custom styles for react-select */}
      <style jsx global>{`
        .react-select-container {
          width: 100%;
        }
        .react-select__control {
          border: 1px solid #d1d5db;
          background-color: white;
          min-height: 42px;
          border-radius: 0.5rem;
        }
        .dark .react-select__control {
          border-color: #4b5563;
          background-color: #374151;
        }
        .react-select__menu {
          z-index: 50;
        }
        .react-select__single-value {
          color: #111827;
        }
        .dark .react-select__single-value {
          color: #fff;
        }
        .react-select__placeholder {
          color: #6b7280;
        }
        .dark .react-select__placeholder {
          color: #9ca3af;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}