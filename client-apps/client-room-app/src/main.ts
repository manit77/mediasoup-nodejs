import {
    payloadTypeServer

} from "@rooms/rooms-models";
import * as rooms from "@rooms/rooms-client";
import { getUserMedia } from "@rooms/webrtc-client";

(async () => {

    const wsURI = "wss://localhost:3000";
    let ws: WebSocket;
    const ctlVideo: HTMLVideoElement = document.getElementById('ctlVideo') as HTMLVideoElement;
    const ctlRemoteVideos = document.getElementById('ctlRemoteVideos') as HTMLDivElement;
    const ctlDisplayName = document.getElementById("ctlDisplayName") as HTMLInputElement;
    const ctlJoinRoomButton = document.getElementById("ctlJoinRoomButton") as HTMLButtonElement;

    const ctlCreateWebRTCRoomButton = document.getElementById("ctlCreateWebRTCRoomButton") as HTMLButtonElement;
    const ctlCreateSFURoomButton = document.getElementById("ctlCreateSFURoomButton") as HTMLButtonElement;
    const ctlLeaveRoomButton = document.getElementById("ctlLeaveRoomButton") as HTMLButtonElement;

    const ctlJoinInfo = document.getElementById("ctlJoinInfo") as HTMLInputElement;
    const ctlStatus = document.getElementById("ctlStatus") as HTMLDivElement;

    /**
     * in this scenario we are granted a serviceToken which allows us to fully control the room server
     * in a secured scenario, your app would have the service token and control the room server
     */
    let serviceToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NDc0OTk5NzV9.Wr1NJ8Or3JCCqSSd_eVJM3HBzsV0pM_FDPg6WRdExxg";
    let roomsClient = new rooms.RoomsClient();

    await initRooms();

    async function initRooms() {

        writeLog("-- initMediaSoupDevice");

        roomsClient.eventOnRoomClosed = async (roomId: string, peers: rooms.Peer[]) => {
            writeLog("room closed");
            peers.forEach((p) => {
                destroyRemoteVideo(p.peerId);
            });
            disconnectRooms();
        };

        roomsClient.eventOnRoomJoined = async (roomId: string) => {
            writeLog("* onRoomJoinedEvent");
            // roomsClient.publishLocalStream();
        };

        roomsClient.eventOnRoomPeerJoined = async (roomid: string, peer: rooms.Peer) => {
            writeLog("* onRoomPeerJoinedEvent");
        };

        roomsClient.eventOnRoomPeerLeft = async (roomid: string, peer: rooms.Peer) => {
            writeLog(`* onRoomPeerLeftEvent ${roomid} ${peer.peerId}`);
            destroyRemoteVideo(peer.peerId);
        };

        roomsClient.eventOnPeerNewTrack = async (peer: rooms.Peer, track: MediaStreamTrack) => {
            writeLog("* onPeerNewTrackEvent");
            addTrackToRemoteVideo(peer.peerId, track);
        };

        await roomsClient.init(wsURI);
        //init a new media soup device
        writeLog("mediasoup initialized");
        //we don't connect until the room is needed
        //we disconnect when the room is closed

    }

    async function connectRooms() {

        let connected = await roomsClient.waitForConnect();
        if (connected.type == payloadTypeServer.error) {
            writeLog("ERROR: failed to connect to rooms server.");
            await disconnectRooms();
            return;
        }

        let receivedAuthtoken = await roomsClient.waitForGetAuthoken(serviceToken);

        if (receivedAuthtoken.type == payloadTypeServer.error) {
            writeLog("ERROR: failed to received authtoken");
            await disconnectRooms();
            return;
        }

        let registered = await roomsClient.waitForRegister("", "", ctlDisplayName.value);
        if (registered.type == payloadTypeServer.error) {
            writeLog("failed to register client");
            await disconnectRooms();
            return;
        }
        let stream = await getUserMedia();

        roomsClient.publishTracks(stream);

        ctlVideo.srcObject = stream;
    }

    async function disconnectRooms() {
        ctlLeaveRoomButton.style.visibility = "hidden";
        ctlJoinInfo.value = "";
        roomsClient.disconnect();
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
        await connectRooms();
        await joinExistingRoom();
    }

    ctlCreateSFURoomButton.onclick = async (event) => {
        writeLog("ctlJoinRoomButton click");
        event.preventDefault();
        ctlJoinRoomButton.disabled = false;
        await connectRooms();
        await createJoinNewRoom();
    }

    ctlLeaveRoomButton.onclick = async (event) => {

        writeLog("ctlLeaveRoomButton click");
        event.preventDefault();

        ctlLeaveRoomButton.style.visibility = "hidden";
        ctlJoinInfo.value = "";

        ctlJoinRoomButton.disabled = false;
        ctlJoinRoomButton.style.visibility = "visible";

        await roomLeave();

    }

    async function writeLog(...params: any) {
        console.log(...["WEB", ...params]);
        // ctlStatus.innerHTML = statusText + ctlStatus.innerText + "<br>";
        ctlStatus.innerHTML = `${params.join(" ")}<br>${ctlStatus.innerHTML}`;
    }

    async function createJoinNewRoom() {
        writeLog("* createJoinNewRoom()");

        if (roomsClient.isInRoom()) {
            this.writeLog("ERROR: already in a room.");
            return;
        }

        let roomDuration = 1; // max duration of the room
        let maxPeers = 2; // max number of peers that can join

        let resultToken = await roomsClient.waitForNewRoomToken(roomDuration);
        if (resultToken.data.error) {
            writeLog("* unable to create room");
            await disconnectRooms();
            return;
        }

        let result = await roomsClient.waitForNewRoom(maxPeers, roomDuration);
        if (result.data.error) {
            writeLog("* unable to create room");
            await disconnectRooms();
            return;
        }

        let joinResult = await roomsClient.waitForRoomJoin(result.data.roomId, result.data.roomToken);
        if (joinResult.data.error) {
            writeLog("* unable to join room");
            await disconnectRooms();
            return;
        }

        writeLog("* joined room, peer count:" + joinResult.data.peers.length);
        let joinInfo: rooms.JoinInfo = {
            roomId: roomsClient.localPeer.roomId,
            roomToken: roomsClient.localPeer.roomToken
        }

        ctlJoinInfo.value = JSON.stringify(joinInfo);
        ctlLeaveRoomButton.style.visibility = "visible"

    }

    async function joinExistingRoom() {

        if (roomsClient.isInRoom()) {
            writeLog("ERROR: already in a room.");
            return;
        }

        if (!ctlJoinInfo.value) {
            writeLog("ERROR: no join info found.");
            return;
        }

        let joinInfo: rooms.JoinInfo = JSON.parse(ctlJoinInfo.value);
        if (!joinInfo) {
            writeLog("ERROR: invalid info found.");
            return;
        }

        let joinResult = await roomsClient.waitForRoomJoin(joinInfo.roomId, joinInfo.roomToken);
        if (joinResult.data.error) {
            writeLog("* error, could not join existing room " + joinResult);
            await disconnectRooms();
            return;
        }

        writeLog("* joined existing room");
        writeLog("* joined room, peer count:" + joinResult.data.peers.length);
        ctlLeaveRoomButton.style.visibility = "visible";

    }

    async function roomLeave() {
        for (let peer of roomsClient.peers) {
            destroyRemoteVideo(peer.peerId);
        }
        roomsClient.roomLeave();
        disconnectRooms();
    }

})();

