"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface PeriodLock {
  id: string;
  locked_from: string;
  locked_to: string;
  voucher_types: string[];
  reason: string;
  locked_by: string;
  is_active: boolean;
  created_at: string;
}

export default function PeriodLocksPage() {
  const { company } = useAuth();
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    locked_from: "",
    locked_to: "",
    voucher_types: [] as string[],
    reason: "",
  });

  useEffect(() => {
    if (company?.id) {
      fetchLocks();
    }
  }, [company]);

  const fetchLocks = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/period-locks`
      );
      setLocks(response.data);
    } catch (error) {
      console.error("Error fetching locks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(
        `/companies/${company?.id}/period-locks`,
        formData
      );
      setShowModal(false);
      setFormData({ locked_from: "", locked_to: "", voucher_types: [], reason: "" });
      fetchLocks();
    } catch (error) {
      console.error("Error creating lock:", error);
    }
  };

  const deactivateLock = async (lockId: string) => {
    try {
      await api.post(
        `/companies/${company?.id}/period-locks/${lockId}/deactivate`
      );
      fetchLocks();
    } catch (error) {
      console.error("Error deactivating lock:", error);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Period Locks" />

      <div className="mb-4 rounded-sm border border-warning bg-warning bg-opacity-10 p-4">
        <p className="text-warning">
          Period locks prevent backdated entries and modifications to closed periods. 
          Use this to lock completed accounting periods.
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Lock Period
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Period</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Voucher Types</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Reason</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((lock) => (
                <tr key={lock.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(lock.locked_from).toLocaleDateString()} - {new Date(lock.locked_to).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {lock.voucher_types?.length ? lock.voucher_types.join(", ") : "All"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {lock.reason || "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                      lock.is_active 
                        ? "bg-danger bg-opacity-10 text-danger" 
                        : "bg-success bg-opacity-10 text-success"
                    }`}>
                      {lock.is_active ? "🔒 Locked" : "🔓 Unlocked"}
                    </span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {lock.is_active && (
                      <button
                        onClick={() => deactivateLock(lock.id)}
                        className="text-danger hover:underline"
                      >
                        Unlock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {locks.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-center text-body">
                    No period locks found. Lock periods to prevent backdated entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
              Lock Period
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">
                  From Date <span className="text-meta-1">*</span>
                </label>
                <input
                  type="date"
                  value={formData.locked_from}
                  onChange={(e) => setFormData({ ...formData, locked_from: e.target.value })}
                  required
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">
                  To Date <span className="text-meta-1">*</span>
                </label>
                <input
                  type="date"
                  value={formData.locked_to}
                  onChange={(e) => setFormData({ ...formData, locked_to: e.target.value })}
                  required
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Reason</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Year-end closing"
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
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
                  className="rounded bg-danger px-6 py-2 font-medium text-white hover:bg-opacity-90"
                >
                  Lock Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

