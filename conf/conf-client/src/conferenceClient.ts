import {
    AcceptMsg,
    AcceptResultMsg,
    CallMessageType, ConferenceClosedMsg, ConferenceReadyMsg, ConferenceRoomConfig, ConferenceRoomInfo, conferenceType, CreateConfMsg, CreateConfResultMsg, GetConferencesMsg, GetConferencesResultMsg, GetParticipantsMsg, GetParticipantsResultMsg, InviteCancelledMsg, InviteMsg, InviteResultMsg
    , JoinConfMsg, JoinConfResultMsg, LeaveMsg, ParticipantInfo, RegisterMsg, RegisterResultMsg, RejectMsg
} from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { RoomsClient, Peer, IPeer } from "@rooms/rooms-client";


export type callStates = "calling" | "answering" | "connecting" | "connected" | "disconnected";

export class Participant {
    participantId: string;
    peerId: string;
    displayName: string;
    stream: MediaStream = new MediaStream();
    isMuted: boolean = false;
    isVideoOff: boolean = false;
}

export class Conference {
    conferenceRoomId: string;
    conferenceRoomName: string;
    conferenceRoomTrackingId: string;
    conferenceType: conferenceType = "p2p"; // default to p2p
    conferenceRoomConfig: ConferenceRoomConfig;
    roomAuthToken: string;
    roomToken: string;
    roomId: string;
    roomURI: string;

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
    participantTrackToggled = "participantTrackToggled",
    participantJoined = "participantJoined",
    participantLeft = "participantLeft",

}
type ConferenceEvent = (eventType: EventTypes, payload?: any) => Promise<void>;

export class ConferenceClient {
    private DSTR = "ConferenceClient";
    private socket: WebSocketClient;
    socketAutoReconnect: boolean = true;

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

    config = {
        conf_wsURI: 'wss://localhost:3001',
        enableSocketLogs: false
    }

    onEvent: ConferenceEvent;

    constructor() {
    }

    CallConnectTimeoutTimerIds = new Set<any>();

