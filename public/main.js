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
const mediasoupClient = __importStar(require("mediasoup-client"));
const payload_1 = require("./payload");
(() => __awaiter(void 0, void 0, void 0, function* () {
    const wsURI = "wss://localhost:3000";
    let ws;
    const ctlVideo = document.getElementById('ctlVideo');
    const ctlPeerId = document.getElementById('ctlPeerId');
    const ctlRemoteVideos = document.getElementById('ctlRemoteVideos');
    const ctlDisplayName = document.getElementById("ctlDisplayName");
    const ctlJoinRoomButton = document.getElementById("ctlJoinRoomButton");
    const ctlLeaveRoomButton = document.getElementById("ctlLeaveRoomButton");
    const ctlRoomId = document.getElementById("ctlRoomId");
    const ctlSatus = document.getElementById("ctlSatus");
    let device;
    let sendTransport;
    let recvTransport;
    let localPeerId = "";
    yield initMediaSoupDevice();
    yield initWebsocket();
    function addTrackToRemoteVideo(peerId, track) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find the existing video element
            let video = document.getElementById(peerId);
            if (!video) {
                //add new element
                video = document.createElement('video');
                video.id = peerId;
                video.autoplay = true;
                video.playsInline = true;
                video.style.width = '300px';
                video.srcObject = new MediaStream([track]);
                ctlRemoteVideos.appendChild(video);
            }
            // Get the current MediaStream or create a new one if none exists
            let mediaStream = video.srcObject;
            if (!mediaStream) {
                mediaStream = new MediaStream();
                video.srcObject = mediaStream;
            }
            // Add the new track to the MediaStream
            mediaStream.addTrack(track);
            // Ensure the video is set to play
            video.play().catch(error => {
                console.error('Error playing video:', error);
            });
        });
    }
    ctlJoinRoomButton.onclick = (event) => __awaiter(void 0, void 0, void 0, function* () {
        event.preventDefault();
        ctlJoinRoomButton.disabled = false;
        let roomid = ctlRoomId.value;
        yield roomJoin(roomid);
    });
    function send(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("ws_send ", msg);
            ws.send(JSON.stringify(msg));
        });
    }
    ;
    function writeLog(statusText) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(statusText);
            // ctlSatus.innerHTML = statusText + ctlSatus.innerText + "<br>";
            ctlSatus.innerHTML = `${statusText}<br>${ctlSatus.innerHTML}`;
        });
    }
    function initMediaSoupDevice() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- initMediaSoupDevice");
            //init a new media soup device
            device = new mediasoupClient.Device();
            writeLog("mediasoup initialized");
        });
    }
    function initWebsocket() {
        return __awaiter(this, void 0, void 0, function* () {
            ws = new WebSocket(wsURI);
            ws.addEventListener('open', () => __awaiter(this, void 0, void 0, function* () {
                writeLog("websocket open " + wsURI);
                const stream = yield navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                ctlVideo.srcObject = stream;
                register();
            }));
            ws.addEventListener('message', (event) => __awaiter(this, void 0, void 0, function* () {
                const msgIn = JSON.parse(event.data);
                console.log("-- ws_receive ", msgIn);
                switch (msgIn.type) {
                    case payload_1.payloadTypeServer.registerResult:
                        onRegisterResult(msgIn);
                        break;
                    case payload_1.payloadTypeServer.producerTransportCreated:
                        onProducerTransportCreated(msgIn);
                        break;
                    case payload_1.payloadTypeServer.consumerTransportCreated:
                        onConsumerTransportCreated(msgIn);
                        break;
                    case payload_1.payloadTypeServer.roomJoinResult:
                        onRoomJoinResult(msgIn);
                        break;
                    case payload_1.payloadTypeServer.roomNewPeer:
                        onRoomNewPeer(msgIn);
                        break;
                    case payload_1.payloadTypeServer.roomNewProducer:
                        onRoomNewProducer(msgIn);
                        break;
                    case payload_1.payloadTypeServer.roomPeerLeft:
                        onRoomPeerLeft(msgIn);
                        break;
                    case payload_1.payloadTypeServer.produced:
                        onProduced(msgIn);
                        break;
                    case payload_1.payloadTypeServer.consumed:
                        onConsumed(msgIn);
                        break;
                }
            }));
            ws.addEventListener("close", () => __awaiter(this, void 0, void 0, function* () {
                writeLog("websocket closed");
                ctlJoinRoomButton.disabled = true;
            }));
        });
    }
    function register() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- register");
            let msg = new payload_1.RegisterMsg();
            msg.authToken = ""; //need authtoken from server
            msg.displayName = ctlDisplayName.value;
            send(msg);
        });
    }
    function onRegisterResult(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- onRegisterResult");
            localPeerId = msgIn.data.peerid;
            ctlPeerId.innerText = localPeerId;
            yield device.load({ routerRtpCapabilities: msgIn.data.rtpCapabilities });
            yield createProducerTransport();
            yield createConsumerTransport();
            ctlJoinRoomButton.disabled = false;
        });
    }
    function createProducerTransport() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- createProducerTransport");
            let msg = new payload_1.CreateProducerTransportMsg();
            send(msg);
        });
    }
    function createConsumerTransport() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- createConsumerTransport");
            let msg = new payload_1.CreateConsumerTransportMsg();
            send(msg);
        });
    }
    function roomJoin(roomid) {
        return __awaiter(this, void 0, void 0, function* () {
            let msg = new payload_1.RoomJoinMsg();
            msg.data = {
                roomId: roomid,
                roomToken: ""
            };
            send(msg);
        });
    }
    function onConsumerTransportCreated(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- onConsumerTransportCreated");
            recvTransport = device.createRecvTransport({
                id: msgIn.data.transportId,
                iceServers: msgIn.data.iceServers,
                iceCandidates: msgIn.data.iceCandidates,
                iceParameters: msgIn.data.iceParameters,
                dtlsParameters: msgIn.data.dtlsParameters,
                iceTransportPolicy: msgIn.data.iceTransportPolicy
            });
            recvTransport.on('connect', ({ dtlsParameters }, callback) => {
                let msg = new payload_1.ConnectConsumerTransportMsg();
                msg.data = {
                    dtlsParameters: dtlsParameters
                };
                send(msg);
                callback();
            });
        });
    }
    function onProducerTransportCreated(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- onProducerTransportCreated");
            //the server has created a transport
            //create a client transport to connect to the server transport
            sendTransport = device.createSendTransport({
                id: msgIn.data.transportId,
                iceServers: msgIn.data.iceServers,
                iceCandidates: msgIn.data.iceCandidates,
                iceParameters: msgIn.data.iceParameters,
                dtlsParameters: msgIn.data.dtlsParameters,
                iceTransportPolicy: msgIn.data.iceTransportPolicy
            });
            sendTransport.on("connect", ({ dtlsParameters }, callback) => {
                console.log("-- sendTransport connect");
                //fires when the transport connects to the mediasoup server
                let msg = new payload_1.ConnectProducerTransportMsg();
                msg.data = {
                    dtlsParameters: dtlsParameters
                };
                send(msg);
                callback();
            });
            sendTransport.on('produce', ({ kind, rtpParameters }, callback) => {
                console.log("-- sendTransport produce");
                //fires when we call produce with local tracks
                let msg = new payload_1.ProduceMsg();
                msg.data = {
                    kind: kind,
                    rtpParameters: rtpParameters
                };
                send(msg);
                //what is the id value???
                callback({ id: 'placeholder' });
            });
        });
    }
    function onRoomJoinResult(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("-- onRoomJoinResult");
            if (msgIn.data.roomId) {
                writeLog("joined room " + msgIn.data.roomId);
                ctlRoomId.value = msgIn.data.roomId;
                ctlJoinRoomButton.disabled = true;
                ctlJoinRoomButton.style.visibility = "hidden";
                ctlLeaveRoomButton.disabled = false;
                ctlLeaveRoomButton.style.visibility = "visible";
            }
            else {
                ctlJoinRoomButton.disabled = false;
                ctlLeaveRoomButton.disabled = true;
                ctlLeaveRoomButton.style.visibility = "hidden";
            }
            //publish local stream
            yield produceLocalStreams();
            console.log("-- onRoomJoinResult peers :" + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peers.length));
            //connect to existing peers
            if (msgIn.data && msgIn.data.peers) {
                for (let peer of msgIn.data.peers) {
                    console.log(peer.peerId);
                    console.log("-- onRoomJoinResult producers :" + ((_b = peer.producers) === null || _b === void 0 ? void 0 : _b.length));
                    if (peer.producers) {
                        for (let producer of peer.producers) {
                            console.log("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
                            consumeProducer(peer.peerId, producer.producerId);
                        }
                    }
                }
            }
        });
    }
    function onRoomNewPeer(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            console.log("onRoomNewPeer " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId) + " producers: " + ((_c = (_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.producers) === null || _c === void 0 ? void 0 : _c.length));
            writeLog("new PeeerJoined " + ((_d = msgIn.data) === null || _d === void 0 ? void 0 : _d.peerId));
            if ((_e = msgIn.data) === null || _e === void 0 ? void 0 : _e.producers) {
                for (let producer of msgIn.data.producers) {
                    consumeProducer(msgIn.data.peerId, producer.producerId);
                }
            }
        });
    }
    function onRoomPeerLeft(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            writeLog("peer left the room:" + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId));
            //destroy the video element
            if (msgIn.data && msgIn.data.peerId) {
                let video = document.getElementById((_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.peerId);
                video === null || video === void 0 ? void 0 : video.remove();
            }
        });
    }
    function onRoomNewProducer(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            writeLog("onRoomNewProducer: " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.kind));
            consumeProducer((_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.peerId, (_c = msgIn.data) === null || _c === void 0 ? void 0 : _c.producerId);
        });
    }
    function produceLocalStreams() {
        return __awaiter(this, void 0, void 0, function* () {
            writeLog("produceLocalStreams");
            //get the tracks and start sending the streams "produce"
            const localStream = ctlVideo.srcObject;
            for (const track of localStream.getTracks()) {
                console.log("sendTransport produce ");
                yield sendTransport.produce({ track });
            }
        });
    }
    function consumeProducer(remotePeerId, producerId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("consumeProducer :" + remotePeerId, producerId);
            if (remotePeerId == localPeerId) {
                console.error("you can't consume yourself.");
            }
            let msg = new payload_1.ConsumeMsg();
            msg.data = {
                remotePeerId: remotePeerId,
                producerId: producerId,
                rtpCapabilities: device.rtpCapabilities
            };
            send(msg);
        });
    }
    function onConsumed(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            const consumer = yield recvTransport.consume({
                id: msgIn.data.consumerId,
                producerId: msgIn.data.producerId,
                kind: msgIn.data.kind,
                rtpParameters: msgIn.data.rtpParameters
            });
            addTrackToRemoteVideo(msgIn.data.peerId, consumer.track);
        });
    }
    function onProduced(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            writeLog("onProduced " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.kind));
        });
    }
}))();
