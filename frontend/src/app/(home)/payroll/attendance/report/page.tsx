"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface AttendanceSummary {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  present_days: number;
  absent_days: number;
  half_days: number;
  leave_days: number;
  working_days: number;
  attendance_percent: number;
}

export default function AttendanceReportPage() {
  const { company } = useAuth();
  const [summary, setSummary] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (company?.id) {
      fetchSummary();
    }
  }, [company, month, year]);

  const fetchSummary = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/payroll/attendance/summary?month=${month}&year=${year}`
      );
      setSummary(response.data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Attendance Report" />

      <div className="mb-4 flex gap-4">
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input">
          {Array.from({ length: 5 }, (_, i) => (
            <option key={year - 2 + i} value={year - 2 + i}>{year - 2 + i}</option>
          ))}
        </select>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Employee</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Present</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Absent</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Half Day</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Leave</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">Working Days</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-center">%</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.employee_id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <p className="font-medium">{s.employee_name}</p>
                    <p className="text-sm text-body">{s.employee_code}</p>
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center text-success font-bold">{s.present_days}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center text-danger font-bold">{s.absent_days}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center text-warning font-bold">{s.half_days}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center text-primary font-bold">{s.leave_days}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center">{s.working_days}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-center">
                    <span className={`font-bold ${s.attendance_percent >= 90 ? "text-success" : s.attendance_percent >= 75 ? "text-warning" : "text-danger"}`}>
                      {s.attendance_percent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {summary.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-5 text-center text-body">No attendance data found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

