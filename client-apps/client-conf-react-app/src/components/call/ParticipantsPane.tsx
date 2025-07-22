import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAPI } from '../../hooks/useAPI';
import { MicFill, MicMuteFill, CameraVideoFill, CameraVideoOffFill } from 'react-bootstrap-icons';
import { Participant } from '@conf/conf-client';
import { useUI } from '../../hooks/useUI';

interface ParticipantVideoPreviewProps {
    participant?: Participant
    onClick: () => void;
    isSelected?: boolean;
}

const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({ participant, onClick, isSelected }) => {
    const api = useAPI();
    const ui = useUI();
    const { localParticipant, getLocalMedia, updateTrackEnabled, conferenceRoom, callParticipants, muteParticipantTrack } = useCall();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);

    useEffect(() => {
        console.warn(`participant updated, set video srcObject ${participant.displayName}`);
        if (participant.stream && videoRef.current) {
            videoRef.current.srcObject = participant.stream;
            console.warn(`set srcObject ${participant.displayName}`);
        }

        if (participant.stream) {
            console.warn(`participant tracks:`, participant.stream.getTracks());

            let audioTrack = participant.stream.getAudioTracks()[0];
            if (audioTrack) {
                setAudioEnabled(audioTrack.enabled);
                console.warn(`audioTrack.enabled`, audioTrack.enabled);
            }

            let videoTrack = participant.stream.getVideoTracks()[0];
            if (videoTrack) {
                setVideoEnabled(videoTrack.enabled);
                console.warn(`videoTrack.enabled`, videoTrack.enabled);
            }
        } else {
            console.warn(`not participant stream ${participant.displayName}`);
        }

    }, [participant, callParticipants]);

    const onVideoClick = useCallback(async () => {
        console.log("onVideoClick ", participant);

        //toggle local participant
        if (localParticipant.participantId === participant.participantId) {

            if (!api.isUser() && !conferenceRoom.conferenceRoomConfig.guestsAllowCamera) {
                console.log(`camera not allowed for guests.`);
                return;
            }

            if (participant.stream == null) {
                console.log("participant stream is null, get user media");
                await getLocalMedia();
                participant.stream = localParticipant.stream;
                setVideoEnabled(participant.stream.getVideoTracks()[0]?.enabled ?? false);
                setAudioEnabled(participant.stream.getAudioTracks()[0]?.enabled ?? false);

                if (videoRef.current) {
                    videoRef.current.srcObject = participant.stream;
                }
                return;
            }
        }

        //toggle video track, this affects the local stream only
        console.warn(`toggle video track`);

        let track = participant.stream.getVideoTracks()[0];
        if (!track) {
            console.warn(`no video track found.`);
            ui.showToast("not video track found.");
            return;
        }
        console.warn(`audio video enabled: ${track.enabled}`);

        let isVideoEnabled = participant.stream.getVideoTracks()[0]?.enabled;
        console.warn(`isVideoEnabled ${isVideoEnabled} change to ${!isVideoEnabled}`);
        track.enabled = !isVideoEnabled;
        setVideoEnabled(track.enabled);

        console.warn(`track.enabled:`, track.enabled);
        if (track.enabled) {
            ui.showToast("video track enabled.");
        } else {
            ui.showToast("video track disabled.");
        }

        if (localParticipant.participantId === participant.participantId) {
            //if local participant
            //toggle track on the server
            updateTrackEnabled(track);

        } else {
            //if remote user            
            if (api.isUser()) {
                //an authorized user can mute another participant
                muteParticipantTrack(participant.participantId, audioEnabled, videoEnabled)
            }
        }

    }, [api, audioEnabled, conferenceRoom, getLocalMedia, localParticipant, muteParticipantTrack, participant, ui, updateTrackEnabled, videoEnabled]);

    const onAudioClick = useCallback(async () => {
        console.log("onAudioClick ", participant);

        //if localParticipant
        if (localParticipant.participantId === participant.participantId) {
            console.log(`localParticipant`);

            //if is guest and mic not allowed            
            if (!api.isUser() && !conferenceRoom.conferenceRoomConfig.guestsAllowMic) {
                console.log(`audio not allowed for guests.`);
                return;
            }

            if (participant.stream == null) {
                //get user media
                console.log(`getting localMedia`);
                await getLocalMedia();
                participant.stream = localParticipant.stream;
                setVideoEnabled(participant.stream.getVideoTracks()[0]?.enabled ?? false);
                setAudioEnabled(participant.stream.getAudioTracks()[0]?.enabled ?? false);

                if (videoRef.current) {
                    videoRef.current.srcObject = participant.stream;
                }

                return;
            }
        }

        //toggle audio track of remote participant
        //the local user can always pause tracks of remote participants
        console.log(`toggle audio track`);

        let track = participant.stream.getAudioTracks()[0];
        if (!track) {
            console.log(`no audio track found.`);
            ui.showToast(`no audio track found.`);
            return;
        }
        console.log(`audio track enabled: ${track.enabled}`);

        let isAudioEnabled = participant.stream.getAudioTracks()[0]?.enabled;
        console.log(`isAudioEnabled ${isAudioEnabled} change to ${!isAudioEnabled}`);
        track.enabled = !isAudioEnabled;
        setAudioEnabled(track.enabled);

        if (track.enabled) {
            ui.showToast("audio track enabled.");
        } else {
            ui.showToast("audio track disabled.");
        }

        if (localParticipant.participantId === participant.participantId) {
            //toggle local audio track
            updateTrackEnabled(track);
        } else {
            //TODO: create another function to mute unmute remote participants
            if (api.isUser()) {
                //an authorized user can mute another participant
                muteParticipantTrack(participant.participantId, audioEnabled, videoEnabled)
                ui.showToast(`participant ${track.kind} ${track.enabled ? 'enabled' : 'disabled'}.`);
            }
        }

    }, [api, audioEnabled, conferenceRoom, getLocalMedia, localParticipant, muteParticipantTrack, participant, ui, updateTrackEnabled, videoEnabled]);


    return (
        <Card className={`mb-2 participant-preview ${isSelected ? 'border-primary' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '75%' /* 4:3 Aspect Ratio */ }}>
                <video ref={videoRef} autoPlay playsInline muted={localParticipant.participantId === participant.participantId} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#333' }} />
                {!videoEnabled ? (
                    <div className="d-flex align-items-center justify-content-center" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#444' }}>
                        video is off
                        <CameraVideoOffFill size={30} />
                    </div>
                ) : null}
                <div className="position-absolute bottom-0 start-0 bg-dark bg-opacity-50 text-white px-2 py-1 w-100">
                    <small>{participant.displayName} {localParticipant.participantId === participant.participantId && "(You)"}</small>
                    <>
                        <span className="ms-1" onClick={() => onAudioClick()}>
                            {audioEnabled ? <MicFill color="lightgreen" /> : <MicMuteFill color="red" />}
                        </span>
                        <span className="ms-1" onClick={() => onVideoClick()}>
                            {videoEnabled ? <CameraVideoFill color="lightgreen" /> : <CameraVideoOffFill color="red" />}
                        </span>
                    </>
                </div>
            </div>
        </Card>
    );
};

interface ParticipantsPaneProps {
    onSelectVideo: (userId: string, stream?: MediaStream) => void;
}

const ParticipantsPane: React.FC<ParticipantsPaneProps> = ({ onSelectVideo }) => {
    const { localParticipant, callParticipants } = useCall();
    const { getCurrentUser } = useAPI();

    useEffect(() => {

    }, [getCurrentUser])

    return (
        <div>
            <h5 className="mb-3">Participants ({callParticipants.size})</h5>
            {/* Local User Preview First */}
            {localParticipant && (
                <ParticipantVideoPreview
                    key={localParticipant.participantId}
                    participant={localParticipant}
                    onClick={() => onSelectVideo(localParticipant.participantId, localParticipant.stream)}
                    isSelected={callParticipants.size === 0}
                />
            )}

            {/* Remote Participants */}
            {[...callParticipants.values()]
                .filter(p => p.participantId !== localParticipant.participantId)
                .map((participant) => (
                    <ParticipantVideoPreview
                        key={participant.participantId}
                        participant={participant}
                        onClick={() => onSelectVideo(participant.participantId, participant.stream)}
                        isSelected={false}
                    />
                ))}
        </div>
    );
};

export default ParticipantsPane;