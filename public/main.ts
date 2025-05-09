import * as mediasoupClient from 'mediasoup-client';
import { ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg, payloadTypeServer, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg, RegisterMsg, RegisterResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomPeerLeftMsg } from './payload';

(async () => {

    const wsURI = "wss://localhost:3000";
    let ws: WebSocket;
    const ctlVideo: HTMLVideoElement = document.getElementById('ctlVideo') as HTMLVideoElement;
    const ctlPeerId = document.getElementById('ctlPeerId') as HTMLDivElement;
    const ctlRemoteVideos = document.getElementById('ctlRemoteVideos') as HTMLDivElement;
    const ctlDisplayName = document.getElementById("ctlDisplayName") as HTMLInputElement;
    const ctlJoinRoomButton = document.getElementById("ctlJoinRoomButton") as HTMLButtonElement;
    const ctlLeaveRoomButton = document.getElementById("ctlLeaveRoomButton") as HTMLButtonElement;

    const ctlRoomId = document.getElementById("ctlRoomId") as HTMLInputElement;
    const ctlSatus = document.getElementById("ctlSatus") as HTMLDivElement;

    let device: mediasoupClient.types.Device;
    let sendTransport: mediasoupClient.types.Transport;
    let recvTransport: mediasoupClient.types.Transport;
    let localPeerId = "";
    let localRoomId = "";

    await initMediaSoupDevice();
    await initWebsocket();

    async function addTrackToRemoteVideo(peerId: string, track: MediaStreamTrack) {
        // Find the existing video element
        let video = document.getElementById(peerId) as HTMLVideoElement | null;

        if (!video) {
            //add new element
            video = document.createElement('video');
            video.id = peerId;
            video.autoplay = true;
            video.playsInline = true;
            video.style.width = '300px';
            video.srcObject = new MediaStream([track]);
            ctlRemoteVideos!.appendChild(video);
        }

        // Get the current MediaStream or create a new one if none exists
        let mediaStream = video.srcObject as MediaStream;
        if (!mediaStream) {
            mediaStream = new MediaStream();
            video.srcObject = mediaStream;
        }

        // Add the new track to the MediaStream
        mediaStream.addTrack(track);

        // Ensure the video is set to play
        video.play().catch(error => {
            console.error('Error playing video:', error);
        });
    }

    ctlJoinRoomButton.onclick = async (event) => {
        event.preventDefault();
        ctlJoinRoomButton.disabled = false;
        let roomid = ctlRoomId.value;
        await roomJoin(roomid);
    }

    ctlLeaveRoomButton.onclick = async (event) => {
        event.preventDefault();
        ctlLeaveRoomButton.disabled = false;       
        await roomLeave();
    }

    async function send(msg: any) {
        console.log("ws_send ", msg);
        ws.send(JSON.stringify(msg));
    };

    async function writeLog(statusText: string) {
        console.log(statusText);
        // ctlSatus.innerHTML = statusText + ctlSatus.innerText + "<br>";
        ctlSatus.innerHTML = `${statusText}<br>${ctlSatus.innerHTML}`;
    }

    async function initMediaSoupDevice() {
        console.log("-- initMediaSoupDevice");

        //init a new media soup device
        device = new mediasoupClient.Device();
        writeLog("mediasoup initialized");
    }

    async function initWebsocket() {
        ws = new WebSocket(wsURI);
        ws.addEventListener('open', async () => {

            writeLog("websocket open " + wsURI);
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            ctlVideo.srcObject = stream;

            register();

        });

        ws.addEventListener('message', async (event) => {
            const msgIn: any = JSON.parse(event.data);

            console.log("-- ws_receive ", msgIn);

            switch (msgIn.type) {
                case payloadTypeServer.registerResult:
                    onRegisterResult(msgIn);
                    break;
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
                case payloadTypeServer.roomNewProducer:
                    onRoomNewProducer(msgIn);
                    break;
                case payloadTypeServer.roomPeerLeft:
                    onRoomPeerLeft(msgIn);
                    break;
                case payloadTypeServer.produced:
                    onProduced(msgIn);
                    break;
                case payloadTypeServer.consumed:
                    onConsumed(msgIn);
                    break;
            }

        });

        ws.addEventListener("close", async () => {
            writeLog("websocket closed");
            ctlJoinRoomButton.disabled = true;
        });
    }

    async function register() {
        console.log("-- register");

        let msg = new RegisterMsg();
        msg.authToken = ""; //need authtoken from server
        msg.displayName = ctlDisplayName.value;
        send(msg);
    }

    async function onRegisterResult(msgIn: RegisterResultMsg) {

        console.log("-- onRegisterResult");

        localPeerId = msgIn.data!.peerid
        ctlPeerId.innerText = localPeerId;

        await device.load({ routerRtpCapabilities: msgIn.data!.rtpCapabilities });

        await createProducerTransport();
        await createConsumerTransport();

        ctlJoinRoomButton.disabled = false;

    }

    async function createProducerTransport() {
        console.log("-- createProducerTransport");
        let msg = new CreateProducerTransportMsg();
        send(msg);
    }

    async function createConsumerTransport() {
        console.log("-- createConsumerTransport");
        let msg = new CreateConsumerTransportMsg();
        send(msg);
    }

    async function roomJoin(roomid: string) {
        let msg = new RoomJoinMsg();
        msg.data = {
            roomId: roomid,
            roomToken: ""
        };
        send(msg);
    }

    async function roomLeave() {
        let msg = new RoomLeaveMsg();
        msg.data = {
            roomId: localRoomId,
            roomToken: ""
        };
        send(msg);
    }


    async function onConsumerTransportCreated(msgIn: ConsumerTransportCreatedMsg) {
        console.log("-- onConsumerTransportCreated");

        recvTransport = device.createRecvTransport({
            id: msgIn.data!.transportId,
            iceServers: msgIn.data!.iceServers,
            iceCandidates: msgIn.data!.iceCandidates,
            iceParameters: msgIn.data!.iceParameters,
            dtlsParameters: msgIn.data!.dtlsParameters,
            iceTransportPolicy: msgIn.data!.iceTransportPolicy
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
        console.log("-- onProducerTransportCreated");

        //the server has created a transport
        //create a client transport to connect to the server transport
        sendTransport = device.createSendTransport({
            id: msgIn.data!.transportId,
            iceServers: msgIn.data!.iceServers,
            iceCandidates: msgIn.data!.iceCandidates,
            iceParameters: msgIn.data!.iceParameters,
            dtlsParameters: msgIn.data!.dtlsParameters,
            iceTransportPolicy: msgIn.data!.iceTransportPolicy
        });

        sendTransport.on("connect", ({ dtlsParameters }, callback) => {
            console.log("-- sendTransport connect");
            //fires when the transport connects to the mediasoup server

            let msg = new ConnectProducerTransportMsg();
            msg.data = {
                dtlsParameters: dtlsParameters
            };
            send(msg);

            callback();

        });

        sendTransport.on('produce', ({ kind, rtpParameters }, callback) => {

            console.log("-- sendTransport produce");

            //fires when we call produce with local tracks
            let msg = new ProduceMsg();
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

        console.log("-- onRoomJoinResult");

        if (msgIn.data!.roomId) {
            localRoomId = msgIn.data!.roomId;

            writeLog("joined room " + msgIn.data!.roomId);
            ctlRoomId.value = msgIn.data!.roomId;
            ctlJoinRoomButton.disabled = true;
            ctlJoinRoomButton.style.visibility = "hidden";

            ctlLeaveRoomButton.disabled = false;
            ctlLeaveRoomButton.style.visibility = "visible";

        } else {
            localRoomId = "";

            ctlJoinRoomButton.disabled = false;

            ctlLeaveRoomButton.disabled = true;
            ctlLeaveRoomButton.style.visibility = "hidden";
        }

        //publish local stream
        await produceLocalStreams();

        console.log("-- onRoomJoinResult peers :" + msgIn.data?.peers.length);
        //connect to existing peers
        if (msgIn.data && msgIn.data.peers) {
            for (let peer of msgIn.data.peers) {
                console.log(peer.peerId);
                console.log("-- onRoomJoinResult producers :" + peer.producers?.length);
                if (peer.producers) {
                    for (let producer of peer.producers) {
                        console.log("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
                        consumeProducer(peer.peerId, producer.producerId);
                    }
                }
            }
        }

    }

    async function onRoomNewPeer(msgIn: RoomNewPeerMsg) {
        console.log("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
        writeLog("new PeeerJoined " + msgIn.data?.peerId);

        if (msgIn.data?.producers) {
            for (let producer of msgIn.data.producers) {
                consumeProducer(msgIn.data.peerId, producer.producerId);
            }
        }
    }

    async function onRoomPeerLeft(msgIn: RoomPeerLeftMsg) {
        writeLog("peer left the room:" + msgIn.data?.peerId);

        //destroy the video element
        if (msgIn.data && msgIn.data.peerId) {
            let video = document.getElementById(msgIn.data?.peerId);
            video?.remove();
        }

    }

    async function onRoomNewProducer(msgIn: RoomNewProducerMsg) {
        writeLog("onRoomNewProducer: " + msgIn.data?.kind);
        consumeProducer(msgIn.data?.peerId!, msgIn.data?.producerId!);
    }

    async function produceLocalStreams() {
        writeLog("produceLocalStreams");
        //get the tracks and start sending the streams "produce"
        const localStream = ctlVideo.srcObject as any;
        for (const track of localStream.getTracks()) {
            console.log("sendTransport produce ");
            await sendTransport.produce({ track });
        }
    }

    async function consumeProducer(remotePeerId: string, producerId: string) {
        console.log("consumeProducer :" + remotePeerId, producerId);
        if (remotePeerId == localPeerId) {
            console.error("you can't consume yourself.");
        }

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
            id: msgIn.data!.consumerId,
            producerId: msgIn.data!.producerId,
            kind: msgIn.data!.kind,
            rtpParameters: msgIn.data!.rtpParameters
        });
        addTrackToRemoteVideo(msgIn.data!.peerId, consumer.track);
    }

    async function onProduced(msgIn: ProducedMsg) {
        writeLog("onProduced " + msgIn.data?.kind);
    }

})();

