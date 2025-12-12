
import {
    CreateConsumerTransportMsg, CreateProducerTransportMsg, payloadTypeSDP, payloadTypeServer,
    RegisterPeerMsg, RoomConsumeSDPMsg, RoomConsumeSDPResultMsg, RoomJoinMsg, RoomNewMsg,
    RoomNewProducerSDPMsg,
    RoomNewTokenMsg, RoomOfferSDPMsg,
    RoomOfferSDPResultMsg,
} from "@rooms/rooms-models";

const wsUrl = "wss://192.168.40.24:8001";
const ws = new WebSocket(wsUrl);

let serviceAuthToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwidHlwZSI6InNlcnZpY2UiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTYwODM4NTh9.Kqnh5zEi--_--JNMUkqf7X6WQQYJ57v3ssW5ks5bBbs";

let authToken = "";
let username = "";
let peerId = "";
let roomId = "";
let roomName = "test room 1";
let roomToken = "";
let roomRtpCapabilities: any;
let peerConnection: RTCPeerConnection;
let localStream: MediaStream;

let ctlUserName: HTMLInputElement = document.getElementById("ctlUserName") as HTMLInputElement;
let ctlRoomToken: HTMLInputElement = document.getElementById("ctlRoomToken") as HTMLInputElement;
let ctlRoomId: HTMLInputElement = document.getElementById("ctlRoomId") as HTMLInputElement;
let ctlJoinRoom = document.getElementById("ctlJoinRoom") as HTMLButtonElement;
let ctlNewRoom = document.getElementById("ctlNewRoom") as HTMLButtonElement;
let localVideo = document.getElementById("localVideo") as HTMLVideoElement;

console.log("ctlNewRoom", ctlNewRoom);

let peers: any[] = [];

roomId = localStorage.getItem("roomId") ?? "";
roomToken = localStorage.getItem("roomToken") ?? "";

ctlRoomId.value = roomId;
ctlRoomToken.value = roomToken;


ctlNewRoom.addEventListener("click", (event) => {
    console.log("-- ctlNewRoom click()");
    event.preventDefault();
    event.stopPropagation();

    createRoomToken();
});

ctlJoinRoom.addEventListener("click", (event) => {
    console.log("-- ctlJoinRoom click()");
    event.preventDefault();
    event.stopPropagation();

    roomId = ctlRoomId.value;
    roomToken = ctlRoomToken.value;

    joinRoom();
});


ws.onopen = async () => {
    console.log("-- Connected to signaling server");
    username = randomString();

    ctlUserName.value = username;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        newAuthToken();

    } catch (err) {
        console.error("Failed to get user media:", err);
    }
};

ws.onclose = () => {
    console.error("socket closed");
}

ws.onerror = () => {
    console.error("socket onerror");
}

