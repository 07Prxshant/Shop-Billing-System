import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes inside Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">Customer Ledger (Phase 7)</div>} />
              <Route path="/billing" element={<div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">Billing POS (Phase 5)</div>} />
              <Route path="/bills" element={<div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">Bills List (Phase 5)</div>} />
              <Route path="/reports" element={<div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">Reports (Phase 9)</div>} />
              <Route path="/settings" element={<div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">Settings</div>} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
