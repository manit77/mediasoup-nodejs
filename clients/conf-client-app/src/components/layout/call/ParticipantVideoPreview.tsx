import { Participant, isAudioAllowedFor, getBrowserUserMedia, isVideoAllowedFor } from "@conf/conf-client";
import React, { useState, useEffect, useCallback } from "react";
import { Card } from "react-bootstrap";
import { CameraVideoOffFill, MicFill, MicMuteFill, CameraVideoFill } from "react-bootstrap-icons";
import { conferenceClient } from "@client/contexts/CallContext";
import { useAPI } from "@client/hooks/useAPI";
import { useCall } from "@client/hooks/useCall";
import { useUI } from "@client/hooks/useUI";
import ThrottledButton from "@client/components/ui/ThrottledButton";
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

    const logVideoDebugSnapshot = useCallback((reason: string, explicitVideoElement?: HTMLVideoElement | null) => {
        const container = videoContainerRef.current;
        const videoElement = explicitVideoElement
            ?? participant.videoEle
            ?? (container?.querySelector("video") as HTMLVideoElement | null)
            ?? null;

        const streamFromElement = (videoElement?.srcObject as MediaStream | null) ?? null;
        const stream = streamFromElement ?? participant.stream ?? null;
        const videoTracks = stream?.getVideoTracks() ?? [];
        const audioTracks = stream?.getAudioTracks() ?? [];

        console.log(`[VideoDebug] ${reason}`, {
            participantId: participant.participantId,
            displayName: participant.displayName,
            isLocalParticipant: participant.participantId === localParticipantId,
            hasContainer: !!container,
            childCount: container?.children.length ?? 0,
            hasVideoElement: !!videoElement,
            hasParticipantVideoElement: !!participant.videoEle,
            tracksInfo: participant.tracksInfo,
            elementState: videoElement ? {
                paused: videoElement.paused,
                ended: videoElement.ended,
                readyState: videoElement.readyState,
                networkState: videoElement.networkState,
                currentTime: videoElement.currentTime,
                muted: videoElement.muted,
                autoplay: videoElement.autoplay,
                playsInline: videoElement.playsInline,
                videoWidth: videoElement.videoWidth,
                videoHeight: videoElement.videoHeight,
                clientWidth: videoElement.clientWidth,
                clientHeight: videoElement.clientHeight,
                srcObjectIsParticipantStream: videoElement.srcObject === participant.stream,
            } : null,
            streamState: stream ? {
                id: stream.id,
                active: stream.active,
                videoTrackCount: videoTracks.length,
                audioTrackCount: audioTracks.length,
            } : null,
            videoTracks: videoTracks.map(track => ({
                id: track.id,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
            })),
            audioTracks: audioTracks.map(track => ({
                id: track.id,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
            })),
        });
    }, [localParticipantId, participant]);

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

                logVideoDebugSnapshot("attachVideo:element-attached", participant.videoEle);

                // Attempt to play the video, catching any errors
                // participant.videoEle.play().then(() => console.warn(`participant.videoEle playing for ${participant.displayName}`)).catch(err => {
                //     console.error(`participant.videoEle.play() failed for ${participant.displayName}:`, err);
                // });


            } else {
                console.log(`Video element or container ref is missing for ${participant.displayName}`);
            }
        };

        attachVideo();

        const attachedVideoElement = participant.videoEle
            ?? (videoContainerRef.current?.querySelector("video") as HTMLVideoElement | null)
            ?? null;

        const mediaEventNames = [
            "loadstart",
            "loadedmetadata",
            "loadeddata",
            "canplay",
            "canplaythrough",
            "play",
            "playing",
            "pause",
            "waiting",
            "stalled",
            "suspend",
            "seeking",
            "seeked",
            "ended",
            "emptied",
            "error",
        ] as const;

        const onMediaDebugEvent = (event: Event) => {
            const targetVideoElement = event.currentTarget as HTMLVideoElement | null;
            const eventType = event.type;

            if (eventType === "waiting" || eventType === "stalled" || eventType === "error") {
                console.warn(`[VideoDebug] media-event:${eventType}`, {
                    participantId: participant.participantId,
                    displayName: participant.displayName,
                    mediaError: targetVideoElement?.error
                        ? {
                            code: targetVideoElement.error.code,
                            message: targetVideoElement.error.message,
                        }
                        : null,
                });
            } else {
                console.log(`[VideoDebug] media-event:${eventType}`, {
                    participantId: participant.participantId,
                    displayName: participant.displayName,
                });
            }

            logVideoDebugSnapshot(`media-event:${eventType}`, targetVideoElement);
        };

        mediaEventNames.forEach((eventName) => {
            attachedVideoElement?.addEventListener(eventName, onMediaDebugEvent);
        });

        const stream = participant.stream ?? null;
        const videoTracks = stream?.getVideoTracks() ?? [];
        const audioTracks = stream?.getAudioTracks() ?? [];

        const trackCleanupTasks: Array<() => void> = [];

        const addTrackDebugListeners = (track: MediaStreamTrack, kind: "video" | "audio") => {
            const onTrackMute = () => {
                console.warn(`[VideoDebug] ${kind}-track:mute`, {
                    participantId: participant.participantId,
                    trackId: track.id,
                    label: track.label,
                    readyState: track.readyState,
                    enabled: track.enabled,
                    muted: track.muted,
                });
            };

            const onTrackUnmute = () => {
                console.log(`[VideoDebug] ${kind}-track:unmute`, {
                    participantId: participant.participantId,
                    trackId: track.id,
                    label: track.label,
                    readyState: track.readyState,
                    enabled: track.enabled,
                    muted: track.muted,
                });
            };

            const onTrackEnded = () => {
                console.warn(`[VideoDebug] ${kind}-track:ended`, {
                    participantId: participant.participantId,
                    trackId: track.id,
                    label: track.label,
                    readyState: track.readyState,
                    enabled: track.enabled,
                    muted: track.muted,
                });
                logVideoDebugSnapshot(`${kind}-track:ended`, attachedVideoElement);
            };

            track.addEventListener("mute", onTrackMute);
            track.addEventListener("unmute", onTrackUnmute);
            track.addEventListener("ended", onTrackEnded);

            trackCleanupTasks.push(() => {
                track.removeEventListener("mute", onTrackMute);
                track.removeEventListener("unmute", onTrackUnmute);
                track.removeEventListener("ended", onTrackEnded);
            });
        };

        videoTracks.forEach((track) => addTrackDebugListeners(track, "video"));
        audioTracks.forEach((track) => addTrackDebugListeners(track, "audio"));

        const onStreamAddTrack = (event: MediaStreamTrackEvent) => {
            console.log("[VideoDebug] stream:addtrack", {
                participantId: participant.participantId,
                displayName: participant.displayName,
                kind: event.track.kind,
                trackId: event.track.id,
                label: event.track.label,
            });
            logVideoDebugSnapshot("stream:addtrack", attachedVideoElement);
        };

        const onStreamRemoveTrack = (event: MediaStreamTrackEvent) => {
            console.warn("[VideoDebug] stream:removetrack", {
                participantId: participant.participantId,
                displayName: participant.displayName,
                kind: event.track.kind,
                trackId: event.track.id,
                label: event.track.label,
            });
            logVideoDebugSnapshot("stream:removetrack", attachedVideoElement);
        };

        stream?.addEventListener("addtrack", onStreamAddTrack);
        stream?.addEventListener("removetrack", onStreamRemoveTrack);

        let lastCurrentTime = attachedVideoElement?.currentTime ?? -1;
        const stallWatchIntervalId = window.setInterval(() => {
            if (!attachedVideoElement) {
                return;
            }

            const isPossiblyStalled =
                !attachedVideoElement.paused &&
                !attachedVideoElement.ended &&
                attachedVideoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                attachedVideoElement.currentTime === lastCurrentTime;

            if (isPossiblyStalled) {
                console.warn("[VideoDebug] interval:possible-stall", {
                    participantId: participant.participantId,
                    displayName: participant.displayName,
                    currentTime: attachedVideoElement.currentTime,
                    readyState: attachedVideoElement.readyState,
                    networkState: attachedVideoElement.networkState,
                });
                logVideoDebugSnapshot("interval:possible-stall", attachedVideoElement);
            }

            lastCurrentTime = attachedVideoElement.currentTime;
        }, 3000);

        setAudioEnabled(participant.tracksInfo.isAudioEnabled);
        setVideoEnabled(participant.tracksInfo.isVideoEnabled);

        // CRITICAL: Cleanup function to run when the component unmounts
        // This removes the video element to prevent it from playing in the background
        return () => {
            console.warn(`dispose video triggered.`);
            mediaEventNames.forEach((eventName) => {
                attachedVideoElement?.removeEventListener(eventName, onMediaDebugEvent);
            });

            trackCleanupTasks.forEach((cleanup) => cleanup());

            stream?.removeEventListener("addtrack", onStreamAddTrack);
            stream?.removeEventListener("removetrack", onStreamRemoveTrack);

            window.clearInterval(stallWatchIntervalId);

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

    const onVideoContainerDebugClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const container = videoContainerRef.current;
        const clickedTarget = event.target as HTMLElement | null;

        let videoElement: HTMLVideoElement | null = null;
        if (clickedTarget instanceof HTMLVideoElement) {
            videoElement = clickedTarget;
        } else if (container) {
            videoElement = container.querySelector("video");
        }

        if (!videoElement && participant.videoEle) {
            videoElement = participant.videoEle;
        }

        const streamFromElement = (videoElement?.srcObject as MediaStream | null) ?? null;
        const stream = streamFromElement ?? participant.stream ?? null;
        const videoTracks = stream?.getVideoTracks() ?? [];
        const audioTracks = stream?.getAudioTracks() ?? [];

        console.groupCollapsed(`[VideoDebug] click participant=${participant.displayName} id=${participant.participantId}`);
        console.log("clicked target", {
            tagName: clickedTarget?.tagName,
            className: clickedTarget?.className,
        });
        console.log("container", {
            hasContainer: !!container,
            childCount: container?.children.length,
        });
        console.log("participant", {
            isLocalParticipant: participant.participantId === localParticipantId,
            tracksInfo: participant.tracksInfo,
            hasParticipantStream: !!participant.stream,
            hasParticipantVideoElement: !!participant.videoEle,
        });
        console.log("video element", videoElement ? {
            paused: videoElement.paused,
            ended: videoElement.ended,
            readyState: videoElement.readyState,
            networkState: videoElement.networkState,
            currentTime: videoElement.currentTime,
            muted: videoElement.muted,
            volume: videoElement.volume,
            autoplay: videoElement.autoplay,
            playsInline: videoElement.playsInline,
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight,
            clientWidth: videoElement.clientWidth,
            clientHeight: videoElement.clientHeight,
            srcObjectIsParticipantStream: videoElement.srcObject === participant.stream,
        } : "video element not found");
        console.log("stream", stream ? {
            id: stream.id,
            active: stream.active,
            videoTrackCount: videoTracks.length,
            audioTrackCount: audioTracks.length,
        } : "stream not found");
        console.log("video tracks", videoTracks.map(track => ({
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
        })));
        console.log("audio tracks", audioTracks.map(track => ({
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
        })));

        if (videoElement && videoElement.paused) {
            videoElement.play()
                .then(() => {
                    console.log("videoElement.play() succeeded from click", {
                        participantId: participant.participantId,
                    });
                })
                .catch((err) => {
                    console.error("videoElement.play() failed from click", err);
                });
        }

        console.groupEnd();
    }, [localParticipantId, participant]);

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
                    onClick={onVideoContainerDebugClick}
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
