import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SiteContentProvider } from './context/SiteContentContext';
import { ToastProvider } from './components/Toast';
import { ImageLightboxProvider } from './components/ImageLightbox';
import LoadingBar from './components/LoadingBar';

import Home          from './pages/public/Home';
import About         from './pages/public/About';
import Catalog       from './pages/public/Catalog';
import Contact       from './pages/public/Contact';

import WholesalerLogin     from './pages/wholesaler/Login';
import WholesalerCatalogue from './pages/wholesaler/Catalogue';
import MyQuotations        from './pages/wholesaler/MyQuotations';

import AdminLogin    from './pages/admin/AdminLogin';
import Dashboard     from './pages/admin/Dashboard';
import Categories    from './pages/admin/Categories';
import Products      from './pages/admin/Products';
import Import        from './pages/admin/Import';
import Parties       from './pages/admin/Parties';
import AdminQuotations from './pages/admin/Quotations';
import Content       from './pages/admin/Content';
import Media         from './pages/admin/Media';
import Setup         from './pages/Setup';

function PartyRoute({ children }) {
  const { party, loading } = useAuth();
  if (loading) return null;
  return party ? children : <Navigate to="/wholesaler/login" replace />;
}

function AdminRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return null;
  return admin ? children : <Navigate to="/admin" replace />;
}

function SetupGate({ children }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/setup') { setChecked(true); return; }
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => {
        if (!d.configured) window.location.replace('/setup');
        else setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  if (!checked && window.location.pathname !== '/setup') return null;
  return children;
}

export default function App() {
  return (
    <SiteContentProvider>
    <AuthProvider>
      <ToastProvider>
        <ImageLightboxProvider>
          <CartProvider>
            <LoadingBar />
            <SetupGate>
              <Routes>
                <Route path="/setup" element={<Setup />} />

                <Route path="/"        element={<Home />} />
                <Route path="/about"   element={<About />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/contact" element={<Contact />} />

                <Route path="/wholesaler/login"     element={<WholesalerLogin />} />
                <Route path="/wholesaler/catalogue" element={<PartyRoute><WholesalerCatalogue /></PartyRoute>} />
                <Route path="/wholesaler/quotations" element={<PartyRoute><MyQuotations /></PartyRoute>} />

                <Route path="/admin"                element={<AdminLogin />} />
                <Route path="/admin/dashboard"      element={<AdminRoute><Dashboard /></AdminRoute>} />
                <Route path="/admin/categories"     element={<AdminRoute><Categories /></AdminRoute>} />
                <Route path="/admin/products"       element={<AdminRoute><Products /></AdminRoute>} />
                <Route path="/admin/import"         element={<AdminRoute><Import /></AdminRoute>} />
                <Route path="/admin/parties"        element={<AdminRoute><Parties /></AdminRoute>} />
                <Route path="/admin/quotations"     element={<AdminRoute><AdminQuotations /></AdminRoute>} />
                <Route path="/admin/content"        element={<AdminRoute><Content /></AdminRoute>} />
                <Route path="/admin/media"          element={<AdminRoute><Media /></AdminRoute>} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </SetupGate>
          </CartProvider>
        </ImageLightboxProvider>
      </ToastProvider>
    </AuthProvider>
    </SiteContentProvider>
  );
}
