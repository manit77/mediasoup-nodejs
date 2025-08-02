import React, { createContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { ConferenceClosedMsg, ConferenceScheduledInfo, CreateConferenceParams, GetConferencesScheduledResultMsg, GetParticipantsResultMsg, GetUserMediaConfig, InviteMsg, JoinConferenceParams, ParticipantInfo } from '@conf/conf-models';
import { Conference, conferenceClient, Device, getBrowserDisplayMedia, getBrowserUserMedia, Participant, SelectedDevices } from '@conf/conf-client';
import { useUI } from '../hooks/useUI';
import { useAPI } from '../hooks/useAPI';
import { useConfig } from '../hooks/useConfig';
import { IMsg } from '@rooms/rooms-models';
import { EventParticpantNewTrackMsg, EventTypes } from '@conf/conf-client';

interface CallContextType {
    isConnected: boolean;
    isLoggedOff: boolean;
    setIsLoggedOff: React.Dispatch<React.SetStateAction<boolean>>;
    isAuthenticated: boolean;
    localParticipant: Participant;
    isLocalStreamUpdated: boolean;
    presenter: Participant;

    isCallActive: boolean;
    conference: Conference;
    callParticipants: Map<string, Participant>;

    isScreenSharing: boolean;
    participantsOnline: ParticipantInfo[];
    conferencesOnline: ConferenceScheduledInfo[];
    inviteInfoSend: InviteMsg;
    inviteInfoReceived: InviteMsg;
    setInviteInfoSend: React.Dispatch<React.SetStateAction<InviteMsg>>;

    availableDevices: { video: Device[]; audioIn: Device[]; audioOut: Device[] };
    selectedDevices: SelectedDevices;
    setSelectedDevices: React.Dispatch<React.SetStateAction<SelectedDevices>>;

    getLocalMedia: (options: GetUserMediaConfig) => Promise<MediaStreamTrack[]>;
    getMediaConstraints: (getAudio: boolean, getVideo: boolean) => MediaStreamConstraints;
    getConferenceRoomsOnline: () => void;
    getParticipantsOnline: () => void;

    createConference: (externalId: string, roomName: string) => void;
    joinConference: (conferenceCode: string, scheduled: ConferenceScheduledInfo) => void;
    createConferenceOrJoin: (externalId: string, conferenceCode: string) => void;

    sendInvite: (participantInfo: ParticipantInfo, options: GetUserMediaConfig) => Promise<void>;
    acceptInvite: () => Promise<void>;
    declineInvite: () => void;
    cancelInvite: () => void;

    endCurrentCall: () => void;

    broadCastTrackInfo: () => void;
    muteParticipantTrack: (participantId: string, audioEnabled: boolean, videoEnabled: boolean) => void;

    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;

    getMediaDevices: () => Promise<void>;
    switchDevicesOnCall: () => Promise<void>;//, isAudioEnabled: boolean, isVideoEnabled: boolean) => Promise<void>;

}

export const CallContext = createContext<CallContextType>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const ui = useUI();
    const api = useAPI();
    const { config } = useConfig();

    const [isConnected, setIsConnected] = useState<boolean>(conferenceClient.isConnected);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(conferenceClient.isConnected && conferenceClient.localParticipant.participantId ? true : false);
    const [isLoggedOff, setIsLoggedOff] = useState<boolean>(false);

    const localParticipant = useRef<Participant>(conferenceClient.localParticipant);
    const [presenter, setPresenter] = useState<Participant>(conferenceClient.conference?.presenter);
    const [isCallActive, setIsCallActive] = useState<boolean>(conferenceClient.isInConference());
    const [conference, setConferenceRoom] = useState<Conference>(conferenceClient.conference);
    const [callParticipants, setCallParticipants] = useState<Map<string, Participant>>(conferenceClient.conference.participants);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(conferenceClient.isScreenSharing);
    const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>(conferenceClient.selectedDevices);


    const [participantsOnline, setParticipantsOnline] = useState<ParticipantInfo[]>(conferenceClient.participantsOnline);
    const [conferencesOnline, setConferencesOnline] = useState<ConferenceScheduledInfo[]>(conferenceClient.conferencesOnline);
    const [inviteInfoSend, setInviteInfoSend] = useState<InviteMsg | null>(conferenceClient.inviteSendMsg);
    const [inviteInfoReceived, setInviteInfoReceived] = useState<InviteMsg | null>(conferenceClient.inviteReceivedMsg);

    const [isLocalStreamUpdated, setIsLocalStreamUpdated] = useState<boolean>(false);
    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });

    useEffect(() => {
        conferenceClient.init(config);

        //init all default values
        setIsConnected(conferenceClient.isConnected);
        setIsAuthenticated(conferenceClient.isConnected && conferenceClient.localParticipant.participantId ? true : false);
        localParticipant.current = conferenceClient.localParticipant;
        setIsCallActive(conferenceClient.isInConference());
        setConferenceRoom(conferenceClient.conference);
        setCallParticipants(conferenceClient.conference.participants);

        setIsScreenSharing(conferenceClient.isScreenSharing);
        setSelectedDevices(conferenceClient.selectedDevices);

        setParticipantsOnline(conferenceClient.participantsOnline);
        setConferencesOnline(conferenceClient.conferencesOnline);
        setInviteInfoSend(conferenceClient.inviteSendMsg);
        setInviteInfoReceived(conferenceClient.inviteReceivedMsg);

    }, [config])

    useEffect(() => {
        console.log(`** CallProvider mounted isAuthenticated:${isAuthenticated} isConnected: ${isConnected}`);
        console.log(`** CallProvider mounted conferenceClient.localParticipant.peerId:${conferenceClient.localParticipant.peerId} conferenceClient.isConnected: ${conferenceClient.isConnected}`);

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

    const getMediaConstraints = useCallback((getAudio: boolean, getVideo: boolean): MediaStreamConstraints => {
        const constraints: { audio?: any, video?: any } = {};

        if (getAudio) {
            constraints.audio = selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true;
        }
        if (getVideo) {
            constraints.video = selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId } } : true;
        }
        return constraints;
    }, [selectedDevices]);

    const getLocalMedia = useCallback(async (options: GetUserMediaConfig) => {
        console.log("getLocalMedia");

        if (!options.isAudioEnabled && !options.isVideoEnabled) {
            ui.showToast(`at least one device must be enabled.`);
            return;
        }

        if (!options.constraints) {
            options.constraints = getMediaConstraints(options.isAudioEnabled, options.isVideoEnabled);
        }

        const tracks = await conferenceClient.getNewTracksForLocalParticipant(options);
        const audioTrack = tracks.find(t => t.kind === "audio");
        if (audioTrack) {
            audioTrack.enabled = options.isAudioEnabled;
        }

        const videoTrack = tracks.find(t => t.kind === "video");
        if (videoTrack) {
            videoTrack.enabled = options.isVideoEnabled;
        }

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

    const getParticipantsOnline = useCallback(() => {
        conferenceClient.getParticipantsOnline();
    }, []);

    const getConferenceRoomsOnline = useCallback(() => {
        conferenceClient.getConferenceRoomsOnline();
    }, []);

    const setupWebRTCEvents = useCallback(() => {

        conferenceClient.onEvent = async (eventType: EventTypes, msgIn: IMsg) => {
            switch (eventType) {
                case EventTypes.registerResult:
                    console.warn("CallContext: registerResult", msgIn.data);
                    if (msgIn.data.error) {
                        console.log("CallContext: onRegisterFailed: error", msgIn.data.error);
                        setIsAuthenticated(false);
                        ui.showPopUp(`socket registration failed. ${msgIn.data.error}`, "error");
                        return;
                    }
                    getConferenceRoomsOnline();
                    setIsAuthenticated(true);
                    ui.hidePopUp();

                    break;
                case EventTypes.connected:
                    console.log("CallContext: server connected");
                    setIsConnected(true);
                    ui.hidePopUp();
                    ui.showToast("connected to server");
                    break;
                case EventTypes.disconnected:

                    console.log("CallContext: disconnected from server");
                    setIsConnected(false);
                    setIsAuthenticated(false);
                    setIsCallActive(false);
                    setConferenceRoom(conferenceClient.conference);
                    ui.showToast("disconnected from server. trying to reconnect...");
                    break;
                case EventTypes.participantsReceived: {
                    let msg = msgIn as GetParticipantsResultMsg;
                    console.log("CallContext: onContactsReceived", msg.data.participants);
                    setParticipantsOnline(msg.data.participants);
                    break;
                }
                case EventTypes.conferencesReceived: {
                    const msg = msgIn as GetConferencesScheduledResultMsg
                    console.log("CallContext: onConferencesReceived", msg.data.conferences);
                    setConferencesOnline(msg.data.conferences);
                    break;
                }
                case EventTypes.participantNewTrack: {
                    let msg = msgIn as EventParticpantNewTrackMsg;

                    console.log('CallContext: onParticipantTrack');

                    if (!msg.data.participantId) {
                        console.error("CallContext: no participantId");
                        return;
                    }

                    if (!msg.data.track) {
                        console.error("CallContext: no track");
                        return;
                    }

                    //update the call participants
                    setCallParticipants(prev => new Map(conferenceClient.conference.participants));

                    break;
                }
                case EventTypes.participantTrackInfoUpdated: {
                    let participantId = msgIn.data.participantId;

                    console.log(`CallContext: onParticipantTrackInfoUpdated ${participantId}`);
                    console.log(`CallContext: call participants: `, callParticipants);

                    if (!participantId) {
                        console.error("CallContext: no participantId");
                        return;
                    }

                    setCallParticipants(prev => new Map(conferenceClient.conference.participants));
                    break;
                }
                case EventTypes.inviteReceived: {
                    let msg = msgIn as InviteMsg;
                    console.log(`CallContext: onInviteReceived ${msg.data.displayName} ${msg.data.participantId} ${msg.data.conferenceName}`);

                    ui.hidePopUp();
                    setInviteInfoReceived(msg);
                    console.log("CallContext: setInviteInfoReceived ");

                    break;
                }
                case EventTypes.rejectReceived: {
                    console.log(`CallContext: call was rejected.`);

                    ui.showToast("call was rejected.", "warning");
                    setIsCallActive(false);
                    setInviteInfoSend(null);
                    setInviteInfoReceived(null);
                    setConferenceRoom(conferenceClient.conference);

                    break;
                }
                case EventTypes.conferenceJoined: {
                    console.log(`CallContext: onConferenceJoined ${conferenceClient.conference.conferenceId}, conferenceName:${conferenceClient.conference.conferenceName}`);

                    console.log(`participants in room: ${callParticipants.size}`)
                    console.log(`localParticipant tracksInfo:`, localParticipant.current.tracksInfo);

                    setIsCallActive(true);
                    setInviteInfoReceived(null);
                    setInviteInfoSend(null);
                    setCallParticipants(prev => new Map(conferenceClient.conference.participants));
                    setConferenceRoom(conferenceClient.conference);
                    ui.showToast("conference joined");

                    break;
                }
                case EventTypes.conferenceClosed: {
                    let msg = msgIn as ConferenceClosedMsg;
                    console.log(`CallContext: onConferenceEnded: conferenceId: ${msg.data.conferenceId} reason: ${msg.data.reason}`);
                    setIsCallActive(false);
                    setInviteInfoSend(null);
                    setInviteInfoReceived(null);
                    setConferenceRoom(conferenceClient.conference);

                    if (msg.data.reason) {
                        ui.showToast(msg.data.reason);
                        return;
                    }

                    break;
                }
                case EventTypes.participantJoined: {
                    console.log(`CallContext: onParticipantJoined ${msgIn.data.displayName} (${msgIn.data.participantId})`);
                    setCallParticipants(prev => new Map(conferenceClient.conference.participants));
                    break;
                }
                case EventTypes.participantLeft: {
                    console.log(`CallContext: onParticipantJoined ${msgIn.data.displayName} (${msgIn.data.participantId})`);
                    setCallParticipants(prev => new Map(conferenceClient.conference.participants));
                    break;
                }
                case EventTypes.prensenterInfo: {
                    console.log(`CallContext: prensenterInfo ${msgIn.data.participantId}) ${conferenceClient.conference.presenter.displayName}`);
                    setPresenter(conferenceClient.conference.presenter);
                    break;
                }
            }

        };
        return () => { // Cleanup
            conferenceClient.disconnect();
        }
    }, [callParticipants, getConferenceRoomsOnline, ui]);

    const sendInvite = useCallback(async (participantInfo: ParticipantInfo, options: GetUserMediaConfig) => {
        console.log(`sendInvite to ${participantInfo.participantId} ${participantInfo.displayName}`);

        try {

            if (isCallActive) {
                console.error(`call isCallActive`);
                ui.showPopUp("error: call is active.", "error");
                return;
            }

            if (inviteInfoSend) {
                console.error(`inviteInfoSend is not null`);
                ui.showPopUp("error: there is a pending invite.", "error");
                return;
            }

            if (!localParticipant.current.stream) {
                console.error(`stream is null`);
                ui.showPopUp("error: media stream not initialized", "error");
                return;
            }

            if (localParticipant.current.stream.getTracks().length === 0) {
                console.log(`media stream not initialized`);
                ui.showToast("initializing media stream");
                let tracks = await getLocalMedia(options);
                if (tracks.length === 0) {
                    ui.showPopUp("ERROR: could not start media devices.", "error");
                    return;
                }
            }

            //if no local tracks
            if (localParticipant.current.stream.getTracks().length === 0) {
                console.error(`no media tracks`);
                ui.showPopUp("no devices enabled.", "error");
                return;
            }

            let joinArgs: JoinConferenceParams = {
                clientData: api.getCurrentUser()?.clientData,
                conferenceCode: "",
                conferenceId: "",
                roomName: "",
                externalId: "",
            }

            let inviteMsg = conferenceClient.sendInvite(participantInfo.participantId, joinArgs);
            if (!inviteMsg) {
                ui.showPopUp("error unable to initiate a new call", "error");
                return;
            }
            inviteMsg.data.displayName = participantInfo.displayName;
            setInviteInfoSend(inviteMsg);

            console.log(`Call initiated to ${participantInfo.displayName}`);
        } catch (error) {
            console.error('Failed to initiate call:');
            ui.showPopUp("Failed to initialized call.", "error");
        }
    }, [api, getLocalMedia, inviteInfoSend, isCallActive, ui]);

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

            conferenceClient.acceptInvite(conferenceClient.inviteReceivedMsg, joinArgs);

            console.log(`Call with ${inviteInfoReceived.data.displayName} accepted in room ${inviteInfoReceived.data.conferenceName}`);
            setInviteInfoReceived(null);
        } catch (error) {
            console.error('error" acceptInvite:', error);
        }
    }, [api, inviteInfoReceived]);

    const declineInvite = useCallback(() => {
        conferenceClient.leave();
        setInviteInfoReceived(null);
        ui.showToast("call declined.", "warning");
    }, [ui]);

    const cancelInvite = useCallback(() => {
        console.log(`Call to ${conferenceClient.inviteSendMsg?.data.displayName} cancelled.`);
        conferenceClient.leave()
        setInviteInfoSend(null);
        ui.showToast("call cancelled.");
    }, [ui]);

    const endCurrentCall = useCallback(() => {
        console.log("Ending current call.");
        conferenceClient.leave();
        setIsCallActive(false);
        setInviteInfoSend(null);
        setInviteInfoReceived(null);
        setIsScreenSharing(false);
        setCallParticipants(new Map());

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

        conferenceClient.createConferenceRoom(createArgs);
    }, []);

    const joinConference = useCallback((conferenceCode: string, scheduled: ConferenceScheduledInfo) => {
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

        conferenceClient.joinConferenceRoom(joinArgs)
    }, [api]);

    const createConferenceOrJoin = useCallback((externalId: string, conferenceCode: string) => {
        console.log(`CallContext: createConferenceOrJoin externalId:${externalId}, conferenceCode:${conferenceCode}`);
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

        let result = conferenceClient.waitCreateAndJoinConference(createArgs, joinArgs);
        if (result) {
            ui.showToast('joining conference room.');
        } else {
            ui.showPopUp("failed to join conference.", "error");
        }

    }, [api, ui]);

    const muteParticipantTrack = useCallback((participantId: string, audioEnabled: boolean, videoEnabled: boolean) => {
        console.log("CallContext: muteParticipantTrack");

        let participant = conferenceClient.conference.participants.get(participantId);
        if (!participant) {
            console.error(`participant not found ${participantId}`);
            return;
        }
        conferenceClient.muteParticipantTrack(participantId, audioEnabled, videoEnabled);

    }, []);

    const broadCastTrackInfo = useCallback(() => {
        console.log("CallContext: enableTrack");
        conferenceClient.broadCastTrackInfo();
    }, []);

    const startScreenShare = useCallback(async () => {
        console.log(`startScreenShare`);

        if (await conferenceClient.startScreenShare()) {
            //trigger a refresh of the local stream
            console.log(`setIsScreenSharing to true`);
            setPresenter(conference.presenter);
            setIsScreenSharing(true);
            setIsLocalStreamUpdated(true);
            setCallParticipants(prev => new Map(conferenceClient.conference.participants));
        }
    }, []);

    const stopScreenShare = useCallback(async () => {
        console.log("stopScreenShare");

        try {
            let constraints = getMediaConstraints(false, true); //get only video
            await conferenceClient.stopScreenShare(constraints);

        } catch (error) {
            console.error("Error stopping screen share:", error);
        }

        setIsScreenSharing(false);
        setIsLocalStreamUpdated(true);
        setCallParticipants(prev => new Map(conferenceClient.conference.participants));
        console.warn(`setIsScreenSharing to false`, localParticipant.current.stream.getTracks());

    }, [getMediaConstraints]);

    const switchDevicesOnCall = useCallback(async () => {
        console.log(`switchDevicesOnCall`);

        const tracks = localParticipant.current.stream.getTracks();
        console.log(selectedDevices);

        let videoChanged = false;
        let audioChanged = false;

        // Check video input
        let videoTrack = tracks.find(track => track.kind === 'video');
        if (videoTrack) {
            const currentVideoId = videoTrack.getSettings().deviceId;
            videoChanged = currentVideoId !== selectedDevices.videoId;
            console.log(`Video device changed: ${videoChanged} (Current ID: ${currentVideoId}, Selected: ${selectedDevices.videoId})`);
        }

        let audioTrack = tracks.find(track => track.kind === 'audio');
        if (audioTrack) {
            const currentAudioId = audioTrack.getSettings().deviceId;
            audioChanged = currentAudioId !== selectedDevices.audioInId;
            console.log(`Audio device changed: ${audioChanged} (Current ID: ${currentAudioId}, Selected: ${selectedDevices.audioInId})`);
        }

        if (!audioChanged && !videoChanged) {
            console.log(`no changes to devices.`);
            return;
        }

        let constraints = getMediaConstraints(audioChanged, videoChanged);

        if (!audioChanged) {
            delete constraints.audio;
        }

        if (!videoChanged) {
            delete constraints.video;
        }

        console.log(`constraints:`, constraints);

        let newStream = await getBrowserUserMedia(constraints);
        await conferenceClient.publishTracks(newStream.getTracks());;


        videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = localParticipant.current.tracksInfo.isVideoEnabled;
        }

        audioTrack = newStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = localParticipant.current.tracksInfo.isAudioEnabled;
        }

        setIsLocalStreamUpdated(true);

    }, [getMediaConstraints, selectedDevices]);

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
            presenter,

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
            switchDevicesOnCall,

        }}>
            {children}
        </CallContext.Provider>
    );
};