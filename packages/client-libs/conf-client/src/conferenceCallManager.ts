import {
    CallMessageType, ConferenceClosedMsg, ConferenceConfig, ConferenceType
    , GetContactsMsg, InviteMsg, InviteResultMsg, JoinMsg, JoinResultMsg
    , LeaveMsg, NewConferenceMsg, NewParticipantMsg, ParticipantLeftMsg, RegisterMsg, RegisterResultMsg, RejectMsg,
    RTCNeedOfferMsg
} from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { WebRTCClient } from "@rooms/webrtc-client";
import { RoomsClient, Peer } from "@rooms/rooms-client";

interface Participant {
    participantId: string,
    peerId?: string,
    displayName: string,
    peerConnection: RTCPeerConnection,
    mediaStream: MediaStream,
}

interface Conference {
    conferenceRoomId: string,
    conferenceToken: string, //provided  by the conferencing server
    conferenceTitle: string,
    roomToken: string, //provided by rooms server
    roomId: string,
    participants: Map<string, Participant>,
    config: ConferenceConfig
}

interface Contact {
    participantId: string,
    displayName: string,
    status: string
}

export enum EventTypes {
    registerResult = "registerResult",
    inviteReceived = "inviteReceived",
    inviteResult = "inviteResult",
    rejectReceived = "rejectReceived",
    connected = "connected",
    disconnected = "disconnected",
    joinResult = "joinResult",
    newParticipant = "newParticipant",
    participantLeft = "participantLeft",
    contactsReceived = "contactsReceived",
    confClosed = "confClosed"
}
type ConferenceEvent = (eventType: EventTypes, payload?: any) => void;

export class ConferenceCallManager {
    private DSTR = "ConferenceCallManager";
    private socket: WebSocketClient;
    localStream: MediaStream | null = null;
    private participantId: string = '';
    conferenceRoom: Conference = {
        conferenceRoomId: "",
        participants: new Map(),
        config: new ConferenceConfig(),
        conferenceToken: "",
        conferenceTitle: "",
        roomToken: "",
        roomId: ""
    };
    private contacts: Contact[] = [];
    private rtcClient: WebRTCClient;
    private roomsClient: RoomsClient;
    isConnected = false;


    config = {
        conf_wsURI: 'wss://localhost:3001'
    }

    onEvent: ConferenceEvent;

    constructor() {

        this.rtcClient = new WebRTCClient(this.rtc_onIceCandidate);

        this.roomsClient = new RoomsClient();
        this.roomsClient.initMediaSoupDevice();
        this.roomsClient.onPeerNewTrackEvent = this.room_onPeerNewTrack;
    }

    writeLog(...params: any) {
        console.log(this.DSTR, ...params);
    }

    room_onPeerNewTrack = (peer: Peer, track: MediaStreamTrack) => {
        this.writeLog("room_onPeerNewStream");
        let partcipant = this.getParticipant(peer.trackingId);
        if (partcipant) {
            partcipant.mediaStream.addTrack(track);
        } else {
            this.writeLog("room_onPeerNewStream -  participant not found.");
        }

    };

    rtc_onIceCandidate = (participantId: string, candidate: RTCIceCandidate) => {
        this.writeLog("rtc_onIceCandidate");
        //send ice candidate to server
        if (candidate) {
            const iceMsg = {
                type: CallMessageType.rtc_ice,
                data: {
                    toParticipantId: participantId,
                    fromParticipantId: this.participantId,
                    candidate: candidate
                }
            };
            this.sendToServer(iceMsg);
        }
    };

