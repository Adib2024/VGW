import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { ForcedPasswordChange } from './components/ForcedPasswordChange';

const authLoadingFallback = (
  <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
    <div style={{ color: '#3b82f6', fontSize: '1.25rem', fontWeight: 'bold' }}>Loading VGM CKD...</div>
  </div>
);

const Login = lazy(() => import('./pages/Login'));
const Hub = lazy(() => import('./pages/Hub'));
const StockTakeDashboard = lazy(() => import('./pages/StockTake/Dashboard'));
const StockTakeListView = lazy(() => import('./pages/StockTake/ListView'));
const StockTakeCounting = lazy(() => import('./pages/StockTake/Counting'));
const AdminSettings = lazy(() => import('./pages/Admin/Settings'));
const AdminUsers = lazy(() => import('./pages/Admin/Users'));
const UserProgress = lazy(() => import('./pages/Reports/UserProgress'));
const BatteryTracker = lazy(() => import('./pages/Battery/Tracker'));

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();

  // Session check is async (a real Supabase Auth session, not synchronous
  // localStorage) - render nothing yet rather than flash-redirecting to
  // login before we actually know whether a session exists.
  if (loading) {
    return authLoadingFallback;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Applies regardless of which route was requested, so it can't be
  // bypassed by navigating directly to a URL other than "/".
  if (user.mustChangePassword) {
    return <ForcedPasswordChange />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as string)) {
    // If not allowed, redirect to their default home
    if (user.role === 'Admin' || user.role === 'Verifier') return <Navigate to="/hub" replace />;
    if (user.role === 'Counter B17' || user.role === 'Counter B22') return <Navigate to="/stock-take" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Suspense fallback={authLoadingFallback}>
      <Routes>
      <Route path="/" element={<Login />} />
      <Route 
        path="/hub" 
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Verifier']}>
            <Hub />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/stock-take" 
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Verifier', 'Counter B17', 'Counter B22']}>
            <StockTakeDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/stock-take/list" 
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Verifier', 'Counter B17', 'Counter B22']}>
            <StockTakeListView />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/stock-take/count/:table/:id" 
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Verifier', 'Counter B17', 'Counter B22']}>
            <StockTakeCounting />
          </ProtectedRoute>
        } 
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/reports/progress" 
        element={
          <ProtectedRoute allowedRoles={['Admin', 'Verifier', 'Counter B17', 'Counter B22']}>
            <UserProgress />
          </ProtectedRoute>
        } 
      />
      {/* Placeholder routes for other modules */}
      <Route path="/battery" element={<ProtectedRoute allowedRoles={['Admin', 'Operator Batt']}><BatteryTracker /></ProtectedRoute>} />
      <Route path="/qa" element={<ProtectedRoute allowedRoles={['Admin', 'QA Inspector']}><div className="container" style={{paddingTop: '5rem'}}><h2>QA Module (WIP)</h2></div></ProtectedRoute>} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <Router>
              <ToastContainer />
              <AppRoutes />
            </Router>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </GlobalErrorBoundary>
  );
}
