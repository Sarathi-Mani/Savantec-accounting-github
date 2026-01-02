"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Employee {
  id: string;
  employee_code: string;
  name: string;
}

interface AttendanceRecord {
  employee_id: string;
  status: string;
}

export default function AttendancePage() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.id) {
      fetchEmployees();
    }
  }, [company]);

  useEffect(() => {
    if (company?.id && employees.length > 0) {
      fetchAttendance();
    }
  }, [company, selectedDate, employees]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/payroll/employees`);
      setEmployees(response.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/payroll/attendance?date=${selectedDate}`);
      const attendanceMap: Record<string, string> = {};
      response.data.forEach((a: AttendanceRecord) => {
        attendanceMap[a.employee_id] = a.status;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const markAttendance = (employeeId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [employeeId]: status }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const records = Object.entries(attendance).map(([employee_id, status]) => ({
        employee_id, status
      }));
      await api.post(`/companies/${company?.id}/payroll/attendance/bulk`, {
        date: selectedDate, records
      });
      alert("Attendance saved successfully!");
    } catch (error) {
      console.error("Error saving attendance:", error);
      alert("Error saving attendance");
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "bg-success text-white";
      case "absent": return "bg-danger text-white";
      case "half_day": return "bg-warning text-white";
      case "leave": return "bg-primary text-white";
      default: return "bg-gray-2";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Mark Attendance" />

      <div className="mb-4 flex justify-between items-center">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
        />
        <button onClick={saveAttendance} disabled={saving} className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Code</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Employee</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{emp.employee_code}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{emp.name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <div className="flex gap-2">
                      {["present", "absent", "half_day", "leave"].map((status) => (
                        <button
                          key={status}
                          onClick={() => markAttendance(emp.id, status)}
                          className={`px-3 py-1 rounded text-xs font-medium ${attendance[emp.id] === status ? getStatusColor(status) : "bg-gray-2 dark:bg-meta-4"}`}
                        >
                          {status.replace("_", " ").toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && !loading && (
                <tr><td colSpan={3} className="px-4 py-5 text-center text-body">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

