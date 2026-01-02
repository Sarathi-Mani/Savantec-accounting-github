"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import api from "@/services/api";
import {
  accountingApi,
  Account,
  getErrorMessage,
} from "@/services/api";
import dayjs from "dayjs";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
}

interface BankStatementEntry {
  id: string;
  value_date: string;
  transaction_date: string | null;
  amount: number;
  is_credit: boolean;
  bank_reference: string | null;
  description: string;
  balance: number | null;
  status: "pending" | "matched" | "unmatched" | "disputed";
  matched_entry_id: string | null;
  booked_transaction_id: string | null;
}

interface ReconciliationSummary {
  bank_entries: Record<string, number>;
  unreconciled_book_entries: number;
  total_bank_entries: number;
}

interface CSVPreview {
  headers: string[];
  sample_rows: Record<string, string>[];
  detected_bank: string | null;
  row_count: number;
}

interface ColumnMapping {
  date_column: string;
  description_column: string;
  debit_column: string;
  credit_column: string;
  reference_column: string;
  balance_column: string;
}

export default function BankImportPage() {
  const { company } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statementEntries, setStatementEntries] = useState<BankStatementEntry[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Selection state
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "matched" | "all">("pending");
  
  // CSV preview/mapping state
  const [csvContent, setCsvContent] = useState("");
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date_column: "",
    description_column: "",
    debit_column: "",
    credit_column: "",
    reference_column: "",
    balance_column: "",
  });
  
  // Entry categorization state
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [categoryAccountId, setCategoryAccountId] = useState("");
  
  // Bulk selection
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [bulkAccountId, setBulkAccountId] = useState("");

  useEffect(() => {
    if (company?.id) {
      fetchInitialData();
    }
  }, [company?.id]);

  useEffect(() => {
    if (selectedBankAccountId && company?.id) {
      fetchStatementEntries();
      fetchSummary();
    }
  }, [selectedBankAccountId, activeTab]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [accountsData, bankAccountsData] = await Promise.all([
        accountingApi.listAccounts(company!.id),
        api.get(`/companies/${company!.id}/bank-accounts`).then(r => r.data),
      ]);
      setAccounts(accountsData);
      setBankAccounts(bankAccountsData);
      
      // Auto-select first bank account
      if (bankAccountsData.length > 0 && !selectedBankAccountId) {
        setSelectedBankAccountId(bankAccountsData[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  const fetchStatementEntries = async () => {
    if (!selectedBankAccountId) return;
    
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const response = await api.get(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/statement-entries`,
        { params: { status } }
      );
      setStatementEntries(response.data);
    } catch (err) {
      console.error("Error fetching statement entries:", err);
    }
  };

  const fetchSummary = async () => {
    if (!selectedBankAccountId) return;
    
    try {
      const response = await api.get(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/reconciliation-summary`
      );
      setSummary(response.data);
    } catch (err) {
      console.error("Error fetching summary:", err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!selectedBankAccountId) {
      setError("Please select a bank account first");
      return;
    }

    try {
      setUploading(true);
      setError("");
      
      // Read file content
      const content = await file.text();
      setCsvContent(content);
      
      // Get preview
      const previewData = await accountingApi.previewBankStatement(company!.id, file);
      setPreview({ ...previewData, filename: file.name } as any);
      
      // Auto-detect columns if bank format was detected
      if (previewData.detected_bank) {
        await importWithAutoDetect(content, previewData.detected_bank);
      } else {
        // Show mapping modal for unknown format
        setShowMappingModal(true);
        autoMapColumns(previewData.headers);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to preview CSV file"));
    } finally {
      setUploading(false);
    }
  };

  const autoMapColumns = (headers: string[]) => {
    const mapping: ColumnMapping = {
      date_column: "",
      description_column: "",
      debit_column: "",
      credit_column: "",
      reference_column: "",
      balance_column: "",
    };

    headers.forEach((header) => {
      const h = header.toLowerCase();
      if (!mapping.date_column && (h.includes("date") || h.includes("dt"))) {
        mapping.date_column = header;
      }
      if (!mapping.description_column && (h.includes("description") || h.includes("narration") || h.includes("particulars") || h.includes("remark"))) {
        mapping.description_column = header;
      }
      if (!mapping.debit_column && (h.includes("debit") || h.includes("withdrawal") || h === "dr")) {
        mapping.debit_column = header;
      }
      if (!mapping.credit_column && (h.includes("credit") || h.includes("deposit") || h === "cr")) {
        mapping.credit_column = header;
      }
      if (!mapping.reference_column && (h.includes("ref") || h.includes("chq") || h.includes("cheque"))) {
        mapping.reference_column = header;
      }
      if (!mapping.balance_column && h.includes("balance")) {
        mapping.balance_column = header;
      }
    });

    setColumnMapping(mapping);
  };

  const importWithAutoDetect = async (content: string, bankName: string) => {
    try {
      setUploading(true);
      const response = await api.post(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/import-statement`,
        {
          content,
          file_name: "import.csv",
          bank_name: bankName,
          auto_match: true,
        }
      );
      
      const result = response.data;
      setSuccess(
        `Imported ${result.imported} entries. Auto-matched: ${result.auto_matched}. Pending: ${result.pending}`
      );
      
      resetFileInput();
      fetchStatementEntries();
      fetchSummary();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to import bank statement"));
    } finally {
      setUploading(false);
    }
  };

  const handleImportWithMapping = async () => {
    if (!csvContent || !columnMapping.description_column) {
      setError("Please select a description column");
      return;
    }

    try {
      setUploading(true);
      setError("");
      
      const response = await api.post(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/import-statement`,
        {
          content: csvContent,
          file_name: "import.csv",
          auto_match: true,
          column_mapping: columnMapping,
        }
      );
      
      const result = response.data;
      setSuccess(
        `Imported ${result.imported} entries. Auto-matched: ${result.auto_matched}. Pending: ${result.pending}`
      );
      
      setShowMappingModal(false);
      resetFileInput();
      fetchStatementEntries();
      fetchSummary();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to import bank statement"));
    } finally {
      setUploading(false);
    }
  };

  const resetFileInput = () => {
    setPreview(null);
    setCsvContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAutoMatch = async () => {
    try {
      setProcessing(true);
      const response = await api.post(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/auto-match-statement`
      );
      
      setSuccess(`Auto-matched ${response.data.matched} entries`);
      fetchStatementEntries();
      fetchSummary();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to auto-match"));
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateTransaction = async (entryId: string, accountId: string) => {
    try {
      setProcessing(true);
      await api.post(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/statement-entries/${entryId}/create-transaction`,
        { category_account_id: accountId }
      );
      
      setSuccess("Transaction created successfully");
      setSelectedEntryId(null);
      setCategoryAccountId("");
      fetchStatementEntries();
      fetchSummary();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create transaction"));
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkAsCharges = async (entryId: string, chargeType: string) => {
    try {
      setProcessing(true);
      await api.post(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/statement-entries/${entryId}/mark-as-charges`,
        null,
        { params: { charge_type: chargeType } }
      );
      
      setSuccess("Marked as bank charges");
      fetchStatementEntries();
      fetchSummary();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to mark as charges"));
    } finally {
      setProcessing(false);
    }
  };

  const handleUnmatch = async (entryId: string) => {
    try {
      await api.post(
        `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/statement-entries/${entryId}/unmatch`
      );
      
      setSuccess("Entry unmatched");
      fetchStatementEntries();
      fetchSummary();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to unmatch"));
    }
  };

  const handleBulkCategorize = async () => {
    if (selectedEntries.size === 0 || !bulkAccountId) return;
    
    setProcessing(true);
    let successCount = 0;
    
    for (const entryId of selectedEntries) {
      try {
        await api.post(
          `/companies/${company!.id}/bank-accounts/${selectedBankAccountId}/statement-entries/${entryId}/create-transaction`,
          { category_account_id: bulkAccountId }
        );
        successCount++;
      } catch (err) {
        console.error(`Failed to process entry ${entryId}:`, err);
      }
    }
    
    setSuccess(`Created ${successCount} transactions`);
    setSelectedEntries(new Set());
    setBulkAccountId("");
    setProcessing(false);
    fetchStatementEntries();
    fetchSummary();
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingEntries = statementEntries.filter(e => e.status === "pending");
    if (selectedEntries.size === pendingEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(pendingEntries.map(e => e.id)));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  // Group accounts by type for dropdown
  const groupedAccounts = accounts.reduce(
    (acc, account) => {
      const type = account.account_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(account);
      return acc;
    },
    {} as Record<string, Account[]>
  );

  const pendingEntries = statementEntries.filter(e => e.status === "pending");
  const matchedEntries = statementEntries.filter(e => e.status === "matched");

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/accounting" className="hover:text-primary">Accounting</Link>
          <span>/</span>
          <span>Bank Statement Import</span>
        </div>
        <h1 className="text-2xl font-bold text-dark dark:text-white">Bank Statement Import</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Import bank statements and match with your book entries (Tally-style reconciliation)
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

      {/* Bank Account Selection & Import */}
      <div className="mb-6 rounded-xl border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-end gap-4">
          {/* Bank Account Selector */}
          <div className="min-w-[250px]">
            <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
              Bank Account
            </label>
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              <option value="">-- Select Bank Account --</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name} - {acc.account_number}
                </option>
              ))}
            </select>
          </div>

          {/* Import Button */}
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-4 py-2 transition ${
            selectedBankAccountId 
              ? "border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10" 
              : "border-gray-200 cursor-not-allowed opacity-50"
          }`}>
            <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="font-medium text-primary">
              {uploading ? "Processing..." : "Import CSV"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={uploading || !selectedBankAccountId}
              className="hidden"
            />
          </label>

          {/* Auto-Match Button */}
          <button
            onClick={handleAutoMatch}
            disabled={!selectedBankAccountId || processing || pendingEntries.length === 0}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Auto-Match
          </button>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Pending</p>
              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                {summary.bank_entries.pending || 0}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <p className="text-xs text-green-600 dark:text-green-400">Matched</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                {summary.bank_entries.matched || 0}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-xs text-blue-600 dark:text-blue-400">Total Imported</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {summary.total_bank_entries}
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
              <p className="text-xs text-purple-600 dark:text-purple-400">Unreconciled Book</p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                {summary.unreconciled_book_entries}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-stroke dark:border-dark-3">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "pending"
              ? "border-b-2 border-primary text-primary"
              : "text-gray-500 hover:text-dark dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Pending ({pendingEntries.length})
        </button>
        <button
          onClick={() => setActiveTab("matched")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "matched"
              ? "border-b-2 border-primary text-primary"
              : "text-gray-500 hover:text-dark dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Matched ({matchedEntries.length})
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "all"
              ? "border-b-2 border-primary text-primary"
              : "text-gray-500 hover:text-dark dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          All
        </button>
      </div>

      {/* Bulk Action Bar (for pending tab) */}
      {activeTab === "pending" && pendingEntries.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
          <input
            type="checkbox"
            checked={selectedEntries.size === pendingEntries.length && pendingEntries.length > 0}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-primary"
          />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            {selectedEntries.size > 0 ? `${selectedEntries.size} selected` : "Select entries to bulk categorize"}
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <select
              value={bulkAccountId}
              onChange={(e) => setBulkAccountId(e.target.value)}
              className="flex-1 min-w-[200px] rounded border border-blue-200 bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none dark:border-blue-800 dark:bg-gray-dark dark:text-white"
            >
              <option value="">Select category account...</option>
              {Object.entries(groupedAccounts).map(([type, accs]) => (
                <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1) + "s"}>
                  {accs.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={handleBulkCategorize}
              disabled={selectedEntries.size === 0 || !bulkAccountId || processing}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Categorize Selected
            </button>
          </div>
        </div>
      )}

      {/* Entries Table */}
      <div className="rounded-xl border border-stroke bg-white shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left dark:bg-dark-2">
              <tr>
                {activeTab === "pending" && (
                  <th className="px-4 py-3 font-medium w-10"></th>
                )}
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-dark-3">
              {statementEntries.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === "pending" ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                    {selectedBankAccountId 
                      ? "No entries found. Import a bank statement to get started."
                      : "Select a bank account to view statement entries."}
                  </td>
                </tr>
              ) : (
                statementEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-gray-50 dark:hover:bg-dark-2 ${
                      selectedEntries.has(entry.id) ? "bg-blue-50 dark:bg-blue-900/10" : ""
                    }`}
                  >
                    {activeTab === "pending" && (
                      <td className="px-4 py-3">
                        {entry.status === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(entry.id)}
                            onChange={() => toggleEntrySelection(entry.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {entry.value_date ? dayjs(entry.value_date).format("DD/MM/YY") : "-"}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" title={entry.description}>
                      {entry.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {entry.bank_reference || "-"}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      entry.amount > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {entry.amount > 0 ? "+" : "-"}{formatCurrency(entry.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.status === "matched" 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : entry.status === "pending"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.status === "pending" ? (
                        selectedEntryId === entry.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={categoryAccountId}
                              onChange={(e) => setCategoryAccountId(e.target.value)}
                              className="rounded border border-stroke px-2 py-1 text-xs focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2"
                            >
                              <option value="">Select Account</option>
                              {Object.entries(groupedAccounts).map(([type, accs]) => (
                                <optgroup key={type} label={type}>
                                  {accs.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.code} - {acc.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <button
                              onClick={() => handleCreateTransaction(entry.id, categoryAccountId)}
                              disabled={!categoryAccountId || processing}
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => { setSelectedEntryId(null); setCategoryAccountId(""); }}
                              className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300 dark:bg-dark-3"
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => setSelectedEntryId(entry.id)}
                              className="rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                            >
                              Categorize
                            </button>
                            <button
                              onClick={() => handleMarkAsCharges(entry.id, entry.amount < 0 ? "bank_charges" : "interest_received")}
                              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-dark-3 dark:text-gray-400"
                              title={entry.amount < 0 ? "Mark as Bank Charges" : "Mark as Interest"}
                            >
                              {entry.amount < 0 ? "Charges" : "Interest"}
                            </button>
                          </div>
                        )
                      ) : entry.status === "matched" ? (
                        <button
                          onClick={() => handleUnmatch(entry.id)}
                          className="rounded bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200 dark:bg-red-900/30"
                        >
                          Unmatch
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Info */}
      <div className="mt-6 rounded-xl border border-stroke bg-blue-50 p-4 dark:border-dark-3 dark:bg-blue-900/10">
        <h3 className="mb-2 font-semibold text-blue-800 dark:text-blue-300">
          How Tally-Style Bank Import Works:
        </h3>
        <ol className="space-y-1 text-sm text-blue-700 dark:text-blue-400">
          <li>1. <strong>Import CSV</strong> - Upload your bank statement. Entries are stored separately (not as transactions).</li>
          <li>2. <strong>Auto-Match</strong> - System matches bank entries with your existing book entries by amount & date.</li>
          <li>3. <strong>Categorize Pending</strong> - For unmatched entries, select an account to create a transaction.</li>
          <li>4. <strong>Bank Charges/Interest</strong> - Quick buttons to mark entries as bank charges or interest.</li>
          <li>5. <strong>Reconcile</strong> - Go to Banking → Reconciliation to complete monthly reconciliation.</li>
        </ol>
      </div>

      {/* Column Mapping Modal */}
      {showMappingModal && preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-dark dark:text-white">Map CSV Columns</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {preview.row_count} rows detected
                </p>
              </div>
              <button
                onClick={() => { setShowMappingModal(false); resetFileInput(); }}
                className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-dark-3"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Column Mapping Form */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: "date_column", label: "Date Column" },
                { key: "description_column", label: "Description Column", required: true },
                { key: "debit_column", label: "Debit/Withdrawal" },
                { key: "credit_column", label: "Credit/Deposit" },
                { key: "reference_column", label: "Reference" },
                { key: "balance_column", label: "Balance" },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={columnMapping[key as keyof ColumnMapping]}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [key]: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  >
                    <option value="">-- Select --</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview Table */}
            <div className="mb-4">
              <h3 className="mb-2 font-medium text-dark dark:text-white">Preview (First 5 rows)</h3>
              <div className="overflow-x-auto rounded-lg border border-stroke dark:border-dark-3">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-dark-2">
                    <tr>
                      {preview.headers.map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke dark:divide-dark-3">
                    {preview.sample_rows.map((row, idx) => (
                      <tr key={idx}>
                        {preview.headers.map((h) => (
                          <td key={h} className="whitespace-nowrap px-3 py-2">{row[h] || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowMappingModal(false); resetFileInput(); }}
                className="rounded-lg border border-stroke px-4 py-2 font-medium hover:bg-gray-100 dark:border-dark-3 dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                onClick={handleImportWithMapping}
                disabled={uploading || !columnMapping.description_column}
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
              >
                {uploading ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
