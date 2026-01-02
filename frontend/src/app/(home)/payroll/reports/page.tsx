"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Download,
  Calendar,
  Users,
  Building2,
  Shield,
} from "lucide-react";
import { payrollApi } from "@/services/api";

export default function PayrollReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(searchParams.get("type") || "pf");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id");
    if (!storedCompanyId) {
      router.push("/company");
      return;
    }
    setCompanyId(storedCompanyId);
  }, [router]);

  const loadReport = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      let data;

      switch (selectedReport) {
        case "pf":
          data = await payrollApi.getPFReport(companyId, selectedMonth, selectedYear);
          break;
        case "esi":
          data = await payrollApi.getESIReport(companyId, selectedMonth, selectedYear);
          break;
        case "pt":
          data = await payrollApi.getPTReport(companyId, selectedMonth, selectedYear);
          break;
        default:
          data = null;
      }

      setReportData(data);
    } catch (error) {
      console.error("Error loading report:", error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const reportTypes = [
    { id: "pf", name: "PF ECR Report", icon: Building2, description: "Employee Provident Fund contribution report" },
    { id: "esi", name: "ESI Challan Report", icon: Shield, description: "Employee State Insurance contribution report" },
    { id: "pt", name: "Professional Tax Report", icon: FileText, description: "State-wise Professional Tax report" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Statutory Reports</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Generate PF, ESI, and Professional Tax compliance reports
        </p>
      </div>

      {/* Report Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`p-4 rounded-xl border transition-all text-left ${
              selectedReport === report.id
                ? "border-primary bg-primary/5 ring-2 ring-primary"
                : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                selectedReport === report.id
                  ? "bg-primary text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}>
                <report.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{report.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Period Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              {months.map((month, index) => (
                <option key={index} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadReport}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Report Content */}
      {reportData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {reportTypes.find((r) => r.id === selectedReport)?.name} - {months[selectedMonth - 1]} {selectedYear}
            </h2>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Summary */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedReport === "pf" && reportData.summary && (
                <>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Employees</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {reportData.summary.total_employees || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Employee PF</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(reportData.summary.total_employee_pf || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Employer PF</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(
                        (reportData.summary.total_employer_epf || 0) +
                        (reportData.summary.total_employer_eps || 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Grand Total</p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(reportData.summary.grand_total || 0)}
                    </p>
                  </div>
                </>
              )}

              {selectedReport === "esi" && reportData.summary && (
                <>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Employees</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {reportData.summary.total_employees || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Employee ESI</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(reportData.summary.total_employee_esi || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Employer ESI</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(reportData.summary.total_employer_esi || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total ESI</p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(reportData.summary.total_esi || 0)}
                    </p>
                  </div>
                </>
              )}

              {selectedReport === "pt" && (
                <>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Employees</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {reportData.total_employees || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total PT</p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(Number(reportData.total_pt) || 0)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Data Table */}
          {selectedReport === "pf" && reportData.ecr_data && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UAN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member Name</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Wages</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EPF (Employee)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EPS (Employer)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EPF (Employer)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {reportData.ecr_data.map((row: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.uan || "-"}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.member_name}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(row.gross_wages)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(row.epf_contribution_employee)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(row.eps_contribution_employer)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(row.epf_contribution_employer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === "esi" && reportData.challan_data && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ESI Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee Name</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ESI Wage</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Employee Contribution</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Employer Contribution</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {reportData.challan_data.map((row: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.esi_number || "-"}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.employee_name}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(row.esi_wage)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(row.employee_contribution)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(row.employer_contribution)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(row.total_contribution)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === "pt" && reportData.by_state && (
            <div className="p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">PT by State</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(reportData.by_state).map(([state, data]: [string, any]) => (
                  <div
                    key={state}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{data.state_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {data.employee_count} employees
                    </p>
                    <p className="text-lg font-bold text-primary mt-2">
                      {formatCurrency(Number(data.total_pt))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!reportData && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-white">Select a report and period</p>
          <p className="text-gray-500 dark:text-gray-400">
            Choose a report type and click &quot;Generate Report&quot; to view the data
          </p>
        </div>
      )}
    </div>
  );
}
