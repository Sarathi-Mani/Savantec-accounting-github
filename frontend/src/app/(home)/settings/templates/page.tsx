"use client";

import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";

const templates = [
  { id: 1, name: "Classic Invoice", type: "invoice", preview: "📄" },
  { id: 2, name: "Modern Invoice", type: "invoice", preview: "📋" },
  { id: 3, name: "Professional Invoice", type: "invoice", preview: "📑" },
  { id: 4, name: "Simple Receipt", type: "receipt", preview: "🧾" },
  { id: 5, name: "Detailed Receipt", type: "receipt", preview: "📝" },
];

export default function TemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [filter, setFilter] = useState("all");

  const filteredTemplates = filter === "all" ? templates : templates.filter(t => t.type === filter);

  return (
    <>
      <Breadcrumb pageName="Print Templates" />

      <div className="mb-4 flex gap-2">
        {["all", "invoice", "receipt"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded capitalize ${filter === f ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}>{f}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(template.id)}
            className={`cursor-pointer rounded-sm border p-6 shadow-default transition-all hover:shadow-lg dark:border-strokedark dark:bg-boxdark ${
              selectedTemplate === template.id ? "border-primary bg-primary bg-opacity-5" : "border-stroke bg-white"
            }`}
          >
            <div className="text-6xl text-center mb-4">{template.preview}</div>
            <h4 className="text-center font-medium text-black dark:text-white">{template.name}</h4>
            <p className="text-center text-sm text-body capitalize">{template.type}</p>
            {selectedTemplate === template.id && (
              <div className="mt-4 text-center">
                <span className="inline-flex rounded bg-primary px-3 py-1 text-sm text-white">Selected</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button className="rounded bg-primary px-6 py-2 font-medium text-gray hover:bg-opacity-90">
          Save Preference
        </button>
      </div>
    </>
  );
}
