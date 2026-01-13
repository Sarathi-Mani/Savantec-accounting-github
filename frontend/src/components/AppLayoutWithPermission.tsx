"use client";

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermission } from '@/context/PermissionContext';

interface AppLayoutWithPermissionProps {
  children: ReactNode;
}

// Simple permission rules defined here (no separate file needed)
const pagePermissions: Record<string, string[]> = {
  // Dashboard
  '/dashboard': ['dashboard_view'],
  
  // Inventory Pages
  '/items': ['item_view'],
  '/items/create': ['item_add'],
  '/items/[id]/edit': ['item_edit'],
  '/items/categories': ['item_category_view'],
  
  // Sales Pages
  '/customers': ['customer_view'],
  '/customers/create': ['customer_add'],
  '/sales': ['sales_view'],
  '/sales/create': ['sales_add'],
  '/sales/invoices': ['sales_view'],
  '/quotations': ['quotation_view'],
  '/quotations/create': ['quotation_add'],
  
  // Purchase Pages
  '/suppliers': ['supplier_view'],
  '/suppliers/create': ['supplier_add'],
  '/purchase': ['purchase_view'],
  '/purchase/create': ['purchase_add'],
  
  // Accounts Pages
  '/accounts': ['account_view'],
  '/accounts/create': ['account_add'],
  '/expenses': ['expense_view'],
  '/expenses/create': ['expense_add'],
  
  // Reports Pages
  '/reports': ['report_sales'],
  '/reports/sales': ['report_sales'],
  '/reports/purchase': ['report_purchase'],
  '/reports/stock': ['report_stock'],
  
  // Admin Pages
  '/users': ['user_view'],
  '/users/create': ['user_add'],
  '/roles': ['role_view'],
  '/roles/create': ['role_add'],
  
  // Designations pages
  '/designations/list': ['role_view'],
  '/designations/create': ['role_add'],
  '/designations/[id]/edit': ['role_edit'],
  
  // Company Settings
  '/settings': ['company_view'],
  '/settings/company': ['company_edit'],
  
  // Profile
  '/profile': ['dashboard_view'],
};

// Helper function to get required permissions
const getRequiredPermissions = (path: string): string[] => {
  // Skip for auth and unauthorized pages
  if (path.startsWith('/auth/') || path === '/unauthorized') {
    return [];
  }
  
  // Find exact match first
  if (pagePermissions[path]) {
    return pagePermissions[path];
  }
  
  // Check for dynamic routes
  for (const [key, permissions] of Object.entries(pagePermissions)) {
    if (key.includes('[id]')) {
      const pattern = key.replace('[id]', '[^/]+');
      if (new RegExp(`^${pattern}$`).test(path)) {
        return permissions;
      }
    }
  }
  
  // Check for nested routes
  for (const [key, permissions] of Object.entries(pagePermissions)) {
    if (path.startsWith(key + '/')) {
      return permissions;
    }
  }
  
  return []; // No permissions required
};

export default function AppLayoutWithPermission({ children }: AppLayoutWithPermissionProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasAnyPermission, userPermissions, isLoading } = usePermission();

  useEffect(() => {
    const checkPermission = async () => {
      // Skip if permissions are still loading
      if (isLoading) return;
      
      try {
        // Get required permissions for current page
        const requiredPermissions = getRequiredPermissions(pathname);
        
        console.log('Checking permissions for:', pathname);
        console.log('Required:', requiredPermissions);
        console.log('User has:', userPermissions);
        
        // If page requires permissions
        if (requiredPermissions.length > 0) {
          // Check if user has any of the required permissions
          const hasAccess = hasAnyPermission(requiredPermissions);
          
          console.log('Has access:', hasAccess);
          
          // If no access, redirect to unauthorized page
          if (!hasAccess) {
            console.log('Redirecting to unauthorized');
            router.push('/unauthorized');
          }
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    };

    checkPermission();
  }, [pathname, hasAnyPermission, router, userPermissions, isLoading]);

  // Show loading while checking permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-300">Checking permissions...</span>
      </div>
    );
  }

  return <>{children}</>;
}