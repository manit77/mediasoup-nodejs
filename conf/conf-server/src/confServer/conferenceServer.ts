import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import {
    CallMessageType, GetContactsResultsMsg
    , InviteMsg, InviteResultMsg
    , RegisterMsg, RegisterResultMsg, RejectMsg
    , Contact, AcceptMsg,
    ConferenceReadyMsg,
    WebRoutes,
    AcceptResultMsg,
    LeaveMsg,
    InviteCancelledMsg,
    CreateConfMsg,
    CreateConfResultMsg,
    JoinConfMsg,
    JoinConfResultMsg,
    ConferenceRoomConfig
} from '@conf/conf-models';
import { ConferenceRoom, IAuthPayload, Participant } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { jwtSign, jwtVerify } from '../utils/jwtUtil.js';
import { RoomCallBackData, RoomConfig, RoomPeerCallBackData } from '@rooms/rooms-models';
import express, { NextFunction, Request, Response } from 'express';

export interface ConferenceServerConfig {
    conf_server_port: number,
    conf_reconnection_timeout: number,
    conf_secret_key: string,
    conf_max_peers_per_conf: number,
    conf_token_expires_min: number,
    conf_callback_urls: {},
    room_access_token: string,
    room_servers_uris: string[],
    cert_file_path: string,
    cert_key_path: string
}

export class ConferenceServer {

    webSocketServer: WebSocketServer;
    participants = new Map<WebSocket, Participant>();
    conferences = new Map<string, ConferenceRoom>();
    config: ConferenceServerConfig;
    nextRoomURIIdx = 0;
    app: express.Express;
    httpServer: https.Server

    constructor(config: ConferenceServerConfig, app: express.Express, httpServer: https.Server) {
        this.config = config;
        this.app = app;
        this.httpServer = httpServer;
    }

    async start() {

        this.app.post(WebRoutes.onRoomClosed, (req, res) => {
            console.log(WebRoutes.onRoomClosed);

            let msg = req.body as RoomCallBackData;
            console.log(`roomId: ${msg.roomId} roomTrackingId: ${msg.trackingId}`);

        });

        this.app.post(WebRoutes.onPeerJoined, (req, res) => {
            console.log(WebRoutes.onPeerJoined);

            let msg = req.body as RoomPeerCallBackData;
            console.log(`peerId: ${msg.peerId} peerTrackingId: ${msg.peerTrackingId} roomId: ${msg.roomId} roomTrackingId: ${msg.roomTrackingId}`);
        });

        this.app.post(WebRoutes.onPeerLeft, (req, res) => {
            console.log(WebRoutes.onPeerLeft);
            let msg = req.body as RoomPeerCallBackData;
            console.log(`peerId: ${msg.peerId} peerTrackingId: ${msg.peerTrackingId} roomId: ${msg.roomId} roomTrackingId: ${msg.roomTrackingId}`);

        });

        this.httpServer.listen(this.config.conf_server_port, async () => {
            console.log(`Server running at https://0.0.0.0:${this.config.conf_server_port}`);
            this.initWebSocket();
        });
    }

