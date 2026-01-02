"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Account {
  id: string;
  name: string;
  account_type: string;
}

export default function ReceiptVoucherPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    to_account: "",
    from_account: "",
    amount: "",
    reference: "",
    narration: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchAccounts();
    }
  }, [company]);

  const fetchAccounts = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/accounts`
      );
      setAccounts(response.data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.post(
        `/companies/${company?.id}/transactions`,
        {
          transaction_type: "receipt",
          transaction_date: formData.date,
          entries: [
            { account_id: formData.to_account, debit_amount: parseFloat(formData.amount), credit_amount: 0 },
            { account_id: formData.from_account, debit_amount: 0, credit_amount: parseFloat(formData.amount) },
          ],
          reference_number: formData.reference,
          narration: formData.narration,
        }
      );
      router.push("/accounting/transactions");
    } catch (error) {
      console.error("Error creating receipt:", error);
      alert("Error creating receipt voucher");
    } finally {
      setLoading(false);
    }
  };

  const cashBankAccounts = accounts.filter(a => 
    a.account_type === "cash" || a.account_type === "bank"
  );

  return (
    <>
      <Breadcrumb pageName="Receipt Voucher" />

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <h3 className="font-medium text-black dark:text-white">Create Receipt</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6.5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Date <span className="text-meta-1">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">Reference #</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Receipt reference"
                className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Receive From (Party/Income) <span className="text-meta-1">*</span>
              </label>
              <select
                value={formData.from_account}
                onChange={(e) => setFormData({ ...formData, from_account: e.target.value })}
                required
                className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="">Select Account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.account_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Receive Into (Cash/Bank) <span className="text-meta-1">*</span>
              </label>
              <select
                value={formData.to_account}
                onChange={(e) => setFormData({ ...formData, to_account: e.target.value })}
                required
                className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="">Select Account</option>
                {cashBankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Amount <span className="text-meta-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="Enter amount"
                className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2.5 block text-black dark:text-white">Narration</label>
              <textarea
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                placeholder="Receipt description"
                rows={3}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded border border-stroke px-6 py-2 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
            >
              {loading ? "Saving..." : "Save Receipt"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

