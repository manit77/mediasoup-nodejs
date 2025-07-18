import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import {
    CallMessageType,
    InviteMsg, InviteResultMsg,
    RegisterMsg, RegisterResultMsg, RejectMsg,
    AcceptMsg,
    ConferenceReadyMsg,
    AcceptResultMsg,
    LeaveMsg,
    InviteCancelledMsg,
    CreateConfMsg,
    CreateConfResultMsg,
    JoinConfMsg,
    JoinConfResultMsg,
    ConferenceRoomConfig,
    GetParticipantsResultMsg,
    ParticipantInfo,
    ConferenceRoomInfo,
    GetConferencesMsg,
    GetConferencesResultMsg,
    ConferenceClosedMsg,
    GetParticipantsMsg,
    ParticipantRole
} from '@conf/conf-models';
import { ConferenceRoom, IAuthPayload, Participant } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { jwtSign, jwtVerify } from '../utils/jwtUtil.js';
import { IMsg, RoomConfig } from '@rooms/rooms-models';
import express from 'express';
import { ThirdPartyAPI } from '../thirdParty/thirdPartyAPI.js';
import { getDemoSchedules } from '../demoData/demoData.js';

export interface ConferenceServerConfig {
    conf_server_port: number,
    conf_reconnection_timeout: number,
    conf_secret_key: string,
    conf_max_peers_per_conf: number,
    conf_allow_guests: boolean;
    conf_token_expires_min: number,
    conf_callback_urls: {},
    conf_data_access_token: string;
    conf_data_urls: { getScheduledConferencesURL: string, getScheduledConferenceURL: string, loginURL: string }
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
    thirdParty: ThirdPartyAPI;

    constructor(config: ConferenceServerConfig, app: express.Express, httpServer: https.Server) {
        this.config = config;
        this.app = app;
        this.httpServer = httpServer;
        this.thirdParty = new ThirdPartyAPI(this.config);
    }

    async start() {
        console.log(`start ConferenceServer`);

        this.webSocketServer = new WebSocketServer({ server: this.httpServer });
        this.webSocketServer.on('connection', (ws) => {

            console.log("socket connected participants: " + this.participants.size);

            ws.onmessage = async (message) => {
                const msgIn = JSON.parse(message.data.toString());
                this.handleMsgInWS(ws, msgIn);
            };

            ws.onclose = async () => {
                const participant = this.participants.get(ws);
                if (participant) {
                    // Remove from active participants map
                    this.participants.delete(ws);

                    if (participant.conferenceRoom) {
                        participant.conferenceRoom.removeParticipant(participant.participantId);
                    }

                    console.log(`participant ${participant.participantId} disconnected. participants: ${this.participants.size} rooms: ${this.conferences.size}`);

                    //update contacts
                    await this.broadCastParticipants(null);
                }
            }

        });
    }

