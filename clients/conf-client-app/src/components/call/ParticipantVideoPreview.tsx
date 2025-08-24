import { Participant, isAudioAllowedFor, getBrowserUserMedia, isVideoAllowedFor } from "@conf/conf-client";
import React, { useState, useEffect, useCallback } from "react";
import { Card } from "react-bootstrap";
import { CameraVideoOffFill, MicFill, MicMuteFill, CameraVideoFill } from "react-bootstrap-icons";
import { conferenceClient } from "../../contexts/CallContext";
import { useAPI } from "../../hooks/useAPI";
import { useCall } from "../../hooks/useCall";
import { useUI } from "../../hooks/useUI";
import ThrottledButton from "../layout/ThrottledButton";

const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

interface ParticipantVideoPreviewProps {
    participant: Participant
    onClick: (participant: Participant) => void;
    isSelected?: boolean;
    style?: React.CSSProperties;
}

export const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({ participant, onClick, isSelected, style }) => {
    const api = useAPI();
    const ui = useUI();
    const { localParticipant, broadCastTrackInfo, conference, muteParticipantTrack, getMediaConstraints } = useCall();
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const videoContainerRef = React.useRef<HTMLDivElement>(null);

    const videoStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'contain', // Ensure video scales without cropping
        background: '#333',
    };

    //this loads once, since we always have to stream, and video element for the participant
    const localParticipantId = localParticipant.participantId;

    useEffect(() => {
        console.warn(`attach video triggered. ${participant.displayName}`);

        if (!videoContainerRef.current) {
            console.warn(`-- attach video triggered, no videoContainerRef ${participant.displayName}`);
            return;
        }

        // This function will now be stable and not redefined on every render
        const attachVideo = () => {
            if (videoContainerRef.current && participant.videoEle) {

                // Attach the video element to the container if it's not already there
                if (!videoContainerRef.current.contains(participant.videoEle)) {
                    // Clear previous children to be safe, though appendChild moves the element
                    videoContainerRef.current.innerHTML = "";
                    videoContainerRef.current.appendChild(participant.videoEle);
                }

                // Mute the video element if it belongs to the local user
                participant.videoEle.muted = localParticipantId === participant.participantId;

                // Assign standard styles
                Object.assign(participant.videoEle.style, videoStyle);

                // Ensure the srcObject is correctly set
                if (participant.videoEle.srcObject !== participant.stream) {
                    participant.videoEle.srcObject = participant.stream;
                }

                // Attempt to play the video, catching any errors
                participant.videoEle.play().catch(err => {
                    console.error(`Autoplay failed for ${participant.displayName}:`, err);
                });

            } else {
                console.log(`Video element or container ref is missing for ${participant.displayName}`);
            }
        };

        attachVideo();

        setAudioEnabled(participant.tracksInfo.isAudioEnabled);
        setVideoEnabled(participant.tracksInfo.isVideoEnabled);

        // CRITICAL: Cleanup function to run when the component unmounts
        // This removes the video element to prevent it from playing in the background
        return () => {
            console.warn(`dispose video triggered.`);
            if (videoContainerRef.current && participant.videoEle && videoContainerRef.current.contains(participant.videoEle)) {
                videoContainerRef.current.removeChild(participant.videoEle);
            }
        };

    }, [participant]);

    useEffect(() => {
        console.warn(`attach video triggered, tracksInfo updated`, participant.tracksInfo);
        setAudioEnabled(participant.tracksInfo.isAudioEnabled);
        setVideoEnabled(participant.tracksInfo.isVideoEnabled);
    }, [participant.tracksInfo]);

    const onAudioClick = useCallback(async (event) => {
        console.log(`onAudioClick.`);

        event.preventDefault();
        event.stopPropagation();

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
                conferenceClient.publishTracks([audioTrack], "onAudioClick");
            } else {
                console.error(`no audio track to publish`);
            }
        }

        if (!isLocalParticipant && !audioTrack) {
            console.log(`remote participant does not have their audio enabled.`);
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
    }, []);

    const onVideoClick = useCallback(async (event) => {
        console.log("onVideoClick ", participant);

        event.preventDefault();
        event.stopPropagation();


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
                conferenceClient.publishTracks([videoTrack], "onVideoClick");
            } else {
                console.error(`no video track to publish`);
            }
        }

        if (!isLocalParticipant && !videoTrack) {
            console.log(`remote participant does not have their video enabled.`);
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
    }, []);

    const toggleFullscreen = (ele: HTMLElement) => {
        if (!document.fullscreenElement) {
            ele.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <Card
            onClick={() => { toggleFullscreen(videoContainerRef.current); }}
            //onClick={() => { onClick(participant); }}
            className={`participant-preview`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                background: '#333',
                ...style,
            }}
        >
            {/* Video section */}
            <div
                style={{
                    flex: 1,
                    position: 'relative',
                    width: '100%',
                    overflow: 'hidden',
                    justifyContent: "center",
                }}
            >
                <div
                    ref={videoContainerRef}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                />

                {!videoEnabled && (
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
                        {participant === localParticipant ? "your" : `${participant.displayName}'s`} video is off
                        <CameraVideoOffFill size={30} />
                    </div>
                )}
            </div>

            {/* Name + controls below video */}
            <div
                className="bg-dark bg-opacity-50 text-white px-2 py-1"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '5px',
                    whiteSpace: 'nowrap',      // prevent wrapping
                    overflow: 'hidden',        // hide overflow
                }}
            >
                <small
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flexShrink: 1, // allow name to shrink instead of wrapping
                    }}
                >
                    {participant.displayName}{" "}
                    {localParticipant.participantId === participant.participantId && '(You)'}
                </small>
                <div style={{ flexShrink: 0 }}> {/* keep buttons together */}
                    <ThrottledButton
                        onClick={onAudioClick}
                        style={{ backgroundColor: '#444', borderColor: '#444', margin: '3px' }}
                    >
                        {audioEnabled ? <MicFill color="lightgreen" /> : <MicMuteFill color="red" />}
                    </ThrottledButton>
                    <ThrottledButton
                        onClick={onVideoClick}
                        style={{ backgroundColor: '#444', borderColor: '#444' }}
                    >
                        {videoEnabled ? <CameraVideoFill color="lightgreen" /> : <CameraVideoOffFill color="red" />}
                    </ThrottledButton>
                </div>
            </div>

        </Card>

    );
};