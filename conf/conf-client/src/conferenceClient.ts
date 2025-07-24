import {
    AcceptMsg,
    AcceptResultMsg,
    CallMessageType, ConferenceClosedMsg, ConferenceReadyMsg, ConferenceRoomConfig, ConferenceRoomInfo, ConferenceRoomJoinConfig, conferenceType, CreateConferenceParams, CreateConfMsg, CreateConfResultMsg, GetConferencesMsg, GetConferencesResultMsg, GetParticipantsMsg, GetParticipantsResultMsg, InviteCancelledMsg, InviteMsg, InviteResultMsg
    , JoinConferenceParams, JoinConfMsg, JoinConfResultMsg, LeaveMsg, ParticipantInfo, ParticipantRole, RegisterMsg, RegisterResultMsg, RejectMsg
} from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { RoomsClient, Peer, IPeer } from "@rooms/rooms-client";
import { ConferenceClientConfig } from "./models.js";
import { ConferenceAPIClient } from "./conferenceAPIClient.js";
import { IMsg, OkMsg, PeerTracksInfo } from "@rooms/rooms-models";

export type callStates = "calling" | "answering" | "connecting" | "connected" | "disconnected";

export class Participant {
    participantId: string;
    displayName: string;
    stream: MediaStream = new MediaStream();
    role: string = ParticipantRole.guest;

    peerId: string;
    tracksInfo: PeerTracksInfo = { isAudioEnabled: true, isVideoEnabled: true };
}

export class Conference {
    conferenceId: string;
    conferenceName: string;
    conferenceExternalId: string;
    conferenceType: conferenceType = "p2p"; // default to p2p
    conferenceRoomConfig: ConferenceRoomConfig;
    roomAuthToken: string;
    roomToken: string;
    roomId: string;
    roomURI: string;
    joinParams: JoinConferenceParams;

    /**
     * remote participants
     */
    participants: Map<string, Participant> = new Map();
}

export enum EventTypes {

    connected = "connected",
    disconnected = "disconnected",

    registerResult = "registerResult",

    participantsReceived = "participantsReceived",
    conferencesReceived = "conferencesReceived",

    acceptResult = "acceptResult",
    inviteResult = "inviteResult",
    inviteReceived = "inviteReceived",
    inviteCancelled = "inviteCancelled",
    rejectReceived = "rejectReceived",

    conferenceCreatedResult = "conferenceCreatedResult",
    conferenceJoined = "conferenceJoined",
    conferenceClosed = "conferenceClosed",
    conferenceFailed = "conferenceFailed",

    participantNewTrack = "participantNewTrack",
    participantTrackInfoUpdated = "participantTrackInfoUpdated",
    participantJoined = "participantJoined",
    participantLeft = "participantLeft",
}

type ConferenceEvent = (eventType: EventTypes, payload: IMsg) => Promise<void>;

export class ConferenceClient {

    private socket: WebSocketClient;
    localParticipant = new Participant();
    authToken: string = "";
    conferenceRoom: Conference = new Conference();
    callState: callStates = "disconnected";

    public participantsOnline: ParticipantInfo[] = [];
    public conferences: ConferenceRoomInfo[] = [];
    private roomsClient: RoomsClient;
    private roomsClientDisconnectTimerId: any;

    isConnected = false;

    inviteSendMsg: InviteMsg;
    inviteReceivedMsg: InviteMsg;

    CallConnectTimeoutSeconds = 5;

    onEvent: ConferenceEvent;
    apiClient: ConferenceAPIClient;

    CallConnectTimeoutTimerIds = new Set<any>();

    constructor(private config: ConferenceClientConfig) {
        console.log(`*** new ConferenceClient`);
        this.apiClient = new ConferenceAPIClient(config);
    }

    dispose() {

        console.log("dispose");

        this.onEvent = null;
        this.disconnectRoomsClient("dispose", 0);

        if (this.socket) {
            console.log(`disconnecting from socket`);
            this.socket.disconnect();
            this.socket = null;
        }

        this.apiClient = null;

    }

    startCallConnectTimer() {
        console.log("startCallConnectTimer");

        this.clearCallConnectTimer();

        const timerId = setTimeout(async () => {
            console.error(`CallConnectTimer executed conferenceRoom ${this.conferenceRoom.conferenceId}`);
            if (this.conferenceRoom.conferenceId) {

                let msg = new ConferenceClosedMsg();
                msg.data.conferenceId = this.conferenceRoom.conferenceId;

                if (this.callState === "calling") {
                    msg.data.reason = "no answer";
                } else if (this.callState === "answering") {
                    msg.data.reason = "answer failed";
                } else {
                    msg.data.reason = "call timed out.";
                }

                await this.onEvent(EventTypes.conferenceClosed, msg);

                this.leave();
            }
            this.CallConnectTimeoutTimerIds.delete(timerId);

        }, this.CallConnectTimeoutSeconds * 1000);
        this.CallConnectTimeoutTimerIds.add(timerId);
        console.log("startCallConnectTimer - Added Timer ID:", timerId);
    }

    clearCallConnectTimer() {
        console.log("clearCallConnectTimer");

        for (const timerId of this.CallConnectTimeoutTimerIds) {
            clearTimeout(timerId as any);
            console.log("clearCallConnectTimer - Cleared Timer ID:", timerId);
        }
        this.CallConnectTimeoutTimerIds.clear();
        console.log("clearCallConnectTimer - All timers cleared");
    }