    connect(autoReconnect: boolean, conf_wsURIOverride: string = "") {

        this.writeLog("connect");

        if (conf_wsURIOverride) {
            this.config.conf_wsURI = conf_wsURIOverride;
        }

        // Connect to WebSocket server
        this.socket = new WebSocketClient();

        this.socket.addEventHandler("onopen", () => {

            this.isConnected = true;
            this.onEvent(EventTypes.connected);

        });

        this.socket.addEventHandler("onclose", () => {
            this.isConnected = false;
            //fire event onclose       
            this.onEvent(EventTypes.disconnected);
        });

        this.socket.addEventHandler("onerror", (error: any) => {
            console.error('WebSocket Error:', error);
            //fire event on disconnected
            this.onEvent(EventTypes.disconnected);
        });

        this.socket.addEventHandler("onmessage", (event: any) => {
            const message = JSON.parse(event.data);
            this.writeLog('Received message ' + message.type, message);

            switch (message.type) {
                case CallMessageType.registerResult:
                    this.onRegisterResult(message);
                    break;
                case CallMessageType.getContacts:
                    this.onContactsReceived(message);
                    break;
                case CallMessageType.invite:
                    this.onInviteReceived(message);
                    break;
                case CallMessageType.reject:
                    this.onRejectReceived(message);
                    break;
                case CallMessageType.inviteResult:
                    this.onInviteResult(message);
                    break;
                case CallMessageType.rtc_needOffer:
                    this.onRTCNeedOffer(message);
                    break;
                case CallMessageType.joinResult:
                    this.onJoinResult(message);
                    break;
                case CallMessageType.newParticipant:
                    this.onNewParticipant(message);
                    break;
                case CallMessageType.participantLeft:
                    this.onParticipantLeft(message);
                    break;
                case CallMessageType.conferenceClosed:
                    this.onConferenceClosed(message);
                    break;
                case CallMessageType.rtc_offer:
                    this.onRTCOffer(message);
                    break;
                case CallMessageType.rtc_answer:
                    this.onRTCAnswer(message);
                    break;
                case CallMessageType.rtc_ice:
                    this.onRTCIce(message);
                    break;
            }
        });

        this.socket.connect(this.config.conf_wsURI, autoReconnect);

    }

    disconnect() {
        this.writeLog("disconnect");
        this.socket.disconnect();
    }

    isInConference() {
        return this.conferenceRoom.conferenceRoomId > "";
    }

    public async getUserMedia(): Promise<MediaStream> {
        this.writeLog("getUserMedia");
        try {

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            // Initialize user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            return this.localStream
        } catch (err) {
            console.error('Error accessing media devices:', err);
        }
        return null;
    }

    register(username: string) {
        this.writeLog("register");
        // Register with the server
        const registerMsg: RegisterMsg = new RegisterMsg();
        registerMsg.data.userName = username;
        this.sendToServer(registerMsg);
    }

    getContacts() {
        this.writeLog("getContacts");
        const contactsMsg = new GetContactsMsg();
        this.sendToServer(contactsMsg);
    }

    newConference(title: string) {
        let msg = new NewConferenceMsg();
        msg.data.conferenceTitle = title;
        msg.data.conferenceConfig.type = ConferenceType.rooms;
        this.sendToServer(msg);
    }

    /**
     * send an invite to a contact that is onlin
     * @param contact 
     */
    invite(contact: Contact) {
        this.writeLog("invite()");
        const callMsg = new InviteMsg();
        callMsg.data.participantId = contact.participantId;

        callMsg.data.conferenceConfig = new ConferenceConfig();
        callMsg.data.conferenceConfig.maxParticipants = 2;
        // callMsg.data.newConfConfig.type  = ConferenceType.p2p;
        callMsg.data.conferenceConfig.type = ConferenceType.rooms;

        this.sendToServer(callMsg);
    }

    join() {
        let msg = new JoinMsg();
        msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
        msg.data.conferenceToken = this.conferenceRoom.conferenceToken;
        msg.data.roomId = this.conferenceRoom.roomId;
        msg.data.roomToken = this.conferenceRoom.roomToken;
        this.sendToServer(msg);
    }

    /*
    receive an invite result 
    */
    private async onInviteResult(message: InviteResultMsg) {
        this.writeLog("onInviteResult()");
        if (message.data.conferenceRoomId) {

            this.writeLog(`onInviteResult() - received a new conferenceRoomId ${message.data.conferenceRoomId}`);

            this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            this.conferenceRoom.config.type = message.data.conferenceConfig.type;
            this.conferenceRoom.conferenceToken = message.data.conferenceToken;
            this.conferenceRoom.roomToken = message.data.roomToken;
            this.conferenceRoom.roomId = message.data.roomId;

            //join the conference room
            const joinMsg = new JoinMsg();
            joinMsg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            joinMsg.data.conferenceToken = this.conferenceRoom.conferenceToken;
            joinMsg.data.roomId = this.conferenceRoom.roomId;
            joinMsg.data.roomToken = this.conferenceRoom.roomToken;
            this.sendToServer(joinMsg);

        }
        this.onEvent(EventTypes.inviteResult, message);
    }

