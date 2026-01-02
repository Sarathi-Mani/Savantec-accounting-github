"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Employee {
  id: string;
  employee_code: string;
  name: string;
  pan: string;
}

export default function Form16Page() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState("2024-25");
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (company?.id) { fetchEmployees(); }
  }, [company]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/payroll/employees`);
      setEmployees(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const generateForm16 = async (employeeId: string) => {
    setGenerating(employeeId);
    try {
      const response = await api.get(
        `/companies/${company?.id}/payroll/employees/${employeeId}/form16?fy=${financialYear}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Form16_${employeeId}_${financialYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error:", error);
      alert("Error generating Form 16");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Form 16 Generation" />

      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <label className="text-black dark:text-white">Financial Year:</label>
          <select value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input">
            <option value="2024-25">2024-25</option>
            <option value="2023-24">2023-24</option>
            <option value="2022-23">2022-23</option>
          </select>
        </div>
        <button className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">
          Generate All
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Code</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Employee Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">PAN</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{emp.employee_code}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{emp.name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{emp.pan || "-"}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button
                      onClick={() => generateForm16(emp.id)}
                      disabled={generating === emp.id}
                      className="text-primary hover:underline"
                    >
                      {generating === emp.id ? "Generating..." : "Download Form 16"}
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && !loading && (
                <tr><td colSpan={4} className="px-4 py-5 text-center text-body">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

