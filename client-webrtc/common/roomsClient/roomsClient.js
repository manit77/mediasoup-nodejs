"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.RoomsClient = void 0;
const webSocketManager_1 = require("../webSocketManager");
const mediasoupClient = __importStar(require("mediasoup-client"));
const roomSharedModels_1 = require("./roomSharedModels");
const peer_1 = require("./peer");
class RoomsClient {
    constructor() {
        this.localRoomId = "";
        this.localPeer = new peer_1.Peer();
        this.isConnected = false;
        this.isRoomConnected = false;
        this.peers = [];
        this.audioEnabled = true;
        this.videoEnabled = true;
        this.config = {
            wsURI: "wss://localhost:3000",
        };
        this.writeLog = (...params) => __awaiter(this, void 0, void 0, function* () {
            console.log("RoomsClient", ...params);
        });
        this.initMediaSoupDevice = () => {
            this.writeLog("initMediaSoupDevice=");
            if (this.device) {
                this.writeLog("device already initialized");
                return;
            }
            try {
                // In real implementation, this would use the actual mediasoup-client
                this.device = new mediasoupClient.Device();
                this.writeLog("MediaSoup device initialized");
            }
            catch (error) {
                this.writeLog(`Error initializing MediaSoup: ${error.message}`);
            }
        };
        this.onSocketEvent = (event) => __awaiter(this, void 0, void 0, function* () {
            let msgIn = JSON.parse(event.data);
            this.writeLog("-- onmessage", msgIn);
            try {
                switch (msgIn.type) {
                    case roomSharedModels_1.payloadTypeServer.registerResult:
                        this.onRegisterResult(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.producerTransportCreated:
                        this.onProducerTransportCreated(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.consumerTransportCreated:
                        this.onConsumerTransportCreated(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomJoinResult:
                        this.onRoomJoinResult(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomNewPeer:
                        this.onRoomNewPeer(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomNewProducer:
                        this.onRoomNewProducer(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomPeerLeft:
                        this.onRoomPeerLeft(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.produced:
                        this.onProduced(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.consumed:
                        this.onConsumed(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomTerminate:
                        this.onRoomTerminate(msgIn);
                        break;
                }
            }
            catch (err) {
                console.error(err);
            }
        });
        this.connect = (...args_1) => __awaiter(this, [...args_1], void 0, function* (wsURI = "") {
            if (wsURI) {
                this.config.wsURI = wsURI;
            }
            if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
                this.writeLog("socket already " + this.ws.state);
                return;
            }
            this.writeLog("connect " + this.config.wsURI);
            this.ws = new webSocketManager_1.WebSocketManager();
            const onOpen = () => __awaiter(this, void 0, void 0, function* () {
                this.isConnected = true;
                this.writeLog("websocket open " + this.config.wsURI);
            });
            const onClose = () => __awaiter(this, void 0, void 0, function* () {
                this.writeLog("websocket closed");
                this.isConnected = false;
            });
            this.ws.addEventHandler("onopen", onOpen);
            this.ws.addEventHandler("onmessage", this.onSocketEvent);
            this.ws.addEventHandler("onclose", onClose);
            this.ws.addEventHandler("onerror", onClose);
            this.ws.connect(this.config.wsURI, true);
        });
        this.disconnect = () => {
            this.writeLog("disconnect");
            this.ws.disconnect();
        };
        this.send = (msg) => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("send", msg.type, msg);
            this.ws.send(JSON.stringify(msg));
        });
        this.toggleAudio = () => {
            this.audioEnabled = !this.audioEnabled;
            this.writeLog(`Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
        };
        this.toggleVideo = () => {
            this.videoEnabled = !this.videoEnabled;
            this.writeLog(`Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
        };
        this.addPeer = (peer) => {
            this.writeLog(`addPeer() ${peer.peerId} ${peer.trackingId}`);
            if (this.peers.find(p => p.peerId === peer.peerId)) {
                this.writeLog("peer already exists");
                return;
            }
            if (peer.peerId === this.localPeer.peerId) {
                this.writeLog(`cannot add yourself as a peerid: ${this.localPeer.peerId}`);
                return;
            }
            this.peers.push(peer);
        };
        this.removePeer = (peerId) => {
            this.writeLog(`removePeer() ${peerId}`);
            let idx = this.peers.findIndex(p => p.peerId == peerId);
            if (idx > -1) {
                this.peers.splice(idx, 1);
            }
        };
        this.addRemoteTrack = (peerId, track) => {
            this.writeLog("addRemoteTrack()");
            let peer = this.peers.find(p => p.peerId === peerId);
            if (!peer) {
                this.writeLog(`addRemoteTrack() - peer not found, peerId: ${peerId}`);
                return;
            }
            if (this.onPeerNewTrack) {
                this.onPeerNewTrack(peer, track);
            }
            else {
                if (!peer.stream) {
                    peer.stream = new MediaStream();
                }
                peer.stream.addTrack(track);
            }
        };
        this.removeRemoteStream = (peerId) => {
            this.writeLog("removeRemoteStream()");
            let peer = this.peers.find(p => p.peerId === peerId);
            if (!peer) {
                this.writeLog("removeRemoteStream() - peer not found.");
                return;
            }
            if (peer.stream) {
                peer.stream.getTracks().forEach((track) => track.stop());
                peer.stream = null;
            }
        };
        this.register = (trackingId, displayName) => {
            this.writeLog(`-- register `);
            if (this.localPeer.peerId) {
                this.writeLog(`-- register, already registered. ${this.localPeer.peerId}`);
                return;
            }
            this.localPeer.trackingId = trackingId;
            this.localPeer.displayName = displayName;
            let msg = new roomSharedModels_1.RegisterMsg();
            msg.data = {
                authToken: "", //need authtoken from server
                displayName: this.localPeer.displayName,
                trackingId: this.localPeer.trackingId
            };
            this.send(msg);
        };
        this.onRegisterResult = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.writeLog(`-- onRegisterResult() peerId: ${(_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId} ${msgIn.data.trackingId}`);
            this.localPeer.peerId = msgIn.data.peerId;
            if (!this.device.loaded) {
                this.writeLog("loading device with rtpCapabilities");
                yield this.device.load({ routerRtpCapabilities: msgIn.data.rtpCapabilities });
            }
            if (!this.sendTransportRef) {
                this.createProducerTransport();
            }
            if (!this.recvTransportRef) {
                this.createConsumerTransport();
            }
        });
        this.createProducerTransport = () => {
            this.writeLog("-- createProducerTransport");
            let msg = new roomSharedModels_1.CreateProducerTransportMsg();
            this.send(msg);
        };
        this.createConsumerTransport = () => {
            this.writeLog("-- createConsumerTransport");
            let msg = new roomSharedModels_1.CreateConsumerTransportMsg();
            this.send(msg);
        };
        this.roomJoin = (roomid, roomToken) => {
            this.writeLog(`roomJoin ${roomid} ${roomToken}`);
            let msg = new roomSharedModels_1.RoomJoinMsg();
            msg.data = {
                roomId: roomid,
                roomToken: roomToken
            };
            this.send(msg);
        };
        this.onRoomJoinResult = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            this.writeLog("-- onRoomJoinResult()");
            if (msgIn.data.error) {
                this.writeLog(msgIn.data.error);
                return;
            }
            if (msgIn.data.roomId) {
                this.localRoomId = msgIn.data.roomId;
                this.isRoomConnected = true;
                this.writeLog("joined room " + msgIn.data.roomId);
            }
            else {
                this.localRoomId = "";
                this.isRoomConnected = false;
                return;
            }
            if (!this.localPeer.stream) {
                this.writeLog("-- get user media, one does not exist");
                this.localPeer.stream = yield navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            }
            this.localPeer.stream = yield navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            //publish local stream
            yield this.produceLocalStream();
            this.writeLog(`-- onRoomJoinResult() peers : ${(_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peers.length}`);
            //connect to existing peers  
            if (msgIn.data && msgIn.data.peers) {
                for (let peer of msgIn.data.peers) {
                    let newpeer = new peer_1.Peer();
                    newpeer.peerId = peer.peerId,
                        newpeer.trackingId = peer.trackingId;
                    this.addPeer(newpeer);
                    this.writeLog(peer.peerId);
                    this.writeLog("-- onRoomJoinResult producers :" + ((_b = peer.producers) === null || _b === void 0 ? void 0 : _b.length));
                    if (peer.producers) {
                        for (let producer of peer.producers) {
                            this.writeLog("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
                            this.consumeProducer(peer.peerId, producer.producerId);
                        }
                    }
                    if (this.onRoomNewPeerEvent) {
                        this.onRoomNewPeerEvent(newpeer);
                    }
                }
            }
        });
        this.roomLeave = () => __awaiter(this, void 0, void 0, function* () {
            let msg = new roomSharedModels_1.RoomLeaveMsg();
            msg.data = {
                roomId: this.localRoomId,
                roomToken: ""
            };
            this.send(msg);
            this.disposeRoom();
        });
        this.isInRoom = () => {
            return !!this.isRoomConnected;
        };
        this.onConsumerTransportCreated = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("-- onConsumerTransportCreated");
            this.recvTransportRef = this.device.createRecvTransport({
                id: msgIn.data.transportId,
                iceServers: msgIn.data.iceServers,
                iceCandidates: msgIn.data.iceCandidates,
                iceParameters: msgIn.data.iceParameters,
                dtlsParameters: msgIn.data.dtlsParameters,
                iceTransportPolicy: msgIn.data.iceTransportPolicy
            });
            this.recvTransportRef.on('connect', ({ dtlsParameters }, callback) => {
                let msg = new roomSharedModels_1.ConnectConsumerTransportMsg();
                msg.data = {
                    dtlsParameters: dtlsParameters
                };
                this.send(msg);
                callback();
            });
            if (this.onTransportsReady) {
                this.onTransportsReady(this.recvTransportRef);
            }
        });
        this.onProducerTransportCreated = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("-- onProducerTransportCreated");
            //the server has created a transport
            //create a client transport to connect to the server transport
            this.sendTransportRef = this.device.createSendTransport({
                id: msgIn.data.transportId,
                iceServers: msgIn.data.iceServers,
                iceCandidates: msgIn.data.iceCandidates,
                iceParameters: msgIn.data.iceParameters,
                dtlsParameters: msgIn.data.dtlsParameters,
                iceTransportPolicy: msgIn.data.iceTransportPolicy
            });
            this.sendTransportRef.on("connect", ({ dtlsParameters }, callback) => {
                this.writeLog("-- sendTransport connect");
                //fires when the transport connects to the mediasoup server
                let msg = new roomSharedModels_1.ConnectProducerTransportMsg();
                msg.data = {
                    dtlsParameters: dtlsParameters
                };
                this.send(msg);
                callback();
            });
            this.sendTransportRef.on('produce', ({ kind, rtpParameters }, callback) => {
                this.writeLog("-- sendTransport produce");
                //fires when we call produce with local tracks
                let msg = new roomSharedModels_1.ProduceMsg();
                msg.data = {
                    kind: kind,
                    rtpParameters: rtpParameters
                };
                this.send(msg);
                //what is the id value???
                callback({ id: 'placeholder' });
            });
            if (this.onTransportsReady) {
                this.onTransportsReady(this.sendTransportRef);
            }
        });
        this.onRoomNewPeer = (msgIn) => {
            var _a, _b, _c, _d, _e;
            this.writeLog("onRoomNewPeer " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId) + " producers: " + ((_c = (_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.producers) === null || _c === void 0 ? void 0 : _c.length));
            this.writeLog(`new PeeerJoined ${(_d = msgIn.data) === null || _d === void 0 ? void 0 : _d.peerId} ${msgIn.data.trackingId} `);
            let newPeer = new peer_1.Peer();
            newPeer.peerId = msgIn.data.peerId;
            newPeer.trackingId = msgIn.data.trackingId;
            this.addPeer(newPeer);
            if ((_e = msgIn.data) === null || _e === void 0 ? void 0 : _e.producers) {
                for (let producer of msgIn.data.producers) {
                    this.consumeProducer(msgIn.data.peerId, producer.producerId);
                }
            }
        };
        this.onRoomPeerLeft = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.writeLog("peer left the room, peerid:" + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId));
            this.removePeer(msgIn.data.peerId);
            this.removeRemoteStream(msgIn.data.peerId);
        });
        this.onRoomTerminate = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("onRoomTerminate:" + msgIn.data.roomId);
            this.disposeRoom();
        });
        this.onRoomNewProducer = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            this.writeLog("onRoomNewProducer: " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.kind));
            this.consumeProducer((_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.peerId, (_c = msgIn.data) === null || _c === void 0 ? void 0 : _c.producerId);
        });
        this.produceLocalStream = () => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("produceLocalStreams");
            if (!this.localPeer.stream) {
                this.writeLog("not local stream");
            }
            for (const track of this.localPeer.stream.getTracks()) {
                this.writeLog("sendTransport produce ");
                yield this.sendTransportRef.produce({ track });
            }
        });
        this.consumeProducer = (remotePeerId, producerId) => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("consumeProducer() :" + remotePeerId, producerId);
            if (remotePeerId === this.localPeer.peerId) {
                console.error("consumeProducer() - you can't consume yourself.");
            }
            let msg = new roomSharedModels_1.ConsumeMsg();
            msg.data = {
                remotePeerId: remotePeerId,
                producerId: producerId,
                rtpCapabilities: this.device.rtpCapabilities
            };
            this.send(msg);
        });
        this.onConsumed = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.writeLog("onConsumed() " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.kind));
            const consumer = yield this.recvTransportRef.consume({
                id: msgIn.data.consumerId,
                producerId: msgIn.data.producerId,
                kind: msgIn.data.kind,
                rtpParameters: msgIn.data.rtpParameters
            });
            this.addRemoteTrack(msgIn.data.peerId, consumer.track);
        });
        this.onProduced = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.writeLog("onProduced " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.kind));
        });
    }
    init(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (uri) {
                this.config.wsURI = uri;
            }
            this.initMediaSoupDevice();
        });
    }
    ;
    /**
   * resolves when the socket is connected
   * @param wsURI
   * @returns
   */
    connectAsync(wsURI) {
        this.writeLog(`connectAsync ${wsURI}`);
        return new Promise((resolve, reject) => {
            if (wsURI) {
                this.config.wsURI = wsURI;
            }
            if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
                this.writeLog("socket already created. current state: " + this.ws.state);
                resolve();
                return;
            }
            this.ws = new webSocketManager_1.WebSocketManager();
            this.writeLog("connectAsync " + this.config.wsURI + " state:" + this.ws.state);
            const onOpen = () => __awaiter(this, void 0, void 0, function* () {
                this.isConnected = true;
                this.writeLog("websocket onOpen " + this.config.wsURI);
                resolve();
            });
            const onClose = () => __awaiter(this, void 0, void 0, function* () {
                this.writeLog("websocket onClose");
                this.isConnected = false;
                resolve();
            });
            this.ws.addEventHandler("onopen", onOpen);
            this.ws.addEventHandler("onmessage", this.onSocketEvent);
            this.ws.addEventHandler("onclose", onClose);
            this.ws.addEventHandler("onerror", onClose);
            this.ws.connect(this.config.wsURI, true);
        });
    }
    setLocalstream(stream) {
        this.writeLog("setLocalstream");
        this.localPeer.stream = stream;
    }
    waitForTransportConnected(transport) {
        this.writeLog("-- waitForTransportConnected created");
        return new Promise((resolve, reject) => {
            if (transport.connectionState === 'connected') {
                resolve();
                return;
            }
            const onStateChange = (state) => {
                this.writeLog("connectionstatechange transport: " + state);
                if (state === 'connected') {
                    resolve();
                    transport.off('connectionstatechange', onStateChange);
                }
                else if (state === 'failed' || state === 'closed') {
                    reject(new Error(`Transport failed to connect: ${state}`));
                    transport.off('connectionstatechange', onStateChange);
                }
            };
            transport.on('connectionstatechange', onStateChange);
        });
    }
    disposeRoom() {
        var _a, _b;
        this.writeLog("disposeRoom()");
        this.isRoomConnected = false;
        this.localPeer.consumers.forEach(c => c.close());
        this.localPeer.producers.forEach(c => c.close());
        (_a = this.recvTransportRef) === null || _a === void 0 ? void 0 : _a.close();
        (_b = this.sendTransportRef) === null || _b === void 0 ? void 0 : _b.close();
        this.recvTransportRef = null;
        this.sendTransportRef = null;
        this.peers = [];
        this.localRoomId = "";
        this.localPeer = new peer_1.Peer();
        this.isConnected = false;
        this.isRoomConnected = false;
        this.ws.disconnect();
        this.writeLog("disposeRoom() - complete");
    }
}
exports.RoomsClient = RoomsClient;
