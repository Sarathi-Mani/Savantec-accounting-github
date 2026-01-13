"use client";

import { ReactNode } from 'react';
import { usePermission } from '@/context/PermissionContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredAny?: string[];
  requiredAll?: string[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export default function PermissionGuard({
  children,
  requiredPermission,
  requiredAny,
  requiredAll,
  fallback = null,
  redirectTo = '/unauthorized',
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission();
  const router = useRouter();

  let hasAccess = true;

  if (requiredPermission) {
    hasAccess = hasPermission(requiredPermission);
  } else if (requiredAny && requiredAny.length > 0) {
    hasAccess = hasAnyPermission(requiredAny);
  } else if (requiredAll && requiredAll.length > 0) {
    hasAccess = hasAllPermissions(requiredAll);
  }

  useEffect(() => {
    if (!hasAccess && redirectTo) {
      router.push(redirectTo);
    }
  }, [hasAccess, redirectTo, router]);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}