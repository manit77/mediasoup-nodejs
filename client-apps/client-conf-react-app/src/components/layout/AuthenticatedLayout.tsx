import React, { useContext, useEffect, useState } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ParticipantsOnlinePane';
import SettingsPopup from '../popups/SettingsPopup';
import MainVideo from '../call/MainVideo';
import { useCall } from '../../hooks/useCall';
import { Button } from 'react-bootstrap';
import PopupMessage from '../popups/PopupMessage';
import RoomsPane from './RoomsPane';
import { AuthContext } from './../../contexts/AuthContext';
import IncomingCallPopup from '../call/IncomingCallPopup';
import CallingPopup from '../call/CallingPopup';

const AuthenticatedLayout: React.FC = () => {
    const auth = useContext(AuthContext);
    const [showSettings, setShowSettings] = useState(false);
    const { localParticipant, inviteInfoSend, inviteInfoReceived, isLocalStreamUpdated, getLocalMedia, popUpMessage, hidePopUp } = useCall();
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        console.log("localStream refresh triggered.");
        let videoTrack = localParticipant.stream.getVideoTracks()[0];
        if (videoTrack) {
            console.log("videoTrack found, enabled: ", videoTrack.enabled);
            setShowPreview(videoTrack.enabled);
        }

    }, [isLocalStreamUpdated, localParticipant]);

    const previewClick = async () => {
        let videoTrack = localParticipant.stream.getVideoTracks()[0];
        if (!videoTrack) {
            console.log(`get local media for preview.`);
            let tracks = await getLocalMedia();
            videoTrack = tracks.find(t => t.kind === 'video');
        } else {
            console.log(`video track found.`);
            videoTrack.enabled = !videoTrack.enabled;
        }
        setShowPreview(videoTrack?.enabled);
    }

    const showDeviceSettingsClick = () => {
        setShowSettings(true);
    }

    useEffect(() => {

        console.log("updated inviteInfoSend", inviteInfoSend);        
        console.log("updated inviteInfoReceived", inviteInfoReceived);        

    }, [inviteInfoSend, inviteInfoReceived]);

    return (
        <div className="d-flex flex-column vh-100">
            <TopMenu onShowSettings={() => setShowSettings(true)} />
            <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
                <div className="col-3 border-end p-3" style={{ overflowY: 'auto' }}>
                    {
                        auth.getCurrentUser().role === "admin" && <ContactsPane />
                    }
                    <RoomsPane />
                </div>
                <div className="col-9 p-3" style={{ overflowY: 'auto' }}>
                    <Button variant="primary" onClick={showDeviceSettingsClick}>Device Settings</Button> <Button variant="secondary" onClick={previewClick}>
                        {
                            !showPreview ? "Preview Video" : "Stop Preview"
                        }
                    </Button>
                    <MainVideo stream={localParticipant.stream} />
                </div>
            </div>
            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
            <PopupMessage show={popUpMessage ? true : false} message={popUpMessage} handleClose={() => hidePopUp()} />
            {inviteInfoReceived && <IncomingCallPopup />}
            {inviteInfoSend && <CallingPopup />}
        </div>
    );
};

export default AuthenticatedLayout;