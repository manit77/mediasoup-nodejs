import * as mediasoup from 'mediasoup';
import fs from 'fs';
import path from 'path';

import { Peer, Room } from './room';
import {
    ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg
    , ConsumerTransportCreatedMsg, CreateProducerTransportMsg, payloadTypeClient
    , ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg, RegisterMsg
    , RegisterResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg
    , RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
    RoomTerminateMsg,
    TerminatePeerMsg
} from './roomSharedModels';
import { randomUUID } from 'crypto';
import * as jwt from './jwtUtil';

type outMessage = (peerId: string, msg: any) => void;

interface TokenPayload {
    peerId?: string;
    roomId?: string;
    maxPeers: number;
    expiresIn: number; // or exp: number, depending on your JWT library
}

export class RoomServer {

    worker: mediasoup.types.Worker;
    router: mediasoup.types.Router;

    peers = new Map<string, Peer>();
    rooms = new Map<string, Room>();

    outMsgListeners: outMessage[] = [];

    config = {
        recordingsDir: "recordings",
        secretKey: "IFXBhILlrwNGpOLK8XDvvgqrInnU3eZ1", //override with your secret key from a secure location
        newRoomTokenExpiresInMinutes: 30
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

        console.log("msgIn, ", msgIn);

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
                return this.onRoomNew(peerId, msgIn);
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
        const peer = this.peers.get(msg.data.peerId);
        if (peer) {

            //close producers, consumers
            peer.producers?.forEach((producer) => producer.close());
            peer.consumers?.forEach((consumer) => consumer.close());

            //close transports
            peer.producerTransport?.close();
            peer.consumerTransport?.close();


            if (peer.room) {
                this.onRoomLeave(peer.id)
            }

            peer.room = null;
            //delete from peers
            this.peers.delete(peer.id);

            console.log(`Peer ${peer.id} disconnected and resources cleaned up. peers: ` + this.peers.size + " rooms:" + this.rooms.size);
            return true;
        }
        return false;
    }


    /**
     * creates a transport for the peer, can be a consumer or producer
     * @returns
     */
    private async createTransport() {
        return await this.router.createWebRtcTransport({
            listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });
    }

    /**
     * 
     * @param trackingId custom id from a client
     * @returns 
     */
    private createPeer(trackingId: string) {
        let peer = new Peer();        
        peer.id = randomUUID().toString();    
        peer.trackingid = trackingId;
        this.peers.set(peer.id, peer);
        return peer;
    }

    private createRoom(roomId: string, roomToken: string, maxPeers: number) {

        if(!roomId) {
            roomId = randomUUID().toString();
        }

        console.log("createRoom");
        let room = new Room(roomId, roomToken, maxPeers);
        console.log("new room created: " + room.id);
        this.rooms.set(room.id, room);
        return room;
    }

    private async send(peerId: string, msg: any) {
        console.log('send ', msg.type);
        this.outMsgListeners.forEach(event => {
            event(peerId, msg);
        });
    }

    async broadCastExcept(room: Room, except: Peer, msg: any) {
        console.log("broadCastExcept ", except.id);
        for (let peer of room.peers.values()) {
            if (except != peer) {
                this.send(peer.id, msg);
            }
        }
    }

    async broadCastAll(room: Room, msg: any) {
        for (let peer of room.peers.values()) {
            this.send(peer.id, msg);
        }
    }

