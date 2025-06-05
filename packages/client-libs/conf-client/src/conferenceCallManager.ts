import {
    AcceptMsg,
    CallMessageType, ConferenceReadyMsg, GetContactsMsg, GetContactsResultsMsg, InviteMsg, InviteResultMsg
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
    localStream: MediaStream | null = null;
    participantId: string = '';
    conferenceRoom: Conference = new Conference();
    public contacts: Contact[] = [];
    private roomsClient: RoomsClient;
    isConnected = false;

    config = {
        conf_wsURI: 'wss://localhost:3001'
    }

    onEvent: ConferenceEvent;

    constructor() {
    }

    writeLog(...params: any) {
        console.log(this.DSTR, ...params);
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
    invite(participantId: string) {
        this.writeLog("invite()");
        const callMsg = new InviteMsg();
        callMsg.data.participantId = participantId;
        this.sendToServer(callMsg);
    }

    /*
    receive an invite result 
    */
    private async onInviteResult(message: InviteResultMsg) {
        this.writeLog("onInviteResult()");
        if (message.data.conferenceRoomId) {
            this.writeLog(`onInviteResult() - received a new conferenceRoomId ${message.data.conferenceRoomId}`);
            this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;

        } else {
            this.writeLog("onInviteResult() " + message.data.error);
        }
        this.onEvent(EventTypes.inviteResult, message);
    }

    async onInviteReceived(message: InviteMsg) {
        this.writeLog("onInviteReceived()");
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.onEvent(EventTypes.inviteReceived, message);
    }

    acceptInvite(message: InviteMsg) {
        this.writeLog("acceptInvite()");
        const joinMsg = new AcceptMsg();
        joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        this.sendToServer(joinMsg);
    }

    reject(message: InviteMsg) {
        this.writeLog("reject()");
        let msg = new RejectMsg();
        msg.data.conferenceRoomId = message.data.conferenceRoomId;
        msg.data.fromParticipantId = this.participantId;
        msg.data.toParticipantId = message.data.participantId;
        this.sendToServer(msg);

        this.conferenceRoom.conferenceRoomId = "";
    }


    leave() {
        this.writeLog("reject()");
        let msg = new LeaveMsg();
        msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
        this.sendToServer(msg);
        this.roomsClient.roomLeave();
        this.conferenceRoom.conferenceRoomId = "";
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

            this.onEvent(EventTypes.registerResult, message);

            this.participantId = message.data.participantId;
            this.writeLog('Registered with participantId:', this.participantId, "conferenceRoomId:", message.data.conferenceRoomId);

            if (message.data.conferenceRoomId) {
                //we logged into an existing conference
                //rejoin conference?
                this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            }
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
        this.onEvent(EventTypes.conferenceReady, message);

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
                participant.displayName = "";
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

            let msg = {
                type: EventTypes.participantJoined,
                data: {
                    participantId: participant.participantId,
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
        let registerResult = await this.roomsClient.waitForRegister(this.conferenceRoom.roomAuthToken, this.participantId, "");
        let roomJoinResult = connectResult = await this.roomsClient.waitForRoomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);

        //add tracks after joining a room
        this.localStream.getTracks().forEach(t => {
            this.roomsClient.addLocalTrack(t);
        });


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