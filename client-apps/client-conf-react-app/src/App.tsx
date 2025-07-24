import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { APIProvider } from './contexts/APIContext';
import { CallProvider } from './contexts/CallContext';
import LoginPage from './components/auth/LoginPage';
import AuthenticatedLayout from './components/layout/AuthenticatedLayout';
import OnCallScreen from './components/call/OnCallScreen';
import { useAPI } from './hooks/useAPI';
import { useCall } from './hooks/useCall';
import { UIProvider } from './contexts/UIContext';
import { conferenceService } from './services/ConferenceService';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAPI();
  const { isCallActive } = useCall();

  useEffect(() => {
    console.log('loading app');
    return () => {
      console.log('unmounting app');
      conferenceService.dispose();
    }
  }, [])


  if (isLoading) {
    return <div className="d-flex justify-content-center align-items-center vh-100">Loading...</div>;
  }

  return (
    <>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          <>
            {isCallActive ? (
              <Route path="/on-call" element={<OnCallScreen />} />
            ) : (
              <Route path="/app" element={<AuthenticatedLayout />} />
            )}
            <Route path="*" element={<Navigate to={isCallActive ? "/on-call" : "/app"} />} />
          </>
        )}
      </Routes>

    </>
  );
};

function App() {
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