    onRegister(peerId: string, msgIn: RegisterMsg) {
        console.log(`onRegister ${msgIn.data.displayName} `);

        //get or set peer
        let peer = this.peers.get(peerId);
        if (!peer) {
            peer = this.createPeer(msgIn.data.trackingId);
            this.peers.set(peer.id, peer);
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

        //consumerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.consumerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });

        return true;

    }

    /***
     * creates a new token, and a roomid for the room
     * the roomid will used later as the room's id
     */
    onRoomNewToken(peerId: string, msgIn: RoomNewTokenMsg): RoomNewTokenResultMsg {
        let payload: TokenPayload = {
            roomId: randomUUID().toString(),
            peerId: peerId ?? "",
            expiresIn: Math.floor(Date.now() / 1000) + (this.config.newRoomTokenExpiresInMinutes * 60),
            maxPeers: msgIn.data.maxPeers
        };

        let msg = new RoomNewTokenResultMsg();
        let roomToken = jwt.jwtSign(this.config.secretKey, payload);
        if (roomToken) {
            msg.data.roomId = payload.roomId;
            msg.data.roomToken = roomToken;
        } else {
            msg.data.error = "failed to get token";
        }

        this.send(peerId, msg);

        return msg;
    }

    /**
     * app requests to create a new room
     * @param peerId 
     * @param msgIn 
     * @returns 
     */
    private onRoomNew(peerId: string, msgIn: RoomNewMsg) {
        console.log("onRoomNew");

        let maxPeers = 2;
        if (msgIn.data.maxPeers) {
            maxPeers = msgIn.data.maxPeers;
        }

        let room = this.createRoom("", msgIn.data.peerId, maxPeers);

        let payload = {
            roomId: room.id,
            expiresIn: Math.floor(Date.now() / 1000) + (this.config.newRoomTokenExpiresInMinutes * 60)
        };

        console.log("expiresIn:", new Date(payload.expiresIn * 1000));

        let msg = new RoomNewResultMsg();
        msg.data.roomId = room.id;
        msg.data.roomToken = jwt.jwtSign(this.config.secretKey, payload);

        this.send(peerId, msgIn);

        return msg;
    }

    validateRoomToken(token: string): boolean {
        try {
            // Verify and decode the token
            const payload = jwt.jwtVerify(token, this.config.secretKey) as TokenPayload;

            // Check if roomId exists in the payload
            if (!payload.roomId) {
                return false;
            }

            // Check if the room exists in the rooms Map
            if (!this.rooms.has(payload.roomId)) {
                return false;
            }

            // Check expiration (if expiresIn or exp is used)
            const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
            if (payload.expiresIn && payload.expiresIn < currentTime) {
                return false;
            }

            // Token is valid
            return true;
        } catch (error) {
            // Handle JWT verification errors (e.g., invalid signature, malformed token)
            console.error(error);
        }

        return false;
    }

    onRoomTerminate(msg: RoomTerminateMsg) {
        const room = this.rooms.get(msg.data.roomId);
        if (room) {

            let msg = new RoomTerminateMsg();
            msg.data.roomId = room.id;

            for (let [id, peer] of room.peers) {
                //close producers, consumers
                peer.producers?.forEach((producer) => producer.close());
                peer.consumers?.forEach((consumer) => consumer.close());

                //close transports
                peer.producerTransport?.close();
                peer.consumerTransport?.close();

                peer.room = null;

                this.peers.delete(peer.id);
                this.rooms.delete(room.id);

                //alert all peers the room is terminated                
                this.send(peer.id, msg);

                console.log(`Peer ${peer.id} disconnected and resources cleaned up. peers: ` + this.peers.size + " rooms:" + this.rooms.size);
            }

            return true;
        }
        return false;
    }

    /**
     * joins or creates a room, expects a peer already created
     * @param peerId 
     * @param msgIn 
     * @returns 
     */
    onRoomJoin(peerId: string, msgIn: RoomJoinMsg) {
        console.log("onRoomJoin " + peerId);
        
        let errorMsg = new RoomJoinResultMsg();

        let peer = this.peers.get(peerId);
        if (!peer) {
            console.error("peer not found: " + peerId);
            errorMsg.data.error = "peer not found.";
            return errorMsg;
        }
       
        if (peer.room) {
            console.error("peer already in a room");
            errorMsg.data.error = "peer already in a room.";
            return errorMsg;
        }
        let room : Room;
        if(msgIn.data.roomId) {
            room = this.rooms.get(msgIn.data.roomId);
        }
        
        if (!room) {
            room = this.createRoom("", msgIn.data.roomToken ?? "", msgIn.data.maxPeers ?? 2);
            console.log("new room created: " + room.id);
            this.rooms.set(room.id, room);
        }

        //send join room result back to peer, and the peer's producers in the room 
        let joinRoomResult = new RoomJoinResultMsg();
        joinRoomResult.data = { roomId: room.id, peers: [] };

        for (let remotePeer of room.peers.values()) {
            joinRoomResult.data.peers.push({
                peerId: remotePeer.id,
                trackingId: remotePeer.trackingid,
                producers: remotePeer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
            });
        }

        this.send(peerId, joinRoomResult);

        //add peer to room
        if(!room.addPeer(peer, msgIn.data.roomToken)){            
            errorMsg.data.error = "unable to join room.";
            return errorMsg;
        }    

        console.log("peers in room: " + room.peers.size);

        //broadcast to all peers in the room that a new peer has joined
        let roomNewPeerMsg = new RoomNewPeerMsg();
        roomNewPeerMsg.data = {
            peerId: peer.id,
            trackingId: peer.trackingid,
            displayName: "",
            producers: peer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
        }
        this.broadCastExcept(room, peer, roomNewPeerMsg);

        return joinRoomResult;

    }

    /**
     * join with an auth token
     * @param token 
     * @param msgIn 
     * @returns 
     */
    onRoomJoinToken(peerId: string, msgIn: RoomJoinMsg) {

        let peer: Peer;

        if (peerId) {
            peer = this.peers.get(peerId);
        }

        if (!peer) {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "invalid peerid";
            return msgError;
        }
        
        if (!msgIn.data.roomToken) {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "token required";
            return msgError;
        }

        let payload = jwt.jwtVerify(this.config.secretKey, msgIn.data.roomToken) as TokenPayload;
        if (!payload) {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "invalidate token";
            return msgError;
        }

        if(!peer) {
            let msgError = new RoomJoinResultMsg();
            msgError.data.error = "peer not created";
            return msgError;            
        }


        let room: Room;
        for (let r of this.rooms.values()) {
            if (r.roomToken === msgIn.data.roomToken) {
                room = r;
                break;
            }
        }

        if (!room) {
            //create new room, the payload contains the already generated roomid
            room = this.createRoom(payload.roomId, msgIn.data.roomToken, payload.maxPeers);
            room.addPeer(peer, msgIn.data.roomToken);
        }

        let joinRoomResult = new RoomJoinResultMsg();
        joinRoomResult.data = { roomId: room.id, peers: [] };

        for (let remotePeer of room.peers.values()) {
            joinRoomResult.data.peers.push({
                peerId: remotePeer.id,
                trackingId: remotePeer.trackingid,
                producers: remotePeer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
            });
        }

        this.send(peerId, joinRoomResult);

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
        peer.room.removePeer(peer.id);

        //broadcast to all peers that the peer has left the room
        let msg = new RoomPeerLeftMsg();
        msg.data = {
            peerId: peer.id,
            trackingId: peer.trackingid,
            roomId: room.id
        }
        this.broadCastAll(room, msg);

        //stop the producers and consumer channels
        peer.producers.map(producer => producer.close());
        peer.producers = [];

        peer.consumers.map(consumer => consumer.close());
        peer.consumers = [];

        if (room.peers.size == 0) {
            this.rooms.delete(room.id);
        }
        
        return true;

    }

    async onProduce(peerId: string, msgIn: ProduceMsg) {
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

    async onConsume(peerId: string, msgIn: ConsumeMsg) {
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

}