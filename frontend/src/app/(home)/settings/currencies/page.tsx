"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_base: boolean;
}

export default function CurrenciesPage() {
  const { company } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ code: "", name: "", symbol: "" });

  useEffect(() => {
    if (company?.id) { fetchCurrencies(); }
  }, [company]);

  const fetchCurrencies = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/currencies`);
      setCurrencies(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/companies/${company?.id}/currencies`, formData);
      setShowModal(false);
      setFormData({ code: "", name: "", symbol: "" });
      fetchCurrencies();
    } catch (error) { console.error("Error:", error); }
  };

  return (
    <>
      <Breadcrumb pageName="Currencies" />

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">+ Add Currency</button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {currencies.map((c) => (
          <div key={c.id} className={`rounded-sm border p-6 shadow-default dark:border-strokedark dark:bg-boxdark ${c.is_base ? "border-primary bg-primary bg-opacity-5" : "border-stroke bg-white"}`}>
            <div className="flex justify-between items-start">
              <div className="text-3xl">{c.symbol}</div>
              {c.is_base && <span className="px-2 py-1 rounded bg-primary bg-opacity-10 text-primary text-xs">Base</span>}
            </div>
            <h4 className="mt-4 text-lg font-bold text-black dark:text-white">{c.code}</h4>
            <p className="text-sm text-body">{c.name}</p>
          </div>
        ))}
        {currencies.length === 0 && !loading && (
          <div className="col-span-4 text-center py-10 text-body">No currencies configured. Add currencies for multi-currency transactions.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">Add Currency</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2 block">Code (e.g., USD) *</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} required maxLength={3} className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Symbol (e.g., $) *</label>
                <input type="text" value={formData.symbol} onChange={(e) => setFormData({...formData, symbol: e.target.value})} required maxLength={5} className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
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

