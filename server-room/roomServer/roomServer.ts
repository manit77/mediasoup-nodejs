import * as mediasoup from 'mediasoup';
import fs from 'fs';
import path from 'path';
import { Room } from './room';
import {
    AuthUserNewTokenMsg,
    AuthUserNewTokenResultMsg,
    ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg
    , ConsumerTransportCreatedMsg, CreateProducerTransportMsg, payloadTypeClient
    , ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg, RegisterMsg
    , RegisterResultMsg, RoomConfig, RoomJoinMsg, RoomJoinResultMsg, RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg
    , RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
    RoomTerminateMsg,
    TerminatePeerMsg
} from '../models/roomSharedModels';
import { Peer } from './peer';
import * as roomUtils from "./utils";
import { AuthUserRoles } from '../models/tokenPayloads';

type outMessage = (peerId: string, msg: any) => void;

export class RoomServer {

    private worker: mediasoup.types.Worker;
    private router: mediasoup.types.Router;

    private peers = new Map<string, Peer>();
    private rooms = new Map<string, Room>();

    private outMsgListeners: outMessage[] = [];

    config = {
        recordingsDir: "recordings",
        secretKey: "IFXBhILlrwNGpOLK8XDvvgqrInnU3eZ1", //override with your secret key from a secure location
        room_default_newRoomTokenExpiresInMinutes: 30, //room token expiration from date created
        room_default_maxRoomDurationMinutes: 30, // room max duration, starts when the room is created
        room_default_timeOutNoParticipantsSecs: 5 * 60, //when no participants in the room, timer starts and will close the room
        peer_default_timeOutInactivitySecs : 60

    }

