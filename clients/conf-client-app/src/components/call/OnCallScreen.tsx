import React, { useEffect, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import CallTopMenu from './CallTopMenu';
import ParticipantsPane, { ParticipantVideoPreview } from './ParticipantsPane';
import MainVideo from './MainVideo';
import SettingsPopup from '../popups/SettingsPopup';
import { useCall } from '../../hooks/useCall';
import { Navigate } from 'react-router-dom';
import { Participant } from '@conf/conf-client';

const OnCallScreen: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const { localParticipant, isCallActive, callParticipants, selectedDevices, switchDevicesOnCall, presenter } = useCall();
    const [mainStream, setMainStream] = useState<MediaStream | null>(null);
    const [remoteParticipant, setRemoteParticipant] = useState<Participant>(null)

    useEffect(() => {
        console.log(`try to switch devices, selectedDevices triggered `, localParticipant.stream.getTracks());
        switchDevicesOnCall();
    }, [localParticipant, selectedDevices, switchDevicesOnCall]);

    useEffect(() => {
        if (localParticipant.stream && !mainStream) {
            setMainStream(localParticipant.stream);
        }
    }, [localParticipant.stream, mainStream]);

    useEffect(() => {
        if (presenter && presenter.stream) {
            setMainStream(presenter.stream);
        } else {
            console.warn(`no presenter stream`);
        }
    }, [presenter]);

    useEffect(() => {
        if (callParticipants.size == 2) {
            let part = [...callParticipants.values()].filter(p => p.participantId != localParticipant.participantId);
            if (part) {
                setRemoteParticipant(part[0]);
            }
        }
    }, [callParticipants]);

    const handleSelectParticipantVideo = (participantId: string, stream?: MediaStream) => {
        console.warn(`handleSelectParticipantVideo:`, stream?.getTracks());
        if (stream) {
            let videoTrack = stream.getVideoTracks()[0]
            if (videoTrack && videoTrack.enabled && !videoTrack.muted && videoTrack.readyState === "live") {
                setMainStream(stream);
            } else {
                console.warn(`no video track`);
            }
        } else {
            console.warn(`no stream`);
        }
    };

    if (!isCallActive && !localParticipant.stream && callParticipants.size === 0) { // Check if call ended/not properly started
        console.log("OnCallScreen: No active call, redirecting.");
        return <Navigate to="/app" />;
    }

    return (
        <div className="d-flex flex-column vh-100 bg-dark text-light">
            <CallTopMenu onShowSettings={() => setShowSettings(true)} />

            <div className="pt-5">
                <div style={{
                    paddingTop: '8px',
                    height: 'calc(100vh - 56px)',
                    overflow: 'hidden',
                }}>
                    <Container fluid className="flex-grow-1 p-0 m-0">
                        {callParticipants.size === 1 ? (
                            // One participant - waiting screen
                            <div className="d-flex flex-column justify-content-center align-items-center h-100">
                                <div style={{ width: '60%', maxWidth: '600px' }}>
                                    <ParticipantVideoPreview onClick={() => { }} isSelected={true} key={localParticipant.participantId} participant={localParticipant}></ParticipantVideoPreview>
                                </div>
                                <p className="mt-3 fs-5">Waiting for other participants...</p>
                            </div>
                        ) : callParticipants.size === 2 && remoteParticipant ? (
                            // Two participants - PiP layout
                            <div
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: 'calc(100vh - 56px)',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Remote */}
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        maxWidth: '100%',
                                        maxHeight: 'calc(100vh - 56px)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <ParticipantVideoPreview
                                        onClick={() => handleSelectParticipantVideo(remoteParticipant.participantId, remoteParticipant.stream)}
                                        isSelected={mainStream === remoteParticipant.stream}
                                        key={remoteParticipant.participantId}
                                        participant={remoteParticipant}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain', // Ensure video scales without cropping
                                        }}
                                    />
                                </div>

                                {/* Local in bottom right */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '50px',
                                        right: '20px',
                                        width: '200px',
                                        height: '150px', // 4:3 aspect ratio for PiP
                                        border: '2px solid #aaa',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                                    }}
                                >
                                    <ParticipantVideoPreview
                                        onClick={() => handleSelectParticipantVideo(localParticipant.participantId, localParticipant.stream)}
                                        isSelected={mainStream === localParticipant.stream}
                                        key={localParticipant.participantId}
                                        participant={localParticipant}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain', // Ensure local video scales properly
                                        }}
                                    />
                                </div>
                            </div>
                        ) : callParticipants.size > 2 ? (
                            // 3+ participants - grid layout with sidebar
                            <Row className="g-0 h-100">
                                <Col md={9} className="d-flex flex-column p-1 h-100">
                                    <MainVideo stream={mainStream} participantId={localParticipant.participantId} />
                                </Col>
                                <Col md={3} className="border-start border-secondary p-2 h-100" style={{ overflowY: 'auto', background: '#2a2f34' }}>
                                    <ParticipantsPane onSelectVideo={handleSelectParticipantVideo} />
                                </Col>
                            </Row>
                        ) : (<></>)}
                    </Container>
                </div>
            </div>

            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
        </div>
    );
};

export default OnCallScreen;