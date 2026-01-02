"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface Ratio {
  name: string;
  value: number;
  formula: string;
  benchmark: string;
  status: string;
}

interface RatioCategory {
  category: string;
  ratios: Ratio[];
}

export default function RatioAnalysisPage() {
  const { company } = useAuth();
  const [ratioData, setRatioData] = useState<RatioCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) { fetchRatios(); }
  }, [company]);

  const fetchRatios = async () => {
    try {
      const response = await api.get(`/companies/${company?.id}/reports/ratios`);
      setRatioData(response.data.categories || []);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good": return "text-success";
      case "average": return "text-warning";
      case "poor": return "text-danger";
      default: return "text-body";
    }
  };

  return (
    <>
      <Breadcrumb pageName="Ratio Analysis" />

      {ratioData.map((category) => (
        <div key={category.category} className="mb-6">
          <h3 className="mb-4 text-lg font-bold text-black dark:text-white">{category.category}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {category.ratios.map((ratio) => (
              <div key={ratio.name} className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-black dark:text-white">{ratio.name}</h4>
                  <span className={`text-2xl font-bold ${getStatusColor(ratio.status)}`}>
                    {ratio.value.toFixed(2)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-body">{ratio.formula}</p>
                <p className="mt-1 text-xs text-body">Benchmark: {ratio.benchmark}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {ratioData.length === 0 && !loading && (
        <div className="text-center py-10 text-body">
          Unable to calculate ratios. Ensure you have sufficient financial data.
        </div>
      )}
    </>
  );
}

