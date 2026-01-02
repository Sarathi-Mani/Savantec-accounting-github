"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { productsApi, inventoryApi } from "@/services/api";
import api from "@/services/api";
import type { Product, Godown } from "@/services/api";

interface BOM {
  id: string;
  name: string;
  finished_item_id: string;
}

export default function NewProductionOrderPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);

  const [formData, setFormData] = useState({
    finished_product_id: "",
    bom_id: "",
    planned_quantity: 1,
    order_date: new Date().toISOString().split("T")[0],
    planned_start_date: "",
    planned_end_date: "",
    production_godown_id: "",
    finished_goods_godown_id: "",
    notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!company?.id) return;
      try {
        setLoading(true);
        const [productsData, godownsData] = await Promise.all([
          productsApi.list(company.id, { page_size: 100 }),
          inventoryApi.listGodowns(company.id),
        ]);
        setProducts(productsData.products || []);
        setGodowns(godownsData || []);

        // Fetch BOMs
        try {
          const bomsResponse = await api.get(`/companies/${company.id}/inventory/bom`);
          setBoms(bomsResponse.data || []);
        } catch (error) {
          console.error("Error fetching BOMs:", error);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [company?.id]);

  useEffect(() => {
    // Auto-select BOM when product is selected
    if (formData.finished_product_id && boms.length > 0) {
      const matchingBom = boms.find(bom => bom.finished_item_id === formData.finished_product_id);
      if (matchingBom) {
        setFormData({ ...formData, bom_id: matchingBom.id });
      }
    }
  }, [formData.finished_product_id, boms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.finished_product_id || !formData.planned_quantity) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        finished_product_id: formData.finished_product_id,
        planned_quantity: formData.planned_quantity,
      };

      if (formData.bom_id) payload.bom_id = formData.bom_id;
      if (formData.order_date) payload.order_date = new Date(formData.order_date).toISOString();
      if (formData.planned_start_date) payload.planned_start_date = new Date(formData.planned_start_date).toISOString();
      if (formData.planned_end_date) payload.planned_end_date = new Date(formData.planned_end_date).toISOString();
      if (formData.production_godown_id) payload.production_godown_id = formData.production_godown_id;
      if (formData.finished_goods_godown_id) payload.finished_goods_godown_id = formData.finished_goods_godown_id;
      if (formData.notes) payload.notes = formData.notes;

      await api.post(`/companies/${company.id}/manufacturing-orders`, payload);
      router.push("/inventory/manufacturing");
    } catch (error: any) {
      console.error("Error creating production order:", error);
      alert(error.response?.data?.detail || "Failed to create production order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-body">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Create Production Order" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <h3 className="text-xl font-semibold mb-4">Production Order Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Finished Product *</label>
              <select
                required
                value={formData.finished_product_id}
                onChange={(e) => setFormData({ ...formData, finished_product_id: e.target.value, bom_id: "" })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">BOM (Bill of Materials)</label>
              <select
                value={formData.bom_id}
                onChange={(e) => setFormData({ ...formData, bom_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                disabled={!formData.finished_product_id}
              >
                <option value="">Select BOM (Optional)</option>
                {boms
                  .filter(bom => !formData.finished_product_id || bom.finished_item_id === formData.finished_product_id)
                  .map((bom) => (
                    <option key={bom.id} value={bom.id}>
                      {bom.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Planned Quantity *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.planned_quantity}
                onChange={(e) => setFormData({ ...formData, planned_quantity: parseFloat(e.target.value) || 0 })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Order Date *</label>
              <input
                type="date"
                required
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Planned Start Date</label>
              <input
                type="date"
                value={formData.planned_start_date}
                onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Planned End Date</label>
              <input
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Production Godown</label>
              <select
                value={formData.production_godown_id}
                onChange={(e) => setFormData({ ...formData, production_godown_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">Select Godown</option>
                {godowns.map((godown) => (
                  <option key={godown.id} value={godown.id}>
                    {godown.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Finished Goods Godown</label>
              <select
                value={formData.finished_goods_godown_id}
                onChange={(e) => setFormData({ ...formData, finished_goods_godown_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">Select Godown</option>
                {godowns.map((godown) => (
                  <option key={godown.id} value={godown.id}>
                    {godown.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link
            href="/inventory/manufacturing"
            className="px-6 py-2 border border-stroke rounded hover:bg-gray-2 dark:hover:bg-meta-4"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Production Order"}
          </button>
        </div>
      </form>
    </>
  );
}

