import { Participant, isAudioAllowedFor, getBrowserUserMedia, isVideoAllowedFor } from "@conf/conf-client";
import React, { useState, useEffect, useCallback } from "react";
import { Card } from "react-bootstrap";
import { CameraVideoOffFill, MicFill, MicMuteFill, CameraVideoFill } from "react-bootstrap-icons";
import { conferenceClient } from "../../contexts/CallContext";
import { useAPI } from "../../hooks/useAPI";
import { useCall } from "../../hooks/useCall";
import { useUI } from "../../hooks/useUI";
import ThrottledButton from "../layout/ThrottledButton";
import styles from './ParticipantVideoPreview.module.css';

interface ParticipantVideoPreviewProps {
    participant: Participant;
    onClick: (participant: Participant) => void;
    isSelected?: boolean;
    style?: React.CSSProperties;
}

const ParticipantVideoPreviewComponent: React.FC<ParticipantVideoPreviewProps> = ({ participant, onClick, isSelected, style }) => {
    const api = useAPI();
    const ui = useUI();
    const { localParticipant, broadCastTrackInfo, conference, muteParticipantTrack, getMediaConstraints } = useCall();
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [allowControls, setAllowControls] = useState(true);
    const videoContainerRef = React.useRef<HTMLDivElement>(null);

    const videoStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: '#333',
    };

    const localParticipantId = localParticipant.participantId;

    useEffect(() => {
        console.warn(`attach video triggered. ${participant.displayName}`);

        if (localParticipant.role == "guest") {
            setAllowControls(conference.conferenceConfig.guestsAllowDeviceControls);
        }

        if (!videoContainerRef.current) {
            console.warn(`-- attach video triggered, no videoContainerRef ${participant.displayName}`);
            return;
        }

        const attachVideo = () => {
            if (videoContainerRef.current && participant.videoEle) {

                //if (participant.videoEle && !participant.videoEle.parentElement) {
                if (videoContainerRef.current.children.length == 0) {
                    videoContainerRef.current.appendChild(participant.videoEle);
                }
                //}

                // Mute the video element if it belongs to the local user
                participant.videoEle.muted = localParticipantId === participant.participantId;

                // Assign standard styles
                Object.assign(participant.videoEle.style, videoStyle);

                // Ensure the srcObject is correctly set
                if (participant.videoEle.srcObject !== participant.stream) {
                    participant.videoEle.srcObject = participant.stream;
                }

                // Attempt to play the video, catching any errors
                // participant.videoEle.play().then(() => console.warn(`participant.videoEle playing for ${participant.displayName}`)).catch(err => {
                //     console.error(`participant.videoEle.play() failed for ${participant.displayName}:`, err);
                // });


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
            // if (videoContainerRef.current && participant.videoEle && videoContainerRef.current.contains(participant.videoEle)) {
            //     videoContainerRef.current.removeChild(participant.videoEle);
            // }
        };

    }, []);

    useEffect(() => {
        console.warn(`attach video triggered, tracksInfo updated`, participant.tracksInfo);
        setAudioEnabled(participant.tracksInfo.isAudioEnabled);
        setVideoEnabled(participant.tracksInfo.isVideoEnabled);
    }, [participant.tracksInfo]);

    const onAudioClick = useCallback(async (event) => {
        console.log(`onAudioClick.`);

        event.preventDefault();
        event.stopPropagation();

        if (localParticipant.role == "guest" && !conference.conferenceConfig.guestsAllowDeviceControls) {
            return;
        }

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
            //ui.showToast(`Guests cannot mute/unmute remote participants.`);
            return;
        }

        if (isLocalParticipant && localParticipant.tracksInfo.isAudioMuted) {
            ui.showToast("your audio is muted.");
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
            muteParticipantTrack(participant.participantId, !newEnabled, !isVideoEnabled);
        }
    }, []);

    const onVideoClick = useCallback(async (event) => {
        console.log("onVideoClick ", participant);

        event.preventDefault();
        event.stopPropagation();

        if (localParticipant.role == "guest" && !conference.conferenceConfig.guestsAllowDeviceControls) {
            return;
        }

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
            //ui.showToast(`Guests cannot mute/unmute remote participants.`);
            return;
        }

        if (isLocalParticipant && localParticipant.tracksInfo.isVideoMuted) {
            ui.showToast("your video is muted.");
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
            muteParticipantTrack(participant.participantId, !isAudioEnabled, !newEnabled);
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
            className={`${styles.participantCard} participant-preview`}
            style={style} // Keep external style prop for dynamic positioning
        >
            {/* Video section */}
            <div className={styles.videoSection}>
                <div
                    ref={videoContainerRef}
                    className={styles.videoContainer}
                />

                {!videoEnabled && (
                    <div className={styles.videoOffPlaceholder}>
                        {participant === localParticipant ? "your" : `${participant.displayName}'s`} video is off
                        <CameraVideoOffFill size={30} className="ms-2" />
                    </div>
                )}
            </div>

            {/* Name + controls below video */}
            <div className={styles.controlsBar}>
                <small className={styles.nameText}>
                    {participant.displayName}{" "}
                    {localParticipant.participantId === participant.participantId && '(You)'}
                </small>
                
                <div className={styles.buttonGroup}>
                    <ThrottledButton
                        onClick={onAudioClick}
                        className={`${styles.throttledBtn} ${styles.audioBtn}`}
                    >
                        {audioEnabled ? <MicFill color="lightgreen" /> : <MicMuteFill color="red" />}
                    </ThrottledButton>
                    
                    <ThrottledButton
                        onClick={onVideoClick}
                        className={styles.throttledBtn}
                    >
                        {videoEnabled ? <CameraVideoFill color="lightgreen" /> : <CameraVideoOffFill color="red" />}
                    </ThrottledButton>
                </div>
            </div>
        </Card>

    );
};

export const ParticipantVideoPreview = React.memo(
    ParticipantVideoPreviewComponent,
    (prevProps, nextProps) => {
        // custom equality check
        // only re-render if these change:
        return (
            prevProps.participant.participantId === nextProps.participant.participantId &&
            prevProps.participant.tracksInfo.isAudioEnabled === nextProps.participant.tracksInfo.isAudioEnabled &&
            prevProps.participant.tracksInfo.isVideoEnabled === nextProps.participant.tracksInfo.isVideoEnabled &&
            prevProps.participant.tracksInfo.isAudioMuted === nextProps.participant.tracksInfo.isAudioMuted &&
            prevProps.participant.tracksInfo.isVideoMuted === nextProps.participant.tracksInfo.isVideoMuted &&
            // prevProps.isSelected === nextProps.isSelected &&
            prevProps.style === nextProps.style
        );
    }
);