    async initWebSocket() {

        this.webSocketServer = new WebSocketServer({ server: this.httpServer });
        this.webSocketServer.on('connection', (ws) => {

            console.log("socket connected participants: " + this.participants.size);

            ws.onmessage = async (message) => {

                try {
                    const msgIn = JSON.parse(message.data.toString());

                    console.log("msgIn, ", msgIn);

                    if (!msgIn.type) {
                        console.error("message has no type");
                    }

                    switch (msgIn.type) {

                        case CallMessageType.register:
                            this.onRegister(ws, msgIn);
                            break;
                        case CallMessageType.getContacts:
                            this.onGetContacts(ws, msgIn);
                            break;
                        case CallMessageType.createConf:
                            this.onCreateConference(ws, msgIn);
                            break;
                        case CallMessageType.joinConf:
                            this.onJoinConference(ws, msgIn);
                            break;
                        case CallMessageType.invite:
                            this.onInvite(ws, msgIn);
                            break;
                        case CallMessageType.inviteCancelled:
                            this.onInviteCancelled(ws, msgIn);
                            break;
                        case CallMessageType.reject:
                            this.onReject(ws, msgIn);
                            break;
                        case CallMessageType.accept:
                            this.onAccept(ws, msgIn);
                            break;
                        case CallMessageType.leave:
                            this.onLeave(ws, msgIn);
                            break;

                    }
                } catch (err) {
                    console.error(err);
                }
            };

            ws.onclose = () => {
                const participant = this.participants.get(ws);
                if (participant) {
                    // Remove from active participants map
                    this.participants.delete(ws);

                    if (participant.conferenceRoom) {
                        participant.conferenceRoom.removeParticipant(participant.participantId);
                    }

                    console.log(`participant ${participant.participantId} disconnected. participants: ${this.participants.size} rooms: ${this.conferences.size}`);

                    //update contacts
                    this.broadCastContacts();
                }
            }

        });
    }

    send(ws: WebSocket, msg: any): boolean {
        console.log('send ', msg);
        try {
            ws.send(JSON.stringify(msg));
            return true;
        } catch (err) {
            console.log(err);
            return false;
        }
    }

    createParticipant(ws: WebSocket, userName: string, displayName: string): Participant {

        if (!ws) {
            console.error("no websocket");
            return;
        }

        let part = new Participant();
        part.participantId = "part-" + randomUUID().toString();
        part.displayName = displayName;
        part.userName = userName;
        part.socket = ws;
        this.participants.set(ws, part);
        console.log("new participant created " + part.participantId);
        return part;
    }

    getOrCreateConference(conferenceId?: string, trackingId?: string, config?: ConferenceRoomConfig) {

        //find room by tracking id
        let conference: ConferenceRoom;

        if (trackingId) {
            conference = [...this.conferences.values()].find(c => c.trackingId === trackingId);
            if (conference) {
                console.log("conference found by trackingid", trackingId)
                return conference;
            }
        } else if (conferenceId) {
            conference = [...this.conferences.values()].find(c => c.id === conferenceId);
            if (conference) {
                console.log("conference found by conferenceId", trackingId)
                return conference;
            }
        }

        conference = new ConferenceRoom();
        conference.id = conferenceId ?? this.generateConferenceId();
        conference.trackingId = trackingId;
        if (config) {
            conference.config = config;
        }

        if (conference.config.roomTimeoutSecs) {
            conference.timeoutSecs = conference.config.roomTimeoutSecs;
        } else {
            //default timeout is one hour
            conference.timeoutSecs = 60 * 60;
        }

        this.conferences.set(conference.id, conference);

        conference.onClose = (conf: ConferenceRoom) => {
            this.conferences.delete(conf.id);
            console.log(`conference removed. ${conf.id}`);
        };

        console.log(`conference created.`);

        return conference;
    }

    generateConferenceId() {
        return "conf-" + randomUUID().toString();
    }

    /**
     * registers a socket connection
     * @param ws 
     * @param msgIn 
     */
    async onRegister(ws: WebSocket, msgIn: RegisterMsg) {
        console.log("onRegister " + msgIn.data.userName);

        if (!msgIn.data.userName) {
            console.error("userName is required.");
            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "userName is required.";
            return errorMsg;
        }

        let participant: Participant = this.createParticipant(ws, msgIn.data.userName, msgIn.data.userName);
        let authToken: string = msgIn.data.authToken;
        let authTokenObject: IAuthPayload;
        if (msgIn.data.authToken) {
            authTokenObject = jwtVerify(this.config.conf_secret_key, msgIn.data.authToken) as IAuthPayload;
            participant.role = authTokenObject.role;
        } else {
            //login as guest
            authTokenObject = {
                role: "guest",
                username: msgIn.data.userName
            };
            authToken = jwtSign(this.config.conf_secret_key, authTokenObject);
        }

        let msg = new RegisterResultMsg();
        msg.data = {
            userName: participant.displayName,
            authToken: authToken,
            participantId: participant.participantId,
            role: authTokenObject.role ?? "guest"
        };

        this.send(ws, msg);

        this.broadCastContacts();

        return msg;

    }

