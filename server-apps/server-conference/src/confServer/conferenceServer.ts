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
    LeaveMsg
} from '@conf/conf-models';
import { ConferenceRoom, Participant } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { jwtSign } from '../utils/jwtUtil.js';
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
                        case CallMessageType.invite:
                            this.onInvite(ws, msgIn);
                            break;
                        case CallMessageType.reject:
                            this.onReject(ws, msgIn);
                            break;
                        case CallMessageType.accept:
                            this.onAccept(ws, msgIn);
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

                    console.log(`participant ${participant.participantId} disconnected. participants: ${this.participants.size} rooms: ${this.conferences.size}`);
                }
            }

        });
    }

    send(ws: WebSocket, msg: any): boolean {
        console.log('send ', msg);
        try {
            ws.send(JSON.stringify(msg));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * registers a socket connection
     * @param ws 
     * @param msgIn 
     */
    async onRegister(ws: WebSocket, msgIn: RegisterMsg) {
        console.log("onRegister " + msgIn.data.userName);

        let participant: Participant;
        // If not found or no ID provided, create new participant
        participant = new Participant();
        participant.participantId = "part-" + randomUUID().toString();
        participant.displayName = msgIn.data.userName;
        participant.userName = msgIn.data.userName;
        console.log("new participant created " + participant.participantId);

        // Update socket and maps
        participant.socket = ws;
        this.participants.set(ws, participant);

        //TODO: get user from database, generate authtoken

        let msg = new RegisterResultMsg();
        msg.data = {
            userName: participant.displayName,
            authToken: "",  // TODO: implement auth tokens
            participantId: participant.participantId,
            conferenceRoomId: participant.conferenceRoom ? participant.conferenceRoom.roomId : ""
        };

        this.send(ws, msg);

        //broadcast to all participants of contacts
        let contactsMsg = new GetContactsResultsMsg();
        contactsMsg.data = [...this.participants.values()].map(p => ({
            participantId: p.participantId,
            displayName: p.displayName
        }) as Contact);

        for (let [socket, p] of this.participants.entries()) {
            this.send(socket, contactsMsg);
        }

    }

    async onGetContacts(ws: WebSocket, msgIn?: any) {

        //TODO: get list of contacts from database
        //For concept, get all participants online

        let msg = new GetContactsResultsMsg();
        this.getParticipantsExcept(ws).forEach((p) => {
            msg.data.push({
                contactId: "",
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
        //new call
        //create a room if needed
        let caller = this.participants.get(ws);

        if (!caller) {
            console.error("caller not found.");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "failed to add you to the conference.";
            this.send(ws, errorMsg);
            return;
        }

        let receiver = this.getParticipant(msgIn.data.participantId);
        if (!receiver) {
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party not found.";
            this.send(caller.socket, errorMsg);
            return;
        }

        let conference = this.conferences.get(msgIn.data.conferenceRoomId);

        if (!conference) {
            let conferenceId = randomUUID().toString();
            conference = new ConferenceRoom();
            conference.id = conferenceId;
            this.conferences.set(conference.id, conference);
        }

        conference.participants.set(caller.participantId, caller);


        let inviteResultMsg = new InviteResultMsg();
        //send InviteResult back to the caller
        inviteResultMsg.data.conferenceRoomId = conference.id;

        this.send(ws, inviteResultMsg);

        //forward the call to the receiver
        let msg = new InviteMsg();
        msg.data.participantId = caller.participantId;
        msg.data.displayName = caller.displayName;
        msg.data.conferenceRoomId = conference.id;

        this.send(receiver.socket, msg);

    }

    async onReject(ws: WebSocket, msgIn: RejectMsg) {
        console.log("onReject");
        let participant = this.getParticipant(msgIn.data.toParticipantId);

        if (!participant) {
            console.error("onReject - participant not found or not connected");
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
            console.log("invalid conference room");
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

        conference.participants.set(participant.participantId, participant);

        if (conference.roomId) {
            //room already started
            //send the room info the participant
            let roomsAPI = new RoomsAPI(conference.roomURI, this.config.room_access_token);

            let authUserTokenResult = await roomsAPI.newAuthUserToken();
            if (!authUserTokenResult || authUserTokenResult?.data?.error) {
                console.error("failed to create new authUser token in rooms");
                let errorMsg = new InviteResultMsg();
                errorMsg.data.error = "error creating conference for user.";
                conference.participants.forEach(p => this.send(p.socket, errorMsg));
                return null;
            }


            console.log("authUserTokenResult", authUserTokenResult);

            let msg = new ConferenceReadyMsg()
            msg.data.conferenceRoomId = conference.id;
            msg.data.roomId = conference.roomId;
            msg.data.roomToken = conference.roomToken;
            msg.data.authToken = authUserTokenResult.data.authToken;
            msg.data.roomURI = conference.roomURI;

            this.send(ws, msg);

        } else {
            await this.startConference(conference);
        }

    }

    async startConference(conference: ConferenceRoom) {
        console.log("startConference");

        //caller sent an invite
        //receiver accepted the invite
        //send room ready to both parties
        conference.roomURI = this.getNextRoomServerURI();
        let roomsAPI = new RoomsAPI(conference.roomURI, this.config.room_access_token);

        let roomTokenResult = await roomsAPI.newRoomToken();
        if (!roomTokenResult || roomTokenResult?.data?.error) {
            console.error("failed to create new room token");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for room.";
            conference.participants.forEach(p => this.send(p.socket, errorMsg));
            return null;
        }
        conference.roomToken = roomTokenResult.data.roomToken;
        conference.roomId = roomTokenResult.data.roomId;

        let roomNewResult = await roomsAPI.newRoom(conference.roomId, conference.roomToken, conference.id, new RoomConfig());
        if (!roomNewResult || roomNewResult?.data?.error) {
            console.error("failed to create new room");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for room.";
            conference.participants.forEach(p => this.send(p.socket, errorMsg));
            return null;
        }

        let userTokens = [];
        let participants = [...conference.participants.values()];

        for (let p of participants) {
            let authUserTokenResult = await roomsAPI.newAuthUserToken();
            if (!authUserTokenResult || authUserTokenResult?.data?.error) {
                console.error("failed to create new authUser token in rooms");
                let errorMsg = new InviteResultMsg();
                errorMsg.data.error = "error creating conference for user.";
                conference.participants.forEach(p => this.send(p.socket, errorMsg));
                return null;
            }
            console.log("authUserTokenResult", authUserTokenResult);
            userTokens.push(authUserTokenResult.data.authToken);
        }

        //send to all participants the roominfo
        let msg = new ConferenceReadyMsg()
        msg.data.conferenceRoomId = conference.id;
        msg.data.roomId = conference.roomId;
        msg.data.roomToken = conference.roomToken;
        msg.data.roomURI = conference.roomURI;

        let counter = 0;
        for (let p of participants) {
            msg.data.authToken = userTokens[counter];
            counter++;
            this.send(p.socket, msg);
        }

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

    }


    getNextRoomServerURI(): string {
        let uri = this.config.room_servers_uris[this.nextRoomURIIdx];
        this.nextRoomURIIdx++;
        if (this.nextRoomURIIdx >= this.config.room_servers_uris.length) {
            this.nextRoomURIIdx = 0;
        }
        return uri;
    }

}