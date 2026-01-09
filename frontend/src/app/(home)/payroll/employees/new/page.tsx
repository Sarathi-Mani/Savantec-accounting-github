"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, User, Briefcase, CreditCard, Shield, Users, Home, Camera, Mail, Phone, MapPin } from "lucide-react";
import { payrollApi, Department, Designation, getErrorMessage } from "@/services/api";
import Select from 'react-select';
// import { SingleValue } from "react-select";
import makeAnimated from 'react-select/animated';

type SelectOption = {
  value: string;
  label: string;
};

interface Props {
  label: string;
  name: string;
  value: string | number;
  onChange: (name: string, value: any) => void;
  options: SelectOption[];
  required?: boolean;
  placeholder?: string;
}


const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: "42px",
    borderRadius: "0.5rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: state.isFocused ? "#6366f1" : "#d1d5db",
    boxShadow: state.isFocused
      ? "0 0 0 2px rgba(99,102,241,0.4)"
      : "none",
    backgroundColor: "transparent",
    "&:hover": {
      borderColor: "0 0 0 2px rgba(99,102,241,0.4)",
    },
  }),

  valueContainer: (base: any) => ({
    ...base,
    padding: "0 12px",
  }),

  input: (base: any) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),

  indicatorsContainer: (base: any) => ({
    ...base,
    height: "42px",
  }),

  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#6366f1"
      : state.isFocused
        ? "#eef2ff"
        : "white",
    color: state.isSelected ? "white" : "#111827",
  }),

  menu: (base: any) => ({
    ...base,
    zIndex: 50,
  }),
};

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  placeholder = "Select option",
}: Props) {
  return (
    <div>
      <Select
        name={name}
        value={options.find(o => o.value === value) || null}
        onChange={(selected) => onChange(name, selected?.value || "")}
        options={options}
        placeholder={placeholder}
        isClearable
        styles={selectStyles}
        classNamePrefix="react-select"
      />
    </div>
  );
}


