import { Participant, isAudioAllowedFor, getBrowserUserMedia, isVideoAllowedFor } from "@conf/conf-client";
import React, { useState, useEffect } from "react";
import { Card } from "react-bootstrap";
import { CameraVideoOffFill, MicFill, MicMuteFill, CameraVideoFill } from "react-bootstrap-icons";
import { useAPI } from '@client/contexts/APIContext';
import { useCall } from '@client/contexts/CallContext';
import { useUI } from '@client/contexts/UIContext';
import ThrottledButton from "@client/components/ui/ThrottledButton";
import styles from './ParticipantVideoPreview.module.css';
import { getConferenceClient } from "@client/services/ConferenceService";
import { useDevice } from "@client/contexts/DeviceContext";

const conferenceClient = getConferenceClient();

interface ParticipantVideoPreviewProps {
    participant: Participant;
    onClick: (participant: Participant) => void;
    isSelected?: boolean;
    style?: React.CSSProperties;
}

// 2026: No more React.memo wrapping. The Compiler handles it!
export const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({ participant, onClick, isSelected, style }) => {
    const api = useAPI();
    const ui = useUI();
    const call = useCall();
    const { getMediaConstraints } = useDevice();
    
    // We synchronize local state with participant data
    const [videoEnabled, setVideoEnabled] = useState(participant.tracksInfo.isVideoEnabled);
    const [audioEnabled, setAudioEnabled] = useState(participant.tracksInfo.isAudioEnabled);

    // Sync state when props change (The Compiler makes this efficient)
    useEffect(() => {
        setAudioEnabled(participant.tracksInfo.isAudioEnabled);
        setVideoEnabled(participant.tracksInfo.isVideoEnabled);
    }, [participant.tracksInfo]);

    /**
     * REACT 19 CLEANUP REF
     * This replaces the entire "attachVideo" useEffect.
     * It handles mounting, styles, and unmounting in one clean function.
     */
    const videoRef = (node: HTMLDivElement | null) => {
        if (!node) return;

        const video = participant.videoEle;
        if (!video) return;

        // 1. Attach
        if (node.children.length === 0) {
            node.appendChild(video);
        }

        // 2. Style
        Object.assign(video.style, {
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#333',
        });

        // 3. Sync Stream
        if (video.srcObject !== participant.stream) {
            video.srcObject = participant.stream;
        }

        video.play().catch(err => console.error("Video play failed", err));

        // 4. Cleanup (Runs when node unmounts or changes)
        return () => {
            if (video.parentNode === node) {
                node.removeChild(video);
            }
        };
    };

    // 2026: No useCallback! The compiler ensures these functions don't 
    // trigger re-renders unless their internal dependencies change.
    const onAudioClick = async (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (call.localParticipant.role === "guest" && !call.conference.conferenceConfig.guestsAllowDeviceControls) return;

        if (!isAudioAllowedFor(call.conference, participant)) {
            ui.showToast(`audio not allowed.`);
            return;
        }

        const isLocal = participant.participantId === call.localParticipant.participantId;
        let audioTrack = participant.stream.getAudioTracks()[0];
        const newEnabled = !(audioTrack?.enabled ?? audioEnabled);

        if (isLocal && !audioTrack) {
            call.localParticipant.tracksInfo.isAudioEnabled = true;
            const newStream = await getBrowserUserMedia(getMediaConstraints(true, false));
            audioTrack = newStream.getAudioTracks()[0];
            if (audioTrack) conferenceClient.publishTracks([audioTrack], "onAudioClick");
        }

        if (audioTrack) {
            audioTrack.enabled = newEnabled;
            setAudioEnabled(newEnabled);
        }

        if (isLocal) {
            call.localParticipant.tracksInfo.isAudioEnabled = newEnabled;
            call.broadCastTrackInfo();
        } else {
            const isVideoOn = participant.stream.getVideoTracks()[0]?.enabled ?? false;
            call.muteParticipantTrack(participant.participantId, !newEnabled, !isVideoOn);
        }
    };

    const onVideoClick = async (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (call.isScreenSharing) return;

        const isLocal = participant.participantId === call.localParticipant.participantId;
        let videoTrack = participant.stream.getVideoTracks()[0];
        const newEnabled = !(videoTrack?.enabled ?? videoEnabled);

        if (isLocal && !videoTrack) {
            call.localParticipant.tracksInfo.isVideoEnabled = true;
            const newStream = await getBrowserUserMedia(getMediaConstraints(false, true));
            videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack) conferenceClient.publishTracks([videoTrack], "onVideoClick");
        }

        if (videoTrack) {
            videoTrack.enabled = newEnabled;
            setVideoEnabled(newEnabled);
        }

        if (isLocal) {
            call.localParticipant.tracksInfo.isVideoEnabled = newEnabled;
            call.broadCastTrackInfo();
        } else {
            const isAudioOn = participant.stream.getAudioTracks()[0]?.enabled ?? false;
            call.muteParticipantTrack(participant.participantId, !isAudioOn, !newEnabled);
        }
    };

    return (
        <Card className={`${styles.participantCard} participant-preview`} style={style}>
            <div className={styles.videoSection}>
                <div ref={videoRef} className={styles.videoContainer} />
                {!videoEnabled && (
                    <div className={styles.videoOffPlaceholder}>
                        {participant === call.localParticipant ? "your" : `${participant.displayName}'s`} video is off
                        <CameraVideoOffFill size={30} className="ms-2" />
                    </div>
                )}
            </div>

            <div className={styles.controlsBar}>
                <small className={styles.nameText}>
                    {participant.displayName} {participant === call.localParticipant && '(You)'}
                </small>

                <div className={styles.buttonGroup}>
                    <ThrottledButton onClick={onAudioClick} className={`${styles.throttledBtn} ${styles.audioBtn}`}>
                        {audioEnabled ? <MicFill color="lightgreen" /> : <MicMuteFill color="red" />}
                    </ThrottledButton>

                    <ThrottledButton onClick={onVideoClick} className={styles.throttledBtn}>
                        {videoEnabled ? <CameraVideoFill color="lightgreen" /> : <CameraVideoOffFill color="red" />}
                    </ThrottledButton>
                </div>
            </div>
        </Card>
    );
};