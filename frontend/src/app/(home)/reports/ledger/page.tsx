"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Account {
  id: string;
  name: string;
  account_type: string;
}

interface LedgerEntry {
  date: string;
  voucher_number: string;
  voucher_type: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function LedgerPage() {
  const { company } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (company?.id) { fetchAccounts(); }
  }, [company]);

  useEffect(() => {
    if (selectedAccount) { fetchLedger(); }
  }, [selectedAccount, fromDate, toDate]);

  const fetchAccounts = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/accounts`);
      setAccounts(response.data);
    } catch (error) { console.error("Error:", error); }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      let url = `/companies/${company?.id}/reports/ledger/${selectedAccount}`;
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await api.get(url);
      setLedgerData(response.data);
      setEntries(response.data.entries || []);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName="Account Ledger" />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input">
          <option value="">Select Account</option>
          {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" placeholder="From Date" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" placeholder="To Date" />
        <button className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">Export</button>
      </div>

      {ledgerData && (
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Opening Balance</p>
            <p className="text-xl font-bold text-black dark:text-white">₹{(ledgerData.opening_balance || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Transactions</p>
            <p className="text-xl font-bold text-black dark:text-white">{entries.length}</p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Closing Balance</p>
            <p className="text-xl font-bold text-primary">₹{(ledgerData.closing_balance || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Voucher</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Particulars</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Debit</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Credit</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{e.voucher_number}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{e.voucher_type}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{e.particulars}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{e.debit > 0 ? `₹${e.debit.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right">{e.credit > 0 ? `₹${e.credit.toLocaleString()}` : "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right font-bold">₹{e.balance.toLocaleString()}</td>
                </tr>
              ))}
              {!selectedAccount && (<tr><td colSpan={7} className="px-4 py-5 text-center text-body">Select an account to view ledger.</td></tr>)}
              {selectedAccount && entries.length === 0 && !loading && (<tr><td colSpan={7} className="px-4 py-5 text-center text-body">No transactions found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

