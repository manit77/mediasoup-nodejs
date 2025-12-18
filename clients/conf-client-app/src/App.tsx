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
import RoomLobby from './components/call/RoomLobby';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAPI();
  const { isCallActive, isConnected } = useCall();
  const location = useLocation();

  // 1. GATEKEEPER: If we don't know the auth status yet, stay here.
  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
        <div className="spinner-border text-primary me-3" />
        <span className="fw-bold">Verifying Session...</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/logout" element={<LogoutPage />} />

      {!isAuthenticated ? (
        /* Only reaches here if isLoading is false AND isAuthenticated is false */
        <>
          <Route path="/loginGuest" element={<LoginGuestPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to={`/login?redirect=${location.pathname}`} replace />} />
        </>
      ) : (
        /* Authenticated Logic */
        <>
          {isCallActive ? (
             <Route path="/on-call" element={<OnCallScreen />} />
          ) : (
            <>
              <Route path="/app" element={<AuthenticatedLayout />} />
              <Route path="/lobby/:roomId" element={<RoomLobby />} />
              <Route path="/" element={<Navigate to="/app" replace />} />
            </>
          )}
          {/* Catch-all: only redirect if no match is found in the auth block */}
          <Route path="*" element={<Navigate to={isCallActive ? "/on-call" : "/app"} replace />} />
        </>
      )}
    </Routes>
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