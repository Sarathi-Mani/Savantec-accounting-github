"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface PriceLevel {
  id: string;
  name: string;
  description: string;
  discount_percent: number;
  is_default: boolean;
  is_active: boolean;
}

export default function PriceLevelsPage() {
  const { company } = useAuth();
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discount_percent: 0,
    is_default: false,
  });

  useEffect(() => {
    if (company?.id) {
      fetchPriceLevels();
    }
  }, [company]);

  const fetchPriceLevels = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/price-levels`
      );
      setPriceLevels(response.data);
    } catch (error) {
      console.error("Error fetching price levels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(
        `/companies/${company?.id}/price-levels`,
        formData
      );
      setShowModal(false);
      setFormData({ name: "", description: "", discount_percent: 0, is_default: false });
      fetchPriceLevels();
    } catch (error) {
      console.error("Error creating price level:", error);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Price Levels" />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Add Price Level
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {priceLevels.map((level) => (
          <div
            key={level.id}
            className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-bold text-black dark:text-white">
                  {level.name}
                </h4>
                {level.description && (
                  <p className="text-sm text-body mt-1">{level.description}</p>
                )}
              </div>
              {level.is_default && (
                <span className="inline-flex rounded bg-primary bg-opacity-10 px-2 py-1 text-xs text-primary">
                  Default
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-primary">
                {level.discount_percent}% 
                <span className="text-sm font-normal text-body ml-1">discount</span>
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="text-primary hover:underline text-sm">Edit</button>
              <button className="text-danger hover:underline text-sm">Delete</button>
            </div>
          </div>
        ))}
        {priceLevels.length === 0 && !loading && (
          <div className="col-span-3 text-center py-10 text-body">
            No price levels found. Create price levels like MRP, Retail, Wholesale, etc.
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
              Add Price Level
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">
                  Name <span className="text-meta-1">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Wholesale"
                  required
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">
                  Discount Percentage
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) })}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
                <label htmlFor="is_default" className="text-black dark:text-white">
                  Set as default price level
                </label>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-stroke px-6 py-2 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

