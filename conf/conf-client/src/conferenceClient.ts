import {
    AcceptMsg,
    CallMessageType, ConferenceReadyMsg, ConferenceRoomConfig, CreateConfMsg, CreateConfResultMsg, GetContactsMsg, GetContactsResultsMsg, InviteCancelledMsg, InviteMsg, InviteResultMsg
    , JoinConfMsg, JoinConfResultMsg, LeaveMsg, RegisterMsg, RegisterResultMsg, RejectMsg
} from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { RoomsClient, Peer } from "@rooms/rooms-client";

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

interface Contact {
    participantId: string,
    displayName: string,
    status: string
}

export enum EventTypes {

    connected = "connected",
    disconnected = "disconnected",

    registerResult = "registerResult",

    contactsReceived = "contactsReceived",

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
type ConferenceEvent = (eventType: EventTypes, payload?: any) => void;

export class ConferenceClient {
    private DSTR = "ConferenceCallManager";
    private socket: WebSocketClient;
    participantId: string = '';
    userName: string = "";
    conferenceRoom: Conference = new Conference();
    public contacts: Contact[] = [];
    private roomsClient: RoomsClient;
    isConnected = false;

    inviteMsg: InviteMsg; //you can only send one invite at a time

    config = {
        conf_wsURI: 'wss://localhost:3001'
    }

    onEvent: ConferenceEvent;

    constructor() {
    }

    publishTracks(tracks: MediaStream) {
        if (this.roomsClient) {
            this.roomsClient.addLocalTracks(tracks);
        }
    }

    unpublishTracks(tracks: MediaStream) {
        if (this.roomsClient) {
            this.roomsClient.removeLocalTracks(tracks);
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
                this.roomsClient.addLocalTracks(new MediaStream([videoTrack]));
            }

            return screenStream;
        } catch (error) {
            console.error('Error starting screen share:', error);
            return null;
        }
    }

    async stopScreenShare(screenStream: MediaStream) {
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

        this.socket.addEventHandler("onopen", () => {

            this.isConnected = true;
            this.onEvent(EventTypes.connected);

        });

        this.socket.addEventHandler("onclose", () => {
            this.isConnected = false;
            //fire event onclose       
            this.onEvent(EventTypes.disconnected);
        });

        this.socket.addEventHandler("onerror", (error: any) => {
            console.error('WebSocket Error:', error);
            //fire event on disconnected
            this.onEvent(EventTypes.disconnected);
        });

        this.socket.addEventHandler("onmessage", (event: any) => {
            const message = JSON.parse(event.data);
            console.log(this.DSTR, 'Received message ' + message.type, message);

            switch (message.type) {
                case CallMessageType.registerResult:
                    this.onRegisterResult(message);
                    break;
                case CallMessageType.getContactsResult:
                    this.onContactsReceived(message);
                    break;
                case CallMessageType.invite:
                    this.onInviteReceived(message);
                    break;
                case CallMessageType.reject:
                    this.onRejectReceived(message);
                    break;
                case CallMessageType.inviteResult:
                    this.onInviteResult(message);
                    break;
                case CallMessageType.inviteCancelled:
                    this.onInviteCancelled(message);
                    break;
                case CallMessageType.createConfResult:
                    this.onCreateConfResult(message);
                    break;
                case CallMessageType.joinConfResult:
                    this.onJoinConfResult(message);
                    break;
                case CallMessageType.conferenceReady:
                    this.onConferenceReady(message);
                    break;

            }
        });

        this.socket.connect(this.config.conf_wsURI, autoReconnect);

    }

