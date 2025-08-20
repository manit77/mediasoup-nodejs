import React, { useEffect, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import CallTopMenu from './CallTopMenu';
import ParticipantsPane from './ParticipantsPane';
import PresenterVideo from './PresenterVideo';
import SettingsPopup from '../popups/SettingsPopup';
import { useCall } from '../../hooks/useCall';
import { Navigate } from 'react-router-dom';
import { Participant } from '@conf/conf-client';
import { relative } from 'path';
import { conferenceClient } from '../../contexts/CallContext';
import { ParticipantVideoPreview } from './ParticipantVideoPreview';
import { conferenceLayout } from '@conf/conf-models';

const OnCallScreen: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const { conference, localParticipant, isCallActive, callParticipants, selectedDevices, switchDevicesOnCall, presenter, onConferencePing, conferencePong } = useCall();
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [remoteParticipant, setRemoteParticipant] = useState<Participant>(null)
    const localVideoPreview = React.useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState<conferenceLayout>("auto");

    useEffect(() => {
        console.error('on call screen rendered. layout ', conference.conferenceConfig.layout);
        if (conference.conferenceConfig.layout) {
            setLayout(conference.conferenceConfig.layout);
        }

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
            console.log(`no presenter stream`);
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
        console.log(`handleSelectParticipantVideo- ${participant.displayName}, tracks:`, participant.stream.getTracks());

        // if (presenter) {
        //     console.log("presenter already presenting");
        //     return;
        // }

        // if (localParticipant == participant) {
        //     if (localVideoPreview.current) {
        //         if (localVideoPreview.current.style.height == "50px") {
        //             localVideoPreview.current.style.height = "240px";
        //         } else {
        //             localVideoPreview.current.style.height = "50px";
        //         }
        //     }

        //     return;
        // }


        let videoTrack = participant.stream.getVideoTracks()[0]
        if (!videoTrack) {
            console.log(`not video track for ${participant.displayName}`);
            return;
        }


        setSelectedParticipant(participant);

        // code to debug black screen, sometimes react video element goes black, may have to create an html video element and inject it                
        // const videoEl = document.createElement("video");
        // videoEl.autoplay = true;
        // videoEl.playsInline = true;
        // videoEl.muted = true;
        // videoEl.style.width = "100%";

        // videoEl.srcObject = participant.stream;
        // const container = document.getElementById("test-video-container");
        // if (container) {
        //     container.appendChild(videoEl);
        // }


    };

    useEffect(() => {
        conferencePong();
    }, [onConferencePing]);

    if (!isCallActive && !localParticipant.stream && callParticipants.size === 0) { // Check if call ended/not properly started
        console.log("OnCallScreen: No active call, redirecting.");
        return <Navigate to="/app" />;
    }

    return (
        <div className="d-flex flex-column bg-dark text-light" style={{ height: "100dvh" }}>
            <CallTopMenu onShowSettings={() => setShowSettings(true)} />

            {/* <div id="test-video-container" style={{ width: "50px", height: "50px" }}></div> */}

            <div className="pt-5">
                <div style={{
                    paddingTop: '8px',
                    height: 'calc(100dvh - 56px)',
                    overflow: 'auto',
                }}>
                    <Container fluid className="p-0 m-0 h-100">
                        {callParticipants.size === 1 ? (
                            // One participant - waiting screen

                            <div className="d-flex flex-column h-100 align-items-center justify-content-center text-center" style={{ minHeight: "0" }}>
                                <p className="mt-3 fs-5">Waiting for other participants...</p>
                                <div
                                    style={{
                                        flex: '1 1 auto',
                                        width: '100%',
                                        minHeight: '0',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <ParticipantVideoPreview
                                        onClick={() => handleSelectParticipantVideo(localParticipant)}
                                        isSelected={selectedParticipant === remoteParticipant}
                                        key={localParticipant.participantId}
                                        participant={localParticipant}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain', // Ensure video scales without cropping
                                        }}
                                    />
                                </div>
                            </div>

                        ) : (layout == "presenter" || presenter) ? (
                            // Presenter view
                            <div className="d-flex flex-column h-100" style={{ minHeight: "0" }}>

                                {/* presenter video */}
                                <div style={{ flex: '1 1 auto', overflow: 'hidden' }}>
                                    <PresenterVideo presenter={presenter} />
                                </div>

                                {/* participants list */}
                                <div
                                    className="d-flex flex-row overflow-auto p-2"
                                    style={{
                                        background: '#2a2f34',
                                        borderTop: '1px solid #444',
                                        minHeight: "170px"
                                    }}
                                >
                                    <ParticipantsPane
                                        localParticipant={localParticipant}
                                        participants={[...callParticipants.values()]}
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
                        ) :
                            (layout == "auto") && callParticipants.size === 2 && remoteParticipant ? (
                                // Two participants - PiP layout
                                <div className="d-flex flex-column h-100" style={{ minHeight: "0" }}>
                                    {/* Remote */}
                                    <div
                                        style={{
                                            flex: '1 1 auto',
                                            width: '100%',
                                            minHeight: '0',              // also important in Safari
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
                                    <div ref={localVideoPreview}
                                        style={{
                                            position: 'absolute',
                                            bottom: '60px',
                                            right: '10px',
                                            width: '320px',
                                            height: '240px', // 4:3 aspect ratio for PiP
                                            // border: '2px solid #000',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            background: "transparent",
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
                            ) : (
                                // No presenter → participants left to right
                                <div
                                    className="d-flex flex-row flex-wrap h-100 p-2"
                                    style={{ background: '#2a2f34', gap: '8px' }}
                                >
                                    <ParticipantsPane
                                        localParticipant={localParticipant}
                                        participants={[...callParticipants.values()]}
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
                                                //flex: '0 0 160px', // Fixed basis for consistent width
                                                maxHeight: "480px",
                                                aspectRatio: "4/3",
                                                justifyContent: 'center'
                                            }
                                        }
                                    />
                                </div>
                            )
                        }
                    </Container>
                </div>
            </div >

            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
        </div >
    );
};

export default OnCallScreen;