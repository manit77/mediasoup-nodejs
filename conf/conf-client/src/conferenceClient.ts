import {
    AcceptMsg,
    AcceptResultMsg,
    CallMessageType, ConferenceClosedMsg, ConferenceReadyMsg, ConferenceRoomConfig, ConferenceRoomInfo, CreateConfMsg, CreateConfResultMsg, GetConferencesMsg, GetConferencesResultMsg, GetParticipantsMsg, GetParticipantsResultMsg, InviteCancelledMsg, InviteMsg, InviteResultMsg
    , JoinConfMsg, JoinConfResultMsg, LeaveMsg, ParticipantInfo, RegisterMsg, RegisterResultMsg, RejectMsg
} from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { RoomsClient, Peer, LocalPeer } from "@rooms/rooms-client";

class Participant {
    participantId: string;
    peerId: string;
    displayName: string;
    mediaStream: MediaStream;
}

class Conference {
    conferenceRoomId: string;
    roomAuthToken: string;
    roomToken: string;
    roomId: string;
    roomURI: string;
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
    participantJoined = "participantJoined",
    participantLeft = "participantLeft",

}
type ConferenceEvent = (eventType: EventTypes, payload?: any) => Promise<void>;

export class ConferenceClient {
    private DSTR = "ConferenceCallManager";
    private socket: WebSocketClient;
    participantId: string = '';
    userName: string = "";
    authToken: string = "";
    conferenceRoom: Conference = new Conference();
    public participants: ParticipantInfo[] = [];
    public conferences: ConferenceRoomInfo[] = [];
    private roomsClient: RoomsClient;
    private roomsClientDisconnectTimerId: any;
    isConnected = false;

    inviteMsg: InviteMsg; //you can only send one invite at a time

    CallConnectTimeoutTimerId: any;
    CallConnectTimeoutSeconds = 5;

    config = {
        conf_wsURI: 'wss://localhost:3001'
    }

    onEvent: ConferenceEvent;

    constructor() {
    }

    startCallConnectTimer() {
        console.log("startCallConnectTimer");

        this.CallConnectTimeoutTimerId = setTimeout(async () => {
            console.error("CallConnectTimer executed");
            if (this.conferenceRoom.conferenceRoomId) {
                this.conferenceRoom = new Conference();

                let msg = new ConferenceClosedMsg();
                msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
                msg.data.reason = "call timed out";
                await this.onEvent(EventTypes.conferenceClosed, msg)
            }
        }, this.CallConnectTimeoutSeconds * 1000);
    }

    clearCallConnectTimer() {
        console.log("clearCallConnectTimer");
        if (this.CallConnectTimeoutTimerId) {
            clearTimeout(this.CallConnectTimeoutTimerId);
            this.CallConnectTimeoutTimerId = null;
        }
    }

    publishTracks(tracks: MediaStream) {
        console.log(`publishTracks`);
        if (this.roomsClient) {
            this.roomsClient.publishTracks(tracks);
        }
    }

    unpublishTracks(tracks: MediaStream) {
        console.log(`unpublishTracks`);
        if (this.roomsClient) {
            this.roomsClient.unPublishTracks(tracks);
        }
    }

    getTracks() {
        // if (this.roomsClient) {
        //     this.roomsClient.getTracks();
        // }

        return [];
    }

    async startScreenShare() {
        console.log(`startScreenShare`);

        if (!this.roomsClient) {
            console.error("roomsClient not initialized.");
            return;
        }

        try {

            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });

            let videoTrack = screenStream.getVideoTracks()[0];
            videoTrack.onended = () => {
                this.stopScreenShare(screenStream);
            };

            console.log(`screen videoTrack created ${videoTrack.kind} ${videoTrack.id}`);

            let existingTrack = this.roomsClient.findTrack("video");
            if (existingTrack) {
                //replace the videoTrack with screen track
                console.log(`existingTrack found ${existingTrack.kind} ${existingTrack.id}`);
                this.roomsClient.replaceTrack(existingTrack, videoTrack);
            } else {
                this.roomsClient.publishTracks(new MediaStream([videoTrack]));
            }

