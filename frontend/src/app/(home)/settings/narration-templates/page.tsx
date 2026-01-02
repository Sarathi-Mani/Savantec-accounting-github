"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface NarrationTemplate {
  id: string;
  voucher_type: string;
  template_name: string;
  template_text: string;
}

export default function NarrationTemplatesPage() {
  const { company } = useAuth();
  const [templates, setTemplates] = useState<NarrationTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ voucher_type: "payment", template_name: "", template_text: "" });

  useEffect(() => {
    if (company?.id) { fetchTemplates(); }
  }, [company]);

  const fetchTemplates = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/narration-templates`);
      setTemplates(response.data);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/companies/${company?.id}/narration-templates`, formData);
      setShowModal(false);
      setFormData({ voucher_type: "payment", template_name: "", template_text: "" });
      fetchTemplates();
    } catch (error) { console.error("Error:", error); }
  };

  return (
    <>
      <Breadcrumb pageName="Narration Templates" />

      <div className="mb-4 rounded-sm border border-primary bg-primary bg-opacity-10 p-4">
        <p className="text-primary">
          Create templates for common narrations. Use placeholders like {"{party}"}, {"{amount}"}, {"{date}"} for dynamic values.
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">+ Add Template</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Voucher Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Template Name</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Template Text</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark capitalize">{t.voucher_type}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">{t.template_name}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-sm">{t.template_text}</td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    <button className="text-danger hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && !loading && (<tr><td colSpan={4} className="px-4 py-5 text-center text-body">No templates found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">Add Narration Template</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-2 block">Voucher Type</label>
                <select value={formData.voucher_type} onChange={(e) => setFormData({...formData, voucher_type: e.target.value})} className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input">
                  <option value="payment">Payment</option>
                  <option value="receipt">Receipt</option>
                  <option value="journal">Journal</option>
                  <option value="contra">Contra</option>
                  <option value="sales">Sales</option>
                  <option value="purchase">Purchase</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Template Name *</label>
                <input type="text" value={formData.template_name} onChange={(e) => setFormData({...formData, template_name: e.target.value})} required placeholder="e.g., Office Rent Payment" className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="mb-4">
                <label className="mb-2 block">Template Text *</label>
                <textarea value={formData.template_text} onChange={(e) => setFormData({...formData, template_text: e.target.value})} required rows={3} placeholder="e.g., Paid to {party} towards rent for {date}" className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input" />
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded border border-stroke px-6 py-2">Cancel</button>
                <button type="submit" className="rounded bg-primary px-6 py-2 font-medium text-gray">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

