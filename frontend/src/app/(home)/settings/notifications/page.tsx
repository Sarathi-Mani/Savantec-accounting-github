"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { company } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (company?.id) { fetchNotifications(); }
  }, [company, filter]);

  const fetchNotifications = async () => {
    try {
      const params = filter !== "all" ? `?is_read=${filter === "read"}` : "";
      const response = await api.get(`/companies/${company?.id}/notifications${params}`);
      setNotifications(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.post(`/companies/${company?.id}/notifications/${id}/read`);
      fetchNotifications();
    } catch (error) { console.error("Error:", error); }
  };

  const markAllAsRead = async () => {
    try {
      await api.post(`/companies/${company?.id}/notifications/read-all`);
      fetchNotifications();
    } catch (error) { console.error("Error:", error); }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "alert": return "⚠️";
      case "info": return "ℹ️";
      case "success": return "✅";
      case "reminder": return "⏰";
      default: return "📬";
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <Breadcrumb pageName="Notifications" />

      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          {["all", "unread", "read"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded capitalize ${filter === f ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>{f}</button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-primary hover:underline">
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`rounded-sm border p-4 shadow-default dark:border-strokedark dark:bg-boxdark ${
              n.is_read ? "border-stroke bg-white" : "border-primary bg-primary bg-opacity-5"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <span className="text-2xl">{getTypeIcon(n.type)}</span>
                <div>
                  <h4 className="font-medium text-black dark:text-white">{n.title}</h4>
                  <p className="text-sm text-body">{n.message}</p>
                  <p className="mt-2 text-xs text-body">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
              {!n.is_read && (
                <button onClick={() => markAsRead(n.id)} className="text-primary text-sm hover:underline">
                  Mark as read
                </button>
              )}
            </div>
          </div>
        ))}
        {notifications.length === 0 && !loading && (
          <div className="text-center py-10 text-body">
            No notifications found.
          </div>
        )}
      </div>
    </>
  );
}

