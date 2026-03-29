import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './i18n';
import '@/App.css';

import Navigation from './components/Navigation';
import WhatsAppButton from './components/WhatsAppButton';
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManagerPage from './pages/ManagerPage';
import Chat from './pages/Chat';
import DocumentService from './pages/DocumentService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext();

function App() {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token]);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'he' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      logout();
    }
  };

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <BrowserRouter>
        <div className="App">
          <Navigation />
          <WhatsAppButton />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/properties/:type" element={<Properties />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/auth/:mode" element={<Auth />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth/login" />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/manager/:managerId" element={<ManagerPage />} />
            <Route path="/chat/:propertyId" element={user ? <Chat /> : <Navigate to="/auth/login" />} />
            <Route path="/document-service" element={user ? <DocumentService /> : <Navigate to="/auth/login" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;