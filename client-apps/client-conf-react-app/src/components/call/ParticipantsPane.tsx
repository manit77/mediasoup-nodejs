import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAPI } from '../../hooks/useAPI';
import { MicFill, MicMuteFill, CameraVideoFill, CameraVideoOffFill } from 'react-bootstrap-icons';
import { conferenceClient, getBrowserUserMedia, isAudioAllowedFor, isVideoAllowedFor, Participant } from '@conf/conf-client';
import { useUI } from '../../hooks/useUI';

interface ParticipantVideoPreviewProps {
    participant?: Participant
    onClick: () => void;
    isSelected?: boolean;
}

const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({ participant, onClick, isSelected }) => {
    const api = useAPI();
    const ui = useUI();
    const { localParticipant, broadCastTrackInfo, conference, callParticipants, muteParticipantTrack, getMediaConstraints } = useCall();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);

    useEffect(() => {
        console.log(`participant updated, set video srcObject ${participant.displayName}`, participant.tracksInfo);
        if (participant.stream && videoRef.current) {
            videoRef.current.srcObject = participant.stream;
            console.log(`videoRef set srcObject ${participant.displayName}`);
        }

        setAudioEnabled(participant.tracksInfo?.isAudioEnabled ?? false);
        setVideoEnabled(participant.tracksInfo?.isVideoEnabled ?? false);

        //check if tracks are in sync
        let audioTrackEnabled = participant.stream.getAudioTracks()[0]?.enabled
        let videoTrackEnabled = participant.stream.getVideoTracks()[0]?.enabled

        if (participant.tracksInfo?.isAudioEnabled !== audioTrackEnabled) {
            console.error(`${participant.displayName} audioTrackEnabled not in sync ${participant.tracksInfo?.isAudioEnabled} ${audioTrackEnabled}`);
        } else {
            console.log(`${participant.displayName} audioTrackEnabled in sync`);
        }

        if (participant.tracksInfo?.isVideoEnabled !== videoTrackEnabled) {
            console.error(`${participant.displayName} videoTrackEnabled not in sync ${participant.tracksInfo?.isVideoEnabled} ${videoTrackEnabled}`);
        } else {
            console.log(`${participant.displayName} videoTrackEnabled in sync`);
        }


    }, [callParticipants]);

    const onAudioClick = useCallback(async () => {
        console.log(`onAudioClick.`);

        let audioAllowedFor = isAudioAllowedFor(conference, participant);
        if(!audioAllowedFor) {
            console.error(`audio is not allowed for ${participant.displayName} ${participant.role}`);
            ui.showToast(`audio not allowed.`);
            return;
        }

        const isLocalParticipant = participant.participantId === localParticipant.participantId;

        // Determine if the target participant (the one being toggled) is a guest
        const targetIsGuest = isLocalParticipant ? !api.isUser() : (participant.role === "guest");

        // Guests cannot mute/unmute remote participants
        if (!isLocalParticipant && !api.isUser()) {
            console.log(`Guests cannot mute/unmute remote participants.`);
            ui.showToast(`Guests cannot mute/unmute remote participants.`);
            return;
        }

        // Get the audio track and current enabled state
        let audioTrack = participant.stream.getAudioTracks()[0];
        if(isLocalParticipant && !audioTrack) {            
            //get a new stream for the local participant
            let newStream = await getBrowserUserMedia(getMediaConstraints(true, false));
            audioTrack = newStream.getVideoTracks()[0];            
            conferenceClient.publishTracks([audioTrack]);
        }

        const currentEnabled = audioTrack ? audioTrack.enabled : false;

        // Calculate the intended new state (toggle)
        const newEnabled = !currentEnabled;

        // Prevent enabling the mic for a guest if not allowed
        if (newEnabled && targetIsGuest && !conference.conferenceRoomConfig.guestsAllowMic) {
            console.log(`Cannot enable mic for guest when not allowed.`);
            ui.showToast(`Cannot enable mic for guest when not allowed.`);
            return;
        }

        // Apply the toggle locally for immediate effect
        if (audioTrack) {
            audioTrack.enabled = newEnabled;
            ui.showToast(`audio track ${newEnabled ? "enabled" : "disabled"}.`);
        }

        setAudioEnabled(audioTrack ? audioTrack.enabled : newEnabled); // Fallback to newEnabled if no track

        // Update the server with the new state
        if (isLocalParticipant) {
            localParticipant.tracksInfo.isAudioEnabled = audioTrack ? audioTrack.enabled : newEnabled;
            console.log(`update tracksInfo.isAudioEnabled to `, localParticipant.tracksInfo.isAudioEnabled);
            broadCastTrackInfo();
        } else {
            // For remote, send the new audio state (video unchanged)
            const isVideoEnabled = participant.stream.getVideoTracks()[0]?.enabled ?? false;
            muteParticipantTrack(participant.participantId, newEnabled, isVideoEnabled);
        }
    }, [api, conference, localParticipant, muteParticipantTrack, participant, ui, broadCastTrackInfo]);

    const onVideoClick = useCallback(async () => {
        console.log("onVideoClick ", participant);

        let videoAllowedFor = isVideoAllowedFor(conference, participant);
        if(!videoAllowedFor) {
            console.error(`video is not allowed for ${participant.displayName} ${participant.role}`);
            ui.showToast(`video not allowed.`);
            return;
        }

        const isLocalParticipant = participant.participantId === localParticipant.participantId;

        // Determine if the target participant (the one being toggled) is a guest
        const targetIsGuest = isLocalParticipant ? !api.isUser() : (participant.role === "guest");

        // Guests cannot mute/unmute remote participants
        if (!isLocalParticipant && !api.isUser()) {
            console.log(`Guests cannot mute/unmute remote participants.`);
            ui.showToast(`Guests cannot mute/unmute remote participants.`);
            return;
        }       

        // Get the video track and current enabled state
        let videoTrack = participant.stream.getVideoTracks()[0];
        if(isLocalParticipant && !videoTrack) {            
            //get a new stream for the local participant
            let newStream = await getBrowserUserMedia(getMediaConstraints(false, true));
            videoTrack = newStream.getVideoTracks()[0];            
            conferenceClient.publishTracks([videoTrack]);
        }

        const currentEnabled = videoTrack ? videoTrack.enabled : false;

        // Calculate the intended new state (toggle)
        const newEnabled = !currentEnabled;

        // Prevent enabling the camera for a guest if not allowed
        if (newEnabled && targetIsGuest && !conference.conferenceRoomConfig.guestsAllowCamera) {
            console.log(`Cannot enable camera for guest when not allowed.`);
            ui.showToast(`Cannot enable camera for guest when not allowed.`);
            return;
        }

        // Apply the toggle locally for immediate effect
        if (videoTrack) {
            videoTrack.enabled = newEnabled;
            ui.showToast(`video track ${newEnabled ? "enabled" : "disabled"}.`);
        }

        setVideoEnabled(videoTrack ? videoTrack.enabled : newEnabled); // Fallback to newEnabled if no track

        // Update the server with the new state
        if (isLocalParticipant) {
            localParticipant.tracksInfo.isVideoEnabled = videoTrack ? videoTrack.enabled : newEnabled;
            console.log(`update tracksInfo.isVideoEnabled to `, localParticipant.tracksInfo.isVideoEnabled);
            broadCastTrackInfo();
        } else {
            // For remote, send the new video state (audio unchanged)
            const isAudioEnabled = participant.stream.getAudioTracks()[0]?.enabled ?? false;
            muteParticipantTrack(participant.participantId, isAudioEnabled, newEnabled);
        }
    }, [api, conference, localParticipant, muteParticipantTrack, participant, ui, broadCastTrackInfo]);

    
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