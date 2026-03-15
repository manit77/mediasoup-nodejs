import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { APIProvider } from '@client/contexts/APIContext';
import { CallProvider } from '@client/contexts/CallContext';
import { DeviceProvider } from '@client/contexts/DeviceContext';
import LoginPage from '@client/components/layout/auth/LoginPage';
import AuthenticatedLayout from './components/layout/home/AuthenticatedLayout';
import OnCallScreen from '@client/components/layout/call/OnCallScreen';
import { useAPI } from '@client/hooks/useAPI';
import { useCall } from '@client/hooks/useCall';
import { UIProvider } from '@client/contexts/UIContext';
import LoginGuestPage from '@client/components/layout/auth/LoginGuestPage';
import LogoutPage from '@client/components/layout/auth/LogoutPage';
import Lobby from '@client/components/layout/lobby/Lobby'

const GUEST_IDLE_LOGOUT_MS = 25 * 60 * 1000;
const GUEST_ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading, getCurrentUser, logout } = useAPI();
  const { isCallActive } = useCall();
  const [forceGuestLoginRedirect, setForceGuestLoginRedirect] = useState(false);
  const lastGuestActivityAtRef = useRef<number>(Date.now());
  const guestIdleTimerRef = useRef<number | null>(null);
  const guestHasJoinedCallRef = useRef<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      setForceGuestLoginRedirect(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      guestHasJoinedCallRef.current = false;
      return;
    }

    if (isCallActive) {
      guestHasJoinedCallRef.current = true;
    }
  }, [isAuthenticated, isCallActive]);

  useEffect(() => {
    const clearGuestIdleTimer = () => {
      console.log('clearGuestIdleTimer ' + new Date().toISOString());
      if (guestIdleTimerRef.current !== null) {
        window.clearTimeout(guestIdleTimerRef.current);
        guestIdleTimerRef.current = null;
      }
    };

    if (isLoading || !isAuthenticated) {
      clearGuestIdleTimer();
      lastGuestActivityAtRef.current = Date.now();
      return;
    }

    const user = getCurrentUser();
    const shouldWatchGuestIdle = user?.role === 'guest' && !guestHasJoinedCallRef.current && !isCallActive;

    if (!shouldWatchGuestIdle) {
      clearGuestIdleTimer();
      return;
    }

    const scheduleGuestIdleLogout = () => {
      clearGuestIdleTimer();

      const elapsedMs = Date.now() - lastGuestActivityAtRef.current;
      const remainingMs = GUEST_IDLE_LOGOUT_MS - elapsedMs;

      if (remainingMs <= 0) {
        console.log('Auto logout guest due to inactivity.');
        setForceGuestLoginRedirect(true);
        logout();
        return;
      }

      guestIdleTimerRef.current = window.setTimeout(() => {
        const currentUser = getCurrentUser();
        if (currentUser?.role !== 'guest' || guestHasJoinedCallRef.current || isCallActive) {
          return;
        }

        console.log('Auto logout guest due to inactivity timeout.');
        setForceGuestLoginRedirect(true);
        logout();
      }, remainingMs);
    };

    const onGuestActivity = () => {
      lastGuestActivityAtRef.current = Date.now();
      scheduleGuestIdleLogout();
    };

    scheduleGuestIdleLogout();

    GUEST_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onGuestActivity);
    });

    return () => {
      clearGuestIdleTimer();
      GUEST_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onGuestActivity);
      });
    };
  }, [getCurrentUser, isAuthenticated, isCallActive, isLoading, logout]);

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
          <Route path="*" element={<Navigate to={forceGuestLoginRedirect ? "/loginGuest" : "/login"} replace />} />
        </>
      ) : (
        /* Authenticated Logic */
        <>
          {isCallActive ? (
             <Route path="/on-call" element={<OnCallScreen />} />
          ) : (
            <>
              <Route path="/app" element={<AuthenticatedLayout />} />
              <Route path="/lobby/:trackingId" element={<Lobby />} />
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
          <DeviceProvider>
            <CallProvider>
              <AppRoutes />            
            </CallProvider>
          </DeviceProvider>
        </APIProvider>
      </UIProvider>
    </Router>
  );
}

export default App;