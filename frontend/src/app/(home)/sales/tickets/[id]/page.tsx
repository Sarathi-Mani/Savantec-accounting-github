"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6768";

interface TimelineEntry {
  id: string;
  action_type: string;
  action_description: string;
  old_value?: string;
  new_value?: string;
  related_document_type?: string;
  related_document_id?: string;
  created_by_name?: string;
  created_at: string;
}

interface TicketFlow {
  ticket: {
    id: string;
    ticket_number: string;
    status: string;
    current_stage: string;
    expected_value: number;
    actual_value?: number;
    created_date: string;
    expected_close_date?: string;
    actual_close_date?: string;
    win_probability: number;
    loss_reason?: string;
    competitor_name?: string;
    notes?: string;
    customer_name?: string;
    contact_name?: string;
    sales_person_name?: string;
  };
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
  };
  sales_person?: {
    id: string;
    name: string;
    email?: string;
  };
  enquiries: Array<{
    id: string;
    enquiry_number: string;
    enquiry_date: string;
    subject: string;
    status: string;
    expected_value: number;
  }>;
  quotations: Array<{
    id: string;
    quotation_number: string;
    quotation_date: string;
    status: string;
    total_amount: number;
  }>;
  sales_orders: Array<{
    id: string;
    order_number: string;
    order_date: string;
    status: string;
    total_amount: number;
  }>;
  delivery_challans: Array<{
    id: string;
    dc_number: string;
    dc_date: string;
    status: string;
    dc_type: string;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string;
    status: string;
    total_amount: number;
    amount_paid: number;
  }>;
  timeline: TimelineEntry[];
  summary: {
    total_enquiries: number;
    total_quotations: number;
    total_sales_orders: number;
    total_delivery_challans: number;
    total_invoices: number;
    expected_value: number;
    actual_value: number;
    days_in_pipeline: number;
  };
}

const stageOrder = ["enquiry", "quotation", "sales_order", "delivery", "invoiced", "paid"];
const stageLabels: Record<string, string> = {
  enquiry: "Enquiry",
  quotation: "Quotation",
  sales_order: "Sales Order",
  delivery: "Delivery",
  invoiced: "Invoiced",
  paid: "Paid",
};

const actionIcons: Record<string, string> = {
  created: "🎯",
  status_changed: "🔄",
  stage_changed: "📈",
  enquiry_created: "📝",
  quotation_created: "📋",
  quotation_sent: "📧",
  quotation_approved: "✅",
  quotation_rejected: "❌",
  sales_order_created: "📦",
  delivery_created: "🚚",
  delivery_dispatched: "📤",
  delivery_completed: "✔️",
  invoice_created: "🧾",
  payment_received: "💰",
  note_added: "📌",
  follow_up_scheduled: "⏰",
};

