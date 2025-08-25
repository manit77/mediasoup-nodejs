import * as mediasoup from 'mediasoup';
import os from 'os';
import { Room } from './room.js';
import {
    AuthUserNewTokenMsg,
    AuthUserNewTokenResultMsg,
    ConnectConsumerTransportMsg, ConnectProducerTransportMsg,
    ConsumerTransportConnectedMsg, ConsumerTransportCreatedMsg, CreateProducerTransportMsg, ErrorMsg, IMsg, OkMsg, payloadTypeClient,
    PeerTerminatedMsg, ProducerTransportConnectedMsg, createProducerTransportResultMsg,
    RegisterPeerMsg, RegisterPeerResultMsg, RoomClosedMsg, RoomConfig, RoomGetLogsMsg, RoomJoinMsg,
    RoomJoinResultMsg, RoomLeaveMsg, RoomLeaveResultMsg, RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg,
    RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
    RoomTerminateMsg,
    RoomTerminateResultMsg,
    TerminatePeerMsg,
    payloadTypeServer,
    RoomProduceStreamMsg,
    RoomProduceStreamResultMsg,
    RoomConsumeStreamMsg,
    RoomConsumeStreamResultMsg,
    PeerTracksInfoMsg,
    PeerMuteTracksMsg,
    RoomCloseProducerMsg,
    RoomConsumerClosedMsg,
    AuthUserRoles,
    RoomPingMsg,
    RoomPongMsg
} from "@rooms/rooms-models";
import { Peer } from './peer.js';
import * as roomUtils from "./utils.js";
import { AuthUserTokenPayload } from '../models/tokenPayloads.js';
import { setTimeout } from 'node:timers';
import { RoomLogAdapterInMemory } from './roomLogsAdapter.js';
import { consoleError, consoleLog, consoleWarn } from '../utils/utils.js';
import { outMessageEventListener, RoomServerConfig, WorkerData } from './models.js';


export class RoomServer {

    nextWorkerIdx = 0;
    private workers: mediasoup.types.Worker[] = [];

    private peers = new Map<string, Peer>();
    private rooms = new Map<string, Room>();

    private messageListeners: outMessageEventListener[] = [];
    private config: RoomServerConfig;
    private timerIdResourceInterval: any;
    private roomLogAdapter = new RoomLogAdapterInMemory();
    dateCreated = new Date();

    eventPeerClosed = (peer: Peer) => { };

    constructor(c: RoomServerConfig) {
        this.config = c;
        this.printStatsAll();
    }

    printStatsAll() {
        consoleWarn(`#### Conference Server Stats ####`);
        consoleWarn(`dateCreated: ${this.dateCreated}`);
        consoleWarn(`rooms: `, this.rooms.size);
        this.rooms.forEach(r => {
            consoleWarn(`roomName: ${r.roomName}, dateCreated: ${r.dateCreated}, id: ${r.id}`);
            //loop through roomPeers
            r.printStats();
        });

        consoleWarn(`peers: `, this.peers.size);
        this.peers.forEach(p => consoleWarn(`displayName: ${p.displayName}, dateCreated: ${p.dateCreated}, id: ${p.id}`));
        consoleWarn(`#################################`);

        setTimeout(() => {
            this.printStatsAll();
        }, 30000);
    }

    dispose() {
        console.log("roomServer dispose()");
        // Wait for initialization to complete to ensure worker and router are set

        clearInterval(this.timerIdResourceInterval);

        this.peers.forEach(p => {
            p.close();
        });
        this.peers.clear();

        this.rooms.forEach(r => {
            r.close("server dispose()");
        });
        this.rooms.clear();

        // Close worker
        for (let i = 0; i < this.workers.length; ++i) {
            let worker = this.workers[i];
            try {
                worker.close();
                console.log(`Worker closed ${worker.pid}`);
            } catch (error) {
                consoleError('Error closing worker:', error);
            }
        }
    }

    async init() {
        console.log(`initMediaSoup()`);
        console.log(`cpu count: ${os.cpus().length}`);

        const START_PORT = 10000;
        const END_PORT = 11000;
        const TOTAL_PORTS = END_PORT - START_PORT + 1;
        const NUM_WORKERS = os.cpus().length;

        // Calculate ports per worker
        const portsPerWorker = Math.floor(TOTAL_PORTS / NUM_WORKERS);
        console.log(`Total ports: ${TOTAL_PORTS}, Workers: ${NUM_WORKERS}, Ports per worker: ${portsPerWorker}`);

        for (let i = 0; i < os.cpus().length; ++i) {

            // Calculate port range for this worker
            const minPort = START_PORT + i * portsPerWorker;
            const maxPort = (i === NUM_WORKERS - 1) ? END_PORT : minPort + portsPerWorker - 1;

            let workerData: WorkerData = {
                minPort, maxPort
            };

            const worker = await mediasoup.createWorker({
                appData: workerData as any,
                logLevel: 'debug',
                dtlsCertificateFile: this.config.cert_file_path,
                dtlsPrivateKeyFile: this.config.cert_key_path,
            });

            worker.on('died', () => {
                consoleError('Worker died, exiting  in 2 seconds... [pid:%d]', worker.pid);

                setTimeout(() => process.exit(1), 2000);
            });

            this.workers.push(worker);
        }
    }

