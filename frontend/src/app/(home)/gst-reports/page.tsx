"use client";

import Link from "next/link";

export default function GSTReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">GST Reports</h1>
        <p className="text-sm text-dark-6">Generate GST returns and reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/gst-reports/gstr1"
          className="group rounded-lg bg-white p-6 shadow-1 transition hover:shadow-md dark:bg-gray-dark"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-dark group-hover:text-primary dark:text-white">
            GSTR-1
          </h2>
          <p className="mb-4 text-sm text-dark-6">
            Details of outward supplies of goods or services. File monthly or quarterly based on your turnover.
          </p>
          <ul className="space-y-1 text-sm text-dark-6">
            <li>• B2B Invoice details</li>
            <li>• B2C Large & Small supplies</li>
            <li>• HSN-wise summary</li>
            <li>• Document issued summary</li>
          </ul>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
            Generate Report
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/gst-reports/gstr3b"
          className="group rounded-lg bg-white p-6 shadow-1 transition hover:shadow-md dark:bg-gray-dark"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-dark group-hover:text-primary dark:text-white">
            GSTR-3B
          </h2>
          <p className="mb-4 text-sm text-dark-6">
            Monthly summary return with tax payment. Self-declaration of tax liability.
          </p>
          <ul className="space-y-1 text-sm text-dark-6">
            <li>• Outward taxable supplies</li>
            <li>• Inter-state supplies</li>
            <li>• Eligible ITC</li>
            <li>• Tax payable summary</li>
          </ul>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
            Generate Report
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      <div className="mt-8 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-300">Filing Deadlines</h3>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
              GSTR-1 is due on the 11th of the following month (monthly filers) or 13th of the month following the quarter (quarterly filers).
              GSTR-3B is due on the 20th of the following month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
