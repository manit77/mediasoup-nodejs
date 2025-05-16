"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceCallManager = void 0;
const conferenceSharedModels_1 = require("./conferenceSharedModels");
const webSocketManager_1 = require("./webSocketManager");
const webRTCClient_1 = require("./rtcClient/webRTCClient");
const roomsClient_1 = require("./roomsClient/roomsClient");
class ConferenceCallManager {
    constructor() {
        this.DSTR = "ConferenceCallManager";
        this.localStream = null;
        this.participantId = '';
        this.conferenceRoom = {
            conferenceRoomId: "",
            participants: new Map(),
            config: new conferenceSharedModels_1.ConferenceConfig(),
            conferenceToken: "",
            conferenceTitle: "",
            roomToken: "",
            roomId: ""
        };
        this.contacts = [];
        this.isConnected = false;
        this.config = {
            conf_wsURI: 'wss://localhost:3001',
            room_wsURI: 'wss://localhost:3000',
        };
        this.room_onPeerNewTrack = (peer, track) => {
            this.writeLog("room_onPeerNewStream");
            let partcipant = this.getParticipant(peer.trackingId);
            if (partcipant) {
                partcipant.mediaStream.addTrack(track);
            }
            else {
                this.writeLog("room_onPeerNewStream -  participant not found.");
            }
        };
        this.rtc_onIceCandidate = (participantId, candidate) => {
            this.writeLog("rtc_onIceCandidate");
            //send ice candidate to server
            if (candidate) {
                const iceMsg = {
                    type: conferenceSharedModels_1.CallMessageType.rtc_ice,
                    data: {
                        toParticipantId: participantId,
                        fromParticipantId: this.participantId,
                        candidate: candidate
                    }
                };
                this.sendToServer(iceMsg);
            }
        };
        this.rtcClient = new webRTCClient_1.WebRTCClient(this.rtc_onIceCandidate);
        this.roomsClient = new roomsClient_1.RoomsClient();
        this.roomsClient.initMediaSoupDevice();
        this.roomsClient.onPeerNewTrack = this.room_onPeerNewTrack;
    }
    writeLog(...params) {
        console.log(this.DSTR, ...params);
    }
    connect(autoReconnect, conf_wsURIOverride = "", room_wsURIOverride = "") {
        this.writeLog("connect");
        if (conf_wsURIOverride) {
            this.config.conf_wsURI = conf_wsURIOverride;
        }
        if (room_wsURIOverride) {
            this.config.room_wsURI = room_wsURIOverride;
        }
        // Connect to WebSocket server
        this.socket = new webSocketManager_1.WebSocketManager();
        this.socket.addEventHandler("onopen", () => {
            this.isConnected = true;
            this.onEvent("connected" /* EventTypes.connected */);
        });
        this.socket.addEventHandler("onclose", () => {
            this.isConnected = false;
            //fire event onclose       
            this.onEvent("disconnected" /* EventTypes.disconnected */);
        });
        this.socket.addEventHandler("onerror", (error) => {
            console.error('WebSocket Error:', error);
            //fire event on disconnected
            this.onEvent("disconnected" /* EventTypes.disconnected */);
        });
        this.socket.addEventHandler("onmessage", (event) => {
            const message = JSON.parse(event.data);
            this.writeLog('Received message ' + message.type, message);
            switch (message.type) {
                case conferenceSharedModels_1.CallMessageType.registerResult:
                    this.onRegisterResult(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.getContacts:
                    this.onContactsReceived(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.invite:
                    this.onInviteReceived(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.reject:
                    this.onRejectReceived(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.inviteResult:
                    this.onInviteResult(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.rtc_needOffer:
                    this.onRTCNeedOffer(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.joinResult:
                    this.onJoinResult(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.newParticipant:
                    this.onNewParticipant(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.participantLeft:
                    this.onParticipantLeft(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.conferenceClosed:
                    this.onConferenceClosed(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.rtc_offer:
                    this.onRTCOffer(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.rtc_answer:
                    this.onRTCAnswer(message);
                    break;
                case conferenceSharedModels_1.CallMessageType.rtc_ice:
                    this.onRTCIce(message);
                    break;
            }
        });
        this.socket.connect(this.config.conf_wsURI, autoReconnect);
    }
    disconnect() {
        this.writeLog("disconnect");
        this.socket.disconnect();
    }
    isInConference() {
        return this.conferenceRoom.conferenceRoomId > "";
    }
    getUserMedia() {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("getUserMedia");
            try {
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                }
                // Initialize user media
                this.localStream = yield navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                return this.localStream;
            }
            catch (err) {
                console.error('Error accessing media devices:', err);
            }
            return null;
        });
    }
    register(username) {
        this.writeLog("register");
        // Register with the server
        const registerMsg = new conferenceSharedModels_1.RegisterMsg();
        registerMsg.data.userName = username;
        this.sendToServer(registerMsg);
    }
    getContacts() {
        this.writeLog("getContacts");
        const contactsMsg = new conferenceSharedModels_1.GetContactsMsg();
        this.sendToServer(contactsMsg);
    }
    newConference(title) {
        let msg = new conferenceSharedModels_1.NewConferenceMsg();
        msg.data.conferenceTitle = title;
        msg.data.conferenceConfig.type = conferenceSharedModels_1.ConferenceType.rooms;
        this.sendToServer(msg);
    }
    invite(contact) {
        this.writeLog("invite");
        const callMsg = new conferenceSharedModels_1.InviteMsg();
        callMsg.data.participantId = contact.participantId;
        callMsg.data.conferenceConfig = new conferenceSharedModels_1.ConferenceConfig();
        callMsg.data.conferenceConfig.maxParticipants = 2;
        // callMsg.data.newConfConfig.type  = ConferenceType.p2p;
        callMsg.data.conferenceConfig.type = conferenceSharedModels_1.ConferenceType.rooms;
        this.sendToServer(callMsg);
    }
    onInviteResult(message) {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("onInviteResult");
            if (message.data.conferenceRoomId) {
                this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
                this.conferenceRoom.config.type = message.data.conferenceConfig.type;
                this.conferenceRoom.conferenceToken = message.data.conferenceToken;
                this.conferenceRoom.roomToken = message.data.roomToken;
                this.conferenceRoom.roomId = message.data.roomId;
                //join the conference room
                const joinMsg = new conferenceSharedModels_1.JoinMsg();
                joinMsg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
                joinMsg.data.conferenceToken = this.conferenceRoom.conferenceToken;
                joinMsg.data.roomId = this.conferenceRoom.roomId;
                joinMsg.data.roomToken = this.conferenceRoom.roomToken;
                this.sendToServer(joinMsg);
            }
            this.onEvent("inviteResult" /* EventTypes.inviteResult */, message);
        });
    }
    onJoinResult(message) {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("onJoinResult()");
            if (message.data.error) {
                this.writeLog("onJoinResult error: ", message.data.error);
                return;
            }
            this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            this.conferenceRoom.conferenceToken = message.data.conferenceToken;
            this.conferenceRoom.roomId = message.data.roomId;
            this.conferenceRoom.roomToken = message.data.roomToken;
            this.conferenceRoom.config = message.data.conferenceConfig;
            if (this.conferenceRoom.config.type == conferenceSharedModels_1.ConferenceType.rooms) {
                this.writeLog("conferenceType: rooms");
                yield this.roomsCreateTransports();
                if (!this.localStream) {
                    this.writeLog("localStream is required.");
                    return;
                }
                else {
                    this.roomsClient.setLocalstream(this.localStream);
                    this.roomsClient.roomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);
                }
                //the roomsClient will produce the local stream when roomJoin is successful
            }
            else {
                this.writeLog("conferenceType: p2p");
            }
            this.writeLog('joined conference room:', this.conferenceRoom.conferenceRoomId);
            this.writeLog('participants:', message.data.participants.length);
            this.onEvent("joinResult" /* EventTypes.joinResult */, message);
            for (let p of message.data.participants) {
                this.writeLog('createPeerConnection for existing:', p.participantId);
                let participant = {
                    participantId: p.participantId,
                    displayName: p.displayName,
                    peerConnection: null,
                    mediaStream: new MediaStream()
                };
                if (this.conferenceRoom.config.type == conferenceSharedModels_1.ConferenceType.rooms) {
                    //the rooms client will create the producer for each client
                }
                else {
                    let connInfo = this.rtcClient.createPeerConnection(p.participantId);
                    participant.peerConnection = connInfo.pc;
                    participant.mediaStream = connInfo.stream;
                }
                this.conferenceRoom.participants.set(p.participantId, participant);
                this.writeLog("participant added " + p.participantId);
                //this will create video elements in the UI
                let msg = new conferenceSharedModels_1.NewParticipantMsg();
                msg.data.participantId = p.participantId;
                msg.data.displayName = p.displayName;
                msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
                this.onEvent("newParticipant" /* EventTypes.newParticipant */, msg);
            }
        });
    }
    onInviteReceived(message) {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("onInviteReceived()");
            if (message.data.conferenceConfig.type == conferenceSharedModels_1.ConferenceType.rooms) {
                this.conferenceRoom.roomId = message.data.roomId;
                this.conferenceRoom.roomToken = message.data.roomToken;
            }
            this.onEvent("inviteReceived" /* EventTypes.inviteReceived */, message);
        });
    }
    acceptInvite(message) {
        this.writeLog("acceptInvite()");
        const joinMsg = new conferenceSharedModels_1.JoinMsg();
        joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        joinMsg.data.conferenceToken = message.data.conferenceToken;
        joinMsg.data.roomId = message.data.roomId;
        joinMsg.data.roomToken = message.data.roomToken;
        this.sendToServer(joinMsg);
    }
    reject(participantId, conferenceRoomId) {
        this.writeLog("reject()");
        let msg = new conferenceSharedModels_1.RejectMsg();
        msg.data.conferenceRoomId = conferenceRoomId;
        msg.data.fromParticipantId = this.participantId;
        msg.data.toParticipantId = participantId;
        this.sendToServer(msg);
        this.conferenceRoom.conferenceRoomId = "";
    }
    toggleVideo() {
        this.writeLog("toggleVideo");
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
            }
        }
    }
    toggleAudio() {
        this.writeLog("toggleAudio");
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
            }
        }
    }
    leave() {
        this.writeLog("leave");
        if (this.conferenceRoom.conferenceRoomId) {
            const leaveMsg = new conferenceSharedModels_1.LeaveMsg();
            leaveMsg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            leaveMsg.data.participantId = this.participantId;
            this.sendToServer(leaveMsg);
            this.conferenceRoom.conferenceRoomId = "";
        }
        else {
            this.writeLog("not in conerence");
        }
        this.resetCallState();
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
            this.onEvent("registerResult" /* EventTypes.registerResult */, message);
        }
        else {
            this.onEvent("registerResult" /* EventTypes.registerResult */, message);
            this.participantId = message.data.participantId;
            this.writeLog('Registered with participantId:', this.participantId, "conferenceRoomId:", message.data.conferenceRoomId);
            if (message.data.conferenceRoomId) {
                //we logged into an existing conference
                //rejoin conference?
                this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            }
        }
    }
    onContactsReceived(message) {
        this.writeLog("onContactsReceived");
        this.contacts = message.data.filter(c => c.participantId !== this.participantId);
        //fire event new contacts
        this.onEvent("contactsReceived" /* EventTypes.contactsReceived */, this.contacts);
    }
    onRejectReceived(message) {
        this.writeLog("onRejectReceived");
        this.onEvent("rejectReceived" /* EventTypes.rejectReceived */, message);
    }
    onRTCNeedOffer(message) {
        //this is only a webrtc call
        this.writeLog("onNeedOffer " + message.data.participantId);
        //server will send need offer when needed to connect
        let connInfo = this.rtcClient.createPeerConnection(message.data.participantId);
        this.conferenceRoom.participants.set(message.data.participantId, {
            participantId: message.data.participantId,
            displayName: message.data.displayName,
            peerConnection: connInfo.pc,
            mediaStream: connInfo.stream
        });
        this.sendOffer(connInfo.pc, message.data.participantId);
    }
    onNewParticipant(message) {
        this.writeLog('onNewParticipant - New participant joined:', message.data);
        let partcipant = {
            participantId: message.data.participantId,
            displayName: message.data.participantId,
            peerConnection: null,
            mediaStream: new MediaStream()
        };
        this.conferenceRoom.participants.set(message.data.participantId, partcipant);
        if (this.conferenceRoom.config.type == conferenceSharedModels_1.ConferenceType.rooms) {
        }
        else {
            let connInfo = this.rtcClient.createPeerConnection(partcipant.participantId);
            partcipant.peerConnection = connInfo.pc;
            partcipant.mediaStream = connInfo.stream;
        }
        this.onEvent("newParticipant" /* EventTypes.newParticipant */, message);
    }
    onParticipantLeft(message) {
        const participantId = message.data.participantId;
        this.writeLog('Participant left:', participantId);
        // Close peer connection
        let p = this.conferenceRoom.participants.get(participantId);
        if (p) {
            if (p.mediaStream) {
                for (let track of p.mediaStream.getTracks()) {
                    track.stop();
                }
            }
            if (p.peerConnection) {
                p.peerConnection.close();
            }
            this.conferenceRoom.participants.delete(participantId);
        }
        this.onEvent("participantLeft" /* EventTypes.participantLeft */, message);
    }
    onConferenceClosed(message) {
        //we received a conference closed message
        this.writeLog("onConferenceClosed");
        this.resetCallState();
    }
    resetCallState() {
        this.conferenceRoom.conferenceRoomId = "";
        // Close all peer connections
        this.conferenceRoom.participants.forEach((p) => {
            var _a;
            if (p.peerConnection) {
                (_a = p.peerConnection) === null || _a === void 0 ? void 0 : _a.close();
            }
            if (p.mediaStream) {
                for (let t of p.mediaStream.getTracks()) {
                    t.stop();
                }
            }
        });
        this.conferenceRoom.participants.clear();
    }
    sendOffer(pc, toParticipantId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("sendOffer");
            // Create and send offer
            const offer = yield pc.createOffer();
            yield pc.setLocalDescription(offer);
            const offerMsg = {
                type: conferenceSharedModels_1.CallMessageType.rtc_offer,
                data: {
                    toParticipantId: toParticipantId,
                    fromParticipantId: this.participantId,
                    sdp: pc.localDescription
                }
            };
            this.sendToServer(offerMsg);
        });
    }
    onRTCOffer(message) {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("onRTCOffer");
            try {
                const fromParticipantId = message.data.fromParticipantId;
                // Create peer connection if it doesn't exist            
                yield this.rtcClient.setRemoteDescription(fromParticipantId, new RTCSessionDescription(message.data.sdp));
                const answer = yield this.rtcClient.createAnswer(fromParticipantId);
                const answerMsg = {
                    type: conferenceSharedModels_1.CallMessageType.rtc_answer,
                    data: {
                        toParticipantId: fromParticipantId,
                        fromParticipantId: this.participantId,
                        sdp: answer
                    }
                };
                this.sendToServer(answerMsg);
            }
            catch (err) {
                console.error('Error handling offer:', err);
            }
        });
    }
    onRTCAnswer(message) {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("onRTCAnswer");
            try {
                const fromParticipantId = message.data.fromParticipantId;
                const p = this.conferenceRoom.participants.get(fromParticipantId);
                if (p.peerConnection) {
                    yield p.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
                }
            }
            catch (err) {
                console.error('Error handling answer:', err);
            }
        });
    }
    onRTCIce(message) {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("onRTCIce");
            try {
                const fromParticipantId = message.data.fromParticipantId;
                const p = this.conferenceRoom.participants.get(fromParticipantId);
                if (p.peerConnection) {
                    yield p.peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
                }
            }
            catch (err) {
                console.error('Error handling ICE candidate:', err);
            }
        });
    }
    roomsCreateTransports() {
        return __awaiter(this, void 0, void 0, function* () {
            this.writeLog("roomsCreateTransports");
            this.roomsClient.onRoomNewPeerEvent = (peer) => {
                //map the participantid to the peerid
                let p = this.conferenceRoom.participants.get(peer.trackingId);
                if (p) {
                    p.peerId = peer.peerId;
                }
            };
            //inite media soup device
            this.roomsClient.initMediaSoupDevice();
            //connect and wait for a connection
            yield this.roomsClient.connectAsync(this.config.room_wsURI);
            //wait for transport to be created, and connected        
            let isTransportsConnected = { recv: false, send: false };
            let transportConnectedResolve;
            let transportConnectedReject;
            let transportsConnected = () => {
                this.writeLog("await transportsConnected created");
                return new Promise((resolve, reject) => {
                    transportConnectedResolve = resolve;
                    transportConnectedReject = reject;
                    setTimeout(() => {
                        transportConnectedReject("transports timedOut");
                    }, 5000);
                });
            };
            this.roomsClient.onTransportsReady = (transport) => __awaiter(this, void 0, void 0, function* () {
                this.writeLog("onTransportsReady direction:" + transport.direction);
                if (transport.direction == "send") {
                    isTransportsConnected.send = true;
                    transportConnectedResolve();
                }
            });
            //register will create the transports, after a successful registration
            this.roomsClient.register(this.participantId, "");
            yield transportsConnected();
            this.writeLog("transported created received.");
        });
    }
}
exports.ConferenceCallManager = ConferenceCallManager;
