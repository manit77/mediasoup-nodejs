import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { CallMessageType, GetContactsResultsMsg, InviteMsg, InviteResultMsg, RegisterResultMsg, AcceptResultMsg } from '@conf/conf-models';
import { Participant } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { RoomConfig } from '@rooms/rooms-models';
export class ConferenceServer {
    httpServer;
    webSocketServer;
    participants = new Map();
    conferences = new Map();
    roomsAPI;
    config;
    constructor(c, httpServer) {
        this.httpServer = httpServer;
        this.roomsAPI = new RoomsAPI(this.config.room_api_url);
        this.config = c;
    }
    async start() {
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
                    console.log(`participant ${participant.participantId} disconnected. participants: ${this.participants.size} rooms: ${this.conferences.size}`);
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
        catch {
            return false;
        }
    }
    /**
     * registers a socket connection
     * @param ws
     * @param msgIn
     */
    async onRegister(ws, msgIn) {
        console.log("onRegister " + msgIn.data.userName);
        let participant;
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
            authToken: "", // TODO: implement auth tokens
            participantId: participant.participantId,
            conferenceRoomId: participant.conferenceRoom ? participant.conferenceRoom.roomId : ""
        };
        this.send(ws, msg);
        //broadcast to all participants of contacts
        let contactsMsg = new GetContactsResultsMsg();
        contactsMsg.data = [...this.participants.values()].map(p => ({
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
                contactId: "",
                displayName: p.displayName,
                participantId: p.participantId,
                status: "online"
            });
        });
        this.send(ws, msg);
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
        let roomAuthUserTokens = [];
        let roomToken = "";
        let roomId = "";
        console.log("added new conference room");
        let roomTokenResult = await this.roomsAPI.newRoomToken();
        if (!roomTokenResult || roomTokenResult?.data?.error) {
            console.error("failed to create new authUser token in rooms");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for room.";
            this.send(caller.socket, errorMsg);
            return null;
        }
        roomToken = roomTokenResult.data.roomToken;
        roomId = roomTokenResult.data.roomId;
        console.log("roomToken", roomToken);
        let roomNewResult = await this.roomsAPI.newRoom(roomId, roomToken, new RoomConfig());
        let authUserTokenResult = await this.roomsAPI.newAuthUserToken();
        if (!authUserTokenResult || authUserTokenResult?.data?.error) {
            console.error("failed to create new authUser token in rooms");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for user.";
            this.send(caller.socket, errorMsg);
            return null;
        }
        roomAuthUserTokens.push(authUserTokenResult.data.authToken);
        authUserTokenResult = await this.roomsAPI.newAuthUserToken();
        if (!authUserTokenResult || authUserTokenResult?.data?.error) {
            console.error("failed to create new authUser token in rooms");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for user.";
            this.send(caller.socket, errorMsg);
            return null;
        }
        roomAuthUserTokens.push(authUserTokenResult.data.authToken);
        console.log("roomAuthUserToken", roomAuthUserTokens[1]);
        let receiver = this.getParticipant(msgIn.data.participantId);
        if (!receiver) {
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party not found.";
            this.send(caller.socket, errorMsg);
            return;
        }
        let inviteResultMsg = new InviteResultMsg();
        //send InviteResult back to the caller
        inviteResultMsg.data.participantId = receiver.participantId;
        inviteResultMsg.data.roomId = roomId;
        inviteResultMsg.data.roomToken = roomToken;
        inviteResultMsg.data.roomAuthUserToken = roomAuthUserTokens[0]; //send the first user token
        this.send(ws, inviteResultMsg);
        //forward the call to the receiver
        let msg = new InviteMsg();
        msg.data.participantId = caller.participantId;
        msg.data.displayName = caller.displayName;
        msg.data.roomId = roomId;
        msg.data.roomToken = roomToken;
        msg.data.roomAuthUserToken = roomAuthUserTokens[1]; //send the second user token
        this.send(receiver.socket, msg);
        //both participants should now have the conferenceToken and the room token
    }
    async onReject(ws, msgIn) {
        console.log("onReject");
        let caller = this.getParticipant(msgIn.data.toParticipantId);
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        }
        else {
            console.error("onReject - participant not found or not connected");
        }
    }
    async onAccept(ws, msgIn) {
        console.log("onJoin()");
        let participant = this.participants.get(ws);
        let conferenceRoom = this.conferences.get(msgIn.data.conferenceRoomId);
        if (!conferenceRoom) {
            console.log("invalid conference room");
            let msg = new AcceptResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "unable to join conference";
            this.send(ws, msg);
            return;
        }
    }
}
//# sourceMappingURL=conferenceServer.js.map