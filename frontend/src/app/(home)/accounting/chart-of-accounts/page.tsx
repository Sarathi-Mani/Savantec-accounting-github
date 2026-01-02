"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { accountingApi, Account, AccountType, getErrorMessage } from "@/services/api";

interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  isExpanded?: boolean;
}

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  liability: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  equity: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  revenue: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  expense: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

export default function ChartOfAccountsPage() {
  const { company } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTree, setAccountTree] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    account_type: "asset" as AccountType,
    parent_id: "",
    opening_balance: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.id) {
      fetchAccounts();
    }
  }, [company?.id]);

  useEffect(() => {
    buildAccountTree();
  }, [accounts]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await accountingApi.listAccounts(company!.id);
      setAccounts(data);
      // Expand all account types by default
      setExpandedNodes(new Set(["assets", "liabilities", "equity", "revenue", "expenses"]));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  };

  const buildAccountTree = () => {
    // Build tree structure
    const accountMap = new Map<string, AccountTreeNode>();
    const rootAccounts: AccountTreeNode[] = [];

    // First pass: create nodes
    accounts.forEach((acc) => {
      accountMap.set(acc.id, { ...acc, children: [] });
    });

    // Second pass: build tree
    accounts.forEach((acc) => {
      const node = accountMap.get(acc.id)!;
      if (acc.parent_id && accountMap.has(acc.parent_id)) {
        accountMap.get(acc.parent_id)!.children.push(node);
      } else {
        rootAccounts.push(node);
      }
    });

    // Sort by code
    const sortByCode = (a: AccountTreeNode, b: AccountTreeNode) => a.code.localeCompare(b.code);
    rootAccounts.sort(sortByCode);
    rootAccounts.forEach((node) => node.children.sort(sortByCode));

    setAccountTree(rootAccounts);
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormData({
      code: "",
      name: "",
      description: "",
      account_type: "asset",
      parent_id: "",
      opening_balance: 0,
    });
    setShowModal(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      description: account.description || "",
      account_type: account.account_type,
      parent_id: account.parent_id || "",
      opening_balance: typeof account.opening_balance === 'string' ? parseFloat(account.opening_balance) || 0 : account.opening_balance,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingAccount) {
        await accountingApi.updateAccount(company!.id, editingAccount.id, {
          code: formData.code,
          name: formData.name,
          description: formData.description || undefined,
          parent_id: formData.parent_id || undefined,
          opening_balance: formData.opening_balance,
        });
      } else {
        await accountingApi.createAccount(company!.id, {
          code: formData.code,
          name: formData.name,
          description: formData.description || undefined,
          account_type: formData.account_type,
          parent_id: formData.parent_id || undefined,
          opening_balance: formData.opening_balance,
        });
      }
      setShowModal(false);
      fetchAccounts();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save account"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Are you sure you want to delete "${account.name}"?`)) return;
    try {
      await accountingApi.deleteAccount(company!.id, account.id);
      fetchAccounts();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete account"));
    }
  };

  const renderAccountNode = (node: AccountTreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-3 border-b border-stroke px-4 py-3 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-2 ${
            level > 0 ? "bg-gray-50/50 dark:bg-gray-dark/50" : ""
          }`}
          style={{ paddingLeft: `${16 + level * 24}px` }}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleNode(node.id)}
            className={`flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-3 ${
              !hasChildren ? "invisible" : ""
            }`}
          >
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Account Code */}
          <span className="w-20 font-mono text-sm text-gray-600 dark:text-gray-400">{node.code}</span>

          {/* Account Name */}
          <Link
            href={`/accounting/chart-of-accounts?ledger=${node.id}`}
            className="flex-1 font-medium text-dark hover:text-primary dark:text-white"
          >
            {node.name}
          </Link>

          {/* Account Type Badge */}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACCOUNT_TYPE_COLORS[node.account_type]}`}
          >
            {ACCOUNT_TYPE_LABELS[node.account_type]}
          </span>

          {/* Balance */}
          <span
            className={`w-28 text-right font-medium ${
              Number(node.current_balance || 0) >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatCurrency(Number(node.current_balance || 0))}
          </span>

          {/* Actions */}
          <div className="flex gap-1">
            {!node.is_system && (
              <>
                <button
                  onClick={() => openEditModal(node)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-primary dark:hover:bg-dark-3"
                  title="Edit"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(node)}
                  className="rounded p-1 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderAccountNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderAccountGroup = (type: AccountType, label: string) => {
    const groupId = type + "s";
    const isExpanded = expandedNodes.has(groupId);
    const typeAccounts = accountTree.filter((a) => a.account_type === type);
    const totalBalance = typeAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

    if (typeAccounts.length === 0) return null;

    return (
      <div key={type} className="mb-4">
        <button
          onClick={() => toggleNode(groupId)}
          className={`flex w-full items-center gap-3 rounded-t-lg px-4 py-3 text-left font-semibold ${ACCOUNT_TYPE_COLORS[type]}`}
        >
          <svg
            className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="flex-1">{label}</span>
          <span>{formatCurrency(totalBalance)}</span>
        </button>

        {isExpanded && (
          <div className="rounded-b-lg border border-t-0 border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
            {typeAccounts.map((node) => renderAccountNode(node, 0))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/accounting" className="hover:text-primary">
              Accounting
            </Link>
            <span>/</span>
            <span>Chart of Accounts</span>
          </div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Chart of Accounts</h1>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition hover:bg-opacity-90"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Account Groups */}
      <div className="space-y-2">
        {renderAccountGroup("asset", "Assets")}
        {renderAccountGroup("liability", "Liabilities")}
        {renderAccountGroup("equity", "Equity")}
        {renderAccountGroup("revenue", "Revenue")}
        {renderAccountGroup("expense", "Expenses")}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h2 className="mb-4 text-xl font-bold text-dark dark:text-white">
              {editingAccount ? "Edit Account" : "Create Account"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 font-mono text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    required
                    disabled={editingAccount?.is_system}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                    Type *
                  </label>
                  <select
                    value={formData.account_type}
                    onChange={(e) =>
                      setFormData({ ...formData, account_type: e.target.value as AccountType })
                    }
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                    disabled={!!editingAccount}
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                  Parent Account
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                >
                  <option value="">None (Top Level)</option>
                  {accounts
                    .filter(
                      (a) =>
                        a.account_type === formData.account_type &&
                        a.id !== editingAccount?.id
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                  Opening Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) =>
                    setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingAccount ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
