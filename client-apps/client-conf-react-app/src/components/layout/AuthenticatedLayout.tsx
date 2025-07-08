import React, { useEffect, useState } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ParticipantsOnlinePane';
import SettingsPopup from '../popups/SettingsPopup';
import MainVideo from '../call/MainVideo';
import { useCall } from '../../hooks/useCall';
import { Button } from 'react-bootstrap';
import PopupMessage from '../popups/PopupMessage';
import RoomsPane from './RoomsPane';

const AuthenticatedLayout: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const { localStream, isLocalStreamUpdated, getLocalMedia, popUpMessage, hidePopUp } = useCall();
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        console.log("localStream refresh triggered.");
        let videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            setShowPreview(videoTrack.enabled);
        }
    }, [isLocalStreamUpdated, localStream]);

    const previewClick = async () => {
        let videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) {
            await getLocalMedia();
            videoTrack = localStream.getVideoTracks()[0];
        } else {
            console.log(`video track found.`)
            videoTrack.enabled = !videoTrack.enabled;
        }
        setShowPreview(videoTrack.enabled);
        console.log(`video track not found.`);
    }

    const showDeviceSettingsClick = () => {
        setShowSettings(true);
    }

    return (
        <div className="d-flex flex-column vh-100">
            <TopMenu onShowSettings={() => setShowSettings(true)} />
            <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
                <div className="col-3 border-end p-3" style={{ overflowY: 'auto' }}>
                    <ContactsPane />
                    <RoomsPane />
                </div>
                <div className="col-9 p-3" style={{ overflowY: 'auto' }}>
                    <Button variant="primary" onClick={showDeviceSettingsClick}>Device Settings</Button> <Button variant="secondary" onClick={previewClick}>
                        {
                            !showPreview ? "Preview Video" : "Stop Preview"
                        }
                    </Button>
                    <MainVideo stream={localStream} />
                </div>
            </div>
            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
            <PopupMessage show={popUpMessage ? true : false} message={popUpMessage} handleClose={() => hidePopUp()} />
        </div>
    );
};

export default AuthenticatedLayout;