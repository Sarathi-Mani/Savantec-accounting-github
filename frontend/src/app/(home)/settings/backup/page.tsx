"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Backup {
  id: string;
  filename: string;
  created_at: string;
  size: string;
  type: string;
}

export default function BackupPage() {
  const { company } = useAuth();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (company?.id) { fetchBackups(); }
  }, [company]);

  const fetchBackups = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/backups`);
      setBackups(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      await api.post(`/companies/${company?.id}/backups`);
      fetchBackups();
      alert("Backup created successfully!");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (backupId: string, filename: string) => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/backups/${backupId}/download`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Backup & Restore" />

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Create Backup */}
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h3 className="mb-4 text-lg font-medium text-black dark:text-white">Create Backup</h3>
          <p className="mb-4 text-body">
            Create a complete backup of all your data including masters, transactions, and settings.
          </p>
          <button
            onClick={createBackup}
            disabled={creating}
            className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Backup Now"}
          </button>
        </div>

        {/* Restore */}
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h3 className="mb-4 text-lg font-medium text-black dark:text-white">Restore from Backup</h3>
          <p className="mb-4 text-body">
            Upload a backup file to restore your data. This will overwrite existing data.
          </p>
          <input
            type="file"
            accept=".zip,.backup"
            className="mb-4 w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
          />
          <button className="rounded bg-warning px-6 py-2 font-medium text-white hover:bg-opacity-90">
            Restore
          </button>
        </div>
      </div>

      {/* Backup History */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <h3 className="font-medium text-black dark:text-white">Backup History</h3>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Filename</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Size</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{b.filename}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{b.size}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{b.type}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button onClick={() => downloadBackup(b.id, b.filename)} className="text-primary hover:underline mr-2">Download</button>
                    <button className="text-danger hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && !loading && (<tr><td colSpan={5} className="px-4 py-5 text-center text-body">No backups found. Create your first backup.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

