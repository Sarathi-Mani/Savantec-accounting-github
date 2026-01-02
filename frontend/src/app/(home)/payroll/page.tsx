"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  DollarSign,
  Calculator,
  FileText,
  TrendingUp,
  Wallet,
  Settings,
  Plus,
  ArrowRight,
} from "lucide-react";
import { payrollApi, PayrollRun } from "@/services/api";

export default function PayrollDashboard() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingPayroll: false,
    lastPayrollMonth: "",
  });
  const [recentPayrolls, setRecentPayrolls] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [employees, payrollRuns] = await Promise.all([
        payrollApi.listEmployees(companyId),
        payrollApi.listPayrollRuns(companyId),
      ]);

      const activeCount = employees.filter((e) => e.status === "active").length;

      // Check if current month payroll exists
      const now = new Date();
      const currentMonthPayroll = payrollRuns.find(
        (p) => p.pay_period_month === now.getMonth() + 1 && p.pay_period_year === now.getFullYear()
      );

      setStats({
        totalEmployees: employees.length,
        activeEmployees: activeCount,
        pendingPayroll: !currentMonthPayroll,
        lastPayrollMonth:
          payrollRuns.length > 0
            ? `${payrollRuns[0].pay_period_month}/${payrollRuns[0].pay_period_year}`
            : "N/A",
      });

      setRecentPayrolls(payrollRuns.slice(0, 5));
    } catch (error) {
      console.error("Error loading payroll data:", error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "finalized":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "processed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage employees, salary, and statutory compliance
          </p>
        </div>
        <Link
          href="/payroll/run"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Run Payroll
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalEmployees}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Employees</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.activeEmployees}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-lg ${stats.pendingPayroll ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-green-100 dark:bg-green-900/30"}`}
            >
              <Calculator
                className={`w-6 h-6 ${stats.pendingPayroll ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}
              />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">This Month&apos;s Payroll</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.pendingPayroll ? "Pending" : "Processed"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Payroll</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.lastPayrollMonth}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Links */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <Link
              href="/payroll/employees"
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900 dark:text-white">Employees</span>
            </Link>

            <Link
              href="/payroll/employees/new"
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Plus className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900 dark:text-white">Add Employee</span>
            </Link>

            <Link
              href="/payroll/payslips"
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <FileText className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-gray-900 dark:text-white">Payslips</span>
            </Link>

            <Link
              href="/payroll/loans"
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Wallet className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-gray-900 dark:text-white">Loans</span>
            </Link>

            <Link
              href="/payroll/reports"
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <DollarSign className="w-5 h-5 text-teal-600" />
              <span className="font-medium text-gray-900 dark:text-white">Reports</span>
            </Link>

            <Link
              href="/payroll/run"
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Calculator className="w-5 h-5 text-red-600" />
              <span className="font-medium text-gray-900 dark:text-white">Run Payroll</span>
            </Link>
          </div>
        </div>

        {/* Recent Payroll Runs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Payroll Runs
            </h2>
            <Link
              href="/payroll/run"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentPayrolls.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No payroll runs yet. Start by running your first payroll.
              </div>
            ) : (
              recentPayrolls.map((payroll) => (
                <div
                  key={payroll.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(payroll.pay_period_year, payroll.pay_period_month - 1).toLocaleString(
                          "en-IN",
                          { month: "long", year: "numeric" }
                        )}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {payroll.processed_employees} employees • Net Pay:{" "}
                        {formatCurrency(payroll.total_net_pay)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(payroll.status)}`}
                    >
                      {payroll.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compliance Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Statutory Compliance
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="font-bold text-blue-600 dark:text-blue-400">PF</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Provident Fund</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">12% Employee + 12% Employer</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="font-bold text-green-600 dark:text-green-400">ESI</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">ESI</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">0.75% + 3.25% (≤₹21K)</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <span className="font-bold text-orange-600 dark:text-orange-400">PT</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Professional Tax</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">State-wise slabs</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <span className="font-bold text-red-600 dark:text-red-400">TDS</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">TDS on Salary</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Section 192</p>
          </div>
        </div>
      </div>
    </div>
  );
}