    async handleMsgInWS(ws: WebSocket, msgIn: IMsg) {
        try {

            console.log("msgIn: ", msgIn);

            if (!msgIn.type) {
                console.error("message has no type");
                return;
            }
            let participant = this.getParticipantByWS(ws);
            let resultMsg: IMsg;

            switch (msgIn.type) {
                case CallMessageType.register:
                    resultMsg = await this.onRegister(ws, msgIn);
                    break;
                case CallMessageType.getParticipants:
                    resultMsg = await this.onGetParticipants(participant, msgIn);
                    break;
                case CallMessageType.getConferences:
                    resultMsg = await this.onGetConferences(participant, msgIn);
                    break;
                case CallMessageType.createConf:
                    resultMsg = await this.onCreateConference(participant, msgIn);
                    break;
                case CallMessageType.joinConf:
                    resultMsg = await this.onJoinConference(participant, msgIn);
                    break;
                case CallMessageType.invite:
                    resultMsg = await this.onInvite(participant, msgIn);
                    break;
                case CallMessageType.inviteCancelled:
                    resultMsg = await this.onInviteCancelled(participant, msgIn);
                    break;
                case CallMessageType.reject:
                    resultMsg = await this.onReject(participant, msgIn);
                    break;
                case CallMessageType.accept:
                    resultMsg = await this.onAccept(participant, msgIn);
                    break;
                case CallMessageType.leave:
                    resultMsg = await this.onLeave(participant, msgIn);
                    break;
            }

            if (resultMsg) {
                this.send(ws, resultMsg);
            }
        } catch (err) {
            console.error(err);
        }

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

    createParticipant(ws: WebSocket, username: string, displayName: string): Participant {

        if (!ws) {
            console.error("no websocket");
            return;
        }

        let part = new Participant();
        part.participantId = "part-" + randomUUID().toString();
        part.displayName = displayName;
        part.username = username;
        part.socket = ws;
        this.participants.set(ws, part);
        console.log("new participant created " + part.participantId);
        return part;
    }

    getOrCreateConference(conferenceId?: string, trackingId?: string, roomName?: string, config?: ConferenceRoomConfig) {

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
        conference.roomName = roomName;
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

        conference.onClose = (conf: ConferenceRoom, participants: Participant[], reason: string) => {
            this.conferences.delete(conf.id);
            console.log(`conference removed. ${conf.id}`);

            //alert any existing participants the room is closed
            let msgClosed = new ConferenceClosedMsg();
            msgClosed.data.conferenceRoomId = conf.id;
            msgClosed.data.reason = reason;
            participants.forEach(p => this.send(p.socket, msgClosed));

            //broadcast rooms to existing participants
            this.broadCastConferenceRooms();
        };

        console.log(`conference created: ${conference.id} ${conference.roomName} `);

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
    private async onRegister(ws: WebSocket, msgIn: RegisterMsg): Promise<IMsg> {
        console.log("onRegister " + msgIn.data.username);

        if (!msgIn.data.username) {
            console.error("username is required.");

            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "username is required.";
            return errorMsg;
        }

        if (!msgIn.data.authToken) {
            console.error("authToken is required.");

            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "authToken is required.";
            return errorMsg;
        }

        let participant: Participant = this.createParticipant(ws, msgIn.data.username, msgIn.data.username);

        let authToken: string = msgIn.data.authToken;
        let authTokenObject: IAuthPayload;
        authTokenObject = jwtVerify(this.config.conf_secret_key, msgIn.data.authToken) as IAuthPayload;

        participant.role = authTokenObject.role;

        let msg = new RegisterResultMsg();
        msg.data = {
            username: participant.displayName,
            authToken: authToken,
            participantId: participant.participantId,
            role: authTokenObject.role ?? ParticipantRole.guest
        };

        this.broadCastParticipants(participant);

        return msg;
    }

    async broadCastParticipants(exceptParticipant: Participant) {

        console.log("broadCastParticipants");
        //broadcast to all participants of contacts
        let contactsMsg = new GetParticipantsResultMsg();
        contactsMsg.data = [...this.participants.values()].map(p => ({
            participantId: p.participantId,
            displayName: p.displayName,
            status: "online"
        }) as ParticipantInfo);

        for (let [socket, p] of this.participants.entries()) {
            if (exceptParticipant != p && p.role !== "guest") {
                this.send(socket, contactsMsg);
            }
        }

    }

    async broadCastConferenceRooms() {
        console.log("broadCastConferenceRooms");

        //broadcast to all participants of conferences that have a trackingId
        let msg = new GetConferencesResultMsg();
        msg.data.conferences = [...this.conferences.values()].filter(c => c.trackingId).map(c => ({
            conferenceRoomId: c.id,
            roomName: c.roomName,
            roomStatus: c.status,
            roomTrackingId: c.trackingId,
            participantCount: c.participants.size
        }) as ConferenceRoomInfo);

        for (let [socket, p] of this.participants.entries()) {
            this.send(socket, msg);
        }
    }

    async onGetParticipants(participant: Participant, msgIn: GetParticipantsMsg): Promise<IMsg | null> {
        console.log("onGetParticipants");

        if (!participant) {
            console.error("participant is required.");
            return;
        }

        if (participant.role === "guest") {
            console.error("participant must be an authenticated user");
            return;
        }

        let msg = new GetParticipantsResultMsg();
        this.getParticipantsExceptPart(participant).forEach((p) => {
            msg.data.push({
                displayName: p.displayName,
                participantId: p.participantId,
                status: "online"
            });
        });

        return msg;
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

    getParticipantsExceptWS(ws: WebSocket) {
        return [...this.participants.values()].filter(p => p.socket !== ws);
    }

    getParticipantsExceptPart(part: Participant) {
        return [...this.participants.values()].filter(p => p.participantId !== part.participantId);
    }

    /**
     * invite a peer to a p2p call
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    private async onInvite(participant: Participant, msgIn: InviteMsg) {
        console.log("onInvite");


        if (participant.conferenceRoom) {
            console.error("caller already in a conference room.");

            let errorMsg = new InviteResultMsg();
            errorMsg.data.conferenceRoomId = participant.conferenceRoom.id;
            errorMsg.data.error = "already in a conference room.";

            return errorMsg;
        }

        // if (caller.role === "guest") {
        //     console.error("guest cannot send an invite.");
        //     return;
        // }

        let remote = this.getParticipant(msgIn.data.participantId);
        if (!remote) {
            console.error("remote participant not found.");

            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party not found.";

            return errorMsg;
        }

        if (remote.conferenceRoom) {
            console.error(`receiver is in another conference room. ${remote.conferenceRoom.id}`);

            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party is on another call.";

            return errorMsg;
        }

        let conference = this.getOrCreateConference();
        conference.confType = "p2p";
        conference.addParticipant(participant);
        conference.minParticipants = 2;
        conference.startTimerMinParticipants(10); //call will timeout if minParticipants not met 

        //forward the call to the receiver
        let msg = new InviteMsg();
        msg.data.participantId = participant.participantId;
        msg.data.displayName = participant.displayName;
        msg.data.conferenceRoomId = conference.id;
        msg.data.conferenceRoomName = conference.roomName;
        msg.data.conferenceRoomTrackingId = conference.trackingId;
        msg.data.conferenceType = conference.confType;

        if (!this.send(remote.socket, msg)) {
            console.error("failed to send invite to receiver");
            conference.close("remote peer not available");

            let errorMsg = new InviteResultMsg();
            //send InviteResult back to the caller
            errorMsg.data.conferenceRoomId = conference.id;
            errorMsg.data.error = "invite failed.";

            return errorMsg;
        }

        let inviteResultMsg = new InviteResultMsg();
        //send InviteResult back to the caller
        inviteResultMsg.data.participantId = remote.participantId;
        inviteResultMsg.data.displayName = remote.displayName;
        inviteResultMsg.data.conferenceRoomId = conference.id;
        inviteResultMsg.data.conferenceRoomName = conference.roomName;
        inviteResultMsg.data.conferenceRoomTrackingId = conference.trackingId;
        inviteResultMsg.data.conferenceType = conference.confType;

        return inviteResultMsg;

    }

    private async onInviteCancelled(participant: Participant, msgIn: InviteCancelledMsg) {
        console.log("onInviteCancel");

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

        if (participant.conferenceRoom != conf) {
            console.error("not the same conference room.");
            return;
        }

        if (conf.participants.size == 1) {
            console.error("closing conference room");
            conf.close("");
        }

        let resultMsg = new InviteCancelledMsg();
        resultMsg.data.conferenceRoomId = conf.id;
        resultMsg.data.participantId = participant.participantId;

        return resultMsg;
    }

    /**
     * the participant rejected an invite
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    private async onReject(participant: Participant, msgIn: RejectMsg): Promise<IMsg | null> {
        console.log("onReject");
        let remoteParticipant = this.getParticipant(msgIn.data.toParticipantId);

        if (!remoteParticipant) {
            console.error("onReject - remoteParticipant not found or not connected");
            return;
        }

        let conf = this.conferences.get(msgIn.data.conferenceRoomId);
        if (!conf) {
            console.error("onReject - conference not found.");
            return;
        }

        //the participant is not in the same conference room as the reject message
        if (conf !== remoteParticipant.conferenceRoom) {
            console.error("not the same confererence room");
            return;
        }

        //send the reject to the client
        this.send(remoteParticipant.socket, msgIn);

        //the room was p2p, remove the particpant
        if (conf.confType == "p2p") {
            conf.removeParticipant(remoteParticipant.participantId);
        }

    }

    private async onAccept(participant: Participant, msgIn: AcceptMsg) {
        console.log("onAccept()");

        let conference = this.conferences.get(msgIn.data.conferenceRoomId);

        if (!conference) {
            console.error("ERROR: conference room does not exist");
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "unable to join conference";
            return msg;
        }

        if (!participant) {
            console.error("onAccept - participant not found or not connected");
            return;
        }

        if (conference.status == "closed") {
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "conference is closed";
            return msg;
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
            this.send(participant.socket, msg);
        }, 5000);

        conference.addOnReadyListener(() => {
            console.log(`conference room ready ${conference.id}`);
            conference.addParticipant(participant);
            clearTimeout(timeoutid);

            //send the answer result back
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            this.send(participant.socket, msg);
        });

        if (conference.status == "none") {
            if (await this.startRoom(conference)) {
                for (let p of conference.participants.values()) {
                    this.sendConferenceReady(conference, p);
                }
            }
        }
    }

    private async onCreateConference(participant: Participant, msgIn: CreateConfMsg) {
        console.log("onCreateConference");

        if (![ParticipantRole.admin, ParticipantRole.user].includes(participant.role)) {
            console.error("participant must be an authenticated user");
            return;
        }

        //tracking id is required
        if (!msgIn.data.conferenceRoomTrackingId) {
            console.error("conferenceRoomTrackingId is required.");
            return;
        }

        //get the config from the api endpoint
        let confConfig = msgIn.data.conferenceRoomConfig;
        if (this.config.conf_data_urls.getScheduledConferenceURL) {
            confConfig = new ConferenceRoomConfig();
            let resultMsg = await this.thirdParty.getScheduledConference(msgIn.data.conferenceRoomTrackingId, participant.clientData);
            if (resultMsg) {
                confConfig.conferenceCode = resultMsg.data.conference.config.conferenceCode;
                confConfig.guestsAllowCamera = resultMsg.data.conference.config.guestsAllowCamera;
                confConfig.guestsAllowMic = resultMsg.data.conference.config.guestsAllowMic;
                confConfig.guestsAllowed = resultMsg.data.conference.config.guestsAllowed;
                confConfig.guestsMax = resultMsg.data.conference.config.guestsMax;
                confConfig.roomTimeoutSecs = 0;
                confConfig.usersMax = 0;
            }
        } else {
            //get from demo data
            let demoSchedule = getDemoSchedules().find(s=> s.id === msgIn.data.conferenceRoomTrackingId);
            if (demoSchedule) {
                confConfig.conferenceCode = demoSchedule.config.conferenceCode;
                confConfig.guestsAllowCamera = demoSchedule.config.guestsAllowCamera;
                confConfig.guestsAllowMic = demoSchedule.config.guestsAllowMic;
                confConfig.guestsAllowed = demoSchedule.config.guestsAllowed;
                confConfig.guestsMax = demoSchedule.config.guestsMax;
                confConfig.roomTimeoutSecs = 0;
                confConfig.usersMax = 0;
            }
        }

        let conference = participant.conferenceRoom;
        if (conference) {
            console.log("conference already created");
        } else {
            conference = this.getOrCreateConference(null, msgIn.data.conferenceRoomTrackingId, msgIn.data.roomName, confConfig);
            conference.confType = "room";
            if (!await this.startRoom(conference)) {
                console.error("unable to start a conference");
                let errorMsg = new CreateConfResultMsg();
                errorMsg.data.error = "unable to start the conference.";
                return errorMsg;
            }
        }

        let resultMsg = new CreateConfResultMsg();
        resultMsg.data.conferenceRoomId = conference.id;
        resultMsg.data.trackingId = conference.trackingId;
        resultMsg.data.roomName = conference.roomName;

        return resultMsg;
    }

    /**
     * triggers when a particpants joins a conference
     * adds a new particpant to the conference
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    private async onJoinConference(participant: Participant, msgIn: JoinConfMsg) {
        console.log("onJoinConference");

        if (!msgIn.data.conferenceRoomId && !msgIn.data.trackingId) {
            console.error("conferenceRoomId or trackingId is required.");

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "invalid room data.";
            return errorMsg;
        }

        if (participant.conferenceRoom) {
            console.error(`already in a conference room: ${participant.conferenceRoom.id}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "already in a room.";

            return errorMsg;
        }

        let conference: ConferenceRoom;
        if (msgIn.data.conferenceRoomId) {
            conference = this.conferences.get(msgIn.data.conferenceRoomId);
        } else if (msgIn.data.trackingId) {
            conference = [...this.conferences.values()].find(c => c.trackingId === msgIn.data.trackingId);
        }

        if (!conference) {
            console.error(`conference room not found ${conference.id}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "conference room not found.";
            return errorMsg;
        }

        if (conference.status !== "ready") {
            console.error(`conference room not ready ${conference.id}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "conference room not ready.";

            return errorMsg;
        }

        //check the conference code
        if (conference.config.requireConferenceCode && conference.config.conferenceCode && conference.config.conferenceCode !== msgIn.data.conferenceCode) {
            console.error(`invalid conference code: ${msgIn.data.conferenceCode}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "invalid conference code";

            return errorMsg;
        }

        //check the role
        if (!conference.config.guestsAllowed && ParticipantRole.guest === participant.role) {
            console.error(`guest not allowed: ${participant.role}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "unauthorized";

            return errorMsg;
        }

        conference.addParticipant(participant);

        //do not send JoinConfResultMsg back, send the ConferenceReadyMsg
        this.sendConferenceReady(conference, participant);

        let resultMsg = new JoinConfResultMsg();
        resultMsg.data.conferenceRoomId = conference.roomId;

        return resultMsg;
    }

    async sendConferenceReady(conference: ConferenceRoom, participant: Participant) {
        console.log("conferenceReady");

        conference.addParticipant(participant);

        //send the room info the participant
        let roomsAPI = new RoomsAPI(conference.roomURI, this.config.room_access_token);

        //create an authtoken per user
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
        msg.data.conferenceRoomName = conference.roomName;
        msg.data.conferenceRoomTrackingId = conference.trackingId;
        msg.data.conferenceType = conference.confType;
        msg.data.participantId = participant.participantId;
        msg.data.displayName = participant.displayName;
        msg.data.conferenceRoomConfig = conference.config;

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
    async startRoom(conference: ConferenceRoom) {
        console.log("startConference");

        if (conference.status != "none") {
            console.log("conference already started");
            return true;
        }

        //we have 5 seconds to init a room
        let initTimerId = setTimeout(() => {
            console.error("new room timeout, closing room");
            conference.close("room timed out");
        }, 5000);


        conference.updateStatus("initializing");
        //caller sent an invite
        //receiver accepted the invite
        //send room ready to both parties
        let roomURI = this.getNextRoomServerURI();
        let roomsAPI = new RoomsAPI(roomURI, this.config.room_access_token);

        let roomTokenResult = await roomsAPI.newRoomToken();
        if (!roomTokenResult || roomTokenResult?.data?.error) {
            console.error("failed to create new room token");
            clearTimeout(initTimerId);
            conference.close("failed to init new room");
            return false;
        }
        let roomToken = roomTokenResult.data.roomToken;
        let roomId = roomTokenResult.data.roomId;

        let roomConfig = new RoomConfig();
        roomConfig.maxPeers = conference.config.guestsMax + conference.config.usersMax;
        roomConfig.maxRoomDurationMinutes = 0;
        if (conference.timeoutSecs > 0) {
            roomConfig.maxRoomDurationMinutes = Math.ceil(conference.timeoutSecs / 60);
        }

        let roomNewResult = await roomsAPI.newRoom(roomId, roomToken, conference.roomName, conference.id, roomConfig);
        if (!roomNewResult || roomNewResult?.data?.error) {
            console.error("failed to create new room");

            clearTimeout(initTimerId);
            conference.close("failed to create new room");
            return false;
        }

        conference.roomId = roomId;
        conference.roomToken = roomToken;
        conference.roomURI = roomURI;
        conference.roomRtpCapabilities = roomNewResult.data.roomRtpCapabilities;
        conference.startTimer(); //start timeout timer

        conference.updateStatus("ready");
        clearTimeout(initTimerId);

        await this.broadCastConferenceRooms();
        return true;
    }

    private async onLeave(participant: Participant, msgIn: LeaveMsg): Promise<IMsg | null> {
        console.log("onLeave");
        let conf = this.conferences.get(msgIn.data.conferenceRoomId);

        if (!conf) {
            console.error("conference room not found.");
            return;
        }

        if (!conf.participants.get(participant.participantId)) {
            console.error(`participant not found. ${participant.participantId}`);
            return;
        }

        conf.removeParticipant(participant.participantId);

        if (conf.confType == "p2p") {
            //if the conference was p2p, close the room if only one participant left
            if (conf.participants.size == 1) {
                console.log("closing conference room, no participants left.");
                conf.close("room closed.");
                return
            }
        }

        //forward leave to all other participants
        for (let p of conf.participants.values()) {
            let msg = new LeaveMsg();
            msg.data.conferenceRoomId = conf.id;
            msg.data.participantId = participant.participantId;
            this.send(p.socket, msg);
        }
    }

    private async onGetConferences(participant: Participant, msgIn: GetConferencesMsg) {
        console.log("onGetConferences");
        let returnMsg = new GetConferencesResultMsg();
        returnMsg.data.conferences = await this.getConferences();
        return returnMsg;
    }

    async getConferences(): Promise<ConferenceRoomInfo[]> {
        console.log("getConferences");
        return [...this.conferences.values()]
            .map(c => {
                return { conferenceRoomId: c.id, roomName: c.roomName, roomStatus: c.status, roomTrackingId: c.trackingId, participantCount: c.participants.size };
            });
    }

    /**
     * you can load balance the room server using simple round robin
     * @returns url of room server 
     */
    getNextRoomServerURI(): string {
        console.log("getNextRoomServerURI");
        let uri = this.config.room_servers_uris[this.nextRoomURIIdx];
        this.nextRoomURIIdx++;
        if (this.nextRoomURIIdx >= this.config.room_servers_uris.length) {
            this.nextRoomURIIdx = 0;
        }
        return uri;
    }

}