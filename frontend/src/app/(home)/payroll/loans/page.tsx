"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  Plus,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  Calendar,
  User,
} from "lucide-react";
import { payrollApi, EmployeeLoan, Employee, getErrorMessage } from "@/services/api";

export default function LoansPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newLoan, setNewLoan] = useState({
    employee_id: "",
    loan_type: "personal_loan",
    principal_amount: "",
    tenure_months: "12",
    interest_rate: "8",
    reason: "",
  });

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
      const [loansList, empList] = await Promise.all([
        payrollApi.listLoans(companyId),
        payrollApi.listEmployees(companyId, { status_filter: "active" }),
      ]);
      setLoans(loansList);
      setEmployees(empList);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    try {
      setProcessing(true);
      setError(null);

      await payrollApi.createLoan(companyId, {
        employee_id: newLoan.employee_id,
        loan_type: newLoan.loan_type,
        principal_amount: parseFloat(newLoan.principal_amount),
        tenure_months: parseInt(newLoan.tenure_months),
        interest_rate: parseFloat(newLoan.interest_rate),
        reason: newLoan.reason,
      });

      setSuccess("Loan created successfully!");
      setShowNewLoanModal(false);
      setNewLoan({
        employee_id: "",
        loan_type: "personal_loan",
        principal_amount: "",
        tenure_months: "12",
        interest_rate: "8",
        reason: "",
      });
      await loadData(companyId);
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to create loan"));
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveLoan = async (loanId: string) => {
    if (!companyId) return;

    try {
      setProcessing(true);
      await payrollApi.approveLoan(companyId, loanId);
      setSuccess("Loan approved!");
      await loadData(companyId);
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to approve loan"));
    } finally {
      setProcessing(false);
    }
  };

  const handleDisburseLoan = async (loanId: string) => {
    if (!companyId) return;

    try {
      setProcessing(true);
      await payrollApi.disburseLoan(companyId, loanId);
      setSuccess("Loan disbursed!");
      await loadData(companyId);
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to disburse loan"));
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

  const getEmployeeName = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    return emp?.full_name || emp?.first_name || "Unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "approved":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "pending_approval":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "closed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "approved":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "pending_approval":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "closed":
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const loanTypes = [
    { value: "salary_advance", label: "Salary Advance" },
    { value: "personal_loan", label: "Personal Loan" },
    { value: "emergency_loan", label: "Emergency Loan" },
    { value: "festival_advance", label: "Festival Advance" },
  ];

  const filteredLoans = loans.filter((loan) => {
    const empName = getEmployeeName(loan.employee_id).toLowerCase();
    const matchesSearch =
      empName.includes(searchTerm.toLowerCase()) ||
      loan.loan_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || loan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employee Loans</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage loans, advances, and EMI tracking</p>
        </div>
        <button
          onClick={() => setShowNewLoanModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Loan
        </button>
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

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by employee or loan number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
          >
            <option value="">All Status</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Loans List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Loan Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Employee
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Principal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  EMI / Month
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Outstanding
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-lg font-medium">No loans found</p>
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => (
                  <tr
                    key={loan.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {loan.loan_number}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {loan.loan_type.replace(/_/g, " ")}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 dark:text-white">
                        {getEmployeeName(loan.employee_id)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(loan.principal_amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-gray-900 dark:text-white">
                        {formatCurrency(loan.emi_amount)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {loan.emis_paid}/{loan.tenure_months} EMIs
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-medium text-orange-600 dark:text-orange-400">
                        {formatCurrency(loan.outstanding_balance)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(loan.status)}
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(loan.status)}`}>
                          {loan.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {loan.status === "pending_approval" && (
                          <button
                            onClick={() => handleApproveLoan(loan.id)}
                            disabled={processing}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {loan.status === "approved" && (
                          <button
                            onClick={() => handleDisburseLoan(loan.id)}
                            disabled={processing}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Disburse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Loan Modal */}
      {showNewLoanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create New Loan</h2>

            <form onSubmit={handleCreateLoan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Employee
                </label>
                <select
                  value={newLoan.employee_id}
                  onChange={(e) => setNewLoan((prev) => ({ ...prev, employee_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name || emp.first_name} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Loan Type
                </label>
                <select
                  value={newLoan.loan_type}
                  onChange={(e) => setNewLoan((prev) => ({ ...prev, loan_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  {loanTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Principal Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={newLoan.principal_amount}
                      onChange={(e) =>
                        setNewLoan((prev) => ({ ...prev, principal_amount: e.target.value }))
                      }
                      required
                      min={1000}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tenure (Months)
                  </label>
                  <input
                    type="number"
                    value={newLoan.tenure_months}
                    onChange={(e) =>
                      setNewLoan((prev) => ({ ...prev, tenure_months: e.target.value }))
                    }
                    required
                    min={1}
                    max={60}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Interest Rate (% per annum)
                </label>
                <input
                  type="number"
                  value={newLoan.interest_rate}
                  onChange={(e) =>
                    setNewLoan((prev) => ({ ...prev, interest_rate: e.target.value }))
                  }
                  min={0}
                  step={0.5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason
                </label>
                <textarea
                  value={newLoan.reason}
                  onChange={(e) => setNewLoan((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {processing ? "Creating..." : "Create Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