    private async onJoinResult(message: JoinResultMsg) {
        this.writeLog("onJoinResult()");
        if (message.data.error) {
            this.onEvent(EventTypes.joinResult, message);
            this.writeLog("onJoinResult error: ", message.data.error);
            return;
        }

        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.conferenceRoom.conferenceToken = message.data.conferenceToken;
        this.conferenceRoom.roomId = message.data.roomId;
        this.conferenceRoom.roomToken = message.data.roomToken;
        this.conferenceRoom.config = message.data.conferenceConfig;

        if (this.conferenceRoom.config.type == ConferenceType.rooms) {
            this.writeLog("conferenceType: rooms");

            let roomURI = message.data.roomURI;
            //get the URL from the server you could do a round robin for load balancing

            await this.rooms_waitForConnection(roomURI);

            await this.roomsClient.waitForRoomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);
            if (this.roomsClient.isConnected) {
                this.writeLog("room connected");
            } else {
                this.writeLog("onJoinResult error: ", "failed to join room");
                return;
            }

        } else {
            this.writeLog("conferenceType: p2p");
        }

        this.writeLog('joined conference room:', this.conferenceRoom.conferenceRoomId);
        this.writeLog('participants:', message.data.participants.length);

        //send joinResult before sending participant events
        this.onEvent(EventTypes.joinResult, message);

