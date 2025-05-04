import express from 'express';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import * as mediasoup from 'mediasoup';
import fs from 'fs';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg'; // Added for FFmpeg integration
import path from 'path'; // Added for file path handling
import dgram from 'dgram';

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
let peerid = 1;

// Directory to store recordings
const recordingsDir = path.join(process.cwd(), 'recordings');
// Ensure recordings directory exists
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}

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

type Peer = {
  transport?: mediasoup.types.WebRtcTransport;
  consumerTransport?: mediasoup.types.WebRtcTransport;
  producers: mediasoup.types.Producer[];
  consumers: mediasoup.types.Consumer[];
  peerId: string;
  recordings: Map<string, any>; // Added to track FFmpeg processes for each producer
};

const peers = new Map<WebSocket, Peer>();

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.bind(0, () => {
      const address = socket.address();
      socket.close();
      if (typeof address === 'object') {
        resolve(address.port);
      } else {
        reject(new Error('Failed to get a free port'));
      }
    });
  });
}

async function startRecording(peer: Peer, router: mediasoup.types.Router) {
  const audioProducer = peer.producers.find((p) => p.kind === 'audio');
  const videoProducer = peer.producers.find((p) => p.kind === 'video');
  if (!audioProducer || !videoProducer) {
    console.warn(`Missing audio or video producer for peer ${peer.peerId}`);
    return;
  }

  // Get two free ports for audio and video
  const audioPort = await getFreePort();
  const videoPort = await getFreePort();
  const audioRtcpPort = audioPort + 1; // RTCP port is typically the next one
  const videoRtcpPort = videoPort + 1;

  // Create PlainTransports for audio and video
  const audioTransport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' },
    rtcpMux: false, // Explicit RTCP port
    comedia: false, // Disable comedia for explicit port control
  });

  const videoTransport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' },
    rtcpMux: false,
    comedia: false,
  });

  // Connect transports to specific ports
  await audioTransport.connect({ ip: '127.0.0.1', port: audioPort, rtcpPort: audioRtcpPort });
  await videoTransport.connect({ ip: '127.0.0.1', port: videoPort, rtcpPort: videoRtcpPort });

  // Create consumers
  const audioConsumer = await audioTransport.consume({
    producerId: audioProducer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: false,
  });

  const videoConsumer = await videoTransport.consume({
    producerId: videoProducer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: false,
  });

  await videoConsumer.requestKeyFrame();

  // Log consumer stats to verify data flow
  // setInterval(async () => {
  //   const audioStats = await audioConsumer.getStats();
  //   const videoStats = await videoConsumer.getStats();
  //   console.log(`Audio consumer stats:`, audioStats);
  //   console.log(`Video consumer stats:`, videoStats);
  // }, 5000);

  // Get codec information
  const audioCodec = audioConsumer.rtpParameters.codecs[0];
  const videoCodec = videoConsumer.rtpParameters.codecs[0];
  const audioPt = audioCodec.payloadType;
  const videoPt = videoCodec.payloadType;

  // Build SDP with detailed attributes
  const sdpContent = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=MediaSoup Recording
