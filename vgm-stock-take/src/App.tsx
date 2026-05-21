import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import Login from './pages/Login';
import Hub from './pages/Hub';
import StockTakeDashboard from './pages/StockTake/Dashboard';
import StockTakeListView from './pages/StockTake/ListView';
import StockTakeCounting from './pages/StockTake/Counting';
import AdminSettings from './pages/Admin/Settings';
import UserProgress from './pages/Reports/UserProgress';
import BatteryTracker from './pages/Battery/Tracker';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/" replace />;
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
  );
}

export default function App() {
  return (
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
  );
}
