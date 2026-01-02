"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import dayjs from "dayjs";
import {
  quickEntryApi,
  QuickEntry,
  QuickEntryCreate,
  QuickEntryOptions,
  getErrorMessage,
} from "@/services/api";

type EntryType = "money_in" | "money_out" | "transfer";

// Income categories
const INCOME_CATEGORIES = [
  { value: "sale", label: "Sales" },
  { value: "service_income", label: "Service Income" },
  { value: "interest_income", label: "Interest Received" },
  { value: "other_income", label: "Other Income" },
];

// Expense categories
const EXPENSE_CATEGORIES = [
  { value: "purchase", label: "Purchase" },
  { value: "salary", label: "Salary & Wages" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities (Electricity, Water)" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "travel", label: "Travel & Conveyance" },
  { value: "telephone", label: "Phone & Internet" },
  { value: "professional_fees", label: "Professional Fees" },
  { value: "bank_charges", label: "Bank Charges" },
  { value: "insurance", label: "Insurance" },
  { value: "repairs", label: "Repairs & Maintenance" },
  { value: "marketing", label: "Marketing & Ads" },
  { value: "other_expense", label: "Other Expense" },
];

export default function QuickEntryPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Options
  const [options, setOptions] = useState<QuickEntryOptions | null>(null);

  // Form state
  const [entryType, setEntryType] = useState<EntryType>("money_in");
  const [amount, setAmount] = useState<string>("");
  const [entryDate, setEntryDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [category, setCategory] = useState("");
  const [partyId, setPartyId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [gstRate, setGstRate] = useState<string>("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  // Cheque fields
  const [chequeNumber, setChequeNumber] = useState("");
  const [drawerName, setDrawerName] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [drawnOnBank, setDrawnOnBank] = useState("");
  const [drawnOnBranch, setDrawnOnBranch] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  // Recent entries
  const [recentEntries, setRecentEntries] = useState<QuickEntry[]>([]);

  useEffect(() => {
    if (company?.id) {
      fetchOptions();
      fetchRecentEntries();
    }
  }, [company?.id]);

  const fetchOptions = async () => {
    try {
      const data = await quickEntryApi.getOptions(company!.id);
      setOptions(data);
      
      // Set default payment account
      if (data.payment_accounts.length > 0) {
        const cashAccount = data.payment_accounts.find((a) => a.type === "cash");
        if (cashAccount) {
          setPaymentAccountId(cashAccount.id);
        }
      }
    } catch (err) {
      console.error("Failed to load options:", err);
    }
  };

  const fetchRecentEntries = async () => {
    try {
      const entries = await quickEntryApi.list(company!.id, { limit: 10 });
      setRecentEntries(entries);
    } catch (err) {
      console.error("Failed to load recent entries:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (entryType === "transfer" && (!fromAccountId || !toAccountId)) {
      setError("Please select both From and To accounts for transfer");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const data: QuickEntryCreate = {
        entry_type: entryType,
        amount: parseFloat(amount),
        entry_date: entryDate,
        category: category || undefined,
        party_id: partyId || undefined,
        party_type: partyId ? (entryType === "money_in" ? "customer" : "vendor") : undefined,
        payment_account_id: paymentAccountId || undefined,
        payment_mode: paymentMode || undefined,
        description: description || undefined,
        reference_number: referenceNumber || undefined,
        gst_rate: gstRate ? parseFloat(gstRate) : undefined,
        from_account_id: fromAccountId || undefined,
        to_account_id: toAccountId || undefined,
        cheque_number: paymentMode === "cheque" ? chequeNumber || undefined : undefined,
        drawer_name: paymentMode === "cheque" && entryType === "money_in" ? drawerName || undefined : undefined,
        payee_name: paymentMode === "cheque" && entryType === "money_out" ? payeeName || undefined : undefined,
        drawn_on_bank: paymentMode === "cheque" && entryType === "money_in" ? drawnOnBank || undefined : undefined,
        drawn_on_branch: paymentMode === "cheque" && entryType === "money_in" ? drawnOnBranch || undefined : undefined,
        bank_account_id: paymentMode === "cheque" && entryType === "money_out" ? bankAccountId || undefined : undefined,
      };

      await quickEntryApi.create(company!.id, data);

      // Show success
      const typeLabel = entryType === "money_in" ? "Income" : entryType === "money_out" ? "Expense" : "Transfer";
      setSuccess(`${typeLabel} of ₹${parseFloat(amount).toLocaleString("en-IN")} recorded!`);

      // Reset form
      setAmount("");
      setCategory("");
      setPartyId("");
      setDescription("");
      setReferenceNumber("");
      setGstRate("");
      setChequeNumber("");
      setDrawerName("");
      setPayeeName("");
      setDrawnOnBank("");
      setDrawnOnBranch("");
      setBankAccountId("");

      // Refresh recent entries
      fetchRecentEntries();

      // Auto-clear success after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save entry"));
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const categories = entryType === "money_in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Quick Entry</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Simple money in/out tracking - we handle the accounting
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Entry Form */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
            {/* Entry Type Selector */}
            <div className="flex border-b border-stroke dark:border-dark-3">
              <button
                type="button"
                onClick={() => setEntryType("money_in")}
                className={`flex-1 px-6 py-4 text-center font-medium transition ${
                  entryType === "money_in"
                    ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-dark-2"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
                  </svg>
                  Money In
                </div>
              </button>
              <button
                type="button"
                onClick={() => setEntryType("money_out")}
                className={`flex-1 px-6 py-4 text-center font-medium transition ${
                  entryType === "money_out"
                    ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-dark-2"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l4-4m-4 4l-4-4" />
                  </svg>
                  Money Out
                </div>
              </button>
              <button
                type="button"
                onClick={() => setEntryType("transfer")}
                className={`flex-1 px-6 py-4 text-center font-medium transition ${
                  entryType === "transfer"
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-dark-2"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Transfer
                </div>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                  {success}
                </div>
              )}

              {/* Amount - Big and prominent */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-500">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-stroke bg-transparent py-4 pl-12 pr-4 text-3xl font-bold text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Date and Category Row */}
              <div className="mb-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  />
                </div>

                {entryType !== "transfer" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Transfer specific fields */}
              {entryType === "transfer" && options && (
                <div className="mb-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      From Account *
                    </label>
                    <select
                      value={fromAccountId}
                      onChange={(e) => setFromAccountId(e.target.value)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      required
                    >
                      <option value="">Select account</option>
                      {options.payment_accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      To Account *
                    </label>
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      required
                    >
                      <option value="">Select account</option>
                      {options.payment_accounts
                        .filter((acc) => acc.id !== fromAccountId)
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Party and Payment for non-transfer */}
              {entryType !== "transfer" && (
                <>
                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                        {entryType === "money_in" ? "From (Customer)" : "To (Vendor)"}
                      </label>
                      <select
                        value={partyId}
                        onChange={(e) => setPartyId(e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      >
                        <option value="">Select (optional)</option>
                        {options?.parties
                          .filter((p) =>
                            entryType === "money_in"
                              ? p.type === "customer"
                              : p.type === "vendor"
                          )
                          .map((party) => (
                            <option key={party.id} value={party.id}>
                              {party.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="upi">UPI</option>
                        <option value="cheque">Cheque</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  {/* GST for income/expense */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                      GST Rate (if applicable)
                    </label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(e.target.value)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    >
                      <option value="">No GST</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>
                </>
              )}

              {/* Description */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  placeholder="e.g., Office rent for December"
                />
              </div>

              {/* Reference Number */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Reference / Invoice No.
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  placeholder="e.g., INV-001 or TXN12345"
                />
              </div>

              {/* Cheque Fields - Show when cheque is selected */}
              {paymentMode === "cheque" && entryType !== "transfer" && (
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <h3 className="mb-3 text-sm font-semibold text-blue-700 dark:text-blue-400">
                    Cheque Details
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                        Cheque Number *
                      </label>
                      <input
                        type="text"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                        placeholder="e.g., 123456"
                        required={paymentMode === "cheque"}
                      />
                    </div>
                    {entryType === "money_in" ? (
                      <>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                            Drawer Name *
                          </label>
                          <input
                            type="text"
                            value={drawerName}
                            onChange={(e) => setDrawerName(e.target.value)}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                            placeholder="Name on cheque"
                            required={paymentMode === "cheque" && entryType === "money_in"}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                            Drawn On Bank
                          </label>
                          <input
                            type="text"
                            value={drawnOnBank}
                            onChange={(e) => setDrawnOnBank(e.target.value)}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                            placeholder="Bank name"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                            Branch
                          </label>
                          <input
                            type="text"
                            value={drawnOnBranch}
                            onChange={(e) => setDrawnOnBranch(e.target.value)}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                            placeholder="Branch name"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                            Payee Name *
                          </label>
                          <input
                            type="text"
                            value={payeeName}
                            onChange={(e) => setPayeeName(e.target.value)}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                            placeholder="Payee name"
                            required={paymentMode === "cheque" && entryType === "money_out"}
                          />
                        </div>
                        {options && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                              Bank Account (for cheque book)
                            </label>
                            <select
                              value={bankAccountId}
                              onChange={(e) => setBankAccountId(e.target.value)}
                              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                            >
                              <option value="">Select bank account</option>
                              {options.payment_accounts
                                .filter((acc) => acc.type === "bank")
                                .map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className={`w-full rounded-xl py-4 text-lg font-semibold text-white transition ${
                  entryType === "money_in"
                    ? "bg-green-600 hover:bg-green-700"
                    : entryType === "money_out"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } disabled:opacity-50`}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  <>
                    {entryType === "money_in" && "Record Income"}
                    {entryType === "money_out" && "Record Expense"}
                    {entryType === "transfer" && "Transfer Funds"}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Recent Entries Sidebar */}
        <div>
          <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-dark">
            <div className="border-b border-stroke px-4 py-3 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">Recent Entries</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {recentEntries.length > 0 ? (
                <div className="divide-y divide-stroke dark:divide-dark-3">
                  {recentEntries.map((entry) => (
                    <div key={entry.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              entry.entry_type === "money_in"
                                ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                                : entry.entry_type === "money_out"
                                ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                            }`}
                          >
                            {entry.entry_type === "money_in" ? (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
                              </svg>
                            ) : entry.entry_type === "money_out" ? (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l4-4m-4 4l-4-4" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-dark dark:text-white">
                              {entry.description || entry.category || entry.entry_type.replace("_", " ")}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {dayjs(entry.entry_date).format("DD MMM")}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-semibold ${
                            entry.entry_type === "money_in"
                              ? "text-green-600"
                              : entry.entry_type === "money_out"
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {entry.entry_type === "money_in" ? "+" : entry.entry_type === "money_out" ? "-" : ""}
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  <p>No entries yet</p>
                  <p className="mt-1 text-sm">Start by adding your first entry!</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tips */}
          <div className="mt-4 rounded-lg border border-stroke bg-blue-50 p-4 dark:border-dark-3 dark:bg-blue-900/20">
            <h4 className="mb-2 font-medium text-blue-700 dark:text-blue-400">Tips</h4>
            <ul className="space-y-1 text-xs text-blue-600 dark:text-blue-300">
              <li>• Money In = Sales, payments received, income</li>
              <li>• Money Out = Expenses, purchases, payments made</li>
              <li>• Transfer = Move between Cash & Bank</li>
              <li>• GST is auto-calculated from amount</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
