import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './i18n';
import '@/App.css';

import Navigation from './components/Navigation';
import WhatsAppButton from './components/WhatsAppButton';
import AccessibilityButton from './components/AccessibilityButton';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import SubleaseDetail from './pages/SubleaseDetail';
import Auth from './pages/Auth';
import VerifyPending from './pages/VerifyPending';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManagerPage from './pages/ManagerPage';
import Chat from './pages/Chat';
import DocumentService from './pages/DocumentService';
import SignContract from './pages/SignContract';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import FAQ from './pages/FAQ';
import { DOCUMENT_SERVICES_ENABLED } from './config/features';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext();

function App() {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);
  // Use sessionStorage instead of localStorage for better security
  // sessionStorage is cleared when browser tab is closed, reducing XSS attack window
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const [loading, setLoading] = useState(!!sessionStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token]);

  useEffect(() => {
    // Update <html lang> on language change so screen readers / search
    // engines / spell-checkers know what language the page is in.
    // We deliberately keep `dir` pinned to LTR — the user's preference
    // is translated Hebrew text without flipping the entire layout.
    document.documentElement.lang = i18n.language.startsWith('he') ? 'he' : 'en';
    document.documentElement.dir = 'ltr';
  }, [i18n.language]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      // Apply the user's saved UI language preference (cross-device).
      const pref = response.data?.preferred_language;
      if (pref && (pref === 'en' || pref === 'he') && !i18n.language.startsWith(pref)) {
        i18n.changeLanguage(pref);
      }
    } catch (error) {
      console.error('Failed to fetch user', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (newToken, userData) => {
    // Store token in sessionStorage (more secure than localStorage)
    // sessionStorage is cleared when browser tab closes, limiting XSS exposure window
    sessionStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <BrowserRouter>
        <ScrollToTop />
        <div className="App">
          <Navigation />
          <WhatsAppButton />
          <AccessibilityButton />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/properties/:type" element={<Properties />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/sublease/:id" element={<SubleaseDetail />} />
            <Route path="/auth/:mode" element={<Auth />} />
            <Route path="/verify-pending" element={<VerifyPending />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth/login" />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/manager/:managerId" element={<ManagerPage />} />
            <Route path="/chat/:propertyId" element={user ? <Chat /> : <Navigate to="/auth/login" />} />
            <Route path="/document-service" element={DOCUMENT_SERVICES_ENABLED ? (user ? <DocumentService /> : <Navigate to="/auth/login" />) : <Navigate to="/" />} />
            <Route path="/sign/:signToken" element={<SignContract />} />
            <Route path="/payment/success" element={user ? <PaymentSuccess /> : <Navigate to="/auth/login" />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/faq" element={<FAQ />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;