/**
 * Protected Route Wrappers
 * 
 * Implements route protection per ARCH_FRONTEND_FROZEN.md:
 * - 401 → redirect to /login
 * - 403 → redirect to /403
 * - workspace_required → redirect to /select-context
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRequireAuth, useRequireContext } from './hooks';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// ===============================
// LOADING FALLBACK
// ===============================

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

// ===============================
// PROTECTED ROUTE (AUTH ONLY)
// ===============================

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useRequireAuth();
  const location = useLocation();
  
  if (isLoading) {
    return <AuthLoading />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
}

// ===============================
// PROTECTED ROUTE WITH CONTEXT
// ===============================

export function ProtectedRouteWithContext({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, hasContext, session } = useRequireContext();
  const location = useLocation();
  
  if (isLoading) {
    return <AuthLoading />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (!hasContext) {
    return <Navigate to="/select-context" replace />;
  }
  
  return <>{children}</>;
}

// ===============================
// PUBLIC ROUTE (REDIRECT IF AUTH)
// ===============================

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function PublicRoute({ children, redirectTo = '/' }: PublicRouteProps) {
  const { isLoading, isAuthenticated } = useRequireAuth();
  
  if (isLoading) {
    return <AuthLoading />;
  }
  
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return <>{children}</>;
}
