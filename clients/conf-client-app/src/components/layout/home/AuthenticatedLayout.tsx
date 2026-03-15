import React, { useEffect, useState, useRef } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ParticipantsOnlinePane';
import SettingsPopup from '@client/components/popups/SettingsPopup';
import { useCall } from '@client/contexts/CallContext';
import { useUI } from '@client/contexts/UIContext';
import RoomsPane from './RoomsPane';
import IncomingCallPopup from '@client/components/popups/IncomingCallPopup';
import CallingPopup from '@client/components/popups/CallingPopup';
import { useAPI } from '@client/contexts/APIContext';
import { useNavigate } from 'react-router-dom';
import { disableKeyboard } from '@client/utils/kiosk';
import { usePresence } from '@client/contexts/PresenceContext';

const AuthenticatedLayout: React.FC = () => {
  const api = useAPI();
  const ui = useUI();
  const navigate = useNavigate();
  const call = useCall();
  const presence = usePresence();

  useEffect(() => {
    if (!api.isAuthenticated) {
      presence.disconnect();
      call.disconnect();
      api.logout();
    } else {
      disableKeyboard();
    }
  }, [api]);

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
      {call.inviteInfoReceived && <IncomingCallPopup />}
      {call.inviteInfoSend && <CallingPopup />}
    </div>
  );
};

export default AuthenticatedLayout;