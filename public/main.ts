import * as mediasoupClient from 'mediasoup-client';
import { ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg, payloadTypeServer, ProducedMsg, ProducerTransportCreatedMsg, RegisterMsg, RegisterResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomNewPeerMsg } from './payload';

const ws = new WebSocket(`wss://${location.host}`);
const ctlVideo: HTMLVideoElement = document.getElementById('ctlVideo') as HTMLVideoElement;
const ctlPeerId = document.getElementById('ctlPeerId') as HTMLDivElement;
const ctlRemoteVideos = document.getElementById('ctlRemoteVideos') as HTMLDivElement;
const ctlDisplayName = document.getElementById("ctlDisplayName") as HTMLInputElement;
const ctlJoinRoomButton = document.getElementById("ctlJoinRoomButton") as HTMLButtonElement;
const ctlRoomId = document.getElementById("ctlRoomId") as HTMLInputElement;
const ctlSatus = document.getElementById("ctlSatus") as HTMLDivElement;

let device: mediasoupClient.types.Device;
let sendTransport: mediasoupClient.types.Transport;
let recvTransport: mediasoupClient.types.Transport;

let localPeerId = "";

const createVideoElement = (peerId: string, track: MediaStreamTrack) => {
    const video = document.createElement('video');
    video.id = peerId;
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = '300px';
    video.srcObject = new MediaStream([track]);
    ctlRemoteVideos!.appendChild(video);
    return video;
};

ctlJoinRoomButton.onclick = (event) => {
    event.preventDefault();

    let roomid = ctlRoomId.value;
    let roomToken = "";

    let msg = new RoomJoinMsg();
    msg.data = {
        roomId: roomid,
        roomToken: roomToken
    };
    send(msg);
}

ws.addEventListener('open', async () => {

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    ctlVideo.srcObject = stream;
    initMediaSoupDevice();

    register();

});


ws.addEventListener('message', async (event) => {
    const msgIn: any = JSON.parse(event.data);

    console.log("ws_receive ",msgIn);

    switch (msgIn.type) {
        case payloadTypeServer.registerResult:
            onRegisterResult(msgIn);
        case payloadTypeServer.producerTransportCreated:
            onProducerTransportCreated(msgIn);
            break;
        case payloadTypeServer.consumerTransportCreated:
            onConsumerTransportCreated(msgIn);
            break;
        case payloadTypeServer.roomJoinResult:
            onRoomJoinResult(msgIn);
            break;
        case payloadTypeServer.roomNewPeer:
            onRoomNewPeer(msgIn);
            break;
        case payloadTypeServer.consumed:
            onConsumed(msgIn);
            break;
    }

});

const send = (msg = {}) => {
    console.log("ws_send ", msg);
    ws.send(JSON.stringify(msg));
};

async function writeLog(statusText: string) {
    ctlSatus.innerText = statusText + ctlSatus.innerText;
}

async function initMediaSoupDevice() {
    //init a new media soup device
    device = new mediasoupClient.Device();
    writeLog("mediasoup initialized");
}

async function register() {
    let msg = new RegisterMsg();
    msg.authToken = ""; //need authtoken from server
    msg.displayName = ctlDisplayName.value;
    send(msg);
}


async function onRegisterResult(msgIn: RegisterResultMsg) {
    localPeerId = msgIn.data!.peerid
    ctlPeerId.innerText = localPeerId;

    await device.load({ routerRtpCapabilities: msgIn.data!.rtpCapabilities });

    createProducerTransport();
    createConsumerTransport();

}

async function createProducerTransport() {
    let msg = new CreateProducerTransportMsg();
    send(msg);
}

async function createConsumerTransport() {
    let msg = new CreateConsumerTransportMsg();
    send(msg);
}

async function onConsumerTransportCreated(msgIn: ConsumerTransportCreatedMsg) {
    recvTransport = device.createRecvTransport({
        id: msgIn.data!.transportId,
        iceServers: msgIn.data!.iceServers,
        iceCandidates: msgIn.data.iceCandidates,
        iceParameters: msgIn.data.iceParameters,
        dtlsParameters: msgIn.data.dtlsParameters,
        iceTransportPolicy: msgIn.data.iceTransportPolicy
    });

    recvTransport.on('connect', ({ dtlsParameters }, callback) => {
        let msg = new ConnectConsumerTransportMsg();
        msg.data = {
            dtlsParameters: dtlsParameters
        }
        send(msg);
        callback();
    });

}

async function onProducerTransportCreated(msgIn: ProducerTransportCreatedMsg) {

    //the server has created a transport
    //create a client transport to connect to the server transport
    sendTransport = device.createSendTransport({
        id: msgIn.data.transportId,
        iceServers: msgIn.data.iceServers,
        iceCandidates: msgIn.data.iceCandidates,
        iceParameters: msgIn.data.iceParameters,
        dtlsParameters: msgIn.data.dtlsParameters,
        iceTransportPolicy: msgIn.data.iceTransportPolicy
    });

    sendTransport.on("connect", ({ dtlsParameters }, callback) => {
        //fires when the transport connects to the mediasoup server

        let msg = new ConnectProducerTransportMsg();
        msg.data = {
            dtlsParameters: dtlsParameters
        };
        send(msg);

        callback();

    });

    sendTransport.on('produce', ({ kind, rtpParameters }, callback) => {
        //fires when we call produce with local tracks
        let msg = new ProducedMsg();
        msg.data = {
            kind: kind,
            rtpParameters: rtpParameters
        }
        send(msg);
        //what is the id value???
        callback({ id: 'placeholder' });
    });

}


async function onRoomJoinResult(msgIn: RoomJoinResultMsg) {

    if (msgIn.data.roomId) {
        ctlSatus.innerText = "joined room " + msgIn.data.roomId;
    }

    //publish local stream
    await produceLocalStreams();

    //connect to existing peers
    if (msgIn.data && msgIn.data.peers) {
        for (let peer of msgIn.data.peers) {
            console.log(peer.peerId);

            if (peer.producers) {
                for (let producer of peer.producers) {
                    console.log(producer.kind, producer.producerId);
                    consumeProducer(peer.peerId, producer.producerId);
                }
            }
        }
    }

}
async function onRoomNewPeer(msgIn: RoomNewPeerMsg) {

    writeLog("new PeeerJoined " + msgIn.data?.peerId);

    if (msgIn.data?.producers) {
        for (let producer of msgIn.data.producers) {
            consumeProducer(msgIn.data.peerId, producer.producerId);
        }
    }
}

async function produceLocalStreams() {

    //get the tracks and start sending the streams "produce"
    const localStream = ctlVideo.srcObject as any;
    for (const track of localStream.getTracks()) {
        await sendTransport.produce({ track });
    }

}

async function consumeProducer(remotePeerId: string, producerId: string) {
    let msg = new ConsumeMsg();
    msg.data = {
        remotePeerId: remotePeerId,
        producerId: producerId,
        rtpCapabilities: device.rtpCapabilities
    }
    send(msg);
}



async function onConsumed(msgIn: ConsumedMsg) {

    const consumer = await recvTransport.consume({
        id: msgIn.data.consumerId,
        producerId: msgIn.data.producerId,
        kind: msgIn.data.kind,
        rtpParameters: msgIn.data.rtpParameters
    });

    createVideoElement(msgIn.data.peerId, consumer.track);

}
