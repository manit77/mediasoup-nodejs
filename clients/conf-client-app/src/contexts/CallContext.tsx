import React, { createContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { ConferenceClosedMsg, ConferenceScheduledInfo, CreateConferenceParams, GetConferencesScheduledResultMsg, GetParticipantsResultMsg, GetUserMediaConfig, InviteMsg, JoinConferenceParams, ParticipantInfo, RegisterResultMsg } from '@conf/conf-models';
import { Conference, Device, getBrowserDisplayMedia, getBrowserUserMedia, Participant, SelectedDevices } from '@conf/conf-client';
import { useUI } from '../hooks/useUI';
import { useAPI } from '../hooks/useAPI';
import { useConfig } from '../hooks/useConfig';
import { IMsg } from '@rooms/rooms-models';
import { EventParticpantNewTrackMsg, EventTypes } from '@conf/conf-client';
import { getConferenceClient } from '../services/ConferenceService';
import { debounce } from 'lodash';
import { unstable_batchedUpdates } from 'react-dom';

export const conferenceClient = getConferenceClient();

interface CallContextType {
    isConnecting: boolean;
    isConnected: boolean;
    isLoggedOff: boolean;
    setIsLoggedOff: React.Dispatch<React.SetStateAction<boolean>>;
    isAuthenticated: boolean;
    localParticipant: Participant;
    //isLocalStreamUpdated: boolean;
    presenter: Participant;


    isWaiting: boolean;
    isCallActive: boolean;
    conference: Conference;
    callParticipants: Map<string, Participant>;
    onConferencePing: any;
    conferencePong: () => void;

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
    joinConference: (conferenceCode: string, scheduled: ConferenceScheduledInfo, joinMediaConfig: GetUserMediaConfig) => Promise<void>;
    createOrJoinConference: (externalId: string, conferenceCode: string, joinMediaConfig: GetUserMediaConfig) => Promise<void>;

    sendInvite: (participantInfo: ParticipantInfo, joinMediaConfig: GetUserMediaConfig) => Promise<void>;
    acceptInvite: (joinMediaConfig: GetUserMediaConfig) => Promise<void>;
    declineInvite: () => void;
    cancelInvite: () => void;

    leaveCurrentConference: () => void;
    terminateCurrentConference: () => void;

    broadCastTrackInfo: () => void;
    muteParticipantTrack: (participantId: string, audioEnabled: boolean, videoEnabled: boolean) => void;

    startPresentingCamera: () => Promise<void>;
    stopPresentingCamera: () => Promise<void>;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;

    getMediaDevices: () => Promise<void>;
    switchDevicesOnCall: () => Promise<void>;//, isAudioEnabled: boolean, isVideoEnabled: boolean) => Promise<void>;

    disconnect: () => void;

}

export const CallContext = createContext<CallContextType>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const ui = useUI();
    const api = useAPI();
    const { config } = useConfig();

    const [isConnected, setIsConnected] = useState<boolean>(conferenceClient.isConnected());
    const [isConnecting, setIsConnecting] = useState<boolean>(conferenceClient.isConnecting());

    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(conferenceClient.isRegistered());
    const [isLoggedOff, setIsLoggedOff] = useState<boolean>(false);

    const localParticipant = useRef<Participant>(conferenceClient.localParticipant);
    const [presenter, setPresenter] = useState<Participant>(conferenceClient.conference?.presenter);

    const [isWaiting, setIsWaiting] = useState<boolean>(false);
    const [isCallActive, setIsCallActive] = useState<boolean>(conferenceClient.isInConference());
    const conference = useRef<Conference>(conferenceClient.conference);
    const [callParticipants, setCallParticipants] = useState<Map<string, Participant>>(new Map());
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(conferenceClient.isScreenSharing);
    const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>(conferenceClient.selectedDevices);

    const [participantsOnline, setParticipantsOnline] = useState<ParticipantInfo[]>(conferenceClient.participantsOnline);
    const [conferencesOnline, setConferencesOnline] = useState<ConferenceScheduledInfo[]>(conferenceClient.conferencesOnline);
    const [inviteInfoSend, setInviteInfoSend] = useState<InviteMsg | null>(conferenceClient.inviteSendMsg);
    const [inviteInfoReceived, setInviteInfoReceived] = useState<InviteMsg | null>(conferenceClient.inviteReceivedMsg);

    //const [isLocalStreamUpdated, setIsLocalStreamUpdated] = useState<boolean>(false);
    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });
    const [onConferencePing, setOnConferencePing] = useState({});

    useEffect(() => {
        conferenceClient.init(config);
        initState();
    }, [config])

    const initState = () => {
        //init all default values
        localParticipant.current = conferenceClient.localParticipant;
        conference.current = conferenceClient.conference;
        updateCallParticipants();

        setIsConnected(conferenceClient.isConnected());
        setIsConnecting(conferenceClient.isConnecting());
        setIsAuthenticated(conferenceClient.isRegistered());

        setIsCallActive(conferenceClient.isInConference());
        setIsScreenSharing(conferenceClient.isScreenSharing);
        setSelectedDevices(conferenceClient.selectedDevices);
        setPresenter(conferenceClient.conference.presenter);

        setParticipantsOnline(conferenceClient.participantsOnline);
        setConferencesOnline(conferenceClient.conferencesOnline);
        setInviteInfoSend(conferenceClient.inviteSendMsg);
        setInviteInfoReceived(conferenceClient.inviteReceivedMsg);
        setIsWaiting(false);

    }

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
            return [];
        }

        if (!options.constraints) {
            options.constraints = getMediaConstraints(options.isAudioEnabled, options.isVideoEnabled);
        }

        const tracks = await conferenceClient.getNewTracksForLocalParticipant(options);

        console.log('conferenceClient.localParticipant', conferenceClient.localParticipant.stream.getTracks());
        console.log('localParticipant', localParticipant.current.stream.getTracks());

        const audioTrack = tracks.find(t => t.kind === "audio");
        if (audioTrack) {
            audioTrack.enabled = options.isAudioEnabled;
            console.log(`audioTrack:`, audioTrack.enabled);
        }

        const videoTrack = tracks.find(t => t.kind === "video");
        if (videoTrack) {
            videoTrack.enabled = options.isVideoEnabled;
            console.log(`videoTrack:`, videoTrack.enabled);
        }

        //setIsLocalStreamUpdated(true);
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

    function cloneParticipant(participant: Participant): Participant {
        const cloned = new Participant();
        cloned.participantId = participant.participantId;
        cloned.displayName = participant.displayName;
        cloned.role = participant.role;
        cloned.peerId = participant.peerId;

        // Clone tracksInfo
        cloned.tracksInfo = {
            isAudioEnabled: participant.tracksInfo.isAudioEnabled,
            isVideoEnabled: participant.tracksInfo.isVideoEnabled
        };

        // Clone prevTracksInfo if it exists
        if (participant.prevTracksInfo) {
            cloned.prevTracksInfo = {
                isAudioEnabled: participant.prevTracksInfo.isAudioEnabled,
                isVideoEnabled: participant.prevTracksInfo.isVideoEnabled,
                screenShareTrackId: participant.prevTracksInfo.screenShareTrackId
            };
        }

        // Note: MediaStream and HTMLVideoElement are not deeply cloned as they are managed by the browser
        // The video element is already created in the Participant constructor
        cloned.stream = participant.stream; // MediaStream is typically managed externally
        cloned.videoEle.srcObject = participant.stream; // Reassign stream to video element

        return cloned;
    }

    function hasTracksInfoChanged(prev: Participant | undefined, next: Participant): boolean {
        if (!prev) return true; // No previous participant means tracksInfo is new
        return (
            prev.tracksInfo.isAudioEnabled !== next.tracksInfo.isAudioEnabled ||
            prev.tracksInfo.isVideoEnabled !== next.tracksInfo.isVideoEnabled
        );
    }

    const updateCallParticipants = useCallback(() => {
        console.warn(`updateCallParticipants`);

        setCallParticipants(prev => {
            const latest = conferenceClient.conference.participants;
            let hasChanges = false;

            // Create a new Map only if changes are detected
            const next = new Map(prev);

            // Check for additions or updates (including tracksInfo changes)
            for (const [id, participant] of latest.entries()) {
                const prevParticipant = prev.get(id);
                if (!prevParticipant || hasTracksInfoChanged(prevParticipant, participant)) {
                    next.set(id, cloneParticipant(participant));
                    hasChanges = true;
                    console.warn(`updateCallParticipants - has changes.`);
                } else {
                    // Preserve existing participant if no tracksInfo change
                    next.set(id, prevParticipant);
                }
            }

            // Check for removals
            for (const id of prev.keys()) {
                if (!latest.has(id)) {
                    next.delete(id);
                    hasChanges = true;
                }
            }

            if (!hasChanges) {
                console.warn(`updateCallParticipants - no changes.`);
            }

            // Return previous Map if no changes, otherwise return new Map
            return hasChanges ? next : prev;
        });
    }, []);

    const updateTracksInfo = useCallback((participantId: string) => {
        console.error(`updateTracksInfo`);

        setCallParticipants(prev => {
            const next = new Map(prev);
            const prevPart = prev.get(participantId);

            const latest = conferenceClient.conference.participants;
            const latestPart = latest.get(participantId);

            if (latestPart && prevPart) {
                const latestTracks = latestPart.tracksInfo;
                const currTracks = prevPart.tracksInfo;

                // Compare tracksInfo properties
                if (latestTracks.isAudioEnabled === currTracks.isAudioEnabled &&
                    latestTracks.isVideoEnabled === currTracks.isVideoEnabled) {
                    // No changes, return the existing Map
                    console.warn(`latestTracks no changes`);
                    return prev;
                }

                // Create updated participant with new tracksInfo
                const updatedPart = {
                    ...prevPart,
                    tracksInfo: { ...latestTracks },
                };
                next.set(participantId, updatedPart);
                console.warn(`latestTracks changed`);
            }

            return next;
        });
    }, []);

    const getParticipantsOnline = useCallback(() => {
        conferenceClient.getParticipantsOnline();
    }, []);

    const getConferenceRoomsOnline = useCallback(() => {
        conferenceClient.getConferenceRoomsOnline();
    }, []);

    const setupWebRTCEvents = useCallback(() => {

        conferenceClient.onEvent = async (eventType: EventTypes, msgIn: IMsg) => {
            switch (eventType) {
                case EventTypes.registerResult: {
                    console.log("CallContext: registerResult", msgIn.data);

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
                }
                case EventTypes.loggedOff: {
                    console.log("CallContext: loggedOff");

                    initState();

                    let reason = msgIn.data.reason ?? "you have logged off by the server";
                    ui.showPopUp(reason, "error");
                    api.logout();

                    break;
                }
                case EventTypes.connected: {
                    console.log("CallContext: server connected");

                    initState();

                    ui.hidePopUp();
                    ui.showToast("connected to server");
                    break;
                }
                case EventTypes.disconnected: {
                    console.log("CallContext: disconnected from server");

                    initState();
                    ui.showToast("disconnected from server. trying to reconnect...");

                    break;
                }
                case EventTypes.participantsReceived: {
                    let msg = msgIn as GetParticipantsResultMsg;
                    console.log("CallContext: onContactsReceived", msg.data.participants);
                    setParticipantsOnline(msg.data.participants);
                    break;
                }
                case EventTypes.conferencesReceived: {
                    const msg = msgIn as GetConferencesScheduledResultMsg
                    //console.log("CallContext: onConferencesReceived", msg.data.conferences);
                    setConferencesOnline(msg.data.conferences);
                    break;
                }
                case EventTypes.participantNewTrack: {
                    console.warn('CallContext: onParticipantTrack', msgIn);

                    let msg = msgIn as EventParticpantNewTrackMsg;
                    let participantId = msg.data.participant.participantId;

                    if (!msg.data.track) {
                        console.error("CallContext: no track");
                        return;
                    }

                    //updateTracksInfo(participantId);
                    updateCallParticipants();

                    break;
                }
                case EventTypes.participantTrackInfoUpdated: {
                    console.log(`CallContext: onParticipantTrackInfoUpdated`, msgIn);

                    let participantId = msgIn.data.participantId;
                    if (!participantId) {
                        console.error("CallContext: no participantId");
                        return;
                    }


                    let part = conferenceClient.conference.participants.get(participantId);
                    if (part) {
                        console.warn(callParticipants, part.tracksInfo);
                        //updateTracksInfo(participantId);
                        updateCallParticipants();
                    }

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
                    setIsScreenSharing(false);

                    break;
                }
                case EventTypes.conferenceJoined: {
                    console.log(`CallContext: onConferenceJoined ${conferenceClient.conference.conferenceId}, conferenceName:${conferenceClient.conference.conferenceName}`);

                    console.log(`participants in room: ${conferenceClient.conference.participants.size}`)
                    console.log(`presenter:`, conferenceClient.conference.presenter);
                    console.log(`localParticipant tracksInfo:`, localParticipant.current.tracksInfo);

                    setIsCallActive(true);
                    setInviteInfoReceived(null);
                    setInviteInfoSend(null);
                    updateCallParticipants();
                    setPresenter(conferenceClient.conference.presenter);

                    ui.showToast("conference joined");

                    break;
                }
                case EventTypes.conferenceClosed: {
                    let msg = msgIn as ConferenceClosedMsg;
                    console.log(`CallContext: onConferenceEnded: conferenceId: ${msg.data.conferenceId} reason: ${msg.data.reason}`);
                    setIsCallActive(false);
                    setInviteInfoSend(null);
                    setInviteInfoReceived(null);
                    setIsScreenSharing(false);
                    updateCallParticipants();

                    if (msg.data.reason) {
                        ui.showToast(msg.data.reason);
                        return;
                    }

                    break;
                }
                case EventTypes.participantJoined: {
                    console.log(`CallContext: onParticipantJoined ${msgIn.data.displayName} (${msgIn.data.participantId})`);
                    updateCallParticipants();
                    setPresenter(conference.current.presenter);
                    break;
                }
                case EventTypes.participantLeft: {
                    console.log(`CallContext: onParticipantJoined ${msgIn.data.displayName} (${msgIn.data.participantId})`);
                    updateCallParticipants();
                    setPresenter(conference.current.presenter);
                    break;
                }
                case EventTypes.prensenterInfo: {
                    console.log(`CallContext: prensenterInfo`, conferenceClient.conference.presenter);
                    setPresenter(conferenceClient.conference.presenter);
                    break;
                }
                case EventTypes.conferencePing: {
                    console.log(`CallContext: conferencePing`);
                    setOnConferencePing({});
                    break;
                }
            }

        };
        return () => { // Cleanup
            //don't disconnec the conferenceClient
            //the callcontext can get recreated
        }
    }, [callParticipants, getConferenceRoomsOnline, ui]);

    const sendInvite = useCallback(async (participantInfo: ParticipantInfo, joinMediaConfig: GetUserMediaConfig) => {
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

            let joinArgs: JoinConferenceParams = {
                joinMediaConfig: joinMediaConfig,
                clientData: api.getCurrentUser()?.clientData,
                conferenceCode: "",
                conferenceId: "",
                roomName: "",
                externalId: "",
            }

            if (!await waitTryRegister()) {
                console.error('wait for registration failed.');
                return;
            }

            let inviteMsg = conferenceClient.sendInvite(participantInfo.participantId, joinArgs);
            if (!inviteMsg) {
                ui.showPopUp("error unable to initiate a new call", "error");
                return;
            }
            ui.showToast(`invite sent`);
            inviteMsg.data.displayName = participantInfo.displayName;
            setInviteInfoSend(inviteMsg);

            console.log(`Call initiated to ${participantInfo.displayName}`);
        } catch (error) {
            console.error('Failed to initiate call:');
            ui.showPopUp("Failed to initialized call.", "error");
        }
    }, [api, getLocalMedia, inviteInfoSend, isCallActive, ui]);

    const acceptInvite = useCallback(async (joinMediaConfig: GetUserMediaConfig) => {
        try {

            let joinArgs: JoinConferenceParams = {
                joinMediaConfig: joinMediaConfig,
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

    const leaveCurrentConference = useCallback(() => {
        console.log("leaving current conference.");
        conferenceClient.leave();
        setIsCallActive(false);
        setInviteInfoSend(null);
        setInviteInfoReceived(null);
        
        setCallParticipants(new Map());
        setIsScreenSharing(false);
        setPresenter(null);
        

    }, []);

    const terminateCurrentConference = useCallback(() => {
        console.log("terminateCurrentConference current conference.");
        conferenceClient.terminate();
        setIsCallActive(false);
        setInviteInfoSend(null);
        setInviteInfoReceived(null);
        setIsScreenSharing(false);
        setCallParticipants(new Map());

    }, []);

    const createConference = useCallback(async (externalId: string, roomName: string) => {
        console.log("CallContext: createConference");
        let createArgs: CreateConferenceParams = {
            conferenceCode: "",
            externalId: externalId,
            roomName: roomName,
            conferenceId: "",
            config: null
        }

        if (!await waitTryRegister()) {
            console.error('wait for registration failed.');
            return;
        }

        if (conferenceClient.createConferenceRoom(createArgs)) {
            ui.showToast("creating conference");
        } else {
            ui.showPopUp("failed to create conference.");
        }
    }, [ui]);

    const joinConference = useCallback(async (conferenceCode: string, scheduled: ConferenceScheduledInfo, joinMediaConfig: GetUserMediaConfig) => {
        console.log("CallContext: joinConference");

        if (!scheduled.conferenceId) {
            console.error("CallContext: joinConference: conferenceId is required");
            return;
        }

        if (!await waitTryRegister()) {
            console.error('wait for registration failed.');
            return;
        }


        let joinArgs: JoinConferenceParams = {
            joinMediaConfig: joinMediaConfig,
            clientData: api.getCurrentUser()?.clientData,
            conferenceCode: conferenceCode,
            conferenceId: scheduled.conferenceId,
            roomName: "",
            externalId: scheduled.externalId,
        }

        if (await conferenceClient.joinConferenceRoom(joinArgs)) {
            ui.showToast("joining conference");
        } else {
            ui.showPopUp("join conference failed.");
        }
    }, [api, ui]);

    const createOrJoinConference = useCallback(async (externalId: string, conferenceCode: string, joinMediaConfig: GetUserMediaConfig) => {
        console.log(`CallContext: createOrJoinConference externalId:${externalId}, conferenceCode:${conferenceCode}`);

        if (!await waitTryRegister()) {
            console.error('wait for registration failed.');
            return;
        }

        let createArgs: CreateConferenceParams = {
            conferenceCode: conferenceCode,
            conferenceId: "",
            config: null,
            roomName: "",
            externalId: externalId
        };

        let joinArgs: JoinConferenceParams = {
            joinMediaConfig: joinMediaConfig,
            clientData: api.getCurrentUser()?.clientData,
            conferenceCode: conferenceCode,
            conferenceId: "",
            roomName: "",
            externalId: externalId,
        }

        let result = await conferenceClient.waitCreateAndJoinConference(createArgs, joinArgs);
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

    const startPresentingCamera = useCallback(async () => {
        console.log(`startPresentingCamera`);

        if (conferenceClient.isScreenSharing) {
            await stopScreenShare();
        }

        conferenceClient.localParticipant.prevTracksInfo = { ...conferenceClient.localParticipant.tracksInfo, screenShareTrackId: "" };

        let videoTrack = conferenceClient.localParticipant.stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.readyState === "live") {
            videoTrack.enabled = true;
        }

        let audioTrack = conferenceClient.localParticipant.stream.getAudioTracks()[0];
        if (audioTrack && audioTrack.readyState === "live") {
            audioTrack.enabled = true;
        }

        conferenceClient.localParticipant.tracksInfo = {
            isVideoEnabled: true,
            isAudioEnabled: true,
        };

        //determine if we are broadcasting audio or video
        let isBroadcastingVideo = conferenceClient.isBroadcastingVideo();
        let isBroadcastingAudio = conferenceClient.isBroadcastingAudio();
        

        console.warn(`current tracks:`, conferenceClient.localParticipant.stream.getTracks());

        if (!isBroadcastingAudio || !isBroadcastingVideo) {
            let constraints = getMediaConstraints(!isBroadcastingAudio, !isBroadcastingVideo);
            let newStream = await getBrowserUserMedia(constraints);

            console.warn(`newStream tracks:`, newStream.getTracks());
            conferenceClient.publishTracks(newStream.getTracks(), "startPresentingCamera");
        }

        conferenceClient.broadCastTrackInfo();

        conferenceClient.sendPresenting(true);
        conferenceClient.conference.setPresenter(conferenceClient.localParticipant);
        setPresenter(conferenceClient.localParticipant);
        updateCallParticipants();


    }, [conference.current.presenter, ui]);

    const stopPresentingCamera = useCallback(async () => {
        console.log("stopPresentingCamera");

        if (conferenceClient.isScreenSharing) {
            await stopScreenShare();
        }
        conferenceClient.conference.setPresenter(null);
        setPresenter(null);

        try {
            let tracksInfo = localParticipant.current.prevTracksInfo ?? localParticipant.current.tracksInfo;

            localParticipant.current.tracksInfo.isVideoEnabled = tracksInfo.isVideoEnabled;
            localParticipant.current.tracksInfo.isAudioEnabled = tracksInfo.isAudioEnabled;

            let videoTrack = localParticipant.current.stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = tracksInfo.isVideoEnabled;
            }

            let audioTrack = localParticipant.current.stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = tracksInfo.isAudioEnabled;
            }

        } catch (error) {
            console.error("Error stopping screen share:", error);
        }

        conferenceClient.broadCastTrackInfo();

        conferenceClient.conference.setPresenter(null);
        conferenceClient.sendPresenting(false);

        setPresenter(null);
        console.log(`setIsScreenSharing to false`, localParticipant.current.stream.getTracks());

    }, [getMediaConstraints]);

    const startScreenShare = useCallback(async () => {
        console.log(`startScreenShare`);

        if (await conferenceClient.startScreenShare()) {
            //trigger a refresh of the local stream
            conferenceClient.conference.setPresenter(conferenceClient.localParticipant);
            setPresenter(conferenceClient.conference.presenter);
            setIsScreenSharing(true);
            updateCallParticipants();
        } else {
            ui.showPopUp("unable to start screen share.", "error");
        }

    }, [conference.current.presenter, ui]);

    const stopScreenShare = useCallback(async () => {
        console.log("stopScreenShare");

        try {
            let tracksInfo = localParticipant.current.prevTracksInfo ?? localParticipant.current.tracksInfo;
            let constraints = getMediaConstraints(false, tracksInfo.isVideoEnabled);
            await conferenceClient.stopScreenShare(constraints);

        } catch (error) {
            console.error("Error stopping screen share:", error);
        }

        conferenceClient.conference.setPresenter(null);
        setPresenter(null);
        setIsScreenSharing(false);
        console.log(`setIsScreenSharing to false`, localParticipant.current.stream.getTracks());

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
        await conferenceClient.publishTracks(newStream.getTracks(), "switchDevicesOnCall");;


        videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = localParticipant.current.tracksInfo.isVideoEnabled;
        }

        audioTrack = newStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = localParticipant.current.tracksInfo.isAudioEnabled;
        }

    }, [getMediaConstraints, selectedDevices]);

    const waitTryRegister = useCallback(async () => {
        setIsWaiting(true);
        let isRegistered = conferenceClient.isRegistered();
        if (!isRegistered) {
            ui.showToast('waiting to connect.', "warning");
            try {
                isRegistered = await conferenceClient.waitTryRegister();
            } catch (error) {
                console.error("waitTryRegister - registration error.", error);
                isRegistered = false;
            }
        }

        if (!isRegistered) {
            console.error("waitTryRegister: not registered");
            ui.showPopUp("waitTryRegister: not connected to server, please try again.", "error");
        }
        setIsWaiting(false);
        return isRegistered;
    }, [])

    const conferencePong = useCallback(async () => {
        console.log(`conferencePong`, conference);
        conferenceClient.sendPong(conferenceClient.conference.conferenceId);
    }, [])


    useEffect(() => {
        setupWebRTCEvents();
    }, [setupWebRTCEvents]);

    const disconnect = useCallback(async () => {
        console.log("CallContext disconnect()");

        conferenceClient.disconnect();

        setIsConnected(false);
        setIsAuthenticated(false);
        localParticipant.current = conferenceClient.localParticipant;
        setIsCallActive(false);
        setCallParticipants(conferenceClient.conference.participants);
        setIsScreenSharing(conferenceClient.isScreenSharing);
        setSelectedDevices(conferenceClient.selectedDevices);
        setParticipantsOnline(conferenceClient.participantsOnline);
        setConferencesOnline(conferenceClient.conferencesOnline);
        setInviteInfoSend(conferenceClient.inviteSendMsg);
        setInviteInfoReceived(conferenceClient.inviteReceivedMsg);


    }, []);

    return (
        <CallContext.Provider value={{
            isConnecting,
            isConnected,
            isAuthenticated,
            isLoggedOff, setIsLoggedOff,
            localParticipant: localParticipant.current,
            presenter,
            onConferencePing,
            conferencePong,

            isWaiting,
            isCallActive: isCallActive,
            conference: conference.current,
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
            createOrJoinConference,

            sendInvite,
            acceptInvite,
            declineInvite,
            cancelInvite,
            leaveCurrentConference,
            terminateCurrentConference,

            broadCastTrackInfo,
            muteParticipantTrack,

            startPresentingCamera,
            stopPresentingCamera,
            startScreenShare,
            stopScreenShare,

            getMediaDevices,
            switchDevicesOnCall,
            disconnect,

        }}>
            {children}
        </CallContext.Provider>
    );
};