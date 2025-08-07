import React, { useEffect, useState, useRef } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ParticipantsOnlinePane';
import SettingsPopup from '../popups/SettingsPopup';
import { useCall } from '../../hooks/useCall';
import { useUI } from '../../hooks/useUI';
import { Button } from 'react-bootstrap';
import RoomsPane from './RoomsPane';
import IncomingCallPopup from '../popups/IncomingCallPopup';
import CallingPopup from '../call/CallingPopup';
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
    <div className="d-flex flex-column vh-100 bg-light">
      <TopMenu onShowSettings={() => setShowSettings(true)} />
      <div className="d-flex flex-grow-1 overflow-hidden">
        <div className="sidebar col-12 col-md-4 border-end p-3">
          {(api.isAdmin() || api.isUser()) && (
            <div className="mb-4">              
              <ContactsPane />
            </div>
          )}
          <div>            
            <RoomsPane />
          </div>
        </div>
        <div className="main-content col-12 col-md-8 p-3">
          <div className="d-flex gap-2 mb-3">
            <Button variant="primary" onClick={handleShowSettingsClick} className="d-flex align-items-center">
              <Gear className="me-1" /> Device Settings
            </Button>
            <Button
              variant="outline-secondary"
              onClick={previewClick}
              className="d-flex align-items-center"
            >
              <FilePersonFill className="me-1" /> {showingPreview ? 'Stop Preview' : 'Preview Video'}
            </Button>
          </div>
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-100 h-auto rounded shadow-sm"
            />
          </div>
        </div>
      </div>
      <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
      {inviteInfoReceived && <IncomingCallPopup />}
      {inviteInfoSend && <CallingPopup />}
    </div>
  );
};

export default AuthenticatedLayout;