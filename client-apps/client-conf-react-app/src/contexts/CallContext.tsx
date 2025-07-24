import React, { createContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { ConferenceRoomScheduled, Device, SelectedDevices } from '../types';
import { conferenceService } from '../services/ConferenceService';
import { ConferenceRoomInfo, CreateConferenceParams, InviteMsg, JoinConferenceParams, ParticipantInfo } from '@conf/conf-models';
import { Conference, Participant } from '@conf/conf-client';
import { useUI } from '../hooks/useUI';
import { useAPI } from '../hooks/useAPI';
import { useCall } from '../hooks/useCall';
import { useConfig } from '../hooks/useConfig';

interface CallContextType {
    isConnected: boolean;
    isLoggedOff: boolean;
    setIsLoggedOff: React.Dispatch<React.SetStateAction<boolean>>;
    isAuthenticated: boolean;
    localParticipant: Participant;
    isLocalStreamUpdated: boolean;

    isCallActive: boolean;
    conference: Conference;
    callParticipants: Map<string, Participant>;

    isScreenSharing: boolean;
    participantsOnline: ParticipantInfo[];
    conferencesOnline: ConferenceRoomInfo[];
    inviteInfoSend: InviteMsg;
    inviteInfoReceived: InviteMsg;
    setInviteInfoSend: React.Dispatch<React.SetStateAction<InviteMsg>>;

    availableDevices: { video: Device[]; audioIn: Device[]; audioOut: Device[] };
    selectedDevices: SelectedDevices;
    setSelectedDevices: React.Dispatch<React.SetStateAction<SelectedDevices>>;


    getLocalMedia: () => Promise<MediaStreamTrack[]>;
    getMediaConstraints: () => MediaStreamConstraints;
    getConferenceRoomsOnline: () => void;
    getParticipantsOnline: () => void;

    createConference: (externalId: string, roomName: string) => void;
    joinConference: (conferenceCode: string, scheduled: ConferenceRoomScheduled, startWithAudioEnabled: boolean, startWithVideoEnabled: boolean) => void;
    createConferenceOrJoin: (externalId: string, conferenceCode: string, startWithAudioEnabled: boolean, startWithVideoEnabled: boolean) => void;

    sendInvite: (participantInfo: ParticipantInfo, startWithAudioEnabled: boolean, startWithVideoEnabled: boolean) => Promise<void>;
    acceptInvite: () => Promise<void>;
    declineInvite: () => void;
    cancelInvite: () => void;

    endCurrentCall: () => void;

    broadCastTrackInfo: () => void;
    muteParticipantTrack: (participantId: string, audioEnabled: boolean, videoEnabled: boolean) => void;

    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;

    getMediaDevices: () => Promise<void>;
    switchDevices: (videoId: string, audioId: string, audioOutId: string, isAudioEnabled: boolean, isVideoEnabled: boolean) => Promise<void>;

}

export const CallContext = createContext<CallContextType>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const ui = useUI();
    const api = useAPI();
    const { config } = useConfig();

    const [isConnected, setIsConnected] = useState<boolean>(conferenceService.isConnected);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(conferenceService.isConnected && conferenceService.localParticipant.peerId ? true : false);
    const [isLoggedOff, setIsLoggedOff] = useState<boolean>(false);

    const localParticipant = useRef<Participant>(conferenceService.localParticipant);
    const [isCallActive, setIsCallActive] = useState<boolean>(conferenceService.isOnCall());
    const [conference, setConferenceRoom] = useState<Conference>(conferenceService.conference);
    const [callParticipants, setCallParticipants] = useState<Map<string, Participant>>(conferenceService.participants);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(conferenceService.isScreenSharing);
    const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>(conferenceService.selectedDevices);

    const [participantsOnline, setParticipantsOnline] = useState<ParticipantInfo[]>(conferenceService.participantsOnline);
    const [conferencesOnline, setConferencesOnline] = useState<ConferenceRoomInfo[]>(conferenceService.conferencesOnline);
    const [inviteInfoSend, setInviteInfoSend] = useState<InviteMsg | null>(conferenceService.inviteSendMsg);
    const [inviteInfoReceived, setInviteInfoReceived] = useState<InviteMsg | null>(conferenceService.inviteRecievedMsg);

    const [isLocalStreamUpdated, setIsLocalStreamUpdated] = useState<boolean>(false);
    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });

    useEffect(() => {
        conferenceService.init(config);

        //init all default values
        setIsConnected(conferenceService.isConnected);
        setIsAuthenticated(conferenceService.isConnected && conferenceService.localParticipant.peerId ? true : false);
        localParticipant.current = conferenceService.localParticipant;
        setIsCallActive(conferenceService.isOnCall());
        setConferenceRoom(conferenceService.conference);
        setCallParticipants(conferenceService.participants);

        setIsScreenSharing(conferenceService.isScreenSharing);
        setSelectedDevices(conferenceService.selectedDevices);

        setParticipantsOnline(conferenceService.participantsOnline);
        setConferencesOnline(conferenceService.conferencesOnline);
        setInviteInfoSend(conferenceService.inviteSendMsg);
        setInviteInfoReceived(conferenceService.inviteRecievedMsg);

    }, [config])

    useEffect(() => {
        console.log(`** CallProvider mounted isAuthenticated:${isAuthenticated} isConnected: ${isConnected}`);
        console.log(`** CallProvider mounted conferenceService.localParticipant.peerId:${conferenceService.localParticipant.peerId} conferenceService.isConnected: ${conferenceService.isConnected}`);

        return () => console.log("CallProvider unmounted");
    }, [isAuthenticated, isConnected]);

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
            if (!selectedDevices.videoId && video.length > 0) {
                selectedDevices.videoId = video[0].id;
                selectedDevices.videoLabel = video[0].label;
            }
            if (!selectedDevices.audioInId && audioIn.length > 0) {
                selectedDevices.audioInId = audioIn[0].id;
                selectedDevices.audioInLabel = audioIn[0].label;
            }
            if (!selectedDevices.audioOutId && audioOut.length > 0) {
                selectedDevices.audioOutId = audioOut[0].id;
                selectedDevices.audioOutLabel = audioOut[0].label;
            }

        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }, [selectedDevices]);

    const getMediaConstraints = useCallback((): MediaStreamConstraints => {
        const constraints = {
            audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
            video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
        };
        return constraints;
    }, [selectedDevices]);

    const getLocalMedia = useCallback(async () => {
        console.log("getLocalMedia");
        let tracks = await conferenceService.getNewTracksForLocalParticipant(getMediaConstraints());
        setIsLocalStreamUpdated(true);
        console.log("setIsLocalStreamUpdated");
        return tracks;
    }, [getMediaConstraints]);

    useEffect(() => {
        getMediaDevices();
        navigator.mediaDevices.addEventListener('devicechange', getMediaDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getMediaDevices);
        };
    }, [getMediaDevices]);

    const setupWebRTCEvents = useCallback(() => {

        conferenceService.onRegistered = async (participantId: string) => {
            console.log("CallContext: onRegistered: participantId", participantId);
            getConferenceRoomsOnline();
            setIsAuthenticated(true);
            ui.hidePopUp();
        }

        conferenceService.onRegisterFailed = async (error: string) => {
            console.log("CallContext: onRegisterFailed: error", error);
            setIsAuthenticated(false);
            ui.showPopUp(`socket registration failed. ${error}`);

            //try again
            if (conferenceService.localUser && conferenceService.localUser.username && conferenceService.localUser.authToken) {
                setTimeout(() => {
                    ui.showToast("trying to register socket...");
                    conferenceService.registerConnection(conferenceService.localUser);
                }, 5000);
            } else {
                console.error(`invalid credentials.`);
            }
        }
        conferenceService.onLoggedOff = async (reason: string) => {
            console.log("CallContext: onLoggedOff: reason", reason);
            setIsLoggedOff(true);
        }

        conferenceService.onServerConnected = async () => {
            console.log("CallContext: server connected");
            setIsConnected(true);
            ui.hidePopUp();
            ui.showToast("connected to server");
        }

        conferenceService.onServerDisconnected = async () => {
            console.log("CallContext: disconnected from server");
            setIsConnected(false);
            setIsAuthenticated(false);
            setIsCallActive(false);
            setConferenceRoom(conferenceService.conference);

            ui.showToast("disconnected from server. trying to reconnect...");
        }

        conferenceService.onParticipantsReceived = async (participants) => {
            console.log("CallContext: onContactsReceived", participants);
            setParticipantsOnline(participants);
        };

        conferenceService.onConferencesReceived = async (confRoomsOnline) => {
            console.log("CallContext: onConferencesReceived", confRoomsOnline);
            setConferencesOnline(confRoomsOnline);
        };

        conferenceService.onParticipantTrack = async (participantId, track) => {
            console.log('CallContext: onParticipantTrack');

            if (!participantId) {
                console.error("CallContext: no participantId");
                return;
            }

            if (!track) {
                console.error("CallContext: no track");
                return;
            }

            //update the call participants
            setCallParticipants(prev => new Map(conferenceService.conference.participants));

        };

        conferenceService.onParticipantTrackInfoUpdated = async (participantId: string) => {
            console.log(`CallContext: onParticipantTrackInfoUpdated ${participantId}`);
            console.log(`CallContext: call participants: `, callParticipants);

            if (!participantId) {
                console.error("CallContext: no participantId");
                return;
            }

            setCallParticipants(prev => new Map(conferenceService.conference.participants));
        };

        conferenceService.onInviteReceived = async (inviteReceivedMsg: InviteMsg) => {
            console.log(`CallContext: onInviteReceived ${inviteReceivedMsg.data.displayName} ${inviteReceivedMsg.data.participantId} ${inviteReceivedMsg.data.conferenceName}`);
            // Auto-decline if already in a call
            if (isCallActive) {
                console.log("CallContext: already in a call, declining invite");
                conferenceService.declineInvite();
                return;
            }
            ui.hidePopUp();
            setInviteInfoReceived(inviteReceivedMsg);
            console.log("CallContext: setInviteInfoReceived ");

        };

        conferenceService.onConferenceJoined = async (conferenceId: string) => {
            console.log(`CallContext: onConferenceJoined ${conferenceId}, conferenceName:${conferenceService.getConferenceRoom()?.conferenceName}`);

            console.log(`participants in room: ${callParticipants.size}`)
            console.log(`localParticipant tracksInfo:`, localParticipant.current.tracksInfo);

            setIsCallActive(true);
            setInviteInfoReceived(null);
            setInviteInfoSend(null);
            setCallParticipants(prev => new Map(conferenceService.conference.participants));
            setConferenceRoom(conferenceService.conference);
            ui.showToast("conference joined");

        };

        conferenceService.onConferenceEnded = async (conferenceId: string, reason: string) => {
            console.log(`CallContext: onConferenceEnded: conferenceId: ${conferenceId} reason: ${reason}`);
            setIsCallActive(false);
            setInviteInfoSend(null);
            setInviteInfoReceived(null);
            setConferenceRoom(conferenceService.conference);

            ui.hidePopUp();

            if (reason) {
                ui.showPopUp(reason, 3);
                return;
            }

        };

        conferenceService.onParticipantJoined = async (participantId: string, displayName: string) => {
            console.log(`CallContext: onParticipantJoined ${displayName} (${participantId})`);
            if (!participantId) {
                console.error("no participantId");
                return;
            }

            setCallParticipants(prev => new Map(conferenceService.conference.participants));

        };

        conferenceService.onParticipantLeft = async (participantId) => {
            console.log(`CallContext: onParticipantLeft ${participantId}`);
            if (!participantId) {
                console.error('CallContext: Invalid participantId');
                return;
            }
            setCallParticipants(prev => new Map(conferenceService.conference.participants));
        };


        return () => { // Cleanup
            conferenceService.disconnectSignaling("callContext cleanup");
        }
    }, [ui, callParticipants, isCallActive, getLocalMedia]);

    const getParticipantsOnline = useCallback(() => {
        conferenceService.getParticipantsOnline();
    }, []);

    const getConferenceRoomsOnline = useCallback(() => {
        conferenceService.getConferenceRoomsOnline();
    }, []);

    const sendInvite = useCallback(async (participantInfo: ParticipantInfo, startWithAudioEnabled: boolean, startWithVideoEnabled: boolean) => {
        console.log(`sendInvite to ${participantInfo.participantId} ${participantInfo.displayName}`);

        try {
            //at least one device must be enabled
            if (!selectedDevices.isAudioEnabled && !selectedDevices.isVideoEnabled) {
                ui.showPopUp("at least one device must be enabled. please check your settings.");
                return;
            }
            //if no local tracks
            if (localParticipant.current.stream.getTracks().length === 0) {
                console.error(`no media tracks`);
                ui.showPopUp("no devices enabled.");
                return;
            }

            let joinArgs: JoinConferenceParams = {
                //audioEnabledOnStart: startWithAudioEnabled,
                //videoEnabledOnStart: startWithVideoEnabled,
                clientData: api.getCurrentUser()?.clientData,
                conferenceCode: "",
                conferenceId: "",
                roomName: "",
                externalId: "",
            }

            let inviteMsg = await conferenceService.sendInvite(participantInfo.participantId, joinArgs);
            if (!inviteMsg) {
                ui.showPopUp("error unable to initiate a new call");
                return;
            }
            inviteMsg.data.displayName = participantInfo.displayName;
            setInviteInfoSend(inviteMsg);

            console.log(`Call initiated to ${participantInfo.displayName}`);
        } catch (error) {
            console.error('Failed to initiate call:', error);
        }
    }, [api, selectedDevices.isAudioEnabled, selectedDevices.isVideoEnabled, ui]);

    const acceptInvite = useCallback(async () => {
        try {

            let joinArgs: JoinConferenceParams = {
                //audioEnabledOnStart: selectedDevices.isAudioEnabled,
                //videoEnabledOnStart: selectedDevices.isVideoEnabled,
                clientData: api.getCurrentUser().clientData,
                conferenceCode: "",
                conferenceId: inviteInfoReceived.data.conferenceId,
                externalId: inviteInfoReceived.data.conferenceExternalId,
                roomName: ""
            };

            await conferenceService.acceptInvite(joinArgs);

            console.log(`Call with ${inviteInfoReceived.data.displayName} accepted in room ${inviteInfoReceived.data.conferenceName}`);
            setInviteInfoReceived(null);
        } catch (error) {
            console.error('error" acceptInvite:', error);
        }
    }, [api, inviteInfoReceived, selectedDevices]);

    const declineInvite = useCallback(() => {
        conferenceService.declineInvite();
        setInviteInfoReceived(null);
    }, []);

    const cancelInvite = useCallback(() => {
        console.log(`Call to ${conferenceService.inviteSendMsg?.data.displayName} cancelled.`);
        conferenceService.endCall();
        setInviteInfoSend(null);
    }, []);

    const endCurrentCall = useCallback(() => {
        console.log("Ending current call context-wise.");
        conferenceService.endCall();
        setIsCallActive(false);
        setInviteInfoSend(null);
        setInviteInfoReceived(null);
    }, []);

    const createConference = useCallback((externalId: string, roomName: string) => {
        console.log("CallContext: createConference");
        let createArgs: CreateConferenceParams = {
            conferenceCode: "",
            externalId: externalId,
            roomName: roomName,
            conferenceId: "",
            config: null
        }

        conferenceService.createConferenceRoom(createArgs);
    }, []);

    const joinConference = useCallback((conferenceCode: string, scheduled: ConferenceRoomScheduled, startWithAudioEnabled: boolean, startWithVideoEnabled: boolean) => {
        console.log("CallContext: joinConference");

        if (!scheduled.conferenceId) {
            console.error("CallContext: joinConference: conferenceId is required");
            return;
        }
        let joinArgs: JoinConferenceParams = {
            //audioEnabledOnStart: startWithAudioEnabled,
            //videoEnabledOnStart: startWithVideoEnabled
            clientData: api.getCurrentUser()?.clientData,
            conferenceCode: conferenceCode,
            conferenceId: scheduled.conferenceId,
            roomName: "",
            externalId: scheduled.externalId,
        }

        conferenceService.joinConferenceRoom(joinArgs)
    }, [api]);

    const createConferenceOrJoin = useCallback((externalId: string, conferenceCode: string, startWithAudioEnabled: boolean, startWithVideoEnabled: boolean) => {
        console.log("CallContext: createConferenceOrJoin ", externalId, conferenceCode);
        let createArgs: CreateConferenceParams = {
            conferenceCode: conferenceCode,
            conferenceId: "",
            config: null,
            roomName: "",
            externalId: externalId
        };

        let joinArgs: JoinConferenceParams = {
            //audioEnabledOnStart: startWithAudioEnabled,
            //videoEnabledOnStart: startWithVideoEnabled
            clientData: api.getCurrentUser()?.clientData,
            conferenceCode: conferenceCode,
            conferenceId: "",
            roomName: "",
            externalId: externalId,

        }

        conferenceService.createConferenceAndJoin(createArgs, joinArgs);

    }, [api]);

    const muteParticipantTrack = useCallback((participantId: string, audioEnabled: boolean, videoEnabled: boolean) => {
        console.log("CallContext: muteParticipantTrack");

        let participant = conferenceService.participants.get(participantId);
        if (!participant) {
            console.error(`participant not found ${participantId}`);
            return;
        }
        conferenceService.muteParticipantTrack(participantId, audioEnabled, videoEnabled);

    }, []);

    const broadCastTrackInfo = useCallback(() => {
        console.log("CallContext: enableTrack");
        conferenceService.broadCastTrackInfo();
    }, []);

    const startScreenShare = useCallback(async () => {
        console.log(`startScreenShare`);

        let cameraTrack = localParticipant.current.stream.getVideoTracks()[0];
        if (cameraTrack) {
            cameraTrack.enabled = false; // Disable the camera track if it exists
        }

        const screenTrack = await conferenceService.getScreenTrack();
        console.log(`after cameraTrack: readyState ${cameraTrack.readyState} ${cameraTrack.id}`);

        if (screenTrack) {
            setIsScreenSharing(true);
            conferenceService.publishTracks([screenTrack]); // Replace the camera track with the screen track            
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
                conferenceService.unPublishTracks([screenTrack]); // Unpublish the screen track
            } else {
                console.error("screen track not found")
            }

            let newTracks = await conferenceService.getNewTracksForLocalParticipant(getMediaConstraints());
            let cameraTrack = newTracks.find(t => t.kind === "video");

            if (cameraTrack) {
                console.log(`Using cameraTrack: ${cameraTrack.readyState} ${cameraTrack.kind} ${cameraTrack.id}`);
                setIsScreenSharing(false);
                setIsLocalStreamUpdated(true);
            }

            await conferenceService.publishTracks(newTracks);

        } catch (error) {
            console.error("Error stopping screen share:", error);
        }
    }, [getMediaConstraints]);

    const switchDevices = useCallback(async (videoId: string, audioId: string, speakerId: string, isAudioEnabled: boolean, isVideoEnabled: boolean) => {
        console.log(`switchDevices videoId:${videoId}, audioId:${audioId}, speakerId:${speakerId}, micEnabled:${selectedDevices.isAudioEnabled}, cameraEnabled:${selectedDevices.isVideoEnabled}`);

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

        selectedDevices.isAudioEnabled = isAudioEnabled;
        selectedDevices.isVideoEnabled = isVideoEnabled;

        const constraints = {
            audio: selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true,
            video: selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true
        };

        //get new stream based on devices
        await conferenceService.getNewTracksForLocalParticipant(constraints);

        let videoTrack = conferenceService.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = selectedDevices.isVideoEnabled;
        }

        let audioTrack = conferenceService.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = selectedDevices.isAudioEnabled;
        }
        console.log(`selected Device settings:`, selectedDevices);

        setSelectedDevices(selectedDevices);

        setIsLocalStreamUpdated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setupWebRTCEvents();
    }, [setupWebRTCEvents]);

    return (
        <CallContext.Provider value={{
            isConnected,
            isAuthenticated,
            isLoggedOff, setIsLoggedOff,
            localParticipant: localParticipant.current,
            isLocalStreamUpdated,

            isCallActive: isCallActive,
            conference: conference,
            callParticipants,
            isScreenSharing: isScreenSharing,
            participantsOnline: participantsOnline,
            conferencesOnline: conferencesOnline,
            inviteInfoSend,
            inviteInfoReceived,

            setInviteInfoSend,
            availableDevices,
            selectedDevices,
            setSelectedDevices,

            getLocalMedia,
            getMediaConstraints,

            getConferenceRoomsOnline,
            getParticipantsOnline,

            createConference,
            joinConference,
            createConferenceOrJoin,

            sendInvite,
            acceptInvite,
            declineInvite,
            cancelInvite,
            endCurrentCall,

            broadCastTrackInfo,
            muteParticipantTrack,

            startScreenShare,
            stopScreenShare,

            getMediaDevices,
            switchDevices,

        }}>
            {children}
        </CallContext.Provider>
    );
};