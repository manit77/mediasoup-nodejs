import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import CallTopMenu from './CallTopMenu';
import ParticipantsPane from './ParticipantsPane';
import MainVideo from './MainVideo';
import SettingsPopup from '../popups/SettingsPopup';
import InvitePopup from '../popups/InvitePopup';
import { useCall } from '../../hooks/useCall';
import { Navigate } from 'react-router-dom';

const OnCallScreen: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const { isCallActive, localStream, remoteStreams, participants } = useCall();
    const [mainStream, setMainStream] = useState<MediaStream | null>(null); // Could be local or a remote stream
    const [mainStreamUserId, setMainStreamUserId] = useState<string | null>(null); // ID of user in main view

    React.useEffect(() => {
        // Initially set local stream to main view if available
        if (localStream && !mainStream) {
            setMainStream(localStream);
            // Assuming currentUser's ID is available, e.g., from useAuth() or participants list
        }
    }, [localStream, mainStream]);

    const handleSelectParticipantVideo = (participantId: string, stream?: MediaStream) => {
        if (stream) {
            setMainStream(stream);
            setMainStreamUserId(participantId);
        } else if (participantId === "local" && localStream) { // Special case for local user
            setMainStream(localStream);
            setMainStreamUserId("local"); // Or current user ID
        }
    };

    if (!isCallActive && !localStream && participants.length === 0) { // Check if call ended/not properly started
        console.log("OnCallScreen: No active call, redirecting.");
        return <Navigate to="/app" />;
    }

    return (
        <div className="d-flex flex-column vh-100 bg-dark text-light">
            <CallTopMenu
                onShowInvite={() => setShowInvite(true)}
                onShowSettings={() => setShowSettings(true)}
            />
            <Container fluid className="flex-grow-1 p-0 m-0">
                <Row className="g-0 h-100">
                    <Col md={9} className="d-flex flex-column p-1 h-100">
                        {/* Main Video Content */}
                        <MainVideo stream={mainStream} userId={mainStreamUserId} />
                    </Col>
                    <Col md={3} className="border-start border-secondary p-2 h-100" style={{ overflowY: 'auto', background: '#2a2f34' }}>
                        {/* Participants List */}
                        <ParticipantsPane onSelectVideo={handleSelectParticipantVideo} currentMainUserId={mainStreamUserId} />
                    </Col>
                </Row>
            </Container>

            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
            <InvitePopup show={showInvite} handleClose={() => setShowInvite(false)} />
        </div>
    );
};

export default OnCallScreen;