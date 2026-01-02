"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Department {
  id: string;
  name: string;
  code: string;
  head_name: string;
  employee_count: number;
  is_active: boolean;
}

export default function DepartmentsPage() {
  const { company } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: "", code: "" });

  useEffect(() => {
    if (company?.id) {
      fetchDepartments();
    }
  }, [company]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/payroll/departments`
      );
      setDepartments(response.data);
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(
        `/companies/${company?.id}/payroll/departments`,
        formData
      );
      setShowModal(false);
      setFormData({ name: "", code: "" });
      fetchDepartments();
    } catch (error) {
      console.error("Error creating department:", error);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Departments" />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex justify-center rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90"
        >
          + Add Department
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark"
          >
            <h4 className="text-lg font-bold text-black dark:text-white">{dept.name}</h4>
            <p className="text-sm text-body">Code: {dept.code}</p>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-2xl font-bold text-primary">{dept.employee_count || 0}</span>
              <span className="text-sm text-body">employees</span>
            </div>
            {dept.head_name && (
              <p className="mt-2 text-sm text-body">Head: {dept.head_name}</p>
            )}
          </div>
        ))}
        {departments.length === 0 && !loading && (
          <div className="col-span-3 text-center py-10 text-body">
            No departments found. Add departments to organize employees.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">Add Department</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2.5 block text-black dark:text-white">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
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

