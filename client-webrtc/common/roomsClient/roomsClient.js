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
class RoomsClient {
    constructor() {
        this.localRoomId = "";
        this.localPeer = { peerId: "", displayName: "", hasAudio: false, hasVideo: false, stream: null };
        this.isConnected = false;
        this.isRoomConnected = false;
        this.peers = [];
        this.audioEnabled = true;
        this.videoEnabled = true;
        this.config = {
            wsURI: "wss://localhost:3000",
        };
        this.writeLog = (log) => __awaiter(this, void 0, void 0, function* () {
            console.log("RoomsClient", log);
        });
        this.initMediaSoupDevice = () => __awaiter(this, void 0, void 0, function* () {
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
        });
        this.onMsgIn = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            console.log("-- onmessage", msgIn);
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
            if (["connecting", "connected"].includes(this.ws.state)) {
                this.writeLog("socket already " + this.ws.state);
                return;
            }
            // In a real implementation, actually connect to WebSocket
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
            this.ws.addEventHandler("onmessage", this.onMsgIn);
            this.ws.addEventHandler("onclose", onClose);
            this.ws.addEventHandler("onerror", onClose);
            this.ws.connect(this.config.wsURI, true);
        });
        this.disconnect = () => {
            this.ws.disconnect();
        };
        this.send = (msg) => __awaiter(this, void 0, void 0, function* () {
            this.ws.send(msg);
        });
        this.toggleAudio = () => {
            this.audioEnabled = !this.audioEnabled;
            this.writeLog(`Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
        };
        this.toggleVideo = () => {
            this.videoEnabled = !this.videoEnabled;
            this.writeLog(`Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
        };
        this.addPeer = (newPeer) => {
            this.peers.push(newPeer);
        };
        this.removePeer = (peerId) => {
            let idx = this.peers.findIndex(p => p.peerId == peerId);
            if (idx > -1) {
                this.peers.splice(idx, 1);
            }
        };
        this.addRemoteTrack = (peerId, track) => {
            let peer = this.peers.find(p => p.peerId === peerId);
            if (!peer) {
                this.writeLog("peer not found.");
                return;
            }
            if (!peer.stream) {
                peer.stream = new MediaStream();
            }
            peer.stream.addTrack(track);
        };
        this.removeRemoteStream = (peerId) => {
            let peer = this.peers.find(p => p.peerId === peerId);
            if (!peer) {
                this.writeLog("peer not found.");
                return;
            }
            if (peer.stream) {
                peer.stream.getTracks().forEach((track) => track.stop());
                peer.stream = null;
            }
        };
        this.register = () => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("-- register");
            let msg = new roomSharedModels_1.RegisterMsg();
            msg.data = {
                authToken: "", //need authtoken from server
                displayName: this.localPeer.displayName
            };
            this.ws.send(msg);
        });
        this.onRegisterResult = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("-- onRegisterResult");
            this.localPeer.peerId = msgIn.data.peerId;
            yield this.device.load({ routerRtpCapabilities: msgIn.data.rtpCapabilities });
            yield this.createProducerTransport();
            yield this.createConsumerTransport();
        });
        this.createProducerTransport = () => __awaiter(this, void 0, void 0, function* () {
            console.log("-- createProducerTransport");
            let msg = new roomSharedModels_1.CreateProducerTransportMsg();
            this.ws.send(msg);
        });
        this.createConsumerTransport = () => __awaiter(this, void 0, void 0, function* () {
            console.log("-- createConsumerTransport");
            let msg = new roomSharedModels_1.CreateConsumerTransportMsg();
            this.ws.send(msg);
        });
        this.roomJoin = (roomid) => __awaiter(this, void 0, void 0, function* () {
            let msg = new roomSharedModels_1.RoomJoinMsg();
            msg.data = {
                roomId: roomid,
                roomToken: ""
            };
            this.ws.send(msg);
        });
        this.roomLeave = () => __awaiter(this, void 0, void 0, function* () {
            let msg = new roomSharedModels_1.RoomLeaveMsg();
            msg.data = {
                roomId: this.localRoomId,
                roomToken: ""
            };
            this.isRoomConnected = false;
            this.localPeer.peerId = "";
            this.ws.send(msg);
        });
        this.isInRoom = () => {
            return !!this.isRoomConnected;
        };
        this.onConsumerTransportCreated = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            console.log("-- onConsumerTransportCreated");
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
                this.ws.send(msg);
                callback();
            });
        });
        this.onProducerTransportCreated = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            console.log("-- onProducerTransportCreated");
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
                console.log("-- sendTransport connect");
                //fires when the transport connects to the mediasoup server
                let msg = new roomSharedModels_1.ConnectProducerTransportMsg();
                msg.data = {
                    dtlsParameters: dtlsParameters
                };
                this.ws.send(msg);
                callback();
            });
            this.sendTransportRef.on('produce', ({ kind, rtpParameters }, callback) => {
                console.log("-- sendTransport produce");
                //fires when we call produce with local tracks
                let msg = new roomSharedModels_1.ProduceMsg();
                msg.data = {
                    kind: kind,
                    rtpParameters: rtpParameters
                };
                this.ws.send(msg);
                //what is the id value???
                callback({ id: 'placeholder' });
            });
        });
        this.onRoomJoinResult = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("-- onRoomJoinResult");
            if (msgIn.data.roomId) {
                this.localRoomId = msgIn.data.roomId;
                this.isRoomConnected = true;
                this.writeLog("joined room " + msgIn.data.roomId);
            }
            else {
                this.localRoomId = "";
                this.isRoomConnected = false;
            }
            this.localPeer.stream = yield navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            //publish local stream
            yield this.produceLocalStreams();
            console.log("-- onRoomJoinResult peers :" + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peers.length));
            //connect to existing peers  
            if (msgIn.data && msgIn.data.peers) {
                for (let peer of msgIn.data.peers) {
                    let newpeer = {
                        peerId: peer.peerId,
                        displayName: "",
                        hasAudio: false,
                        hasVideo: false,
                        stream: null
                    };
                    this.addPeer(newpeer);
                    console.log(peer.peerId);
                    console.log("-- onRoomJoinResult producers :" + ((_b = peer.producers) === null || _b === void 0 ? void 0 : _b.length));
                    if (peer.producers) {
                        for (let producer of peer.producers) {
                            console.log("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
                            this.consumeProducer(peer.peerId, producer.producerId);
                        }
                    }
                }
            }
        });
        this.onRoomNewPeer = (msgIn) => {
            var _a, _b, _c, _d, _e;
            this.writeLog("onRoomNewPeer " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId) + " producers: " + ((_c = (_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.producers) === null || _c === void 0 ? void 0 : _c.length));
            this.writeLog("new PeeerJoined " + ((_d = msgIn.data) === null || _d === void 0 ? void 0 : _d.peerId));
            let newPeer = {
                peerId: msgIn.data.peerId,
                displayName: "",
                hasAudio: false,
                hasVideo: false,
                stream: null
            };
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
        this.onRoomNewProducer = (msgIn) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            this.writeLog("onRoomNewProducer: " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.kind));
            this.consumeProducer((_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.peerId, (_c = msgIn.data) === null || _c === void 0 ? void 0 : _c.producerId);
        });
        this.produceLocalStreams = () => __awaiter(this, void 0, void 0, function* () {
            this.writeLog("produceLocalStreams");
            if (!this.localPeer.stream) {
                this.writeLog("not local stream");
            }
            for (const track of this.localPeer.stream.getTracks()) {
                console.log("sendTransport produce ");
                yield this.sendTransportRef.produce({ track });
            }
        });
        this.consumeProducer = (remotePeerId, producerId) => __awaiter(this, void 0, void 0, function* () {
            console.log("consumeProducer :" + remotePeerId, producerId);
            if (remotePeerId === this.localPeer.peerId) {
                console.error("you can't consume yourself.");
            }
            let msg = new roomSharedModels_1.ConsumeMsg();
            msg.data = {
                remotePeerId: remotePeerId,
                producerId: producerId,
                rtpCapabilities: this.device.rtpCapabilities
            };
            this.ws.send(msg);
        });
        this.onConsumed = (msgIn) => __awaiter(this, void 0, void 0, function* () {
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
            yield this.initMediaSoupDevice();
        });
    }
    ;
    connectAsync() {
        return new Promise((resolve, reject) => {
            const onOpen = () => __awaiter(this, void 0, void 0, function* () {
                this.isConnected = true;
                this.writeLog("websocket onOpen " + this.config.wsURI);
                resolve();
            });
            this.ws.addEventHandler("onmessage", this.onMsgIn);
            const onClose = () => __awaiter(this, void 0, void 0, function* () {
                this.writeLog("websocket onClose");
                this.isConnected = false;
                resolve();
            });
            this.ws.addEventHandler("onopen", onOpen);
            this.ws.addEventHandler("onmessage", this.onMsgIn);
            this.ws.addEventHandler("onclose", onClose);
            this.ws.addEventHandler("onerror", onClose);
            this.ws.connect(this.config.wsURI, true);
        });
    }
}
exports.RoomsClient = RoomsClient;
