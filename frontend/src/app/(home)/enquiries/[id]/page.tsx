"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768";

interface EnquiryProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  notes?: string;
}

interface Enquiry {
  id: string;
  enquiry_number: string;
  enquiry_date: string;
  sales_ticket_id?: string;
  customer_id?: string;
  contact_id?: string;
  sales_person_id?: string;
  prospect_name?: string;
  prospect_email?: string;
  prospect_phone?: string;
  prospect_company?: string;
  source: string;
  source_details?: string;
  subject: string;
  description?: string;
  requirements?: string;
  products_interested?: EnquiryProduct[];
  expected_value: number;
  expected_close_date?: string;
  follow_up_date?: string;
  last_contact_date?: string;
  status: string;
  priority: string;
  converted_quotation_id?: string;
  lost_reason?: string;
  lost_to_competitor?: string;
  notes?: string;
  customer_name?: string;
  contact_name?: string;
  sales_person_name?: string;
  ticket_number?: string;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  qualified: "bg-purple-100 text-purple-800 border-purple-200",
  proposal_sent: "bg-yellow-100 text-yellow-800 border-yellow-200",
  negotiation: "bg-orange-100 text-orange-800 border-orange-200",
  won: "bg-green-100 text-green-800 border-green-200",
  lost: "bg-red-100 text-red-800 border-red-200",
  on_hold: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function EnquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const enquiryId = params.id as string;

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [lostToCompetitor, setLostToCompetitor] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [validityDays, setValidityDays] = useState(30);

  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null;

  useEffect(() => {
    if (companyId && enquiryId) {
      fetchEnquiry();
    }
  }, [companyId, enquiryId]);

  const fetchEnquiry = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch enquiry");