    async broadCastContacts() {

        console.log("broadCastContacts");
        //broadcast to all participants of contacts
        let contactsMsg = new GetContactsResultsMsg();
        contactsMsg.data = [...this.participants.values()].map(p => ({
            participantId: p.participantId,
            displayName: p.displayName
        }) as Contact);

        for (let [socket, p] of this.participants.entries()) {
            //if (p.role !== "guest") {
                this.send(socket, contactsMsg);
            //}
        }

    }

    async onGetContacts(ws: WebSocket, msgIn?: any) {
        
        console.log("onGetContacts");

        let partcipant = this.getParticipantByWS(ws);
        if (!partcipant) {
            console.error("participant not registered");
            return;
        }

        // if (partcipant.role === "guest") {
        //     console.error("participant must be an authenticated user");
        //     return;
        // }

        let msg = new GetContactsResultsMsg();
        this.getParticipantsExcept(ws).forEach((p) => {
            msg.data.push({
                displayName: p.displayName,
                participantId: p.participantId,
                status: "online"
            });
        });

        this.send(ws, msg);
    }

    getParticipantByWS(ws: WebSocket) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.socket == ws) {
                return participant;
            }
        }
        return null;
    }

    getParticipant(participantId: string) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.participantId == participantId) {
                return participant;
            }
        }
        return null;
    }

    getParticipantsExcept(ws: WebSocket) {
        return [...this.participants.values()].filter(p => p.socket !== ws);
    }

    /**
     * invite a peer, if not conference room is created create one.
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    async onInvite(ws: WebSocket, msgIn: InviteMsg) {
        console.log("onInvite");

        let caller = this.participants.get(ws);

        if (!caller) {
            console.error("caller not found.");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "failed to add you to the conference.";
            this.send(ws, errorMsg);
            return;
        }

        // if (caller.role === "guest") {
        //     console.error("guest cannot send an invite.");
        //     return;
        // }

        let receiver = this.getParticipant(msgIn.data.participantId);
        if (!receiver) {
            console.error("receiver not found.");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party not found.";
            this.send(caller.socket, errorMsg);
            return;
        }

        if (receiver.conferenceRoom) {
            console.error("receiver is in another conference room.");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "busy.";
            this.send(caller.socket, errorMsg);
            return;
        }

        let conference = caller.conferenceRoom;

        if (!conference) {
            conference = this.getOrCreateConference();
            conference.addParticipant(caller);
        }

        let inviteResultMsg = new InviteResultMsg();
        //send InviteResult back to the caller
        inviteResultMsg.data.conferenceRoomId = conference.id;
        inviteResultMsg.data.participantId = receiver.participantId;

        this.send(ws, inviteResultMsg);

        //forward the call to the receiver
        let msg = new InviteMsg();
        msg.data.participantId = caller.participantId;
        msg.data.displayName = caller.displayName;
        msg.data.conferenceRoomId = conference.id;
        msg.data.conferenceRoomConfig = conference.config;

        this.send(receiver.socket, msg);

    }

    async onInviteCancelled(ws: WebSocket, msgIn: InviteCancelledMsg) {
        console.log("onInviteCancel");

        let caller = this.participants.get(ws);

        if (!caller) {
            console.error("caller not found.");
            return;
        }

        let receiver = this.getParticipant(msgIn.data.participantId);
        if (!receiver) {
            console.error("participant not found.");
            return;
        }

        let conf = this.conferences.get(msgIn.data.conferenceRoomId);
        if (!conf) {
            console.error("conference not found.");
            return;
        }

        if (caller.conferenceRoom != conf) {
            console.error("not the same conference room.");
            return;
        }

        if (conf.participants.size == 1) {
            console.error("closing conference room");
            conf.close();
        }

        let msg = new InviteCancelledMsg();
        msg.data.conferenceRoomId = conf.id;
        msg.data.participantId = caller.participantId;
        this.send(receiver.socket, msg);
    }

    async onReject(ws: WebSocket, msgIn: RejectMsg) {
        console.log("onReject");
        let participant = this.getParticipant(msgIn.data.toParticipantId);

        if (!participant) {
            console.error("onReject - participant not found or not connected");
            return;
        }

        let conf = this.conferences.get(msgIn.data.conferenceRoomId);
        if (!conf) {
            console.error("onReject - conference not found.");
            return;
        }

        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        }
    }

    async onAccept(ws: WebSocket, msgIn: AcceptMsg) {

        console.log("onAccept()");
        let conference = this.conferences.get(msgIn.data.conferenceRoomId);

        if (!conference) {
            console.error("ERROR: conference room does not exist");
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "unable to join conference";
            this.send(ws, msg);
            return;
        }

        let participant = this.getParticipantByWS(ws);
        if (!participant) {
            console.error("onAccept - participant not found or not connected");
            return;
        }

        if (conference.status == "closed") {
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "conference is closed";
            this.send(ws, msg);
            return;
        }

        if (conference.status == "ready") {
            this.sendConferenceReady(conference, participant);
            return;
        }

        //wait for ready state
        let timeoutid = setTimeout(() => {
            console.error("timeout waiting to join conference.");
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "timeout, unable to join conference";
            this.send(ws, msg);
        }, 5000);

        conference.addOnReadyListener(() => {
            conference.addParticipant(participant);
            clearTimeout(timeoutid);
        });

        if (conference.status == "none") {            
            if (await this.startConference(conference)) {
                for (let p of conference.participants.values()) {
                    this.sendConferenceReady(conference, p);
                }
            }
        }
    }

    async onCreateConference(ws: WebSocket, msgIn: CreateConfMsg) {
        console.log("onCreateConference");

        let caller = this.participants.get(ws);
        if (!caller) {
            console.error("caller not found.");
            let errorMsg = new CreateConfResultMsg();
            errorMsg.data.error = "failed to add you to the conference.";
            this.send(ws, errorMsg);
            return;
        }

        // if (caller.role === "guest") {
        //     console.error("participant must be an authenticated user");
        //     return;
        // }

        let conference = caller.conferenceRoom;
        if (conference) {
            console.log("conference already created");
        } else {
            conference = this.getOrCreateConference(null, msgIn.data.conferenceRoomTrackingId, msgIn.data.conferenceRoomConfig);
            if (!await this.startConference(conference)) {
                console.error("unable to start a conference");
                let errorMsg = new CreateConfResultMsg();
                errorMsg.data.error = "unable to start the conference.";
                this.send(ws, errorMsg);
                return;
            }
        }

        let resultMsg = new CreateConfResultMsg();
        resultMsg.data.conferenceRoomId = conference.id;
        resultMsg.data.trackingId = conference.trackingId;

        this.send(ws, resultMsg);
    }

    async onJoinConference(ws: WebSocket, msgIn: JoinConfMsg) {
        console.log("onJoinConference");

        let partcipant = this.participants.get(ws);
        if (!partcipant) {
            console.error("partcipant not found.");
            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "failed to add you to the conference.";
            this.send(ws, errorMsg);
            return;
        }

        if (!msgIn.data.conferenceRoomId && !msgIn.data.trackingId) {
            console.error("conferenceRoomId or trackingId is required.");
            return;
        }

        if (partcipant.conferenceRoom) {
            console.error(`already in a conference room: ${partcipant.conferenceRoom.id}`);
            return;
        }

        let conference: ConferenceRoom;
        if (msgIn.data.conferenceRoomId) {
            conference = this.conferences.get(msgIn.data.conferenceRoomId);
        } else if (msgIn.data.trackingId) {
            conference = [...this.conferences.values()].find(c => c.trackingId === msgIn.data.trackingId);
        }

        if (!conference) {
            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "conference room not found.";
            this.send(ws, errorMsg);
            return;
        }

        if (conference.status !== "ready") {
            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "conference room not ready.";
            this.send(ws, errorMsg);
            return;
        }

        conference.addParticipant(partcipant);
        this.sendConferenceReady(conference, partcipant);

    }

    async sendConferenceReady(conference: ConferenceRoom, participant: Participant) {
        console.log("conferenceReady");

        conference.addParticipant(participant);

        //send the room info the participant
        let roomsAPI = new RoomsAPI(conference.roomURI, this.config.room_access_token);

        let authUserTokenResult = await roomsAPI.newAuthUserToken();
        if (!authUserTokenResult || authUserTokenResult?.data?.error) {
            console.error("failed to create new authUser token in rooms");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for user.";
            this.send(participant.socket, errorMsg);
            return null;
        }

        console.log("authUserTokenResult", authUserTokenResult);

        let msg = new ConferenceReadyMsg()
        msg.data.conferenceRoomId = conference.id;
        msg.data.roomId = conference.roomId;
        msg.data.roomToken = conference.roomToken;
        msg.data.authToken = authUserTokenResult.data.authToken;
        msg.data.roomURI = conference.roomURI;
        msg.data.roomRtpCapabilities = conference.roomRtpCapabilities;

        this.send(participant.socket, msg);
    }

    /**
     * creates a room in the room server
     * @param conference 
     * @returns 
     */
    async startConference(conference: ConferenceRoom) {

        console.log("startConference");

        if (conference.status != "none") {
            console.log("conference already started");
            return true;
        }

        conference.updateStatus("initializing");
        //caller sent an invite
        //receiver accepted the invite
        //send room ready to both parties
        let roomURI = this.getNextRoomServerURI();
        let roomsAPI = new RoomsAPI(roomURI, this.config.room_access_token);

        let roomTokenResult = await roomsAPI.newRoomToken();
        if (!roomTokenResult || roomTokenResult?.data?.error) {
            console.error("failed to create new room token");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for room.";
            conference.participants.forEach(p => this.send(p.socket, errorMsg));
            return false;
        }
        let roomToken = roomTokenResult.data.roomToken;
        let roomId = roomTokenResult.data.roomId;

        let roomConfig = new RoomConfig();
        roomConfig.maxPeers = conference.config.maxGuests;
        roomConfig.maxRoomDurationMinutes = Math.ceil(conference.timeoutSecs / 60);

        let roomNewResult = await roomsAPI.newRoom(roomId, roomToken, conference.id, roomConfig);
        if (!roomNewResult || roomNewResult?.data?.error) {
            console.error("failed to create new room");
            return false;
        }

        conference.roomId = roomId;
        conference.roomToken = roomToken;
        conference.roomURI = roomURI;
        conference.roomRtpCapabilities = roomNewResult.data.roomRtpCapabilities;
        conference.timeoutId = setTimeout(() => { conference.close(); }, conference.config.roomTimeoutSecs * 1000);

        conference.updateStatus("ready");
        return true;

    }

    async onLeave(ws: WebSocket, msgIn: LeaveMsg) {
        let conf = this.conferences.get(msgIn.data.conferenceRoomId);

        if (!conf) {
            console.log("conference room not found.");
            return;
        }
        let participant = this.getParticipantByWS(ws);

        if (!conf.participants.get(participant.participantId)) {
            console.log("participant not found.");
            return;
        }

        conf.removeParticipant(participant.participantId);

        //forward leave to all other participants
        for (let p of conf.participants.values()) {
            let msg = new LeaveMsg();
            msg.data.conferenceRoomId = conf.id;
            msg.data.participantId = participant.participantId;
            this.send(p.socket, msg);
        }

    }

    /**
     * you can load balance the room server using simple round robin
     * @returns url of room server 
     */
    getNextRoomServerURI(): string {
        let uri = this.config.room_servers_uris[this.nextRoomURIIdx];
        this.nextRoomURIIdx++;
        if (this.nextRoomURIIdx >= this.config.room_servers_uris.length) {
            this.nextRoomURIIdx = 0;
        }
        return uri;
    }

}