    getNextWorker() {
        const worker = this.workers[this.nextWorkerIdx];
        if (++this.nextWorkerIdx === this.workers.length) {
            this.nextWorkerIdx = 0;
        }
        return worker;
    }

    addMessageListener(eventListener: outMessageEventListener) {
        this.messageListeners.push(eventListener);
    }

    removeMessageListener(eventListener: outMessageEventListener) {
        let idx = this.messageListeners.findIndex((l) => l === eventListener);
        if (idx > -1) {
            this.messageListeners.splice(idx, 1);
        }
    }

    async inMessage(peerId: string, msgIn: any): Promise<IMsg> {

        console.log(`inMessage - type: ${msgIn.type}, peerId: ${peerId}`);

        if (!msgIn.type) {
            consoleError("message has no type");
            return null;
        }

        if (!msgIn.data) {
            consoleError("message has no data");
            return null;
        }

        switch (msgIn.type) {
            case payloadTypeClient.terminatePeer: {
                return this.onTerminatePeer(peerId, msgIn);
            }
            case payloadTypeClient.roomNewToken: {
                return this.onRoomNewToken(peerId, msgIn);
            }
            case payloadTypeClient.roomNew: {
                return this.onRoomNew(peerId, msgIn);
            }
            case payloadTypeClient.roomJoin: {
                return this.onRoomJoin(peerId, msgIn);
            }
            case payloadTypeClient.roomLeave: {
                return this.onRoomLeave(peerId, msgIn);
            }
            case payloadTypeClient.roomTerminate: {
                return this.onRoomTerminate(peerId, msgIn);
            }
            case payloadTypeClient.createProducerTransport: {
                return this.onCreateProducerTransport(peerId, msgIn);
            }
            case payloadTypeClient.createConsumerTransport: {
                return this.onCreateConsumerTransport(peerId, msgIn);
            }
            case payloadTypeClient.connectProducerTransport: {
                return this.onConnectProducerTransport(peerId, msgIn);
            }
            case payloadTypeClient.connectConsumerTransport: {
                return this.onConnectConsumerTransport(peerId, msgIn);
            }
            case payloadTypeClient.roomProduceStream: {
                return this.onRoomProduceStream(peerId, msgIn);
            }
            case payloadTypeClient.roomCloseProducer: {
                return this.onRoomCloseProducer(peerId, msgIn);
            }
            case payloadTypeClient.roomConsumeStream: {
                return this.onRoomConsumeStream(peerId, msgIn);
            }
            case payloadTypeClient.peerTracksInfo: {
                return this.onPeerTracksInfo(peerId, msgIn);
            }
            case payloadTypeClient.peerMuteTracks: {
                return this.onPeerMuteTracks(peerId, msgIn);
            }
            case payloadTypeClient.roomPong: {
                return this.onRoomPong(peerId, msgIn);
            }

        }
        return null;
    }

    async onTerminatePeer(peerId: string, msg: TerminatePeerMsg): Promise<IMsg> {
        console.log(`onTerminatePeer() peerId: ${peerId}`);
        const peer = this.peers.get(peerId);
        if (peer) {
            this.closePeer(peer);

            let peerTerminatedMsg = new PeerTerminatedMsg();
            peerTerminatedMsg.data.peerId = msg.data.peerId;

            return peerTerminatedMsg;
        }
        return new ErrorMsg(payloadTypeServer.peerTerminated, "peer not found.");
    }

    onTerminatePeerMsg(msg: TerminatePeerMsg): PeerTerminatedMsg {
        console.log(`onTerminatePeer() ${msg.data.peerId}`);
        const peer = this.peers.get(msg.data.peerId);
        if (peer) {
            this.closePeer(peer);
            let peerTerminatedMsg = new PeerTerminatedMsg();
            peerTerminatedMsg.data.peerId = msg.data.peerId;
            return peerTerminatedMsg;
        }
        let errorMsg = new PeerTerminatedMsg();
        errorMsg.data.error = "peer not found."
        return errorMsg;
    }

    closePeer(peer: Peer) {
        console.log(`closePeer() ${peer.displayName} ${peer.id}`);

        if (!peer) {
            consoleError("peer is required.");
            return;
        }

        peer.close();

        //delete from peers
        this.removePeerGlobal(peer);
        this.eventPeerClosed(peer);
    }

    /**
     * creates a new peer and adds it the peers map
     * @param trackingId custom id from a client
     * @returns 
     */
    private createPeer(authToken: string, username: string, trackingId: string, displayName: string): Peer {
        console.log(`createPeer() - trackingId: ${trackingId}, displayName: ${displayName}`);

        let payload: AuthUserTokenPayload = roomUtils.decodeAuthUserToken(this.config.room_secretKey, authToken);

        if (!payload) {
            consoleError("failed to validate validateAuthUserToken.")
            return null;
        }
        if (payload.username !== username) {
            consoleError("username does not match.");
            return null;
        }

        let peer = new Peer();
        peer.id = roomUtils.GetPeerId();
        peer.authToken = authToken;
        peer.displayName = displayName;
        peer.username = username;
        peer.trackingId = trackingId;
        peer.role = payload.role;

        this.addPeerGlobal(peer);

        return peer;
    }

