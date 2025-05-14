import {
    CallMessageType, ConferenceClosedMsg, ConferenceConfig, ConferenceType
    , GetContactsMsg, InviteMsg, InviteResultMsg, JoinMsg, JoinResultMsg
    , LeaveMsg, NeedOfferMsg, NewParticipantMsg, ParticipantLeftMsg, RegisterMsg, RegisterResultMsg, RejectMsg
} from "./conferenceSharedModels";
import { WebSocketManager } from "./webSocketManager";
import { WebRTCClient } from "./rtcClient/webRTCClient";
import { RoomsClient } from "./roomsClient/roomsClient"
import { Peer } from "./roomsClient/peer";

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

export const enum EventTypes {
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
    private socket: WebSocketManager;
    localStream: MediaStream | null = null;
    private participantId: string = '';
    conferenceRoom: Conference = {
        conferenceRoomId: "",
        participants: new Map(),
        config: new ConferenceConfig(),
        conferenceToken: "",
        roomToken: "",
        roomId: ""
    };
    private contacts: Contact[] = [];
    private rtcClient: WebRTCClient;
    private roomsClient: RoomsClient;
    isConnected = false;


    config = {
        conf_wsURI: 'wss://localhost:3001',
        room_wsURI: 'wss://localhost:3000',
    }
    onEvent: ConferenceEvent;

    constructor() {

        this.rtcClient = new WebRTCClient(this.rtc_onIceCandidate);
        this.roomsClient = new RoomsClient();
        this.roomsClient.initMediaSoupDevice();


    }

    rtc_onIceCandidate = (participantId: string, candidate: RTCIceCandidate) => {
        console.log(this.DSTR, "rtc_onIceCandidate");
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

    connect(autoReconnect: boolean, conf_wsURIOverride: string = "", room_wsURIOverride: string = "") {

        console.log(this.DSTR, "connect");

        if (conf_wsURIOverride) {
            this.config.conf_wsURI = conf_wsURIOverride;
        }

        if (room_wsURIOverride) {
            this.config.room_wsURI = room_wsURIOverride;
        }

        // Connect to WebSocket server
        this.socket = new WebSocketManager();

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
            console.log('Received message ' + message.type, message);

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
                case CallMessageType.needOffer:
                    this.onNeedOffer(message);
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
        console.log(this.DSTR, "disconnect");
        this.socket.disconnect();
    }

    isInConference() {
        return this.conferenceRoom.conferenceRoomId > "";
    }

    public async getUserMedia(): Promise<MediaStream> {
        console.log(this.DSTR, "getUserMedia");
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
        console.log(this.DSTR, "register");
        // Register with the server
        const registerMsg: RegisterMsg = new RegisterMsg();
        registerMsg.data.userName = username;
        this.sendToServer(registerMsg);
    }

    getContacts() {
        console.log(this.DSTR, "getContacts");
        const contactsMsg = new GetContactsMsg();
        this.sendToServer(contactsMsg);
    }

    invite(contact: Contact) {
        console.log(this.DSTR, "invite");
        const callMsg = new InviteMsg();
        callMsg.data.participantId = contact.participantId;

        callMsg.data.newConfConfig = new ConferenceConfig();
        callMsg.data.newConfConfig.maxParticipants = 2;
        // callMsg.data.newConfConfig.type  = ConferenceType.p2p;
        callMsg.data.newConfConfig.type = ConferenceType.rooms;

        this.sendToServer(callMsg);
    }

    private async onInviteResult(message: InviteResultMsg) {
        console.log(this.DSTR, "onInviteResult");
        if (message.data.conferenceRoomId) {
            this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            this.conferenceRoom.config.type = message.data.conferenceType;
            this.conferenceRoom.conferenceToken = message.data.conferenceToken;
            this.conferenceRoom.roomToken = message.data.roomToken;
            this.conferenceRoom.roomId = message.data.roomId;

            if (this.conferenceRoom.config.type == ConferenceType.rooms) {
                await this.roomsCreateTransports();
                this.join(this.conferenceRoom.conferenceRoomId);
            } else {
                //join the room
                this.join(this.conferenceRoom.conferenceRoomId);
            }

        }
        this.onEvent(EventTypes.inviteResult, message);
    }

    join(conferenceRoomId: string) {
        console.log(this.DSTR, "join");
        const joinMsg = new JoinMsg();
        joinMsg.data.conferenceRoomId = conferenceRoomId;
        joinMsg.data.conferenceRoomId
        this.sendToServer(joinMsg);
    }

    private async onJoinResult(message: JoinResultMsg) {
        console.log(this.DSTR, "onJoinResult");

        this.onEvent(EventTypes.joinResult, message);

        if (message.data.error) {
            console.log(this.DSTR, "onJoinResult error: ", message.data.error);
            return;
        }

        this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
        this.conferenceRoom.conferenceToken = message.data.conferenceToken;
        this.conferenceRoom.roomId = message.data.roomId;
        this.conferenceRoom.roomToken = message.data.roomToken;

        if (this.conferenceRoom.config.type == ConferenceType.rooms) {
            //join the room
            this.roomsClient.roomJoin(this.conferenceRoom.roomId, this.conferenceRoom.roomToken);
            //the roomsClient will produce the local stream when roomJoin is successful
        }

        console.log(this.DSTR, 'joined conference room:', this.conferenceRoom.conferenceRoomId);
        console.log(this.DSTR, 'participants:', message.data.participants.length);

        for (let p of message.data.participants) {
            console.log(this.DSTR, 'createPeerConnection for existing:', p.participantId);
            if (this.conferenceRoom.config.type == ConferenceType.rooms) {
                //the rooms client will create the producer for each client                

            } else {
                let connInfo = this.rtcClient.createPeerConnection(p.participantId);
                //create a new participant
                this.conferenceRoom.participants.set(p.participantId, {
                    participantId: p.participantId,
                    displayName: p.displayName,
                    peerConnection: connInfo.pc,
                    mediaStream: connInfo.stream
                });
            }

            //this will create video elements in the UI
            let msg = new NewParticipantMsg();
            msg.data.participantId = p.participantId;
            msg.data.displayName = p.displayName;
            msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            this.onEvent(EventTypes.newParticipant, msg);

        }

    }

    reject(participantId: string, conferenceRoomId: string) {
        console.log(this.DSTR, "reject");
        let msg = new RejectMsg();
        msg.data.conferenceRoomId = conferenceRoomId;
        msg.data.fromParticipantId = this.participantId;
        msg.data.toParticipantId = participantId;
        this.sendToServer(msg);

        this.conferenceRoom.conferenceRoomId = "";
    }

    toggleVideo() {
        console.log(this.DSTR, "toggleVideo");
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
            }
        }
    }

    toggleAudio() {
        console.log(this.DSTR, "toggleAudio");
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
            }
        }
    }

    leave() {
        console.log(this.DSTR, "leave");
        if (this.conferenceRoom.conferenceRoomId) {
            const leaveMsg = new LeaveMsg();
            leaveMsg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            leaveMsg.data.participantId = this.participantId;
            this.sendToServer(leaveMsg);
            this.conferenceRoom.conferenceRoomId = "";
        } else {
            console.log(this.DSTR, "not in conerence");
        }
        this.resetCallState();
    }

    getParticipant(participantId: string): Participant {
        console.log(this.DSTR, "getParticipant");
        return this.conferenceRoom.participants.get(participantId);
    }

    private sendToServer(message: any) {
        console.log(this.DSTR, "sendToServer " + message.type, message);
        if (this.socket) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }

    private onRegisterResult(message: RegisterResultMsg) {
        console.log(this.DSTR, "onRegisterResult");
        if (message.data.error) {
            console.error(message.data.error);
            this.onEvent(EventTypes.registerResult, message);
        } else {

            this.onEvent(EventTypes.registerResult, message);

            this.participantId = message.data.participantId;
            console.log('Registered with participantId:', this.participantId, "conferenceRoomId:", message.data.conferenceRoomId);

            if (message.data.conferenceRoomId) {
                //we logged into an existing conference
                //rejoin conference?
                this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            }
        }
    }

    private onContactsReceived(message: GetContactsMsg) {
        console.log(this.DSTR, "onContactsReceived");
        this.contacts = message.data.filter(c => c.participantId !== this.participantId);
        //fire event new contacts

        this.onEvent(EventTypes.contactsReceived, this.contacts);

    }

    private onInviteReceived(message: InviteMsg) {
        console.log(this.DSTR, "onInviteReceived");
        this.onEvent(EventTypes.inviteReceived, message);
    }

    private onRejectReceived(message: InviteResultMsg) {
        console.log(this.DSTR, "onRejectReceived");
        this.onEvent(EventTypes.rejectReceived, message);
    }

    private onNeedOffer(message: NeedOfferMsg) {
        //this is only a webrtc call
        console.log(this.DSTR, "onNeedOffer " + message.data.participantId);

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
        console.log(this.DSTR, 'New participant joined:', message.data);
        let connInfo = this.rtcClient.createPeerConnection(message.data.participantId);
        this.conferenceRoom.participants.set(message.data.participantId, {
            participantId: message.data.participantId,
            displayName: message.data.participantId,
            peerConnection: connInfo.pc,
            mediaStream: connInfo.stream
        });
        this.onEvent(EventTypes.newParticipant, message);
    }

    private onParticipantLeft(message: ParticipantLeftMsg) {
        const participantId = message.data.participantId;
        console.log(this.DSTR, 'Participant left:', participantId);

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
        console.log(this.DSTR, "onConferenceClosed");
        this.resetCallState();
    }

    private resetCallState() {
        this.conferenceRoom.conferenceRoomId = "";
        // Close all peer connections
        this.conferenceRoom.participants.forEach((p) => {
            p.peerConnection?.close();
            for (let t of p.mediaStream.getTracks()) {
                t.stop();
            }
        });

        this.conferenceRoom.participants.clear();
    }

    private async sendOffer(pc: RTCPeerConnection, toParticipantId: string) {
        console.log(this.DSTR, "sendOffer");
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
        console.log(this.DSTR, "onRTCOffer");
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
        console.log(this.DSTR, "onRTCAnswer");

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
        console.log(this.DSTR, "onRTCIce");
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

    private async roomsCreateTransports() {

        this.roomsClient.onRoomNewPeerEvent = (peer: Peer) => {
            //map the participantid to the peerid
            let p = this.conferenceRoom.participants.get(peer.trackingId);
            if(p) {
                p.peerId = peer.peerId;
            }
        };

        //inite media soup device
        this.roomsClient.initMediaSoupDevice();

        //connect and wait for a connection
        await this.roomsClient.connectAsync(this.config.room_wsURI);

        //register will create the transports, after a successful registration
        this.roomsClient.register(this.participantId, "");

        //wait for transport to be created, and connected        
        let isTransportsConnected = { recv: false, send: false };
        let transportsConnectedResolve: any;
        let transportsConnectedReject: any;
        let transportsConnected = () => {
            return new Promise((resolve, reject) => {
                transportsConnectedResolve = resolve;
                transportsConnectedReject = reject;
            });
        };

        this.roomsClient.onTransportsReady = async (transport) => {
            await this.roomsClient.waitForTransportConnected(transport);
            if (transport.direction == "recv") {
                isTransportsConnected.recv = true;
            }

            if (transport.direction == "send") {
                isTransportsConnected.send = true;
            }

            transportsConnected();

            if (isTransportsConnected.send && isTransportsConnected.recv) {
                transportsConnectedResolve(true);
            }
            setTimeout(() => {
                transportsConnectedReject("transports timedOut");
            }, 5000);

        };

        await transportsConnected();

    }

}
