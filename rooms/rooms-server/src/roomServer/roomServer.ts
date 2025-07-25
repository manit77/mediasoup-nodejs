import * as mediasoup from 'mediasoup';
import os from 'os';
import { Room } from './room.js';
import {
    AuthUserNewTokenMsg,
    AuthUserNewTokenResultMsg,
    ConnectConsumerTransportMsg, ConnectProducerTransportMsg,
    ConsumerTransportConnectedMsg, ConsumerTransportCreatedMsg, CreateProducerTransportMsg, ErrorMsg, IMsg, OkMsg, payloadTypeClient,
    PeerTerminatedMsg, ProducerTransportConnectedMsg, ProducerTransportCreatedMsg,
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
    PeerMuteTracksMsg
} from "@rooms/rooms-models";
import { Peer } from './peer.js';
import * as roomUtils from "./utils.js";
import { AuthUserTokenPayload } from '../models/tokenPayloads.js';
import { setTimeout, setInterval } from 'node:timers';
import { RoomLogAdapterInMemory } from './roomLogsAdapter.js';
import { consoleError, consoleLog, consoleWarn } from '../utils/utils.js';
import chalk from 'chalk';

type outMessageEventListener = (peerId: string, msg: any) => void;

export interface RoomServerConfig {
    room_server_ip: string,
    room_server_port: number,
    room_recordingsDir: string,
    room_secretKey: string,
    room_newRoomTokenExpiresInMinutes: number,
    room_maxRoomDurationMinutes: number,
    room_timeOutNoParticipantsSecs: number,
    room_peer_timeOutInactivitySecs: number,
    cert_file_path: string,
    cert_key_path: string
}

export class RoomServer {

    nextWorkerIdx = 0;
    private workers: mediasoup.types.Worker[] = [];

    private peers = new Map<string, Peer>();
    private rooms = new Map<string, Room>();

    private eventListeners: outMessageEventListener[] = [];
    private config: RoomServerConfig;
    private timerIdResourceInterval: any;
    private roomLogAdapter = new RoomLogAdapterInMemory();

    constructor(c: RoomServerConfig) {
        this.config = c;
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

        for (let i = 0; i < os.cpus().length; ++i) {
            const worker = await mediasoup.createWorker(
                {
                    dtlsCertificateFile: this.config.cert_file_path,
                    dtlsPrivateKeyFile: this.config.cert_key_path
                });

            worker.on('died', () => {
                consoleError('Worker died, exiting  in 2 seconds... [pid:%d]', worker.pid);

                setTimeout(() => process.exit(1), 2000);
            });

            this.workers.push(worker);

            // this causes an issue with terminating the worker
            // this.timerIdResourceInterval = setInterval(async () => {
            //     const usage = await worker.getResourceUsage();

            //     console.info('Worker resource usage [pid:%d]: %o', worker.pid, usage);

            //     const dump = await worker.dump();

            //     console.info('Worker dump [pid:%d]: %o', worker.pid, dump);
            // }, 30000);
        }
    }

    getNextWorker() {
        const worker = this.workers[this.nextWorkerIdx];
        if (++this.nextWorkerIdx === this.workers.length) {
            this.nextWorkerIdx = 0;
        }
        return worker;
    }

    addEventListener(eventListener: outMessageEventListener) {
        this.eventListeners.push(eventListener);
    }