    startCallConnectTimer() {
        console.log("startCallConnectTimer");

        this.clearCallConnectTimer();

        const timerId = setTimeout(async () => {
            console.error(`CallConnectTimer executed conferenceRoom ${this.conferenceRoom.conferenceRoomId}`);
            if (this.conferenceRoom.conferenceRoomId) {

                let msg = new ConferenceClosedMsg();
                msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;

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

    getUserMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
        console.log(`getUserMedia constraints:`, constraints);

        return navigator.mediaDevices.getUserMedia(constraints);
    }

    publishTracks(tracks: MediaStreamTrack[]) {
        console.log(`publishTracks`);

        if (this.roomsClient) {
            this.roomsClient.publishTracks(tracks);
        }
    }

    unPublishTracks(tracks: MediaStreamTrack[]) {
        console.log(`unpublishTracks`);
        if (this.roomsClient) {
            this.roomsClient.unPublishTracks(tracks);
        }
    }

    updateTrackEnabled(participantId: string) {
        console.log(`toggleTrack participantId: ${participantId}`);

        if (this.roomsClient) {

            //get peerid
            console.log(`localParticipant`, this.localParticipant);
            console.log(`conferenceRoom.participants`, [...this.conferenceRoom.participants.values()]);
            let peerId: string;
            if (this.localParticipant.participantId === participantId) {
                console.log(`this is a local peer`);
                peerId = this.localParticipant.peerId;
            } else {
                peerId = this.conferenceRoom.participants.get(participantId)?.peerId;
            }

            if (!peerId) {
                console.error(`peerId not found.`);
                return;
            }

            //console.log("particpant tracks", particpant.mediaStream.getTracks());
            this.roomsClient.roomProducerToggleStream(peerId);
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

    connect(conf_wsURIOverride: string = "") {
        console.log(`connect - autoReconnect: ${this.socketAutoReconnect}, conf_wsURIOverride: ${conf_wsURIOverride}`);
        if (this.socket) {
            console.log("already connecting.");
            return;
        }

        console.log("connect");

        if (conf_wsURIOverride) {
            this.config.conf_wsURI = conf_wsURIOverride;
        }

        // Connect to WebSocket server
        this.socket = new WebSocketClient({ enableLogs: this.config.enableSocketLogs });

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

        this.socket.connect(this.config.conf_wsURI, this.socketAutoReconnect);

    }

    private async onSocketConnected() {
        console.log("onSocketConnected()");

        await this.onEvent(EventTypes.connected);
    }

    private async onSocketClosed(reason: string = "") {
        console.log("onSocketClosed() - reason:", reason);

        if (this.roomsClient) {
            this.roomsClient.roomLeave();
            this.roomsClient.disconnect();
            this.roomsClient.dispose();
            this.roomsClient = null;
        }

        await this.onEvent(EventTypes.disconnected);

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
        console.warn("conferneceClient disconnect");

        this.disconnectRoomsClient("disconnect");

        this.socketAutoReconnect = false;
        if (this.socket) {
            console.warn(`disconnecting from socket`);
            this.socket.disconnect();
            this.socket = null;
        }
    }

    isInConference() {
        return this.conferenceRoom.conferenceRoomId > "";
    }

    register(username: string, authToken: string) {
        console.log("register");

        // Register with the server
        const registerMsg: RegisterMsg = new RegisterMsg();
        registerMsg.data.username = username;
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
     * send an invite to a participant that is online
     * this is a p2p conference room
     * @param participantId 
     */
    invite(participantId: string): InviteMsg {
        console.log(`invite() ${participantId}`);

        if (this.isInConference()) {
            console.error(this.DSTR, "invite() - already in a conference.");
            return null;
        }

        if (this.inviteSendMsg || this.inviteReceivedMsg) {
            console.error(`pending invite message`);
            return null;
        }

        this.callState = "calling";
        this.inviteSendMsg = new InviteMsg();
        this.inviteSendMsg.data.participantId = participantId;
        this.sendToServer(this.inviteSendMsg);

        this.startCallConnectTimer();

        return this.inviteSendMsg;
    }

    cancelInvite(invite: InviteMsg) {
        console.log(`cancelInvite() ${invite.data.participantId} ${invite.data.conferenceRoomId}`);

        const callMsg = new InviteCancelledMsg();
        callMsg.data.participantId = invite.data.participantId;
        callMsg.data.conferenceRoomId = invite.data.conferenceRoomId;
        this.sendToServer(callMsg);

        this.resetConferenceRoom();
    }

    createConferenceRoom(trackingId: string, roomName: string, config: ConferenceRoomConfig = new ConferenceRoomConfig()) {
        console.log(`createConferenceRoom trackingId: ${trackingId}, roomName: ${roomName}`);

        const msg = new CreateConfMsg();
        msg.data.conferenceRoomTrackingId = trackingId;
        msg.data.roomName = roomName;
        msg.data.conferenceRoomConfig = config;
        this.sendToServer(msg);
    }

    joinConferenceRoom(conferenceRoomId: string) {
        console.log(`joinConferenceRoom ${conferenceRoomId}`);

        if (this.conferenceRoom.conferenceRoomId) {
            console.error(`already in conferenceroom ${this.conferenceRoom.conferenceRoomId}`);
            return;
        }

        this.startCallConnectTimer();
        this.callState = "connecting";

        const msg = new JoinConfMsg();
        msg.data.conferenceRoomId = conferenceRoomId;
        this.conferenceRoom.conferenceRoomId = conferenceRoomId;
        this.sendToServer(msg);
    }


    /**
     * sent and invite and received a result
     */
    private async onInviteResult(message: InviteResultMsg) {
        console.log("onInviteResult()");
        //the conferenceRoomId must be empty or it must match

        if (message.data.error) {
            console.error(this.DSTR, "onInviteResult() - error received");
            this.callState = "disconnected";

        }

        if (!message.data.conferenceRoomId) {
            console.error(this.DSTR, "onInviteResult() - no conferenceRoomId");
            this.callState = "disconnected";
        }

        if (!this.inviteSendMsg) {
            console.error(this.DSTR, "onInviteResult() - no invite sent");
            this.callState = "disconnected";
        }

        if (this.conferenceRoom.conferenceRoomId && this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.error(this.DSTR, `onInviteResult() - incorrect conferenceRoomId ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            this.callState = "disconnected";
        }

        if (this.inviteSendMsg.data.participantId != message.data.participantId) {
            console.error(this.DSTR, `onInviteResult() - incorrect participantId, invite:${this.inviteSendMsg.data.participantId} msg:${message.data.participantId}`);
            this.callState = "disconnected";
        }

        if (this.callState === "disconnected") {
            await this.onEvent(EventTypes.inviteResult, message);
            this.resetConferenceRoom();
            return;
        }

        console.log(`onInviteResult() - received a new conferenceRoomId ${message.data.conferenceRoomId}`);
        console.log(`set conferenceRoomId ${message.data.conferenceRoomId}`);

        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.conferenceRoom.conferenceRoomName = message.data.conferenceRoomName || `Call with ${message.data.displayName}`;
        this.conferenceRoom.conferenceRoomTrackingId = message.data.conferenceRoomTrackingId;
        this.conferenceRoom.conferenceType = message.data.conferenceType;

        this.startCallConnectTimer();

        await this.onEvent(EventTypes.inviteResult, message);
    }

    async onInviteReceived(message: InviteMsg) {
        console.log("onInviteReceived()");
        if (this.isInConference()) {
            console.log(`already in a conference. ${this.conferenceRoom.conferenceRoomId}`);
            return;
        }

        if (this.inviteSendMsg || this.inviteReceivedMsg) {
            console.log("onInviteReceived() - already have an pending invite message.");
            return;
        }

        this.callState = "answering";
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.conferenceRoom.conferenceRoomName = message.data.conferenceRoomName || `Call with ${message.data.displayName}`;
        this.conferenceRoom.conferenceRoomTrackingId = message.data.conferenceRoomTrackingId;
        this.conferenceRoom.conferenceType = message.data.conferenceType;

        this.inviteReceivedMsg = message;

        console.log(`set conferenceRoomId ${message.data.conferenceRoomId}`, this.conferenceRoom);
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

        if (message.data.conferenceRoomId != this.conferenceRoom.conferenceRoomId) {
            console.error(this.DSTR, "onInviteCancelled() - not the same conferenceRoomId.");
            return;
        }

        await this.onEvent(EventTypes.inviteCancelled, message);

        this.resetConferenceRoom();
    }

    /**
     * accept an invite from a received invite
     * @param message 
     * @returns 
     */
    acceptInvite(message: InviteMsg) {
        console.log("acceptInvite()");

        if (!this.inviteReceivedMsg) {
            console.error(`not invite received.`);
            return;
        }

        if (message.data.conferenceRoomId != this.inviteReceivedMsg.data.conferenceRoomId) {
            console.error(this.DSTR, "accept failed. not the same conferenceRoomId");
            return false;
        }

        if (message.data.participantId != this.inviteReceivedMsg.data.participantId) {
            console.error(this.DSTR, "accept failed. not the same participantId");
            return false;
        }

        const acceptMsg = new AcceptMsg();
        acceptMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        this.sendToServer(acceptMsg);

        this.callState = "connecting";
        this.inviteReceivedMsg = null;
        this.startCallConnectTimer();
    }

    /**
     * after accepting and invite, receive an accept result from the server
     * wait for conference ready message to join room
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

        if (message.data.conferenceRoomId != this.inviteReceivedMsg.data.conferenceRoomId) {
            console.error(this.DSTR, "accept failed. not the same conferenceRoomId");
            return false;
        }

        if (message.data.participantId != this.inviteReceivedMsg.data.participantId) {
            console.error(this.DSTR, "accept failed. not the same participantId");
            return false;
        }

        let msg = new RejectMsg();
        msg.data.conferenceRoomId = message.data.conferenceRoomId;
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
        msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
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
    }

    getParticipant(participantId: string): Participant {
        console.log("getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }

    private sendToServer(message: any) {
        console.log("sendToServer " + message.type, message);

        if (this.socket) {            
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }

    private async onRegisterResult(message: RegisterResultMsg) {
        console.log("onRegisterResult");

        if (message.data.error) {
            console.error(message.data.error);
            await this.onEvent(EventTypes.registerResult, message);
        } else {
            this.localParticipant.participantId = message.data.participantId;
            this.localParticipant.displayName = message.data.username;
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

        this.conferences = message.data;
        await this.onEvent(EventTypes.conferencesReceived, message);
    }

    /**
     * the remote user rejected the invite
     * @param message 
     */
    private async onRejectReceived(message: InviteResultMsg) {
        console.log("onRejectReceived");

        if (this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.error(this.DSTR, `conferenceRoomId does not match ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            return;
        }

        this.clearCallConnectTimer();

        await this.onEvent(EventTypes.rejectReceived, message);

        this.callState = "disconnected";
        this.conferenceRoom.conferenceRoomId = "";
        this.inviteSendMsg = null;
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
            console.error(this.DSTR, message.data.error);

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
            console.error(this.DSTR, "onJoinConfResult() - error received");

            this.clearCallConnectTimer();
            this.callState = "disconnected";
            this.conferenceRoom.conferenceRoomId = "";

            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: message.data.error } });
            this.disconnectRoomsClient("onJoinConfResult");
            return;
        }

    }

    /**
     * conference is ready to be used
     * @param message 
     * @returns 
     */
    private async onConferenceReady(message: ConferenceReadyMsg) {
        console.log("onConferenceReady()");

        if (this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.error(this.DSTR, `onConferenceReady() - conferenceRoomId does not match ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            return;
        }

        this.conferenceRoom.conferenceRoomTrackingId = message.data.conferenceRoomId;
        this.conferenceRoom.conferenceRoomName = message.data.conferenceRoomName || `Call with ${message.data.displayName}`;
        this.conferenceRoom.conferenceRoomTrackingId = message.data.conferenceRoomTrackingId;
        this.conferenceRoom.conferenceType = message.data.conferenceType;
        this.conferenceRoom.conferenceRoomConfig = message.data.conferenceRoomConfig;


        this.conferenceRoom.roomId = message.data.roomId;
        this.conferenceRoom.roomToken = message.data.roomToken;
        this.conferenceRoom.roomURI = message.data.roomURI;
        this.conferenceRoom.roomAuthToken = message.data.authToken;



        if (!this.conferenceRoom.roomId) {
            console.error(this.DSTR, "ERROR: no roomId");
            return;
        }

        if (!this.conferenceRoom.roomToken) {
            console.error(this.DSTR, "ERROR: no roomToken");
            return;
        }

        if (!this.conferenceRoom.roomURI) {
            console.error(this.DSTR, "ERROR: no roomURI");
            return;
        }

        if (!this.conferenceRoom.roomAuthToken) {
            console.error(this.DSTR, "ERROR: no roomAuthToken");
            return;
        }

        if (!message.data.roomRtpCapabilities) {
            console.error(this.DSTR, "ERROR: no roomRtpCapabilities");
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
                console.log(`-- room socket registered. peerId ${this.roomsClient.localPeer.peerId}`);
                this.localParticipant.peerId = this.roomsClient.localPeer.peerId;
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
                        conferenceRoomId: this.conferenceRoom.conferenceRoomId
                    }
                };

                this.resetConferenceRoom();

                this.disconnectRoomsClient("join conference failed.");
                await this.onEvent(EventTypes.conferenceFailed, msg);

            }
        } catch (err) {
            console.error(this.DSTR, err);

            this.resetConferenceRoom();

            this.disconnectRoomsClient("join conference error.");
            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: "error connecting to conference." } });
        }
    }

    private async onConferenceClosed(message: ConferenceClosedMsg) {
        console.log("onConferenceClosed()");

        if (!this.isInConference()) {
            console.error(this.DSTR, "onConferenceClosed() - not in a conference.");
            return;
        }

        if (this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.error(this.DSTR, `onConferenceClosed() - conferenceRoomId does not match ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
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

        if (this.roomsClient && this.roomsClient.config.wsURI == roomURI) {
            console.log("room already initialized with URI:", roomURI);
            return;
        }

        this.roomsClient = new RoomsClient();

        this.roomsClient.eventOnRoomSocketClosed = async () => {
            console.log("onRoomSocketClosedEvent");

            //room socket closed
            //leave the conferenceRoom
            this.leave();

            //if in conference, notify the conference closed
            if (this.isInConference()) {
                let msg = new ConferenceClosedMsg();
                msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
                msg.data.reason = "disconnected from room server";
                this.onEvent(EventTypes.conferenceClosed, msg);
            }

            this.resetConferenceRoom();

            //disconnect the rooms client immediately
            this.disconnectRoomsClient("onRoomClosedEvent", 0);

        };

        this.roomsClient.eventOnRoomJoined = async (roomId: string) => {
            //confirmation for local user has joined a room
            console.log("onRoomJoinedEvent roomId:", roomId);
            this.clearCallConnectTimer();
            this.callState = "connected";

            //add self to the call participants
            this.conferenceRoom.participants.set(this.localParticipant.participantId, this.localParticipant);
            console.log(`add self to conferenceRoom.participants ${this.conferenceRoom.participants.size}`);

            let msg = {
                type: EventTypes.conferenceJoined,
                data: {
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId
                }
            }
            await this.onEvent(EventTypes.conferenceJoined, msg);

        };

        this.roomsClient.eventOnRoomClosed = async (roomId: string, peers: Peer[]) => {
            console.log("onRoomClosedEvent roomId:", roomId);

            //leave the conferenceRoom
            this.leave();

            this.clearCallConnectTimer();
            this.callState = "disconnected";

            this.disconnectRoomsClient("onRoomClosedEvent");

            let msg = new ConferenceClosedMsg();
            msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            msg.data.reason = "room closed";
            await this.onEvent(EventTypes.conferenceClosed, msg);

            this.resetConferenceRoom();
        };

        this.roomsClient.eventOnRoomPeerJoined = async (roomId: string, peer: Peer) => {
            console.log(`onRoomPeerJoinedEvent roomId: ${roomId} ${peer.peerId} ${peer.displayName} `);

            let participant = this.conferenceRoom.participants.get(peer.trackingId);

            if (participant) {
                console.error(`participant already in local conferenceRoom: ${participant.displayName}`);
                return;
            }


            //this is a new peer get 
            participant = new Participant();
            participant.displayName = peer.displayName;
            participant.participantId = peer.trackingId;
            participant.peerId = peer.peerId;
            this.conferenceRoom.participants.set(participant.participantId, participant);
            console.log(`adding new participant to the room: ${participant.displayName}, ${this.conferenceRoom.participants.size}`);


            let msg = {
                type: EventTypes.participantJoined,
                data: {
                    participantId: participant.participantId,
                    displayName: participant.displayName,
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId,
                    peerId: peer.peerId,
                    roomId: roomId
                }
            }
            await this.onEvent(EventTypes.participantJoined, msg);
        };

        this.roomsClient.eventOnPeerNewTrack = async (peer: IPeer, track: MediaStreamTrack) => {
            console.log("onPeerNewTrackEvent peerId:", peer.peerId);

            let participant = this.conferenceRoom.participants.get(peer.trackingId);
            if (!participant) {
                console.error("participant not found.");
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
            await this.onEvent(EventTypes.participantNewTrack, msg);

        };

        this.roomsClient.eventOnRoomPeerLeft = async (roomId: string, peer: IPeer) => {
            console.log("eventOnRoomPeerLeft roomId:", roomId);

            let participant = this.conferenceRoom.participants.get(peer.trackingId);
            if (!participant) {
                console.error("participant not found.");
                return;
            }

            this.conferenceRoom.participants.delete(participant.participantId);

            let msg = {
                type: EventTypes.participantLeft,
                data: {
                    participantId: participant.participantId
                }
            }
            await this.onEvent(EventTypes.participantLeft, msg);

        };

        this.roomsClient.eventOnPeerTrackToggled = async (peer: IPeer, track: MediaStreamTrack, enabled: boolean) => {
            console.log(`eventOnTrackToggled peerId: ${peer.peerId} trackingId: ${peer.trackingId} displayName: ${peer.displayName}`);

            console.log(`participants:`, this.conferenceRoom.participants);

            let participant: Participant;
            if (this.localParticipant.participantId === peer.trackingId) {
                participant = this.localParticipant;
            } else {
                participant = this.conferenceRoom.participants.get(peer.trackingId);
            }

            if (!participant) {
                console.error("participant not found.");
                return;
            }

            console.log(`toggling track for: ${participant.displayName} kind: ${track.kind} ${track.id}`);

            let existingTrack = participant.stream.getTracks().find(t => t === track);
            if (!existingTrack) {
                console.error(`not match track found. participant tracks:`, participant.stream.getTracks(), track);
                return;
            }

            if (track.kind === "video") {
                participant.isVideoOff = !track.enabled;
                console.log(`isVideoOff updated to ${participant.isVideoOff}`);
            } else if (track.kind === "audio") {
                participant.isMuted = !track.enabled;
                console.log(`isMuted updated to ${participant.isVideoOff}`);
            }

            let msg = {
                type: EventTypes.participantTrackToggled,
                data: {
                    participantId: participant.participantId,
                    track: track,
                    enabled: enabled
                }
            }
            await this.onEvent(EventTypes.participantTrackToggled, msg);
        };

        await this.roomsClient.inititalize({ socketAutoConnect: false, socketURI: roomURI, rtpCapabilities: roomRtpCapabilities });
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