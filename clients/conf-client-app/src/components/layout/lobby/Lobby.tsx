import React, { useEffect, useState, useRef } from 'react';
import SettingsPopup from '@client/components/popups/SettingsPopup';
import { useCall } from '@client/hooks/useCall';
import { useUI } from '@client/hooks/useUI';
import IncomingCallPopup from '@client/components/popups/IncomingCallPopup';
import CallingPopup from '@client/components/popups/CallingPopup';
import { useAPI } from '@client/hooks/useAPI';
import { useNavigate } from 'react-router-dom';
import RoomLobby from '@client/components/ui/roomLobby/RoomLobby';
import LobbyMenu from './LobbyMenu';

const Lobby: React.FC = () => {
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
        <LobbyMenu onShowSettings={() => ui.setIsShowSettings(true)} />
      <div
        className="
      d-flex
      flex-column flex-lg-row
      justify-content-start justify-content-lg-center
      align-items-center align-items-lg-start
      flex-grow-1 overflow-auto p-3
    "
      >
        <div className="w-100 w-lg-auto">
          <RoomLobby />
        </div>
      </div>     
      {inviteInfoReceived && <IncomingCallPopup />}    
    </div>
  );
};

export default Lobby;