    async getNewTracksForLocalParticipant(constraints: MediaStreamConstraints = { video: true, audio: true }) {
        console.log(`getNewTracks constraints:`, constraints);
        let newStream = await this.getBrowserUserMedia(constraints);
        let newTracks = newStream.getTracks();
        this.localParticipant.stream.getTracks().forEach(t => this.localParticipant.stream.removeTrack(t));
        newTracks.forEach(t => this.localParticipant.stream.addTrack(t));
        console.warn(`new tracks created for localParticipant tracksInfo`, this.localParticipant.tracksInfo);

        let audioTrack = newTracks.find(t => t.kind === "audio");
        if (audioTrack) {            
            audioTrack.enabled = this.localParticipant.tracksInfo.isAudioEnabled;
            console.warn(`track of type audio enabled set to `, audioTrack.enabled);
        }

        let videoTrack = newTracks.find(t => t.kind === "video");
        if (videoTrack) {
            videoTrack.enabled = this.localParticipant.tracksInfo.isVideoEnabled;
            console.warn(`track of type video enabled set to `, videoTrack.enabled);
        }

        return newTracks;
    }

    getBrowserUserMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
        console.log(`getUserMedia constraints:`, constraints);
        return navigator.mediaDevices.getUserMedia(constraints);
    }

    publishTracks(tracks: MediaStreamTrack[]) {
        console.log(`publishTracks, length: ${tracks?.length}`);

        if (tracks.length == 0) {
            console.error(`no tracks`);
            return false;
        }

        if (this.isInConference() && this.conferenceRoom.joinParams) {
            console.warn(`disable mic or cam based on user preference`, this.conferenceRoom.joinParams);

            let joinParams = this.conferenceRoom.joinParams;
            let videoTrack = tracks.find(t => t.kind === "video");
            if (videoTrack) {
                videoTrack.enabled = this.localParticipant.tracksInfo.isVideoEnabled;
                this.checkTrackAllowed(videoTrack);
            }

            let audioTrack = tracks.find(t => t.kind === "audio");
            if (audioTrack) {
                audioTrack.enabled = this.localParticipant.tracksInfo.isAudioEnabled;
                this.checkTrackAllowed(audioTrack);
            }
            console.warn(`track status audioTrack: ${audioTrack?.enabled}, videoTrack: ${videoTrack?.enabled}`);
            console.warn(`localParticipant.tracksInfo:`, this.localParticipant.tracksInfo);

        }

        tracks.forEach(t => {
            this.checkTrackAllowed(t);
        });

        if (this.roomsClient) {
            this.roomsClient.publishTracks(tracks);
        }

        return true;
    }

    unPublishTracks(tracks: MediaStreamTrack[]) {
        console.log(`unpublishTracks`);

        tracks.forEach(track => {
            track.enabled = false;
            this.localParticipant?.stream?.removeTrack(track);
        });

        if (this.roomsClient) {
            this.roomsClient.unPublishTracks(tracks);
        }
    }

    /**
     * update Trackinfo for the local participant
     * this will send message the the server
     */
    broadCastTrackInfo() {
        console.log(`updateTrackInfo`);

        if (this.roomsClient) {
            this.roomsClient?.broadCastTrackInfo(this.localParticipant.tracksInfo);
        }
    }

    /**
     * this will force mute/unmute a participant on the server based on the local tracks
     * @param participantId 
     */
    muteParticipantTrack(participantId: string, audioEnabled: boolean, videoEnabled: boolean) {
        console.log(`muteParticipantTrack participantId: ${participantId}`);

        if (this.roomsClient) {

            console.log(`conferenceRoom.participants`, [...this.conferenceRoom.participants.values()]);
            let peerId = this.conferenceRoom.participants.get(participantId)?.peerId;
            if (!peerId) {
                console.error(`peer not found. ${peerId}`);
                return;
            }

            //console.log("particpant tracks", particpant.mediaStream.getTracks());
            this.roomsClient.muteParticipantTrack(peerId, audioEnabled, videoEnabled);
        }

    }

    //toggles the local track, does not update the server
    toggleTrack(participantId: string, enabled: boolean, kind: "audio" | "video") {
        let part = this.conferenceRoom.participants.get(participantId);
        if (!part) {
            if (part.participantId == this.localParticipant.participantId) {
                part = this.localParticipant;
            }
        }

        if (!part) {
            console.error(`participant not found. ${participantId}`);
            return;
        }

        if (!part.stream) {
            console.error(`participant stream not found.`);
            return;
        }

        let track = part.stream.getTracks().find(t => t.kind === kind);
        if (track) {
            track.enabled = enabled;
            part.tracksInfo.isAudioEnabled = enabled;
        }
    }

    async getDisplayMedia(): Promise<MediaStream | null> {
        console.log(`getDisplayMedia`);

        if (!this.roomsClient) {
            console.error("roomsClient not initialized.");
            return null;
        }

        return await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });
    }

    connect(options?: { socket_ws_uri?: string }) {
        console.log(`connect to socket server.`);

        if (options && options.socket_ws_uri) {
            this.config.conf_ws_url = options.socket_ws_uri;
        }

        if (this.socket) {
            console.log(`socket already exists, disconnect.`);
            this.socket.disconnect();
            this.socket = null;
        }

        // Connect to WebSocket server
        console.log("new socket created");
        this.socket = new WebSocketClient({ enableLogs: this.config.socket_enable_logs });

        this.socket.addEventHandler("onopen", async () => {
            console.log("onopen - socket opened");
            this.isConnected = true;
            this.onSocketConnected();
        });

        this.socket.addEventHandler("onclose", async () => {
            this.isConnected = false;
            this.onSocketClosed("WebSocket connection closed");
        });

        this.socket.addEventHandler("onerror", async (error: any) => {
            console.error('WebSocket Error:', error);
            this.onSocketClosed("WebSocket error:" + error);
        });

        this.socket.addEventHandler("onmessage", async (event: any) => {
            const message = JSON.parse(event.data);
            await this.onSocketMessage(message);
        });

        this.socket.connect(this.config.conf_ws_url, true);

    }

    private async onSocketConnected() {
        console.log("onSocketConnected()");

        await this.onEvent(EventTypes.connected, new OkMsg());
    }

    private async onSocketClosed(reason: string = "") {
        console.log(`onSocketClosed() - reconnecting: ${this.socket.autoReconnect}, state: ${this.socket.state} reason: ${reason}`);

        if (this.roomsClient) {
            console.log(`closing roomsClient`);
            this.roomsClient.roomLeave();
            this.roomsClient.disconnect();
            this.roomsClient.dispose();
            this.roomsClient = null;
        }

        if (this.isInConference()) {
            let msg = new ConferenceClosedMsg();
            msg.data.conferenceId = this.conferenceRoom.conferenceId;
            msg.data.reason = "connection closed";
            await this.onEvent(EventTypes.conferenceClosed, msg);
        }
        this.resetConferenceRoom();
        this.resetParticipant();

        await this.onEvent(EventTypes.disconnected, new OkMsg());
    }

    private async onSocketMessage(message: { type: CallMessageType, data: any }) {
        console.log('onSocketMessage ' + message.type, message);

        switch (message.type) {
            case CallMessageType.registerResult:
                await this.onRegisterResult(message);
                break;
            case CallMessageType.getParticipantsResult:
                await this.onParticipantsReceived(message);
                break;
            case CallMessageType.getConferencesResult:
                await this.onConferencesReceived(message);
                break;
            case CallMessageType.invite:
                await this.onInviteReceived(message);
                break;
            case CallMessageType.reject:
                await this.onRejectReceived(message);
                break;
            case CallMessageType.inviteResult:
                await this.onInviteResult(message);
                break;
            case CallMessageType.inviteCancelled:
                await this.onInviteCancelled(message);
                break;
            case CallMessageType.acceptResult: {
                await this.onAcceptResult(message);
                break;
            }
            case CallMessageType.createConfResult:
                await this.onCreateConfResult(message);
                break;
            case CallMessageType.joinConfResult:
                await this.onJoinConfResult(message);
                break;
            case CallMessageType.conferenceReady:
                await this.onConferenceReady(message);
                break;
            case CallMessageType.conferenceClosed:
                await this.onConferenceClosed(message);
                break;

        }
    }

    disconnect() {
        console.log("conferneceClient disconnect");

        this.disconnectRoomsClient("disconnect");


        if (this.socket) {
            console.log(`disconnecting from socket`);
            this.socket.disconnect();
            this.socket = null;
        }
    }

    isInConference() {
        return this.conferenceRoom.conferenceId > "";
    }

    waitRegisterConnection(username: string, authToken: string) {
        console.log("waitRegisterConnection");
        return new Promise<CreateConfResultMsg>((resolve, reject) => {
            let _onmessage: (event: any) => void;

            let _removeEvents = () => {
                if (_onmessage) {
                    this.socket.removeEventHandler("onmessage", _onmessage);
                }
            }

            try {
                let timerid = setTimeout(() => {
                    _removeEvents();
                    reject("failed to register connection");
                }, 5000);

                _onmessage = (event: any) => {
                    console.log("** onmessage", event.data);
                    let msg = JSON.parse(event.data);

                    if (msg.type == CallMessageType.registerResult) {
                        clearTimeout(timerid);
                        _removeEvents();

                        let msgIn = msg as RegisterResultMsg;
                        if (msgIn.data.error) {
                            console.log(msgIn.data.error);
                            reject("failed to register connection");
                            return;
                        }
                        resolve(msgIn);
                    }
                };

                this.socket.addEventHandler("onmessage", _onmessage);
                this.registerConnection(username, authToken);

            } catch (err: any) {
                console.log(err);
                _removeEvents();
                reject("failed to register connection");
            }
        });
    }
    /**
     * registers a websocket connection
     * @param username 
     * @param authToken 
     */
    registerConnection(username: string, authToken: string) {
        console.log("registerConnection");

        if (!username) {
            console.error(`username is requied.`);
            return;
        }
        if (!authToken) {
            console.error(`authToken is requied.`);
            return;
        }

        // Register with the server
        const registerMsg: RegisterMsg = new RegisterMsg();
        registerMsg.data.username = username;
        registerMsg.data.displayName = username;
        registerMsg.data.authToken = authToken;
        this.sendToServer(registerMsg);
    }

    getParticipantsOnline() {
        console.log("getParticipantsOnline");

        const getParticipantsMsg = new GetParticipantsMsg();
        this.sendToServer(getParticipantsMsg);
    }

    getConferenceRoomsOnline() {
        console.log("getConferenceRooms");

        const msg = new GetConferencesMsg();
        this.sendToServer(msg);
    }

    /**
     * send an invite to a participant
     * this is a p2p conference room
     * send InviteMsg, wait to receive InviteResultMsg
     * @param participantId 
     */
    sendInvite(participantId: string, args: JoinConferenceParams): InviteMsg {
        console.log(`sendInvite() ${participantId}`, args);
        if (this.isInConference()) {
            console.error("invite() - already in a conference.");
            return null;
        }

        if (this.inviteSendMsg || this.inviteReceivedMsg) {
            console.error(`pending invite message`);
            return null;
        }

        this.callState = "calling";
        let inviteMsg = new InviteMsg();
        inviteMsg.data.participantId = participantId;
        if (!this.sendToServer(inviteMsg)) {
            console.error(`failed to send inviteSendMsg`);
            this.resetConferenceRoom();
            return null;
        }

        this.inviteSendMsg = inviteMsg;

        this.startCallConnectTimer();
        this.conferenceRoom.joinParams = args;

        return this.inviteSendMsg;
    }

    cancelInvite(invite: InviteMsg) {
        console.log(`cancelInvite() ${invite.data.participantId} ${invite.data.conferenceId}`);

        const callMsg = new InviteCancelledMsg();
        callMsg.data.participantId = invite.data.participantId;
        callMsg.data.conferenceId = invite.data.conferenceId;
        this.sendToServer(callMsg);

        this.resetConferenceRoom();
    }

    createConferenceRoom(args: CreateConferenceParams) {
        console.log(`createConferenceRoom trackingId: ${args.externalId}, roomName: ${args.roomName}`);

        const msg = new CreateConfMsg();
        msg.data.conferenceExternalId = args.externalId;
        msg.data.roomName = args.roomName;
        msg.data.conferenceCode = args.conferenceCode;
        msg.data.conferenceRoomConfig = args.config;
        return this.sendToServer(msg);
    }

    /**
     * admins can always create a room and join a room
     * if role is a user, conferenceCode is required and must match the scheduled conference's conferenceCode
     * @param trackingId 
     * @param roomName 
     * @param conferenceCode 
     * @param config 
     * @returns 
     */
    waitCreateConferenceRoom(args: CreateConferenceParams) {
        console.log(`waitCreateConferenceRoom externalId: ${args.externalId}, roomName: ${args.roomName}, conferenceCode: ${args.conferenceCode}`);
        return new Promise<CreateConfResultMsg>((resolve, reject) => {
            let _onmessage: (event: any) => void;

            let _removeEvents = () => {
                if (_onmessage) {
                    this.socket.removeEventHandler("onmessage", _onmessage);
                }
            }

            try {
                let timerid = setTimeout(() => {
                    _removeEvents();
                    reject("failed to create conference");
                }, 5000);

                _onmessage = (event: any) => {
                    console.log("** onmessage", event.data);
                    let msg = JSON.parse(event.data);

                    if (msg.type == CallMessageType.createConfResult) {
                        clearTimeout(timerid);
                        _removeEvents();

                        let msgIn = msg as CreateConfResultMsg;
                        if (msgIn.data.error) {
                            console.log(msgIn.data.error);
                            reject("failed to create conference");
                            return;
                        }
                        resolve(msgIn);
                    }
                };

                this.socket.addEventHandler("onmessage", _onmessage);
                if (!this.createConferenceRoom(args)) {
                    reject("failed send conference room msg.");
                }

            } catch (err: any) {
                console.log(err);
                _removeEvents();
                reject("erorr on creating conference room");
            }
        });
    }

    waitJoinConferenceRoom(args: JoinConferenceParams) {
        console.log(`waitJoinConferenceRoom trackingId: ${args.conferenceId}, conferenceCode: ${args.conferenceCode}`);
        return new Promise<JoinConfResultMsg>((resolve, reject) => {
            let _onmessage: (event: any) => void;

            let _removeEvents = () => {
                if (_onmessage) {
                    this.socket.removeEventHandler("onmessage", _onmessage);
                }
            }

            try {
                let timerid = setTimeout(() => {
                    _removeEvents();
                    reject("failed to join conference");
                }, 5000);

                _onmessage = (event: any) => {
                    console.log("** onmessage", event.data);
                    let msg = JSON.parse(event.data);

                    if (msg.type == CallMessageType.joinConfResult) {
                        clearTimeout(timerid);
                        _removeEvents();

                        let msgIn = msg as JoinConfResultMsg;

                        if (msgIn.data.error) {
                            console.log(msgIn.data.error);
                            reject("failed to join conference");
                            return;
                        }
                        resolve(msgIn);
                    }
                };

                this.socket.addEventHandler("onmessage", _onmessage);
                if (!this.joinConferenceRoom(args)) {
                    reject(`failed to send joinConferenceRoom`);
                }

            } catch (err: any) {
                console.log(err);
                _removeEvents();
                reject("failed to join room");
            }
        });
    }

    /**
     * join a conference room
     * send JoinConfMsg wait for JoinConfResultMsg
     * @param args 
     * @returns 
     */
    async joinConferenceRoom(args: JoinConferenceParams) {
        console.log(`joinConferenceRoom conferenceId: ${args.conferenceId} conferenceCode: ${args.conferenceCode}`);

        if (this.conferenceRoom.conferenceId) {
            console.error(`already in conferenceroom ${this.conferenceRoom.conferenceId}`);
            return false;
        }

        this.conferenceRoom.joinParams = args;

        //get the conference config first
        if (!this.conferenceRoom.conferenceRoomConfig) {

            if (!args.externalId) {
                console.error(`trackingId is required.`);
                return false;
            }

            console.log(`getConferenceScheduled config `, args.externalId, args.clientData);
            let scheduled = await this.apiClient.getConferenceScheduled(args.externalId, args.clientData);
            if (scheduled.data.error) {
                console.error(scheduled.data.error);
                return false;
            }
            console.log(`getConferenceScheduled result `, scheduled);
            this.conferenceRoom.conferenceRoomConfig = scheduled.data.conference.config;
        }

        if (!this.conferenceRoom.conferenceRoomConfig) {
            console.error(`not conference config found.`);
            return false;
        }

        this.startCallConnectTimer();
        this.callState = "connecting";

        const msg = new JoinConfMsg();
        msg.data.conferenceId = args.conferenceId;
        msg.data.conferenceCode = args.conferenceCode;

        this.conferenceRoom.conferenceId = args.conferenceId;

        return this.sendToServer(msg);
    }

    private checkTrackAllowed(track: MediaStreamTrack) {
        console.log("checkTrackAllowed", track.kind, this.conferenceRoom.conferenceRoomConfig);

        if (!this.conferenceRoom.conferenceRoomConfig) {
            console.error(`not conference config found.`);
            return;
        }

        if (this.localParticipant.role === "guest") {
            if (track.kind === "audio" && !this.conferenceRoom.conferenceRoomConfig.guestsAllowMic) {
                if (track) {
                    track.enabled = false;
                }
            }

            if (track.kind === "video" && !this.conferenceRoom.conferenceRoomConfig.guestsAllowCamera) {
                if (track) {
                    track.enabled = false;
                }
            }
        }

        console.log(`track ${track.kind} ${track.enabled}`);

    }

    /**
     * sent and InviteMsg, received InviteResultMsg, wait to receive ConferenceReadyMsg or RejectMsg
     */
    private async onInviteResult(message: InviteResultMsg) {
        console.log("onInviteResult()");
        //the conferenceId must be empty or it must match

        if (message.data.error) {
            console.error("onInviteResult() - error received");
            this.callState = "disconnected";

        }

        if (!message.data.conferenceId) {
            console.error("onInviteResult() - no conferenceId");
            this.callState = "disconnected";
        }

        if (!this.inviteSendMsg) {
            console.error("onInviteResult() - no invite sent");
            this.callState = "disconnected";
        }

        if (this.conferenceRoom.conferenceId && this.conferenceRoom.conferenceId != message.data.conferenceId) {
            console.error(`onInviteResult() - incorrect conferenceId ${this.conferenceRoom.conferenceId} ${message.data.conferenceId}`);
            this.callState = "disconnected";
        }

        if (this.inviteSendMsg.data.participantId != message.data.participantId) {
            console.error(`onInviteResult() - incorrect participantId, invite:${this.inviteSendMsg.data.participantId} msg:${message.data.participantId}`);
            this.callState = "disconnected";
        }

        if (this.callState === "disconnected") {
            await this.onEvent(EventTypes.inviteResult, message);
            this.resetConferenceRoom();
            return;
        }

        console.log(`onInviteResult() - received a new conferenceId ${message.data.conferenceId}`);
        console.log(`set conferenceId ${message.data.conferenceId}`);

        //clear the inviteSendMsg, set the conference variables
        this.inviteSendMsg = null;
        this.conferenceRoom.conferenceId = message.data.conferenceId;
        this.conferenceRoom.conferenceName = message.data.conferenceName || `Call with ${message.data.displayName}`;
        this.conferenceRoom.conferenceExternalId = message.data.conferenceExternalId;
        this.conferenceRoom.conferenceType = message.data.conferenceType;

        this.startCallConnectTimer();

        await this.onEvent(EventTypes.inviteResult, message);
    }

    async onInviteReceived(message: InviteMsg) {
        console.log("onInviteReceived()");
        if (this.isInConference()) {
            console.log(`already in a conference. ${this.conferenceRoom.conferenceId}`);
            return;
        }

        if (this.inviteSendMsg || this.inviteReceivedMsg) {
            console.log("onInviteReceived() - already have an pending invite message.");
            return;
        }

        this.callState = "answering";
        this.conferenceRoom.conferenceId = message.data.conferenceId;
        this.conferenceRoom.conferenceName = message.data.conferenceName || `Call with ${message.data.displayName}`;
        this.conferenceRoom.conferenceExternalId = message.data.conferenceExternalId;
        this.conferenceRoom.conferenceType = message.data.conferenceType;

        this.inviteReceivedMsg = message;

        console.log(`set conferenceId ${message.data.conferenceId}`, this.conferenceRoom);
        this.startCallConnectTimer();

        await this.onEvent(EventTypes.inviteReceived, message);
    }

    /**
     * remote participant cancelled the invite
     * @param message 
     * @returns 
     */
    async onInviteCancelled(message: InviteCancelledMsg) {
        console.log("onInviteCancelled()");

        if (message.data.conferenceId != this.conferenceRoom.conferenceId) {
            console.error("onInviteCancelled() - not the same conferenceId.");
            return;
        }

        await this.onEvent(EventTypes.inviteCancelled, message);

        this.resetConferenceRoom();
    }

    /**
     * accept an invite from a received invite
     * wait for AcceptResultMsg
     * @param message 
     * @returns 
     */
    acceptInvite(message: InviteMsg, joinArgs: JoinConferenceParams) {
        console.log("acceptInvite()");

        if (!this.inviteReceivedMsg) {
            console.error(`not invite received.`);
            return;
        }

        if (message.data.conferenceId != this.inviteReceivedMsg.data.conferenceId) {
            console.error("accept failed. not the same conferenceId");
            return false;
        }

        if (message.data.participantId != this.inviteReceivedMsg.data.participantId) {
            console.error("accept failed. not the same participantId");
            return false;
        }

        const acceptMsg = new AcceptMsg();
        acceptMsg.data.conferenceId = message.data.conferenceId;
        if (!this.sendToServer(acceptMsg)) {
            console.error(`failed to send AcceptMsg`);
            return;
        }

        this.conferenceRoom.conferenceId = message.data.conferenceId;
        this.conferenceRoom.joinParams = joinArgs;

        this.callState = "connecting";
        this.inviteReceivedMsg = null;

        this.startCallConnectTimer();
    }

    /**
     * after accepting and invite, receive AcceptResultMsg from the server
     * wait for ConferenceReadyMsg to join room
     * @param message 
     */
    async onAcceptResult(message: AcceptResultMsg) {
        console.log("onAcceptResult()");

        if (message.data.error) {
            console.error(`error accepting a call:`, message.data.error);
            this.resetConferenceRoom();
            return;
        }

        await this.onEvent(EventTypes.acceptResult, message);

    }

    /**
     * local user rejected an inviteReceivedMsg
     * @param message 
     * @returns 
     */
    rejectInvite(message: InviteMsg) {
        console.log("reject()");

        if (!this.inviteReceivedMsg) {
            console.error(`no invite received.`);
        }

        if (message.data.conferenceId != this.inviteReceivedMsg.data.conferenceId) {
            console.error("accept failed. not the same conferenceId");
            return false;
        }

        if (message.data.participantId != this.inviteReceivedMsg.data.participantId) {
            console.error("accept failed. not the same participantId");
            return false;
        }

        let msg = new RejectMsg();
        msg.data.conferenceId = message.data.conferenceId;
        msg.data.fromParticipantId = this.localParticipant.participantId;
        msg.data.toParticipantId = message.data.participantId;
        this.sendToServer(msg);

        this.resetConferenceRoom();
    }

    /**
     * local user leaves the conference
     * @returns 
     */
    leave() {
        console.log("leave()");

        if (this.roomsClient) {
            this.roomsClient.roomLeave();
            this.disconnectRoomsClient("leave");
        }

        if (!this.isInConference()) {
            console.log("leave() - failed, not in conference");
            return;
        }

        let msg = new LeaveMsg();
        msg.data.conferenceId = this.conferenceRoom.conferenceId;
        this.sendToServer(msg);

        this.resetConferenceRoom();
    }

    private resetConferenceRoom() {
        console.log("resetConferenceRoom()");

        this.callState = "disconnected";
        this.conferenceRoom = new Conference();
        this.inviteSendMsg = null;
        this.inviteReceivedMsg = null;
        this.clearCallConnectTimer();
        this.localParticipant.peerId = "";
    }

    private resetParticipant() {
        console.log("resetParticipant()");

        this.localParticipant.participantId = "";
        this.localParticipant.displayName = "";
        this.localParticipant.peerId = "";
        this.localParticipant.role = "";

        this.localParticipant.stream.getTracks().forEach(t => {
            this.localParticipant.stream.removeTrack(t);
        });
    }

    getParticipant(participantId: string): Participant {
        console.log("getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }

    private sendToServer(message: any) {
        console.log("sendToServer " + message.type, message);

        if (this.socket) {
            return this.socket.send(JSON.stringify(message));
        } else {
            console.error('Error sending message, socket is not connected');
        }
        return false;
    }

    private async onRegisterResult(message: RegisterResultMsg) {
        console.log("onRegisterResult");

        if (message.data.error) {
            console.error(message.data.error);
            await this.onEvent(EventTypes.registerResult, message);
        } else {
            this.localParticipant.participantId = message.data.participantId;
            this.localParticipant.displayName = message.data.username;
            this.localParticipant.role = message.data.role;
            console.log('Registered with participantId:', this.localParticipant.participantId, this.localParticipant.displayName);
            await this.onEvent(EventTypes.registerResult, message);
        }
    }

    private async onParticipantsReceived(message: GetParticipantsResultMsg) {
        console.log("onParticipantsReceived");

        this.participantsOnline = message.data.filter(c => c.participantId !== this.localParticipant.participantId);
        await this.onEvent(EventTypes.participantsReceived, message);
    }

    private async onConferencesReceived(message: GetConferencesResultMsg) {
        console.log("onConferencesReceived");

        this.conferences = message.data.conferences;
        await this.onEvent(EventTypes.conferencesReceived, message);
    }

    /**
     * the remote user rejected the invite
     * @param message 
     */
    private async onRejectReceived(message: InviteResultMsg) {
        console.log("onRejectReceived");

        if (this.conferenceRoom.conferenceId != message.data.conferenceId) {
            console.error(`conferenceId does not match ${this.conferenceRoom.conferenceId} ${message.data.conferenceId}`);
            return;
        }

        await this.onEvent(EventTypes.rejectReceived, message);
        this.resetConferenceRoom();
        this.disconnectRoomsClient("onRejectReceived");
    }

    /**
     * received a result from the server after creating a conference
     * @param message 
     * @returns 
     */
    private async onCreateConfResult(message: CreateConfResultMsg) {
        console.log("onCreateConfResult");

        if (message.data.error) {
            console.error(message.data.error);

            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: message.data.error } });
            this.disconnectRoomsClient("onCreateConfResult");
            return;
        }

        await this.onEvent(EventTypes.conferenceCreatedResult, message);
    }

    /**
     * received a result from the server after joining a conference
     * @param message 
     * @returns 
     */
    private async onJoinConfResult(message: JoinConfResultMsg) {
        console.log("onJoinConfResult");

        if (message.data.error) {
            console.error("onJoinConfResult() - error received");

            this.clearCallConnectTimer();
            this.callState = "disconnected";
            this.conferenceRoom.conferenceId = "";

            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: message.data.error } });
            this.disconnectRoomsClient("onJoinConfResult");
            return;
        }

        //!!! don't send event for EventTypes.conferenceJoined, wait for room client to send event
        //!!! next event received is onConferenceReady

    }

    /**
     * conference is ready to be used
     * @param message 
     * @returns 
     */
    private async onConferenceReady(message: ConferenceReadyMsg) {
        console.log("onConferenceReady()");

        if (this.conferenceRoom.conferenceId != message.data.conferenceId) {
            console.error(`onConferenceReady() - conferenceId does not match ${this.conferenceRoom.conferenceId} ${message.data.conferenceId}`);
            return;
        }

        this.conferenceRoom.conferenceExternalId = message.data.conferenceId;
        this.conferenceRoom.conferenceName = message.data.conferenceName || `Call with ${message.data.displayName}`;
        this.conferenceRoom.conferenceExternalId = message.data.conferenceExternalId;
        this.conferenceRoom.conferenceType = message.data.conferenceType;
        this.conferenceRoom.conferenceRoomConfig = message.data.conferenceRoomConfig;

        this.conferenceRoom.roomId = message.data.roomId;
        this.conferenceRoom.roomToken = message.data.roomToken;
        this.conferenceRoom.roomURI = message.data.roomURI;
        this.conferenceRoom.roomAuthToken = message.data.roomAuthToken;

        if (!this.conferenceRoom.roomId) {
            console.error("ERROR: no roomId");
            return;
        }

        if (!this.conferenceRoom.roomToken) {
            console.error("ERROR: no roomToken");
            return;
        }

        if (!this.conferenceRoom.roomURI) {
            console.error("ERROR: no roomURI");
            return;
        }

        if (!this.conferenceRoom.roomAuthToken) {
            console.error("ERROR: no roomAuthToken");
            return;
        }

        if (!message.data.roomRtpCapabilities) {
            console.error("ERROR: no roomRtpCapabilities");
            return;
        }

        try {
            await this.initRoomsClient(message.data.roomURI, message.data.roomRtpCapabilities);
            console.log("-- room initialized.")

            let connectResult = await this.roomsClient.waitForConnect();
            if (!connectResult.data.error) {
                console.log("-- room socket connected.");
            } else {
                console.log("-- room socket failed to connect.");
            }

            let registerResult = await this.roomsClient.waitForRegister(this.conferenceRoom.roomAuthToken, this.localParticipant.participantId, this.localParticipant.displayName);
            if (!registerResult.data.error) {
                console.log(`-- room socket registered. new peerId ${this.roomsClient.localPeer.peerId}`);
                this.localParticipant.peerId = this.roomsClient.localPeer.peerId;
                
                console.warn("update the tracksInfo on the rooms clicent", this.localParticipant.tracksInfo);                
                await this.roomsClient.broadCastTrackInfo(this.localParticipant.tracksInfo);
            } else {
                console.log("-- room socket failed to register.");
            }

            let roomJoinResult = connectResult = await this.roomsClient.waitForRoomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);
            if (!roomJoinResult.data.error) {
                console.log("-- room join.");
            } else {
                console.log("-- room failed to join.");
            }

            if (connectResult.data.error || registerResult.data.error || roomJoinResult.data.error) {
                //call failed
                let msg = {
                    type: EventTypes.conferenceFailed,
                    data: {
                        conferenceId: this.conferenceRoom.conferenceId
                    }
                };

                this.resetConferenceRoom();

                this.disconnectRoomsClient("join conference failed.");
                await this.onEvent(EventTypes.conferenceFailed, msg);

            }
        } catch (err) {
            console.error(err);

            this.resetConferenceRoom();

            this.disconnectRoomsClient("join conference error.");
            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: "error connecting to conference." } });
        }
    }

    private async onConferenceClosed(message: ConferenceClosedMsg) {
        console.log("onConferenceClosed()");

        if (!this.isInConference()) {
            console.error("onConferenceClosed() - not in a conference.");
            return;
        }

        if (this.conferenceRoom.conferenceId != message.data.conferenceId) {
            console.error(`onConferenceClosed() - conferenceId does not match ${this.conferenceRoom.conferenceId} ${message.data.conferenceId}`);
            return;
        }

        // the room may still be open leave the room
        if (this.roomsClient) {
            this.roomsClient.roomLeave();
            this.disconnectRoomsClient("onConferenceClosed");
        }

        await this.onEvent(EventTypes.conferenceClosed, message);
        this.resetConferenceRoom();
    }

    private async initRoomsClient(roomURI: string, roomRtpCapabilities: string) {
        console.log("initRoomsClient");

        if (this.roomsClientDisconnectTimerId) {
            console.log(`clear roomsClientDisconnectTimer ${this.roomsClientDisconnectTimerId}`);
            clearTimeout(this.roomsClientDisconnectTimerId);
        }

        if (this.roomsClient && this.roomsClient.config.socket_ws_uri == roomURI) {
            console.log("room already initialized with URI:", roomURI);
            return;
        }

        this.roomsClient = new RoomsClient({
            socket_auto_reconnect: true,
            socket_enable_logs: this.config.socket_enable_logs,
            socket_ws_uri: this.config.rooms_ws_url
        });

        this.roomsClient.eventOnRoomSocketClosed = async () => {
            console.log("onRoomSocketClosedEvent");

            //room socket closed
            //leave the conferenceRoom
            this.leave();

            //if in conference, notify the conference closed
            if (this.isInConference()) {
                let msg = new ConferenceClosedMsg();
                msg.data.conferenceId = this.conferenceRoom.conferenceId;
                msg.data.reason = "disconnected from room server";
                this.onEvent(EventTypes.conferenceClosed, msg);
            }

            this.resetConferenceRoom();

            //disconnect the rooms client immediately
            this.disconnectRoomsClient("onRoomClosedEvent", 0);

        };

        this.roomsClient.eventOnRoomJoined = async (roomId: string) => {
            //confirmation for local user has joined a room
            console.warn("onRoomJoinedEvent roomId:", roomId);
            this.clearCallConnectTimer();
            this.callState = "connected";

            //add self to the call participants
            this.conferenceRoom.participants.set(this.localParticipant.participantId, this.localParticipant);
            console.log(`add self to conferenceRoom.participants ${this.conferenceRoom.participants.size}`);

            let msg = {
                type: EventTypes.conferenceJoined,
                data: {
                    conferenceId: this.conferenceRoom.conferenceId
                }
            }
            await this.onEvent(msg.type, msg);

        };

        this.roomsClient.eventOnRoomClosed = async (roomId: string, peers: Peer[]) => {
            console.log("onRoomClosedEvent roomId:", roomId);

            //leave the conferenceRoom
            this.leave();

            this.clearCallConnectTimer();
            this.callState = "disconnected";

            this.disconnectRoomsClient("onRoomClosedEvent");

            let msg = {
                type: EventTypes.conferenceClosed,
                data: {
                    conferenceId: this.conferenceRoom.conferenceId,
                    reason: "room closed"
                }
            };
            await this.onEvent(msg.type, msg);

            this.resetConferenceRoom();
        };

        this.roomsClient.eventOnRoomPeerJoined = async (roomId: string, peer: Peer) => {
            console.warn(`onRoomPeerJoinedEvent roomId: ${roomId} ${peer.peerId} ${peer.displayName} `);

            //the peer.trackingId is the participantId
            let participant = this.conferenceRoom.participants.get(peer.trackingId);
            if (participant) {
                console.error(`participant already in local conferenceRoom: ${peer.trackingId} ${participant.displayName}`);
                return;
            }

            //create a new participant and add it to the conference
            participant = new Participant();
            participant.displayName = peer.displayName;
            participant.participantId = peer.trackingId;
            participant.peerId = peer.peerId;
            participant.tracksInfo = peer.tracksInfo;

            this.conferenceRoom.participants.set(participant.participantId, participant);
            console.log(`adding new participant to the room: ${participant.displayName}, ${this.conferenceRoom.participants.size}`);

            let msg = {
                type: EventTypes.participantJoined,
                data: {
                    participantId: participant.participantId,
                    displayName: participant.displayName,
                    conferenceId: this.conferenceRoom.conferenceId,
                    peerId: peer.peerId,
                    roomId: roomId
                }
            }
            await this.onEvent(msg.type, msg);
        };

        this.roomsClient.eventOnPeerNewTrack = async (peer: IPeer, track: MediaStreamTrack) => {
            console.warn(`onPeerNewTrackEvent peerId: ${peer.peerId}, ${peer.trackingId} ${peer.displayName}`, this.conferenceRoom.participants);

            let participant = this.conferenceRoom.participants.get(peer.trackingId);
            if (!participant) {
                console.error(`participant not found. ${peer.trackingId} ${peer.displayName}`, participant, this.conferenceRoom.participants);
                return;
            }
            console.log(`add track for ${participant.displayName} of type ${track.kind} `);

            //remove the track is exists
            let existingTrack = participant.stream.getTracks().find(t => t.kind === track.kind);
            if (existingTrack) {
                console.log(`existing track removed ${existingTrack.id}`);
                participant.stream.removeTrack(existingTrack);
            }
            participant.stream.addTrack(track);

            let msg = {
                type: EventTypes.participantNewTrack,
                data: {
                    participantId: participant.participantId,
                    track: track
                }
            }
            await this.onEvent(msg.type, msg);

        };

        this.roomsClient.eventOnRoomPeerLeft = async (roomId: string, peer: IPeer) => {
            console.warn("eventOnRoomPeerLeft roomId:", roomId);

            let participant = this.conferenceRoom.participants.get(peer.trackingId);
            if (!participant) {
                console.error(`participant not found. ${peer.trackingId} ${peer.displayName}`, participant, this.conferenceRoom.participants);
                return;
            }

            this.conferenceRoom.participants.delete(participant.participantId);

            let msg = {
                type: EventTypes.participantLeft,
                data: {
                    participantId: participant.participantId
                }
            }
            await this.onEvent(msg.type, msg);

        };

        this.roomsClient.eventOnPeerTrackInfoUpdated = async (peer: IPeer) => {
            console.warn(`eventOnPeerTrackInfoUpdated peerId: ${peer.peerId} trackingId: ${peer.trackingId} displayName: ${peer.displayName}`);
            console.log(`participants:`, this.conferenceRoom.participants);

            let participant: Participant;
            if (this.localParticipant.participantId === peer.trackingId) {
                participant = this.localParticipant;
            } else {
                participant = this.conferenceRoom.participants.get(peer.trackingId);
            }

            if (!participant) {
                console.error(`participant not found. ${peer.trackingId} ${peer.displayName}`, participant, this.conferenceRoom.participants);
                return;
            }
            
            participant.tracksInfo = peer.tracksInfo;
            console.warn(`participant tracksInfo updated:`, participant.tracksInfo);

            let msg = {
                type: EventTypes.participantTrackInfoUpdated,
                data: {
                    participantId: participant.participantId
                }
            }
            await this.onEvent(msg.type, msg);
        };

        await this.roomsClient.inititalize({ rtp_capabilities: roomRtpCapabilities });
    }

    private disconnectRoomsClient(reason: string, inSeconds: number = 10) {
        console.log(`disconnectRoomsClient in ${inSeconds} seconds ${reason}`);

        if (this.roomsClientDisconnectTimerId) {
            console.log(`clear roomsClientDisconnectTimer ${this.roomsClientDisconnectTimerId}`);
            clearTimeout(this.roomsClientDisconnectTimerId);
            this.roomsClientDisconnectTimerId = null;
        }
        const _destroy = () => {
            if (this.roomsClient) {
                this.roomsClientDisconnectTimerId = null;
                this.roomsClient.roomLeave();
                this.roomsClient.disconnect();
                this.roomsClient.dispose();
                this.roomsClient = null;
            }
        };

        if (inSeconds <= 0) {
            console.log(`disconnectRoomsClient immediately ${reason}`);
            _destroy();
            return;
        }

        this.roomsClientDisconnectTimerId = setTimeout(() => {
            console.log(`disconnectRoomsClient timeout ${reason}`);
            _destroy();
        }, inSeconds * 1000);
    }

}