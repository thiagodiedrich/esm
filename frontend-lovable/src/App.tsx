/**
 * App Router — per ARCH_FRONTEND_FROZEN.md adapted for React Router
 * 
 * Route structure:
 * - Public routes: /login
 * - Protected routes: /* (requires auth)
 * - Protected with context: /erp/*, /telemetry/* (requires context)
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Layouts
import { AppLayout, PublicLayout } from "@/templates";

// Auth guards
import { ProtectedRoute, ProtectedRouteWithContext, PublicRoute } from "@/auth";

// Pages
import LoginPage from "@/pages/Login";
import SelectContextPage from "@/pages/SelectContext";
import DashboardPage from "@/pages/Dashboard";
import ForbiddenPage from "@/pages/Forbidden";
import NotFoundPage from "@/pages/NotFound";

// Health check on startup (syncs to store for banner)
import { BackendHealthChecker } from "@/components/BackendHealthChecker";
// Regra de ouro: frontend não pode travar; Error Boundary + retentativas
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BackendHealthChecker />
    <AppErrorBoundary queryClient={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/404" element={<NotFoundPage />} />
          </Route>

          {/* Context selection (auth required, no context) */}
          <Route
            path="/select-context"
            element={
              <ProtectedRoute>
                <SelectContextPage />
              </ProtectedRoute>
            }
          />

          {/* Protected routes with context */}
          <Route
            element={
              <ProtectedRouteWithContext>
                <AppLayout />
              </ProtectedRouteWithContext>
            }
          >
            {/* / redireciona para /dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* ERP Product Routes */}
            <Route path="/erp/*" element={<DashboardPage />} />

            {/* Telemetry Product Routes */}
            <Route path="/telemetry/*" element={<DashboardPage />} />

            {/* Admin, Tenant e outras rotas do menu */}
            <Route path="/admin/*" element={<DashboardPage />} />
            <Route path="/tenant/*" element={<DashboardPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AppErrorBoundary>
  </QueryClientProvider>
);

export default App;
