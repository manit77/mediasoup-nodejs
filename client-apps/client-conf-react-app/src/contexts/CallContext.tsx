import React, { createContext, useState, ReactNode, useContext, useEffect, useCallback } from 'react';
import { CallParticipant, Device } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { AuthContext } from './AuthContext';
import { Contact } from '@conf/conf-models';

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

    getContacts: () => void;
    contacts: Contact[];
    setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;

    participants: CallParticipant[];
    setParticipants: React.Dispatch<React.SetStateAction<CallParticipant[]>>;

    isCallActive: boolean;
    inviteInfo: InviteInfo | null;
    setInviteInfo: React.Dispatch<React.SetStateAction<InviteInfo | null>>;
    inviteContact: Contact | null;
    setInviteContact: React.Dispatch<React.SetStateAction<Contact | null>>;

    createConference: (trackingId: string) => void;
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

    sendInvite: (contact: Contact) => Promise<void>;
    acceptInvite: () => Promise<void>;
    declineInvite: (isIncomingDecline?: boolean) => void;
    cancelInvite: () => void;

    endCurrentCall: () => void;
    toggleMuteAudio: (isMuted: boolean) => void;
    toggleMuteVideo: (isVideoOff: boolean) => void;
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
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [participants, setParticipants] = useState<CallParticipant[]>([]);
    const [isCallActive, setIsCallActive] = useState<boolean>(false);
    const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
    const [inviteContact, setInviteContact] = useState<Contact | null>(null);

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
        setParticipants([]);
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

        webRTCService.onRegistered = (participantId: string) => {
            console.log("CallContext: onRegistered: participantId", participantId);
            setlocalParticipantId(participantId);
            hidePopUp();
        }

        webRTCService.onServerConnected = () => {
            console.log("CallContext: server connected");
            hidePopUp();
        }

        webRTCService.onServerDisconnected = () => {
            console.log("CallContext: disconnected from server");
            showPopUp("disconnected from server. trying to reconnect...");
        }

        webRTCService.onContactsReceived = (contacts) => {
            console.log("CallContext: onContactsReceived", contacts);
            setContacts(contacts);
        };

        webRTCService.onParticipantTrack = (participantId, track) => {
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
            setParticipants(prev => {
                return prev.map(p => {
                    if (p.id === participantId) {
                        let existingTrack = p.stream.getTracks().find(t => t.kind === track.kind);
                        if (existingTrack) {
                            p.stream.removeTrack(existingTrack);
                        }
                        p.stream.addTrack(track);
                    }
                    return p;
                });
            });
        };

        webRTCService.onInviteReceived = (participantId: string, displayName: string) => {
            console.log(`CallContext: Incoming call from ${displayName} ${participantId}`);
            // Auto-decline if already in a call
            if (isCallActive) {
                webRTCService.declineInvite();
                return;
            }
            setPopUpMessage("");
            setInviteInfo({ participantId, displayName });
        };

        webRTCService.onConferenceJoined = () => {
            console.log(`CallContext: conference connected`);
            setInviteContact(null);
            setIsCallActive(true);
            // Add self to participants immediately
            let self: CallParticipant = {
                displayName: auth.currentUser.displayName,
                id: auth.currentUser.id,
                isMuted: localStream ? !localStream.getAudioTracks()[0]?.enabled : true,
                isVideoOff: localStream ? !localStream.getVideoTracks()[0]?.enabled : true,
                stream: localStream
            };

            let newParticipants = [...participants];
            newParticipants.push(self);
            setParticipants(newParticipants);
        };

        webRTCService.onConferenceEnded = (reason: string) => {
            console.log(`CallContext: conference ended: ${reason}`);
            resetCallState();

            if (reason) {
                showPopUp(reason, 3);
                return;
            }

            hidePopUp();

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
    }, [hidePopUp, showPopUp, auth.currentUser, participants, isCallActive, localStream, resetCallState]);

    useEffect(() => {
        if (auth?.isAuthenticated && auth.currentUser) {
            setupWebRTCEvents();
        }
    }, [auth?.isAuthenticated, auth.currentUser, setupWebRTCEvents]);

    const getContacts = () => {
        webRTCService.getContacts();
    }

    const getMediaContraints = () => {
        const constraints = {
            audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
            video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
        };
        return constraints;
    }

    const getLocalMedia = async () => {
        console.log("getSetLocalStream");
        await webRTCService.getNewTracks(getMediaContraints());
        setIsLocalStreamUpdated(true);
        return localStream;   
    };

    const sendInvite = async (contactToCall: Contact) => {
        if (!auth?.currentUser) {
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
        if (!inviteInfo || !auth?.currentUser) return;
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

    const createConference = (trackingId: string) => {
        webRTCService.createConferenceRoom(trackingId);
    }

    const joinConference = (conferenceRoomId: string) => {
        webRTCService.joinConferenceRoom(conferenceRoomId)
    }

    const toggleMuteAudio = (micOn: boolean) => {
        let audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = micOn;
        }
        setParticipants(prev => prev.map(p => p.id === auth?.currentUser?.id ? { ...p, isMuted: !micOn } : p));
    };

    const toggleMuteVideo = (videoOn: boolean) => {
        let videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = videoOn;
        }
        setParticipants(prev => prev.map(p => p.id === auth?.currentUser?.id ? { ...p, isVideoOff: !videoOn } : p));
    };

    const startScreenShare = async () => {
        console.log(`startScreenShare`);

        if (!localStream) {
            console.log(`no local stream initiated`)
            return;
        }

        let cameraTrack = localStream.getVideoTracks()[0];

        // cameraTrack.addEventListener("ended", () => {
        //     console.log(`*** camera track ended.`);
        // });

        // console.log(`before camera track stopped ${cameraTrack.readyState}.`);
        // setTimeout(() => {
        //     cameraTrack.stop();
        //     console.log(`camera track stopped ${cameraTrack.readyState}.`);
        // }, 1000);
        // console.log(`camera track stopped ${cameraTrack.readyState}.`);

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
        console.log(`stopScreenShare`);

        let cameraTrack = originalVideoTrack;

        if (cameraTrack) {
            console.log(`cameraTrack: readyState ${cameraTrack.readyState} ${cameraTrack.id}`);
        }

        if (!cameraTrack || cameraTrack.readyState === "ended") {
            console.log(`getting new camera track the old camera track ended, cameraTrack readyState:${cameraTrack.readyState} `);
            await webRTCService.getNewTracks(getMediaContraints());
            cameraTrack = webRTCService.localStream.getVideoTracks()[0];
        }

        if (cameraTrack) {
            console.log(`add cameraTrack: ${cameraTrack.readyState} ${cameraTrack.kind} ${cameraTrack.id}`);

            webRTCService.replaceTracks(new MediaStream([cameraTrack]));

            let screenTrack = localStream.getVideoTracks()[0];
            if (screenTrack) {
                localStream.removeTrack(screenTrack);
            }
            localStream.addTrack(cameraTrack);
        }


        setIsScreenSharing(false);
        setOriginalVideoTrack(null);
        setIsLocalStreamUpdated(true);

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
    //     // if (auth?.currentUser) {
    //     //     setParticipants(prev => prev.map(p => p.id === auth!.currentUser!.id ? { ...p, stream: newStream, isMuted: !audioTrack?.enabled, isVideoOff: !videoTrack?.enabled } : p));
    //     // }

    // };

    return (
        <CallContext.Provider value={{
            localParticipantId,
            contacts, setContacts, getContacts,
            getLocalMedia,
            hidePopUp,
            showPopUp,
            popUpMessage,
            localStream, //, setLocalStream
            isLocalStreamUpdated,

            remoteStreams,
            participants, setParticipants,
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