c=IN IP4 127.0.0.1
t=0 0
m=audio ${audioPort} RTP/AVP ${audioPt}
a=rtpmap:${audioPt} opus/48000/2
a=fmtp:${audioPt} useinbandfec=1
a=rtcp:${audioRtcpPort}
a=recvonly
m=video ${videoPort} RTP/AVP ${videoPt}
a=rtpmap:${videoPt} VP8/90000
a=rtcp:${videoRtcpPort}
a=recvonly
`.trim();

  // Write SDP file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sdpPath = path.join(recordingsDir, `peer-${peer.peerId}-${timestamp}.sdp`);
  const filename = path.join(recordingsDir, `peer-${peer.peerId}-${timestamp}.webm`);
  fs.writeFileSync(sdpPath, sdpContent);

  // Configure FFmpeg
  const ffmpegProcess = ffmpeg()
    .input(sdpPath)
    .inputOptions(['-protocol_whitelist file,udp,rtp'])
    .outputOptions([
      '-c:v copy', // Initially copy to avoid re-encoding issues
      '-c:a copy',
      '-f webm',
      '-analyzeduration 10000000', // 10 seconds (in microseconds)
      '-probesize 10000000',       // 10 MB
    ])
    .output(filename)
    .on('start', (commandLine) => {
      console.log(`Started FFmpeg with command: ${commandLine}`);
    })
    .on('progress', (progress) => {
      console.log(`Recording progress for peer ${peer.peerId}: ${progress.timemark}`);
    })
    .on("stderr", (line) => {
      console.log(line);
    })
    .on('error', (err) => {
      console.error(`FFmpeg error for peer ${peer.peerId}:`, err.message);
    })
    .on('end', () => {
      console.log(`Finished recording peer ${peer.peerId}`);
      fs.unlinkSync(sdpPath);
    });

    setTimeout(async () => {
      await audioConsumer.resume();
      await videoConsumer.resume();
      ffmpegProcess.run();
    }, 2000); // 2-second delay

  // Store recording info
  peer.recordings.set('combined', {
    ffmpegProcess,
    consumers: [audioConsumer, videoConsumer],
    transports: [audioTransport, videoTransport],
  });

  // Cleanup on producer close
  for (const producer of [audioProducer, videoProducer]) {
    producer.on('transportclose', () => stopRecording(peer, 'combined'));
  }


  console.log(`Recording started for peer ${peer.peerId} on ports audio:${audioPort}, video:${videoPort}`);
}

function stopRecording(peer: Peer, id: string) {
  const record = peer.recordings.get(id);

  if (!record) {
    return;
  }

  record.ffmpegProcess.kill('SIGINT');

  for (const c of record.consumers) {
    c.close();
  }

  for (const t of record.transports) {
    t.close();
  }

  peer.recordings.delete(id);

  console.log(`Stopped recording ${peer.peerId}`);
}


wss.on('connection', (ws) => {
  let peerobj: Peer = {
    producers: [],
    consumers: [],
    peerId: peerid.toString(),
    recordings: new Map(), // Initialize recordings map
  };

  peers.set(ws, peerobj);
  send(ws, { action: 'register_result', data: peerid });
  peerid++;

  ws.on('message', async (message) => {
    const { action, data } = JSON.parse(message.toString());
    const peer = peers.get(ws);

    if (!peer) {
      console.log('peer not found.');
      return;
    }

    console.log(peer.peerId, 'receive ', message);

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
            dtlsParameters: transport.dtlsParameters,
          },
        });
        break;

      case 'createConsumerTransport':
        const consumerTransport = await createTransport();
        peer.consumerTransport = consumerTransport;

        send(ws, {
          action: 'consumerTransportCreated',
          data: {
            id: consumerTransport.id,
            iceParameters: consumerTransport.iceParameters,
            iceCandidates: consumerTransport.iceCandidates,
            dtlsParameters: consumerTransport.dtlsParameters,
          },
        });

        const allOtherProducers = [...peers.entries()]
          .filter(([other]) => other !== ws)
          .flatMap(([, p]) => p.producers.map((prod) => ({
            id: prod.id,
            kind: prod.kind,
          })));

        if (allOtherProducers.length > 0) {
          send(ws, {
            action: 'existingProducers',
            data: allOtherProducers,
          });
          console.log('send existingProducers ', allOtherProducers);
        }
        break;

      case 'connectTransport':
        await peer.transport?.connect({ dtlsParameters: data });
        break;

      case 'connectConsumerTransport':
        await peer.consumerTransport?.connect({ dtlsParameters: data });
        break;

      case 'produce':
        if (!peer.transport) {
          console.error('Transport not found for peer', peer.peerId);
          break;
        }
        const producer = await peer.transport.produce({
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        peer.producers.push(producer);
       
        // Start recording for this producer
        startRecording(peer, router);

        // Inform all other peers of this new producer
        for (const [client, otherPeer] of peers.entries()) {
          if (client !== ws) {
            client.send(
              JSON.stringify({
                action: 'newProducer',
                data: { id: producer.id, kind: producer.kind },
              })
            );
          }
        }

        send(ws, { action: 'produced', data: { id: producer.id } });
        break;

      case 'consume':
        const remoteProducer = [...peers.values()]
          .flatMap((p) => p.producers)
          .find((p) => p.id === data.producerId);

        if (!remoteProducer) {
          console.error('** remoteProducer not found');
          break;
        }

        if (!peer.consumerTransport) {
          console.error('** peer.consumerTransport not found');
          break;
        }

        const consumer = await peer.consumerTransport.consume({
          producerId: remoteProducer.id,
          rtpCapabilities: data.rtpCapabilities,
          paused: false,
        });

        peer.consumers.push(consumer);

        send(ws, {
          action: 'consumed',
          data: {
            id: consumer.id,
            producerId: remoteProducer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          },
        });
        break;
    }
  });

  ws.on('close', () => {
    const peer = peers.get(ws);
    if (peer) {
      // Stop all recordings for this peer
      peer.recordings.forEach((_, producerId) => {
        stopRecording(peer, producerId);
      });
      // Close all producers and consumers
      peer.producers.forEach((producer) => producer.close());
      peer.consumers.forEach((consumer) => consumer.close());
      peer.transport?.close();
      peer.consumerTransport?.close();
      peers.delete(ws);
      console.log(`Peer ${peer.peerId} disconnected and resources cleaned up`);
    }
  });
});

app.use(express.static('public'));

server.listen(3000, async () => {
  await createMediasoupWorker();
  console.log('Server running at https://localhost:3000');
});