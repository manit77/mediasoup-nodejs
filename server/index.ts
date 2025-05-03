import express from 'express';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import * as mediasoup from 'mediasoup';
import fs from "fs";
import cors from "cors";


const app = express();
app.use(cors());

const certInfo = {
  key: fs.readFileSync("./certs/server.key"),
  cert: fs.readFileSync("./certs/server.crt")
};
const server = https.createServer(certInfo, app);
const wss = new WebSocketServer({ server: server });

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;
let transport: mediasoup.types.WebRtcTransport;
let peerid = 1;


async function createMediasoupWorker() {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000
      }
    ]
  });
}

async function createTransport() {
  return await router.createWebRtcTransport({
    listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true
  });
}

async function send(ws: WebSocket, msg: any) {
  console.log("send ", msg);
  ws.send(JSON.stringify(msg));
}

// Add to your peer map
type Peer = {
  transport?: mediasoup.types.WebRtcTransport;
  consumerTransport?: mediasoup.types.WebRtcTransport;
  producers: mediasoup.types.Producer[];
  consumers: mediasoup.types.Consumer[];
  peerId: string
};

const peers = new Map<WebSocket, Peer>();

// In connection handler:
wss.on('connection', (ws) => {

  let peerobj = {
    producers: [],
    consumers: [],
    peerId: peerid.toString()
  };

  peers.set(ws, peerobj);
  send(ws, { action: "register_result", data: peerid });
  peerid++;

  /* -->  getRtpCapabilities
          rtpCapabilities     -->
          existingProducers   -->
      --> createTransport
          transportCreated -->
      --> createConsumerTransport
          consumerTransportCreated -->
      --> connectTransport
          peer.transport?.connect({ dtlsParameters: data });
      --> connectConsumerTransport
          peer.consumerTransport?.connect({ dtlsParameters: data });
      --> produce
          newProducer --> Inform all other peers of this new producer
          produced -->
      --> consume
          consumed -->






  */
  ws.on('message', async (message) => {

    const { action, data } = JSON.parse(message.toString());
    const peer = peers.get(ws);

    if (!peer) {
      console.log("peer not found.")
      return;
    }

    console.log(peer.peerId, "receive ", message);

    switch (action) {
      case 'getRtpCapabilities':

        send(ws, { action: 'rtpCapabilities', data: router.rtpCapabilities });

        break;

      case 'createTransport':
        const transport = await createTransport();
        peer.transport = transport;

        send(ws, {
          action: 'transportCreated',
          data: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          }
        });
        break;

      case 'createConsumerTransport':

        //client creates a consumer, ready to receive streams
        const consumerTransport = await createTransport();
        peer.consumerTransport = consumerTransport;

        //send back to the client consumer transport configs
        send(ws, {
          action: 'consumerTransportCreated',
          data: {
            id: consumerTransport.id,
            iceParameters: consumerTransport.iceParameters,
            iceCandidates: consumerTransport.iceCandidates,
            dtlsParameters: consumerTransport.dtlsParameters
          }
        });

        // existing producers to the client
        const allOtherProducers = [...peers.entries()]
          .filter(([other]) => other !== ws)
          .flatMap(([, p]) => p.producers.map((prod) => ({
            id: prod.id,
            kind: prod.kind
          })));

        if (allOtherProducers) {
          send(ws, {
            action: 'existingProducers',
            data: allOtherProducers
          });

          console.log("send existingProducers ", allOtherProducers);
        }

        break;

      case 'connectTransport':
        await peer.transport?.connect({ dtlsParameters: data });
        break;

      case 'connectConsumerTransport':
        await peer.consumerTransport?.connect({ dtlsParameters: data });
        break;

      case 'produce':
        const producer = await peer.transport?.produce({
          kind: data.kind,
          rtpParameters: data.rtpParameters
        });

        if (producer) {
          peer.producers.push(producer);

          // Inform all other peers of this new producer
          for (const [client, otherPeer] of peers.entries()) {
            if (client !== ws) {
              client.send(JSON.stringify({
                action: 'newProducer',
                data: { id: producer.id, kind: producer.kind }
              }));
            }
          }

          send(ws, { action: 'produced', data: { id: producer.id } });
        }
        break;

      case 'consume':
        const remoteProducer = [...peers.values()]
          .flatMap(p => p.producers)
          .find(p => p.id === data.producerId);

        if (!remoteProducer) {
          console.error("** remoteProducer not found");
        }

        if (!peer.consumerTransport) {
          console.error("** peer.consumerTransport not found");
        }

        if (remoteProducer && peer.consumerTransport) {
          const consumer = await peer.consumerTransport.consume({
            producerId: remoteProducer.id,
            rtpCapabilities: data.rtpCapabilities,
            paused: false
          });

          peer.consumers.push(consumer);

          send(ws, {
            action: 'consumed',
            data: {
              id: consumer.id,
              producerId: remoteProducer.id,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters
            }
          });
        }
        break;
    }
  });

  ws.on('close', () => {
    peers.delete(ws);
  });

});


app.use(express.static('public'));

server.listen(3000, async () => {
  await createMediasoupWorker();
  console.log('Server running at https://localhost:3000');
});
