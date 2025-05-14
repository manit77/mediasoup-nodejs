import * as mediasoupClient from 'mediasoup-client';
import {
    ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg
    , CreateConsumerTransportMsg, CreateProducerTransportMsg, payloadTypeServer, ProducedMsg, ProduceMsg
    , ProducerTransportCreatedMsg, RegisterMsg, RegisterResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg
    , RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomNewResultMsg, RoomPeerLeftMsg
} from './roomSharedModels';

(async () => {

    const wsURI = "wss://localhost:3000";
    let ws: WebSocket;
    const ctlVideo: HTMLVideoElement = document.getElementById('ctlVideo') as HTMLVideoElement;
    const ctlPeerId = document.getElementById('ctlPeerId') as HTMLDivElement;
    const ctlRemoteVideos = document.getElementById('ctlRemoteVideos') as HTMLDivElement;
    const ctlDisplayName = document.getElementById("ctlDisplayName") as HTMLInputElement;
    const ctlJoinRoomButton = document.getElementById("ctlJoinRoomButton") as HTMLButtonElement;
    const ctlLeaveRoomButton = document.getElementById("ctlLeaveRoomButton") as HTMLButtonElement;

    const ctlJoinInfo = document.getElementById("ctlJoinInfo") as HTMLInputElement;
    const ctlSatus = document.getElementById("ctlSatus") as HTMLDivElement;

    let device: mediasoupClient.types.Device;
    let sendTransport: mediasoupClient.types.Transport;
    let recvTransport: mediasoupClient.types.Transport;
    let localPeerId = "";
    let localRoomId = "";
    let roomToken = "";
    let authToken = "";
    let peers: string[] = [];

    await initMediaSoupDevice();
    await initWebsocket();

    function addTrackToRemoteVideo(peerId: string, track: MediaStreamTrack) {
        // Find the existing video element
        let id = `video-${peerId}`;
        let video = document.getElementById(id) as HTMLVideoElement | null;

        if (!video) {
            //add new element
            video = document.createElement('video');
            video.id = id;
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

    function destroyRemoteVideo(peerId: string) {
        console.log("destroyRemoteVideo:" + peerId);
        let id = `video-${peerId}`;
        let video = document.getElementById(id) as HTMLVideoElement | null;
        if (video) {
            video.remove();
        }
    }

    ctlJoinRoomButton.onclick = async (event) => {
        console.log("ctlJoinRoomButton click");
        event.preventDefault();

        ctlJoinRoomButton.disabled = false;
        
        if (!ctlJoinInfo.value) {
            const { roomId, roomToken } = await roomNewAwait();
            if (roomId && roomToken) {                
                let joinInfoStr = JSON.stringify({ roomId: roomId, roomToken: roomToken });
                ctlJoinInfo.value = joinInfoStr;
                console.log("attempt to join room ", joinInfoStr);

                roomJoin(roomId);                                
            } else {
                console.log("roomid and roomToken is required.");
            }
        } else {
            let joinInfo : { roomId: string, roomToken: string } = JSON.parse(ctlJoinInfo.value);            
            if (!roomToken) {
                roomToken = joinInfo.roomToken;
                roomJoin(joinInfo.roomId);
            } else {
                console.log("roomToken is required.");
            }

        }

    }

    ctlLeaveRoomButton.onclick = async (event) => {

        console.log("ctlLeaveRoomButton click");
        event.preventDefault();

        ctlLeaveRoomButton.disabled = true;
        ctlLeaveRoomButton.style.visibility = "hidden";
        ctlJoinInfo.value = "";

        ctlJoinRoomButton.disabled = false;
        ctlJoinRoomButton.style.visibility = "visible";

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
                case payloadTypeServer.roomNewResult:
                    onRoomNewResult(msgIn);
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

    /**
     * register ->                                  //registers a new peer
     *   <- registerResult                          //returns a peerid
     * createProducerTransport ->                   //request server to create a producer transport
     * createConsumerTransport ->                   //request server to create a consumer transport
     *   <- producerTransportCreated                //signals client the transport is created
     *   <- consumerTransportCreated                //signals client the transport is created
     * connectConsumerTransport ->                  //request server to connect the client and server transports
     * connectProducerTransport ->                  //request server to connect the client and server transports
     * roomJoin ->                                  //join a room or create a new one
     *   <- joinRoomResult                          //returns a roomid
     * // is has room members
     * // do produce/consume for each                      
     * produce ->                                   //request server to receive a local stream
     *   <- produced                                //signals client the local stream being received
     * // consumeProducer()
     * consume ->                                   //request server to consume stream
     *   <- consumed                                //signals client the stream is being consumed
     */
    async function register() {
        console.log("-- register");

        let msg = new RegisterMsg();
        msg.data.authToken = ""; //need authtoken from server
        msg.data.displayName = ctlDisplayName.value;
        send(msg);
    }

    async function onRegisterResult(msgIn: RegisterResultMsg) {

        console.log("-- onRegisterResult");

        localPeerId = msgIn.data!.peerId!;
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

    async function roomNewAwait(): Promise<{ roomId: string; roomToken: string }> {
        console.log("roomNewAwait");
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Room creation timed out"));
            }, 10000); // 10-second timeout

            // Define a one-time message handler
            const handleMessage = async (event: MessageEvent) => {
                try {
                    console.log("handleMessage roomNewResult");

                    const msgIn: any = JSON.parse(event.data);

                    // Only handle roomNewResult messages
                    if (msgIn.type !== payloadTypeServer.roomNewResult) {
                        return;
                    }

                    //this function will fire first since  its already added
                    //await Promise.resolve(onRoomNewResult(msgIn));

                    if (msgIn.data?.error) {
                        reject(new Error(`Failed to create room: ${msgIn.data.error}`));
                        return;
                    }

                    if (!msgIn.data?.roomId || !msgIn.data?.roomToken) {
                        reject(new Error("Invalid response: missing roomId or roomToken"));
                        return;
                    }

                    localRoomId = msgIn.data.roomId;
                    roomToken = msgIn.data.roomToken;

                    resolve({ roomId: msgIn.data.roomId, roomToken: msgIn.data.roomToken });
                } catch (error: any) {
                    reject(new Error(`Room creation failed: ${error}`));
                } finally {
                    // Remove this listener
                    ws.removeEventListener("message", handleMessage);
                    clearTimeout(timeout);
                }
            };

            // Register temporary listener
            ws.addEventListener("message", handleMessage);

            // Send room creation request
            roomNew();
        });
    }

    function roomNew() {
        let msg = new RoomNewMsg();
        msg.data = {};
        send(msg);
    }

    let onRoomNewResult = async (msgIn: RoomNewResultMsg) => {

        console.log(`onRoomNewResult`);
        if (msgIn.data?.error) {
            console.log(`failed to create new room ${msgIn.data.error}`);

        } else {
            localRoomId = msgIn.data?.roomId!;
            roomToken = msgIn.data?.roomToken!;

            console.log(`onRoomNewResult ${localRoomId} ${roomToken}`);
        }
    }

    function roomJoin(roomid: string) {
        let msg = new RoomJoinMsg();
        msg.data = {
            roomId: roomid,
            roomToken: roomToken
        };
        send(msg);
    }

    async function onRoomJoinResult(msgIn: RoomJoinResultMsg) {

        console.log("-- onRoomJoinResult");

        if (!msgIn.data!.error) {
            localRoomId = msgIn.data!.roomId!;
            roomToken = msgIn.data!.roomToken!;

            if (!roomToken) {
                writeLog("joined room " + msgIn.data!.roomId);                
                ctlJoinRoomButton.disabled = true;
                ctlJoinRoomButton.style.visibility = "hidden";

                ctlLeaveRoomButton.disabled = false;
                ctlLeaveRoomButton.style.visibility = "visible";

            } else {
                console.error("not token received");
            }

        } else {
            localRoomId = "";

            ctlJoinRoomButton.disabled = false;

            ctlLeaveRoomButton.disabled = true;
            ctlLeaveRoomButton.style.visibility = "hidden";

            writeLog(`join room failed. ${msgIn.data?.error} `)

            return;
        }

        //publish local stream
        await produceLocalStreams();

        console.log("-- onRoomJoinResult peers :" + msgIn.data!.peers!.length);
        //connect to existing peers
        if (msgIn.data && msgIn.data.peers) {
            for (let peer of msgIn.data.peers) {
                peers.push(peer.peerId);
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

    async function roomLeave() {

        for (let peerid of peers) {
            destroyRemoteVideo(peerid);
        }


        let msg = new RoomLeaveMsg();
        msg.data = {
            roomId: localRoomId,
            roomToken: roomToken
        };
        send(msg);


    }

    async function onConsumerTransportCreated(msgIn: ConsumerTransportCreatedMsg) {
        console.log("-- onConsumerTransportCreated");

        recvTransport = device.createRecvTransport({
            id: msgIn.data!.transportId!,
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
            id: msgIn.data!.transportId!,
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

    async function onRoomNewPeer(msgIn: RoomNewPeerMsg) {
        console.log("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
        writeLog("new PeeerJoined " + msgIn.data?.peerId);

        peers.push(msgIn.data!.peerId!);

        if (msgIn.data?.producers) {
            for (let producer of msgIn.data.producers) {
                consumeProducer(msgIn.data.peerId!, producer.producerId);
            }
        }
    }

    async function onRoomPeerLeft(msgIn: RoomPeerLeftMsg) {
        writeLog("peer left the room:" + msgIn.data?.peerId);

        //destroy the video element
        if (msgIn.data && msgIn.data.peerId) {
            destroyRemoteVideo(msgIn.data.peerId);
        }

        let idx = peers.findIndex(peerid => peerid == msgIn.data?.peerId);
        if (idx > -1) {
            peers.splice(idx, 1);
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
        addTrackToRemoteVideo(msgIn.data!.peerId!, consumer.track);
    }

    async function onProduced(msgIn: ProducedMsg) {
        writeLog("onProduced " + msgIn.data?.kind);
    }

})();