    disconnect() {
        console.log(this.DSTR, "disconnect");
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

    getContacts() {
        console.log(this.DSTR, "getContacts");
        const contactsMsg = new GetContactsMsg();
        this.sendToServer(contactsMsg);
    }

    /**
     * send an invite to a contact that is onlin
     * @param contact 
     */
    invite(participantId: string): InviteMsg {
        console.log(this.DSTR, "invite()");
        this.inviteMsg = new InviteMsg();
        this.inviteMsg.data.participantId = participantId;
        this.sendToServer(this.inviteMsg);
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
    }

    createConferenceRoom(trackingId: string) {
        const msg = new CreateConfMsg();
        msg.data.conferenceRoomTrackingId = trackingId;
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
    }

    /*
    receive an invite result 
    */
    private async onInviteResult(message: InviteResultMsg) {
        console.log(this.DSTR, "onInviteResult()");
        //the conferenceRoomId must be empty or it must match

        if (message.data.error) {
            this.onEvent(EventTypes.inviteResult, message);
            return;
        }

        if (!message.data.conferenceRoomId) {
            console.log(this.DSTR, "onInviteResult() - no conferenceRoomId");
            return;
        }

        if (!this.inviteMsg) {
            console.log(this.DSTR, "onInviteResult() - no invite sent");
            return;
        }

        if (this.conferenceRoom.conferenceRoomId && this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            console.log(this.DSTR, `onInviteResult() - incorrect conferenceRoomId ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            return;
        }

        if (this.inviteMsg.data.participantId != message.data.participantId) {
            console.log(this.DSTR, `onInviteResult() - incorrect participantId, invite:${this.inviteMsg.data.participantId} msg:${message.data.participantId}`);
            return;
        }

        console.log(this.DSTR, `onInviteResult() - received a new conferenceRoomId ${message.data.conferenceRoomId}`);
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;

        this.onEvent(EventTypes.inviteResult, message);
    }

    async onInviteReceived(message: InviteMsg) {
        console.log(this.DSTR, "onInviteReceived()");
        if (this.isInConference()) {
            console.log(this.DSTR, "already in a conference.");
            return;
        }
        this.inviteMsg = message;
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.onEvent(EventTypes.inviteReceived, message);

    }

    async onInviteCancelled(message: InviteCancelledMsg) {
        console.log(this.DSTR, "onInviteCancelled()");
        if (message.data.conferenceRoomId != this.conferenceRoom.conferenceRoomId) {
            console.log(this.DSTR, "onInviteCancelled() - not the same conferenceRoomId.");
            return;
        }
        this.onEvent(EventTypes.inviteCancelled, message);

        this.conferenceRoom.conferenceRoomId = "";
        this.inviteMsg = null;
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

        const joinMsg = new AcceptMsg();
        joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        this.sendToServer(joinMsg);
        this.inviteMsg = null;
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
    }

    leave() {
        console.log(this.DSTR, "leave()");

        if (!this.isInConference()) {
            console.log(this.DSTR, "leave() - failed, not in conference");
            return;
        }

        let msg = new LeaveMsg();
        msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
        this.sendToServer(msg);

        if (this.roomsClient && this.roomsClient.isInRoom) {
            this.roomsClient.roomLeave();
        }
        this.conferenceRoom.conferenceRoomId = "";
        this.inviteMsg = null;
    }

    getParticipant(participantId: string): Participant {
        console.log(this.DSTR, "getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }

    private sendToServer(message: any) {
        console.log(this.DSTR, "sendToServer " + message.type, message);
        if (this.socket) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }

    private onRegisterResult(message: RegisterResultMsg) {
        console.log(this.DSTR, "onRegisterResult");
        if (message.data.error) {
            console.error(message.data.error);
            this.onEvent(EventTypes.registerResult, message);
        } else {
            this.participantId = message.data.participantId;
            this.userName = message.data.userName;
            console.log(this.DSTR, 'Registered with participantId:', this.participantId, this.userName);
            this.onEvent(EventTypes.registerResult, message);
        }
    }

    private onContactsReceived(message: GetContactsResultsMsg) {
        console.log(this.DSTR, "onContactsReceived");
        this.contacts = message.data.filter(c => c.participantId !== this.participantId);
        this.onEvent(EventTypes.contactsReceived, message);
    }

    private onRejectReceived(message: InviteResultMsg) {
        console.log(this.DSTR, "onRejectReceived");
        this.onEvent(EventTypes.rejectReceived, message);

        this.conferenceRoom.conferenceRoomId = "";
        this.inviteMsg = null;
    }

    private onCreateConfResult(message: CreateConfResultMsg) {
        console.log(this.DSTR, "onCreateConfResult");
        this.onEvent(EventTypes.conferenceCreatedResult, message);
    }

    private onJoinConfResult(message: JoinConfResultMsg) {
        console.log(this.DSTR, "onJoinConfResult");
        if (message.data.error) {
            this.conferenceRoom.conferenceRoomId = "";
            console.error(message.data.error);
            return;
        }

        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.onEvent(EventTypes.conferenceJoined, message);
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

        this.roomsClient = new RoomsClient();


        this.roomsClient.onRoomJoinedEvent = (roomId: string) => {
            //confirmation for local user has joined a room
            console.log(this.DSTR, "onRoomJoinedEvent");
            let msg = {
                type: EventTypes.conferenceJoined,
                data: {
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId
                }
            }
            this.onEvent(EventTypes.conferenceJoined, msg);
        };

        this.roomsClient.onRoomClosedEvent = (roomId: string, peers: Peer[]) => {
            console.log(this.DSTR, "onRoomClosedEvent");
            this.roomsClient.disconnect();
            this.roomsClient.dispose();

            let msg = {
                type: EventTypes.conferenceClosed,
                data: { roomId: this.conferenceRoom.roomId }
            }
            this.onEvent(EventTypes.conferenceClosed, msg);
            this.conferenceRoom = new Conference();
        };

        this.roomsClient.onRoomPeerJoinedEvent = (roomId: string, peer: Peer) => {
            console.log(this.DSTR, "onRoomPeerJoinedEvent");
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
            this.onEvent(EventTypes.participantJoined, msg);
        };

        this.roomsClient.onPeerNewTrackEvent = (peer: Peer, track: MediaStreamTrack) => {
            console.log(this.DSTR, "onPeerNewTrackEvent");
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
            this.onEvent(EventTypes.participantNewTrack, msg);

        };

        this.roomsClient.onRoomPeerLeftEvent = (roomId: string, peer: Peer) => {
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
            this.onEvent(EventTypes.participantLeft, msg);

        };

        await this.roomsClient.init(message.data.roomURI, message.data.roomRtpCapabilities);
        let connectResult = await this.roomsClient.waitForConnect();
        let registerResult = await this.roomsClient.waitForRegister(this.conferenceRoom.roomAuthToken, this.participantId, this.userName);        
        let roomJoinResult = connectResult = await this.roomsClient.waitForRoomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);

        if (connectResult.data.error || roomJoinResult.data.error) {
            //call failed
            let msg = {
                type: EventTypes.conferenceFailed,
                data: {
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId
                }
            };
            this.onEvent(EventTypes.conferenceFailed, msg);

            this.conferenceRoom = new Conference();
            this.roomsClient.disconnect();
            this.roomsClient.dispose();
            return;
        }
    }

}