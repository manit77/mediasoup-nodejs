import React, { useEffect, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import CallTopMenu from './CallTopMenu';
import ParticipantsPane from './ParticipantsPane';
import MainVideo from './MainVideo';
import SettingsPopup from '../popups/SettingsPopup';
import { useCall } from '../../hooks/useCall';
import { Navigate } from 'react-router-dom';
import { Participant } from '@conf/conf-client';
import { relative } from 'path';
import { conferenceClient } from '../../contexts/CallContext';
import { ParticipantVideoPreview } from './ParticipantVideoPreview';

const OnCallScreen: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const { localParticipant, isCallActive, callParticipants, selectedDevices, switchDevicesOnCall, presenter } = useCall();
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [remoteParticipant, setRemoteParticipant] = useState<Participant>(null)

    useEffect(() => {
        console.error('on call screen rendered.');
    }, []);


    useEffect(() => {
        console.log(`try to switch devices, selectedDevices triggered `, localParticipant.stream.getTracks());
        switchDevicesOnCall();
    }, [localParticipant, selectedDevices, switchDevicesOnCall]);

    useEffect(() => {
        setSelectedParticipant(localParticipant);
    }, [localParticipant]);

    useEffect(() => {
        if (presenter && presenter.stream) {
            setSelectedParticipant(presenter);
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

    const handleSelectParticipantVideo = (participant: Participant) => {
        console.warn(`handleSelectParticipantVideo- ${participant.displayName}, tracks:`, participant.stream.getTracks());

        if (presenter) {
            console.warn("presenter already presenting");
            return;
        }

        if (localParticipant == participant) {
            console.warn("cannot select self");
            return;
        }


        if (participant.stream) {

            let videoTrack = participant.stream.getVideoTracks()[0]
            if (!videoTrack) {
                console.warn(`not video track for ${participant.displayName}`);
                return;
            }

            if (videoTrack.enabled && !videoTrack.muted && videoTrack.readyState === "live") {
                setSelectedParticipant(participant);

                const videoEl = document.createElement("video");
                videoEl.autoplay = true;
                videoEl.playsInline = true;
                videoEl.muted = true;
                videoEl.style.width = "100%";

                videoEl.srcObject = participant.stream;
                const container = document.getElementById("video-container");
                if (container) {
                    container.appendChild(videoEl);
                }


            } else {
                console.warn(`video track not enabled, muted or ended:`, videoTrack, videoTrack.enabled, !videoTrack.muted, videoTrack.readyState);
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

            <div id="video-container"></div>

            <div className="pt-5">
                <div style={{
                    paddingTop: '8px',
                    height: 'calc(100vh - 56px)',
                    overflow: 'auto',
                }}>
                    <Container fluid className="p-0 m-0 h-100">
                        {callParticipants.size === 1 ? (
                            // One participant - waiting screen
                            <div className="d-flex flex-column justify-content-center align-items-center h-100">
                                <div style={{ width: '60%', maxWidth: '600px' }}>
                                    <ParticipantVideoPreview onClick={() => { }} isSelected={true}
                                        key={1}
                                        participant={localParticipant}></ParticipantVideoPreview>
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
                                        onClick={() => handleSelectParticipantVideo(remoteParticipant)}
                                        isSelected={selectedParticipant === remoteParticipant}
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
                                        onClick={() => handleSelectParticipantVideo(localParticipant)}
                                        isSelected={selectedParticipant === localParticipant}
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
                            presenter ? (
                                // Presenter view
                                <div className="d-flex flex-column h-100">

                                    <div style={{ flex: '1 1 auto', overflow: 'hidden' }}>
                                        <MainVideo />
                                    </div>

                                    <div
                                        className="d-flex flex-row overflow-auto p-2"
                                        style={{
                                            background: '#2a2f34',
                                            borderTop: '1px solid #444'
                                        }}
                                    >
                                        <ParticipantsPane
                                            onSelectVideo={handleSelectParticipantVideo}
                                            containerStyle={{
                                                display: 'flex',
                                                flexDirection: 'row',
                                                flexWrap: 'wrap', // Enable wrapping based on available width
                                                gap: '8px',
                                                padding: '8px',
                                                background: '#2a2f34',
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                justifyContent: 'flex-start', // Align left to reduce space between elements
                                                overflowX: 'hidden', // Prevent horizontal scrolling; let wrapping handle it             
                                            }}
                                            cardStyle={{
                                                flex: '0 0 160px', // Fixed basis for consistent width
                                                aspectRatio: "4/3",
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                // No presenter → participants left to right
                                <div
                                    className="d-flex flex-row flex-wrap h-100 p-2"
                                    style={{ background: '#2a2f34', gap: '8px' }}
                                >
                                    <ParticipantsPane
                                        onSelectVideo={handleSelectParticipantVideo}
                                        containerStyle={
                                            {
                                                display: 'flex',
                                                flexDirection: 'row',
                                                flexWrap: 'wrap', // Enable wrapping based on available width
                                                gap: '8px',
                                                padding: '8px',
                                                background: '#2a2f34',
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                justifyContent: 'center', // Align items to the start; change to 'center' if preferred
                                                overflowX: 'hidden', // Prevent horizontal scrolling; let wrapping handle it            

                                            }
                                        }
                                        cardStyle={
                                            {
                                                // flex: '1 0 auto', // Allow growing but not shrinking below minWidth
                                                //width: '320px', // Minimum width before wrapping
                                                //height: '240px', // Keep fixed height for consistency
                                                justifyContent: 'center'
                                            }
                                        }
                                    />
                                </div>
                            )
                        ) : (<></>)}
                    </Container>
                </div>
            </div>

            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
        </div>
    );
};

export default OnCallScreen;