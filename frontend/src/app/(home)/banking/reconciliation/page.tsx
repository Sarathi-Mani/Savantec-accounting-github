"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import dayjs from "dayjs";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
}

interface BookEntry {
  id: string;
  transaction_id: string;
  transaction_number: string;
  date: string;
  voucher_type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  bank_date: string | null;
  is_reconciled: boolean;
}

interface MonthlyRecon {
  id: string;
  year: number;
  month: number;
  period: string;
  first_day: string;
  last_day: string;
  opening_balance_bank: number;
  closing_balance_bank: number;
  opening_balance_book: number;
  closing_balance_book: number;
  total_debit: number;
  total_credit: number;
  net_movement: number;
  expected_bank_closing: number;
  actual_bank_closing: number;
  difference: number;
  cheques_issued_not_cleared: number;
  cheques_deposited_not_credited: number;
  bank_charges_not_booked: number;
  interest_not_booked: number;
  other_differences: number;
  status: string;
  notes: string;
}

interface BankStatementEntry {
  id: string;
  value_date: string;
  amount: number;
  description: string;
  bank_reference: string | null;
  status: string;
  matched_entry_id: string | null;
}

export default function BankReconciliationPage() {
  const { company } = useAuth();

  // State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [entries, setEntries] = useState<BookEntry[]>([]);
  const [monthlyRecon, setMonthlyRecon] = useState<MonthlyRecon | null>(null);
  const [bankStatementEntries, setBankStatementEntries] = useState<BankStatementEntry[]>([]);
  
  // Date filters
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"monthly" | "entries" | "match">("monthly");
  const [showAll, setShowAll] = useState(false);
  
  // Match state
  const [selectedBookEntry, setSelectedBookEntry] = useState<string | null>(null);
  const [selectedBankEntry, setSelectedBankEntry] = useState<string | null>(null);
  
  // Edit state
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editBankDate, setEditBankDate] = useState("");
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [monthlyForm, setMonthlyForm] = useState({
    opening_balance_bank: "",
    closing_balance_bank: "",
    notes: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchBankAccounts();
    }
  }, [company]);

  useEffect(() => {
    if (selectedAccount && company?.id) {
      fetchMonthlyReconciliation();
      fetchEntries();
      fetchBankStatementEntries();
    }
  }, [selectedAccount, selectedYear, selectedMonth]);

  const fetchBankAccounts = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/bank-accounts`);
      setBankAccounts(response.data);
      if (response.data.length > 0 && !selectedAccount) {
        setSelectedAccount(response.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    }
  };

  const fetchMonthlyReconciliation = async () => {
    if (!selectedAccount) return;
    
    setLoading(true);
    try {
      const response = await api.get(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/monthly-reconciliation/${selectedYear}/${selectedMonth}`
      );
      setMonthlyRecon(response.data);
      setMonthlyForm({
        opening_balance_bank: String(response.data.opening_balance_bank || ""),
        closing_balance_bank: String(response.data.closing_balance_bank || ""),
        notes: response.data.notes || "",
      });
    } catch (error: any) {
      console.error("Error fetching monthly reconciliation:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    if (!selectedAccount) return;
    
    try {
      const firstDay = dayjs(`${selectedYear}-${selectedMonth}-01`).format("YYYY-MM-DD");
      const lastDay = dayjs(`${selectedYear}-${selectedMonth}-01`).endOf("month").format("YYYY-MM-DD");
      
      const response = await api.get(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/unreconciled`,
        { params: { from_date: firstDay, to_date: lastDay } }
      );
      setEntries(response.data);
    } catch (error: any) {
      console.error("Error fetching entries:", error);
    }
  };

  const fetchBankStatementEntries = async () => {
    if (!selectedAccount) return;
    
    try {
      const firstDay = dayjs(`${selectedYear}-${selectedMonth}-01`).format("YYYY-MM-DD");
      const lastDay = dayjs(`${selectedYear}-${selectedMonth}-01`).endOf("month").format("YYYY-MM-DD");
      
      const response = await api.get(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/statement-entries`,
        { params: { from_date: firstDay, to_date: lastDay, status: "pending" } }
      );
      setBankStatementEntries(response.data);
    } catch (error: any) {
      console.error("Error fetching bank statement entries:", error);
    }
  };

  const handleManualMatch = async () => {
    if (!selectedBookEntry || !selectedBankEntry) return;
    
    try {
      setLoading(true);
      await api.post(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/statement-entries/${selectedBankEntry}/manual-match`,
        { book_entry_id: selectedBookEntry }
      );
      setSuccess("Entries matched successfully!");
      setSelectedBookEntry(null);
      setSelectedBankEntry(null);
      fetchEntries();
      fetchBankStatementEntries();
      fetchMonthlyReconciliation();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to match entries");
    } finally {
      setLoading(false);
    }
  };

  const updateMonthlyRecon = async () => {
    if (!monthlyRecon) return;
    
    setLoading(true);
    try {
      const response = await api.put(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/monthly-reconciliation/${monthlyRecon.id}`,
        {
          opening_balance_bank: parseFloat(monthlyForm.opening_balance_bank) || 0,
          closing_balance_bank: parseFloat(monthlyForm.closing_balance_bank) || 0,
          notes: monthlyForm.notes,
        }
      );
      setMonthlyRecon(response.data);
      setEditingMonthly(false);
      setSuccess("Monthly reconciliation updated!");
    } catch (error: any) {
      setError(error.response?.data?.detail || "Error updating reconciliation");
    } finally {
      setLoading(false);
    }
  };

  const closeMonthlyRecon = async () => {
    if (!monthlyRecon) return;
    
    if (!confirm("Are you sure you want to close this month's reconciliation?")) return;
    
    setLoading(true);
    try {
      await api.post(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/monthly-reconciliation/${monthlyRecon.id}/close`
      );
      fetchMonthlyReconciliation();
      setSuccess("Monthly reconciliation closed!");
    } catch (error: any) {
      setError(error.response?.data?.detail || "Error closing reconciliation");
    } finally {
      setLoading(false);
    }
  };

  const setBankDate = async (entryId: string, bankDate: string) => {
    try {
      await api.post(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/entries/${entryId}/set-bank-date`,
        { bank_date: bankDate }
      );
      setSuccess("Entry reconciled!");
      setEditingEntry(null);
      setEditBankDate("");
      fetchEntries();
      fetchMonthlyReconciliation();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Error setting bank date");
    }
  };

  const clearBankDate = async (entryId: string) => {
    try {
      await api.post(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/entries/${entryId}/clear-bank-date`
      );
      setSuccess("Entry un-reconciled");
      fetchEntries();
      fetchMonthlyReconciliation();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Error clearing bank date");
    }
  };

  const autoReconcile = async () => {
    setLoading(true);
    try {
      const lastDay = dayjs(`${selectedYear}-${selectedMonth}-01`).endOf("month").format("YYYY-MM-DD");
      const response = await api.post(
        `/companies/${company?.id}/bank-accounts/${selectedAccount}/auto-reconcile`,
        null,
        { params: { as_of_date: lastDay } }
      );
      setSuccess(`Auto-reconciled ${response.data.reconciled} entries`);
      fetchEntries();
      fetchMonthlyReconciliation();
    } catch (error: any) {
      setError(error.response?.data?.detail || "Error auto-reconciling");
    } finally {
      setLoading(false);
    }
  };

  const unreconciledEntries = entries.filter(e => !e.is_reconciled);
  const reconciledEntries = entries.filter(e => e.is_reconciled);
  const displayEntries = showAll ? entries : unreconciledEntries;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/banking/cheques/books" className="hover:text-primary">Banking</Link>
          <span>/</span>
          <span>Bank Reconciliation</span>
        </div>
        <h1 className="text-2xl font-bold text-dark dark:text-white">Bank Reconciliation</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Monthly reconciliation - Compare your books with bank statement
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
          {success}
          <button onClick={() => setSuccess("")} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
              Bank Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              <option value="">Select Account</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} - {account.account_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              {months.map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              {[2023, 2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <button
            onClick={autoReconcile}
            disabled={!selectedAccount || loading}
            className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white disabled:opacity-50"
          >
            Auto Reconcile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-stroke dark:border-dark-3">
        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "monthly"
              ? "border-b-2 border-primary text-primary"
              : "text-gray-500 hover:text-dark dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Monthly Summary
        </button>
        <button
          onClick={() => setActiveTab("entries")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "entries"
              ? "border-b-2 border-primary text-primary"
              : "text-gray-500 hover:text-dark dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Book Entries ({unreconciledEntries.length} unreconciled)
        </button>
        <button
          onClick={() => setActiveTab("match")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "match"
              ? "border-b-2 border-primary text-primary"
              : "text-gray-500 hover:text-dark dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Manual Match ({bankStatementEntries.length} pending)
        </button>
      </div>

      {/* Monthly Summary Tab */}
      {activeTab === "monthly" && monthlyRecon && (
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark dark:text-white">
              {months[selectedMonth - 1]} {selectedYear} Reconciliation
            </h2>
            <span className={`rounded-full px-4 py-1 text-sm font-medium ${
              monthlyRecon.status === "closed"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}>
              {monthlyRecon.status === "closed" ? "✓ Closed" : "Open"}
            </span>
          </div>

          {/* Bank Statement Balances */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-dark dark:text-white">
                Bank Statement Balances
              </h3>
              {monthlyRecon.status !== "closed" && !editingMonthly && (
                <button
                  onClick={() => setEditingMonthly(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            {editingMonthly ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-gray-500">Opening Balance (as per bank statement)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={monthlyForm.opening_balance_bank}
                      onChange={(e) => setMonthlyForm({...monthlyForm, opening_balance_bank: e.target.value})}
                      className="w-full rounded-lg border border-stroke px-3 py-2 focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2"
                      placeholder="Enter from bank statement"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-500">Closing Balance (as per bank statement)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={monthlyForm.closing_balance_bank}
                      onChange={(e) => setMonthlyForm({...monthlyForm, closing_balance_bank: e.target.value})}
                      className="w-full rounded-lg border border-stroke px-3 py-2 focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2"
                      placeholder="Enter from bank statement"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Notes</label>
                  <textarea
                    value={monthlyForm.notes}
                    onChange={(e) => setMonthlyForm({...monthlyForm, notes: e.target.value})}
                    className="w-full rounded-lg border border-stroke px-3 py-2 focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={updateMonthlyRecon}
                    disabled={loading}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingMonthly(false)}
                    className="rounded-lg border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:border-dark-3"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                  <p className="text-sm text-gray-500">Opening Balance</p>
                  <p className="text-xl font-bold text-dark dark:text-white">
                    ₹{monthlyRecon.opening_balance_bank.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">As per bank statement</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                  <p className="text-sm text-gray-500">Closing Balance</p>
                  <p className="text-xl font-bold text-dark dark:text-white">
                    ₹{monthlyRecon.closing_balance_bank.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">As per bank statement</p>
                </div>
              </div>
            )}
          </div>

          {/* Reconciliation Statement */}
          <div className="rounded-xl border border-stroke bg-white shadow-sm dark:border-dark-3 dark:bg-gray-dark">
            <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
              <h3 className="font-semibold text-dark dark:text-white">
                Bank Reconciliation Statement
              </h3>
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-stroke dark:divide-dark-3">
                  <tr>
                    <td className="py-3">Opening Balance (Bank Statement)</td>
                    <td className="py-3 text-right font-medium">₹{monthlyRecon.opening_balance_bank.toLocaleString()}</td>
                  </tr>
                  <tr className="text-green-600">
                    <td className="py-3 pl-4">Add: Total Debits (Money In)</td>
                    <td className="py-3 text-right">+₹{monthlyRecon.total_debit.toLocaleString()}</td>
                  </tr>
                  <tr className="text-red-600">
                    <td className="py-3 pl-4">Less: Total Credits (Money Out)</td>
                    <td className="py-3 text-right">-₹{monthlyRecon.total_credit.toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-50 font-medium dark:bg-dark-2">
                    <td className="py-3">Expected Closing Balance</td>
                    <td className="py-3 text-right">₹{monthlyRecon.expected_bank_closing.toLocaleString()}</td>
                  </tr>
                  <tr className="bg-primary/10 font-medium">
                    <td className="py-3">Actual Closing Balance (Bank Statement)</td>
                    <td className="py-3 text-right">₹{monthlyRecon.closing_balance_bank.toLocaleString()}</td>
                  </tr>
                  <tr className={`font-bold ${Math.abs(monthlyRecon.difference) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                    <td className="py-3">Difference</td>
                    <td className="py-3 text-right">
                      {Math.abs(monthlyRecon.difference) < 0.01 
                        ? "✓ Reconciled" 
                        : `₹${monthlyRecon.difference.toLocaleString()}`}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Explanation of Difference */}
              {Math.abs(monthlyRecon.difference) >= 0.01 && (
                <div className="mt-4 rounded-lg bg-yellow-50 p-4 text-sm dark:bg-yellow-900/20">
                  <p className="font-medium text-yellow-800 dark:text-yellow-300">
                    Difference may be due to:
                  </p>
                  <ul className="mt-2 list-inside list-disc text-yellow-700 dark:text-yellow-400">
                    <li>Cheques issued but not yet presented to bank</li>
                    <li>Deposits not yet credited by bank</li>
                    <li>Bank charges not booked in your records</li>
                    <li>Interest credited by bank not recorded</li>
                    <li>Unreconciled entries - check the "Book Entries" tab</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Book Balance Summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              <p className="text-sm text-gray-500">Opening (Books)</p>
              <p className="text-lg font-bold text-dark dark:text-white">
                ₹{monthlyRecon.opening_balance_book.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              <p className="text-sm text-gray-500">Closing (Books)</p>
              <p className="text-lg font-bold text-dark dark:text-white">
                ₹{monthlyRecon.closing_balance_book.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              <p className="text-sm text-gray-500">Unreconciled</p>
              <p className="text-lg font-bold text-red-600">
                {unreconciledEntries.length} entries
              </p>
            </div>
            <div className="rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              <p className="text-sm text-gray-500">Reconciled</p>
              <p className="text-lg font-bold text-green-600">
                {reconciledEntries.length} entries
              </p>
            </div>
          </div>

          {/* Close Month Button */}
          {monthlyRecon.status !== "closed" && (
            <div className="flex justify-end">
              <button
                onClick={closeMonthlyRecon}
                disabled={loading || Math.abs(monthlyRecon.difference) >= 0.01}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                title={Math.abs(monthlyRecon.difference) >= 0.01 ? "Resolve difference before closing" : ""}
              >
                Close This Month
              </button>
            </div>
          )}
        </div>
      )}

      {/* Book Entries Tab */}
      {activeTab === "entries" && (
        <div className="rounded-xl border border-stroke bg-white shadow-sm dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-stroke px-4 py-3 dark:border-dark-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Total: <span className="font-semibold text-dark dark:text-white">{entries.length}</span>
              </span>
              <span className="text-sm text-gray-500">
                Unreconciled: <span className="font-semibold text-red-600">{unreconciledEntries.length}</span>
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show All
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left dark:bg-dark-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Voucher</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                  <th className="px-4 py-3 font-medium">Bank Date</th>
                  <th className="px-4 py-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-dark-3">
                {displayEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      {loading ? "Loading..." : "No entries for this period"}
                    </td>
                  </tr>
                ) : (
                  displayEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-gray-50 dark:hover:bg-dark-2 ${
                        entry.is_reconciled ? "bg-green-50/50 dark:bg-green-900/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {entry.date ? dayjs(entry.date).format("DD/MM") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-dark-2">
                          {entry.voucher_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {entry.reference || entry.transaction_number}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3" title={entry.description}>
                        {entry.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {editingEntry === entry.id ? (
                          <input
                            type="date"
                            value={editBankDate}
                            onChange={(e) => setEditBankDate(e.target.value)}
                            className="w-32 rounded border border-primary px-2 py-1 text-sm focus:outline-none dark:bg-dark-2"
                            autoFocus
                          />
                        ) : entry.bank_date ? (
                          <span className="text-green-600">
                            {dayjs(entry.bank_date).format("DD/MM")}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingEntry === entry.id ? (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => setBankDate(entry.id, editBankDate)}
                              disabled={!editBankDate}
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => { setEditingEntry(null); setEditBankDate(""); }}
                              className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300 dark:bg-dark-3"
                            >
                              ✗
                            </button>
                          </div>
                        ) : entry.is_reconciled ? (
                          <button
                            onClick={() => clearBankDate(entry.id)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200 dark:bg-red-900/30"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingEntry(entry.id);
                              setEditBankDate(entry.date?.split("T")[0] || "");
                            }}
                            className="rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                          >
                            Reconcile
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Match Tab */}
      {activeTab === "match" && (
        <div className="space-y-6">
          {/* Match Action Bar */}
          {(selectedBookEntry || selectedBankEntry) && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-blue-700 dark:text-blue-400">
                    {selectedBookEntry && selectedBankEntry 
                      ? "Ready to match! Click Match button to link these entries."
                      : selectedBookEntry 
                        ? "Book entry selected. Now select a bank statement entry."
                        : "Bank entry selected. Now select a book entry."}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedBookEntry(null); setSelectedBankEntry(null); }}
                    className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-400"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={handleManualMatch}
                    disabled={!selectedBookEntry || !selectedBankEntry || loading}
                    className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Match Entries
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Book Entries (Left) */}
            <div className="rounded-xl border border-stroke bg-white shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              <div className="border-b border-stroke px-4 py-3 dark:border-dark-3">
                <h3 className="font-semibold text-dark dark:text-white">
                  Book Entries (Your Records)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {unreconciledEntries.length} unreconciled entries
                </p>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {unreconciledEntries.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No unreconciled book entries</div>
                ) : (
                  <div className="divide-y divide-stroke dark:divide-dark-3">
                    {unreconciledEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => setSelectedBookEntry(selectedBookEntry === entry.id ? null : entry.id)}
                        className={`cursor-pointer px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-2 ${
                          selectedBookEntry === entry.id ? "bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-dark dark:text-white">
                              {entry.date ? dayjs(entry.date).format("DD/MM/YY") : "-"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                              {entry.description || entry.reference || entry.voucher_type}
                            </p>
                          </div>
                          <p className={`text-sm font-semibold ${
                            entry.debit > 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {entry.debit > 0 ? `+₹${entry.debit.toLocaleString()}` : `-₹${entry.credit.toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bank Statement Entries (Right) */}
            <div className="rounded-xl border border-stroke bg-white shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              <div className="border-b border-stroke px-4 py-3 dark:border-dark-3">
                <h3 className="font-semibold text-dark dark:text-white">
                  Bank Statement Entries
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {bankStatementEntries.length} pending entries
                </p>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {bankStatementEntries.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <p>No pending bank statement entries</p>
                    <Link href="/accounting/bank-import" className="mt-2 inline-block text-primary hover:underline">
                      Import bank statement →
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-stroke dark:divide-dark-3">
                    {bankStatementEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => setSelectedBankEntry(selectedBankEntry === entry.id ? null : entry.id)}
                        className={`cursor-pointer px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-2 ${
                          selectedBankEntry === entry.id ? "bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-dark dark:text-white">
                              {entry.value_date ? dayjs(entry.value_date).format("DD/MM/YY") : "-"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                              {entry.description || entry.bank_reference || "-"}
                            </p>
                          </div>
                          <p className={`text-sm font-semibold ${
                            entry.amount > 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {entry.amount > 0 ? "+" : ""}₹{Math.abs(entry.amount).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
            <h4 className="mb-2 text-sm font-medium text-dark dark:text-white">How to manually match:</h4>
            <ol className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <li>1. Click on a book entry (left) to select it</li>
              <li>2. Click on a matching bank statement entry (right)</li>
              <li>3. Click "Match Entries" to link them together</li>
              <li>4. The entries will be marked as reconciled</li>
            </ol>
          </div>
        </div>
      )}

      {/* Help Info */}
      <div className="mt-6 rounded-xl border border-stroke bg-blue-50 p-4 dark:border-dark-3 dark:bg-blue-900/10">
        <h3 className="mb-2 font-semibold text-blue-800 dark:text-blue-300">
          How Monthly Bank Reconciliation Works:
        </h3>
        <ol className="space-y-1 text-sm text-blue-700 dark:text-blue-400">
          <li>1. <strong>Enter Bank Statement Balances</strong> - Get opening and closing balance from your bank statement</li>
          <li>2. <strong>Review Book Entries</strong> - Go to "Book Entries" tab to see your recorded transactions</li>
          <li>3. <strong>Mark Bank Dates</strong> - For each entry, set the date it appeared in your bank statement</li>
          <li>4. <strong>Check Difference</strong> - Expected closing should match actual bank closing</li>
          <li>5. <strong>Close Month</strong> - Once reconciled, close the month to lock it</li>
        </ol>
      </div>
    </div>
  );
}
