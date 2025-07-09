import React, { createContext, useState, ReactNode, useContext, useEffect, useCallback } from 'react';
import { CallParticipant, Device } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { AuthContext } from './AuthContext';
import { ConferenceRoomInfo, ParticipantInfo } from '@conf/conf-models';

interface InviteInfo {
    participantId: string;
    displayName: string;
}

interface CallContextType {
    localParticipantId: string;
    localStream: MediaStream;
    isLocalStreamUpdated: boolean;
    // setLocalStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
    remoteStreams: Map<string, MediaStream>; // userId -> MediaStream

    getParticipantsOnline: () => void;
    participantsOnline: ParticipantInfo[];
    setParticipantsOnline: React.Dispatch<React.SetStateAction<ParticipantInfo[]>>;

    getConferenceRooms: () => void;
    conferences: ConferenceRoomInfo[];
    setConferences: React.Dispatch<React.SetStateAction<ConferenceRoomInfo[]>>;

    callParticipants: CallParticipant[];
    setCallParticipants: React.Dispatch<React.SetStateAction<CallParticipant[]>>;

    isCallActive: boolean;
    inviteInfo: InviteInfo | null;
    setInviteInfo: React.Dispatch<React.SetStateAction<InviteInfo | null>>;
    inviteContact: ParticipantInfo | null;
    setInviteContact: React.Dispatch<React.SetStateAction<ParticipantInfo | null>>;

    createConference: (trackingId: string, roomName: string) => void;
    joinConference: (conferenceRoomId: string) => void;

    availableDevices: { video: Device[]; audioIn: Device[]; audioOut: Device[] };
    selectedDevices: { videoId?: string; audioInId?: string; audioOutId?: string };
    setSelectedDevices: React.Dispatch<React.SetStateAction<{ videoId?: string; audioInId?: string; audioOutId?: string }>>;
    micEnabled: boolean;
    setMicEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    cameraEnabled: boolean;
    setCameraEnabled: React.Dispatch<React.SetStateAction<boolean>>;

    isScreenSharing: boolean;

    popUpMessage: string;
    hidePopUp: () => void;
    showPopUp: (message: string, timeoutSecs?: number) => void;
    getLocalMedia: () => Promise<MediaStream>;

    sendInvite: (participantInfo: ParticipantInfo) => Promise<void>;
    acceptInvite: () => Promise<void>;
    declineInvite: (isIncomingDecline?: boolean) => void;
    cancelInvite: () => void;

    endCurrentCall: () => void;
    toggleMuteAudio: (participantId: string, isMuted: boolean) => void;
    toggleMuteVideo: (participantId: string, isVideoOff: boolean) => void;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;
    updateMediaDevices: () => Promise<void>;
    //switchDevice: (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => Promise<void>;
    switchDevices: (videoId: string, audioId: string, audioOutId: string) => Promise<void>;
}

