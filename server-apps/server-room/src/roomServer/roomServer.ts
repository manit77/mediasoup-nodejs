import * as mediasoup from 'mediasoup';
import os from 'os';
import { Room } from './room.js';
import {
    AuthUserNewTokenMsg,
    AuthUserNewTokenResultMsg,
    ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg
    , ConsumerTransportCreatedMsg, CreateProducerTransportMsg, payloadTypeClient
    , PeerTerminatedMsg, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg
    , RegisterPeerMsg, RegisterPeerResultMsg, RoomConfig, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg, RoomLeaveResult, RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg
    , RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
    RoomTerminateMsg,
    RoomTerminateResultMsg,
    TerminatePeerMsg
} from "@rooms/rooms-models";
import { Peer } from './peer.js';
import * as roomUtils from "./utils.js";
import { AuthUserRoles, AuthUserTokenPayload } from '../models/tokenPayloads.js';
import { setTimeout, setInterval } from 'node:timers';

type outMessage = (peerId: string, msg: any) => void;
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

    private outMsgListeners: outMessage[] = [];
    private config: RoomServerConfig;
    private timerIdResourceInterval: any;

    constructor(c: RoomServerConfig) {
        this.config = c;
    }

    dispose() {
        console.log("roomServer dispose()");
        // Wait for initialization to complete to ensure worker and router are set

        clearInterval(this.timerIdResourceInterval);

        this.rooms.forEach(r => {
            r.close();
        });
        this.rooms.clear();

        this.peers.forEach(p => {
            p.close();
        });
        this.peers.clear();

        // Close worker
        for (let i = 0; i < this.workers.length; ++i) {
            let worker = this.workers[i];
            try {
                worker.close();
                console.log(`Worker closed ${worker.pid}`);
            } catch (error) {
                console.error('Error closing worker:', error);
            }
        }

    }

    async initMediaSoup() {
        console.log(`initMediaSoup()`);
        console.log(`cpu count: ${os.cpus().length}`);

        for (let i = 0; i < os.cpus().length; ++i) {
            const worker = await mediasoup.createWorker(
                {
                    dtlsCertificateFile: this.config.cert_file_path,
                    dtlsPrivateKeyFile: this.config.cert_key_path
                });

            worker.on('died', () => {
                console.error(
                    'Worker died, exiting  in 2 seconds... [pid:%d]', worker.pid);

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

    addEventListner(event: outMessage) {
        this.outMsgListeners.push(event);
    }

    removeEventListner(event: outMessage) {
        let idx = this.outMsgListeners.findIndex((f) => f === event);
        if (idx > -1) {
            this.outMsgListeners.splice(idx, 1);
        }
    }

    async inMessage(peerId: string, msgIn: any): Promise<any> {

        console.log(`inMessage - type: ${msgIn.type}, peerId: ${peerId}`);

        if (!msgIn.type) {
            console.error("message has no type");
        }

        //we need the peerid back to the listner
        if (msgIn.type == payloadTypeClient.registerPeer) {
            return this.onRegisterPeer(msgIn);
        }

        switch (msgIn.type) {
            case payloadTypeClient.terminatePeer: {
                this.onTerminatePeer(peerId, msgIn);
                break;
            }
            case payloadTypeClient.roomNewToken: {
                this.onRoomNewToken(peerId, msgIn);
                break;
            }
            case payloadTypeClient.createProducerTransport:
                this.onCreateProducerTransport(peerId, msgIn);
                break;

            case payloadTypeClient.createConsumerTransport:
                this.onCreateConsumerTransport(peerId, msgIn);
                break;

            case payloadTypeClient.connectProducerTransport: {
                this.onConnectProducerTransport(peerId, msgIn);
                break;
            }

            case payloadTypeClient.connectConsumerTransport: {
                this.onConnectConsumerTransport(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomNew: {
                this.onRoomNew(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomTerminate: {
                this.onRoomTerminate(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomJoin: {
                this.onRoomJoin(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomLeave: {
                this.onRoomLeave(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomTerminate: {
                this.onRoomTerminate(peerId, msgIn);
                break;
            }

            case payloadTypeClient.produce: {
                this.onProduce(peerId, msgIn);
                break;
            }

            case payloadTypeClient.consume:
                this.onConsume(peerId, msgIn);
                break;
        }
        return ""; 5
    }

    onTerminatePeer(peerId: string, msg: TerminatePeerMsg) {
        console.log(`onTerminatePeer() $peerId}`);
        const peer = this.peers.get(peerId);
        if (peer) {
            this.closePeer(peer);

            let peerTerminatedMsg = new PeerTerminatedMsg();
            peerTerminatedMsg.data.peerId = msg.data.peerId;

            this.send(peer.id, peerTerminatedMsg);
            return peerTerminatedMsg;
        }
        return null;
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
            console.error("peer is required.");
            return;
        }

        peer.close();

        //delete from peers
        this.removePeerGlobal(peer);

        console.log(`Peer terminate ${peer.id}.`);
        this.printStats();
    }

    /**
     * 
     * @param trackingId custom id from a client
     * @returns 
     */
    private createPeer(authToken: string, displayName: string): Peer {
        console.log("createPeer()");

        let payload: AuthUserTokenPayload = roomUtils.validateAuthUserToken(this.config.room_secretKey, authToken);

        if (!payload) {
            console.error("failed to validate validateAuthUserToken.")
            return null;
        }

        let peer = new Peer();
        peer.id = roomUtils.GetPeerId();
        peer.authToken = authToken;
        peer.displayName = displayName;
        peer.trackingid = payload.trackingId;

        this.addPeerGlobal(peer);
        peer.restartInactiveTimer();

        peer.onInactive = (peer: Peer) => {
            if (peer.room) {
                console.log("peer was inactive, remove from room.");
                peer.room.removePeer(peer.id);
                peer.restartInactiveTimer();
                return;
            } else {
                console.log("peer was inactive, terminate the peer.");
                this.closePeer(peer);
            }
        };

        return peer;
    }

    async createRoom(roomId: string, roomToken: string, config: RoomConfig): Promise<Room> {

        console.log(`createRoom() - roomId:${roomId} roomToken: ${roomToken}`);

        if (!roomId) {
            roomId = roomUtils.GetRoomId();
        }

        if (this.rooms.has(roomId)) {
            console.error("room already exists");
            return null;
        }

        if (!roomToken) {
            console.error("roomToken is required.");
            return null;
        }

        let payload = roomUtils.validateRoomToken(this.config.room_secretKey, roomToken);
        if (!payload) {
            console.error("invalid token while creating room.");
            return null;
        }

        if (roomId != payload.roomId) {
            console.error("invalid roomId.");
            return null;
        }

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

        let room = new Room(router);
        room.id = roomId;
        room.roomToken = roomToken;
        room.config = config;

        room.onClose = (r: Room) => {
            this.removeRoomGlobal(r);
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

    removeRoomGlobal(room: Room) {
        console.log(`removeRoomGlobal() ${room.id}`);
        this.rooms.delete(room.id);
    }

    private async send(peerId: string, msg: any) {
        console.log('send() ', msg.type);
        this.outMsgListeners.forEach(event => {
            event(peerId, msg);
        });
    }

    async broadCastExcept(room: Room, except: Peer, msg: any) {
        console.log("broadCastExcept()", except.id);
        for (let peer of room.getPeers()) {
            if (except != peer) {
                this.send(peer.id, msg);
            }
        }
    }

    broadCastAll(room: Room, msg: any) {
        console.log("broadCastAll()");
        for (let peer of room.getPeers()) {
            this.send(peer.id, msg);
        }
    }

    async onRegisterPeer(msgIn: RegisterPeerMsg) {
        console.log(`onRegister() - ${msgIn.data.displayName}`);

        let peer = this.createPeer(msgIn.data.authToken, msgIn.data.displayName);
        if (!peer) {
            let erroMsg = new RegisterPeerResultMsg();
            erroMsg.data = {
                error: "unable to create peer."
            };
        }

        let msg = new RegisterPeerResultMsg();
        msg.data = {
            peerId: peer.id,
            displayName: msgIn.data.displayName
        };

        //we have to send this back to the listner without a peerId
        this.send(peer.id, msg);

        return msg;
    }

    async onCreateProducerTransport(peerId: string, msgIn: CreateProducerTransportMsg) {
        console.log("onCreateProducerTransport");
        let peer = this.peers.get(peerId);
        if (!peer) {
            console.error("peer not found: " + peerId);
            return;
        }

        if (!peer.room) {
            console.error("peer is not in a room");
            return;
        }


        peer.restartInactiveTimer();

        const transport = await roomUtils.createTransport(peer.room.router);
        peer!.producerTransport = transport;

        let producerTransportCreated = new ProducerTransportCreatedMsg();
        producerTransportCreated.data = {
            iceServers: null,
            iceTransportPolicy: null,
            transportId: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        }
        this.send(peerId, producerTransportCreated);

        return producerTransportCreated;
    }

    async onCreateConsumerTransport(peerId: string, msgIn: CreateProducerTransportMsg) {
        console.log("onCreateConsumerTransport");

        //client requests to create a consumer transport to receive data
        //one ConsumerTransport for each peer

        let peer = this.peers.get(peerId);
        if (!peer) {
            console.error("peer not found: " + peerId);
            return;
        }

        if (!peer.room) {
            console.error("peer is not in a room");
            return;
        }

        peer.restartInactiveTimer();

        //create a consumer transport
        const consumerTransport = await roomUtils.createTransport(peer.room.router);
        peer.consumerTransport = consumerTransport;

        let consumerTransportCreated = new ConsumerTransportCreatedMsg();
        consumerTransportCreated.data = {
            iceServers: null,
            iceTransportPolicy: null,
            transportId: consumerTransport.id,
            iceParameters: consumerTransport.iceParameters,
            iceCandidates: consumerTransport.iceCandidates,
            dtlsParameters: consumerTransport.dtlsParameters,
        }

        this.send(peerId, consumerTransportCreated);

        return consumerTransportCreated;
    }

    async onConnectProducerTransport(peerId: string, msgIn: ConnectProducerTransportMsg) {

        console.log("onConnectProducerTransport");

        let peer = this.peers.get(peerId);

        if (!peer) {
            console.error("peer not found: " + peerId);
            return;
        }

        if (!peer.producerTransport) {
            console.error("producerTransport not found.");
            return;
        }

        peer.restartInactiveTimer();

        //producerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.producerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });

        return true;
    }

    async onConnectConsumerTransport(peerId: string, msgIn: ConnectConsumerTransportMsg) {
        console.log("onConnectConsumerTransport");

        let peer = this.peers.get(peerId);
        if (!peer) {
            console.error("peer not found: " + peerId);
            return;
        }

        if (!peer.consumerTransport) {
            console.error("consumerTransport not found.");
            return;
        }

        peer.restartInactiveTimer();

        //consumerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.consumerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });

        return true;

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
            this.send(peerId, msg);
            return;
        }

        peer.restartInactiveTimer();

        let msg = await this.onRoomNewTokenMsg(msgIn);

        this.send(peerId, msg);

        return msg;
    }

    async onRoomNewTokenMsg(msgIn: RoomNewTokenMsg): Promise<RoomNewTokenResultMsg> {
        console.log("roomNewToken");

        let msg = new RoomNewTokenResultMsg();
        let [payloadRoom, roomToken] = roomUtils.generateRoomToken(this.config.room_secretKey, "", msgIn.data.expiresInMin, msgIn.data.trackingId);

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

        let msg = new AuthUserNewTokenResultMsg();
        let authToken = roomUtils.generateAuthUserToken(this.config.room_secretKey, AuthUserRoles.user, msgIn.data.expiresInMin, msgIn.data.trackingId);

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
    async onRoomNew(peerId: string, msgIn: RoomNewMsg) {
        console.log("onRoomNew");

        let peer = this.peers.get(peerId);
        if (!peer) {
            let msg = new RoomNewTokenResultMsg();
            msg.data.error = "invalid peer";
            this.send(peerId, msg);
            return;
        }

        peer.restartInactiveTimer();

        let roomNewResultMsg = await this.onRoomNewMsg(msgIn);
        this.send(peerId, roomNewResultMsg);

        return roomNewResultMsg;
    }

    /**
     * app requests a room to be created, a peerId is not required
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

        let room = await this.createRoom(msgIn.data.roomId, msgIn.data.roomToken, msgIn.data.roomConfig);
        if (!room) {
            let errorMsg = new RoomNewResultMsg();
            errorMsg.data.error = "error creating room.";
            return errorMsg;
        }

        let roomNewResultMsg = new RoomNewResultMsg();
        roomNewResultMsg.data.roomId = room.id;
        roomNewResultMsg.data.roomToken = room.roomToken;

        return roomNewResultMsg;
    }

    roomTerminate(room: Room) {
        console.log("roomTerminate()");

        if (!room) {
            console.error("room is required.");
            return;
        }

        room.close();
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
            this.send(peerId, msgError);
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
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "invalid peerid";
            this.send(peerId, msgError);
            return msgError;
        }

        if (!msgIn.data.roomToken) {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "token required";
            this.send(peerId, msgError);
            return msgError;
        }


        if (!peer) {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "peer not created";
            this.send(peerId, msgError);
            return msgError;
        }

        let room: Room = this.rooms.get(msgIn.data.roomId);

        if (room) {
            if (room.addPeer(peer, msgIn.data.roomToken)) {
                console.log(`peer ${peer.id} added to room`);
            } else {
                console.log(`error: could not add peer ${peer.id} room: ${room.id}`);
            }
        } else {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "room not found";
            this.send(peerId, msgError);
            return msgError;
        }

        if (!room.getPeer(peer.id)) {
            console.log("peer not added to room");
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "peer not added to room";
            this.send(peerId, msgError);
            return msgError;
        }

        let otherPeers = room.otherPeers(peer.id);
        let joinRoomResult = new RoomJoinResultMsg();
        joinRoomResult.data = { roomId: room.id, peers: [] };

        for (let [, otherPeer] of otherPeers) {
            joinRoomResult.data.peers.push({
                peerId: otherPeer.id,
                trackingId: otherPeer.trackingid,
                producers: otherPeer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
            });
        }

        this.send(peerId, joinRoomResult);

        //alert the other participants
        for (let [, otherPeer] of otherPeers) {
            let msg = new RoomNewPeerMsg();
            msg.data.peerId = peer.id;
            msg.data.displayName = peer.displayName;
            msg.data.trackingId = peer.trackingid;
            msg.data.producers = peer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
            this.send(otherPeer.id, msg);
        }

        this.printStats();

        return joinRoomResult;

    }

    onRoomLeave(peerId: string, msgIn: RoomLeaveMsg) {
        console.log("onRoomLeave");

        let peer = this.peers.get(peerId);
        if (!peer) {
            console.error("peer not found: " + peerId);
            return;
        }

        if (!peer.room) {
            console.error("no room found.");
            return;
        }

        let room = peer.room;


        this.closePeer(peer);


        //broadcast to all peers that the peer has left the room
        let msg = new RoomPeerLeftMsg();
        msg.data = {
            peerId: peer.id,
            trackingId: peer.trackingid,
            roomId: room.id
        }
        this.broadCastAll(room, msg);


        let roomLeaveResult = new RoomLeaveResult();
        roomLeaveResult.data.roomId = room.id;
        this.send(peer.id, roomLeaveResult);

        this.printStats();

        return true;

    }

    private async onProduce(peerId: string, msgIn: ProduceMsg) {
        console.log("onProduce");

        //client is requesting to produce/send audio or video
        //one producer per kind: audio, video, or data

        let peer = this.peers.get(peerId);
        if (!peer) {
            console.error("error peer not found.");
            return;
        }

        if (!peer.room) {
            console.error('peer is not in a room', peer.id);
            return;
        }

        //requires a producerTransport
        if (!peer.producerTransport) {
            console.error('Transport not found for peer', peer.id);
            return;
        }

        //init a producer with rtpParameters
        const producer = await peer.producerTransport.produce({
            kind: msgIn.data.kind,
            rtpParameters: msgIn.data.rtpParameters,
        });

        //store the producer 
        peer.producers?.push(producer);

        //send the client the producer info
        let producedMsg = new ProducedMsg();
        producedMsg.data = {
            kind: msgIn.data.kind
        };
        this.send(peerId, producedMsg);

        //alert all peers in the room of new producer
        if (peer.room) {
            let newProducerMsg = new RoomNewProducerMsg();
            newProducerMsg.data = {
                peerId: peer.id,
                trackingId: peer.trackingid,
                producerId: producer.id,
                kind: producer.kind
            }
            this.broadCastExcept(peer.room, peer, newProducerMsg)
        }

        return true;
    }

    private async onConsume(peerId: string, msgIn: ConsumeMsg) {
        console.log("onConsume");
        //client is requesting to consume a producer

        let peer = this.peers.get(peerId);
        if (!peer) {
            console.error("peer not found: " + peerId);
            return;
        }

        //the peer must have a consumer transport
        if (!peer.consumerTransport) {
            console.error("peer not in room.");
            return;
        }

        //the peer must be in room to consume streams
        if (!peer.room) {
            console.error("peer not in room.");
            return;
        }

        let consumeMsg = msgIn;

        if (!consumeMsg.data?.producerId) {
            console.error("producerId is required.");
            return;
        }

        if (!consumeMsg.data?.remotePeerId) {
            console.error("remotePeerId is required.");
            return;
        }

        if (!consumeMsg.data?.rtpCapabilities) {
            console.error("rtpCapabilities is required.");
            return;
        }

        //we need remote peerid, producer, and the client's rtpCapabilities      
        //find the remote peer and producer & in the room
        let remotePeer = peer.room.getPeer(consumeMsg.data!.remotePeerId);
        if (!remotePeer) {
            console.error("remote peer not found.");
            return;
        }

        let remoteProducer = remotePeer?.producers.find(p => p.id === consumeMsg.data!.producerId);
        if (!remoteProducer) {
            console.log("remote producer not found.");
            return;
        }

        //consume the producer
        const consumer = await peer.consumerTransport.consume({
            producerId: remoteProducer.id,
            rtpCapabilities: consumeMsg.data!.rtpCapabilities,
            paused: false,
        });
        peer.consumers?.push(consumer);

        //send the consumer data back to the client
        let consumed = new ConsumedMsg();
        consumed.data = {
            peerId: remotePeer.id,
            trackingId: remotePeer.trackingid,
            consumerId: consumer.id,
            producerId: remoteProducer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        };

        this.send(peerId, consumed);

        return true;
    }

    printStats() {
        console.log(`### rooms: ${this.rooms.size}, peers: ${this.peers.size} ###`);
        for (let [roomid, room] of this.rooms) {
            console.log(`##### roomid: ${roomid}, peers: ${room.getPeerCount()}`);
            room.getPeers().forEach(p => {
                console.log(`##### roomid: ${roomid}, peerid: ${p.id}}`);
            });
        }
    }

}