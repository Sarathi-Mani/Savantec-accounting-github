"use client";
import { EmailIcon, PasswordIcon } from "@/assets/icons";
import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import InputGroup from "../FormElements/InputGroup";
import { Checkbox } from "../FormElements/checkbox";

export default function SignupWithPassword() {
  const { register } = useAuth();
  const [data, setData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    agree_terms: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!data.full_name.trim()) {
      setError("Please enter your full name");
      setLoading(false);
      return;
    }

    if (data.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    if (data.password !== data.confirm_password) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!data.agree_terms) {
      setError("Please agree to the terms and conditions");
      setLoading(false);
      return;
    }

    try {
      await register({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone || undefined,
      });
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || "Registration failed";
      setError(typeof message === "string" ? message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <InputGroup
        type="text"
        label="Full Name"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your full name"
        name="full_name"
        handleChange={handleChange}
        value={data.full_name}
        icon={
          <svg className="fill-current" width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11 2.75C8.65279 2.75 6.75 4.65279 6.75 7C6.75 9.34721 8.65279 11.25 11 11.25C13.3472 11.25 15.25 9.34721 15.25 7C15.25 4.65279 13.3472 2.75 11 2.75ZM8.25 7C8.25 5.48122 9.48122 4.25 11 4.25C12.5188 4.25 13.75 5.48122 13.75 7C13.75 8.51878 12.5188 9.75 11 9.75C9.48122 9.75 8.25 8.51878 8.25 7Z"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11 12.75C8.10051 12.75 5.62436 13.5077 3.94285 14.5713C2.27395 15.6267 1.25 17.0589 1.25 18.6667C1.25 19.0809 1.58579 19.4167 2 19.4167H20C20.4142 19.4167 20.75 19.0809 20.75 18.6667C20.75 17.0589 19.7261 15.6267 18.0572 14.5713C16.3756 13.5077 13.8995 12.75 11 12.75ZM2.83331 17.9167C3.12513 17.1522 3.77594 16.3662 4.86921 15.6745C6.12278 14.8813 7.93721 14.25 11 14.25C14.0628 14.25 15.8772 14.8813 17.1308 15.6745C18.2241 16.3662 18.8749 17.1522 19.1667 17.9167H2.83331Z"
            />
          </svg>
        }
      />

      <InputGroup
        type="email"
        label="Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your email"
        name="email"
        handleChange={handleChange}
        value={data.email}
        icon={<EmailIcon />}
      />

      <InputGroup
        type="tel"
        label="Phone (Optional)"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your phone number"
        name="phone"
        handleChange={handleChange}
        value={data.phone}
        icon={
          <svg className="fill-current" width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M6.54883 2.06641C5.88525 1.40283 4.81484 1.40283 4.15127 2.06641L2.68359 3.53409C1.94873 4.26894 1.75635 5.37793 2.19971 6.31182C4.18115 10.4852 7.03809 14.1187 10.5308 17.0674C12.2861 18.4889 14.5815 19.0671 16.7349 18.6464L18.6851 18.2657C19.5454 18.0975 20.1875 17.3486 20.1875 16.4722V14.3125C20.1875 13.2773 19.3447 12.4277 18.3105 12.418L16.2656 12.3975C15.5112 12.3899 14.7905 12.6895 14.2693 13.2246L13.7578 13.75C12.4063 13.3125 11.125 12.5312 9.96875 11.375C8.8125 10.2187 8.03125 8.9375 7.59375 7.58594L8.11938 7.07422C8.6543 6.55318 8.95397 5.83286 8.94639 5.07871L8.92578 3.03125C8.91622 1.99756 8.06689 1.15479 7.0332 1.14502L6.71484 1.14209C6.65869 1.14307 6.60303 1.15234 6.54883 2.06641ZM5.2124 3.12793C5.35986 2.98047 5.58301 2.98047 5.73047 3.12793L5.73413 3.13159C5.89478 3.29224 5.9834 3.50977 5.98608 3.73779L6.00635 5.78271C6.00879 6.0127 5.91113 6.23389 5.7373 6.39893L5.03516 7.08301C4.73486 7.375 4.61426 7.80127 4.72266 8.20117C5.24365 10.1357 6.32227 12.0303 7.96875 13.6768C9.61523 15.3232 11.5098 16.4019 13.4443 16.9229C13.8442 17.0312 14.2705 16.9106 14.5625 16.6104L15.2466 15.8984C15.4117 15.7246 15.6328 15.627 15.8628 15.6294L17.9077 15.6497C18.1357 15.6524 18.3533 15.7412 18.5139 15.9019C18.6875 16.0752 18.7354 16.2871 18.7354 16.4722V18.6319L16.7852 19.0126C15.1177 19.3379 13.333 18.9043 11.9458 17.8018C8.6499 15.0142 5.96094 11.5801 4.0957 7.64062C3.93945 7.30957 4.00391 6.91699 4.26562 6.65234L5.2124 3.12793Z"
            />
          </svg>
        }
      />

      <InputGroup
        type="password"
        label="Password"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Create a password (min 6 characters)"
        name="password"
        handleChange={handleChange}
        value={data.password}
        icon={<PasswordIcon />}
      />

      <InputGroup
        type="password"
        label="Confirm Password"
        className="mb-5 [&_input]:py-[15px]"
        placeholder="Confirm your password"
        name="confirm_password"
        handleChange={handleChange}
        value={data.confirm_password}
        icon={<PasswordIcon />}
      />

      <div className="mb-6 py-2">
        <Checkbox
          label={
            <span>
              I agree to the{" "}
              <a href="#" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </span>
          }
          name="agree_terms"
          withIcon="check"
          minimal
          radius="md"
          onChange={(e) =>
            setData({
              ...data,
              agree_terms: e.target.checked,
            })
          }
        />
      </div>

      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading || !data.email || !data.password || !data.full_name}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Create Account
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