export const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const auth = useContext(AuthContext);
    const [localParticipantId, setlocalParticipantId] = useState<string>("");
    const [localStream] = useState<MediaStream>(webRTCService.localStream);
    const [isLocalStreamUpdated, setIsLocalStreamUpdated] = useState<boolean>(false);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

    const [participantsOnline, setParticipantsOnline] = useState<ParticipantInfo[]>([]);
    const [conferences, setConferences] = useState<ConferenceRoomInfo[]>([]);

    const [callParticipants, setCallParticipants] = useState<CallParticipant[]>([]);
    const [isCallActive, setIsCallActive] = useState<boolean>(false);
    const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
    const [inviteContact, setInviteContact] = useState<ParticipantInfo | null>(null);

    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });
    const [selectedDevices, setSelectedDevices] = useState<{ videoId?: string; audioInId?: string; audioOutId?: string }>({});
    const [micEnabled, setMicEnabled] = useState<boolean>(true);
    const [cameraEnabled, setCameraEnabled] = useState<boolean>(true);

    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [originalVideoTrack, setOriginalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [popUpMessage, setPopUpMessage] = useState("");
    const [popUpTimerId, setPopUpTimerId] = useState(undefined);

    const resetCallState = useCallback(() => {
        console.log("Resetting call state");
        if (localStream) {
            localStream.getTracks().forEach(t => {
                t.stop();
            })
        }
        //setLocalStream(null);
        setRemoteStreams(new Map());
        setCallParticipants([]);
        setIsCallActive(false);
        setInviteInfo(null);
        setInviteContact(null);
        setIsScreenSharing(false);
        setOriginalVideoTrack(null);
        // webRTCService.stopLocalStream(); // Ensure this is called
    }, [localStream]);


    const updateMediaDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const video: Device[] = [];
            const audioIn: Device[] = [];
            const audioOut: Device[] = [];
            devices.forEach(device => {
                if (device.kind === 'videoinput') video.push({ id: device.deviceId, label: device.label || `Camera ${video.length + 1}` });
                else if (device.kind === 'audioinput') audioIn.push({ id: device.deviceId, label: device.label || `Mic ${audioIn.length + 1}` });
                else if (device.kind === 'audiooutput') audioOut.push({ id: device.deviceId, label: device.label || `Speaker ${audioOut.length + 1}` });
            });
            setAvailableDevices({ video, audioIn, audioOut });

            // Set initial selected devices if not already set
            if (!selectedDevices.videoId && video.length > 0) {
                setSelectedDevices(prev => ({ ...prev, videoId: video[0].id }));
            }
            if (!selectedDevices.audioInId && audioIn.length > 0) {
                setSelectedDevices(prev => ({ ...prev, audioInId: audioIn[0].id }));
            }
            if (!selectedDevices.audioOutId && audioOut.length > 0) {
                setSelectedDevices(prev => ({ ...prev, audioOutId: audioOut[0].id }));
            }

        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }, [selectedDevices.videoId, selectedDevices.audioInId, selectedDevices.audioOutId]);

    useEffect(() => {
        updateMediaDevices();
        navigator.mediaDevices.addEventListener('devicechange', updateMediaDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', updateMediaDevices);
        };
    }, [updateMediaDevices]);

    const hidePopUp = useCallback(() => {
        setPopUpMessage("");
        if (popUpTimerId) {
            clearTimeout(popUpTimerId);
        }
    }, [popUpTimerId])

    const showPopUp = useCallback((message: string, timeoutSecs?: number) => {
        console.log(`showPopUp ${message} ${timeoutSecs}`);

        if (timeoutSecs) {

            if (popUpTimerId) {
                clearTimeout(popUpTimerId);
            }

            setPopUpMessage(message);
            let timerid = setTimeout(() => {
                setPopUpMessage("");
            }, timeoutSecs * 1000);

            setPopUpTimerId(timerid);

        } else {
            setPopUpMessage(message);
        }
    }, [popUpTimerId])

    const setupWebRTCEvents = useCallback(() => {

        webRTCService.onRegistered = async (participantId: string) => {
            console.log("CallContext: onRegistered: participantId", participantId);
            setlocalParticipantId(participantId);
            hidePopUp();
        }

        webRTCService.onServerConnected = async () => {
            console.log("CallContext: server connected");
            hidePopUp();
        }

        webRTCService.onServerDisconnected = async () => {
            console.log("CallContext: disconnected from server");
            showPopUp("disconnected from server. trying to reconnect...");
        }

        webRTCService.onParticipantsReceived = async (participants) => {
            console.log("CallContext: onContactsReceived", participants);
            setParticipantsOnline(participants);
        };

        webRTCService.onConferencesReceived = async (conferenceRooms) => {
            console.log("CallContext: onConferencesReceived", conferenceRooms);
            setConferences(conferenceRooms);
        };

        webRTCService.onParticipantTrack = async (participantId, track) => {
            console.log('CallContext: onParticipantTrack');

            if (!participantId) {
                console.error("CallContext: no userid");
            }

            if (!track) {
                console.error("CallContext: no track");
            }

            console.log(`CallContext: Remote stream added for ${participantId}`);
            //setRemoteStreams(prev => new Map(prev).set(userId, track));
            // Participant should be added when 'user-joined-room' or call is established
            // Here, we update the stream for an existing participant

            setCallParticipants((prevParticipants) =>
                prevParticipants.map((p) => {
                    if (p.id === participantId) {
                        // Create a new MediaStream to avoid mutating the existing one
                        const newStream = new MediaStream();

                        // Copy existing tracks except the one to replace
                        p.stream.getTracks().forEach((existingTrack) => {
                            if (existingTrack.kind !== track.kind) {
                                newStream.addTrack(existingTrack);
                            }
                        });

                        // Add the new track
                        newStream.addTrack(track);

                        // Return a new participant object with the updated stream
                        return { ...p, stream: newStream };
                    }
                    return p;
                })
            );

        };

        webRTCService.onInviteReceived = async (participantId: string, displayName: string) => {
            console.log(`CallContext: onInviteReceived ${displayName} ${participantId}`);
            // Auto-decline if already in a call
            if (isCallActive) {
                webRTCService.declineInvite();
                return;
            }
            setPopUpMessage("");
            setInviteInfo({ participantId, displayName });
        };


        webRTCService.onConferenceJoined = async () => {
            console.log(`CallContext: onConferenceJoined`);
            setInviteContact(null);
            setIsCallActive(true);
            // Add self to participants immediately

            if (localStream.getTracks().length === 0) {
                await getLocalMedia();
            }

            let self: CallParticipant = {
                displayName: auth.getCurrentUser()?.displayName,
                id: auth.getCurrentUser()?.id,
                isMuted: localStream ? !localStream.getAudioTracks()[0]?.enabled : true,
                isVideoOff: localStream ? !localStream.getVideoTracks()[0]?.enabled : true,
                stream: localStream
            };

            setCallParticipants((prevParticipants) => {
                // Check if participant with same ID already exists
                if (prevParticipants.some((p) => p.id === self.id)) {
                    console.warn(`CallContext: Participant with ID ${self.id} already exists`);
                    // Optionally update existing participant instead
                    return prevParticipants.map((p) =>
                        p.id === self.id ? { ...p, ...self } : p
                    );
                }
                return [...prevParticipants, self];
            });

            // setParticipants((prevParticipants) => {
            //     return [...prevParticipants, self]
            // });

            // let newParticipants = [...participants];
            // newParticipants.push(self);
            // console.log("CallContext: newParticipants: add self:", newParticipants);
            // setParticipants(newParticipants);

        };

        webRTCService.onConferenceEnded = async (conferenceId: string, reason: string) => {
            console.log(`CallContext: conference ended: conferenceId: ${conferenceId} reason: ${reason}`);
            resetCallState();

            hidePopUp();

            if (reason) {
                showPopUp(reason, 3);
                return;
            }

        };

        webRTCService.onParticipantJoined = async (participantId: string, displayName: string) => {
            console.log(`CallContext: onParticipantJoined ${displayName} (${participantId})`);
            if (!participantId) {
                console.error("no participantId");
                return;
            }

            const newParticipant = new CallParticipant(participantId, displayName);
            setCallParticipants((prevParticipants) => {
                // Check for duplicates
                if (prevParticipants.some((p) => p.id === participantId)) {
                    console.warn(`CallContext: Participant with ID ${participantId} already exists`);
                    return prevParticipants; // Skip adding duplicate
                }

                const updatedParticipants = [...prevParticipants, newParticipant];
                console.log('CallContext: newParticipants: onParticipantJoined:', updatedParticipants);
                return updatedParticipants;
            });

            // if (!participants.find(p => p.id === participantId)) {
            //     console.log("add new participant", participantId, displayName, participants);

            //     let newParticipants = [...participants, new CallParticipant(participantId, displayName)]
            //     console.log("CallContext: newParticipants: onParticipantJoined:", newParticipants);
            //     setParticipants(newParticipants);

            // } else {
            //     console.log("participant already exists", participantId, displayName);
            // }

        };

        webRTCService.onParticipantLeft = async (participantId) => {
            console.log(`CallContext: onParticipantLeft ${participantId}`);
            if (!participantId) {
                console.error('CallContext: Invalid participantId');
                return;
            }

            setRemoteStreams((prev) => {
                const newStreams = new Map(prev);
                const stream = newStreams.get(participantId);
                if (stream) {
                    // Stop all tracks to free resources
                    stream.getTracks().forEach((track) => track.stop());
                    newStreams.delete(participantId);
                }
                return newStreams;
            });

            setCallParticipants((prevParticipants) => {
                // Check if participant exists
                if (!prevParticipants.some((p) => p.id === participantId)) {
                    console.warn(`CallContext: Participant with ID ${participantId} not found`);
                    return prevParticipants; // No update needed
                }

                const newParticipants = prevParticipants.filter((p) => p.id !== participantId);
                console.log('CallContext: newParticipants: onParticipantLeft', newParticipants);
                return newParticipants;
            });

            // setRemoteStreams(prev => {
            //     const newStreams = new Map(prev);
            //     newStreams.delete(participantId);
            //     return newStreams;
            // });
            // let newParticipants = participants.filter(p => p.id !== participantId);
            // console.log("CallContext: newParticipants: onParticipantLeft", newParticipants);
            // setParticipants(newParticipants);
        };

        return () => { // Cleanup
            webRTCService.dispose();
        }
    }, [hidePopUp, showPopUp, isCallActive, localStream, callParticipants, resetCallState]);

    useEffect(() => {
        if (auth?.isAuthenticated && auth.getCurrentUser()) {
            setupWebRTCEvents();
        }
    }, [auth?.isAuthenticated, auth.getCurrentUser(), setupWebRTCEvents]);

    const getParticipantsOnline = () => {
        webRTCService.getParticipantsOnline();
    }

    const getConferenceRooms = () => {
        webRTCService.getConferenceRooms();
    }

    const getMediaContraints = () => {
        const constraints = {
            audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
            video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
        };
        return constraints;
    }

    const getLocalMedia = async () => {
        console.log("getLocalMedia");
        await webRTCService.getNewTracks(getMediaContraints());
        setIsLocalStreamUpdated(true);
        return localStream;
    };

    const sendInvite = async (contactToCall: ParticipantInfo) => {
        if (!auth?.getCurrentUser()) {
            console.error("User not authenticated to initiate call");
            return;
        }

        try {

            setInviteContact(contactToCall);
            setIsCallActive(false); // Not fully active until accepted

            await webRTCService.sendInvite(contactToCall.participantId);
            console.log(`Call initiated to ${contactToCall.displayName}`);

        } catch (error) {
            console.error('Failed to initiate call:', error);
            resetCallState();
        }
    };

    const acceptInvite = async () => {
        if (!inviteInfo || !auth?.getCurrentUser()) return;
        try {

            await webRTCService.acceptInvite();
            setIsCallActive(true);
            setInviteInfo(null); // Clear incoming call notification
            console.log(`Call with ${inviteInfo.displayName} accepted in room ${inviteInfo}`);
        } catch (error) {
            console.error('Failed to accept call:', error);
            resetCallState();
        }
    };

    const declineInvite = (isIncomingDecline: boolean = true) => {
        if (isIncomingDecline && inviteInfo) {
            webRTCService.declineInvite();
            setInviteInfo(null);
            setIsCallActive(false);

        }
    };

    const cancelInvite = () => {
        if (inviteContact) {
            console.log(`Call to ${inviteContact.displayName} cancelled.`);
            webRTCService.endCall();

            setInviteContact(null);
            if (callParticipants.length <= 1) {
                resetCallState();
            }
        }
    };

    const endCurrentCall = () => {
        console.log("Ending current call context-wise.");
        webRTCService.endCall();
        resetCallState();
    };

    const createConference = (trackingId: string, roomName: string) => {
        console.log("CallContext: createConference");

        webRTCService.createConferenceRoom(trackingId, roomName);
    }

    const joinConference = (conferenceRoomId: string) => {
        console.log("CallContext: joinConference");

        if(!conferenceRoomId) {
            console.error("CallContext: joinConference: conferenceRoomId is required");
            return;
        }
        webRTCService.joinConferenceRoom(conferenceRoomId)
    }

    const toggleMuteAudio = (participantId: string, isMuted: boolean) => {
        console.log("CallContext: toggleMuteAudio");
        
        let participant = callParticipants.find(p => p.id === participantId);
        if (!participant) {
            console.error(`participant not found ${participantId}`);
            return;
        }
        let audioTrack = participant.stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !isMuted;

            //update the participant isMuted flag
            setCallParticipants(prevParticipants => {
                return [...prevParticipants.map(p => p.id === participantId ? { ...p, isMuted: isMuted } : p)];
            });

            // webRTCService.updateTracksStatus();
        } else {
            console.warn("CallContext: audioTrack not found");
        }
    };

    const toggleMuteVideo = (participantId: string, isMuted: boolean) => {
        console.log("CallContext: toggleMuteVideo");
        let participant = callParticipants.find(p => p.id === participantId);
        if (!participant) {
            console.error(`participant not found ${participantId}`);
            return;
        }

        let videoTrack = participant.stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !isMuted;

            setCallParticipants(prevParticipants => {
                return [...prevParticipants.map(p => p.id === participantId ? { ...p, isVideoOff: isMuted } : p)];
            });

        } else {
            console.warn("CallContext: videoTrack not found");
        }
    };


    const startScreenShare = async () => {
        console.log(`startScreenShare`);

        if (!localStream) {
            console.log(`no local stream initiated`)
            return;
        }

        let cameraTrack = localStream.getVideoTracks()[0];
        setOriginalVideoTrack(cameraTrack);
        console.log(`setOriginalVideoTrack ${cameraTrack.id}`);

        console.log(`before cameraTrack: readyState ${cameraTrack.readyState} ${cameraTrack.id}`);
        const screenStream = await webRTCService.startScreenShare();
        console.log(`after cameraTrack: readyState ${cameraTrack.readyState} ${cameraTrack.id}`);

        if (screenStream) {
            setIsScreenSharing(true);

            if (cameraTrack) {
                localStream.removeTrack(cameraTrack);
                console.log(`cameraTrack track removed`);
            }

            let screenTrack = screenStream.getVideoTracks()[0];
            localStream.addTrack(screenTrack);
            console.log(`screen track added to localStream`);

        }
        setIsLocalStreamUpdated(true);

        console.log(`end of function cameraTrack: readyState ${cameraTrack.readyState} ${cameraTrack.id}`);
    };

    const stopScreenShare = async () => {
        console.log("stopScreenShare");

        try {
            // Get the current local stream
            const localStream = webRTCService.localStream;
            let cameraTrack = originalVideoTrack;

            const screenTrack = localStream.getVideoTracks().find(
                (track) => track !== cameraTrack
            );

            if (screenTrack) {
                console.log(`Stopping screenTrack: ${screenTrack.id}`);
                screenTrack.stop(); // Stop the screen-sharing track
                localStream.removeTrack(screenTrack); // Remove from local stream
            } else {
                console.error("screen track not found")
            }

            // Check if camera track is valid; if not, get a new one
            if (!cameraTrack || cameraTrack.readyState === "ended") {
                console.log(`Getting new camera track, cameraTrack readyState: ${cameraTrack?.readyState}`);
                await webRTCService.getNewTracks(getMediaContraints());
                cameraTrack = webRTCService.localStream.getVideoTracks()[0];
            }

            if (cameraTrack) {
                console.log(`Using cameraTrack: ${cameraTrack.readyState} ${cameraTrack.kind} ${cameraTrack.id}`);
                console.log("tracks:", localStream.getVideoTracks());

                // Replace the track in the peer connection
                await webRTCService.replaceTracks(new MediaStream([cameraTrack]));

                // Ensure the local stream only contains the camera track
                if (!localStream.getTracks().includes(cameraTrack)) {
                    localStream.addTrack(cameraTrack);
                }
                // Update state
                setIsScreenSharing(false);
                setOriginalVideoTrack(null);
                setIsLocalStreamUpdated(true);
            }
        } catch (error) {
            console.error("Error stopping screen share:", error);
        }
    };


    const switchDevices = async (videoId: string, audioId: string, speakerId: string) => {
        console.log(`switchDevices videoId:${videoId}, audioId:${audioId}, speakerId:${speakerId}, micEnabled:${micEnabled}, cameraEnabled:${cameraEnabled}`);

        //set selected devices
        if (selectedDevices.videoId !== videoId) {
            selectedDevices.videoId = videoId ?? selectedDevices.videoId;
        }

        if (selectedDevices.audioInId !== audioId) {
            selectedDevices.audioInId = audioId ?? selectedDevices.audioInId;
        }

        if (selectedDevices.audioOutId !== speakerId) {
            selectedDevices.audioOutId = speakerId ?? selectedDevices.audioOutId;
        }

        const constraints = {
            audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
            video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
        };

        //get new stream based on devices
        await webRTCService.getNewTracks(constraints);

        let videoTrack = webRTCService.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = cameraEnabled;
        }

        let audioTrack = webRTCService.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = micEnabled;
        }
        setIsLocalStreamUpdated(true);
    };

    // const switchDevice = async (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => {
    //     if (type === 'audioOut') {
    //         // For video elements: videoEl.setSinkId(deviceId)
    //         // This needs to be applied to all <video> elements displaying remote/local streams.
    //         // This is a UI concern, not directly a WebRTC stream manipulation for audio output.
    //         console.warn("Speaker selection (setSinkId) needs to be handled at the video element level.");
    //         return;
    //     }

    //     //detect a change
    //     let updateAudio = false;
    //     let updateVideo = false;
    //     if (type === "video") {
    //         if (selectedDevices.videoId !== deviceId) {
    //             //video has changed
    //             updateVideo = true;
    //         }
    //     }

    //     if (type === "audioIn") {
    //         if (selectedDevices.audioInId !== deviceId) {
    //             //video has changed
    //             updateAudio = true;
    //         }
    //     }

    //     setSelectedDevices(prev => ({ ...prev, [`${type === 'video' ? 'video' : type}Id`]: deviceId }));

    //     if (webRTCService.isOnCall()) {

    //         const constraints = {
    //             audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
    //             video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
    //         };

    //         let newstream = await webRTCService.getNewStream(constraints);
    //         console.log(newstream);

    //         webRTCService.replaceStream(newstream);

    //     }

    //     // Get new stream with selected devices       
    //     // type === 'audioIn' ? deviceId : selectedDevices.audioInId,
    //     //   type === 'video' ? deviceId : selectedDevices.videoId
    //     //const newStream = await webRTCService.getUserMedia();
    //     //setLocalStream(newStream); // Update local stream in context

    //     // Update tracks in existing peer connections
    //     //const audioTrack = newStream.getAudioTracks()[0];
    //     //const videoTrack = newStream.getVideoTracks()[0];


    //     // webRTCService.getPeerConnectionsState().forEach(pc => {
    //     //     pc.getSenders().forEach(sender => {
    //     //         if (sender.track?.kind === 'audio' && audioTrack) {
    //     //             sender.replaceTrack(audioTrack);
    //     //         }
    //     //         if (sender.track?.kind === 'video' && videoTrack) {
    //     //             sender.replaceTrack(videoTrack);
    //     //             if (type === 'video') setOriginalVideoTrack(videoTrack); // Update original if camera changes
    //     //         }
    //     //     });
    //     // });
    //     // if (auth?.getCurrentUser()) {
    //     //     setParticipants(prev => prev.map(p => p.id === auth!.getCurrentUser()!.id ? { ...p, stream: newStream, isMuted: !audioTrack?.enabled, isVideoOff: !videoTrack?.enabled } : p));
    //     // }

    // };

    return (
        <CallContext.Provider value={{
            localParticipantId,
            participantsOnline, setParticipantsOnline, getParticipantsOnline,
            conferences, setConferences, getConferenceRooms,
            getLocalMedia,
            hidePopUp,
            showPopUp,
            popUpMessage,
            localStream, //, setLocalStream
            isLocalStreamUpdated,

            remoteStreams,
            callParticipants, setCallParticipants,
            isCallActive,
            createConference, joinConference,
            inviteInfo, setInviteInfo,
            inviteContact, setInviteContact,
            availableDevices, selectedDevices, setSelectedDevices, isScreenSharing,
            cameraEnabled, setCameraEnabled, micEnabled, setMicEnabled,
            sendInvite, acceptInvite, declineInvite, cancelInvite,
            endCurrentCall,
            toggleMuteAudio, toggleMuteVideo, startScreenShare, stopScreenShare, updateMediaDevices,
            switchDevices
        }}>
            {children}
        </CallContext.Provider>
    );
};