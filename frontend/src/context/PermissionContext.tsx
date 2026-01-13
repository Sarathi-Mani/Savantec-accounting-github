"use client";

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface PermissionContextType {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  userPermissions: string[];
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: ReactNode;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // For development/testing - use mock permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      setIsLoading(true);
      
      try {
        // FOR DEVELOPMENT: Use mock permissions
        // You can change this based on the user role
        let mockPermissions: string[] = [];
        
        if (user) {
          // Example: Different permissions based on user email or role
          if (user.email?.includes('admin')) {
            mockPermissions = ['all']; // Super admin
          } else if (user.email?.includes('manager')) {
            mockPermissions = ['dashboard_view', 'sales_view', 'customer_view', 'item_view'];
          } else {
            mockPermissions = ['dashboard_view']; // Basic user
          }
          
          // Store in localStorage for persistence
          localStorage.setItem('userPermissions', JSON.stringify(mockPermissions));
        } else {
          // Get from localStorage if exists
          const stored = localStorage.getItem('userPermissions');
          mockPermissions = stored ? JSON.parse(stored) : ['dashboard_view'];
        }
        
        setUserPermissions(mockPermissions);
        console.log('Set user permissions:', mockPermissions);
        
      } catch (error) {
        console.error('Error loading permissions:', error);
        setUserPermissions(['dashboard_view']); // Default minimum
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPermissions();
  }, [user]);

  // Check if user has specific permission
  const hasPermission = (permission: string): boolean => {
    if (userPermissions.includes('all')) return true;
    return userPermissions.includes(permission);
  };

  // Check if user has any of the given permissions
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (userPermissions.includes('all')) return true;
    return permissions.some(permission => userPermissions.includes(permission));
  };

  // Check if user has all of the given permissions
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (userPermissions.includes('all')) return true;
    return permissions.every(permission => userPermissions.includes(permission));
  };

  const value = {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    userPermissions,
    isLoading,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};