export default function NewEmployeePage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("personal");

  const animatedComponents = makeAnimated();



  const calculateCTC = (data: typeof formData) => {
    const monthlyBasic = parseFloat(data.monthly_basic) || 0;
    const monthlyHra = parseFloat(data.monthly_hra) || 0;
    const monthlySpecialAllowance = parseFloat(data.monthly_special_allowance) || 0;
    const monthlyConveyance = parseFloat(data.monthly_conveyance) || 0;
    const monthlyMedical = parseFloat(data.monthly_medical) || 0;

    const monthlyTotal = monthlyBasic + monthlyHra + monthlySpecialAllowance + monthlyConveyance + monthlyMedical;
    const annualCTC = monthlyTotal * 12;

    return annualCTC.toString();
  };

  const [formData, setFormData] = useState({
    // Personal (existing)
    
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    blood_group: "",
    // NEW: Staff photo
    photo_url: "",
    marital_status: "",

    email: "",
    phone: "",

    // Family Details (NEW)
    father_name: "",
    mother_name: "",
    spouse_name: "",
    spouse_occupation: "",
    children_count: 0,
    children_details: "",
    emergency_contact_name: "",
    emergency_contact_relation: "",
    emergency_contact_phone: "",

    // Contact Details (NEW)
    personal_email: "",
    official_email: "",
    personal_phone: "",
    official_phone: "",
    alternate_phone: "",

    // Address (NEW)
    permanent_address: "",
    current_address: "",
    current_city: "",
    same_as_permanent: false,

    // Employment (existing + new)
    department_id: "",
    designation_id: "",
    employee_type: "permanent",
    date_of_joining: new Date().toISOString().split("T")[0],
    work_state: "",

    // CTC & Salary (NEW)
    ctc: "",
    monthly_basic: "",
    monthly_hra: "",
    monthly_special_allowance: "",
    monthly_conveyance: "",
    monthly_medical: "",
    salary_calculation_method: "ctc_breakup", // "ctc_breakup" or "monthly_components"

    // Statutory (existing)
    pan: "",
    aadhaar: "",
    uan: "",
    pf_number: "",
    esi_number: "",
    pf_applicable: true,
    esi_applicable: true,
    pt_applicable: true,
    tax_regime: "new",

    // Bank (existing + new)
    bank_name: "",
    bank_branch: "", // NEW
    bank_account_number: "",
    bank_ifsc: "",
    account_holder_name: "", // NEW
  });

  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id");
    if (!storedCompanyId) {
      router.push("/company");
      return;
    }
    setCompanyId(storedCompanyId);
    loadData(storedCompanyId);
  }, [router]);

  const loadData = async (companyId: string) => {
    try {
      const [deptList, desgList] = await Promise.all([
        payrollApi.listDepartments(companyId),
        payrollApi.listDesignations(companyId),
      ]);
      setDepartments(deptList);
      setDesignations(desgList);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!companyId) return;

  try {
    setLoading(true);
    setError(null);

    // Create a new object WITHOUT employee_code
    const { employee_code, ...dataToSend } = formData;

    const data = {
      ...dataToSend,
      ctc: dataToSend.ctc ? parseFloat(dataToSend.ctc) : undefined,
      monthly_basic: dataToSend.monthly_basic ? parseFloat(dataToSend.monthly_basic) : undefined,
      monthly_hra: dataToSend.monthly_hra ? parseFloat(dataToSend.monthly_hra) : undefined,
      monthly_special_allowance: dataToSend.monthly_special_allowance ? parseFloat(dataToSend.monthly_special_allowance) : undefined,
      monthly_conveyance: dataToSend.monthly_conveyance ? parseFloat(dataToSend.monthly_conveyance) : undefined,
      monthly_medical: dataToSend.monthly_medical ? parseFloat(dataToSend.monthly_medical) : undefined,
      children_count: parseInt(dataToSend.children_count.toString()),
      department_id: dataToSend.department_id || undefined,
      designation_id: dataToSend.designation_id || undefined,
    };

    await payrollApi.createEmployee(companyId, data);
    router.push("/payroll/employees");
  } catch (err: any) {
    setError(getErrorMessage(err, "Failed to create employee"));
  } finally {
    setLoading(false);
  }
};

  const tabs = [
    { id: "personal", label: "Personal Details", icon: User },
    { id: "family", label: "Family Details", icon: Users },
    { id: "contact", label: "Contact Details", icon: Phone },
    { id: "employment", label: "Employment", icon: Briefcase },
    { id: "statutory", label: "Statutory", icon: Shield },
    { id: "bank", label: "Bank Details", icon: CreditCard },
  ];

  const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu & Kashmir", "Ladakh"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/payroll/employees"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Employee</h1>
          <p className="text-gray-600 dark:text-gray-400">Enter employee details to add to payroll</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Personal Details */}
            {activeTab === "personal" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    value="Will be auto-generated"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-generated after saving</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gender
                  </label>
                  <SelectField
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={(name, value) =>
                      setFormData((prev) => ({ ...prev, [name]: value }))
                    }
                    options={[
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                      { value: "other", label: "Other" },
                    ]}
                    placeholder="Select Gender"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Marital Status
                  </label>
                  <SelectField
                    label="Marital Status"
                    name="marital_status"
                    value={formData.marital_status}
                    onChange={(name, value) =>
                      setFormData((prev) => ({ ...prev, [name]: value }))
                    }
                    options={[
                      { value: "single", label: "Single" },
                      { value: "married", label: "Married" },
                    ]}
                    placeholder="Select Status"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Blood Group
                  </label>
                  <SelectField
                    label="Blood Group"
                    name="blood_group"
                    value={formData.blood_group}
                    onChange={(name, value) =>
                      setFormData((prev) => ({ ...prev, [name]: value }))
                    }
                    options={[
                      { value: "A+", label: "A+" },
                      { value: "A-", label: "A-" },
                      { value: "B+", label: "B+" },
                      { value: "B-", label: "B-" },
                      { value: "O+", label: "O+" },
                      { value: "O-", label: "O-" },
                      { value: "AB+", label: "AB+" },
                      { value: "AB-", label: "AB-" },
                    ]}
                    placeholder="Select Blood Group"
                  />
                </div>

                {/* Staff Photo Upload */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Staff Photo
                  </label>
                  <div className="flex items-center gap-6">
                    {formData.photo_url ? (
                      <div className="relative">
                        <img
                          src={formData.photo_url}
                          alt="Staff"
                          className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, photo_url: "" }))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <span className="text-xs">×</span>
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                        <Camera className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Here you would upload to your server and get URL
                            // For now, create a local URL for preview
                            const url = URL.createObjectURL(file);
                            setFormData(prev => ({ ...prev, photo_url: url }));
                          }
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Upload passport size photo (Max 2MB, JPG/PNG)
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>


                <div className="md:col-span-2">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Address Details</h3>

                    {/* Permanent Address */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Permanent Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="permanent_address"
                        value={formData.permanent_address}
                        onChange={handleChange}
                        required
                        rows={3}
                        placeholder="House No., Street, City, State, Pincode"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>

                    {/* Checkbox and Current Address */}
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="same_as_permanent"
                        name="same_as_permanent"
                        checked={formData.same_as_permanent}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            same_as_permanent: checked,
                            ...(checked ? {
                              current_address: prev.permanent_address,
                            } : {})
                          }));
                        }}
                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <label htmlFor="same_as_permanent" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Current address same as permanent address
                      </label>
                    </div>

                    {/* Current Address - only show if checkbox is not checked */}
                    {!formData.same_as_permanent && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Current Address <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="current_address"
                          value={formData.current_address}
                          onChange={handleChange}
                          required={!formData.same_as_permanent}
                          rows={3}
                          placeholder="House No., Street, City, State, Pincode"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    name="pan"
                    value={formData.pan}
                    onChange={handleChange}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Aadhaar Number
                  </label>
                  <input
                    type="text"
                    name="aadhaar"
                    value={formData.aadhaar}
                    onChange={handleChange}
                    placeholder="1234 5678 9012"
                    maxLength={12}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>


              </div>
            )}

            {/* Family Details Tab */}
            {activeTab === "family" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Father's Name
                    </label>
                    <input
                      type="text"
                      name="father_name"
                      value={formData.father_name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mother's Name
                    </label>
                    <input
                      type="text"
                      name="mother_name"
                      value={formData.mother_name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                </div>

                {/* Spouse Details section - Add condition here */}
                {formData.marital_status === "married" && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                      Spouse Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Spouse Name
                        </label>
                        <input
                          type="text"
                          name="spouse_name"
                          value={formData.spouse_name}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Spouse Occupation
                        </label>
                        <input
                          type="text"
                          name="spouse_occupation"
                          value={formData.spouse_occupation}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Number of Children
                    </label>
                    <input
                      type="number"
                      name="children_count"
                      value={formData.children_count}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Contact Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Relation <span className="text-red-500">*</span>
                      </label>
                      <SelectField
                        label="Relation"
                        name="emergency_contact_relation"
                        value={formData.emergency_contact_relation}
                        required
                        onChange={(name, value) =>
                          setFormData(prev => ({ ...prev, [name]: value }))
                        }
                        options={[
                          { value: "father", label: "Father" },
                          { value: "mother", label: "Mother" },
                          { value: "spouse", label: "Spouse" },
                          { value: "sibling", label: "Sibling" },
                          { value: "friend", label: "Friend" },
                          { value: "other", label: "Other" },
                        ]}
                      />

                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="emergency_contact_phone"
                        value={formData.emergency_contact_phone}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Details Tab */}
            {activeTab === "contact" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Personal Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="personal_email"
                        value={formData.personal_email}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Official Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="official_email"
                        value={formData.official_email}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Personal Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        name="personal_phone"
                        value={formData.personal_phone}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Official Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        name="official_phone"
                        value={formData.official_phone}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Alternate Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        name="alternate_phone"
                        value={formData.alternate_phone}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                      />
                    </div>
                  </div>
                </div>


              </div>
            )}

            {/* Employment Details Tab */}
            {activeTab === "employment" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Existing fields remain same */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Department
                    </label>
                    <SelectField
                      label="Department"
                      name="department_id"
                      value={formData.department_id}
                      onChange={(name, value) =>
                        setFormData((prev) => ({ ...prev, [name]: value }))
                      }
                      options={departments.map((dept) => ({
                        value: dept.id,
                        label: dept.name,
                      }))}
                      placeholder="Select Department"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Designation
                    </label>
                    <SelectField
                      label="Designation"
                      name="designation_id"
                      value={formData.designation_id}
                      onChange={(name, value) =>
                        setFormData((prev) => ({ ...prev, [name]: value }))
                      }
                      options={designations.map((desg) => ({
                        value: desg.id,
                        label: desg.name,
                      }))}
                      placeholder="Select Designation"
                    />
                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Employee Type
                    </label>
                    <SelectField
                      label="Employee Type"
                      name="employee_type"
                      value={formData.employee_type}
                      onChange={(name, value) =>
                        setFormData((prev) => ({ ...prev, [name]: value }))
                      }
                      options={[
                        { value: "permanent", label: "Permanent" },
                        { value: "contract", label: "Contract" },
                        { value: "probation", label: "Probation" },
                        { value: "intern", label: "Intern" },
                        { value: "consultant", label: "Consultant" },
                      ]}
                      placeholder="Select Employee Type"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date of Joining <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="date_of_joining"
                      value={formData.date_of_joining}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                </div>

                {/* CTC & Salary Calculation Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Salary Structure
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        CTC (Annual) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          type="number"
                          name="ctc"
                          value={formData.ctc}
                          onChange={(e) => {
                            const ctcValue = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              ctc: ctcValue,
                              // Only auto-calculate monthly components if using CTC breakup method
                              ...(formData.salary_calculation_method === "ctc_breakup" && ctcValue && {
                                monthly_basic: Math.round(parseFloat(ctcValue) * 0.4 / 12).toString(),
                                monthly_hra: Math.round(parseFloat(ctcValue) * 0.2 / 12).toString(),
                                monthly_special_allowance: Math.round(parseFloat(ctcValue) * 0.3 / 12).toString(),
                                monthly_conveyance: "1600",
                                monthly_medical: "1250"
                              })
                            }));
                          }}
                          required
                          placeholder="600000"
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.salary_calculation_method === "ctc_breakup"
                          ? "Cost to Company per annum"
                          : "Auto-calculated from monthly components"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Salary Calculation Method
                      </label>
                      <SelectField
                        label="Salary Calculation Method"
                        name="salary_calculation_method"
                        value={formData.salary_calculation_method}
                        onChange={(name, value) =>
                          setFormData((prev) => ({ ...prev, [name]: value }))
                        }
                        options={[
                          { value: "ctc_breakup", label: "Calculate from CTC" },
                          { value: "monthly_components", label: "Enter Monthly Components" },
                        ]}
                        placeholder="Select Method"
                      />
                    </div>
                  </div>

                  {/* Monthly Components Breakdown */}
                  {formData.salary_calculation_method === "ctc_breakup" && formData.ctc && (
                    <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Monthly Salary Breakdown (Auto-calculated)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Basic (40%)</p>
                          <p className="font-medium">₹{formData.monthly_basic || "0"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">HRA (20%)</p>
                          <p className="font-medium">₹{formData.monthly_hra || "0"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Special Allowance (30%)</p>
                          <p className="font-medium">₹{formData.monthly_special_allowance || "0"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Conveyance</p>
                          <p className="font-medium">₹{formData.monthly_conveyance || "1600"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Medical</p>
                          <p className="font-medium">₹{formData.monthly_medical || "1250"}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm">
                          <span className="text-gray-500">Total Monthly: </span>
                          <span className="font-medium">
                            ₹{(parseFloat(formData.monthly_basic || "0") +
                              parseFloat(formData.monthly_hra || "0") +
                              parseFloat(formData.monthly_special_allowance || "0") +
                              parseFloat(formData.monthly_conveyance || "0") +
                              parseFloat(formData.monthly_medical || "0")).toLocaleString('en-IN')}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {formData.salary_calculation_method === "monthly_components" && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Basic Salary
                        </label>
                        <input
                          type="number"
                          name="monthly_basic"
                          value={formData.monthly_basic}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              monthly_basic: value,
                              // Calculate CTC when monthly components change
                              ctc: calculateCTC({
                                ...formData,
                                monthly_basic: value
                              })
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          HRA
                        </label>
                        <input
                          type="number"
                          name="monthly_hra"
                          value={formData.monthly_hra}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              monthly_hra: value,
                              ctc: calculateCTC({
                                ...formData,
                                monthly_hra: value
                              })
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Special Allowance
                        </label>
                        <input
                          type="number"
                          name="monthly_special_allowance"
                          value={formData.monthly_special_allowance}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              monthly_special_allowance: value,
                              ctc: calculateCTC({
                                ...formData,
                                monthly_special_allowance: value
                              })
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Conveyance
                        </label>
                        <input
                          type="number"
                          name="monthly_conveyance"
                          value={formData.monthly_conveyance}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              monthly_conveyance: value,
                              ctc: calculateCTC({
                                ...formData,
                                monthly_conveyance: value
                              })
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Medical Allowance
                        </label>
                        <input
                          type="number"
                          name="monthly_medical"
                          value={formData.monthly_medical}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              monthly_medical: value,
                              ctc: calculateCTC({
                                ...formData,
                                monthly_medical: value
                              })
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Statutory Details */}
            {activeTab === "statutory" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      UAN (Universal Account Number)
                    </label>
                    <input
                      type="text"
                      name="uan"
                      value={formData.uan}
                      onChange={handleChange}
                      placeholder="100000000001"
                      maxLength={12}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      PF Account Number
                    </label>
                    <input
                      type="text"
                      name="pf_number"
                      value={formData.pf_number}
                      onChange={handleChange}
                      placeholder="XXAAA0000000000001"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ESI Number
                    </label>
                    <input
                      type="text"
                      name="esi_number"
                      value={formData.esi_number}
                      onChange={handleChange}
                      placeholder="1234567890123456"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                    Statutory Applicability
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <input
                        type="checkbox"
                        name="pf_applicable"
                        checked={formData.pf_applicable}
                        onChange={handleChange}
                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">PF Applicable</p>
                        <p className="text-xs text-gray-500">12% Employee + Employer</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <input
                        type="checkbox"
                        name="esi_applicable"
                        checked={formData.esi_applicable}
                        onChange={handleChange}
                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">ESI Applicable</p>
                        <p className="text-xs text-gray-500">If gross ≤ ₹21,000</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Bank Details Tab */}
            {activeTab === "bank" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleChange}
                      required
                      placeholder="State Bank of India"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bank Branch <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="bank_branch"
                      value={formData.bank_branch}
                      onChange={handleChange}
                      required
                      placeholder="Main Branch, Chennai"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="account_holder_name"
                      value={formData.account_holder_name}
                      onChange={handleChange}
                      required
                      placeholder="As per bank records"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={handleChange}
                      required
                      placeholder="12345678901234"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bank_ifsc"
                    value={formData.bank_ifsc}
                    onChange={handleChange}
                    required
                    placeholder="SBIN0001234"
                    maxLength={11}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Ensure IFSC code is correct for successful salary transfers
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <Link
              href="/payroll/employees"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? "Saving..." : "Save Employee"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
