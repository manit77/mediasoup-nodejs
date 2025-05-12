import express from 'express';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import * as mediasoup from 'mediasoup';
import fs from 'fs';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

import { Peer, Room } from './room';
import {
    ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg
    , ConsumerTransportCreatedMsg, CreateProducerTransportMsg, payloadTypeClient
    , ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg, RegisterMsg
    , RegisterResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomNewPeerMsg, RoomNewProducerMsg
    , RoomPeerLeftMsg
} from './sharedModels';
import { randomUUID } from 'crypto';
import { stopRecording } from './recorder';


export class RoomServer {

    worker: mediasoup.types.Worker;
    router: mediasoup.types.Router;

    webSocketServer: WebSocketServer;

    peers = new Map<WebSocket, Peer>();
    rooms = new Map<string, Room>();

    
    config = {
        serverPort: 3001,
        recordingsDir : "recordings",
    }

    constructor(private httpServer: https.Server) {

        this.config.recordingsDir = path.join(process.cwd(), this.config.recordingsDir);

        if (!fs.existsSync(this.config.recordingsDir)) {
            fs.mkdirSync(this.config.recordingsDir);
        }
    }

    async start() {
        this.httpServer.listen(this.config.serverPort, async () => {
            console.log(`Server running at https://localhost:${this.config.serverPort}`);

            this.initMediaSoup();
            this.initWebSocket();
        });
    }

