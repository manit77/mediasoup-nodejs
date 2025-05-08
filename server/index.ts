import express from 'express';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import * as mediasoup from 'mediasoup';
import fs from 'fs';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

import { Peer, Room } from './room';
import { ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg, payloadTypeClient, payloadTypeServer, ProducedMsg, ProducerTransportCreatedMsg, RegisterResultMsg, RoomJoinResultMsg, RoomNewPeerMsg, RoomNewProducerMsg } from './payloads';
import { randomUUID } from 'crypto';
import { stopRecording } from './recorder';

ffmpeg.setFfmpegPath('./bin/ffmpeg');

const app = express();
app.use(cors());

const certInfo = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
};
const server = https.createServer(certInfo, app);
const wss = new WebSocketServer({ server });

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;

const recordingsDir = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}

const peers = new Map<WebSocket, Peer>();
const rooms = new Map<string, Room>();

async function createMediasoupWorker() {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({
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

async function createTransport() {
  return await router.createWebRtcTransport({
    listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
}

async function send(ws: WebSocket, msg: any) {
  console.log('send ', msg);
  ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {

  let peer: Peer | undefined;

  ws.on('message', async (message) => {
    const { type, data } = JSON.parse(message.toString());

    switch (type) {

      case payloadTypeClient.register:

        //get or set peer
        peer = peers.get(ws);
        if (!peer) {
          peer = new Peer(randomUUID().toString(), ws);
          peers.set(ws, peer);
        }

        let registerResult = new RegisterResultMsg();
        registerResult.data = {
          displayName: "",
          peerid: peer.id,
          rtpCapabilities: router.rtpCapabilities
        };

        send(ws, registerResult);

        break;

      case payloadTypeClient.createProducerTransport:

        //client creates a producer transport
        //one producerTransport for each peer

        peer = peers.get(ws);
        if (!peer) {
          console.error("peer not found.");
          return;
        }

        const transport = await createTransport();
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
        send(ws, producerTransportCreated);


        break;

      case payloadTypeClient.createConsumerTransport:
        //client requests to create a consumer transport to receive data
        //one ConsumerTransport for each peer

        peer = peers.get(ws);
        if (!peer) {
          console.error("peer not found.");
          return;
        }

        //create a consumer transport
        const consumerTransport = await createTransport();
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

        send(ws, consumerTransportCreated);

        break;

      case payloadTypeClient.connectProducerTransport:

        peer = peers.get(ws);

        if (!peer) {
          console.error("peer not found.");
          return;
        }

        if (!peer.producerTransport) {
          console.error("producerTransport not found.");
          return;
        }

        //producerTransport needs dtls params from the client, contains, ports, codecs, etc.

        await peer.producerTransport!.connect({ dtlsParameters: data });
        break;

      case payloadTypeClient.connectConsumerTransport: {

        peer = peers.get(ws);
        if (!peer) {
          console.error("peer not found.");
          return;
        }

        if (!peer.consumerTransport) {
          console.error("consumerTransport not found.");
          return;
        }

        //consumerTransport needs dtls params from the client, contains, ports, codecs, etc.
        await peer.consumerTransport!.connect({ dtlsParameters: data });

        break;
      }

      case payloadTypeClient.roomJoin: {

        peer = peers.get(ws);
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

        //init room
        let roomid: string = data;
        let room = rooms.get(roomid);
        if (!room) {
          room = new Room(randomUUID().toString());
        }

        rooms.set(room.id, room);

        //send join room result back to peer, and the peer's producers in the room 
        let roomJoinResult = new RoomJoinResultMsg();
        for (let remotePeer of room.peers.values()) {
          roomJoinResult.data.peers.push({
            peerId: peer.id,
            producers: remotePeer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
          });
        }

        send(ws, roomJoinResult);

        //add peer to room
        room.addPeer(peer);
        peer.room = room;

        //broadcast to all peers in the room that a new peer has joined
        let roomNewPeer = new RoomNewPeerMsg();
        roomNewPeer.data = {
          peerId: peer.id,
          displayName: "",
          producers: peer.producers.map(producer => ({ producerId: producer.id, kind: producer.kind }))
        }
        room.broadCastExcept(peer!, roomNewPeer);

        break;
      }

      case payloadTypeClient.produce: {

        //client is requesting to produce/send audio or video
        //one producer per kind: audio, video, or data

        peer = peers.get(ws);
        if (!peer) {
          console.error("error peer not found.");
          return;
        }

        if (!peer.room) {
          console.error('peer is not in a room', peer.id);
          break;
        }

        //requires a producerTransport
        if (!peer.producerTransport) {
          console.error('Transport not found for peer', peer.id);
          break;
        }

        //init a producer with rtpParameters
        const producer = await peer.producerTransport.produce({
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        //store the producer 
        peer.producers?.push(producer);

        //send the peer the producer info
        let produced = new ProducedMsg();
        produced.data = {
          kind: data.kind,
          rtpParameters: producer.rtpParameters
        };
        send(ws, produced);

        //alert all peers in the room of new producer
        if (peer.room) {
          let newProducer = new RoomNewProducerMsg();
          newProducer.data = {
            peerId: peer.id,
            producerId: producer.id,
            kind: producer.kind
          }
          peer.room.broadCastExcept(peer, newProducer)
        }

        break;
      }

      case payloadTypeClient.consume:

        //client is requesting to consume a producer

        peer = peers.get(ws);
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

        let consumeMsg = data as ConsumeMsg;

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
          peerId: peer.id,
          consumerId: consumer.id,
          producerId: remoteProducer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        };

        send(ws, consumed);

        break;
    }
  });

  ws.on('close', () => {
    const peer = peers.get(ws);
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

      //delete from peers
      peers.delete(ws);

      peer.room?.removePeer(peer.id);

      console.log(`Peer ${peer.id} disconnected and resources cleaned up`);
    }
  });
});

app.use(express.static('public'));

server.listen(3000, async () => {
  await createMediasoupWorker();
  console.log('Server running at https://localhost:3000');
});