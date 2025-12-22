import React, { useEffect, useState } from 'react';
import CallTopMenu from './CallTopMenu';
import ParticipantsPane from './ParticipantsPane';
import PresenterVideo from './PresenterVideo';
import SettingsPopup from '@client/components/popups/SettingsPopup';
import { useCall } from '@client/hooks/useCall';
import { Navigate } from 'react-router-dom';
import { Participant } from '@conf/conf-client';
import { conferenceLayout } from '@conf/conf-models';

const OnCallScreen: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const { conference, localParticipant, isCallActive, callParticipants, selectedDevices, switchDevicesOnCall, presenter, onConferencePing, conferencePong } = useCall();
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [remoteParticipant, setRemoteParticipant] = useState<Participant>(null)
    const localVideoPreview = React.useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState<conferenceLayout>("auto");

    useEffect(() => {
        console.warn('on call screen rendered. layout ', conference.conferenceConfig.layout);
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
        console.log("OnCallScreen: conferencePong.");
        conferencePong();
    }, [onConferencePing]);

    if (!isCallActive && !localParticipant.stream && callParticipants.size === 0) { // Check if call ended/not properly started
        console.log("OnCallScreen: No active call, redirecting.");
        return <Navigate to="/app" />;
    }

    return (
        <div className="d-flex flex-column bg-dark text-light" style={{ height: "100dvh", overflow: "hidden" }}>
            {/* 1. Top Menu: Takes only required height */}
            <CallTopMenu onShowSettings={() => setShowSettings(true)} />

            {/* 2. Main Body: Grows to fill all remaining vertical space */}
            <div className="flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>

                {/* 3. Presenter Section: If present, grows. If not, disappears. */}
                {presenter && (
                    <div style={{ flex: '1 1 auto', overflow: 'hidden', minHeight: 0 }}>
                        <PresenterVideo presenter={presenter} />
                    </div>
                )}

                {/* 4. Participants Section: 
             - Fixed height (160px) when someone is presenting.
             - Full height (flex-grow-1) when no one is presenting. 
        */}
                <div
                    className="d-flex"
                    style={
                        presenter ? {
                            background: "#2a2f34",
                            borderTop: "1px solid #444",
                            height: "160px",
                            flexShrink: 0,
                        } : {
                            flex: '1 1 auto',
                            minHeight: 0,
                        }
                    }
                >
                    <ParticipantsPane
                        localParticipant={localParticipant}
                        participants={[...callParticipants.values()]}
                        onSelectVideo={handleSelectParticipantVideo}
                        containerStyle={{
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: '5px',
                            background: '#2a2f34',
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box',
                            justifyContent: 'center',
                            alignItems: 'center', // Vertically centers cards
                            overflowY: 'auto',
                        }}
                        cardStyle={
                            presenter
                                ? {
                                    height: "100%",
                                    aspectRatio: "4/3",
                                    padding: "5px"
                                }
                                : {
                                    flex: "1 1 auto",
                                    height: "100%", // Fills the container height
                                    maxHeight: "100%",
                                    justifyContent: "center",
                                    display: 'flex',
                                    alignItems: 'center'
                                }
                        }
                        localParticipantStyle={
                            presenter ? {} :
                                callParticipants.size === 2 ? {
                                    position: "absolute",
                                    zIndex: 9999,
                                    width: "240px",
                                    aspectRatio: "4/3",
                                    bottom: "20px",
                                    right: "20px",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                } : {
                                    flex: "1 1 auto",
                                    height: "100%",
                                }
                        }
                    />
                </div>
            </div>

            <SettingsPopup show={showSettings} handleClose={() => setShowSettings(false)} />
        </div>
    );
};

export default OnCallScreen;