export default function TicketFlowPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [flow, setFlow] = useState<TicketFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null;

  useEffect(() => {
    if (companyId && ticketId) {
      fetchFlow();
    }
  }, [companyId, ticketId]);

  const fetchFlow = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/companies/${companyId}/sales-tickets/${ticketId}/flow`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch ticket flow");
      const data = await response.json();
      setFlow(data);
    } catch (err) {
      setError("Failed to load ticket");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);

    try {
      const response = await fetch(
        `${API_BASE}/companies/${companyId}/sales-tickets/${ticketId}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ note: newNote }),
        }
      );

      if (response.ok) {
        setNewNote("");
        fetchFlow();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingNote(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  if (error || !flow) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-400">{error || "Ticket not found"}</p>
        </div>
      </div>
    );
  }

  const currentStageIndex = stageOrder.indexOf(flow.ticket.current_stage);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sales/tickets" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{flow.ticket.ticket_number}</h1>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  flow.ticket.status === "won"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : flow.ticket.status === "lost"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {flow.ticket.status.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {flow.ticket.customer_name || "No customer"} · {flow.summary.days_in_pipeline} days in pipeline
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(flow.ticket.actual_value || flow.ticket.expected_value)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {flow.ticket.actual_value ? "Won Value" : "Expected Value"}
          </p>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Pipeline Progress</h2>
        <div className="flex items-center">
          {stageOrder.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isFuture = index > currentStageIndex;

            return (
              <div key={stage} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isCurrent
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isCurrent ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {stageLabels[stage]}
                  </span>
                </div>
                {index < stageOrder.length - 1 && (
                  <div
                    className={`flex-1 h-1 ${
                      isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-dark-2"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documents Flow */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enquiries */}
          {flow.enquiries.length > 0 && (
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">📝</span>
                Enquiries ({flow.enquiries.length})
              </h3>
              <div className="space-y-3">
                {flow.enquiries.map((enq) => (
                  <Link
                    key={enq.id}
                    href={`/enquiries/${enq.id}`}
                    className="block p-4 border rounded-lg hover:bg-gray-50 transition dark:border-dark-3 dark:hover:bg-dark-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-indigo-600 dark:text-indigo-400">{enq.enquiry_number}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{enq.subject}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(enq.enquiry_date)}</p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
                        {enq.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quotations */}
          {flow.quotations.length > 0 && (
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">📋</span>
                Quotations ({flow.quotations.length})
              </h3>
              <div className="space-y-3">
                {flow.quotations.map((q) => (
                  <Link
                    key={q.id}
                    href={`/quotations/${q.id}`}
                    className="block p-4 border rounded-lg hover:bg-gray-50 transition dark:border-dark-3 dark:hover:bg-dark-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-indigo-600 dark:text-indigo-400">{q.quotation_number}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formatCurrency(q.total_amount)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(q.quotation_date)}</p>
                      </div>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
                        {q.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Sales Orders */}
          {flow.sales_orders.length > 0 && (
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <span className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400">📦</span>
                Sales Orders ({flow.sales_orders.length})
              </h3>
              <div className="space-y-3">
                {flow.sales_orders.map((so) => (
                  <div key={so.id} className="p-4 border rounded-lg dark:border-dark-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-purple-600 dark:text-purple-400">{so.order_number}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formatCurrency(so.total_amount)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(so.order_date)}</p>
                      </div>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full dark:bg-purple-900/30 dark:text-purple-400">
                        {so.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Challans */}
          {flow.delivery_challans.length > 0 && (
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <span className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">🚚</span>
                Delivery Challans ({flow.delivery_challans.length})
              </h3>
              <div className="space-y-3">
                {flow.delivery_challans.map((dc) => (
                  <Link
                    key={dc.id}
                    href={`/delivery-challans/${dc.id}`}
                    className="block p-4 border rounded-lg hover:bg-gray-50 transition dark:border-dark-3 dark:hover:bg-dark-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-orange-600 dark:text-orange-400">{dc.dc_number}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(dc.dc_date)}</p>
                      </div>
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full dark:bg-orange-900/30 dark:text-orange-400">
                        {dc.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {flow.invoices.length > 0 && (
            <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <span className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">🧾</span>
                Invoices ({flow.invoices.length})
              </h3>
              <div className="space-y-3">
                {flow.invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="block p-4 border rounded-lg hover:bg-gray-50 transition dark:border-dark-3 dark:hover:bg-dark-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-green-600 dark:text-green-400">{inv.invoice_number}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {formatCurrency(inv.total_amount)}
                          {inv.amount_paid > 0 && (
                            <span className="text-green-600 dark:text-green-400 ml-2">
                              (Paid: {formatCurrency(inv.amount_paid)})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(inv.invoice_date)}</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">
                        {inv.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Timeline & Info */}
        <div className="space-y-6">
          {/* Customer & Contact */}
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Customer & Contact</h3>
            {flow.customer ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-medium dark:text-white">{flow.customer.name}</p>
                  {flow.customer.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{flow.customer.email}</p>
                  )}
                </div>
                {flow.contact && (
                  <div className="pt-3 border-t dark:border-dark-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Contact Person</p>
                    <p className="font-medium dark:text-white">{flow.contact.name}</p>
                    {flow.contact.designation && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{flow.contact.designation}</p>
                    )}
                  </div>
                )}
                {flow.sales_person && (
                  <div className="pt-3 border-t dark:border-dark-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sales Person</p>
                    <p className="font-medium dark:text-white">{flow.sales_person.name}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No customer assigned</p>
            )}
          </div>

          {/* Add Note */}
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Add Note</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-2 dark:border-dark-3 dark:text-white"
              placeholder="Type a note..."
            />
            <button
              onClick={addNote}
              disabled={addingNote || !newNote.trim()}
              className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {addingNote ? "Adding..." : "Add Note"}
            </button>
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-dark rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Activity Timeline</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {flow.timeline.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No activity yet</p>
              ) : (
                flow.timeline.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <span className="text-xl">
                      {actionIcons[entry.action_type] || "📌"}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">{entry.action_description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {entry.created_by_name && `${entry.created_by_name} · `}
                        {formatDateTime(entry.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

