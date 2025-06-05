import React, { useState } from 'react';
import TopMenu from './TopMenu';
import ContactsPane from './ContactsPane';
import SettingsPopup from '../popups/SettingsPopup';
const AuthenticatedLayout: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);

    return (
        <div className="d-flex flex-column vh-100">
            <TopMenu onShowSettings={() => setShowSettings(true)} />
            <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
                <div className="col-3 border-end p-3" style={{ overflowY: 'auto' }}>
                    <ContactsPane />
                </div>
                <div className="col-9 p-3" style={{ overflowY: 'auto' }}>
                    {/* Main content area for when not in a call, e.g., chat, user profile, etc. */}
                    <p>Welcome! Select a contact to call.</p>
                </div>
            </div>
            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
        </div>
    );
};

export default AuthenticatedLayout;