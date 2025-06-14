import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { CallMessageType, GetContactsResultsMsg, InviteMsg, InviteResultMsg, RegisterResultMsg, ConferenceReadyMsg, WebRoutes, AcceptResultMsg, LeaveMsg, InviteCancelledMsg } from '@conf/conf-models';
import { ConferenceRoom, Participant } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { jwtSign } from '../utils/jwtUtil.js';
import { RoomConfig } from '@rooms/rooms-models';
export class ConferenceServer {
    webSocketServer;
    participants = new Map();
    conferences = new Map();
    config;
    nextRoomURIIdx = 0;
    app;
    httpServer;
    constructor(config, app, httpServer) {
        this.config = config;
        this.app = app;
        this.httpServer = httpServer;
    }
    async start() {
        this.app.post(WebRoutes.onRoomClosed, (req, res) => {
            console.log(WebRoutes.onRoomClosed);
            let msg = req.body;
            console.log(`roomId: ${msg.roomId} roomTrackingId: ${msg.trackingId}`);
        });
        this.app.post(WebRoutes.onPeerJoined, (req, res) => {
            console.log(WebRoutes.onPeerJoined);
            let msg = req.body;
            console.log(`peerId: ${msg.peerId} peerTrackingId: ${msg.peerTrackingId} roomId: ${msg.roomId} roomTrackingId: ${msg.roomTrackingId}`);
        });
        this.app.post(WebRoutes.onPeerLeft, (req, res) => {
            console.log(WebRoutes.onPeerLeft);
            let msg = req.body;
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
                }
                catch (err) {
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
            };
        });
    }
    send(ws, msg) {
        console.log('send ', msg);
        try {
            ws.send(JSON.stringify(msg));
            return true;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    }
    createParticipant(ws, userName, displayName) {
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
    createConference(conferenceId) {
        let conference = new ConferenceRoom();
        conference.id = conferenceId ?? this.generateConferenceId();
        this.conferences.set(conference.id, conference);
        conference.onClose = (conf) => {
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
    async onRegister(ws, msgIn) {
        console.log("onRegister " + msgIn.data.userName);
        if (!msgIn.data.userName) {
            console.error("userName is required.");
            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "userName is required.";
            return errorMsg;
        }
        let participant = this.createParticipant(ws, msgIn.data.userName, msgIn.data.userName);
        //TODO: get user from database, generate authtoken
        let authTokenObject = {
            role: "user"
        };
        let authToken = jwtSign(this.config.conf_secret_key, authTokenObject);
        let msg = new RegisterResultMsg();
        msg.data = {
            userName: participant.displayName,
            authToken: authToken,
            participantId: participant.participantId,
        };
        this.send(ws, msg);
        this.broadCastContacts();
        return msg;
    }
    async broadCastContacts() {
        //broadcast to all participants of contacts
        let contactsMsg = new GetContactsResultsMsg();
        contactsMsg.data = [...this.participants.values()].map(p => ({
            contactId: "0",
            participantId: p.participantId,
            displayName: p.displayName
        }));
        for (let [socket, p] of this.participants.entries()) {
            this.send(socket, contactsMsg);
        }
    }
    async onGetContacts(ws, msgIn) {
        //TODO: get list of contacts from database
        //For concept, get all participants online
        let msg = new GetContactsResultsMsg();
        this.getParticipantsExcept(ws).forEach((p) => {
            msg.data.push({
                contactId: "0",
                displayName: p.displayName,
                participantId: p.participantId,
                status: "online"
            });
        });
        this.send(ws, msg);
    }
    getParticipantByWS(ws) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.socket == ws) {
                return participant;
            }
        }
        return null;
    }
    getParticipant(participantId) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.participantId == participantId) {
                return participant;
            }
        }
        return null;
    }
    getParticipantsExcept(ws) {
        return [...this.participants.values()].filter(p => p.socket !== ws);
    }
    /**
     * invite a peer, if not conference room is created create one.
     * @param ws
     * @param msgIn
     * @returns
     */
    async onInvite(ws, msgIn) {
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
        let conference = caller.conferenceRoom;
        if (!conference) {
            conference = this.createConference();
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
        this.send(receiver.socket, msg);
    }
    async onInviteCancelled(ws, msgIn) {
        console.log("onInviteCancel");
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
            console.error("participant not found.");
            return;
        }
        let conf = this.conferences.get(msgIn.data.conferenceRoomId);
        if (!conf) {
            console.error("conference not found.");
            return;
        }
        let msg = new InviteCancelledMsg();
        msg.data.conferenceRoomId = conf.id;
        msg.data.participantId = caller.participantId;
        this.send(receiver.socket, msg);
    }
    async onReject(ws, msgIn) {
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
    async onAccept(ws, msgIn) {
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
        if (conference.status == "closed") {
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "conference is closed";
            this.send(ws, msg);
            return;
        }
        if (conference.status == "ready") {
            this.conferenceReady(conference, participant);
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
            conference = await this.startConference(conference);
            if (conference) {
                for (let p of conference.participants.values()) {
                    this.conferenceReady(conference, p);
                }
            }
        }
    }
    async conferenceReady(conference, participant) {
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
        let msg = new ConferenceReadyMsg();
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
    async startConference(conference) {
        console.log("startConference");
        if (conference.status != "none") {
            console.error("conference already started");
            return null;
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
            return null;
        }
        let roomToken = roomTokenResult.data.roomToken;
        let roomId = roomTokenResult.data.roomId;
        let roomNewResult = await roomsAPI.newRoom(roomId, roomToken, conference.id, new RoomConfig());
        if (!roomNewResult || roomNewResult?.data?.error) {
            console.error("failed to create new room");
            return null;
        }
        conference.roomId = roomId;
        conference.roomToken = roomToken;
        conference.roomURI = roomURI;
        conference.roomRtpCapabilities = roomNewResult.data.roomRtpCapabilities;
        conference.updateStatus("ready");
        return conference;
    }
    async onLeave(ws, msgIn) {
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
    getNextRoomServerURI() {
        let uri = this.config.room_servers_uris[this.nextRoomURIIdx];
        this.nextRoomURIIdx++;
        if (this.nextRoomURIIdx >= this.config.room_servers_uris.length) {
            this.nextRoomURIIdx = 0;
        }
        return uri;
    }
}
//# sourceMappingURL=conferenceServer.js.map