      const data = await response.json();
      setEnquiry(data);
    } catch (err) {
      setError("Failed to load enquiry");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async () => {
    if (!newStatus) return;
    setUpdating(true);

    try {
      const payload: any = { status: newStatus };
      if (newStatus === "lost") {
        payload.lost_reason = lostReason;
        payload.lost_to_competitor = lostToCompetitor;
      }

      const response = await fetch(
        `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to update status");

      await fetchEnquiry();
      setShowStatusModal(false);
      setNewStatus("");
      setLostReason("");
      setLostToCompetitor("");
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const convertToQuotation = async () => {
    setConverting(true);

    try {
      const response = await fetch(
        `${API_BASE}/companies/${companyId}/enquiries/${enquiryId}/convert-to-quotation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ validity_days: validityDays }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to convert enquiry");
      }

      const data = await response.json();
      // Navigate to the created quotation
      router.push(`/quotations/${data.quotation_id}`);
    } catch (err: any) {
      alert(err.message || "Failed to convert enquiry to quotation");
    } finally {
      setConverting(false);
      setShowConvertModal(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <p className="text-yellow-800 dark:text-yellow-400">Please select a company first.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400">{error || "Enquiry not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/enquiries" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{enquiry.enquiry_number}</h1>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full border ${
                  statusColors[enquiry.status] || "bg-gray-100 text-gray-800"
                }`}
              >
                {enquiry.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400">{enquiry.subject}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {enquiry.ticket_number && (
            <Link
              href={`/sales/tickets/${enquiry.sales_ticket_id}`}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 dark:border-dark-3 dark:text-gray-300 dark:hover:bg-dark-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              {enquiry.ticket_number}
            </Link>
          )}
          <button
            onClick={() => setShowStatusModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Update Status
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Enquiry Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Date</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{formatDate(enquiry.enquiry_date)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Source</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{enquiry.source.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Priority</dt>
                <dd className="font-medium text-gray-900 dark:text-white capitalize">{enquiry.priority}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Expected Value</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{formatCurrency(enquiry.expected_value)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Expected Close</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{formatDate(enquiry.expected_close_date)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Follow-up Date</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{formatDate(enquiry.follow_up_date)}</dd>
              </div>
            </dl>

            {enquiry.description && (
              <div className="mt-6">
                <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                <p className="text-gray-900 dark:text-gray-200 whitespace-pre-wrap">{enquiry.description}</p>
              </div>
            )}

            {enquiry.requirements && (
              <div className="mt-4">
                <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Requirements</h3>
                <p className="text-gray-900 dark:text-gray-200 whitespace-pre-wrap">{enquiry.requirements}</p>
              </div>
            )}

            {enquiry.notes && (
              <div className="mt-4">
                <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Notes</h3>
                <p className="text-gray-900 dark:text-gray-200 whitespace-pre-wrap">{enquiry.notes}</p>
              </div>
            )}
          </div>

          {/* Products of Interest */}
          {enquiry.products_interested && enquiry.products_interested.length > 0 && (
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Products of Interest</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b dark:border-dark-3">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Quantity</th>
                      <th className="pb-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiry.products_interested.map((product, index) => (
                      <tr key={index} className="border-b dark:border-dark-3 last:border-0">
                        <td className="py-3 text-gray-900 dark:text-white">{product.product_name || "N/A"}</td>
                        <td className="py-3 text-gray-900 dark:text-white">{product.quantity}</td>
                        <td className="py-3 text-gray-600 dark:text-gray-400">{product.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lost Info (if applicable) */}
          {enquiry.status === "lost" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 dark:bg-red-900/20 dark:border-red-800">
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4">Lost Deal Information</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-red-600 dark:text-red-400">Lost to Competitor</dt>
                  <dd className="font-medium text-red-900 dark:text-red-300">{enquiry.lost_to_competitor || "-"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-red-600 dark:text-red-400">Reason</dt>
                  <dd className="font-medium text-red-900 dark:text-red-300">{enquiry.lost_reason || "-"}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer / Prospect Card */}
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {enquiry.customer_name ? "Customer" : "Prospect"}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {enquiry.customer_name || enquiry.prospect_name || "-"}
                </p>
              </div>
              {enquiry.prospect_company && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
                  <p className="font-medium text-gray-900 dark:text-white">{enquiry.prospect_company}</p>
                </div>
              )}
              {(enquiry.contact_name || enquiry.prospect_email) && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Contact</p>
                  <p className="font-medium text-gray-900 dark:text-white">{enquiry.contact_name || enquiry.prospect_email}</p>
                </div>
              )}
              {enquiry.prospect_phone && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="font-medium text-gray-900 dark:text-white">{enquiry.prospect_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Assignment Card */}
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Assignment</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sales Person</p>
                <p className="font-medium text-gray-900 dark:text-white">{enquiry.sales_person_name || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Contact</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(enquiry.last_contact_date)}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
            <div className="space-y-3">
              {enquiry.status !== "won" && enquiry.status !== "lost" && !enquiry.converted_quotation_id && (
                <>
                  <button
                    onClick={() => setShowConvertModal(true)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Convert to Quotation
                  </button>
                  <button
                    onClick={() => {
                      setNewStatus("lost");
                      setShowStatusModal(true);
                    }}
                    className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    Mark as Lost
                  </button>
                </>
              )}
              {enquiry.converted_quotation_id && (
                <Link
                  href={`/quotations/${enquiry.converted_quotation_id}`}
                  className="block w-full px-4 py-2 text-center bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                >
                  View Quotation
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Update Status</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                >
                  <option value="">Select status...</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>

              {newStatus === "lost" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Lost to Competitor
                    </label>
                    <input
                      type="text"
                      value={lostToCompetitor}
                      onChange={(e) => setLostToCompetitor(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                      placeholder="Competitor name..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                    <textarea
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
                      placeholder="Why was this deal lost?"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-dark-3 dark:text-gray-300 dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                onClick={updateStatus}
                disabled={!newStatus || updating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {updating ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Quotation Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Convert to Quotation</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create a draft quotation from this enquiry</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-2 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">This will:</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create a draft quotation with enquiry details
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copy products of interest as quotation line items
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Link quotation to the sales ticket
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Update enquiry status to "Proposal Sent"
                </li>
              </ul>
            </div>

            {enquiry.products_interested && enquiry.products_interested.length > 0 && (
              <div className="mb-4 p-4 border dark:border-dark-3 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Products to include ({enquiry.products_interested.length}):
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {enquiry.products_interested.slice(0, 5).map((p, i) => (
                    <li key={i}>• {p.product_name || "Product"} × {p.quantity}</li>
                  ))}
                  {enquiry.products_interested.length > 5 && (
                    <li className="text-gray-400">...and {enquiry.products_interested.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quotation Validity (days)
              </label>
              <input
                type="number"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                min="1"
                max="365"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-dark-3 dark:text-gray-300 dark:hover:bg-dark-3"
              >
                Cancel
              </button>
              <button
                onClick={convertToQuotation}
                disabled={converting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {converting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Converting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Convert to Quotation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

