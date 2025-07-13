import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CallProvider } from './contexts/CallContext';
import LoginPage from './components/auth/LoginPage';
import AuthenticatedLayout from './components/layout/AuthenticatedLayout';
import OnCallScreen from './components/call/OnCallScreen';
import IncomingCallPopup from './components/call/IncomingCallPopup';
import CallingPopup from './components/call/CallingPopup';
import { useAuth } from './hooks/useAuth';
import { useCall } from './hooks/useCall';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isCallActive, inviteInfoSend, localParticipant } = useCall();

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
      <AuthProvider>
        <CallProvider>
          <AppRoutes />
        </CallProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;