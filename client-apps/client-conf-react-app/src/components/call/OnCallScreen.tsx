import React, { useEffect, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import CallTopMenu from './CallTopMenu';
import ParticipantsPane from './ParticipantsPane';
import MainVideo from './MainVideo';
import SettingsPopup from '../popups/SettingsPopup';
import { useCall } from '../../hooks/useCall';
import { Navigate } from 'react-router-dom';

const OnCallScreen: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const { localParticipant, isCallActive, callParticipants, selectedDevices, switchDevicesOnCall } = useCall();
    const [mainStream, setMainStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        console.log(`try to switch devices, selectedDevices triggered `, localParticipant.stream.getTracks());
        switchDevicesOnCall();
    }, [selectedDevices, switchDevicesOnCall]);

    useEffect(() => {
        if (localParticipant.stream && !mainStream) {
            setMainStream(localParticipant.stream);
        }
    }, [localParticipant.stream, mainStream]);

    const handleSelectParticipantVideo = (participantId: string, stream?: MediaStream) => {
        if (stream) {
            setMainStream(stream);
        } else if (participantId === "local" && localParticipant.stream) { // Special case for local user
            setMainStream(localParticipant.stream);
        }
    };

    if (!isCallActive && !localParticipant.stream && callParticipants.size === 0) { // Check if call ended/not properly started
        console.log("OnCallScreen: No active call, redirecting.");
        return <Navigate to="/app" />;
    }

    return (
        <div className="d-flex flex-column vh-100 bg-dark text-light">
            <CallTopMenu
                onShowSettings={() => setShowSettings(true)}
            />
            <Container fluid className="flex-grow-1 p-0 m-0">
                <Row className="g-0 h-100">
                    <Col md={9} className="d-flex flex-column p-1 h-100">
                        {/* Main Video Content */}
                        <MainVideo stream={mainStream} participantId={localParticipant.participantId} />
                    </Col>
                    <Col md={3} className="border-start border-secondary p-2 h-100" style={{ overflowY: 'auto', background: '#2a2f34' }}>
                        {/* Participants List */}
                        <ParticipantsPane onSelectVideo={handleSelectParticipantVideo} />
                    </Col>
                </Row>
            </Container>
            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
        </div>
    );
};

export default OnCallScreen;