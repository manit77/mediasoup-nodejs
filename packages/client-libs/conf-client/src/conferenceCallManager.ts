import {
    AcceptMsg,
    CallMessageType, ConferenceReadyMsg, GetContactsMsg, GetContactsResultsMsg, InviteCancelledMsg, InviteMsg, InviteResultMsg
    , LeaveMsg, RegisterMsg, RegisterResultMsg, RejectMsg
} from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { WebRTCClient } from "@rooms/webrtc-client";
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

    conferenceReady = "conferenceReady",
    conferenceJoined = "conferenceJoined",
    conferenceClosed = "conferenceClosed",
    conferenceFailed = "conferenceFailed",

    participantNewTrack = "participantNewTrack",
    participantJoined = "participantJoined",
    participantLeft = "participantLeft",

}
type ConferenceEvent = (eventType: EventTypes, payload?: any) => void;

export class ConferenceCallManager {
    private DSTR = "ConferenceCallManager";
    private socket: WebSocketClient;
    private localStream: MediaStream | null = null;
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

    writeLog(...params: any) {
        console.log(this.DSTR, ...params);
    }

    setLocalStream(stream: MediaStream) {
        if (this.localStream) {
            //swap out the tracks
            //remove any local tracks
            this.roomsClient.removeLocalTracks(this.localStream);
            this.localStream = stream;
            this.roomsClient.addLocalTracks(this.localStream);
            return;
        }

        this.localStream = stream;
    }

