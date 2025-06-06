import React, { createContext, useState, ReactNode, useContext, useEffect, useCallback } from 'react';
import { CallParticipant, Device } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { AuthContext } from './AuthContext';
import { Contact } from '@conf/conf-models';

interface IncomingCallInfo {
    participantId: string;
    displayName: string;
}

interface CallContextType {
    localParticipantId: string;
    localStream: MediaStream | null;
    setLocalStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
    remoteStreams: Map<string, MediaStream>; // userId -> MediaStream

    contacts: Contact[];
    setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;

    participants: CallParticipant[];
    setParticipants: React.Dispatch<React.SetStateAction<CallParticipant[]>>;

    isCallActive: boolean;
    incomingCall: IncomingCallInfo | null;
    setIncomingCall: React.Dispatch<React.SetStateAction<IncomingCallInfo | null>>;
    callingContact: Contact | null; // Contact being called
    setCallingContact: React.Dispatch<React.SetStateAction<Contact | null>>;
    availableDevices: { video: Device[]; audioIn: Device[]; audioOut: Device[] };
    selectedDevices: { videoId?: string; audioInId?: string; audioOutId?: string };
    setSelectedDevices: React.Dispatch<React.SetStateAction<{ videoId?: string; audioInId?: string; audioOutId?: string }>>;
    isScreenSharing: boolean;

