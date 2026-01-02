"use client";

import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

const importTypes = [
  { id: "customers", name: "Customers", icon: "👥" },
  { id: "products", name: "Products", icon: "📦" },
  { id: "accounts", name: "Chart of Accounts", icon: "📊" },
  { id: "opening_balances", name: "Opening Balances", icon: "💰" },
];

export default function ImportPage() {
  const { company } = useAuth();
  const [selectedType, setSelectedType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const downloadTemplate = async (type: string) => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/import/template/${type}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading template:", error);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedType) return;
    
    setLoading(true);
    setResult(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await api.post(
        `/companies/${company?.id}/import/${selectedType}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(response.data);
    } catch (error: any) {
      setResult({ error: error.response?.data?.detail || "Import failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Import Data" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {importTypes.map((type) => (
          <div
            key={type.id}
            onClick={() => setSelectedType(type.id)}
            className={`cursor-pointer rounded-sm border p-6 shadow-default transition-all hover:shadow-lg dark:border-strokedark dark:bg-boxdark ${
              selectedType === type.id ? "border-primary bg-primary bg-opacity-5" : "border-stroke bg-white"
            }`}
          >
            <div className="text-4xl text-center mb-2">{type.icon}</div>
            <h4 className="text-center font-medium text-black dark:text-white">{type.name}</h4>
            <button
              onClick={(e) => { e.stopPropagation(); downloadTemplate(type.id); }}
              className="mt-2 w-full text-center text-sm text-primary hover:underline"
            >
              Download Template
            </button>
          </div>
        ))}
      </div>

      {selectedType && (
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h3 className="mb-4 font-medium text-black dark:text-white">
            Import {importTypes.find(t => t.id === selectedType)?.name}
          </h3>
          
          <div className="mb-4">
            <label className="mb-2 block">Select Excel File</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            />
          </div>
          
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import"}
          </button>
          
          {result && (
            <div className={`mt-4 p-4 rounded ${result.error ? "bg-danger bg-opacity-10 text-danger" : "bg-success bg-opacity-10 text-success"}`}>
              {result.error ? (
                <p>Error: {result.error}</p>
              ) : (
                <div>
                  <p>✓ Imported: {result.imported || 0}</p>
                  <p>✗ Errors: {result.errors || 0}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

