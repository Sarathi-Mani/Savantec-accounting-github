"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface LeaveBalance {
  id: string;
  employee_name: string;
  employee_code: string;
  leave_type: string;
  opening_balance: number;
  accrued: number;
  used: number;
  available: number;
}

export default function LeaveBalancesPage() {
  const { company } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) { fetchBalances(); }
  }, [company]);

  const fetchBalances = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/payroll/leave-balances`);
      setBalances(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  return (
    <>
      <Breadcrumb pageName="Leave Balances" />

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Employee</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Leave Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Opening</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Accrued</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Used</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Available</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <p className="font-medium">{b.employee_name}</p>
                    <p className="text-sm text-body">{b.employee_code}</p>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{b.leave_type}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center">{b.opening_balance}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center text-success">{b.accrued}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center text-danger">{b.used}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center font-bold text-primary">{b.available}</td>
                </tr>
              ))}
              {balances.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-4 py-5 text-center text-body">No leave balances found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

