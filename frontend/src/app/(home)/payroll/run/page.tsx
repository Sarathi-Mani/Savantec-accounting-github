"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  DollarSign,
  RefreshCw,
  FileText,
} from "lucide-react";
import { payrollApi, PayrollRun, Employee } from "@/services/api";

export default function PayrollRunPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [workingDays, setWorkingDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id");
    if (!storedCompanyId) {
      router.push("/company");
      return;
    }
    setCompanyId(storedCompanyId);
    loadData(storedCompanyId);
  }, [router]);

  const loadData = async (companyId: string) => {
    try {
      setLoading(true);
      const [runs, empList] = await Promise.all([
        payrollApi.listPayrollRuns(companyId),
        payrollApi.listEmployees(companyId, { status_filter: "active" }),
      ]);
      setPayrollRuns(runs);
      setEmployees(empList);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPayrollRun = () => {
    return payrollRuns.find(
      (p) => p.pay_period_month === selectedMonth && p.pay_period_year === selectedYear
    );
  };

  const handleCreatePayroll = async () => {
    if (!companyId) return;

    try {
      setProcessing(true);
      setError(null);

      await payrollApi.createPayrollRun(companyId, {
        month: selectedMonth,
        year: selectedYear,
      });

      setSuccess("Payroll run created successfully!");
      await loadData(companyId);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create payroll run");
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessPayroll = async () => {
    if (!companyId) return;

    const run = getCurrentPayrollRun();
    if (!run) return;

    try {
      setProcessing(true);
      setError(null);

      const result = await payrollApi.processPayroll(companyId, run.id, workingDays);
      setSuccess(
        `Payroll processed! ${result.processed_employees} employees processed. Total Net Pay: ₹${result.total_net_pay.toLocaleString("en-IN")}`
      );
      await loadData(companyId);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to process payroll");
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalizePayroll = async () => {
    if (!companyId) return;

    const run = getCurrentPayrollRun();
    if (!run) return;

    try {
      setProcessing(true);
      setError(null);

      await payrollApi.finalizePayroll(companyId, run.id);
      setSuccess("Payroll finalized successfully! Accounting entries created.");
      await loadData(companyId);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to finalize payroll");
    } finally {
      setProcessing(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "finalized":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "processed":
        return <Clock className="w-5 h-5 text-blue-500" />;
      case "processing":
        return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "finalized":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "processed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      case "processing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentRun = getCurrentPayrollRun();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Run Payroll</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Process monthly payroll for {employees.length} active employees
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Period Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Select Pay Period
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
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
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Working Days
            </label>
            <input
              type="number"
              value={workingDays}
              onChange={(e) => setWorkingDays(parseInt(e.target.value))}
              min={1}
              max={31}
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Current Period Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {months[selectedMonth - 1]} {selectedYear}
                </h2>
                {currentRun && (
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getStatusColor(currentRun.status)}`}>
                    {currentRun.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {!currentRun && (
              <button
                onClick={handleCreatePayroll}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Play className="w-5 h-5" />
                Start Payroll
              </button>
            )}
          </div>
        </div>

        {currentRun ? (
          <div className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Employees</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentRun.processed_employees} / {currentRun.total_employees}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">Gross Salary</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(currentRun.total_gross)}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <span className="text-sm">Deductions</span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(currentRun.total_deductions)}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <span className="text-sm">Net Pay</span>
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(currentRun.total_net_pay)}
                </p>
              </div>
            </div>

            {/* Statutory Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">PF (Employee)</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(currentRun.total_pf_employee)}
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">PF (Employer)</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(currentRun.total_pf_employer)}
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">ESI (Total)</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(currentRun.total_esi_employee + currentRun.total_esi_employer)}
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">PT + TDS</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(currentRun.total_pt + currentRun.total_tds)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {currentRun.status === "draft" && (
                <button
                  onClick={handleProcessPayroll}
                  disabled={processing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${processing ? "animate-spin" : ""}`} />
                  {processing ? "Processing..." : "Process Payroll"}
                </button>
              )}

              {currentRun.status === "processed" && (
                <>
                  <button
                    onClick={handleProcessPayroll}
                    disabled={processing}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Re-process
                  </button>
                  <button
                    onClick={handleFinalizePayroll}
                    disabled={processing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {processing ? "Finalizing..." : "Finalize Payroll"}
                  </button>
                </>
              )}

              {currentRun.status === "finalized" && (
                <Link
                  href={`/payroll/payslips?month=${selectedMonth}&year=${selectedYear}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  View Payslips
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No payroll run for this period</p>
            <p className="text-sm">Click &quot;Start Payroll&quot; to begin processing</p>
          </div>
        )}
      </div>

      {/* Recent Payroll Runs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Payroll History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Employees
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Gross
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Net Pay
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {payrollRuns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No payroll runs yet
                  </td>
                </tr>
              ) : (
                payrollRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                    onClick={() => {
                      setSelectedMonth(run.pay_period_month);
                      setSelectedYear(run.pay_period_year);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(run.status)}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {months[run.pay_period_month - 1]} {run.pay_period_year}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {run.processed_employees}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {formatCurrency(run.total_gross)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {formatCurrency(run.total_net_pay)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