        for (let p of message.data.participants) {
            this.writeLog('createPeerConnection for existing:', p.participantId);
            let participant: Participant = {
                participantId: p.participantId,
                displayName: p.displayName,
                peerConnection: null,
                mediaStream: new MediaStream()
            };

            if (this.conferenceRoom.config.type == ConferenceType.rooms) {
                //the rooms client will create the producer for each client

            } else {
                let connInfo = this.rtcClient.createPeerConnection(p.participantId);
                participant.peerConnection = connInfo.pc;
                participant.mediaStream = connInfo.stream;
            }

            this.conferenceRoom.participants.set(p.participantId, participant);
            this.writeLog("participant added " + p.participantId);

            //this will create video elements in the UI
            let msg = new NewParticipantMsg();
            msg.data.participantId = p.participantId;
            msg.data.displayName = p.displayName;
            msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            this.onEvent(EventTypes.newParticipant, msg);

        }

    }

    async onInviteReceived(message: InviteMsg) {
        this.writeLog("onInviteReceived()");
        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.conferenceRoom.conferenceTitle = message.data.conferenceTitle;
        this.conferenceRoom.conferenceToken = message.data.conferenceToken;

        if (message.data.conferenceConfig.type == ConferenceType.rooms) {
            this.conferenceRoom.roomId = message.data.roomId;
            this.conferenceRoom.roomToken = message.data.roomToken;
        }
        this.onEvent(EventTypes.inviteReceived, message);
    }

    acceptInvite(message: InviteMsg) {
        this.writeLog("acceptInvite()");
        const joinMsg = new JoinMsg();
        joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
        joinMsg.data.conferenceToken = message.data.conferenceToken;
        joinMsg.data.roomId = message.data.roomId;
        joinMsg.data.roomToken = message.data.roomToken;
        this.sendToServer(joinMsg);
    }

    reject(participantId: string, conferenceRoomId: string) {
        this.writeLog("reject()");
        let msg = new RejectMsg();
        msg.data.conferenceRoomId = conferenceRoomId;
        msg.data.fromParticipantId = this.participantId;
        msg.data.toParticipantId = participantId;
        this.sendToServer(msg);

        this.conferenceRoom.conferenceRoomId = "";
    }

    toggleVideo() {
        this.writeLog("toggleVideo");
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
            }
        }
    }

    toggleAudio() {
        this.writeLog("toggleAudio");
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
            }
        }
    }

    leave() {
        this.writeLog("leave");
        if (this.conferenceRoom.conferenceRoomId) {

            const leaveMsg = new LeaveMsg();
            leaveMsg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            leaveMsg.data.participantId = this.participantId;
            this.sendToServer(leaveMsg);

            if (this.conferenceRoom.config.type == ConferenceType.rooms) {
                this.roomsClient.roomLeave();
            }

        } else {
            this.writeLog("not in conerence");
        }
        this.resetCallState();
    }

    getParticipant(participantId: string): Participant {
        this.writeLog("getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }

    private sendToServer(message: any) {
        this.writeLog("sendToServer " + message.type, message);
        if (this.socket) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }

    private onRegisterResult(message: RegisterResultMsg) {
        this.writeLog("onRegisterResult");
        if (message.data.error) {
            console.error(message.data.error);
            this.onEvent(EventTypes.registerResult, message);
        } else {

            this.onEvent(EventTypes.registerResult, message);

            this.participantId = message.data.participantId;
            this.writeLog('Registered with participantId:', this.participantId, "conferenceRoomId:", message.data.conferenceRoomId);

            if (message.data.conferenceRoomId) {
                //we logged into an existing conference
                //rejoin conference?
                this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            }
        }
    }

    private onContactsReceived(message: GetContactsMsg) {
        this.writeLog("onContactsReceived");
        this.contacts = message.data.filter(c => c.participantId !== this.participantId);
        //fire event new contacts

        this.onEvent(EventTypes.contactsReceived, this.contacts);

    }

    private onRejectReceived(message: InviteResultMsg) {
        this.writeLog("onRejectReceived");
        this.onEvent(EventTypes.rejectReceived, message);
    }

    private onRTCNeedOffer(message: RTCNeedOfferMsg) {
        //this is only a webrtc call
        this.writeLog("onNeedOffer " + message.data.participantId);

        //server will send need offer when needed to connect
        let connInfo = this.rtcClient.createPeerConnection(message.data.participantId);
        this.conferenceRoom.participants.set(message.data.participantId, {
            participantId: message.data.participantId,
            displayName: message.data.displayName,
            peerConnection: connInfo.pc,
            mediaStream: connInfo.stream
        });

        this.sendOffer(connInfo.pc, message.data.participantId);
    }

    private onNewParticipant(message: NewParticipantMsg) {
        this.writeLog('onNewParticipant - New participant joined:', message.data);

        let partcipant = {
            participantId: message.data.participantId,
            displayName: message.data.participantId,
            peerConnection: null,
            mediaStream: new MediaStream()
        };

        this.conferenceRoom.participants.set(message.data.participantId, partcipant);

        if (this.conferenceRoom.config.type == ConferenceType.rooms) {

        } else {
            let connInfo = this.rtcClient.createPeerConnection(partcipant.participantId);
            partcipant.peerConnection = connInfo.pc;
            partcipant.mediaStream = connInfo.stream;
        }

        this.onEvent(EventTypes.newParticipant, message);
    }

    private onParticipantLeft(message: ParticipantLeftMsg) {
        const participantId = message.data.participantId;
        this.writeLog('Participant left:', participantId);

        // Close peer connection
        let p = this.conferenceRoom.participants.get(participantId);
        if (p) {
            if (p.mediaStream) {
                for (let track of p.mediaStream.getTracks()) {
                    track.stop();
                }
            }
            if (p.peerConnection) {
                p.peerConnection.close();
            }
            this.conferenceRoom.participants.delete(participantId);
        }

        this.onEvent(EventTypes.participantLeft, message);
    }

    private onConferenceClosed(message: ConferenceClosedMsg) {
        //we received a conference closed message
        this.writeLog("onConferenceClosed");
        this.resetCallState();
    }

    private resetCallState() {
        this.conferenceRoom.conferenceRoomId = "";
        // Close all peer connections
        this.conferenceRoom.participants.forEach((p) => {

            if (p.peerConnection) {
                p.peerConnection?.close();
            }

            if (p.mediaStream) {
                for (let t of p.mediaStream.getTracks()) {
                    t.stop();
                }
            }

        });

        this.conferenceRoom.participants.clear();
    }

    private async sendOffer(pc: RTCPeerConnection, toParticipantId: string) {
        this.writeLog("sendOffer");
        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const offerMsg = {
            type: CallMessageType.rtc_offer,
            data: {
                toParticipantId: toParticipantId,
                fromParticipantId: this.participantId,
                sdp: pc.localDescription
            }
        };
        this.sendToServer(offerMsg);
    }

    private async onRTCOffer(message: any) {
        this.writeLog("onRTCOffer");
        try {
            const fromParticipantId = message.data.fromParticipantId;

            // Create peer connection if it doesn't exist            
            await this.rtcClient.setRemoteDescription(fromParticipantId, new RTCSessionDescription(message.data.sdp))
            const answer = await this.rtcClient.createAnswer(fromParticipantId);

            const answerMsg = {
                type: CallMessageType.rtc_answer,
                data: {
                    toParticipantId: fromParticipantId,
                    fromParticipantId: this.participantId,
                    sdp: answer
                }
            };
            this.sendToServer(answerMsg);
        } catch (err) {
            console.error('Error handling offer:', err);
        }
    }

    private async onRTCAnswer(message: any) {
        this.writeLog("onRTCAnswer");

        try {
            const fromParticipantId = message.data.fromParticipantId;
            const p = this.conferenceRoom.participants.get(fromParticipantId);

            if (p.peerConnection) {
                await p.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
            }
        } catch (err) {
            console.error('Error handling answer:', err);
        }
    }

    private async onRTCIce(message: any) {
        this.writeLog("onRTCIce");
        try {
            const fromParticipantId = message.data.fromParticipantId;
            const p = this.conferenceRoom.participants.get(fromParticipantId);

            if (p.peerConnection) {
                await p.peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
            }
        } catch (err) {
            console.error('Error handling ICE candidate:', err);
        }
    }

    private async rooms_waitForConnection(roomURI: string) {

        //connect to the rooms server in one function given a roomURI

        this.writeLog("roomsCreateTransports");

        this.roomsClient.onRoomPeerJoinedEvent = (roomId: string, peer: Peer) => {
            //map the participantid to the peerid
            let p = this.conferenceRoom.participants.get(peer.trackingId);
            if (p) {
                p.peerId = peer.peerId;
            }
        };

        //inite media soup device
        this.roomsClient.initMediaSoupDevice();

        //connect and wait for a connection
        await this.roomsClient.waitForConnect(roomURI);

        //wait for transport to be created, and connected        
        let isTransportsConnected = { recv: false, send: false };

        isTransportsConnected.recv = this.roomsClient.transportReceive && this.roomsClient.transportReceive.connectionState == "connected";
        isTransportsConnected.send = this.roomsClient.transportSend && this.roomsClient.transportSend.connectionState == "connected";

        this.writeLog(`recvTransportRef.connectionState=${this.roomsClient.transportReceive?.connectionState}`);
        this.writeLog(`sendTransportRef.connectionState=${this.roomsClient.transportSend?.connectionState}`);

        if (isTransportsConnected.recv && isTransportsConnected.send) {

            this.writeLog(`isTransportsConnected`);
            await this.roomsClient.waitForRegister(this.participantId, "");

        } else {

            this.writeLog(`register and create transports`);

            let transportConnectedResolve: any;
            let transportConnectedReject: any;
            let transportsConnected = () => {
                this.writeLog("await transportsConnected created")
                return new Promise((resolve, reject) => {
                    transportConnectedResolve = resolve;
                    transportConnectedReject = reject;

                    setTimeout(() => {
                        transportConnectedReject("transports timedOut");
                    }, 5000);
                });
            };

            this.roomsClient.onTransportsReadyEvent = async (transport) => {

                this.writeLog("onTransportsReadyEvent direction:" + transport.direction);

                if (transport.direction == "send") {
                    isTransportsConnected.send = true;
                    transportConnectedResolve();
                }

            };

            //register will create the transports, after a successful registration
            await this.roomsClient.waitForRegister(this.participantId, "");

            await transportsConnected();
        }


        this.writeLog("transported created received.")

    }

}
