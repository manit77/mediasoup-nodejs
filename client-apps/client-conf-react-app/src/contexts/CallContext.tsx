import React, { createContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { Device, SelectedDevices } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { ConferenceRoomInfo, InviteMsg, ParticipantInfo } from '@conf/conf-models';
import { Conference, Participant } from '@conf/conf-client';

interface CallContextType {
    isConnected: boolean;
    isAuthenticated: boolean;
    localParticipant: Participant;
    isLocalStreamUpdated: boolean;
    isCallActive: boolean;
    conferenceRoom: Conference;
    callParticipants: Map<string, Participant>;

    isScreenSharing: boolean;
    participantsOnline: ParticipantInfo[];
    conferencesOnline: ConferenceRoomInfo[];
    inviteInfoSend: InviteMsg;
    inviteInfoReceived: InviteMsg;
    setInviteInfoSend: React.Dispatch<React.SetStateAction<InviteMsg>>;

    availableDevices: { video: Device[]; audioIn: Device[]; audioOut: Device[] };
    selectedDevices: SelectedDevices;
    popUpMessage: string;

    getLocalMedia: () => Promise<MediaStreamTrack[]>;
    getConferenceRoomsOnline: () => void;
    getParticipantsOnline: () => void;

    hidePopUp: () => void;
    createConference: (trackingId: string, roomName: string) => void;
    joinConference: (conferenceRoomId: string) => void;


    sendInvite: (participantInfo: ParticipantInfo) => Promise<void>;
    acceptInvite: () => Promise<void>;
    declineInvite: () => void;
    cancelInvite: () => void;

    endCurrentCall: () => void;

    toggleMuteAudio: (participantId: string, isMuted: boolean) => void;
    toggleMuteVideo: (participantId: string, isVideoOff: boolean) => void;

    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;

    getMediaDevices: () => Promise<void>;
    switchDevices: (videoId: string, audioId: string, audioOutId: string) => Promise<void>;


}

export const CallContext = createContext<CallContextType>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    
    const [isConnected, setIsConnected] = useState<boolean>(webRTCService.isConnected);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(webRTCService.isConnected && webRTCService.localParticipant.peerId ? true : false);
    const localParticipant = useRef<Participant>(webRTCService.localParticipant);    
    const [isCallActive, setIsCallActive] = useState<boolean>(webRTCService.isOnCall());
    const conferenceRoom = useRef<Conference>(webRTCService.conferenceRoom);
    const [callParticipants, setCallParticipants] = useState<Map<string, Participant>>(webRTCService.participants);
    const isScreenSharing = useRef<boolean>(webRTCService.isScreenSharing);
    const selectedDevices = useRef<SelectedDevices>(webRTCService.selectedDevices);

    const [participantsOnline, setParticipantsOnline] = useState<ParticipantInfo[]>(webRTCService.participantsOnline);
    const [conferencesOnline, setConferencesOnline] = useState<ConferenceRoomInfo[]>(webRTCService.conferencesOnline);
    const [inviteInfoSend, setInviteInfoSend] = useState<InviteMsg | null>(webRTCService.inviteSendMsg);
    const [inviteInfoReceived, setInviteInfoReceived] = useState<InviteMsg | null>(webRTCService.inviteRecievedMsg);

    const [isLocalStreamUpdated, setIsLocalStreamUpdated] = useState<boolean>(false);
    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });
    const [popUpMessage, setPopUpMessage] = useState("");
    const [popUpTimerId, setPopUpTimerId] = useState<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        console.log("CallProvider mounted");
        return () => console.log("CallProvider unmounted");
    }, []);

    const getMediaDevices = useCallback(async () => {
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

            // Set defaults of selected devices if not already set
            if (!selectedDevices.current.videoId && video.length > 0) {
                selectedDevices.current.videoId = video[0].id;
            }
            if (!selectedDevices.current.audioInId && audioIn.length > 0) {
                selectedDevices.current.audioInId = audioIn[0].id;
            }
            if (!selectedDevices.current.audioOutId && audioOut.length > 0) {
                selectedDevices.current.audioOutId = audioOut[0].id;
            }

        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }, []);

    const getMediaContraints = useCallback(() => {
        const constraints = {
            audio: selectedDevices.current.audioInId ? { deviceId: { exact: selectedDevices.current.audioInId } } : true,
            video: selectedDevices.current.videoId ? { deviceId: { exact: selectedDevices.current.videoId } } : true
        };
        return constraints;
    }, []);

    const getLocalMedia = useCallback(async () => {
        console.log("getLocalMedia");
        let tracks = await webRTCService.getNewTracks(getMediaContraints());
        setIsLocalStreamUpdated(true);
        console.log("setIsLocalStreamUpdated");
        return tracks;
    }, [getMediaContraints]);

    useEffect(() => {
        getMediaDevices();
        navigator.mediaDevices.addEventListener('devicechange', getMediaDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getMediaDevices);
        };
    }, [getMediaDevices]);

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
            setIsAuthenticated(true);
            hidePopUp();
        }

        webRTCService.onServerConnected = async () => {
            console.log("CallContext: server connected");
            setIsConnected(true);
            hidePopUp();
        }

        webRTCService.onServerDisconnected = async () => {
            console.log("CallContext: disconnected from server");
            setIsConnected(false);
            setIsAuthenticated(false);
            setIsCallActive(false);
            showPopUp("disconnected from server. trying to reconnect...");
        }

        webRTCService.onParticipantsReceived = async (participants) => {
            console.log("CallContext: onContactsReceived", participants);
            setParticipantsOnline(participants);
        };

        webRTCService.onConferencesReceived = async (confRoomsOnline) => {
            console.log("CallContext: onConferencesReceived", confRoomsOnline);
            setConferencesOnline(confRoomsOnline);
        };

        webRTCService.onParticipantTrack = async (participantId, track) => {
            console.log('CallContext: onParticipantTrack');

            if (!participantId) {
                console.error("CallContext: no userid");
                return;
            }

            if (!track) {
                console.error("CallContext: no track");
                return;
            }

            console.log(`CallContext: Remote stream added for ${participantId}`);            

        };

        webRTCService.onParticipantTrackToggled = async (participantId, track) => {
            console.warn(`CallContext: onParticipantTrackToggled ${participantId} ${track.kind}`);
            console.log(`call participants: `, callParticipants);

            if (!participantId) {
                console.error("CallContext: no userid");
                return;
            }

            if (!track) {
                console.error("CallContext: no track");
                return;
            }
                       
            setCallParticipants(prev => new Map(webRTCService.conferenceRoom.participants));
        };

        webRTCService.onInviteReceived = async (inviteReceivedMsg: InviteMsg) => {
            console.log(`CallContext: onInviteReceived ${inviteReceivedMsg.data.displayName} ${inviteReceivedMsg.data.participantId} ${inviteReceivedMsg.data.conferenceRoomName}`);
            // Auto-decline if already in a call
            if (isCallActive) {
                console.log("CallContext: already in a call, declining invite");
                webRTCService.declineInvite();
                return;
            }
            setPopUpMessage("");
            setInviteInfoReceived(inviteReceivedMsg);
            console.log("CallContext: setInviteInfoReceived ");

        };


        webRTCService.onConferenceJoined = async (conferenceId: string) => {
            console.log(`CallContext: onConferenceJoined ${conferenceId}, conferenceRoomName:${webRTCService.getConferenceRoom()?.conferenceRoomName}`);

            if (localParticipant.current.stream.getTracks().length === 0) {
                await getLocalMedia();
            }

            console.log(`participants in room: ${callParticipants.size}`)

            setIsCallActive(true);
            setInviteInfoReceived(null);
            setInviteInfoSend(null);
            setCallParticipants(prev => new Map(webRTCService.conferenceRoom.participants));

        };

        webRTCService.onConferenceEnded = async (conferenceId: string, reason: string) => {
            console.log(`CallContext: onConferenceEnded: conferenceId: ${conferenceId} reason: ${reason}`);
            setIsCallActive(false);
            setInviteInfoSend(null);
            setInviteInfoReceived(null);
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

            setCallParticipants(prev => new Map(webRTCService.conferenceRoom.participants));

        };

        webRTCService.onParticipantLeft = async (participantId) => {
            console.log(`CallContext: onParticipantLeft ${participantId}`);
            if (!participantId) {
                console.error('CallContext: Invalid participantId');
                return;
            }           
        };

        return () => { // Cleanup
            webRTCService.dispose();
        }
    }, [callParticipants, getLocalMedia, hidePopUp, isCallActive, showPopUp]);

    const getParticipantsOnline = useCallback(() => {
        webRTCService.getParticipantsOnline();
    }, []);

    const getConferenceRoomsOnline = useCallback(() => {
        webRTCService.getConferenceRoomsOnline();
    }, []);

    const sendInvite = useCallback(async (participantInfo: ParticipantInfo) => {
        console.log(`sendInvite to ${participantInfo.participantId} ${participantInfo.displayName}`);

        try {
            let inviteMsg = await webRTCService.sendInvite(participantInfo.participantId);
            inviteMsg.data.displayName = participantInfo.displayName;

            setInviteInfoSend(inviteMsg);
            console.log(`Call initiated to ${participantInfo.displayName}`);
        } catch (error) {
            console.error('Failed to initiate call:', error);
        }
    }, []);

    const acceptInvite = useCallback(async () => {
        try {
            await webRTCService.acceptInvite();
            console.log(`Call with ${inviteInfoReceived.data.displayName} accepted in room ${inviteInfoReceived.data.conferenceRoomName}`);
            setInviteInfoReceived(null);
        } catch (error) {
            console.error('error" acceptInvite:', error);
        }
    }, [inviteInfoReceived]);

    const declineInvite = useCallback(() => {
        webRTCService.declineInvite();
        setInviteInfoReceived(null);
    }, []);

    const cancelInvite = useCallback(() => {
        console.log(`Call to ${webRTCService.inviteSendMsg?.data.displayName} cancelled.`);
        webRTCService.endCall();
        setInviteInfoSend(null);
    }, []);

    const endCurrentCall = useCallback(() => {
        console.log("Ending current call context-wise.");
        webRTCService.endCall();
        setIsCallActive(false);
        setInviteInfoSend(null);
        setInviteInfoReceived(null);
    }, []);

    const createConference = useCallback((trackingId: string, roomName: string) => {
        console.log("CallContext: createConference");

        webRTCService.createConferenceRoom(trackingId, roomName);
    }, []);

    const joinConference = useCallback((conferenceRoomId: string) => {
        console.log("CallContext: joinConference");

        if (!conferenceRoomId) {
            console.error("CallContext: joinConference: conferenceRoomId is required");
            return;
        }
        webRTCService.joinConferenceRoom(conferenceRoomId)
    }, []);

    const toggleMuteAudio = useCallback((participantId: string, isMuted: boolean) => {
        console.log("CallContext: toggleMuteAudio");

        let participant = webRTCService.participants.get(participantId);
        if (!participant) {
            console.error(`participant not found ${participantId}`);
            return;
        }
        let audioTrack = participant.stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !isMuted;
            console.log(`audioTrack.enabled: ${audioTrack.enabled} ${audioTrack.id}`);
            webRTCService.updateTrackEnabled(participantId);
        } else {
            console.log("CallContext: audioTrack not found");
        }
    }, []);

    const toggleMuteVideo = useCallback((participantId: string, isMuted: boolean) => {
        console.log("CallContext: toggleMuteVideo");
        let participant = callParticipants.get(participantId);
        if (!participant) {
            console.error(`participant not found ${participantId}`);
            return;
        }

        let videoTrack = participant.stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !isMuted;
            console.log(`videoTrack.enabled: ${videoTrack.enabled} ${videoTrack.id}`);
            webRTCService.updateTrackEnabled(participantId);


        } else {
            console.log("CallContext: videoTrack not found");
        }
    }, [callParticipants]);

    const startScreenShare = useCallback(async () => {
        console.log(`startScreenShare`);

        let cameraTrack = localParticipant.current.stream.getVideoTracks()[0];
        if (cameraTrack) {
            cameraTrack.enabled = false; // Disable the camera track if it exists
        }

        const screenTrack = await webRTCService.getScreenTrack();
        console.log(`after cameraTrack: readyState ${cameraTrack.readyState} ${cameraTrack.id}`);

        if (screenTrack) {
            isScreenSharing.current = true;
            webRTCService.publishTracks([screenTrack]); // Replace the camera track with the screen track            
        }

        //trigger a refresh of the local stream
        setIsLocalStreamUpdated(true);

        console.log(`end of function cameraTrack: readyState ${cameraTrack.readyState} ${cameraTrack.id}`);
    }, []);

    const stopScreenShare = useCallback(async () => {
        console.log("stopScreenShare");

        try {

            const screenTrack = localParticipant.current.stream.getVideoTracks().find(track => track.label === 'screen');

            if (screenTrack) {
                console.log(`Stopping screenTrack: ${screenTrack.id}`);
                screenTrack.stop(); // Stop the screen-sharing track
                webRTCService.unPublishTracks([screenTrack]); // Unpublish the screen track
            } else {
                console.error("screen track not found")
            }

            await webRTCService.getNewTracks(getMediaContraints());
            let cameraTrack = webRTCService.localStream.getVideoTracks()[0];

            if (cameraTrack) {
                console.log(`Using cameraTrack: ${cameraTrack.readyState} ${cameraTrack.kind} ${cameraTrack.id}`);
                console.log("tracks:", localParticipant.current.stream.getVideoTracks());
                // Update state
                isScreenSharing.current = false;
                setIsLocalStreamUpdated(true);
            }
        } catch (error) {
            console.error("Error stopping screen share:", error);
        }
    }, [getMediaContraints]);

    const switchDevices = useCallback(async (videoId: string, audioId: string, speakerId: string) => {
        console.log(`switchDevices videoId:${videoId}, audioId:${audioId}, speakerId:${speakerId}, micEnabled:${selectedDevices.current.isAudioEnabled}, cameraEnabled:${selectedDevices.current.isVideoEnabled}`);

        //set selected devices
        if (selectedDevices.current.videoId !== videoId) {
            selectedDevices.current.videoId = videoId ?? selectedDevices.current.videoId;
        }

        if (selectedDevices.current.audioInId !== audioId) {
            selectedDevices.current.audioInId = audioId ?? selectedDevices.current.audioInId;
        }

        if (selectedDevices.current.audioOutId !== speakerId) {
            selectedDevices.current.audioOutId = speakerId ?? selectedDevices.current.audioOutId;
        }

        const constraints = {
            audio: selectedDevices.current.audioInId ? { deviceId: { exact: selectedDevices.current.audioInId } } : true,
            video: selectedDevices.current.videoId ? { deviceId: { exact: selectedDevices.current.videoId } } : true
        };

        //get new stream based on devices
        await webRTCService.getNewTracks(constraints);

        let videoTrack = webRTCService.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = selectedDevices.current.isVideoEnabled;
        }

        let audioTrack = webRTCService.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = selectedDevices.current.isAudioEnabled;
        }
        setIsLocalStreamUpdated(true);
    }, []);

    useEffect(() => {
        setupWebRTCEvents();
    }, [setupWebRTCEvents]);

    return (
        <CallContext.Provider value={{
            isAuthenticated,
            isConnected,
            localParticipant: localParticipant.current,            
            isLocalStreamUpdated,
            isCallActive: isCallActive,
            conferenceRoom: conferenceRoom.current,
            callParticipants,
            isScreenSharing: isScreenSharing.current,
            participantsOnline: participantsOnline,
            conferencesOnline: conferencesOnline,
            inviteInfoSend,
            inviteInfoReceived,

            setInviteInfoSend,
            availableDevices: availableDevices,
            selectedDevices: selectedDevices.current,
            popUpMessage: popUpMessage,
            hidePopUp,

            getLocalMedia,

            getConferenceRoomsOnline,
            getParticipantsOnline,

            createConference,
            joinConference,

            sendInvite,
            acceptInvite,
            declineInvite,
            cancelInvite,
            endCurrentCall,

            toggleMuteAudio,
            toggleMuteVideo,

            startScreenShare,
            stopScreenShare,

            getMediaDevices,
            switchDevices,

        }}>
            {children}
        </CallContext.Provider>
    );
};