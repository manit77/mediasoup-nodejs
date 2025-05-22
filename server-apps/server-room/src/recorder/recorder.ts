import * as mediasoup from 'mediasoup';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { getFreeUDPPort } from "../utils/utils.js";
import { Peer } from '../roomServer/peer.js';

ffmpeg.setFfmpegPath('./bin/ffmpeg');

export async function startRecordingAudio(recordingsDir: string, peer: Peer, router: mediasoup.types.Router) {
  const audioProducer = peer.producers?.find((p) => p.kind === 'audio');
  if (!audioProducer) {
    console.warn(`No audio producer for peer ${peer.id}`);
    return;
  }

  if (peer.recordings?.has('audio')) {
    console.log(`Audio recording already in progress for peer ${peer.id}`);
    return;
  }

  const audioPort = await getFreeUDPPort();
  const audioRtcpPort = await getFreeUDPPort();

  const audioTransport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' },
    rtcpMux: false,
    comedia: false,
  });

  await audioTransport.connect({ ip: '127.0.0.1', port: audioPort, rtcpPort: audioRtcpPort });

  const audioConsumer = await audioTransport.consume({
    producerId: audioProducer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: true,
  });

  const audioCodec = audioConsumer.rtpParameters.codecs[0];
  const audioPt = audioCodec.payloadType;

  const sdpContent = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=MediaSoup Audio Recording
c=IN IP4 127.0.0.1
t=0 0
m=audio ${audioPort} RTP/AVP ${audioPt}
a=rtpmap:${audioPt} opus/48000/2
a=fmtp:${audioPt} useinbandfec=1
a=rtcp:${audioRtcpPort}
a=recvonly
`.trim();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sdpPath = path.join(recordingsDir, `peer-${peer.id}-audio-${timestamp}.sdp`);
  const filename = path.join(recordingsDir, `peer-${peer.id}-audio-${timestamp}.webm`);
  fs.writeFileSync(sdpPath, sdpContent);

  const ffmpegProcess = ffmpeg()
    .input(sdpPath)
    .inputOptions([
      '-protocol_whitelist file,udp,rtp',
      '-analyzeduration 10000000',
      '-probesize 10000000',
      '-fflags', '+genpts',
      '-use_wallclock_as_timestamps 1'
    ])
    .outputOptions([
      '-c:a copy',
      '-vn', // No video
      '-f webm',
    ])
    .output(filename)
    .on('start', (commandLine) => {
      console.log(`Started FFmpeg audio with command: ${commandLine}`);
    })
    .on('progress', (progress) => {
      console.log(`Audio recording progress for peer ${peer.id}: ${progress.timemark}`);
    })
    .on('stderr', (line) => {
      console.log(`FFmpeg audio stderr: ${line}`);
    })
    .on('error', (err) => {
      console.error(`FFmpeg audio error for peer ${peer.id}:`, err.message);
      stopRecording(peer, 'audio');
    })
    .on('end', () => {
      console.log(`Finished audio recording peer ${peer.id}`);
      fs.unlinkSync(sdpPath);
    });

  setTimeout(async () => {
    await audioConsumer.resume();
    ffmpegProcess.run();
  }, 2000);

  peer.recordings?.set('audio', {
    ffmpegProcess,
    consumers: [audioConsumer],
    transports: [audioTransport],
  });

  audioProducer.on('transportclose', () => stopRecording(peer, 'audio'));

  console.log(`Audio recording started for peer ${peer.id} on port ${audioPort}`);
}

export async function startRecordingVideo(recordingsDir: string, peer: Peer, router: mediasoup.types.Router) {
  const videoProducer = peer.producers?.find((p) => p.kind === 'video');
  if (!videoProducer) {
    console.warn(`No video producer for peer ${peer.id}`);
    return;
  }

  if (peer.recordings?.has('video')) {
    console.log(`Video recording already in progress for peer ${peer.id}`);
    return;
  }

  const videoPort = await getFreeUDPPort();
  const videoRtcpPort = await getFreeUDPPort();

  const videoTransport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' },
    rtcpMux: false,
    comedia: false,
  });

  await videoTransport.connect({ ip: '127.0.0.1', port: videoPort, rtcpPort: videoRtcpPort });

  const videoConsumer = await videoTransport.consume({
    producerId: videoProducer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: true
  });

  // Create DirectTransport for the consumer
  //const videoTransport = await router.createDirectTransport();

  // Create a video consumer to consume the producer's video
  // const videoConsumer = await videoTransport.consume({
  //   producerId: videoProducer.id,
  //   rtpCapabilities: router.rtpCapabilities
  // });

  await videoConsumer.enableTraceEvent(['rtp', "keyframe"]);

  videoConsumer.on("trace", packet => {
    //console.log("trace:", packet.type);
    if (packet.type == "keyframe") {
      console.log("*** keyframe received");
    }
  })

  const videoCodec = videoConsumer.rtpParameters.codecs[0];
  const videoPt = videoCodec.payloadType;

  const sdpContent = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=MediaSoup Video Recording
c=IN IP4 127.0.0.1
t=0 0
m=video ${videoPort} RTP/AVP ${videoPt}
a=rtpmap:${videoPt} VP8/90000
a=rtcp:${videoRtcpPort}
a=recvonly
`.trim();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sdpPath = path.join(recordingsDir, `peer-${peer.id}-video-${timestamp}.sdp`);
  const filename = path.join(recordingsDir, `peer-${peer.id}-video-${timestamp}.webm`);
  fs.writeFileSync(sdpPath, sdpContent);

  const ffmpegProcess = ffmpeg()
    .input(sdpPath)
    .inputOptions([
      '-protocol_whitelist file,udp,rtp',
      '-analyzeduration 10000000',
      '-probesize 10000000',
      '-fflags', '+genpts',
      '-use_wallclock_as_timestamps 1'
    ])
    .outputOptions([
      '-c:v copy',
      '-an', // No audio
      '-f webm',
    ])
    .output(filename)
    .on('start', async (commandLine) => {
      console.log(`Started FFmpeg video with command: ${commandLine}`);
      await videoConsumer.resume();
      await videoConsumer.requestKeyFrame();
    })
    .on('progress', (progress) => {
      console.log(`Video recording progress for peer ${peer.id}: ${progress.timemark}`);
    })
    .on('stderr', async (line) => {
      console.log(`FFmpeg video stderr: ${line}`);
      if (line.indexOf("Keyframe missing") > 0) {
        console.log("requesting key frame");
        await videoConsumer.requestKeyFrame();
      } else if (line.indexOf("Received no start marker; dropping frame") > 0) {
        console.log("requesting key frame");
        await videoConsumer.requestKeyFrame();
      }
    })
    .on('error', (err) => {
      console.error(`FFmpeg video error for peer ${peer.id}:`, err.message);
      stopRecording(peer, 'video');
    })
    .on('end', () => {
      console.log(`Finished video recording peer ${peer.id}`);
      fs.unlinkSync(sdpPath);
    });

  ffmpegProcess.run();


  peer.recordings?.set('video', {
    ffmpegProcess,
    consumers: [videoConsumer],
    transports: [videoTransport],
  });

  videoProducer.on('transportclose', () => stopRecording(peer, 'video'));

  console.log(`Video recording started for peer ${peer.id} on port ${videoPort}`);
}

export async function stopRecording(peer: Peer, id: string) {
  const record = peer.recordings?.get(id);
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
  peer.recordings?.delete(id);
  console.log(`Stopped ${id} recording for peer ${peer.id}`);
}