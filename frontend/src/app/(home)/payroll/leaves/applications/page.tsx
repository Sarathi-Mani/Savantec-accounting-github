"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface LeaveApplication {
  id: string;
  employee_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string;
  status: string;
  applied_on: string;
}

export default function LeaveApplicationsPage() {
  const { company } = useAuth();
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    if (company?.id) { fetchApplications(); }
  }, [company, filter]);

  const fetchApplications = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/payroll/leave-applications?status=${filter}`);
      setApplications(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(`/companies/${company?.id}/payroll/leave-applications/${id}/${action}`);
      fetchApplications();
    } catch (error) { console.error("Error:", error); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-success bg-opacity-10 text-success";
      case "rejected": return "bg-danger bg-opacity-10 text-danger";
      case "pending": return "bg-warning bg-opacity-10 text-warning";
      default: return "bg-gray-2 text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Leave Applications" />

      <div className="mb-4 flex gap-2">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded capitalize ${filter === s ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>{s}</button>
        ))}
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Employee</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">From</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">To</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Days</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Reason</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{app.employee_name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{app.leave_type}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{new Date(app.from_date).toLocaleDateString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{new Date(app.to_date).toLocaleDateString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{app.days}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-sm">{app.reason}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(app.status)}`}>{app.status}</span>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {app.status === "pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => handleAction(app.id, "approve")} className="text-success hover:underline">Approve</button>
                        <button onClick={() => handleAction(app.id, "reject")} className="text-danger hover:underline">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {applications.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-4 py-5 text-center text-body">No applications found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

