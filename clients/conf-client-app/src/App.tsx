import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { APIProvider } from './contexts/APIContext';
import { CallProvider } from './contexts/CallContext';
import LoginPage from './components/auth/LoginPage';
import AuthenticatedLayout from './components/layout/AuthenticatedLayout';
import OnCallScreen from './components/call/OnCallScreen';
import { useAPI } from './hooks/useAPI';
import { useCall } from './hooks/useCall';
import { UIProvider } from './contexts/UIContext';
import { useLocation } from 'react-router-dom';
import { getConferenceClient } from './services/ConferenceService';
import LoginGuestPage from './components/auth/LoginGuestPage';
import LogoutPage from './components/auth/LogoutPage';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAPI();
  const { isCallActive } = useCall();
  const location = useLocation();

  console.log("ROUTE:", location.pathname, "AUTH:", isAuthenticated);

  useEffect(() => {
    console.log('loading app');
    return () => {
      console.log('unmounting app');
      getConferenceClient().dispose();
    };
  }, []);

  useEffect(() => {

    const updateVh = () => {
      const vh = window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    updateVh(); // set initially
    window.addEventListener('resize', updateVh);

    return () => window.removeEventListener('resize', updateVh);
  }, []);

  return (
    <>
    {isLoading && <div className="d-flex justify-content-center align-items-center vh-100">Loading...</div>}
    <Routes>
      <Route path="/logout" element={<LogoutPage />} />
      {!isAuthenticated ? (
        <>
          <Route path="/loginGuest" element={<LoginGuestPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Catch-all redirects to login */}
          <Route path="*" element={<Navigate to={`/login${location.search}`} replace />} />
        </>
      ) : (
        <>
          {isCallActive ? (
            <Route path="/on-call" element={<OnCallScreen />} />
          ) : (
            <Route path="/app" element={<AuthenticatedLayout />} />
          )}

          {/* Catch-all redirects to app */}
          <Route
            path="*"
            element={<Navigate to={`${isCallActive ? "/on-call" : "/app"}`} replace />}
          />
        </>
      )}

    </Routes>
    </>
  );
};

function App() { 

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // 2. Apply the theme attribute to the root HTML element
    document.documentElement.setAttribute('data-bs-theme', theme);
  }, [theme]);
  
  return (
    <Router>      
      <UIProvider>
        <APIProvider>
          <CallProvider>
            <AppRoutes />
          </CallProvider>
        </APIProvider>
      </UIProvider>
    </Router>
  );
}

export default App;