    initiateCall: (contact: Contact) => Promise<void>;
    acceptCall: () => Promise<void>;
    declineCall: (isIncomingDecline?: boolean) => void;
    cancelOutgoingCall: () => void;
    endCurrentCall: () => void;
    inviteToOngoingCall: (contact: Contact) => void;
    toggleMuteAudio: () => boolean | undefined;
    toggleMuteVideo: () => boolean | undefined;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;
    updateMediaDevices: () => Promise<void>;
    switchDevice: (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => Promise<void>;
}

export const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const auth = useContext(AuthContext);
    const [localParticipantId, setlocalParticipantId] = useState<string>("");
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [participants, setParticipants] = useState<CallParticipant[]>([]);
    const [isCallActive, setIsCallActive] = useState<boolean>(false);
    const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
    const [callingContact, setCallingContact] = useState<Contact | null>(null); // For outgoing call popup

    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });
    const [selectedDevices, setSelectedDevices] = useState<{ videoId?: string; audioInId?: string; audioOutId?: string }>({});
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [originalVideoTrack, setOriginalVideoTrack] = useState<MediaStreamTrack | null>(null);

    const resetCallState = useCallback(() => {
        console.log("Resetting call state");
        if (localStream) {
            localStream.getTracks().forEach(t => {
                t.stop();
            })
        }
        setLocalStream(null);
        setRemoteStreams(new Map());
        setParticipants([]);
        setIsCallActive(false);
        setIncomingCall(null);
        setCallingContact(null);
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


    const setupWebRTCEvents = useCallback(() => {

        webRTCService.onRegistered = (participantId: string) => {
            console.log("CallContext: onRegistered: participantId", participantId);
            setlocalParticipantId(participantId);
        }

        webRTCService.onContactsReceived = (contacts) => {
            console.log("CallContext: onContactsReceived", contacts);
            setContacts(contacts);
        };

        webRTCService.onLocalStreamReady = (stream) => {
            console.log("CallContext: Local stream ready");
            setLocalStream(stream);
            if (auth?.currentUser && !participants.find(p => p.id === auth.currentUser!.id)) {
                setParticipants(prev => [...prev, { ...auth.currentUser!, stream, isMuted: !stream.getAudioTracks()[0]?.enabled, isVideoOff: !stream.getVideoTracks()[0]?.enabled }]);
            } else if (auth?.currentUser) {
                setParticipants(prev => prev.map(p => p.id === auth.currentUser!.id ? { ...p, stream, isMuted: !stream.getAudioTracks()[0]?.enabled, isVideoOff: !stream.getVideoTracks()[0]?.enabled } : p));
            }
        };

        webRTCService.onParticipantTrack = (userId, track) => {

            if (!userId) {
                console.error("CallContext: no userid");
            }

            if (!track) {
                console.error("CallContext: no track");
            }

            console.log(`CallContext: Remote stream added for ${userId}`);
            //setRemoteStreams(prev => new Map(prev).set(userId, track));
            // Participant should be added when 'user-joined-room' or call is established
            // Here, we update the stream for an existing participant
            setParticipants(prev => {
                return prev.map(p => {
                    if (p.id == userId) {
                        p.stream.addTrack(track);
                    }
                    return p;
                });
            });
        };

        webRTCService.onIncomingCall = (participantId: string, displayName: string) => {
            console.log(`CallContext: Incoming call from ${displayName}`);
            if (isCallActive) { // Auto-decline if already in a call
                webRTCService.declineCall();
                return;
            }
            setIncomingCall({ participantId, displayName });
        };

        webRTCService.onCallConnected = () => {
            console.log(`CallContext: Call accepted`);
            setCallingContact(null);
            setIsCallActive(true);
            // Add self to participants immediately
            let newParticipants = [...participants];
            newParticipants.push({
                displayName: auth.currentUser.displayName,
                id: auth.currentUser.id,
                isMuted: !localStream.getAudioTracks()[0]?.enabled,
                isVideoOff: !localStream.getVideoTracks()[0]?.enabled,
                stream: localStream
            });
            setParticipants(newParticipants);
        };

        webRTCService.onCallEnded = (reason: string) => {
            console.log(`CallContext: Call declined reason: ${reason}`);
            resetCallState();
        };

        webRTCService.onParticipantJoined = (participantId: string, displayName: string) => {
            console.log(`CallContext: Participant joined ${displayName} (${participantId})`);
            if (!participantId) {
                console.error("no participantId");
                return;
            }

            setParticipants(prev => {
                if (!prev.find(p => p.id === participantId)) {
                    return [...prev, new CallParticipant(participantId, displayName)];
                }
                return prev;
            });
        };

        webRTCService.onParticipantLeft = (userId) => {
            console.log(`CallContext: Participant left ${userId}`);
            setRemoteStreams(prev => {
                const newStreams = new Map(prev);
                newStreams.delete(userId);
                return newStreams;
            });
            setParticipants(prev => prev.filter(p => p.id !== userId));
        };

        return () => { // Cleanup
            webRTCService.dispose();
        }
    }, [auth.currentUser, participants, isCallActive, localStream, resetCallState]);

    useEffect(() => {
        if (auth?.isAuthenticated && auth.currentUser) {
            setupWebRTCEvents();
        }
    }, [auth?.isAuthenticated, auth.currentUser, setupWebRTCEvents]);


    const ensureLocalStream = async () => {
        let stream = localStream;
        if (!stream) {
            // selectedDevices.audioInId, selectedDevices.videoId

            const constraints = {
                audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
                video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
            };

            stream = await webRTCService.getUserMedia(constraints);
            setLocalStream(stream);
        }
        return stream;
    };

    const initiateCall = async (contactToCall: Contact) => {
        if (!auth?.currentUser) {
            console.error("User not authenticated to initiate call");
            return;
        }

        try {
            const stream = await ensureLocalStream();
            if (!stream) throw new Error("Local stream not available");

            setCallingContact(contactToCall);
            setIsCallActive(false); // Not fully active until accepted

            await webRTCService.initiateCall(contactToCall.participantId);
            console.log(`Call initiated to ${contactToCall.displayName}`);

        } catch (error) {
            console.error('Failed to initiate call:', error);
            resetCallState();
        }
    };

    const acceptCall = async () => {
        if (!incomingCall || !auth?.currentUser) return;
        try {
            const stream = await ensureLocalStream();
            if (!stream) throw new Error("Local stream not available");

            await webRTCService.answerCall();
            setIsCallActive(true);
            setIncomingCall(null); // Clear incoming call notification
            console.log(`Call with ${incomingCall.displayName} accepted in room ${incomingCall}`);
        } catch (error) {
            console.error('Failed to accept call:', error);
            resetCallState();
        }
    };

    const declineCall = (isIncomingDecline: boolean = true) => {
        if (isIncomingDecline && incomingCall) {
            webRTCService.declineCall();
            setIncomingCall(null);
            setIsCallActive(false);

        }
    };

    const cancelOutgoingCall = () => {
        if (callingContact) {
            console.log(`Call to ${callingContact.displayName} cancelled.`);
            webRTCService.endCall();

            setCallingContact(null);
            if (participants.length <= 1) {
                resetCallState();
            }
        }
    };

    const endCurrentCall = () => {
        console.log("Ending current call context-wise.");
        webRTCService.endCall();
        resetCallState();
    };

    const inviteToOngoingCall = (contactToInvite: Contact) => {
        if (!isCallActive) {
            console.error("Cannot invite: no active call, room ID, or current user.");
            return;
        }
        webRTCService.initiateCall(contactToInvite.participantId);
        alert(`Inviting ${contactToInvite.displayName} to the call.`);
    };

    const toggleMuteAudio = () => {
        const isNowEnabled = webRTCService.toggleAudioMute();
        setLocalStream(prevStream => { // Update local stream state to reflect mute
            if (prevStream) {
                const audioTrack = prevStream.getAudioTracks()[0];
                if (audioTrack) audioTrack.enabled = isNowEnabled;
            }
            return prevStream ? new MediaStream(prevStream.getTracks()) : null; // Trigger re-render
        });
        setParticipants(prev => prev.map(p => p.id === auth?.currentUser?.id ? { ...p, isMuted: !isNowEnabled } : p));
        return isNowEnabled;
    };

    const toggleMuteVideo = () => {
        const isNowEnabled = webRTCService.toggleVideoMute();
        setLocalStream(prevStream => { // Update local stream state
            if (prevStream) {
                const videoTrack = prevStream.getVideoTracks()[0];
                if (videoTrack) videoTrack.enabled = isNowEnabled;
            }
            return prevStream ? new MediaStream(prevStream.getTracks()) : null;
        });
        setParticipants(prev => prev.map(p => p.id === auth?.currentUser?.id ? { ...p, isVideoOff: !isNowEnabled } : p));
        return isNowEnabled;
    };

    const startScreenShare = async () => {
        if (!localStream) return;
        if (!originalVideoTrack && localStream.getVideoTracks().length > 0) {
            setOriginalVideoTrack(localStream.getVideoTracks()[0]);
        }
        const screenStream = await webRTCService.startScreenShare();
        if (screenStream) {
            setIsScreenSharing(true);
            // Optionally update localStream to show screen share locally,
            // but the service handles track replacement for peers.
        }
    };

    const stopScreenShare = () => {
        if (originalVideoTrack) {
            webRTCService.stopScreenShare(originalVideoTrack);
            // Restore original video track to local stream for local preview consistency if needed
            // const newStream = new MediaStream();
            // localStream?.getAudioTracks().forEach(t => newStream.addTrack(t));
            // newStream.addTrack(originalVideoTrack);
            // setLocalStream(newStream);
            // setParticipants(prev => prev.map(p => p.id === auth?.currentUser?.id ? {...p, stream: newStream} : p));
        }
        setIsScreenSharing(false);
        setOriginalVideoTrack(null);
    };

    const switchDevice = async (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => {
        if (type === 'audioOut') {
            // For video elements: videoEl.setSinkId(deviceId)
            // This needs to be applied to all <video> elements displaying remote/local streams.
            // This is a UI concern, not directly a WebRTC stream manipulation for audio output.
            console.warn("Speaker selection (setSinkId) needs to be handled at the video element level.");
            return;
        }

        //detect a change
        let updateAudio = false;
        let updateVideo = false;
        if (type === "video") {
            if (selectedDevices.videoId !== deviceId) {
                //video has changed
                updateVideo = true;
            }
        }

        if (type === "audioIn") {
            if (selectedDevices.audioInId !== deviceId) {
                //video has changed
                updateAudio = true;
            }
        }

        setSelectedDevices(prev => ({ ...prev, [`${type === 'video' ? 'video' : type}Id`]: deviceId }));

        if (webRTCService.isOnCall()) {

            const constraints = {
                audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
                video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
            };

            let newstream = await webRTCService.getNewStream(constraints);
            console.log(newstream);

            webRTCService.replaceStream(newstream);

        }

        // Get new stream with selected devices       
        // type === 'audioIn' ? deviceId : selectedDevices.audioInId,
        //   type === 'video' ? deviceId : selectedDevices.videoId
        //const newStream = await webRTCService.getUserMedia();
        //setLocalStream(newStream); // Update local stream in context

        // Update tracks in existing peer connections
        //const audioTrack = newStream.getAudioTracks()[0];
        //const videoTrack = newStream.getVideoTracks()[0];


        // webRTCService.getPeerConnectionsState().forEach(pc => {
        //     pc.getSenders().forEach(sender => {
        //         if (sender.track?.kind === 'audio' && audioTrack) {
        //             sender.replaceTrack(audioTrack);
        //         }
        //         if (sender.track?.kind === 'video' && videoTrack) {
        //             sender.replaceTrack(videoTrack);
        //             if (type === 'video') setOriginalVideoTrack(videoTrack); // Update original if camera changes
        //         }
        //     });
        // });
        // if (auth?.currentUser) {
        //     setParticipants(prev => prev.map(p => p.id === auth!.currentUser!.id ? { ...p, stream: newStream, isMuted: !audioTrack?.enabled, isVideoOff: !videoTrack?.enabled } : p));
        // }

    };


    return (
        <CallContext.Provider value={{
            localParticipantId,
            contacts, setContacts,
            localStream, setLocalStream, remoteStreams, participants, setParticipants, isCallActive,
            incomingCall, setIncomingCall, callingContact, setCallingContact,
            availableDevices, selectedDevices, setSelectedDevices, isScreenSharing,
            initiateCall, acceptCall, declineCall, cancelOutgoingCall, endCurrentCall, inviteToOngoingCall,
            toggleMuteAudio, toggleMuteVideo, startScreenShare, stopScreenShare, updateMediaDevices, switchDevice
        }}>
            {children}
        </CallContext.Provider>
    );
};