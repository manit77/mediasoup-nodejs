import React, { useState } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ContactsPane';
import SettingsPopup from '../popups/SettingsPopup';
import MainVideo from '../call/MainVideo';
import { useCall } from '../../hooks/useCall';
import { Button } from 'react-bootstrap';
import PopupMessage from '../popups/PopupMessage';

const AuthenticatedLayout: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const {localStream, getSetLocalStream, setLocalStream, popUpMessage, hidePopUp} = useCall();

    const previewClick = () => {
        if (localStream) {
            setLocalStream(null);
        } else {
            getSetLocalStream();
        }
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
                </div>
                <div className="col-9 p-3" style={{ overflowY: 'auto' }}>
                    <Button variant="primary" onClick={showDeviceSettingsClick}>Device Settings</Button> <Button variant="secondary" onClick={previewClick}>
                        {
                            localStream == null ? "Preview Video" : "Stop Preview"
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