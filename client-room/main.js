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
const roomSharedModels_1 = require("./roomSharedModels");
(() => __awaiter(void 0, void 0, void 0, function* () {
    const wsURI = "wss://localhost:3000";
    let ws;
    const ctlVideo = document.getElementById('ctlVideo');
    const ctlPeerId = document.getElementById('ctlPeerId');
    const ctlRemoteVideos = document.getElementById('ctlRemoteVideos');
    const ctlDisplayName = document.getElementById("ctlDisplayName");
    const ctlJoinRoomButton = document.getElementById("ctlJoinRoomButton");
    const ctlLeaveRoomButton = document.getElementById("ctlLeaveRoomButton");
    const ctlJoinInfo = document.getElementById("ctlJoinInfo");
    const ctlSatus = document.getElementById("ctlSatus");
    let device;
    let sendTransport;
    let recvTransport;
    let localPeerId = "";
    let localRoomId = "";
    let roomToken = "";
    let authToken = "";
    let peers = [];
    yield initMediaSoupDevice();
    yield initWebsocket();
    function addTrackToRemoteVideo(peerId, track) {
        // Find the existing video element
        let id = `video-${peerId}`;
        let video = document.getElementById(id);
        if (!video) {
            //add new element
            video = document.createElement('video');
            video.id = id;
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
    }
    function destroyRemoteVideo(peerId) {
        console.log("destroyRemoteVideo:" + peerId);
        let id = `video-${peerId}`;
        let video = document.getElementById(id);
        if (video) {
            video.remove();
        }
    }
    ctlJoinRoomButton.onclick = (event) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("ctlJoinRoomButton click");
        event.preventDefault();
        ctlJoinRoomButton.disabled = false;
        if (!ctlJoinInfo.value) {
            const { roomId, roomToken } = yield roomNewAwait();
            if (roomId && roomToken) {
                let joinInfoStr = JSON.stringify({ roomId: roomId, roomToken: roomToken });
                ctlJoinInfo.value = joinInfoStr;
                console.log("attempt to join room ", joinInfoStr);
                roomJoin(roomId);
            }
            else {
                console.log("roomid and roomToken is required.");
            }
        }
        else {
            let joinInfo = JSON.parse(ctlJoinInfo.value);
            if (!roomToken) {
                roomToken = joinInfo.roomToken;
                roomJoin(joinInfo.roomId);
            }
            else {
                console.log("roomToken is required.");
            }
        }
    });
    ctlLeaveRoomButton.onclick = (event) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("ctlLeaveRoomButton click");
        event.preventDefault();
        ctlLeaveRoomButton.disabled = true;
        ctlLeaveRoomButton.style.visibility = "hidden";
        ctlJoinInfo.value = "";
        ctlJoinRoomButton.disabled = false;
        ctlJoinRoomButton.style.visibility = "visible";
        yield roomLeave();
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
                    case roomSharedModels_1.payloadTypeServer.registerResult:
                        onRegisterResult(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.producerTransportCreated:
                        onProducerTransportCreated(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.consumerTransportCreated:
                        onConsumerTransportCreated(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomNewResult:
                        onRoomNewResult(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomJoinResult:
                        onRoomJoinResult(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomNewPeer:
                        onRoomNewPeer(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomNewProducer:
                        onRoomNewProducer(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.roomPeerLeft:
                        onRoomPeerLeft(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.produced:
                        onProduced(msgIn);
                        break;
                    case roomSharedModels_1.payloadTypeServer.consumed:
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
    /**
     * register ->                                  //registers a new peer
     *   <- registerResult                          //returns a peerid
     * createProducerTransport ->                   //request server to create a producer transport
     * createConsumerTransport ->                   //request server to create a consumer transport
     *   <- producerTransportCreated                //signals client the transport is created
     *   <- consumerTransportCreated                //signals client the transport is created
     * connectConsumerTransport ->                  //request server to connect the client and server transports
     * connectProducerTransport ->                  //request server to connect the client and server transports
     * roomJoin ->                                  //join a room or create a new one
     *   <- joinRoomResult                          //returns a roomid
     * // is has room members
     * // do produce/consume for each
     * produce ->                                   //request server to receive a local stream
     *   <- produced                                //signals client the local stream being received
     * // consumeProducer()
     * consume ->                                   //request server to consume stream
     *   <- consumed                                //signals client the stream is being consumed
     */
    function register() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- register");
            let msg = new roomSharedModels_1.RegisterMsg();
            msg.data.authToken = ""; //need authtoken from server
            msg.data.displayName = ctlDisplayName.value;
            send(msg);
        });
    }
    function onRegisterResult(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- onRegisterResult");
            localPeerId = msgIn.data.peerId;
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
            let msg = new roomSharedModels_1.CreateProducerTransportMsg();
            send(msg);
        });
    }
    function createConsumerTransport() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("-- createConsumerTransport");
            let msg = new roomSharedModels_1.CreateConsumerTransportMsg();
            send(msg);
        });
    }
    function roomNewAwait() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("roomNewAwait");
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Room creation timed out"));
                }, 10000); // 10-second timeout
                // Define a one-time message handler
                const handleMessage = (event) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    try {
                        console.log("handleMessage roomNewResult");
                        const msgIn = JSON.parse(event.data);
                        // Only handle roomNewResult messages
                        if (msgIn.type !== roomSharedModels_1.payloadTypeServer.roomNewResult) {
                            return;
                        }
                        //this function will fire first since  its already added
                        //await Promise.resolve(onRoomNewResult(msgIn));
                        if ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.error) {
                            reject(new Error(`Failed to create room: ${msgIn.data.error}`));
                            return;
                        }
                        if (!((_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.roomId) || !((_c = msgIn.data) === null || _c === void 0 ? void 0 : _c.roomToken)) {
                            reject(new Error("Invalid response: missing roomId or roomToken"));
                            return;
                        }
                        localRoomId = msgIn.data.roomId;
                        roomToken = msgIn.data.roomToken;
                        resolve({ roomId: msgIn.data.roomId, roomToken: msgIn.data.roomToken });
                    }
                    catch (error) {
                        reject(new Error(`Room creation failed: ${error}`));
                    }
                    finally {
                        // Remove this listener
                        ws.removeEventListener("message", handleMessage);
                        clearTimeout(timeout);
                    }
                });
                // Register temporary listener
                ws.addEventListener("message", handleMessage);
                // Send room creation request
                roomNew();
            });
        });
    }
    function roomNew() {
        let msg = new roomSharedModels_1.RoomNewMsg();
        msg.data = {};
        send(msg);
    }
    let onRoomNewResult = (msgIn) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        console.log(`onRoomNewResult`);
        if ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.error) {
            console.log(`failed to create new room ${msgIn.data.error}`);
        }
        else {
            localRoomId = (_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.roomId;
            roomToken = (_c = msgIn.data) === null || _c === void 0 ? void 0 : _c.roomToken;
            console.log(`onRoomNewResult ${localRoomId} ${roomToken}`);
        }
    });
    function roomJoin(roomid) {
        let msg = new roomSharedModels_1.RoomJoinMsg();
        msg.data = {
            roomId: roomid,
            roomToken: roomToken
        };
        send(msg);
    }
    function onRoomJoinResult(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("-- onRoomJoinResult");
            if (!msgIn.data.error) {
                localRoomId = msgIn.data.roomId;
                roomToken = msgIn.data.roomToken;
                if (!roomToken) {
                    writeLog("joined room " + msgIn.data.roomId);
                    ctlJoinRoomButton.disabled = true;
                    ctlJoinRoomButton.style.visibility = "hidden";
                    ctlLeaveRoomButton.disabled = false;
                    ctlLeaveRoomButton.style.visibility = "visible";
                }
                else {
                    console.error("not token received");
                }
            }
            else {
                localRoomId = "";
                ctlJoinRoomButton.disabled = false;
                ctlLeaveRoomButton.disabled = true;
                ctlLeaveRoomButton.style.visibility = "hidden";
                writeLog(`join room failed. ${(_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.error} `);
                return;
            }
            //publish local stream
            yield produceLocalStreams();
            console.log("-- onRoomJoinResult peers :" + msgIn.data.peers.length);
            //connect to existing peers
            if (msgIn.data && msgIn.data.peers) {
                for (let peer of msgIn.data.peers) {
                    peers.push(peer.peerId);
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
    function roomLeave() {
        return __awaiter(this, void 0, void 0, function* () {
            for (let peerid of peers) {
                destroyRemoteVideo(peerid);
            }
            let msg = new roomSharedModels_1.RoomLeaveMsg();
            msg.data = {
                roomId: localRoomId,
                roomToken: roomToken
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
                let msg = new roomSharedModels_1.ConnectConsumerTransportMsg();
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
                let msg = new roomSharedModels_1.ConnectProducerTransportMsg();
                msg.data = {
                    dtlsParameters: dtlsParameters
                };
                send(msg);
                callback();
            });
            sendTransport.on('produce', ({ kind, rtpParameters }, callback) => {
                console.log("-- sendTransport produce");
                //fires when we call produce with local tracks
                let msg = new roomSharedModels_1.ProduceMsg();
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
    function onRoomNewPeer(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            console.log("onRoomNewPeer " + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId) + " producers: " + ((_c = (_b = msgIn.data) === null || _b === void 0 ? void 0 : _b.producers) === null || _c === void 0 ? void 0 : _c.length));
            writeLog("new PeeerJoined " + ((_d = msgIn.data) === null || _d === void 0 ? void 0 : _d.peerId));
            peers.push(msgIn.data.peerId);
            if ((_e = msgIn.data) === null || _e === void 0 ? void 0 : _e.producers) {
                for (let producer of msgIn.data.producers) {
                    consumeProducer(msgIn.data.peerId, producer.producerId);
                }
            }
        });
    }
    function onRoomPeerLeft(msgIn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            writeLog("peer left the room:" + ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId));
            //destroy the video element
            if (msgIn.data && msgIn.data.peerId) {
                destroyRemoteVideo(msgIn.data.peerId);
            }
            let idx = peers.findIndex(peerid => { var _a; return peerid == ((_a = msgIn.data) === null || _a === void 0 ? void 0 : _a.peerId); });
            if (idx > -1) {
                peers.splice(idx, 1);
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
            let msg = new roomSharedModels_1.ConsumeMsg();
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
