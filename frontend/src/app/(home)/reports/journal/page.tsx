"use client";

import React, { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { accountingApi } from "@/services/api";

interface JournalEntry {
  date: string;
  voucher_number: string;
  voucher_type: string;
  description: string;
  accounts: {
    account_name: string;
    debit: number;
    credit: number;
  }[];
  total_debit: number;
  total_credit: number;
}

export default function JournalPage() {
  const { company } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

  useEffect(() => {
    if (company?.id) {
      fetchJournal();
    }
  }, [company, fromDate, toDate]);

  const fetchJournal = async () => {
    if (!company?.id) return;
    
    setLoading(true);
    try {
      // Build params object - use limit to get more records (up to 1000)
      // Note: page_size max is 100, but limit can be up to 1000
      const params: {
        page?: number;
        limit?: number;
        from_date?: string;
        to_date?: string;
        status?: "posted";
      } = {
        page: 1,
        limit: 1000, // Use limit to get up to 1000 transactions
        status: "posted", // Only show posted transactions
      };
      
      // Only add date filters if they have values
      if (fromDate && fromDate.trim()) {
        params.from_date = fromDate;
      }
      
      if (toDate && toDate.trim()) {
        params.to_date = toDate;
      }
      
      const data = await accountingApi.listTransactions(company.id, params);

      // Transform transactions into journal format
      const journalEntries: JournalEntry[] = [];
      let totalDebitSum = 0;
      let totalCreditSum = 0;

      for (const txn of data.transactions) {
        if (txn.status !== "posted") continue;

        const accounts = txn.entries.map((entry) => ({
          account_name: entry.account_name || entry.account_code || "Unknown",
          debit: entry.debit_amount || 0,
          credit: entry.credit_amount || 0,
        }));

        totalDebitSum += txn.total_debit || 0;
        totalCreditSum += txn.total_credit || 0;

        journalEntries.push({
          date: txn.transaction_date,
          voucher_number: txn.transaction_number,
          voucher_type: txn.reference_type || "manual",
          description: txn.description || "",
          accounts,
          total_debit: txn.total_debit || 0,
          total_credit: txn.total_credit || 0,
        });
      }

      // Sort by date
      journalEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setEntries(journalEntries);
      setTotalDebit(totalDebitSum);
      setTotalCredit(totalCreditSum);
    } catch (error) {
      console.error("Error fetching journal:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Journal" />

      {/* Filters */}
      <div className="mb-4 rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm text-black dark:text-white">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-black dark:text-white">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchJournal}
              className="w-full rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Entries</p>
          <p className="text-2xl font-bold text-black dark:text-white">{entries.length}</p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Debit</p>
          <p className="text-2xl font-bold text-black dark:text-white">
            ₹{totalDebit.toLocaleString()}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="text-sm text-body">Total Credit</p>
          <p className="text-2xl font-bold text-black dark:text-white">
            ₹{totalCredit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Journal Table */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Voucher #</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Account</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Description</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Debit</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <React.Fragment key={`${entry.voucher_number}-${idx}`}>
                  {entry.accounts.map((account, accIdx) => (
                    <tr key={`${entry.voucher_number}-${accIdx}`}>
                      {accIdx === 0 && (
                        <>
                          <td
                            rowSpan={entry.accounts.length}
                            className="border-b border-[#eee] px-4 py-5 dark:border-strokedark"
                          >
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td
                            rowSpan={entry.accounts.length}
                            className="border-b border-[#eee] px-4 py-5 dark:border-strokedark font-medium"
                          >
                            {entry.voucher_number}
                          </td>
                          <td
                            rowSpan={entry.accounts.length}
                            className="border-b border-[#eee] px-4 py-5 dark:border-strokedark"
                          >
                            {entry.voucher_type}
                          </td>
                        </>
                      )}
                      <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                        {account.account_name}
                      </td>
                      {accIdx === 0 && (
                        <td
                          rowSpan={entry.accounts.length}
                          className="border-b border-[#eee] px-4 py-5 dark:border-strokedark"
                        >
                          {entry.description}
                        </td>
                      )}
                      <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                        {account.debit > 0 ? `₹${account.debit.toLocaleString()}` : "-"}
                      </td>
                      <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">
                        {account.credit > 0 ? `₹${account.credit.toLocaleString()}` : "-"}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-body">
                    No journal entries found for the selected period.
                  </td>
                </tr>
              )}
              {entries.length > 0 && (
                <tr className="bg-gray-2 font-bold dark:bg-meta-4">
                  <td colSpan={5} className="px-4 py-4 text-right text-black dark:text-white">
                    Total
                  </td>
                  <td className="px-4 py-4 text-right text-black dark:text-white">
                    ₹{totalDebit.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right text-black dark:text-white">
                    ₹{totalCredit.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

