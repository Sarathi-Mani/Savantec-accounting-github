"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function CompanySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { company, companies, selectCompany } = useAuth();

  if (companies.length <= 1) {
    return null;
  }

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="flex items-center gap-2 rounded-lg border border-stroke bg-gray-2 px-4 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-3 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-3">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="max-w-[120px] truncate">{company?.name || "Select"}</span>
        <ChevronUpIcon
          aria-hidden
          className={cn(
            "h-4 w-4 rotate-180 transition-transform",
            isOpen && "rotate-0",
          )}
          strokeWidth={1.5}
        />
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-w-[220px]"
        align="end"
      >
        <div className="p-2">
          <p className="mb-2 px-2.5 text-xs font-medium uppercase text-dark-6">
            Switch Company
          </p>
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                selectCompany(c);
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                company?.id === c.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-gray-2 dark:hover:bg-dark-3"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold",
                  company?.id === c.id
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-dark-6 dark:bg-dark-3"
                )}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-dark dark:text-white">
                  {c.name}
                </p>
                <p className="truncate text-xs text-dark-6">{c.gstin}</p>
              </div>
              {company?.id === c.id && (
                <svg
                  className="h-5 w-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