ws.onmessage = async (event) => {
    const msgIn = JSON.parse(event.data);
    console.log("-- onmessage", msgIn);

    if (msgIn.data?.error) {
        console.error("Server error:", msgIn.data.error);
        return;
    }

    switch (msgIn.type) {
        case payloadTypeServer.authUserNewTokenResult: {
            authToken = msgIn.data.authToken;
            register();
            break;
        }
        case payloadTypeServer.registerPeerResult: {
            peerId = msgIn.data.peerId;
            console.log("-- Registered peer, peerId:", peerId);
            break;
        }
        case payloadTypeServer.roomNewTokenResult: {
            roomId = msgIn.data.roomId;
            roomToken = msgIn.data.roomToken;
            console.log("-- Room token created, roomId:", roomId);
            ctlRoomId.value = roomId;
            ctlRoomToken.value = roomToken;

            localStorage.setItem("roomId", roomId);
            localStorage.setItem("roomToken", roomToken);

            createRoom();
            break;
        }
        case payloadTypeServer.roomNewResult: {
            console.log("-- Room created:", msgIn);
            roomRtpCapabilities = msgIn.data.roomRtpCapabilities;
            joinRoom();
            break;
        }
        case payloadTypeServer.roomJoinResult: {
            console.log("-- roomJoinResult:", msgIn);
            roomRtpCapabilities = msgIn.data.roomRtpCapabilities;
            peers = msgIn.data.peers;

            createTransports();

            break;
        }
        case payloadTypeServer.createProducerTransportResult: {
            console.log("-- createProducerTransportResult:", msgIn);
            const { roomId } = msgIn.data;

            // Verify localStream tracks
            if (!localStream || !localStream.getTracks().length) {
                console.error("No tracks in localStream");
                throw new Error("Invalid localStream");
            }
            console.log("Local stream tracks:", localStream.getTracks().map(track => ({
                kind: track.kind,
                id: track.id,
                enabled: track.enabled
            })));

            // Create RTCPeerConnection
            initPeerConnection();

            // Add tracks
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
                console.log(`Track added: ${track.kind} (id: ${track.id})`);
            });

            // Create and set offer
            let offerDesc: RTCSessionDescriptionInit;
            try {
                offerDesc = await peerConnection.createOffer({ iceRestart: false });
                console.log("SDP Offer:", offerDesc.sdp);
                await peerConnection.setLocalDescription(offerDesc);
                console.log("Local description set");
            } catch (error) {
                console.error("Error creating/setting offer:", error);
                throw error;
            }

            // Wait for ICE gathering with timeout
            try {
                await waitForIceGatheringComplete(peerConnection);
                console.log("ICE gathering completed");
            } catch (error) {
                console.error("ICE gathering failed:", error);
            }

            //send offer to server
            let msg = new RoomOfferSDPMsg();
            msg.data = {
                roomId,
                offer: offerDesc.sdp
            };
            send(msg);

            break;
        }
        case payloadTypeSDP.roomOfferSDPResult:{
            console.log("-- roomOfferSDPResult", msgIn.data.answer);
            let msg = msgIn as RoomOfferSDPResultMsg;

            //server processed the offer and sent us an answer
            
            //set answer
            await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: msg.data.answer
            }));

            console.log(`answer set`);
            

            break;
        }       
        case payloadTypeServer.roomPing: {
            console.log("-- Received roomPing");
            send({
                type: "roomPong",
                data: { roomId }
            });
            break;
        }
        case payloadTypeServer.roomNewPeer: {
            console.warn("new peer joined: ", msgIn.data.peerId);
            peers.push({
                peerId: msgIn.data.peerId,
                displayName: msgIn.data.displayName,
                producers: msgIn.data.producers,
                trackInfo: msgIn.data.trackInfo,
                tracks: []
            });

            //if there are any producers send offer to consume


            break;
        }
        case payloadTypeSDP.roomNewProducerSDP: {
            console.warn("new roomNewProducerSDP: ", msgIn.data.peerId);

            let remotePeerId = (msgIn as RoomNewProducerSDPMsg).data.peerId;

            if (!remotePeerId) {
                console.error("remotePeerId is required.");
                return;
            }

            const peer = peers.find(p => p.peerId === remotePeerId);
            if (!peer) {
                console.error(`Peer ${remotePeerId} not found`);
                return;
            }
            
            //unfortunate for mediasoup lib, local peerconnection always sends offer first
            let offerDesc: RTCSessionDescriptionInit;
            try {
                offerDesc = await peerConnection.createOffer({ iceRestart: false });
                console.log("SDP Offer:", offerDesc.sdp);
                await peerConnection.setLocalDescription(offerDesc);
                console.log("Local description set");
            } catch (error) {
                console.error("Error creating/setting offer:", error);
                throw error;
            }

            let msg = new RoomConsumeSDPMsg();
            msg.data = {
                roomId,
                remotePeerId,
                offer: offerDesc.sdp
            };

            send(msg);

            break;
        }
        case payloadTypeSDP.roomConsumeSDPResult: {
            console.log("-- roomConsumeProducerResult stream:", msgIn);

            //we sent an offer to media soup, and received an answer            
            const { answer } = (msgIn as RoomConsumeSDPResultMsg).data;

            const peer = peers.find(p => p.peerId === peerId);
            if (!peer) {
                console.error(`Peer ${peerId} not found`);
                return;
            }

            peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: "answer",
                sdp: answer
            }));          

            break;
        }
    }
};