    async createRoom(args: {
        roomId: string,
        roomToken: string,
        trackingId: string,
        adminTrackingId: string,
        roomName: string,
        config: RoomConfig
    }): Promise<Room> {
        console.log(`createRoom() - roomId:${args.roomId} roomToken: ${args.roomToken}`);

        if (!args.roomId) {
            args.roomId = roomUtils.GetRoomId();
        }

        if (this.rooms.has(args.roomId)) {
            consoleError("room already exists");
            return null;
        }

        if (!args.roomToken) {
            consoleError("roomToken is required.");
            return null;
        }

        let payload = roomUtils.validateRoomToken(this.config.room_secretKey, args.roomToken);
        if (!payload) {
            consoleError("invalid token while creating room.");
            return null;
        }

        if (args.roomId != payload.roomId) {
            consoleError("invalid roomId.");
            return null;
        }

        let roomConfig: RoomConfig;
        if (!args.config) {
            roomConfig = new RoomConfig();
        }

        let room = new Room(this.config);
        room.roomLogAdapter = this.roomLogAdapter;
        room.id = args.roomId;
        room.roomToken = args.roomToken;
        room.trackingId = args.trackingId;
        room.config = roomConfig;
        room.adminTrackingId = args.adminTrackingId;
        room.roomName = args.roomName;

        let worker = this.getNextWorker();

        let router = await worker.createRouter({
            appData: worker.appData,
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                },
            ],
        });

        room.roomRouter = router;
        room.roomRtpCapabilities = router.rtpCapabilities;

        room.onClosedEvent = (r, peers) => {
            consoleLog(`room.onClosedEvent ${r.id} ${r.roomName}`);
            this.removeRoomGlobal(r);

            //alert all peers that the room is closed
            let msg = new RoomClosedMsg();
            msg.data.roomId = r.id;
            for (let p of peers) {
                this.send(p.id, msg);
            }
        };

        room.onPeerRemovedEvent = (r, peer) => {
            consoleLog(`room.onPeerRemovedEvent ${r.id} ${peer.displayName}`);

            //broad cast to all peers in the room the the peer has left the room
            let msg = new RoomPeerLeftMsg();
            msg.data.roomId = r.id;
            msg.data.peerId = peer.id;

            //alert the peer they were removed
            let peers = [...r.getPeers(), peer];
            for (let p of peers) {
                this.send(p.id, msg);
            }

        };

        room.onConsumerClosed = (peer, consumer) => {
            //alert the peer the consumer is closed
            //the peer should close on the client
            let msg = new RoomConsumerClosedMsg();
            msg.data.consumerId = consumer.id;
            msg.data.producerId = consumer.producerId;
            msg.data.kind = consumer.kind;
            msg.data.roomId = room.id;
            this.send(peer.id, msg);
        };

        room.onNeedPing = (peer) => {
            let msg = new RoomPingMsg();
            msg.data.roomId = room.id;
            this.send(peer.id, msg);
        };

        this.addRoomGlobal(room);

        return room;
    }

    getRoom(roomId: string): Room {
        return this.rooms.get(roomId);
    }

    getPeer(peerId: string): Peer {
        return this.peers.get(peerId);
    }

    getRoomCount() {
        return this.rooms.size;
    }

    getPeerCount() {
        return this.peers.size;
    }

    private addPeerGlobal(peer: Peer) {
        console.log(`addPeerGlobal() ${peer.id}`);
        this.peers.set(peer.id, peer);
    }

    private addRoomGlobal(room: Room) {
        console.log(`addRoomGlobal() ${room.id}`);
        this.rooms.set(room.id, room);
        room.startTimers();
    }

    private removePeerGlobal(peer: Peer) {
        console.log(`removePeerGlobal() ${peer.id}`);
        this.peers.delete(peer.id);
    }

    private removeRoomGlobal(room: Room) {
        console.log(`removeRoomGlobal() ${room.id}`);
        this.rooms.delete(room.id);
    }

    private send(peerId: string, msg: IMsg) {
        let peer = this.getPeer(peerId);
        console.log(`send() - to: ${peer.displayName} `, msg.type);
        for (let eventListener of this.messageListeners) {
            eventListener(peerId, msg);
        }
    }

    private async broadCastExcept(room: Room, exceptArr: Peer[], msg: IMsg) {
        console.log("broadCastExcept()");
        for (let peer of room.getPeers()) {
            if (!exceptArr.includes(peer)) {
                this.send(peer.id, msg);
            }
        }
    }

    private broadCastAll(room: Room, msg: IMsg) {
        console.log("broadCastAll()");
        for (let peer of room.getPeers()) {
            this.send(peer.id, msg);
        }
    }
    /**
     * registers a new peer
     * @param msgIn
     * @returns RegisterPeerResultMsg
     */
    async onRegisterPeer(msgIn: RegisterPeerMsg) {
        console.log(`onRegister() - peerTrackingId:${msgIn.data.peerTrackingId},  displayName:${msgIn.data.displayName}`);

        if (!msgIn.data.username) {
            consoleError("username is required.");
            let errMsg = new RegisterPeerResultMsg();
            errMsg.data = {
                error: "username is required."
            };
            return errMsg;
        }

        if (!msgIn.data.peerTrackingId) {
            consoleError("tracking id is required.");
            let errMsg = new RegisterPeerResultMsg();
            errMsg.data = {
                error: "tracking id for peer is required."
            };
            return errMsg;
        }

        if (!msgIn.data.displayName) {
            consoleError("displayName for peer is required.");
            let errMsg = new RegisterPeerResultMsg();
            errMsg.data = {
                error: "displayName for peer is required."
            };
            return errMsg;
        }

        if (!msgIn.data.authToken) {
            consoleError("authToken for peer is required.");
            let errMsg = new RegisterPeerResultMsg();
            errMsg.data = {
                error: "authToken is required."
            };
            return errMsg;
        }

        //get peer by trackingId
        let peer = [...this.peers.values()].find(p => p.trackingId === msgIn.data.peerTrackingId);
        if (peer) {
            //existing peer found
            consoleWarn(`peer already exists by trackingId ${peer.trackingId}, ${peer.displayName}, ${peer.id}`);

            //verify the auth token
            let payload: AuthUserTokenPayload = roomUtils.decodeAuthUserToken(this.config.room_secretKey, msgIn.data.authToken);

            if (!payload) {
                consoleError("failed to validate validateAuthUserToken.")
                let errMsg = new RegisterPeerResultMsg();
                errMsg.data = {
                    error: "invalid authToken."
                };
                return errMsg;
            }

            if (payload.username !== payload.username) {
                consoleError("unable to validate credentials.");
                let errMsg = new RegisterPeerResultMsg();
                errMsg.data = {
                    error: "unable to validate credentials."
                };
                return errMsg;
            }

            //close current peer and allow a new one to be created
            this.closePeer(peer);
        }

        peer = this.createPeer(msgIn.data.authToken, msgIn.data.username, msgIn.data.peerTrackingId, msgIn.data.displayName);
        if (!peer) {
            let errMsg = new RegisterPeerResultMsg();
            errMsg.data = {
                error: "unable to create peer."
            };
            return errMsg;
        }

        let msg = new RegisterPeerResultMsg();
        msg.data = {
            peerId: peer.id,
            displayName: msgIn.data.displayName,
        };

        return msg;
    }

    async onCreateProducerTransport(peerId: string, msgIn: CreateProducerTransportMsg): Promise<IMsg> {
        console.log("onCreateProducerTransport");
        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.createProducerTransportResult, "peer not found");;
        }

        if (!peer.room) {
            consoleError("peer is not in a room");
            return new ErrorMsg(payloadTypeServer.createProducerTransportResult, "peer is not in a room");
        }

        let producerTransport = await peer.room.createProducerTransport(peer);
        if (!producerTransport) {
            return new ErrorMsg(payloadTypeServer.createProducerTransportResult, "could not create producer transport");
        }

        let createProducerTransportResult = new createProducerTransportResultMsg();
        createProducerTransportResult.data = {
            roomId: peer.room.id,
            iceServers: this.config.room_iceServers,
            iceTransportPolicy: this.config.room_iceTransportPolicy,
            transportId: producerTransport.id,
            iceParameters: producerTransport.iceParameters,
            iceCandidates: producerTransport.iceCandidates,
            dtlsParameters: producerTransport.dtlsParameters,
        }

        return createProducerTransportResult;
    }

    async onCreateConsumerTransport(peerId: string, msgIn: CreateProducerTransportMsg): Promise<IMsg> {
        console.log("onCreateConsumerTransport");

        //client requests to create a consumer transport to receive data
        //one ConsumerTransport for each peer

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.createConsumerTransportResult, "peer not found.");
        }

        if (!peer.room) {
            consoleError("peer is not in a room");
            return new ErrorMsg(payloadTypeServer.createConsumerTransportResult, "peer is not in a room");
        }

        let consumerTransport = await peer.room.createConsumerTransport(peer);
        if (!consumerTransport) {
            return new ErrorMsg(payloadTypeServer.createConsumerTransportResult, "could not create consumer transport");
        }

        let consumerTransportCreated = new ConsumerTransportCreatedMsg();
        consumerTransportCreated.data = {
            roomId: peer.room.id,
            iceServers: this.config.room_iceServers,
            iceTransportPolicy: this.config.room_iceTransportPolicy,
            transportId: consumerTransport.id,
            iceParameters: consumerTransport.iceParameters,
            iceCandidates: consumerTransport.iceCandidates,
            dtlsParameters: consumerTransport.dtlsParameters,
        }

        return consumerTransportCreated;
    }

    async onConnectProducerTransport(peerId: string, msgIn: ConnectProducerTransportMsg): Promise<IMsg> {

        console.log("onConnectProducerTransport");

        let peer = this.peers.get(peerId);

        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.connectProducerTransportResult, "peer not found.");
        }

        if (!peer.room) {
            consoleError("not in a room");
            return new ErrorMsg(payloadTypeServer.connectProducerTransportResult, "not in a room.");
        }

        let producerTransport = peer.room.getProducerTransport(peer);

        if (!producerTransport) {
            consoleError(`producerTransport not found for ${peer.id} ${peer.displayName}`);
            return new ErrorMsg(payloadTypeServer.connectProducerTransportResult, "peer transport not found.");
        }

        //producerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await producerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });
        console.log("producerTransport connected.");

        let resultMsg = new ProducerTransportConnectedMsg();
        resultMsg.data.roomId = peer.room.id;
        return resultMsg;
    }

    async onConnectConsumerTransport(peerId: string, msgIn: ConnectConsumerTransportMsg): Promise<IMsg> {
        console.log("onConnectConsumerTransport");

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.connectConsumerTransportResult, "peer not found.");
        }

        if (!peer.room) {
            consoleError("not in a room");
            return new ErrorMsg(payloadTypeServer.connectConsumerTransportResult, "not in a room.");
        }

        let consumerTransport = peer.room.getConsumerTransport(peer);
        if (!consumerTransport) {
            consoleError("consumerTransport not found.");
            return new ErrorMsg(payloadTypeServer.connectConsumerTransportResult, "consumerTransport not found.");
        }

        //consumerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await consumerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });

        let resultMsg = new ConsumerTransportConnectedMsg();
        resultMsg.data.roomId = peer.room.id;
        return resultMsg;
    }

    /***
     * creates a new token, and a roomid for the room
     * the roomid will used later as the room's id
     */
    async onRoomNewToken(peerId: string, msgIn: RoomNewTokenMsg): Promise<RoomNewTokenResultMsg> {
        console.log("onRoomNewToken");

        let peer = this.peers.get(peerId);
        if (!peer) {
            let msg = new RoomNewTokenResultMsg();
            msg.data.error = "invalid peer";
            return msg;
        }

        return await this.onRoomNewTokenMsg(msgIn);
    }

    async onRoomNewTokenMsg(msgIn: RoomNewTokenMsg): Promise<RoomNewTokenResultMsg> {
        console.log("roomNewToken");

        let msg = new RoomNewTokenResultMsg();
        let [payloadRoom, roomToken] = roomUtils.generateRoomToken(this.config.room_secretKey, msgIn.data.expiresInMin);

        if (roomToken) {
            msg.data.roomId = payloadRoom.roomId;
            msg.data.roomToken = roomToken;
        } else {
            msg.data.error = "failed to get token";
        }

        return msg;
    }

    async onAuthUserNewTokenMsg(msgIn: AuthUserNewTokenMsg): Promise<AuthUserNewTokenResultMsg> {
        console.log("onAuthUserNewTokenMsg");

        if (!msgIn.data.role) {
            consoleError(`role is required.`);
            return;
        }

        let msg = new AuthUserNewTokenResultMsg();
        let authToken = roomUtils.generateAuthUserToken(this.config.room_secretKey, msgIn.data.username, msgIn.data.role, msgIn.data.expiresInMin);

        if (authToken) {
            msg.data.authToken = authToken;
            msg.data.expiresIn = msgIn.data.expiresInMin;
        } else {
            msg.data.error = "failed to get token";
        }

        return msg;
    }

    /**
     * client requests to create a room
     * room will be added to the rooms map
     * @param peerId required
     * @param msgIn 
     * @returns 
     */
    async onRoomNew(peerId: string, msgIn: RoomNewMsg): Promise<IMsg> {
        console.log("onRoomNew");

        let peer = this.peers.get(peerId);
        if (!peer) {
            let msg = new RoomNewTokenResultMsg();
            msg.data.error = "invalid peer";
            return msg;
        }

        let roomNewResultMsg = await this.onRoomNewMsg(msgIn);
        return roomNewResultMsg;
    }

    /**
     * app requests a room to be created
     * @param msgIn 
     * @returns 
     */
    async onRoomNewMsg(msgIn: RoomNewMsg) {
        console.log("onRoomNewMsg");

        if (!msgIn.data.roomToken) {
            let errorMsg = new RoomNewResultMsg();
            errorMsg.data.error = "room token is required.";
            return errorMsg;
        }

        let room = await this.createRoom({
            roomId: msgIn.data.roomId,
            roomToken: msgIn.data.roomToken,
            trackingId: msgIn.data.roomTrackingId,
            adminTrackingId: msgIn.data.adminTrackingId,
            roomName: msgIn.data.roomName,
            config: msgIn.data.roomConfig
        });

        if (!room) {
            let errorMsg = new RoomNewResultMsg();
            errorMsg.data.error = "error creating room.";
            return errorMsg;
        }

        let msg = new RoomNewResultMsg();
        msg.data.roomId = room.id;
        msg.data.roomToken = room.roomToken;
        msg.data.roomRtpCapabilities = room.roomRtpCapabilities;

        return msg;
    }

    roomTerminate(room: Room) {
        console.log("roomTerminate()");

        if (!room) {
            consoleError("room is required.");
            return;
        }

        room.close("roomTerminate");
    }

    onRoomTerminate(peerId: string, msg: RoomTerminateMsg): RoomTerminateResultMsg {
        console.log(`onRoomTerminate() - ${msg.data.roomId}`);
        let peer: Peer;

        if (peerId) {
            peer = this.peers.get(peerId);
        }

        if (!peer) {
            let msgError = new RoomTerminateResultMsg();
            msgError.data.error = "invalid peerid";
            return msgError;
        }

        if (!msg.data.roomId) {
            let msgError = new RoomTerminateResultMsg();
            msgError.data.error = "invalid roomId";
            return msgError;
        }

        return this.terminateRoom(msg);
    }

    terminateRoom(msg: RoomTerminateMsg): RoomTerminateResultMsg {
        console.log(`terminateRoom() - ${msg.data.roomId}`);

        const room = this.rooms.get(msg.data.roomId);
        if (!room) {
            let msgError = new RoomTerminateResultMsg();
            msgError.data.roomId = msg.data.roomId;
            msgError.data.error = "unable to terminate room.";

            return msgError;
        }

        let msgBroadCast = new RoomTerminateMsg();
        msgBroadCast.data.roomId = room.id;
        this.broadCastAll(room, msgBroadCast);
        this.roomTerminate(room);

        let msgResult = new RoomTerminateResultMsg();
        msgResult.data.roomId = room.id;

        return msgResult;
    }

    onRoomGetLogsMsg(msg: RoomGetLogsMsg) {

    }

    /**
     * join with an auth token
     * @param token 
     * @param msgIn 
     * @returns 
     */
    async onRoomJoin(peerId: string, msgIn: RoomJoinMsg) {
        console.log("onRoomJoin()");

        let peer: Peer;
        if (peerId) {
            peer = this.peers.get(peerId);
        }

        if (!peer) {
            consoleError(`invalid peerid ${peerId}`);
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "invalid peerid";
            return msgError;
        }

        if (!msgIn.data.roomToken) {
            consoleError(`roomToken required.`);
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "token required";
            return msgError;
        }

        if (!peer) {
            consoleError(`peer not created.`);
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "peer not created";
            return msgError;
        }

        let room: Room = this.rooms.get(msgIn.data.roomId);
        if (room) {
            if (room.addPeer(peer, msgIn.data.roomToken)) {
                console.log(`peer ${peer.id} added to room`);
            } else {
                consoleError(`error: could not add peer ${peer.id} room: ${room.id}`);

            }
        } else {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "room not found";
            return msgError;
        }

        let roomPeer = peer.room.getRoomPeer(peer);
        if (!roomPeer) {
            console.log(`peer not added to room ${peer.id} ${peer.displayName}`);
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "peer not added to room";
            return msgError;
        }

        let joinRoomResult = new RoomJoinResultMsg();
        joinRoomResult.data.roomId = room.id;
        joinRoomResult.data.roomRtpCapabilities = room.roomRtpCapabilities;

        let otherRoomPeers = room.otherRoomPeers(peer.id);
        for (let otherPeer of otherRoomPeers) {
            joinRoomResult.data.peers.push({
                peerId: otherPeer.peer.id,
                peerTrackingId: otherPeer.peer.trackingId,
                displayName: otherPeer.peer.displayName,
                producers: [...otherPeer.producers.values()].map(producer => ({
                    producerId: producer.id,
                    kind: producer.kind
                })),
                trackInfo: otherPeer.peer.tracksInfo                
            });
        }


        //alert the other participants in the room of the peer joining
        let producersInfo = [...roomPeer.producers.values()].map(producer => ({
            producerId: producer.id,
            kind: producer.kind
        }));

        for (let otherPeer of otherRoomPeers) {
            let msg = new RoomNewPeerMsg();
            msg.data.roomId = room.id;
            msg.data.peerId = peer.id;
            msg.data.peerTrackingId = peer.trackingId;
            msg.data.displayName = peer.displayName;
            msg.data.producers = producersInfo;
            msg.data.trackInfo = peer.tracksInfo;
            this.send(otherPeer.peer.id, msg);
        }

        //send back the the peer that joined
        return joinRoomResult;
    }

    async onRoomLeave(peerId: string, msgIn: RoomLeaveMsg): Promise<IMsg> {
        console.log("onRoomLeave");

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.roomLeaveResult, "peer not found.");
        }

        if (!peer.room) {
            consoleError("no room found.");
            return new ErrorMsg(payloadTypeServer.roomLeaveResult, "no room found.");
        }

        let room = peer.room;
        room.removePeer(peer);

        // let msg = new RoomPeerLeftMsg();
        // msg.data = {
        //     peerId: peer.id,
        //     roomId: room.id
        // }
        // this.broadCastAll(room, msg);

        let roomLeaveResult = new RoomLeaveResultMsg();
        roomLeaveResult.data.roomId = room.id;
        return roomLeaveResult;

    }

    private async onRoomProduceStream(peerId: string, msgIn: RoomProduceStreamMsg): Promise<IMsg> {
        console.log("onRoomProduceStream");

        //client is requesting to produce/send audio or video
        //one producer per kind: audio, video, or data

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("error peer not found.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "error peer not found.");
        }

        if (!peer.room) {
            consoleError('peer is not in a room', peer.id);
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "peer is not in a room.");
        }

        if (peer.room.id !== msgIn.data.roomId) {
            consoleError('invalid roomid', msgIn.data.roomId);
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "invalid roomid.");
        }

        //check if peer is authorized to send the stream
        if (peer.role === AuthUserRoles.guest) {
            if (msgIn.data.kind === "video" && peer.room.config.guestsAllowCamera === false) {
                consoleError(`video not allowed for ${peer.id} ${peer.displayName}`);
                return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, `${msgIn.data.kind} not allowed.`);
            } else if (msgIn.data.kind === "audio" && peer.room.config.guestsAllowMic === false) {
                consoleError(`audio not allowed for ${peer.id} ${peer.displayName}`);
                return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, `${msgIn.data.kind} not allowed.`);
            }
        }

        let producer = await peer.room.createProducer(peer, msgIn.data.kind, msgIn.data.rtpParameters);
        if (!producer) {
            consoleError(`producer not created.`);
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, `could not created producer for kind ${msgIn.data.kind}`);
        }

        //alert all peers in the room of new producer
        if (peer.room) {
            let newProducerMsg = new RoomNewProducerMsg();
            newProducerMsg.data = {
                roomId: peer.room.id,
                peerId: peer.id,
                producerId: producer.id,
                kind: producer.kind
            }
            this.broadCastExcept(peer.room, [peer], newProducerMsg)
        }

        let producedMsg = new RoomProduceStreamResultMsg();
        producedMsg.data = {
            roomId: peer.room.id,
            kind: msgIn.data.kind
        };
        return producedMsg;
    }

    private async onRoomCloseProducer(peerId: string, msgIn: RoomCloseProducerMsg): Promise<IMsg> {
        console.log("onRoomCloseProducer");

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("error peer not found.");
            return new ErrorMsg(payloadTypeServer.error, "error peer not found.");
        }

        if (!peer.room) {
            consoleError('peer is not in a room', peer.id);
            return new ErrorMsg(payloadTypeServer.error, "peer is not in a room.");
        }

        if (peer.room.id !== msgIn.data.roomId) {
            consoleError('invalid roomid', msgIn.data.roomId);
            return new ErrorMsg(payloadTypeServer.error, "invalid roomid.");
        }

        for (let kind of msgIn.data.kinds) {
            peer.room.closeProducer(peer, kind);
        }
        return new OkMsg(payloadTypeServer.ok, "producers closed");
    }

    private async onRoomConsumeStream(peerId: string, msgIn: RoomConsumeStreamMsg): Promise<IMsg> {
        console.log("onConsume");
        //client is requesting to consume a producer

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "peer not found.");
        }

        //the peer must be in room to consume streams
        if (!peer.room) {
            consoleError("peer not in room.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "peer not in room.");
        }

        if (peer.room.id !== msgIn.data.roomId) {
            consoleError("invalid roomid");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "invalid room id");
        }

        let room = peer.room;
        let consumeMsg = msgIn;

        if (!consumeMsg.data?.producerId) {
            consoleError("producerId is required.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "producerId is required.");
        }

        if (!consumeMsg.data?.remotePeerId) {
            consoleError("remotePeerId is required.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "remotePeerId is required.");
        }

        if (!consumeMsg.data?.rtpCapabilities) {
            consoleError("rtpCapabilities is required.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "rtpCapabilities is required.");
        }

        //peer wants to consume a remote producer
        //we need remote peerid, producer, and the client's rtpCapabilities      
        //find the remote peer and producer & in the room
        let remotePeer = peer.room.getPeer(consumeMsg.data!.remotePeerId);
        if (!remotePeer) {
            consoleError("remote peer not found.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "remote peer not found.");
        }

        if (peer.room !== remotePeer.room) {
            consoleError("remote peer not in the same room.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "remote peer not in the same room.");
        }

        //consume the producer
        const consumer = await peer.room.createConsumer(peer, remotePeer, msgIn.data.producerId, msgIn.data.rtpCapabilities);
        if (!consumer) {
            consoleError(`could not create consumer.`);
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "could not create consumer.");
            return;
        }

        //send the consumer data back to the client
        let resultMsg = new RoomConsumeStreamResultMsg();
        resultMsg.data = {
            roomId: room.id,
            peerId: remotePeer.id,
            consumerId: consumer.id,
            producerId: msgIn.data.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        };

        return resultMsg;
    }

    /**
     * toggle self only, alert other peers
     */
    private async onPeerTracksInfo(peerId: string, msgIn: PeerTracksInfoMsg): Promise<IMsg> {
        consoleWarn("onPeerTracksInfo", msgIn.data.tracksInfo);

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.error, "peer not found.");
        }

        if (!msgIn.data.tracksInfo) {
            consoleError(`no tracksInfo sent`);
            return new ErrorMsg(payloadTypeServer.error, "`no tracksInfo sent.");
        }

        consoleWarn(`onPeerTracksInfo ${peer.displayName} isAudioEnabled:${peer.tracksInfo.isAudioEnabled}, isVideoEnabled:${peer.tracksInfo.isVideoEnabled}`);
        peer.tracksInfo.isAudioEnabled = !!(msgIn.data.tracksInfo.isAudioEnabled);
        peer.tracksInfo.isVideoEnabled = !!(msgIn.data.tracksInfo.isVideoEnabled);

        //we don't need to pause/resume the producer on the server side, the client will enable/disable the track

        //send to all peers in the room
        if (peer.room) {
            this.broadCastExcept(peer.room, [peer], msgIn);
        }
    }

    /**
     * mute other peers
     * @param peerId 
     * @param msgIn 
     * @returns 
     */
    private async onPeerMuteTracks(peerId: string, msgIn: PeerMuteTracksMsg): Promise<IMsg> {
        consoleWarn("onPeerMuteTracks");

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.error, "peer not found.");
        }

        //the peer must be in room
        if (!peer.room) {
            consoleError("peer not in room.");
            return;
        }

        if (peer.room.id !== msgIn.data.roomId) {
            consoleError("invalid roomid");
            return;
        }

        let remotePeer = peer.room.getPeer(msgIn.data.peerId);
        if (!remotePeer) {
            consoleError("remote peer not found.");
            return;
        }

        if (!msgIn.data.tracksInfo) {
            consoleError(`tracksInfo is null`);
            return;
        }

        consoleLog(`current tracksInfo${remotePeer.displayName} isAudioEnabled: ${remotePeer.tracksInfo.isAudioEnabled} isVideoEnabled: ${remotePeer.tracksInfo.isVideoEnabled}`);
        remotePeer.tracksInfo.isAudioEnabled = !!msgIn.data.tracksInfo.isAudioEnabled;
        remotePeer.tracksInfo.isVideoEnabled = !!msgIn.data.tracksInfo.isVideoEnabled;
        consoleLog(`after tracksInfo${remotePeer.displayName} isAudioEnabled: ${remotePeer.tracksInfo.isAudioEnabled} isVideoEnabled: ${remotePeer.tracksInfo.isVideoEnabled}`);


        await peer.room.muteProducer(remotePeer);

        //send the track state to all peers so they can update their UI
        let msg = new PeerTracksInfoMsg();
        msg.data.peerId = msgIn.data.peerId;
        msg.data.tracksInfo = msgIn.data.tracksInfo;

        //send to all peers in the room, except the sender and the one being muted
        this.broadCastExcept(peer.room, [peer, remotePeer], msg);

        //send the mute message to the remote peer
        this.send(remotePeer.id, msgIn);

    }

    private async onRoomPong(peerId: string, msgIn: RoomPongMsg): Promise<IMsg> {
        consoleWarn("onRoomPong");

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.error, "peer not found.");
        }


        //the peer must be in room
        if (!peer.room) {
            consoleError("peer not in room.");
            return;
        }

        if (peer.room.id !== msgIn.data.roomId) {
            consoleError("invalid roomid");
            return;
        }

        peer.room.pong(peer);

    }

    // async printStats() {
    //     console.log("### STATS ###");
    //     console.log(`### rooms: ${this.rooms.size}, peers: ${this.peers.size} ###`);
    //     for (let [roomid, room] of this.rooms) {
    //         console.log(`##### roomid: ${roomid}, peers: ${room.getPeerCount()}`);
    //         room.getPeers().forEach(p => {
    //             console.log(`##### roomid: ${roomid}, peerid: ${p.id}}, displayName:${p.displayName}`);
    //         });

    //         if (room.roomLogAdapter) {
    //             let logs = await room.roomLogAdapter.get(room.id);
    //             logs.forEach(log => {
    //                 console.log(`####### RoomLog: RoomId: ${log.RoomId}, PeerId: ${log.PeerId}, Action: ${log.Action}, Date: ${log.Date} `);
    //             });
    //         }
    //     }

    //     console.log(`### peers: ${this.peers.size} ###`);
    //     for (let [peerid, peer] of this.peers) {
    //         console.log(`##### peerid: ${peerid}, displayName: ${peer.displayName}, roomName: ${peer.room?.roomName}, isAudioEnabled: ${peer.tracksInfo.isAudioEnabled}, isVideoEnabled: ${peer.tracksInfo.isVideoEnabled}`);
    //     }
    //     console.log("### ##### ###");
    // }

}