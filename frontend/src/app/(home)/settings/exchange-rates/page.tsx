"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

export default function ExchangeRatesPage() {
  const { company } = useAuth();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ from_currency: "", to_currency: "", rate: "", effective_date: new Date().toISOString().split("T")[0] });

  useEffect(() => {
    if (company?.id) { fetchRates(); }
  }, [company]);

  const fetchRates = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/exchange-rates`);
      setRates(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/companies/${company?.id}/exchange-rates`, {
        ...formData,
        rate: parseFloat(formData.rate)
      });
      setShowModal(false);
      fetchRates();
    } catch (error) { console.error("Error:", error); }
  };

  return (
    <>
      <Breadcrumb pageName="Exchange Rates" />

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">+ Add Rate</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">From</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">To</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Rate</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Effective Date</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{r.from_currency}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{r.to_currency}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark font-bold">{r.rate}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{new Date(r.effective_date).toLocaleDateString()}</td>
                </tr>
              ))}
              {rates.length === 0 && !loading && (<tr><td colSpan={4} className="px-4 py-5 text-center text-body">No exchange rates configured.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">Add Exchange Rate</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2 block">From Currency *</label>
                <input type="text" value={formData.from_currency} onChange={(e) => setFormData({...formData, from_currency: e.target.value.toUpperCase()})} required placeholder="e.g., USD" className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">To Currency *</label>
                <input type="text" value={formData.to_currency} onChange={(e) => setFormData({...formData, to_currency: e.target.value.toUpperCase()})} required placeholder="e.g., INR" className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Rate *</label>
                <input type="number" step="0.0001" value={formData.rate} onChange={(e) => setFormData({...formData, rate: e.target.value})} required className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Effective Date *</label>
                <input type="date" value={formData.effective_date} onChange={(e) => setFormData({...formData, effective_date: e.target.value})} required className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded border border-stroke px-6 py-2">Cancel</button>
                <button type="submit" className="rounded bg-primary px-6 py-2 font-medium text-gray">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

