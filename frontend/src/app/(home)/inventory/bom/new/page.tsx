"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { productsApi } from "@/services/api";
import api from "@/services/api";
import type { Product } from "@/services/api";

interface BOMComponent {
  item_id: string;
  quantity: number;
  unit: string;
  waste_percentage: number;
}

export default function NewBOMPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState({
    finished_item_id: "",
    name: "",
    output_quantity: 1,
    output_unit: "Nos",
    description: "",
  });

  const [components, setComponents] = useState<BOMComponent[]>([
    { item_id: "", quantity: 1, unit: "Nos", waste_percentage: 0 },
  ]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!company?.id) return;
      try {
        setLoading(true);
        const data = await productsApi.list(company.id, { page_size: 100 });
        setProducts(data.products || []);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [company?.id]);

  const addComponent = () => {
    setComponents([...components, { item_id: "", quantity: 1, unit: "Nos", waste_percentage: 0 }]);
  };

  const removeComponent = (index: number) => {
    if (components.length > 1) {
      setComponents(components.filter((_, i) => i !== index));
    }
  };

  const updateComponent = (index: number, field: keyof BOMComponent, value: any) => {
    const newComponents = [...components];
    newComponents[index] = { ...newComponents[index], [field]: value };
    
    // Auto-fill unit when product is selected
    if (field === "item_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newComponents[index].unit = product.unit || "Nos";
      }
    }
    
    setComponents(newComponents);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.finished_item_id || !formData.name) {
      alert("Please fill in all required fields");
      return;
    }

    if (components.some((comp) => !comp.item_id || comp.quantity <= 0)) {
      alert("Please fill in all component details");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        finished_item_id: formData.finished_item_id,
        name: formData.name,
        output_quantity: formData.output_quantity,
        output_unit: formData.output_unit || undefined,
        description: formData.description || undefined,
        components: components.map((comp) => ({
          item_id: comp.item_id,
          quantity: comp.quantity,
          unit: comp.unit || undefined,
          waste_percentage: comp.waste_percentage || 0,
        })),
      };

      await api.post(`/companies/${company.id}/inventory/bom`, payload);
      router.push("/inventory/bom");
    } catch (error: any) {
      console.error("Error creating BOM:", error);
      alert(error.response?.data?.detail || "Failed to create BOM");
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
      <Breadcrumb pageName="Create Bill of Materials" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <h3 className="text-xl font-semibold mb-4">BOM Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Finished Product *</label>
              <select
                required
                value={formData.finished_item_id}
                onChange={(e) => setFormData({ ...formData, finished_item_id: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              >
                <option value="">Select Finished Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">BOM Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder="e.g., Standard BOM, Version 1.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Output Quantity *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.output_quantity}
                onChange={(e) => setFormData({ ...formData, output_quantity: parseFloat(e.target.value) || 1 })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Output Unit</label>
              <input
                type="text"
                value={formData.output_unit}
                onChange={(e) => setFormData({ ...formData, output_unit: e.target.value })}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
                placeholder="e.g., Nos, Kg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded border border-stroke px-4 py-2 dark:border-strokedark dark:bg-form-input"
              />
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Components (Raw Materials)</h3>
            <button
              type="button"
              onClick={addComponent}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90"
            >
              + Add Component
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-2 dark:bg-meta-4">
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">Quantity</th>
                  <th className="px-4 py-2 text-left">Unit</th>
                  <th className="px-4 py-2 text-left">Waste %</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2">
                      <select
                        required
                        value={comp.item_id}
                        onChange={(e) => updateComponent(index, "item_id", e.target.value)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      >
                        <option value="">Select Product</option>
                        {products
                          .filter(p => p.id !== formData.finished_item_id)
                          .map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={comp.quantity}
                        onChange={(e) => updateComponent(index, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        required
                        value={comp.unit}
                        onChange={(e) => updateComponent(index, "unit", e.target.value)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={comp.waste_percentage}
                        onChange={(e) => updateComponent(index, "waste_percentage", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-stroke px-2 py-1 dark:border-strokedark dark:bg-form-input"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {components.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeComponent(index)}
                          className="text-danger hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link
            href="/inventory/bom"
            className="px-6 py-2 border border-stroke rounded hover:bg-gray-2 dark:hover:bg-meta-4"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create BOM"}
          </button>
        </div>
      </form>
    </>
  );
}

