"use client";

import { useState } from "react";
import { SearchIcon } from "@/assets/icons";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";
import { CompanySelector } from "./company-selector";
import { companiesApi, getErrorMessage } from "@/services/api";

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const { company } = useAuth();
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ message: string; deleted: Record<string, number> } | null>(null);

  const handleDevReset = async () => {
    if (!company?.id) return;
    
    try {
      setResetting(true);
      const result = await companiesApi.devReset(company.id);
      setResetResult(result);
    } catch (err) {
      alert(getErrorMessage(err, "Failed to reset data"));
    } finally {
      setResetting(false);
    }
  };

  const closeModal = () => {
    setShowResetModal(false);
    setResetResult(null);
    if (resetResult) {
      // Refresh the page after successful reset
      window.location.reload();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-stroke bg-white px-4 py-5 shadow-1 dark:border-stroke-dark dark:bg-gray-dark md:px-5 2xl:px-10">
        <button
          onClick={toggleSidebar}
          className="rounded-lg border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
        >
          <MenuIcon />
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        {isMobile && (
          <Link href={"/"} className="ml-2 max-[430px]:hidden min-[375px]:ml-4">
            <Image
              src={"/images/logo/logo-icon.svg"}
              width={32}
              height={32}
              alt=""
              role="presentation"
            />
          </Link>
        )}

        <div className="max-xl:hidden">
          <h1 className="mb-0.5 text-heading-5 font-bold text-dark dark:text-white">
            GST Invoice Pro
          </h1>
          <p className="font-medium text-dark-6">
            {company?.name || "Select a company"}
            {company?.gstin && <span className="ml-2 text-sm">({company.gstin})</span>}
          </p>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
          <div className="relative w-full max-w-[300px] max-lg:hidden">
            <input
              type="search"
              placeholder="Search invoices..."
              className="flex w-full items-center gap-3.5 rounded-full border bg-gray-2 py-3 pl-[53px] pr-5 outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary"
            />

            <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 max-[1015px]:size-5" />
          </div>

          {/* Dev Reset Button */}
          {company?.id && (
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              title="Reset all business data (DEV)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="max-sm:hidden">Dev Reset</span>
            </button>
          )}

          <CompanySelector />

          <ThemeToggleSwitch />

          <div className="shrink-0">
            <UserInfo />
          </div>
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            {!resetResult ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-dark dark:text-white">Reset All Data?</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                  </div>
                </div>

                <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                  <p className="mb-2 text-sm font-medium text-red-700 dark:text-red-400">This will DELETE:</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-600 dark:text-red-300">
                    <li>All invoices and invoice items</li>
                    <li>All customers</li>
                    <li>All products</li>
                    <li>All payments</li>
                    <li>All accounting transactions</li>
                    <li>All accounts (Chart of Accounts)</li>
                    <li>All bank statement imports</li>
                  </ul>
                </div>

                <div className="mb-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                  <p className="mb-2 text-sm font-medium text-green-700 dark:text-green-400">This will KEEP:</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-green-600 dark:text-green-300">
                    <li>Your user account</li>
                    <li>Company profile settings</li>
                    <li>Bank account details</li>
                    <li>Authentication / Login</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    disabled={resetting}
                    className="flex-1 rounded-lg border border-stroke px-4 py-2.5 font-medium text-dark transition hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDevReset}
                    disabled={resetting}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {resetting ? "Resetting..." : "Yes, Reset All"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-dark dark:text-white">Reset Complete!</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">All business data has been cleared</p>
                  </div>
                </div>

                <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-2">
                  <p className="mb-2 text-sm font-medium text-dark dark:text-white">Deleted records:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(resetResult.deleted).map(([key, count]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">{key.replace(/_/g, " ")}:</span>
                        <span className="font-medium text-dark dark:text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition hover:bg-opacity-90"
                >
                  Reload Page
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