    removeEventListener(eventListener: outMessageEventListener) {
        let idx = this.eventListeners.findIndex((l) => l === eventListener);
        if (idx > -1) {
            this.eventListeners.splice(idx, 1);
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
            case payloadTypeClient.roomTerminate: {
                return this.onRoomTerminate(peerId, msgIn);
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
            case payloadTypeClient.roomConsumeStream: {
                return this.onRoomConsumeStream(peerId, msgIn);
            }
            case payloadTypeClient.peerTracksInfo: {
                return this.onPeerTracksInfo(peerId, msgIn);
            }
            case payloadTypeClient.peerMuteTracks: {
                return this.onPeerMuteTracks(peerId, msgIn);
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
        console.log("closePeer()");

        if (!peer) {
            consoleError("peer is required.");
            return;
        }

        peer.close();

        //delete from peers
        this.removePeerGlobal(peer);

        console.log(`Peer terminate ${peer.id}.`);
        this.printStats();
    }

    /**
     * creates a new peer and adds it the peers map
     * @param trackingId custom id from a client
     * @returns 
     */
    private createPeer(authToken: string, trackingId: string, displayName: string): Peer {
        console.log(`createPeer() - trackingId: ${trackingId}, displayName: ${displayName}`);

        let payload: AuthUserTokenPayload = roomUtils.validateAuthUserToken(this.config.room_secretKey, authToken);

        if (!payload) {
            consoleError("failed to validate validateAuthUserToken.")
            return null;
        }

        let peer = new Peer();
        peer.id = roomUtils.GetPeerId();
        peer.authToken = authToken;
        peer.displayName = displayName;
        peer.trackingId = trackingId;

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

        console.log("router created");

        let room = new Room();
        room.roomLogAdapter = this.roomLogAdapter;
        room.id = args.roomId;
        room.roomToken = args.roomToken;
        room.trackingId = args.trackingId;
        room.config = args.config;
        room.adminTrackingId = args.adminTrackingId;
        room.roomName = args.roomName;

        let worker = this.getNextWorker();

        let router = await worker.createRouter({
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

            //broad cast to all peers in the room the the peer has left the room
            let msg = new RoomPeerLeftMsg();
            msg.data.roomId = r.id;
            msg.data.peerId = peer.id;

            let peers = r.getPeers();
            for (let p of peers) {
                this.send(p.id, msg);
            }

        };

        this.addRoomGlobal(room);

        this.printStats();

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
        this.printStats();
        this.rooms.delete(room.id);
    }

    private send(peerId: string, msg: IMsg) {
        let peer = this.getPeer(peerId);
        console.log(`send() - to: ${peer.displayName} `, msg.type);
        for (let eventListener of this.eventListeners) {
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

        //get peer by trackingId
        let peer = [...this.peers.values()].find(p => p.trackingId === msgIn.data.peerTrackingId);
        if (peer) {
            consoleWarn(`peer already exists by trackingId ${peer.trackingId}, ${peer.displayName}, ${peer.id}`);
            let msg = new RegisterPeerResultMsg();
            msg.data = {
                peerId: peer.id,
                displayName: msgIn.data.displayName,
            };
            return msg;
        }

        peer = this.createPeer(msgIn.data.authToken, msgIn.data.peerTrackingId, msgIn.data.displayName);
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

        this.printStats();

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

        await peer!.createProducerTransport();

        let producerTransportCreated = new ProducerTransportCreatedMsg();
        producerTransportCreated.data = {
            roomId: peer.room.id,
            iceServers: null,
            iceTransportPolicy: null,
            transportId: peer.producerTransport.id,
            iceParameters: peer.producerTransport.iceParameters,
            iceCandidates: peer.producerTransport.iceCandidates,
            dtlsParameters: peer.producerTransport.dtlsParameters,
        }

        return producerTransportCreated;
    }

    async onCreateConsumerTransport(peerId: string, msgIn: CreateProducerTransportMsg): Promise<IMsg> {
        console.log("onCreateConsumerTransport");

        //client requests to create a consumer transport to receive data
        //one ConsumerTransport for each peer

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.createProducerTransportResult, "peer not found.");
        }

        if (!peer.room) {
            consoleError("peer is not in a room");
            return new ErrorMsg(payloadTypeServer.createProducerTransportResult, "peer is not in a room");
        }

        await peer.createConsumerTransport();

        let consumerTransportCreated = new ConsumerTransportCreatedMsg();
        consumerTransportCreated.data = {
            roomId: peer.room.id,
            iceServers: null,
            iceTransportPolicy: null,
            transportId: peer.consumerTransport.id,
            iceParameters: peer.consumerTransport.iceParameters,
            iceCandidates: peer.consumerTransport.iceCandidates,
            dtlsParameters: peer.consumerTransport.dtlsParameters,
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

        if (!peer.producerTransport) {
            consoleError("producerTransport not found.");
            return new ErrorMsg(payloadTypeServer.connectProducerTransportResult, "peer is not in a room");
        }

        //producerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.producerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });
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

        if (!peer.consumerTransport) {
            consoleError("consumerTransport not found.");
            return new ErrorMsg(payloadTypeServer.connectConsumerTransportResult, "consumerTransport not found.");
        }

        //consumerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.consumerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });

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
        let authToken = roomUtils.generateAuthUserToken(this.config.room_secretKey, msgIn.data.role, msgIn.data.expiresInMin);

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

        return this.onRoomTerminateMsg(msg);
    }

    onRoomTerminateMsg(msg: RoomTerminateMsg): RoomTerminateResultMsg {
        console.log(`onRoomTerminate() - ${msg.data.roomId}`);

        const room = this.rooms.get(msg.data.roomId);
        if (room) {

            let msg = new RoomTerminateMsg();
            msg.data.roomId = room.id;
            this.broadCastAll(room, msg);

            this.roomTerminate(room);

            this.printStats();

            let msgResult = new RoomTerminateResultMsg();
            msgResult.data.roomId = room.id;

            return msgResult;
        } else {
            console.log("room not found: " + msg.data.roomId)
        }

        let msgError = new RoomTerminateResultMsg();
        msgError.data.roomId = room.id;
        msgError.data.error = "unable to terminate room.";

        return msgError;
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

        if (!room.getPeer(peer.id)) {
            console.log("peer not added to room");
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "peer not added to room";
            return msgError;
        }

        let joinRoomResult = new RoomJoinResultMsg();
        joinRoomResult.data.roomId = room.id;

        let otherPeers = room.otherPeers(peer.id);
        for (let [, otherPeer] of otherPeers) {
            joinRoomResult.data.peers.push({
                peerId: otherPeer.id,
                peerTrackingId: otherPeer.trackingId,
                displayName: otherPeer.displayName,
                producers: [...otherPeer.producers.values()].map(producer => ({
                    producerId: producer.id,
                    kind: producer.kind
                })),
                trackInfo: otherPeer.trackInfo
            });
        }
        
        //alert the other participants in the room of the peer joining
        for (let [, otherPeer] of otherPeers) {
            let msg = new RoomNewPeerMsg();
            msg.data.roomId = room.id;
            msg.data.peerId = peer.id;
            msg.data.peerTrackingId = peer.trackingId;
            msg.data.displayName = peer.displayName;
            msg.data.producers = [...peer.producers.values()].map(producer => ({
                producerId: producer.id,
                kind: producer.kind
            }));
            msg.data.trackInfo = peer.trackInfo
            this.send(otherPeer.id, msg);
        }

        this.printStats();

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
        //peer.close will broadcast to all peers that the peer has left the room, see onPeerRemovedEvent
        peer.close();

        // let msg = new RoomPeerLeftMsg();
        // msg.data = {
        //     peerId: peer.id,
        //     roomId: room.id
        // }
        // this.broadCastAll(room, msg);
        this.printStats();

        let roomLeaveResult = new RoomLeaveResultMsg();
        roomLeaveResult.data.roomId = room.id;
        return roomLeaveResult;

    }

    private async onRoomProduceStream(peerId: string, msgIn: RoomProduceStreamMsg): Promise<IMsg> {
        console.log("onProduce");

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

        //requires a producerTransport
        if (!peer.producerTransport) {
            consoleError('Transport not found for peer', peer.id);
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "transport not found for peer.");
        }

        let room = peer.room;
        //init a producer with rtpParameters
        const producer = await peer.producerTransport.produce({
            kind: msgIn.data.kind,
            rtpParameters: msgIn.data.rtpParameters,
        });

        //store the producer 
        peer.addProducer(producer);


        //alert all peers in the room of new producer
        if (peer.room) {
            let newProducerMsg = new RoomNewProducerMsg();
            newProducerMsg.data = {
                roomId: room.id,
                peerId: peer.id,
                producerId: producer.id,
                kind: producer.kind
            }
            this.broadCastExcept(peer.room, [peer], newProducerMsg)
        }

        let producedMsg = new RoomProduceStreamResultMsg();
        producedMsg.data = {
            roomId: room.id,
            kind: msgIn.data.kind
        };
        return producedMsg;
    }

    private async onRoomConsumeStream(peerId: string, msgIn: RoomConsumeStreamMsg): Promise<IMsg> {
        console.log("onConsume");
        //client is requesting to consume a producer

        let peer = this.peers.get(peerId);
        if (!peer) {
            consoleError("peer not found: " + peerId);
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "peer not found.");
        }

        //the peer must have a consumer transport
        if (!peer.consumerTransport) {
            consoleError("no consumer transport for the peer");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "no consumer transport for the peer");
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

        //we need remote peerid, producer, and the client's rtpCapabilities      
        //find the remote peer and producer & in the room
        let remotePeer = peer.room.getPeer(consumeMsg.data!.remotePeerId);
        if (!remotePeer) {
            consoleError("remote peer not found.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "remote peer not found.");
        }

        let remoteProducer = remotePeer?.producers.get(consumeMsg.data!.producerId);
        if (!remoteProducer) {
            console.log("remote producer not found.");
            return new ErrorMsg(payloadTypeServer.roomConsumeStreamResult, "remote producer not found.");
        }

        //consume the producer
        const consumer = await peer.consumerTransport.consume({
            producerId: remoteProducer.id,
            rtpCapabilities: consumeMsg.data!.rtpCapabilities,
            paused: false,
        });
        peer.addConsumer(consumer);

        //send the consumer data back to the client
        let resultMsg = new RoomConsumeStreamResultMsg();
        resultMsg.data = {
            roomId: room.id,
            peerId: remotePeer.id,
            consumerId: consumer.id,
            producerId: remoteProducer.id,
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

        peer.trackInfo = msgIn.data.tracksInfo;
        //we don't need to pause/resume the producer on the server side, the client will enable/disable the track

        //send to all peers in the room
        if(peer.room) {
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

        //the peer must have a producerTransport
        if (!peer.producerTransport) {
            consoleError("no producerTransport for the peer");
            return;
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


        consoleWarn(`updating ${peer.displayName} ${peer.id}`);
        for (const p of peer.producers.values()) {
            consoleWarn(`producer state: ${p.id} ${p.kind} ${p.paused}`);
        }
        remotePeer.trackInfo = msgIn.data.tracksInfo;

        //the peer has mute/unmute a remotePeer
        for (let producer of remotePeer.producers.values()) {

            let trackEnabled = producer.kind == "audio" ? peer.trackInfo.isAudioEnabled : peer.trackInfo.isVideoEnabled;

            //toggle the producer track
            if (trackEnabled && producer.paused) {
                await producer.resume();
                consoleWarn(`${remotePeer.displayName}:Producer ${producer.id} ${producer.kind} resumed.`);
            } else if (!trackEnabled && !producer.paused) {
                await producer.pause();
                consoleWarn(`${remotePeer.displayName}:Producer ${producer.id} ${producer.kind} paused.`);
            }
        }

        //send the track state to all peers so they can update their UI
        let msg = new PeerTracksInfoMsg();
        msg.data.peerId = msgIn.data.peerId;
        msg.data.tracksInfo = msgIn.data.tracksInfo;

        //send to all peers in the room, except the sender and the one being muted
        this.broadCastExcept(peer.room, [peer, remotePeer], msg);

        //send the mute message to the remote peer
        this.send(remotePeer.id, msgIn);

    }

    async printStats() {
        console.log("### STATS ###");
        console.log(`### rooms: ${this.rooms.size}, peers: ${this.peers.size} ###`);
        for (let [roomid, room] of this.rooms) {
            console.log(`##### roomid: ${roomid}, peers: ${room.getPeerCount()}`);
            room.getPeers().forEach(p => {
                console.log(`##### roomid: ${roomid}, peerid: ${p.id}}, displayName:${p.displayName}`);
            });

            if (room.roomLogAdapter) {
                let logs = await room.roomLogAdapter.get(room.id);
                logs.forEach(log => {
                    console.log(`####### RoomLog: RoomId: ${log.RoomId}, PeerId: ${log.PeerId}, Action: ${log.Action}, Date: ${log.Date} `);
                });
            }
        }

        console.log(`### peers: ${this.peers.size} ###`);
        for (let [peerid, peer] of this.peers) {
            console.log(`##### peerid: ${peerid}, displayName: ${peer.displayName}, roomid: ${peer.room?.id}`);
        }
        console.log("### ##### ###");
    }

}