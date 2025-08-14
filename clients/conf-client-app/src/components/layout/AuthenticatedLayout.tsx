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
  const { selectedDevices, getMediaConstraints, inviteInfoSend, inviteInfoReceived, isLoggedOff, setIsLoggedOff } = useCall();
  const [showingPreview, setShowingPreview] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Effect to fetch/stop stream when previewing
  useEffect(() => {
    if (!showingPreview) {
      setPreviewStream(null); // Trigger cleanup
      return;
    }

    const constraints = getMediaConstraints(false, true);
    console.log('Fetching preview with constraints:', constraints); // Debug log

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        // Mute audio
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
        }

        // Ensure video
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          ui.showPopUp("No video devices available", "error");
          stream.getTracks().forEach((track) => track.stop()); // Clean up failed stream
          setShowingPreview(false);
          return;
        } else {
          setPreviewStream(stream);
        }
      })
      .catch((error) => {
        console.error('Error getting preview stream:', error);
        ui.showPopUp("Failed to get camera. Check permissions.", "error");
        setShowingPreview(false);
      });

    // Cleanup: This runs on next effect or unmount
    return () => {
      setPreviewStream(null);
    };
  }, [showingPreview, selectedDevices, getMediaConstraints, ui]);

  // Separate effect for stream changes: Assign srcObject and stop old tracks to release device
  useEffect(() => {
    console.log(`set preview stream`);

    if (previewStream && videoRef.current) {
      videoRef.current.srcObject = previewStream;
    }

    return () => {
      if (previewStream) {
        console.log('Stopping old stream tracks');
        previewStream.getTracks().forEach((track) => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    };
  }, [previewStream]);

  const previewClick = () => {
    setShowingPreview((prev) => !prev); // Just toggle, let effect handle fetch/stop
  };

  const handleShowSettingsClick = () => {
    setShowSettings(true);
  };

  useEffect(() => {
    console.log("updated inviteInfoSend", inviteInfoSend);
    console.log("updated inviteInfoReceived", inviteInfoReceived);
  }, [inviteInfoSend, inviteInfoReceived]);

  useEffect(() => {
    if (isLoggedOff) {
      console.log("useEffect isLoggedOff");
      api.logout();
      //navigate("/login");  
      setIsLoggedOff(false);
    }
  }, [api, isLoggedOff, navigate, setIsLoggedOff]);

  return (


    <div className="d-flex flex-column bg-light" style={{ minHeight: "100%", height: "100dvh" }}>
  <TopMenu onShowSettings={() => setShowSettings(true)} />

  {/* Responsive layout */}
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