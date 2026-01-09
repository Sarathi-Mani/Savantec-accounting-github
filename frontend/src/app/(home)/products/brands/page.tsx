"use client";

import { useAuth } from "@/context/AuthContext";
import { brandsApi, Brand, BrandListResponse } from "@/services/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function BrandsPage() {
    const { company } = useAuth();
    const [data, setData] = useState<BrandListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchBrands = async () => {
            if (!company?.id) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const result = await brandsApi.list(company.id, {
                    page,
                    page_size: 10,
                    search: search || undefined,
                });
                setData(result);
            } catch (error) {
                console.error("Failed to fetch brands:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBrands();
    }, [company?.id, page, search]);

    const handleDelete = async (brandId: string) => {
        if (!company?.id || !confirm("Are you sure you want to delete this brand?")) return;
        try {
            await brandsApi.delete(company.id, brandId);
            setData((prev) =>
                prev
                    ? {
                        ...prev,
                        brands: prev.brands.filter((b) => b.id !== brandId),
                        total: prev.total - 1,
                    }
                    : null
            );
        } catch (error) {
            console.error("Failed to delete brand:", error);
        }
    };

    const totalPages = data ? Math.ceil(data.total / 10) : 0;

    return (
        <div>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-dark dark:text-white">Brands</h1>
                    <p className="text-sm text-dark-6">Manage your product brands</p>
                </div>
                <Link
                    href="/products/brands/new"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Brand
                </Link>
            </div>

            {/* Filters */}
            <div className="mb-6 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Search brands..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    </div>
                ) : !company ? (
                    <div className="py-20 text-center text-dark-6">No company selected</div>
                ) : data?.brands.length === 0 ? (
                    <div className="py-20 text-center">
                        <svg className="mx-auto mb-4 h-16 w-16 text-dark-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-dark-6">No brands found</p>
                        <Link href="/products/brands/new" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
                            Add your first brand
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-stroke dark:border-dark-3">
                                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Brand Name</th>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-dark-6">Description</th>
                                    <th className="px-6 py-4 text-right text-sm font-medium text-dark-6">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.brands.map((brand) => (
                                    <tr key={brand.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-dark dark:text-white">{brand.name}</p>
                                                <p className="text-xs text-dark-6">
                                                    Created: {new Date(brand.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-dark-6 line-clamp-2">{brand.description || "-"}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/products/brands/${brand.id}/edit`}
                                                    className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-dark-3"
                                                    title="Edit"
                                                >
                                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(brand.id)}
                                                    className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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

                {/* Pagination */}
                {data && totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-stroke px-6 py-4 dark:border-dark-3">
                        <p className="text-sm text-dark-6">
                            Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data.total)} of {data.total}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-dark-3"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-dark-3"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}