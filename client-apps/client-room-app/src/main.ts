import {
    payloadTypeServer,
    RoomJoinResultMsg,
    RoomPeerLeftMsg,
    RoomType
} from "@rooms/rooms-models";
import * as rooms from "@rooms/rooms-client";


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

    /**
     * in this scenario we are granted a serviceToken which allows us to fully control the room server
     * in a secured scenario, your app would have the service token and control the room server
     */
    let serviceToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NDc0OTk5NzV9.Wr1NJ8Or3JCCqSSd_eVJM3HBzsV0pM_FDPg6WRdExxg";
    let roomsClient = new rooms.RoomsClient();

    await initRooms();

    async function initRooms() {

        writeLog("-- initMediaSoupDevice");

        roomsClient.onRoomClosedEvent = (roomId: string, peers: rooms.Peer[]) => {
            writeLog("room closed");
            peers.forEach((p) => {
                destroyRemoteVideo(p.peerId);
            });
        };

        roomsClient.onRoomJoinedEvent = (roomId: string) => {
            writeLog("* onRoomJoinedEvent");
            // roomsClient.publishLocalStream();
        };

        roomsClient.onRoomPeerJoinedEvent = (roomid: string, peer: rooms.Peer) => {
            writeLog("* onRoomPeerJoinedEvent");
            // roomsClient.consumePeerProducers(peer);
        };

        roomsClient.onRoomPeerLeftEvent = (roomid: string, peer: rooms.Peer) => {
            writeLog(`* onRoomPeerLeftEvent ${roomid} ${peer.peerId}`);
            destroyRemoteVideo(peer.peerId);
        };

        roomsClient.onPeerNewTrackEvent = (peer: rooms.Peer, track: MediaStreamTrack) => {
            writeLog("* onPeerNewTrackEvent");
            addTrackToRemoteVideo(peer.peerId, track);
        };

        await roomsClient.init(wsURI);
        //init a new media soup device
        roomsClient.initMediaSoupDevice();
        writeLog("mediasoup initialized");

        let connected = await roomsClient.waitForConnect();
        if (connected.type == payloadTypeServer.error) {
            writeLog("ERROR: failed to connect to rooms server.");
            return;
        }

        let receivedAuthtoken = await roomsClient.waitForGetAuthoken(serviceToken);

        if (receivedAuthtoken.type == payloadTypeServer.error) {
            writeLog("ERROR: failed to received authtoken");
            return;
        }

        let registered = await roomsClient.waitForRegister("", ctlDisplayName.value);
        if (registered.type == payloadTypeServer.error) {
            writeLog("failed to register client");
            return;
        }

        let stream = await roomsClient.getUserMedia();
        if (stream) {
            writeLog("* done get local stream");
            ctlVideo.srcObject = stream;
        }

    }

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
        writeLog("* destroyRemoteVideo:" + peerId);
        let id = `video-${peerId}`;
        let video = document.getElementById(id) as HTMLVideoElement | null;
        if (video) {
            video.remove();
        } else {
            writeLog("video element not found " + id);
        }
    }

    ctlJoinRoomButton.onclick = async (event) => {
        writeLog("ctlJoinRoomButton click");
        event.preventDefault();

        ctlJoinRoomButton.disabled = false;

        if (!ctlJoinInfo.value) {
            createJoinNewRoom();
        } else {
            joinExistingRoom();
        }

    }

    ctlLeaveRoomButton.onclick = async (event) => {

        writeLog("ctlLeaveRoomButton click");
        event.preventDefault();

        ctlLeaveRoomButton.disabled = true;
        ctlLeaveRoomButton.style.visibility = "hidden";
        ctlJoinInfo.value = "";

        ctlJoinRoomButton.disabled = false;
        ctlJoinRoomButton.style.visibility = "visible";

        await roomLeave();


    }

    async function writeLog(...params: any) {
        console.log(...["WEB", ...params]);
        // ctlSatus.innerHTML = statusText + ctlSatus.innerText + "<br>";
        ctlSatus.innerHTML = `${params.join(" ")}<br>${ctlSatus.innerHTML}`;
    }

    async function createJoinNewRoom() {
        writeLog("* createJoinNewRoom()");

        let roomType: RoomType = RoomType.p2p;
        let roomDuration = 1; // max duration of the room
        let maxPeers = 2; // max number of peers that can join

        let resultToken = await roomsClient.waitForNewRoomToken(roomDuration);
        if (resultToken.data.error) {
            writeLog("* unable to create room");
            return;
        }

        let result = await roomsClient.waitForNewRoom(roomType, maxPeers, roomDuration);
        if (result.data.error) {
            writeLog("* unable to create room");
            return;
        }

        let joinResult = await roomsClient.waitForRoomJoin(result.data.roomId, result.data.roomToken);
        if (joinResult.data.error) {
            writeLog("* unable to join room");
            return;
        }

        writeLog("* joined room, peer count:" + joinResult.data.peers.length);
        let joinInfo: rooms.JoinInfo = {
            roomId: roomsClient.localPeer.roomId,
            roomToken: roomsClient.localPeer.roomToken
        }

        ctlJoinInfo.value = JSON.stringify(joinInfo);

    }

    async function joinExistingRoom() {

        let joinInfo: rooms.JoinInfo = JSON.parse(ctlJoinInfo.value);
        let joinResult = await roomsClient.waitForRoomJoin(joinInfo.roomId, joinInfo.roomToken);
        if (joinResult.data.error) {
            writeLog("* error, could not join existing room " + joinResult);
            return;
        }

        writeLog("* joined existing room");
        writeLog("* joined room, peer count:" + joinResult.data.peers.length);


    }

    async function roomLeave() {
        for (let peer of roomsClient.peers) {
            destroyRemoteVideo(peer.peerId);
        }
        roomsClient.roomLeave();
    }

})();