    async initMediaSoup() {
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

    async initWebSocket() {

        this.webSocketServer = new WebSocketServer({ server: this.httpServer });
        this.webSocketServer.on('connection', (ws) => {

            console.log("socket connected peers: " + this.peers.size);

            ws.on('message', async (message) => {
                const msgIn = JSON.parse(message.toString());

                console.log("msgIn, ", msgIn);

                if (!msgIn.type) {
                    console.error("message has no type");
                }

                switch (msgIn.type) {

                    case payloadTypeClient.register:
                        this.onRegister(ws, msgIn);
                        break;

                    case payloadTypeClient.createProducerTransport:
                        this.onCreateProducerTransport(ws, msgIn);
                        break;

                    case payloadTypeClient.createConsumerTransport:
                        this.onCreateConsumerTransport(ws, msgIn);
                        break;

                    case payloadTypeClient.connectProducerTransport:
                        this.onConnectProducerTransport(ws, msgIn);
                        break;

                    case payloadTypeClient.connectConsumerTransport: {
                        this.onConnectConsumerTransport(ws, msgIn);
                        break;
                    }

                    case payloadTypeClient.roomJoin: {
                        this.onRoomJoin(ws, msgIn);
                        break;
                    }

                    case payloadTypeClient.roomLeave: {
                        this.onRoomLeave(ws);
                        break;
                    }

                    case payloadTypeClient.produce: {
                        this.onProduce(ws, msgIn);
                        break;
                    }

                    case payloadTypeClient.consume:
                        this.onConsume(ws, msgIn);
                        break;
                }
            });

            ws.on('close', () => {
                const peer = this.peers.get(ws);
                if (peer) {

                    //stop the recording process
                    peer.recordings?.forEach((_, id) => {
                        stopRecording(peer, id);
                    });

                    //close producers, consumers
                    peer.producers?.forEach((producer) => producer.close());
                    peer.consumers?.forEach((consumer) => consumer.close());

                    //close transports
                    peer.producerTransport?.close();
                    peer.consumerTransport?.close();

                   
                    if (peer.room) {
                        this.onRoomLeave(ws)
                    }

                    peer.room = null;
                    //delete from peers
                    this.peers.delete(ws);

                    console.log(`Peer ${peer.id} disconnected and resources cleaned up. peers: ` + this.peers.size + " rooms:" + this.rooms.size);
                }
            });
        });
    }

    async createTransport() {
        return await this.router.createWebRtcTransport({
            listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });
    }

    async send(ws: WebSocket, msg: any) {
        console.log('send ', msg);
        ws.send(JSON.stringify(msg));
    }

    onRegister(ws: WebSocket, msgIn: RegisterMsg) {
        console.log("onRegister " + msgIn.displayName);

        //get or set peer
        let peer = this.peers.get(ws);
        if (!peer) {
            peer = new Peer(randomUUID().toString(), ws);
            this.peers.set(ws, peer);
            console.log("new peer created " + peer.id);
        }

        let msg = new RegisterResultMsg();
        msg.data = {
            displayName: "",
            peerid: peer.id,
            rtpCapabilities: this.router.rtpCapabilities
        };

        this.send(ws, msg);
    }

    async onCreateProducerTransport(ws: WebSocket, msgIn: CreateProducerTransportMsg) {
        let peer = this.peers.get(ws);
        if (!peer) {
            console.error("peer not found.");
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
        this.send(ws, producerTransportCreated);

    }

    async onCreateConsumerTransport(ws: WebSocket, msgIn: CreateProducerTransportMsg) {
        //client requests to create a consumer transport to receive data
        //one ConsumerTransport for each peer

        let peer = this.peers.get(ws);
        if (!peer) {
            console.error("peer not found.");
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

        this.send(ws, consumerTransportCreated);
    }

    async onConnectProducerTransport(ws: WebSocket, msgIn: ConnectProducerTransportMsg) {
        let peer = this.peers.get(ws);

        if (!peer) {
            console.error("peer not found.");
            return;
        }

        if (!peer.producerTransport) {
            console.error("producerTransport not found.");
            return;
        }

        //producerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.producerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });

    }

    async onConnectConsumerTransport(ws: WebSocket, msgIn: ConnectConsumerTransportMsg) {
        let peer = this.peers.get(ws);
        if (!peer) {
            console.error("peer not found.");
            return;
        }

        if (!peer.consumerTransport) {
            console.error("consumerTransport not found.");
            return;
        }

        //consumerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.consumerTransport!.connect({ dtlsParameters: msgIn.data.dtlsParameters });

    }

    async onRoomJoin(ws: WebSocket, msgIn: RoomJoinMsg) {
        let peer = this.peers.get(ws);
        if (!peer) {
            console.error("peer not found.");
            return;
        }

        //client should have already requested transports and connected them
        if (!peer.consumerTransport) {
            console.error("ConsumerTransport not created.");
            return;
        }

        if (!peer.producerTransport) {
            console.error("ProducerTransport not created.");
            return;
        }

        if(peer.room){
            console.error("peer already in a room");
            return;
        }

        //*** this demo allows creating new rooms automatically
        let roomid: string = msgIn.data.roomId;
        if (!roomid) {
            roomid = randomUUID().toString();
            console.log("new room id: " + roomid)
        }

        let room = this.rooms.get(roomid);
        if (!room) {
            room = new Room(roomid);
            console.log("new room created: " + roomid);
            this.rooms.set(room.id, room);
        }

        //send join room result back to peer, and the peer's producers in the room 
        let msg = new RoomJoinResultMsg();
        msg.data = { roomId: roomid, peers: [] };

        for (let remotePeer of room.peers.values()) {
            msg.data.peers.push({
                peerId: remotePeer.id,
                producers: remotePeer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
            });
        }

        this.send(ws, msg);

        //add peer to room
        room.addPeer(peer);
        peer.room = room;

        console.log("peers in room: " + room.peers.size);

        //broadcast to all peers in the room that a new peer has joined
        let roomNewPeer = new RoomNewPeerMsg();
        roomNewPeer.data = {
            peerId: peer.id,
            displayName: "",
            producers: peer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
        }
        room.broadCastExcept(peer!, roomNewPeer);

    }

    async onRoomLeave(ws: WebSocket) {
        console.log("onRoomLeave");

        let peer = this.peers.get(ws);
        if (!peer) {
            console.error("peer not found.");
            return;
        }

        if (!peer.room) {
            console.error("no room found.");
            return;
        }

        peer.room.removePeer(peer.id);

        //broadcast to all peers that the peer has left the room
        let msg = new RoomPeerLeftMsg();
        msg.data = {
            peerId: peer.id,
            roomId: peer.room.id
        }
        peer.room.broadCastExcept(peer!, msg);

        //stop the producers and consumer channels
        peer.producers.map(producer => producer.close());
        peer.producers = [];

        peer.consumers.map(consumer => consumer.close());
        peer.consumers = [];

        if(peer.room.peers.size == 0){
            this.rooms.delete(peer.room.id);
        }
        
        peer.room = null;    

    }

    async onProduce(ws: WebSocket, msgIn: ProduceMsg) {

        //client is requesting to produce/send audio or video
        //one producer per kind: audio, video, or data

        let peer = this.peers.get(ws);
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
        this.send(ws, producedMsg);

        //alert all peers in the room of new producer
        if (peer.room) {
            let newProducerMsg = new RoomNewProducerMsg();
            newProducerMsg.data = {
                peerId: peer.id,
                producerId: producer.id,
                kind: producer.kind
            }
            peer.room.broadCastExcept(peer, newProducerMsg)
        }
    }

    async onConsume(ws: WebSocket, msgIn: ConsumeMsg) {
        //client is requesting to consume a producer

        let peer = this.peers.get(ws);
        if (!peer) {
            console.error("peer not found.");
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
            consumerId: consumer.id,
            producerId: remoteProducer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        };

        this.send(ws, consumed);
    }


}