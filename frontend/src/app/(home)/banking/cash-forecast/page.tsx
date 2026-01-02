"use client";

import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface ForecastEntry {
  date: string;
  type: string;
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export default function CashForecastPage() {
  const { company } = useAuth();
  const [forecast, setForecast] = useState<any>(null);
  const [weeklySummary, setWeeklySummary] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchForecast();
      fetchWeeklySummary();
    }
  }, [company, days]);

  const fetchForecast = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/cash-forecast?days=${days}`
      );
      setForecast(response.data);
    } catch (error) {
      console.error("Error fetching forecast:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklySummary = async () => {
    try {
      const response = await api.get(
        `/companies/${company?.id}/cash-forecast/weekly?weeks=4`
      );
      setWeeklySummary(response.data);
    } catch (error) {
      console.error("Error fetching weekly summary:", error);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Cash Flow Forecast" />

      {/* Summary Cards */}
      {forecast && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Current Cash Balance</p>
            <p className="text-xl font-bold text-black dark:text-white">
              ₹{(forecast.current_balance || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Expected Inflows</p>
            <p className="text-xl font-bold text-success">
              +₹{(forecast.total_inflows || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Expected Outflows</p>
            <p className="text-xl font-bold text-danger">
              -₹{(forecast.total_outflows || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-body">Projected Balance ({days} days)</p>
            <p className="text-xl font-bold text-primary">
              ₹{(forecast.projected_balance || 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Forecast Period Selector */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setDays(7)}
          className={`px-4 py-2 rounded ${days === 7 ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          7 Days
        </button>
        <button
          onClick={() => setDays(30)}
          className={`px-4 py-2 rounded ${days === 30 ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          30 Days
        </button>
        <button
          onClick={() => setDays(60)}
          className={`px-4 py-2 rounded ${days === 60 ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          60 Days
        </button>
        <button
          onClick={() => setDays(90)}
          className={`px-4 py-2 rounded ${days === 90 ? "bg-primary text-white" : "bg-gray-2 dark:bg-meta-4"}`}
        >
          90 Days
        </button>
      </div>

      {/* Weekly Summary */}
      {weeklySummary.length > 0 && (
        <div className="mb-6 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">Weekly Summary</h3>
          </div>
          <div className="p-6.5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {weeklySummary.map((week, index) => (
                <div key={index} className="rounded border border-stroke p-4 dark:border-strokedark">
                  <p className="text-sm text-body">Week {index + 1}</p>
                  <p className="text-xs text-body">{week.week_start} - {week.week_end}</p>
                  <div className="mt-2">
                    <p className="text-success">+₹{(week.inflows || 0).toLocaleString()}</p>
                    <p className="text-danger">-₹{(week.outflows || 0).toLocaleString()}</p>
                    <p className="font-bold">Net: ₹{(week.net || 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Forecast */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <h3 className="font-medium text-black dark:text-white">Forecast Details</h3>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Type</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white">Description</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Inflow</th>
                <th className="px-4 py-4 font-medium text-black dark:text-white text-right">Outflow</th>
              </tr>
            </thead>
            <tbody>
              {forecast?.entries?.map((entry: ForecastEntry, index: number) => (
                <tr key={index}>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {entry.type}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                    {entry.description}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-success">
                    {entry.inflow > 0 ? `₹${entry.inflow.toLocaleString()}` : "-"}
                  </td>
                  <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark text-right text-danger">
                    {entry.outflow > 0 ? `₹${entry.outflow.toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
              {(!forecast?.entries || forecast.entries.length === 0) && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-center text-body">
                    No forecast data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

