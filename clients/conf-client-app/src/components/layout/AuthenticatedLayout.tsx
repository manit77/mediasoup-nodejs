import React, { useEffect, useState, useRef } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ParticipantsOnlinePane';
import SettingsPopup from '../popups/SettingsPopup';
import { useCall } from '../../hooks/useCall';
import { useUI } from '../../hooks/useUI';
import { Button } from 'react-bootstrap';
import RoomsPane from './RoomsPane';
import IncomingCallPopup from '../popups/IncomingCallPopup';
import CallingPopup from '../popups/CallingPopup';
import { FilePersonFill, Gear } from 'react-bootstrap-icons';
import { useAPI } from '../../hooks/useAPI';
import { useNavigate } from 'react-router-dom';

const AuthenticatedLayout: React.FC = () => {
  const api = useAPI();
  const ui = useUI();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const { inviteInfoSend, inviteInfoReceived, isLoggedOff, setIsLoggedOff } = useCall();

  useEffect(() => {
    if (isLoggedOff) {      
      api.logout();
      //navigate("/login");  
      setIsLoggedOff(false);
    }
  }, [api, isLoggedOff, navigate, setIsLoggedOff]);

  return (

    <div className="d-flex flex-column bg-light" style={{ minHeight: "100%", height: "100dvh" }}>
      <TopMenu onShowSettings={() => setShowSettings(true)} />   
      <div
        className="
      d-flex
      flex-column flex-lg-row
      justify-content-start justify-content-lg-center
      align-items-center align-items-lg-start
      flex-grow-1 overflow-auto p-3
    "
      >
        {(api.isAdmin() || api.isUser()) && (
          <div className="w-100 w-lg-auto me-lg-4" style={{ maxWidth: "500px" }}>
            <ContactsPane />
          </div>
        )}
        <div className="w-100 w-lg-auto" style={{ maxWidth: "500px" }}>
          <RoomsPane />
        </div>
      </div>
      <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
      {inviteInfoReceived && <IncomingCallPopup />}
      {inviteInfoSend && <CallingPopup />}
    </div>
  );
};

export default AuthenticatedLayout;