    constructor() {

        this.config.recordingsDir = path.join(process.cwd(), this.config.recordingsDir);

        if (!fs.existsSync(this.config.recordingsDir)) {
            fs.mkdirSync(this.config.recordingsDir);
        }

        this.initMediaSoup();
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

    private async initMediaSoup() {
        console.log(`initMediaSoup`);

        this.worker = await mediasoup.createWorker();
        this.router = await this.worker.createRouter({
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
    }

    async inMessage(peerId: string, msgIn: any): Promise<any> {

        console.log(`inMessage - type: ${msgIn.type}, peerId: ${peerId}`);

        if (!msgIn.type) {
            console.error("message has no type");
        }

        //we need the peerid back to the listner
        if (msgIn.type == payloadTypeClient.register) {
            return this.onRegister(peerId, msgIn);
        }

        switch (msgIn.type) {
            case payloadTypeClient.createProducerTransport:
                this.onCreateProducerTransport(peerId, msgIn);
                break;

            case payloadTypeClient.createConsumerTransport:
                this.onCreateConsumerTransport(peerId, msgIn);
                break;

            case payloadTypeClient.connectProducerTransport:
                this.onConnectProducerTransport(peerId, msgIn);
                break;

            case payloadTypeClient.connectConsumerTransport: {
                this.onConnectConsumerTransport(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomNew: {
                this.onRoomNew(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomTerminate: {
                this.onRoomTerminate(msgIn);
                break;
            }

            case payloadTypeClient.roomJoin: {
                this.onRoomJoin(peerId, msgIn);
                break;
            }

            case payloadTypeClient.roomLeave: {
                this.onRoomLeave(peerId);
                break;
            }

            case payloadTypeClient.terminatePeer: {
                this.onTerminatePeer(msgIn);
                break;
            }

            case payloadTypeClient.roomTerminate: {
                this.onRoomTerminate(msgIn);
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
        return "";
    }

    onTerminatePeer(msg: TerminatePeerMsg) {
        console.log(`onTerminatePeer() ${msg.data.peerId}`);
        const peer = this.peers.get(msg.data.peerId);
        if (peer) {
            this.terminatePeer(peer);
            this.send(peer.id, msg);
            return true;
        }
        return false;
    }

    terminatePeer(peer: Peer) {
        console.log("terminatePeer()");

        if (!peer) {
            console.error("peer is required.");
            return;
        }

        //close producers, consumers
        peer.producers?.forEach((producer) => producer.close());
        peer.consumers?.forEach((consumer) => consumer.close());

        //close transports
        peer.producerTransport?.close();
        peer.consumerTransport?.close();
        peer.producerTransport = null;
        peer.consumerTransport = null;

        if (peer.room) {
            peer.room.removePeer(peer.id);
        }

        //delete from peers
        this.removePeerGlobal(peer);

        console.log(`Peer terminate ${peer.id}.`);
        this.printStats();
    }

    /**
     * creates a transport for the peer, can be a consumer or producer
     * @returns
     */
    private async createTransport() {
        console.log("createTransport()");
        try {
            return await this.router.createWebRtcTransport({
                listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });
        } catch (err) {
            console.error("unable to generate transport.");
            console.error(err);
        }
        return null;
    }

    /**
     * 
     * @param trackingId custom id from a client
     * @returns 
     */
    private createPeer(trackingId: string, authToken: string) {
        console.log("createPeer()");
        let peer = new Peer();
        peer.id = roomUtils.GetPeerId();
        peer.trackingid = trackingId;
        peer.authToken = authToken;

        this.addPeerGlobal(peer);
        peer.restartInactiveTimer();

        peer.onPeerInactive = (peer: Peer) => {
            if (peer.room) {
                console.log("peer was inactive, remove from room.");
                peer.room.removePeer(peer.id);
                peer.restartInactiveTimer();
                return;
            } else {
                console.log("peer was inactive, terminate the peer.");
                this.terminatePeer(peer);
            }
        };

        return peer;
    }

    private createRoom(roomId: string, roomToken: string, config: RoomConfig): Room {

        console.log(`createRoom roomId:${roomId} roomToken: ${roomToken}`);

        if (!roomId) {
            roomId = roomUtils.GetRoomId();
        }

        if (this.rooms.has(roomId)) {
            console.error("room already exists");
            return null;
        }

        if(!roomToken){
            console.error("roomToken is required.");
            return null;
        }

        let payload = roomUtils.validateRoomToken(this.config.secretKey, roomToken);
        if (!payload) {
            console.error("invalid token while creating room.");
            return null;
        }

        let room = new Room();
        room.id = roomId;
        room.roomToken = roomToken;
        room.config = config;

        this.addRoomGlobal(room);

        this.printStats();

        return room;
    }

    private addPeerGlobal(peer: Peer) {
        console.log(`addPeerGlobal ${peer.id}`);
        this.peers.set(peer.id, peer);
    }

    private addRoomGlobal(room: Room) {
        console.log(`addRoomGlobal ${room.id}`);

        room.onClose = (room) => {
            console.log("onClose()");
            this.roomTerminate(room);
        };

        this.rooms.set(room.id, room);

        room.startTimers();
    }

    private removePeerGlobal(peer: Peer) {
        console.log(`removePeerGlobal ${peer.id}`);
        this.peers.delete(peer.id);
    }

    private removeRoomGlobal(room: Room) {
        console.log(`removeRoomGlobal ${room.id}`);
        this.rooms.delete(room.id);
    }

    private async send(peerId: string, msg: any) {
        console.log('send ', msg.type);
        this.outMsgListeners.forEach(event => {
            event(peerId, msg);
        });
    }

    async broadCastExcept(room: Room, except: Peer, msg: any) {
        console.log("broadCastExcept()", except.id);
        for (let peer of room.peers.values()) {
            if (except != peer) {
                this.send(peer.id, msg);
            }
        }
    }

    async broadCastAll(room: Room, msg: any) {
        console.log("broadCastAll()");
        for (let peer of room.peers.values()) {
            this.send(peer.id, msg);
        }
    }

    onRegister(peerId: string, msgIn: RegisterMsg) {
        console.log(`onRegister ${msgIn.data.displayName} `);

        if(!msgIn.data.authToken) {            
            console.error("no authToken");
            return;
        }

        let authTokenPayload = roomUtils.validateAuthUserToken(this.config.secretKey, msgIn.data.authToken);
        if(!authTokenPayload) {
            console.error("invalid user token");
            return;
        }

        //get or set peer
        let peer = this.peers.get(peerId);
        if (!peer) {
            peer = this.createPeer(msgIn.data.trackingId, msgIn.data.authToken);
            console.log("new peer created " + peer.id);
        }        

        let msg = new RegisterResultMsg();
        msg.data = {
            displayName: "",
            peerId: peer.id,
            trackingId: peer.trackingid,
            rtpCapabilities: this.router.rtpCapabilities
        };

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

        peer.restartInactiveTimer();

        const transport = await this.createTransport();
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

        peer.restartInactiveTimer();

        //create a consumer transport
        const consumerTransport = await this.createTransport();
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
    onRoomNewToken(peerId: string, msgIn: RoomNewTokenMsg): RoomNewTokenResultMsg {
        console.log("onRoomNewToken");

        let peer = this.peers.get(peerId);
        if (!peer) {
            let msg = new RoomNewTokenResultMsg();
            msg.data.error = "invalid peer";
            this.send(peerId, msg);
            return;
        }

        peer.restartInactiveTimer();

        let msg = this.roomNewToken(msgIn);

        this.send(peerId, msg);

        return msg;
    }

    roomNewToken(msgIn: RoomNewTokenMsg): RoomNewTokenResultMsg {
        console.log("roomNewToken");

        let msg = new RoomNewTokenResultMsg();
        let [payload, roomToken] = roomUtils.createRoomToken(this.config.secretKey, "", msgIn.data.expiresInMin);

        if (roomToken) {
            msg.data.roomId = payload.roomId;
            msg.data.roomToken = roomToken;
        } else {
            msg.data.error = "failed to get token";
        }

        return msg;
    }

    onAuthUserNewToken(msgIn: AuthUserNewTokenMsg): AuthUserNewTokenResultMsg {
        console.log("roomNewToken");

        let msg = new AuthUserNewTokenResultMsg();
        let authToken = roomUtils.createAuthUserToken(this.config.secretKey, AuthUserRoles.user, msgIn.data.expiresInMin);

        if (authToken) {
            msg.data.authToken = authToken;
        } else {
            msg.data.error = "failed to get token";
        }

        return msg;
    }


    /**
     * app requests to create a new room, room will be added to the rooms map
     * @param peerId 
     * @param msgIn 
     * @returns 
     */
    onRoomNew(peerId: string, msgIn: RoomNewMsg) {
        console.log("onRoomNew");

        let peer = this.peers.get(peerId);
        if (!peer) {
            let msg = new RoomNewTokenResultMsg();
            msg.data.error = "invalid peer";
            this.send(peerId, msg);
            return;
        }

        peer.restartInactiveTimer();

        let roomNewResultMsg = this.onRoomNewNoPeer(msgIn);
        this.send(peerId, roomNewResultMsg);

        return roomNewResultMsg;
    }

    onRoomNewNoPeer(msgIn: RoomNewMsg) {
        console.log("onRoomNewNoPeer");

        if (!msgIn.data.roomToken) {
            let errorMsg = new RoomNewResultMsg();
            errorMsg.data.error = "room token is required.";
            return errorMsg;
        }

        let room = this.createRoom(msgIn.data.roomId, msgIn.data.roomToken, msgIn.data.roomConfig);
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

        for (let [id, peer] of room.peers) {
            //close producers, consumers
            peer.producers?.forEach((producer) => producer.close());
            peer.consumers?.forEach((consumer) => consumer.close());

            //close transports
            peer.producerTransport?.close();
            peer.consumerTransport?.close();

            peer.producerTransport = null;
            peer.consumerTransport = null;

            this.removeRoomGlobal(room);
        }

        room.peers.clear();
    }

    onRoomTerminate(msg: RoomTerminateMsg) {
        const room = this.rooms.get(msg.data.roomId);
        if (room) {

            let msg = new RoomTerminateMsg();
            msg.data.roomId = room.id;
            this.broadCastAll(room, msg);

            this.roomTerminate(room);

            this.printStats();

            return true;
        } else {
            console.log("room not found: " + msg.data.roomId)
        }
        return false;
    }

    /**
     * join with an auth token
     * @param token 
     * @param msgIn 
     * @returns 
     */
    onRoomJoin(peerId: string, msgIn: RoomJoinMsg) {

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

        if (!room.peers.has(peer.id)) {
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

    onRoomLeave(peerId: string) {
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

        this.terminatePeer(peer);

        //broadcast to all peers that the peer has left the room
        let msg = new RoomPeerLeftMsg();
        msg.data = {
            peerId: peer.id,
            trackingId: peer.trackingid,
            roomId: room.id
        }
        this.broadCastAll(room, msg);

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
        let remotePeer = peer.room.peers.get(consumeMsg.data!.remotePeerId);
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
            console.log(`##### roomid: ${roomid}, peers: ${room.peers.size}`);
            room.peers.forEach(p => {
                console.log(`##### roomid: ${roomid}, peerid: ${p.id}}`);
            });
        }
    }

}