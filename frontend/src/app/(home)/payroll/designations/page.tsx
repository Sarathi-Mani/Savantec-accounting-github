"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Designation {
  id: string;
  name: string;
  code: string;
  grade: string;
  employee_count: number;
  is_active: boolean;
}

export default function DesignationsPage() {
  const { company } = useAuth();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: "", code: "", grade: "" });

  useEffect(() => {
    if (company?.id) {
      fetchDesignations();
    }
  }, [company]);

  const fetchDesignations = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/payroll/designations`
      );
      setDesignations(response.data);
    } catch (error) {
      console.error("Error fetching designations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(
        `/companies/${company?.id}/payroll/designations`,
        formData
      );
      setShowModal(false);
      setFormData({ name: "", code: "", grade: "" });
      fetchDesignations();
    } catch (error) {
      console.error("Error creating designation:", error);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Designations" />

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">
          + Add Designation
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Code</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Grade</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Employees</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {designations.map((des) => (
                <tr key={des.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{des.name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{des.code}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{des.grade || "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{des.employee_count || 0}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${des.is_active ? "bg-success bg-opacity-10 text-success" : "bg-danger bg-opacity-10 text-danger"}`}>
                      {des.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {designations.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-5 text-center text-body">No designations found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">Add Designation</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Code</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Grade</label>
                <input type="text" value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input" />
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

