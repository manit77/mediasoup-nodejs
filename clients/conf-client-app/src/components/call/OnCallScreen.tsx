import React, { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import CallTopMenu from './CallTopMenu';
import ParticipantsPane from './ParticipantsPane';
import PresenterVideo from './PresenterVideo';
import SettingsPopup from '../popups/SettingsPopup';
import { useCall } from '../../hooks/useCall';
import { Navigate } from 'react-router-dom';
import { Participant } from '@conf/conf-client';
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

        let videoTrack = participant.stream.getVideoTracks()[0]
        if (!videoTrack) {
            console.log(`not video track for ${participant.displayName}`);
            return;
        }
        setSelectedParticipant(participant);
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
            <div className="pt-5">
                <div style={{
                    paddingTop: '8px',
                    height: 'calc(100dvh - 56px)',
                    overflow: 'auto',
                }}>
                    <div className="p-0 m-0 h-100 w-full">
                        <div className="d-flex flex-column h-100" style={{ minHeight: "0" }}>

                            {/* presenter video */}
                            <div style={presenter ? { flex: '1 1 auto', overflow: 'hidden' } : { display: "none" }}>
                                <PresenterVideo presenter={presenter} />
                            </div>

                            {/* participants list */}
                            <div
                                className="d-flex flex-row"
                                style={

                                    presenter ? {
                                        background: "#2a2f34",
                                        borderTop: "1px solid #444",
                                        height: "160px",
                                        overflowY: "auto",
                                        flexShrink: 0,
                                        minHeight: 0,
                                    } : {

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
                                        gap: '5px',
                                        padding: '5px',
                                        background: '#2a2f34',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        justifyContent: 'center', // Align left to reduce space between elements
                                        overflowX: 'hidden', // Prevent horizontal scrolling; let wrapping handle it
                                        minHeight: 0,
                                    }}
                                    cardStyle={
                                        presenter
                                            ? {
                                                minHeight: "160px"
                                            }
                                            : callParticipants.size == 1
                                                ? {
                                                    flex: "1 1 auto",
                                                    aspectRatio: "4/3",
                                                    maxHeight: "100%",
                                                    justifyContent: "center",
                                                }
                                                : callParticipants.size == 2 ? {
                                                    flex: "1 1 auto",
                                                    height: 'calc(100dvh - 56px)',
                                                    justifyContent: "center",
                                                }
                                                    : {
                                                        flex: "1 1 auto",
                                                        aspectRatio: "4/3",
                                                        justifyContent: "center",
                                                        minHeight: 0,
                                                        alignSelf: 'flex-start',
                                                    }
                                    }
                                    localParticipantStyle={
                                        presenter ? {} :
                                            callParticipants.size == 1 ? {
                                                flex: "1 1 auto",
                                                aspectRatio: "4/3",
                                                height: 'calc(100dvh - 56px)',
                                                justifyContent: "center",
                                            }
                                                : callParticipants.size == 2 ? {
                                                    position: "absolute",
                                                    zIndex: 9999,
                                                    width: "240px",
                                                    aspectRatio: "4/3",
                                                    bottom: "70px",
                                                    right: "10px",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                                                    borderRadius: "12px",
                                                    overflow: "hidden",
                                                } : {}
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div >

            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
        </div >
    );
};

export default OnCallScreen;