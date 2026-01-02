"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Download, Eye, Search, Calendar, Printer } from "lucide-react";
import { payrollApi, Payslip } from "@/services/api";

interface PayslipSummary {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  gross_salary: number;
  total_deductions: number;
  net_pay: number;
}

export default function PayslipsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<PayslipSummary[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPayslip, setLoadingPayslip] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    parseInt(searchParams.get("month") || String(new Date().getMonth() + 1))
  );
  const [selectedYear, setSelectedYear] = useState(
    parseInt(searchParams.get("year") || String(new Date().getFullYear()))
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id");
    if (!storedCompanyId) {
      router.push("/company");
      return;
    }
    setCompanyId(storedCompanyId);
    loadPayslips(storedCompanyId, selectedMonth, selectedYear);
  }, [router, selectedMonth, selectedYear]);

  const loadPayslips = async (companyId: string, month: number, year: number) => {
    try {
      setLoading(true);
      const data = await payrollApi.listPayslips(companyId, month, year);
      setPayslips(data);
    } catch (error) {
      console.error("Error loading payslips:", error);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const viewPayslip = async (employeeId: string) => {
    if (!companyId) return;

    try {
      setLoadingPayslip(true);
      const data = await payrollApi.getPayslip(companyId, employeeId, selectedMonth, selectedYear);
      setSelectedPayslip(data);
    } catch (error) {
      console.error("Error loading payslip:", error);
    } finally {
      setLoadingPayslip(false);
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

  const filteredPayslips = payslips.filter(
    (p) =>
      p.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payslips</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and download employee payslips
          </p>
        </div>
      </div>

      {/* Period Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or employee code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payslips List */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {months[selectedMonth - 1]} {selectedYear} Payslips
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Gross
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Deductions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Net Pay
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No payslips found for this period</p>
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map((payslip) => (
                    <tr
                      key={payslip.employee_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                      onClick={() => viewPayslip(payslip.employee_id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {payslip.employee_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {payslip.employee_code}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(payslip.gross_salary)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                        {formatCurrency(payslip.total_deductions)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(payslip.net_pay)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewPayslip(payslip.employee_id);
                          }}
                          className="p-2 text-gray-500 hover:text-primary"
                          title="View Payslip"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payslip Detail */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Payslip Detail</h2>
            {selectedPayslip && (
              <button className="p-2 text-gray-500 hover:text-primary" title="Print">
                <Printer className="w-5 h-5" />
              </button>
            )}
          </div>

          {loadingPayslip ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : selectedPayslip ? (
            <div className="p-4 space-y-4 text-sm">
              {/* Employee Info */}
              <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {selectedPayslip.employee.name}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {selectedPayslip.employee.employee_code}
                </p>
                {selectedPayslip.employee.department && (
                  <p className="text-gray-500 dark:text-gray-400">
                    {selectedPayslip.employee.department}
                  </p>
                )}
              </div>

              {/* Earnings */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Earnings</h4>
                <div className="space-y-1">
                  {Object.entries(selectedPayslip.earnings).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{key}</span>
                      <span className="text-gray-900 dark:text-white">
                        {formatCurrency(value as number)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>Gross Salary</span>
                    <span className="text-green-600">
                      {formatCurrency(selectedPayslip.summary.gross_salary)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Deductions</h4>
                <div className="space-y-1">
                  {Object.entries(selectedPayslip.deductions).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{key}</span>
                      <span className="text-red-600 dark:text-red-400">
                        {formatCurrency(value as number)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>Total Deductions</span>
                    <span className="text-red-600">
                      {formatCurrency(selectedPayslip.summary.total_deductions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="pt-4 border-t-2 border-gray-300 dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">Net Pay</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(selectedPayslip.summary.net_pay)}
                  </span>
                </div>
              </div>

              {/* Bank Details */}
              {selectedPayslip.employee.bank_name && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-xs">
                  <p className="text-gray-500 dark:text-gray-400">
                    Bank: {selectedPayslip.employee.bank_name}
                  </p>
                  {selectedPayslip.employee.bank_account && (
                    <p className="text-gray-500 dark:text-gray-400">
                      A/C: ****{selectedPayslip.employee.bank_account.slice(-4)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select an employee to view payslip</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
