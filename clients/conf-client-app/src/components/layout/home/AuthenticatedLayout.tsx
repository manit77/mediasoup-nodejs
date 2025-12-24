import React, { useEffect, useState, useRef } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ParticipantsOnlinePane';
import SettingsPopup from '@client/components/popups/SettingsPopup';
import { useCall } from '@client/hooks/useCall';
import { useUI } from '@client/hooks/useUI';
import RoomsPane from './RoomsPane';
import IncomingCallPopup from '@client/components/popups/IncomingCallPopup';
import CallingPopup from '@client/components/popups/CallingPopup';
import { useAPI } from '@client/hooks/useAPI';
import { useNavigate } from 'react-router-dom';

const AuthenticatedLayout: React.FC = () => {
  const api = useAPI();
  const ui = useUI();
  const navigate = useNavigate();  
  const { inviteInfoSend, inviteInfoReceived, isLoggedOff, setIsLoggedOff } = useCall();

  useEffect(() => {
    if (isLoggedOff) {      
      api.logout();
      //navigate("/login");  
      setIsLoggedOff(false);
    }
  }, [api, isLoggedOff, navigate, setIsLoggedOff]);

  return (

    <div className="d-flex flex-column bg-body" style={{ minHeight: "100%", height: "100dvh" }}>
      <TopMenu onShowSettings={() => ui.setIsShowSettings(true)} />   
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
      {inviteInfoReceived && <IncomingCallPopup />}
      {inviteInfoSend && <CallingPopup />}
    </div>
  );
};

export default AuthenticatedLayout;