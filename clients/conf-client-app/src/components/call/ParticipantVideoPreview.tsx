import { Participant, isAudioAllowedFor, getBrowserUserMedia, isVideoAllowedFor } from "@conf/conf-client";
import React, { useState, useEffect, useCallback } from "react";
import { Card } from "react-bootstrap";
import { CameraVideoOffFill, MicFill, MicMuteFill, CameraVideoFill } from "react-bootstrap-icons";
import { conferenceClient } from "../../contexts/CallContext";
import { useAPI } from "../../hooks/useAPI";
import { useCall } from "../../hooks/useCall";
import { useUI } from "../../hooks/useUI";
import ThrottledButton from "../layout/ThrottledButton";
import VideoPlayer from "./VideoPlayer";

const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

interface ParticipantVideoPreviewProps {
    participant?: Participant
    onClick: (participant: Participant) => void;
    isSelected?: boolean;
    style?: React.CSSProperties;
}

export const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({ participant, onClick, isSelected, style }) => {
    const api = useAPI();
    const ui = useUI();
    const { localParticipant, broadCastTrackInfo, conference, muteParticipantTrack, getMediaConstraints } = useCall();
    // const videoRef = React.useRef<HTMLVideoElement>(null);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const videoStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'contain', // Ensure video scales without cropping
        background: '#333',
    };

    useEffect(() => {

        if (containerRef.current && participant.videoEle) {
            if (!containerRef.current.contains(participant.videoEle)) {
                
                participant.videoEle.muted = !!(localParticipant.participantId === participant.participantId);
                Object.assign(participant.videoEle.style, videoStyle);
                containerRef.current.innerHTML = "";
                containerRef.current.appendChild(participant.videoEle);

                participant.videoEle.srcObject = participant.stream;
                console.warn(`videoEle added ${participant.displayName}`);

            } else {
                console.warn(`videoEle already ${participant.displayName}`);
            }
        } else {
            console.warn(`videoEle null context ${participant.displayName}`);
        }
    }, [participant]);


    useEffect(() => {
        console.warn(`participant updated, set video srcObject ${participant.displayName}`, participant.tracksInfo);
        setAudioEnabled(participant.tracksInfo.isAudioEnabled);
        setVideoEnabled(participant.tracksInfo.isVideoEnabled);
    }, [participant.tracksInfo]);

    const onAudioClick = useCallback(async () => {
        console.log(`onAudioClick.`);

        let audioAllowedFor = isAudioAllowedFor(conference, participant);
        if (!audioAllowedFor) {
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
        const currentEnabled = audioTrack ? audioTrack.enabled : false;
        const newEnabled = !currentEnabled;

        if (isLocalParticipant && !audioTrack) {
            //there is no audio track published, set the isAudioEnabled to true
            localParticipant.tracksInfo.isAudioEnabled = true;

            //get a new stream for the local participant
            let newStream = await getBrowserUserMedia(getMediaConstraints(true, false));
            audioTrack = newStream.getAudioTracks()[0];
            if (audioTrack) {
                conferenceClient.publishTracks([audioTrack]);
            } else {
                console.error(`no audio track to publish`);
            }
        }

        if (!isLocalParticipant && !audioTrack) {
            console.warn(`remote participant does not have their audio enabled.`);
            ui.showToast(`participant does not have their audio enabled.`);
            return;
        }

        // Prevent enabling the mic for a guest if not allowed
        if (newEnabled && targetIsGuest && !conference.conferenceConfig.guestsAllowMic) {
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
        if (!videoAllowedFor) {
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
        const currentEnabled = videoTrack ? videoTrack.enabled : false;
        const newEnabled = !currentEnabled;

        if (isLocalParticipant && !videoTrack) {
            //get a new stream for the local participant
            localParticipant.tracksInfo.isVideoEnabled = true;
            let newStream = await getBrowserUserMedia(getMediaConstraints(false, true));
            videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack) {
                conferenceClient.publishTracks([videoTrack]);
            } else {
                console.error(`no video track to publish`);
            }
        }

        if (!isLocalParticipant && !videoTrack) {
            console.warn(`remote participant does not have their video enabled.`);
            ui.showToast(`participant does not have their video enabled.`);
            return;
        }

        // Prevent enabling the camera for a guest if not allowed
        if (newEnabled && targetIsGuest && !conference.conferenceConfig.guestsAllowCamera) {
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
        <Card
            onClick={() => { onClick(participant); }}
            className={`participant-preview ${isSelected ? 'border-primary' : ''}`}
            style={{
                position: 'relative', // For positioning the content inside
                cursor: 'pointer',
                margin: 0, // Remove default Card margins
                border: 'none', // Remove default Card border to avoid extra space
                //width: '100%',
                // height: '100%',
                background: '#333',
                aspectRatio: '16/9', // Set a 16:9 aspect ratio
                ...style,
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden', // Ensure no overflow within the Card
                }}
            >

                {/* <VideoPlayer stream={participant.stream} /> */}

                <div ref={containerRef} style={{
                    background: "#000",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    ...style,
                }} />


                {/* <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={localParticipant.participantId === participant.participantId}

                    onError={(event: React.SyntheticEvent<HTMLVideoElement, Event>) => {

                        const videoElement = event.target as HTMLVideoElement;
                        const mediaError = videoElement.error; // Access MediaError
                        console.error(`Video render error for ${participant.displayName}`, {
                            errorCode: mediaError?.code,
                            errorMessage: mediaError?.message,
                            readyState: videoElement.readyState,
                            networkState: videoElement.networkState,
                            streamActive: participant.stream?.active,
                            streamTracks: participant.stream?.getTracks().map((track) => ({
                                kind: track.kind,
                                enabled: track.enabled,
                                readyState: track.readyState,
                            })),
                        });
                    }}

                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain', // Ensure video scales without cropping
                        background: '#333',
                        ...style, // Merge external styles
                    }}
                />
                 */}
                {!videoEnabled ? (
                    <div
                        className="d-flex align-items-center justify-content-center"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: '#444',
                        }}
                    >
                        {participant == localParticipant ? "your" : `${participant.displayName}'s`} video is off
                        <CameraVideoOffFill size={30} />
                    </div>
                ) : null}

                <div
                    className="bg-dark bg-opacity-50 text-white px-2 py-1"
                    style={{
                        position: 'absolute',
                        bottom: '5px',
                        left: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        width: 'calc(100% - 5px)', // Match video width minus padding
                        justifyContent: 'space-between',
                        background: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background for visibility
                        padding: '5px',
                        borderRadius: '4px',
                    }}
                >
                    <small>
                        {participant.displayName} {localParticipant.participantId === participant.participantId && '(You)'}
                    </small>
                    <div>
                        <ThrottledButton onClick={onAudioClick} style={{
                            backgroundColor: '#444',
                            borderColor: '#444',
                            margin: '3px',
                        }}>
                            {audioEnabled ? <MicFill color="lightgreen" /> : <MicMuteFill color="red" />}
                        </ThrottledButton>
                        <ThrottledButton onClick={onVideoClick} style={{
                            backgroundColor: '#444',
                            borderColor: '#444'
                        }}>
                            {videoEnabled ? <CameraVideoFill color="lightgreen" /> : <CameraVideoOffFill color="red" />}
                        </ThrottledButton>
                    </div>
                </div>
            </div>
        </Card>
    );
};