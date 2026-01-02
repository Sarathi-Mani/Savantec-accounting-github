"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi, companiesApi, User, Company, LoginRequest, RegisterRequest } from "@/services/api";

interface AuthContextType {
  user: User | null;
  company: Company | null;
  companies: Company[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  selectCompany: (company: Company) => void;
  refreshCompanies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = pathname?.startsWith("/auth");

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("user");
        const storedCompanyId = localStorage.getItem("company_id");

        if (token && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);

          // Fetch companies
          try {
            const companiesList = await companiesApi.list();
            setCompanies(companiesList);

            // Restore selected company or select first one
            if (storedCompanyId && companiesList.length > 0) {
              const savedCompany = companiesList.find((c) => c.id === storedCompanyId);
              if (savedCompany) {
                setCompany(savedCompany);
              } else if (companiesList.length > 0) {
                setCompany(companiesList[0]);
                localStorage.setItem("company_id", companiesList[0].id);
              }
            } else if (companiesList.length > 0) {
              setCompany(companiesList[0]);
              localStorage.setItem("company_id", companiesList[0].id);
            }
          } catch (error) {
            console.error("Failed to fetch companies:", error);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        localStorage.removeItem("company_id");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublicRoute) {
      router.push("/auth/sign-in");
    } else if (user && isPublicRoute) {
      router.push("/");
    }
  }, [user, isLoading, isPublicRoute, router]);

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      
      // Store tokens and user
      localStorage.setItem("access_token", response.access_token);
      if (response.refresh_token) {
        localStorage.setItem("refresh_token", response.refresh_token);
      }
      localStorage.setItem("user", JSON.stringify(response.user));
      
      setUser(response.user);

      // Fetch companies after login
      try {
        const companiesList = await companiesApi.list();
        setCompanies(companiesList);
        
        if (companiesList.length > 0) {
          setCompany(companiesList[0]);
          localStorage.setItem("company_id", companiesList[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch companies after login:", error);
      }

      router.push("/");
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      
      // Store tokens and user
      localStorage.setItem("access_token", response.access_token);
      if (response.refresh_token) {
        localStorage.setItem("refresh_token", response.refresh_token);
      }
      localStorage.setItem("user", JSON.stringify(response.user));
      
      setUser(response.user);
      router.push("/");
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("company_id");
    setUser(null);
    setCompany(null);
    setCompanies([]);
    router.push("/auth/sign-in");
  }, [router]);

  const selectCompany = (selectedCompany: Company) => {
    setCompany(selectedCompany);
    localStorage.setItem("company_id", selectedCompany.id);
  };

  const refreshCompanies = async () => {
    try {
      const companiesList = await companiesApi.list();
      setCompanies(companiesList);
      
      // Update selected company if it was removed
      if (company && !companiesList.find((c) => c.id === company.id)) {
        if (companiesList.length > 0) {
          setCompany(companiesList[0]);
          localStorage.setItem("company_id", companiesList[0].id);
        } else {
          setCompany(null);
          localStorage.removeItem("company_id");
        }
      }
    } catch (error) {
      console.error("Failed to refresh companies:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companies,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        selectCompany,
        refreshCompanies,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
