"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const actions = [
  {
    title: "Create Invoice",
    description: "Generate a new GST invoice",
    href: "/invoices/new",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    color: "bg-primary text-white",
  },
  {
    title: "Add Customer",
    description: "Register a new customer",
    href: "/customers/new",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
        />
      </svg>
    ),
    color: "bg-green-500 text-white",
  },
  {
    title: "Add Product",
    description: "Add a product or service",
    href: "/products/new",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
    color: "bg-purple-500 text-white",
  },
  {
    title: "GST Reports",
    description: "Generate GSTR-1 & GSTR-3B",
    href: "/gst-reports",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    color: "bg-orange-500 text-white",
  },
];

export function QuickActionsCard() {
  const { company } = useAuth();

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
      <h2 className="mb-6 text-lg font-semibold text-dark dark:text-white">
        Quick Actions
      </h2>

      <div className="space-y-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={company ? action.href : "#"}
            className={`flex items-center gap-4 rounded-lg border border-stroke p-4 transition-all hover:border-primary hover:shadow-md dark:border-dark-3 dark:hover:border-primary ${
              !company ? "cursor-not-allowed opacity-50" : ""
            }`}
            onClick={(e) => {
              if (!company) {
                e.preventDefault();
              }
            }}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${action.color}`}>
              {action.icon}
            </div>
            <div>
              <h3 className="font-medium text-dark dark:text-white">
                {action.title}
              </h3>
              <p className="text-sm text-dark-6">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