    connect(autoReconnect: boolean, conf_wsURIOverride: string = "") {

        if (this.socket) {
            this.writeLog("already connecting.");
            return;
        }

        this.writeLog("connect");

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
            this.writeLog('Received message ' + message.type, message);

            switch (message.type) {
                case CallMessageType.registerResult:
                    this.onRegisterResult(message);
                    break;
                case CallMessageType.getContactsResults:
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
                case CallMessageType.conferenceReady:
                    this.onConferenceReady(message);
            }
        });

        this.socket.connect(this.config.conf_wsURI, autoReconnect);

    }

    disconnect() {
        this.writeLog("disconnect");
        this.socket.disconnect();
        this.socket = null;
    }

    isInConference() {
        return this.conferenceRoom.conferenceRoomId > "";
    }

    register(username: string) {
        this.writeLog("register");
        // Register with the server
        const registerMsg: RegisterMsg = new RegisterMsg();
        registerMsg.data.userName = username;
        this.sendToServer(registerMsg);
    }

    getContacts() {
        this.writeLog("getContacts");
        const contactsMsg = new GetContactsMsg();
        this.sendToServer(contactsMsg);
    }

    /**
     * send an invite to a contact that is onlin
     * @param contact 
     */
    invite(participantId: string): InviteMsg {
        this.writeLog("invite()");
        this.inviteMsg = new InviteMsg();
        this.inviteMsg.data.participantId = participantId;
        this.sendToServer(this.inviteMsg);
        return this.inviteMsg;
    }

    inviteCancel(inviteMsg: InviteMsg) {
        this.writeLog("inviteCancel()");
        const callMsg = new InviteCancelledMsg();
        callMsg.data.participantId = inviteMsg.data.participantId;
        callMsg.data.conferenceRoomId = inviteMsg.data.conferenceRoomId;
        this.sendToServer(callMsg);
        this.inviteMsg = null;
    }

    /*
    receive an invite result 
    */
    private async onInviteResult(message: InviteResultMsg) {
        this.writeLog("onInviteResult()");
        //the conferenceRoomId must be empty or it must match
        if (!message.data.conferenceRoomId) {
            this.writeLog("onInviteResult() - no conferenceRoomId");
            return;
        }

        if (!this.inviteMsg) {
            this.writeLog("onInviteResult() - no invite sent");
            return;
        }

        if (this.conferenceRoom.conferenceRoomId && this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            this.writeLog(`onInviteResult() - incorrect conferenceRoomId ${this.conferenceRoom.conferenceRoomId} ${message.data.conferenceRoomId}`);
            return;
        }

        if (this.inviteMsg.data.participantId != message.data.participantId) {
            this.writeLog(`onInviteResult() - incorrect participantId, invite:${this.inviteMsg.data.participantId} msg:${message.data.participantId}`);
            return;
        }

        this.writeLog(`onInviteResult() - received a new conferenceRoomId ${message.data.conferenceRoomId}`);
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;

        this.onEvent(EventTypes.inviteResult, message);
    }

    async onInviteReceived(message: InviteMsg) {
        this.writeLog("onInviteReceived()");
        if (this.isInConference()) {
            this.writeLog("already in a conference.");
            return;
        }
        this.inviteMsg = message;
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.onEvent(EventTypes.inviteReceived, message);
    }

    async onInviteCancelled(message: InviteCancelledMsg) {
        this.writeLog("onInviteCancelled()");
        if (message.data.conferenceRoomId != this.conferenceRoom.conferenceRoomId) {
            this.writeLog("onInviteCancelled() - not the same conferenceRoomId.");
            return;
        }
        this.conferenceRoom.conferenceRoomId = "";
        this.inviteMsg = null;
        this.onEvent(EventTypes.inviteCancelled, message);
    }

    acceptInvite(message: InviteMsg) {
        this.writeLog("acceptInvite()");

        if (message.data.conferenceRoomId != this.inviteMsg.data.conferenceRoomId) {
            this.writeLog("accept failed. not the same conferenceRoomId");
            return false;
        }

        if (message.data.participantId != this.inviteMsg.data.participantId) {
            this.writeLog("accept failed. not the same participantId");
            return false;
        }

        const joinMsg = new AcceptMsg();
        joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        this.sendToServer(joinMsg);
        this.inviteMsg = null;
    }

    reject(message: InviteMsg) {
        this.writeLog("reject()");

        if (message.data.conferenceRoomId != this.inviteMsg.data.conferenceRoomId) {
            this.writeLog("accept failed. not the same conferenceRoomId");
            return false;
        }

        if (message.data.participantId != this.inviteMsg.data.participantId) {
            this.writeLog("accept failed. not the same participantId");
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
        this.writeLog("leave()");

        if (!this.isInConference()) {
            this.writeLog("leave() - failed, not in conference");
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
        this.writeLog("getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }

    private sendToServer(message: any) {
        this.writeLog("sendToServer " + message.type, message);
        if (this.socket) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }

    private onRegisterResult(message: RegisterResultMsg) {
        this.writeLog("onRegisterResult");
        if (message.data.error) {
            console.error(message.data.error);
            this.onEvent(EventTypes.registerResult, message);
        } else {
            this.participantId = message.data.participantId;
            this.userName = message.data.userName;
            this.writeLog('Registered with participantId:', this.participantId, this.userName);
            this.onEvent(EventTypes.registerResult, message);
        }
    }

    private onContactsReceived(message: GetContactsResultsMsg) {
        this.writeLog("onContactsReceived");
        this.contacts = message.data.filter(c => c.participantId !== this.participantId);
        this.onEvent(EventTypes.contactsReceived, message);
    }

    private onRejectReceived(message: InviteResultMsg) {
        this.writeLog("onRejectReceived");
        this.onEvent(EventTypes.rejectReceived, message);
    }

    private async onConferenceReady(message: ConferenceReadyMsg) {
        this.writeLog("onConferenceReady()");

        this.onEvent(EventTypes.conferenceReady, message);
        if (this.conferenceRoom.conferenceRoomId != message.data.conferenceRoomId) {
            this.writeLog("onConferenceReady() - conferenceRoomId does not match");
            return;
        }

        this.conferenceRoom.roomId = message.data.roomId;
        this.conferenceRoom.roomToken = message.data.roomToken;
        this.conferenceRoom.roomURI = message.data.roomURI;
        this.conferenceRoom.roomAuthToken = message.data.authToken;

        if (!this.conferenceRoom.roomId) {
            this.writeLog("ERORR: no roomId");
            return;
        }

        if (!this.conferenceRoom.roomToken) {
            this.writeLog("ERORR: no roomToken");
            return;
        }

        if (!this.conferenceRoom.roomURI) {
            this.writeLog("ERORR: no roomURI");
            return;
        }

        if (!this.conferenceRoom.roomAuthToken) {
            this.writeLog("ERORR: no roomAuthToken");
            return;
        }


        this.roomsClient = new RoomsClient();

        this.roomsClient.onRoomClosedEvent = (roomId: string, peers: Peer[]) => {
            this.writeLog("onRoomClosedEvent");
            this.roomsClient.disconnect();
            this.roomsClient.dispose();

            let msg = {
                type: EventTypes.conferenceClosed,
                data: { roomId: this.conferenceRoom.roomId }
            }
            this.onEvent(EventTypes.conferenceClosed, msg);
            this.conferenceRoom = new Conference();
        };

        this.roomsClient.onPeerNewTrackEvent = (peer: Peer, track: MediaStreamTrack) => {
            this.writeLog("onPeerNewTrackEvent");
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

        this.roomsClient.onRoomJoinedEvent = (roomId: string) => {
            //confirmation for local user has joined a room
            this.writeLog("onRoomJoinedEvent");
            let msg = {
                type: EventTypes.conferenceJoined,
                data: {
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId
                }
            }
            this.onEvent(EventTypes.conferenceJoined, msg);

        };

        this.roomsClient.onRoomPeerJoinedEvent = (roomId: string, peer: Peer) => {
            this.writeLog("onRoomPeerJoinedEvent");
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

        this.roomsClient.init(message.data.roomURI);
        let connectResult = await this.roomsClient.waitForConnect();
        let registerResult = await this.roomsClient.waitForRegister(this.conferenceRoom.roomAuthToken, this.participantId, this.userName);
        let roomJoinResult = connectResult = await this.roomsClient.waitForRoomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);

        this.roomsClient.addLocalTracks(this.localStream);

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
        }

    }

}