            return screenStream;
        } catch (error) {
            console.error('Error starting screen share:', error);
            return null;
        }
    }

    async stopScreenShare(screenStream: MediaStream) {

        console.log(this.DSTR, "stopScreenShare");

        let videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.stop();
        }
    }

    connect(autoReconnect: boolean, conf_wsURIOverride: string = "") {

        if (this.socket) {
            console.log(this.DSTR, "already connecting.");
            return;
        }

        console.log(this.DSTR, "connect");

        if (conf_wsURIOverride) {
            this.config.conf_wsURI = conf_wsURIOverride;
        }

        // Connect to WebSocket server
        this.socket = new WebSocketClient();

        this.socket.addEventHandler("onopen", async () => {

            this.isConnected = true;
            await this.onEvent(EventTypes.connected);

        });

        this.socket.addEventHandler("onclose", async () => {
            this.isConnected = false;
            //fire event onclose       
            await this.onEvent(EventTypes.disconnected);
        });

        this.socket.addEventHandler("onerror", async (error: any) => {
            console.error('WebSocket Error:', error);
            //fire event on disconnected
            await this.onEvent(EventTypes.disconnected);
        });

        this.socket.addEventHandler("onmessage", async (event: any) => {
            const message = JSON.parse(event.data);
            console.log(this.DSTR, 'Received message ' + message.type, message);

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
        });

        this.socket.connect(this.config.conf_wsURI, autoReconnect);

    }

    disconnect() {
        console.log(this.DSTR, "disconnect");
        this.disconnectRoomsClient("disconnect");
        this.socket.disconnect();
        this.socket = null;
    }

    isInConference() {
        return this.conferenceRoom.conferenceRoomId > "";
    }

    register(username: string) {
        console.log(this.DSTR, "register");
        // Register with the server
        const registerMsg: RegisterMsg = new RegisterMsg();
        registerMsg.data.userName = username;
        this.sendToServer(registerMsg);
    }

    getParticipantsOnline() {
        console.log(this.DSTR, "getParticipantsOnline");
        const getParticipantsMsg = new GetParticipantsMsg();
        this.sendToServer(getParticipantsMsg);
    }

    getConferenceRooms() {
        console.log(this.DSTR, "getConferenceRooms");
        const msg = new GetConferencesMsg();
        this.sendToServer(msg);
    }

    /**
     * send an invite to a participant that is online
     * @param participantId 
     */
    invite(participantId: string): InviteMsg {
        console.log(this.DSTR, "invite()");
        this.inviteMsg = new InviteMsg();
        this.inviteMsg.data.participantId = participantId;
        this.sendToServer(this.inviteMsg);

        this.startCallConnectTimer();

        return this.inviteMsg;
    }

    cancelInvite(inviteMsg: InviteMsg) {
        console.log(this.DSTR, "inviteCancel()");
        const callMsg = new InviteCancelledMsg();
        callMsg.data.participantId = inviteMsg.data.participantId;
        callMsg.data.conferenceRoomId = inviteMsg.data.conferenceRoomId;
        this.sendToServer(callMsg);

        this.inviteMsg = null;
        this.conferenceRoom.conferenceRoomId = "";
        this.clearCallConnectTimer();
    }

    createConferenceRoom(trackingId: string, roomName: string) {
        const msg = new CreateConfMsg();
        msg.data.conferenceRoomTrackingId = trackingId;
        msg.data.roomName = roomName;
        msg.data.conferenceRoomConfig = new ConferenceRoomConfig();
        this.sendToServer(msg);
    }

    joinConferenceRoom(conferenceRoomId: string) {
        console.log(`joinConferenceRoom ${conferenceRoomId}`);
        if (this.conferenceRoom.conferenceRoomId) {
            console.error(`already in conferenceroom ${this.conferenceRoom.conferenceRoomId}`);
            return;
        }
        const msg = new JoinConfMsg();
        msg.data.conferenceRoomId = conferenceRoomId;
        this.conferenceRoom.conferenceRoomId = conferenceRoomId;
        this.sendToServer(msg);

        this.startCallConnectTimer();
    }

    /*
    receive an invite result 
    */
    private async onInviteResult(message: InviteResultMsg) {
        console.log(this.DSTR, "onInviteResult()");
        //the conferenceRoomId must be empty or it must match

        if (message.data.error) {
            await this.onEvent(EventTypes.inviteResult, message);
            return;
        }

        if (!message.data.conferenceRoomId) {
            console.error(this.DSTR, "onInviteResult() - no conferenceRoomId");
            return;
        }

        if (!this.inviteMsg) {
            console.error(this.DSTR, "onInviteResult() - no invite sent");
            return;
        }

        if (this.conferenceRoom.conferenceRoomId && this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.error(this.DSTR, `onInviteResult() - incorrect conferenceRoomId ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            return;
        }

        if (this.inviteMsg.data.participantId != message.data.participantId) {
            console.error(this.DSTR, `onInviteResult() - incorrect participantId, invite:${this.inviteMsg.data.participantId} msg:${message.data.participantId}`);
            return;
        }

        console.log(this.DSTR, `onInviteResult() - received a new conferenceRoomId ${message.data.conferenceRoomId}`);
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        console.log(`set conferenceRoomId ${message.data.conferenceRoomId}`);

        await this.onEvent(EventTypes.inviteResult, message);
    }

    async onInviteReceived(message: InviteMsg) {
        console.log(this.DSTR, "onInviteReceived()");
        if (this.isInConference()) {
            console.log(this.DSTR, `already in a conference. ${this.conferenceRoom.conferenceRoomId}`);
            return;
        }
        this.inviteMsg = message;
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        console.log(`set conferenceRoomId ${message.data.conferenceRoomId}`);
        await this.onEvent(EventTypes.inviteReceived, message);
        this.startCallConnectTimer();

    }

    async onInviteCancelled(message: InviteCancelledMsg) {
        console.log(this.DSTR, "onInviteCancelled()");
        if (message.data.conferenceRoomId != this.conferenceRoom.conferenceRoomId) {
            console.log(this.DSTR, "onInviteCancelled() - not the same conferenceRoomId.");
            return;
        }
        await this.onEvent(EventTypes.inviteCancelled, message);

        this.conferenceRoom.conferenceRoomId = "";
        this.inviteMsg = null;
        this.clearCallConnectTimer();
    }

    acceptInvite(message: InviteMsg) {
        console.log(this.DSTR, "acceptInvite()");

        if (message.data.conferenceRoomId != this.inviteMsg.data.conferenceRoomId) {
            console.log(this.DSTR, "accept failed. not the same conferenceRoomId");
            return false;
        }

        if (message.data.participantId != this.inviteMsg.data.participantId) {
            console.log(this.DSTR, "accept failed. not the same participantId");
            return false;
        }

        const acceptMsg = new AcceptMsg();
        acceptMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        this.sendToServer(acceptMsg);

        this.inviteMsg = null;
        this.startCallConnectTimer();
    }

    async onAcceptResult(message: AcceptResultMsg) {
        console.log(this.DSTR, "onAcceptResult()");
        await this.onEvent(EventTypes.acceptResult, message);

        if (message.data.error) {
            console.error(`accept results received with error`);
            console.error(message.data.error);
            this.conferenceRoom.conferenceRoomId = "";
            this.clearCallConnectTimer();
        }
    }

    rejectInvite(message: InviteMsg) {
        console.log(this.DSTR, "reject()");

        if (message.data.conferenceRoomId != this.inviteMsg.data.conferenceRoomId) {
            console.log(this.DSTR, "accept failed. not the same conferenceRoomId");
            return false;
        }

        if (message.data.participantId != this.inviteMsg.data.participantId) {
            console.log(this.DSTR, "accept failed. not the same participantId");
            return false;
        }

        let msg = new RejectMsg();
        msg.data.conferenceRoomId = message.data.conferenceRoomId;
        msg.data.fromParticipantId = this.participantId;
        msg.data.toParticipantId = message.data.participantId;
        this.sendToServer(msg);

        this.inviteMsg = null;
        this.conferenceRoom.conferenceRoomId = "";
        this.clearCallConnectTimer();
    }

    leave() {
        console.log(this.DSTR, "leave()");

        if (this.roomsClient) {
            this.roomsClient.roomLeave();
        }

        this.disconnectRoomsClient("leave");

        if (!this.isInConference()) {
            console.log(this.DSTR, "leave() - failed, not in conference");
            return;
        }

        let msg = new LeaveMsg();
        msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
        this.sendToServer(msg);

        this.conferenceRoom.conferenceRoomId = "";
        this.inviteMsg = null;
        this.clearCallConnectTimer();
    }

    getParticipant(participantId: string): Participant {
        console.log(this.DSTR, "getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }

    private sendToServer(message: any) {
        console.log(this.DSTR, "sendToServer " + message.type, message);
        if (this.socket) {
            if (!message.authToken) {
                message.authToken = this.authToken;
            }
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }

    private async onRegisterResult(message: RegisterResultMsg) {
        console.log(this.DSTR, "onRegisterResult");
        if (message.data.error) {
            console.error(message.data.error);
            await this.onEvent(EventTypes.registerResult, message);
        } else {
            this.participantId = message.data.participantId;
            this.userName = message.data.userName;
            console.log(this.DSTR, 'Registered with participantId:', this.participantId, this.userName);
            await this.onEvent(EventTypes.registerResult, message);
        }
    }

    private async onParticipantsReceived(message: GetParticipantsResultMsg) {
        console.log(this.DSTR, "onParticipantsReceived");
        this.participants = message.data.filter(c => c.participantId !== this.participantId);
        await this.onEvent(EventTypes.participantsReceived, message);
    }

    private async onConferencesReceived(message: GetConferencesResultMsg) {
        console.log(this.DSTR, "onConferencesReceived");
        this.conferences = message.data;
        await this.onEvent(EventTypes.conferencesReceived, message);
    }

    private async onRejectReceived(message: InviteResultMsg) {
        console.log(this.DSTR, "onRejectReceived");
        await this.onEvent(EventTypes.rejectReceived, message);

        this.conferenceRoom.conferenceRoomId = "";
        this.inviteMsg = null;
        this.clearCallConnectTimer();

        this.disconnectRoomsClient("onRejectReceived");
    }

    private async onCreateConfResult(message: CreateConfResultMsg) {
        console.log(this.DSTR, "onCreateConfResult");
        if (message.data.error) {
            console.error(this.DSTR, message.data.error);
            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: "failed to join conference." } });
            this.disconnectRoomsClient("onCreateConfResult");
            return;
        }
        await this.onEvent(EventTypes.conferenceCreatedResult, message);
    }

    private async onJoinConfResult(message: JoinConfResultMsg) {
        console.log(this.DSTR, "onJoinConfResult");
        if (message.data.error) {
            this.conferenceRoom.conferenceRoomId = "";
            this.clearCallConnectTimer();
            console.error(this.DSTR, message.data.error);
            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: "failed to join conference." } });
            this.disconnectRoomsClient("onJoinConfResult");
            return;
        }

        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        await this.onEvent(EventTypes.conferenceJoined, message);
        this.clearCallConnectTimer();
    }

    private async onConferenceReady(message: ConferenceReadyMsg) {
        console.log(this.DSTR, "onConferenceReady()");

        if (this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.error(this.DSTR, `onConferenceReady() - conferenceRoomId does not match ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            return;
        }

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
            console.log(this.DSTR, "-- room initialized.")

            let connectResult = await this.roomsClient.waitForConnect();
            if (!connectResult.data.error) {
                console.log(this.DSTR, "-- room socket connected.");
            } else {
                console.log(this.DSTR, "-- room socket failed to connect.");
            }

            let registerResult = await this.roomsClient.waitForRegister(this.conferenceRoom.roomAuthToken, this.participantId, this.userName);
            if (!registerResult.data.error) {
                console.log(this.DSTR, "-- room socket registered.");
            } else {
                console.log(this.DSTR, "-- room socket failed to register.");
            }

            let roomJoinResult = connectResult = await this.roomsClient.waitForRoomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);
            if (!roomJoinResult.data.error) {
                console.log(this.DSTR, "-- room join.");
            } else {
                console.log(this.DSTR, "-- room failed to join.");
            }

            if (connectResult.data.error || registerResult.data.error || roomJoinResult.data.error) {
                //call failed
                let msg = {
                    type: EventTypes.conferenceFailed,
                    data: {
                        conferenceRoomId: this.conferenceRoom.conferenceRoomId
                    }
                };

                this.clearCallConnectTimer();
                this.conferenceRoom = new Conference();
                this.disconnectRoomsClient("join conference failed.");
                await this.onEvent(EventTypes.conferenceFailed, msg);

            }
        } catch (err) {
            console.error(this.DSTR, err);
            this.disconnectRoomsClient("join conference error.");
            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: "error connecting to conference." } });
        }
    }

    private async onConferenceClosed(message: ConferenceClosedMsg) {
        console.log(this.DSTR, "onConferenceClosed()");
        if (this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.error(this.DSTR, `onConferenceClosed() - conferenceRoomId does not match ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            return;
        }
        await this.onEvent(EventTypes.conferenceClosed, message);
        this.conferenceRoom.conferenceRoomId = "";
        this.clearCallConnectTimer();
    }

    private async initRoomsClient(roomURI: string, roomRtpCapabilities: string) {
        console.log(this.DSTR, "initRoomsClient");

        if (this.roomsClientDisconnectTimerId) {
            console.log(this.DSTR, "clear roomsClientDisconnectTimer");
            clearTimeout(this.roomsClientDisconnectTimerId);
        }

        if (this.roomsClient && this.roomsClient.config.wsURI == roomURI) {
            console.log(this.DSTR, "room already initialized with URI:", roomURI);
            return;
        }

        this.roomsClient = new RoomsClient();

        this.roomsClient.eventOnRoomJoined = async (roomId: string) => {
            //confirmation for local user has joined a room
            console.log(this.DSTR, "onRoomJoinedEvent roomId:", roomId);
            this.clearCallConnectTimer();
            let msg = {
                type: EventTypes.conferenceJoined,
                data: {
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId
                }
            }
            await this.onEvent(EventTypes.conferenceJoined, msg);

        };

        this.roomsClient.eventOnRoomClosed = async (roomId: string, peers: Peer[]) => {
            console.log(this.DSTR, "onRoomClosedEvent roomId:", roomId);

            this.clearCallConnectTimer();
            this.disconnectRoomsClient("onRoomClosedEvent");

            let msg = {
                type: EventTypes.conferenceClosed,
                data: { roomId: this.conferenceRoom.roomId }
            }
            await this.onEvent(EventTypes.conferenceClosed, msg);
            this.conferenceRoom = new Conference();
        };

        this.roomsClient.eventOnRoomPeerJoined = async (roomId: string, peer: Peer) => {
            console.log(this.DSTR, "onRoomPeerJoinedEvent roomId:", roomId);

            let participant = this.conferenceRoom.participants.get(peer.trackingId);
            if (!participant) {
                //this is a new peer get 
                participant = new Participant();
                participant.displayName = peer.displayName;
                participant.mediaStream = new MediaStream();
                participant.participantId = peer.trackingId;
                participant.peerId = peer.peerId;
                this.conferenceRoom.participants.set(participant.participantId, participant);
            }

            if (!participant.participantId) {
                console.error("no participantId");
                return;
            }

            if (!participant.peerId) {
                console.error("no peerid");
                return;
            }

            if (!participant.displayName) {
                console.error("no displayName");
                return;
            }

            let msg = {
                type: EventTypes.participantJoined,
                data: {
                    participantId: participant.participantId,
                    displayName: participant.displayName,
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId
                }
            }
            await this.onEvent(EventTypes.participantJoined, msg);
        };

        this.roomsClient.eventOnPeerNewTrack = async (peer: Peer, track: MediaStreamTrack) => {
            console.log(this.DSTR, "onPeerNewTrackEvent peerId:", peer.peerId);

            let participant = this.conferenceRoom.participants.get(peer.trackingId);
            if (!participant) {
                console.error("participant not found.");
                return;
            }

            let msg = {
                type: EventTypes.participantNewTrack,
                data: {
                    participantId: participant.participantId,
                    track: track
                }
            }
            await this.onEvent(EventTypes.participantNewTrack, msg);

        };

        this.roomsClient.eventOnRoomPeerLeft = async (roomId: string, peer: Peer) => {
            console.log(this.DSTR, "eventOnRoomPeerLeft roomId:", roomId);

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

        await this.roomsClient.init(roomURI, roomRtpCapabilities);
    }

    private disconnectRoomsClient(reason: string) {
        console.log(this.DSTR, "disconnectRoomsClient in 30 seconds");
        this.roomsClientDisconnectTimerId = setTimeout(() => {
            console.log(this.DSTR, `disconnectRoomsClient timeout ${reason}`);
            if (this.roomsClient) {
                this.roomsClientDisconnectTimerId = null;
                this.roomsClient.roomLeave();
                this.roomsClient.disconnect();
                this.roomsClient.dispose();
                this.roomsClient = null;
            }
        }, 10000);

    }

}