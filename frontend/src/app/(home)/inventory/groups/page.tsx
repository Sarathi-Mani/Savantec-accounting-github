"use client";

import { useAuth } from "@/context/AuthContext";
import { inventoryApi, StockGroup, getErrorMessage } from "@/services/api";
import { useEffect, useState } from "react";

export default function StockGroupsPage() {
  const { company } = useAuth();
  const [groups, setGroups] = useState<StockGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyFormData = {
    name: "",
    parent_id: "",
    description: "",
  };

  const [formData, setFormData] = useState(emptyFormData);

  useEffect(() => {
    const fetchGroups = async () => {
      if (!company?.id) {
        setLoading(false);
        return;
      }
      try {
        const data = await inventoryApi.listGroups(company.id);
        setGroups(data);
      } catch (error) {
        console.error("Failed to fetch stock groups:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [company?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
    setError(null);
  };

  const handleEdit = (group: StockGroup) => {
    setEditingId(group.id);
    setFormData({
      name: group.name,
      parent_id: group.parent_id || "",
      description: group.description || "",
    });
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.name.trim()) {
      setError("Please enter a group name");
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      if (editingId) {
        // Update existing - Note: API might need update endpoint
        const updated = await inventoryApi.createGroup(company.id, {
          ...formData,
          parent_id: formData.parent_id || undefined,
        });
        setGroups(groups.map((g) => (g.id === editingId ? updated : g)));
      } else {
        // Create new
        const newGroup = await inventoryApi.createGroup(company.id, {
          ...formData,
          parent_id: formData.parent_id || undefined,
        });
        setGroups([...groups, newGroup]);
      }
      resetForm();
    } catch (error: any) {
      setError(getErrorMessage(error, `Failed to ${editingId ? "update" : "create"} stock group`));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!company?.id) return;
    // Note: API might need delete endpoint
    setDeleteConfirm(null);
  };

  const getParentName = (parentId?: string) => {
    if (!parentId) return "—";
    const parent = groups.find((g) => g.id === parentId);
    return parent?.name || "Unknown";
  };

  const getGroupPath = (group: StockGroup): string => {
    if (!group.parent_id) return group.name;
    const parent = groups.find((g) => g.id === group.parent_id);
    return parent ? `${getGroupPath(parent)} > ${group.name}` : group.name;
  };

  if (!company) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-1 dark:bg-gray-dark">
        <p className="text-dark-6">Please select a company first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Stock Groups</h1>
          <p className="text-sm text-dark-6">Organize inventory items into categories and subcategories</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Group
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">Delete Stock Group</h3>
            <p className="mb-4 text-sm text-dark-6">
              Are you sure you want to delete this stock group? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
          <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
            {editingId ? "Edit Stock Group" : "Add Stock Group"}
          </h2>
          
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Raw Materials"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Parent Group</label>
                <select
                  name="parent_id"
                  value={formData.parent_id}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                >
                  <option value="">None (Top Level)</option>
                  {groups
                    .filter((g) => !editingId || g.id !== editingId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {getGroupPath(g)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Description of this stock group"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
              >
                {formLoading ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Groups List */}
      <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-dark-6">No stock groups added yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              Add your first stock group
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Path</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Parent</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Description</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-dark-6">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                    <td className="px-6 py-4">
                      <span className="font-medium text-dark dark:text-white">{group.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-6">{getGroupPath(group)}</td>
                    <td className="px-6 py-4 text-sm text-dark-6">{getParentName(group.parent_id)}</td>
                    <td className="px-6 py-4 text-sm text-dark-6">{group.description || "—"}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          group.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {group.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(group)}
                          className="rounded p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Edit"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(group.id)}
                          className="rounded p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