function initPeerConnection() {
    if (peerConnection) return;

    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    console.log("peerConnection created, initial ICE state:", peerConnection.iceGatheringState);
    console.log("Browser:", navigator.userAgent);

    // Add event listeners for debugging
    peerConnection.onicecandidate = (event) => {
        console.log("ICE candidate:", event.candidate);
    };
    peerConnection.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", peerConnection.iceGatheringState);
    };
    peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnection.connectionState);
    };
    peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnection.iceConnectionState);
    };

    //new tracks for remote media created
    peerConnection.ontrack = (event) => {
        console.log("ontrack", {
            kind: event.track.kind,
            id: event.track.id,
            streamId: event.streams[0]?.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState,
            muted: event.track.muted
        });

        // Skip probator track
        if (event.streams[0]?.id.includes("probator") || event.track.id.includes("probator")) {
            console.log("Skipping probator track:", event.track.id);
            return;
        }

        // Only handle video tracks
        if (event.track.kind !== "video") {
            console.log("Skipping non-video track:", event.track.kind);
            return;
        }

        // Verify remoteVideos container
        let remoteVideos = document.getElementById("remoteVideos");
        if (!remoteVideos) {
            console.error("remoteVideos element not found");
            return;
        }

        // Create video element
        let video = document.createElement("video");
        video.id = `video-${event.track.id}`; // Unique ID for debugging
        video.autoplay = true;
        video.muted = true; // Required for autoplay
        video.style.width = "320px"; // Ensure visibility
        video.style.height = "240px";
        video.style.backgroundColor = "black";

        const stream = new MediaStream([event.track]);
        console.log("MediaStream tracks:", stream.getTracks());
        video.srcObject = stream;

        // Attempt to play
        video.play().catch(error => console.error("Video play failed:", error));

        // Append to container
        remoteVideos.appendChild(video);
        console.log("Video element appended:", video);

    };
}

async function waitForIceGatheringComplete(pc: RTCPeerConnection) {
    console.log(`-- waitForIceGatheringComplete`);

    return new Promise<void>((resolve) => {
        console.log(`--  start ice gathering`);

        if (pc.iceGatheringState === 'complete') {
            console.log(`--  gathering complete`);
            resolve();
        } else {
            console.log(`--  gathering`);

            const onIceGatheringStateChange = () => {
                console.log(`pc.iceGatheringState`, pc.iceGatheringState);
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', onIceGatheringStateChange);
        }
    });
}


function send(msg: any) {
    console.log("-- Sending message:", msg);
    ws.send(JSON.stringify(msg));
}

function newAuthToken() {
    console.log("-- newAuthToken");

    send({
        type: "authUserNewToken",
        data: {
            authToken: serviceAuthToken,
            username: username,
            role: "user",
            expiresInMin: 30
        }
    });
}

function register() {
    console.log("-- register");
    let msg = new RegisterPeerMsg();
    msg.data = {
        authToken,
        username,
        displayName: username,
        peerTrackingId: username, // since we don't have one, use the username
        clientType: "sdp",
    };

    send(msg);
}

function createRoomToken() {
    console.log("-- createRoomToken");
    let msg = new RoomNewTokenMsg();
    msg.data = {
        authToken
    };
    send(msg);
}

function createRoom() {
    console.log("-- createRoom");
    let msg = new RoomNewMsg();
    msg.data = {
        authToken,
        peerId,
        roomId,
        roomToken,
        roomName,
        roomTrackingId: "0"
    };

    send(msg);
}

function createTransports() {
    console.log("-- createTransports");

    //we should do this automatically on the server when the user registers the connection

    //create the producer transport on the server
    let msg: any = new CreateProducerTransportMsg();
    msg.data.roomId = roomId;
    send(msg);

    msg = new CreateConsumerTransportMsg();
    msg.data.roomId = roomId;
    send(msg);

}

function joinRoom() {
    console.log("-- joinRoom", roomId, roomToken);
    let msg = new RoomJoinMsg();
    msg.data = {
        peerId,
        roomId,
        roomToken
    };

    send(msg);
}

function randomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

