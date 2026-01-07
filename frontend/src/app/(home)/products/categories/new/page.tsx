"use client";

import { useAuth } from "@/context/AuthContext";
import { categoriesApi, getErrorMessage } from "@/services/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewCategoryPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.name.trim()) {
      setError("Category name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await categoriesApi.create(company.id, {
        ...formData,
        description: formData.description || undefined,
      });
      router.push("/products/categories");
    } catch (error: any) {
      setError(getErrorMessage(error, "Failed to create category"));
    } finally {
      setLoading(false);
    }
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Add Category</h1>
        <p className="text-sm text-dark-6">Add a new product category</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
            <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Category Information</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter category name"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Category description"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-stroke px-6 py-3 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Category"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}