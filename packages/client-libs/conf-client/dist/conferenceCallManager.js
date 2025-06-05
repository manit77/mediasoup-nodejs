import { AcceptMsg, CallMessageType, GetContactsMsg, InviteCancelledMsg, InviteMsg, LeaveMsg, RegisterMsg, RejectMsg } from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { RoomsClient } from "@rooms/rooms-client";
class Participant {
    participantId;
    peerId;
    displayName;
    mediaStream;
}
class Conference {
    conferenceRoomId;
    roomAuthToken;
    roomToken;
    roomId;
    roomURI;
    participants = new Map();
}
export var EventTypes;
(function (EventTypes) {
    EventTypes["connected"] = "connected";
    EventTypes["disconnected"] = "disconnected";
    EventTypes["registerResult"] = "registerResult";
    EventTypes["contactsReceived"] = "contactsReceived";
    EventTypes["inviteResult"] = "inviteResult";
    EventTypes["inviteReceived"] = "inviteReceived";
    EventTypes["inviteCancelled"] = "inviteCancelled";
    EventTypes["rejectReceived"] = "rejectReceived";
    EventTypes["conferenceReady"] = "conferenceReady";
    EventTypes["conferenceJoined"] = "conferenceJoined";
    EventTypes["conferenceClosed"] = "conferenceClosed";
    EventTypes["conferenceFailed"] = "conferenceFailed";
    EventTypes["participantNewTrack"] = "participantNewTrack";
    EventTypes["participantJoined"] = "participantJoined";
    EventTypes["participantLeft"] = "participantLeft";
})(EventTypes || (EventTypes = {}));
export class ConferenceCallManager {
    DSTR = "ConferenceCallManager";
    socket;
    localStream = null;
    participantId = '';
    userName = "";
    conferenceRoom = new Conference();
    contacts = [];
    roomsClient;
    isConnected = false;
    config = {
        conf_wsURI: 'wss://localhost:3001'
    };
    onEvent;
    constructor() {
    }
    writeLog(...params) {
        console.log(this.DSTR, ...params);
    }
    connect(autoReconnect, conf_wsURIOverride = "") {
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
        this.socket.addEventHandler("onerror", (error) => {
            console.error('WebSocket Error:', error);
            //fire event on disconnected
            this.onEvent(EventTypes.disconnected);
        });
        this.socket.addEventHandler("onmessage", (event) => {
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
    register(username) {
        this.writeLog("register");
        // Register with the server
        const registerMsg = new RegisterMsg();
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
    invite(participantId) {
        this.writeLog("invite()");
        const callMsg = new InviteMsg();
        callMsg.data.participantId = participantId;
        this.sendToServer(callMsg);
        return callMsg;
    }
    inviteCancel(inviteMsg) {
        this.writeLog("inviteCancel()");
        const callMsg = new InviteCancelledMsg();
        callMsg.data.participantId = inviteMsg.data.participantId;
        callMsg.data.conferenceRoomId = inviteMsg.data.conferenceRoomId;
        this.sendToServer(callMsg);
    }
    /*
    receive an invite result
    */
    async onInviteResult(message) {
        this.writeLog("onInviteResult()");
        if (message.data.conferenceRoomId) {
            this.writeLog(`onInviteResult() - received a new conferenceRoomId ${message.data.conferenceRoomId}`);
            this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        }
        else {
            this.writeLog("onInviteResult() " + message.data.error);
        }
        this.onEvent(EventTypes.inviteResult, message);
    }
    async onInviteReceived(message) {
        this.writeLog("onInviteReceived()");
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.onEvent(EventTypes.inviteReceived, message);
    }
    async onInviteCancelled(message) {
        this.writeLog("onInviteCancelled()");
        this.conferenceRoom.conferenceRoomId = "";
        this.onEvent(EventTypes.inviteCancelled, message);
    }
    acceptInvite(message) {
        this.writeLog("acceptInvite()");
        const joinMsg = new AcceptMsg();
        joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        this.sendToServer(joinMsg);
    }
    reject(message) {
        this.writeLog("reject()");
        let msg = new RejectMsg();
        msg.data.conferenceRoomId = message.data.conferenceRoomId;
        msg.data.fromParticipantId = this.participantId;
        msg.data.toParticipantId = message.data.participantId;
        this.sendToServer(msg);
        this.conferenceRoom.conferenceRoomId = "";
    }
    leave() {
        this.writeLog("leave()");
        let msg = new LeaveMsg();
        msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
        this.sendToServer(msg);
        if (this.roomsClient) {
            this.roomsClient.roomLeave();
        }
        this.conferenceRoom.conferenceRoomId = "";
    }
    getParticipant(participantId) {
        this.writeLog("getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }
    sendToServer(message) {
        this.writeLog("sendToServer " + message.type, message);
        if (this.socket) {
            this.socket.send(JSON.stringify(message));
        }
        else {
            console.error('Socket is not connected');
        }
    }
    onRegisterResult(message) {
        this.writeLog("onRegisterResult");
        if (message.data.error) {
            console.error(message.data.error);
            this.onEvent(EventTypes.registerResult, message);
        }
        else {
            this.participantId = message.data.participantId;
            this.userName = message.data.userName;
            this.writeLog('Registered with participantId:', this.participantId, this.userName);
            this.onEvent(EventTypes.registerResult, message);
        }
    }
    onContactsReceived(message) {
        this.writeLog("onContactsReceived");
        this.contacts = message.data.filter(c => c.participantId !== this.participantId);
        this.onEvent(EventTypes.contactsReceived, message);
    }
    onRejectReceived(message) {
        this.writeLog("onRejectReceived");
        this.onEvent(EventTypes.rejectReceived, message);
    }
    async onConferenceReady(message) {
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
        this.roomsClient.onRoomClosedEvent = (roomId, peers) => {
            this.writeLog("onRoomClosedEvent");
            this.roomsClient.disconnect();
            this.roomsClient.dispose();
            let msg = {
                type: EventTypes.conferenceClosed,
                data: { roomId: this.conferenceRoom.roomId }
            };
            this.onEvent(EventTypes.conferenceClosed, msg);
            this.conferenceRoom = new Conference();
        };
        this.roomsClient.onPeerNewTrackEvent = (peer, track) => {
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
            };
            this.onEvent(EventTypes.participantNewTrack, msg);
        };
        this.roomsClient.onRoomJoinedEvent = (roomId) => {
            //confirmation for local user has joined a room
            this.writeLog("onRoomJoinedEvent");
            let msg = {
                type: EventTypes.conferenceJoined,
                data: {
                    conferenceRoomId: this.conferenceRoom.conferenceRoomId
                }
            };
            this.onEvent(EventTypes.conferenceJoined, msg);
        };
        this.roomsClient.onRoomPeerJoinedEvent = (roomId, peer) => {
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
            };
            this.onEvent(EventTypes.participantJoined, msg);
        };
        this.roomsClient.onRoomPeerLeftEvent = (roomId, peer) => {
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
            };
            this.onEvent(EventTypes.participantLeft, msg);
        };
        this.roomsClient.init(message.data.roomURI);
        let connectResult = await this.roomsClient.waitForConnect();
        let registerResult = await this.roomsClient.waitForRegister(this.conferenceRoom.roomAuthToken, this.participantId, this.userName);
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
//# sourceMappingURL=conferenceCallManager.js.map