"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_per_year: number;
  is_paid: boolean;
  carry_forward: boolean;
  max_carry_forward: number;
  is_active: boolean;
}

export default function LeaveTypesPage() {
  const { company } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "", code: "", days_per_year: 12, is_paid: true, carry_forward: false, max_carry_forward: 0
  });

  useEffect(() => {
    if (company?.id) { fetchLeaveTypes(); }
  }, [company]);

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/payroll/leave-types`);
      setLeaveTypes(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/companies/${company?.id}/payroll/leave-types`, formData);
      setShowModal(false);
      fetchLeaveTypes();
    } catch (error) { console.error("Error:", error); }
  };

  return (
    <>
      <Breadcrumb pageName="Leave Types" />
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">+ Add Leave Type</button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {leaveTypes.map((lt) => (
          <div key={lt.id} className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-bold text-black dark:text-white">{lt.name}</h4>
                <p className="text-sm text-body">{lt.code}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${lt.is_paid ? "bg-success bg-opacity-10 text-success" : "bg-warning bg-opacity-10 text-warning"}`}>
                {lt.is_paid ? "Paid" : "Unpaid"}
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-primary">{lt.days_per_year} <span className="text-sm font-normal text-body">days/year</span></p>
            {lt.carry_forward && <p className="mt-2 text-sm text-body">Carry forward: max {lt.max_carry_forward} days</p>}
          </div>
        ))}
        {leaveTypes.length === 0 && !loading && (
          <div className="col-span-3 text-center py-10 text-body">No leave types. Add CL, SL, EL, etc.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">Add Leave Type</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2 block">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Code *</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} required className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Days per Year</label>
                <input type="number" value={formData.days_per_year} onChange={(e) => setFormData({...formData, days_per_year: parseInt(e.target.value)})} className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4 flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_paid} onChange={(e) => setFormData({...formData, is_paid: e.target.checked})} /> Paid Leave</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.carry_forward} onChange={(e) => setFormData({...formData, carry_forward: e.target.checked})} /> Carry Forward</label>
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

