import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { CallMessageType, ConferenceClosedMsg, ConferenceLeaveMsg, GetContactsMsg, InviteMsg, InviteResultMsg, JoinResultMsg, RTCNeedOfferMsg, NewConferenceResultMsg, NewParticipantMsg, ParticipantLeftMsg, RegisterResultMsg, ReconnectResultMsg, ParticipantReconnectedMsg, ConferenceConfig, ConferenceType } from '../models/conferenceSharedModels.js';
import { ConferenceRoom, Participant } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { jwtSign } from '../utils/jwtUtil.js';
export class ConferenceServer {
    httpServer;
    webSocketServer;
    participants = new Map();
    conferences = new Map();
    // Track disconnected participants for reconnection (timeout in milliseconds)
    disconnectedParticipants = new Map();
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
                        case CallMessageType.newConference:
                            this.onNewConference(ws, msgIn);
                            break;
                        case CallMessageType.invite:
                            this.onInvite(ws, msgIn);
                            break;
                        case CallMessageType.reject:
                            this.onReject(ws, msgIn);
                            break;
                        case CallMessageType.join:
                            this.onJoin(ws, msgIn);
                            break;
                        case CallMessageType.leave:
                            this.onLeave(ws, msgIn);
                            break;
                        case CallMessageType.closeConference:
                            this.onCloseConference(ws, msgIn);
                            break;
                        case CallMessageType.rtc_answer:
                            this.onRTCAnswer(ws, msgIn);
                            break;
                        case CallMessageType.rtc_offer:
                            this.onRTCOffer(ws, msgIn);
                            break;
                        case CallMessageType.rtc_ice:
                            this.onRTCIce(ws, msgIn);
                            break;
                        case CallMessageType.reconnect:
                            this.onReconnect(ws, msgIn);
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
                        //if in conference room, handle conference disconnect
                        this.handleConfDisconnection(participant);
                    }
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
     * does not add the room to the conference
     * @param conferenceRoomId user assigned or randonly generated UUID
     * @param maxParticipants
     * @returns
     */
    async newConferenceRoom(title = "", conferenceRoomId = "", leader, config) {
        conferenceRoomId = conferenceRoomId ?? "";
        conferenceRoomId = (conferenceRoomId == "") ? "conf-" + randomUUID().toString() : conferenceRoomId;
        if (this.conferences.has(conferenceRoomId)) {
            console.error("conference already exists " + conferenceRoomId);
            return null;
        }
        if (!config) {
            console.log("use default ConferenceConfig");
            config = new ConferenceConfig();
        }
        let confRoom = new ConferenceRoom();
        confRoom.conferenceId = 0; //create new conference record in db and get the PK
        confRoom.title = title;
        confRoom.conferenceRoomId = conferenceRoomId;
        confRoom.config = config;
        confRoom.leader = leader;
        confRoom.onParticipantRemove = (participant) => {
            console.log("onParticipantRemove");
            if (confRoom.participants.length == 0) {
                this.conferences.delete(confRoom.conferenceRoomId);
                console.log("delete conference. total conferences: " + this.conferences.size);
                if (confRoom.confType == ConferenceType.rooms) {
                    this.roomsAPI.terminateRoom(confRoom.roomId);
                }
            }
        };
        confRoom.onParticipantAdd = (participant) => {
            console.log("onParticipantAdd");
            participant.conferenceRoom = confRoom;
            if (confRoom.confType == ConferenceType.rooms) {
                //the client must add themselves to room
            }
        };
        confRoom.onClosed = () => {
            console.log("onClosed");
            let msg = new ConferenceClosedMsg();
            msg.data.conferenceRoomId = confRoom.conferenceRoomId;
            for (let [participantId, participant] of confRoom.participants.entries()) {
                if (participant.socket) {
                    this.send(participant.socket, msg);
                }
            }
            // Clean up any disconnected participants from this conference
            for (const [participantId, info] of this.disconnectedParticipants.entries()) {
                if (info.conferenceRoomId === confRoom.conferenceRoomId) {
                    clearTimeout(info.timeout);
                    this.disconnectedParticipants.delete(participantId);
                }
            }
            confRoom.participants = [];
            this.conferences.delete(confRoom.conferenceRoomId);
            console.log("delete conference. total conferences: " + this.conferences.size);
            if (confRoom.confType == ConferenceType.rooms) {
                this.roomsAPI.terminateRoom(confRoom.roomId);
            }
        };
        confRoom.conferenceToken = ""; //TODO: generate conference token
        if (confRoom.confType == ConferenceType.rooms) {
            //create a new room token in our Rooms Server, room is not created but a token is
            let tokenResult = await this.roomsAPI.newRoomToken();
            if (!tokenResult || tokenResult?.data?.error) {
                console.error("failed to create new room token in rooms");
                return null;
            }
            console.log("tokenResult", tokenResult);
            //create the room
            let roomResult = await this.roomsAPI.newRoom(tokenResult.data.roomId, tokenResult.data.roomToken, confRoom.config.maxParticipants);
            if (!roomResult) {
                console.log("roomResult", roomResult);
            }
            confRoom.roomToken = tokenResult.data.roomToken;
            confRoom.roomId = tokenResult.data.roomId;
        }
        /*
      example db:
      let confObj = db.createConference({ titile, conferenceRoomId, authtoken ... });
      if(confObj) {
          confRoom.conferenceId = confObj.Id;
          return confRoom;
      } else {
          //error creating conference room in database
          return null;
      }
      */
        let [confTokenPayload, confTokenString] = this.createConfToken(confRoom.conferenceId, confRoom.conferenceRoomId, confRoom.config.expiresIn, confRoom.config.maxParticipants);
        if (confTokenString) {
            confRoom.conferenceToken = confTokenString;
            confRoom.config.expiresIn = confTokenPayload.expiresIn;
        }
        return confRoom;
    }
    createConfToken(conferenceId, conferenceRoomId, expiresIn, maxPeers) {
        conferenceRoomId = conferenceRoomId ?? "";
        let payload = {
            conferenceId: conferenceId,
            conferenceRoomId: conferenceRoomId == "" ? "conf-" + randomUUID().toString() : conferenceRoomId,
            expiresIn: expiresIn,
            maxPeers: maxPeers
        };
        if (expiresIn > 0) {
            payload.expiresIn = Math.floor(Date.now() / 1000) + (this.config.conf_token_expires_min * 60);
        }
        return [payload, jwtSign(this.config.conf_secret_key, payload)];
    }
    /**
     * Handles temporary disconnection of a participant
     * @param participant The participant that disconnected
     */
    handleConfDisconnection(participant) {
        console.log("handleConfRoomDisconnection");
        if (!participant.conferenceRoom) {
            console.log("not in conference room, delete participant");
            return;
        }
        const conferenceRoomId = participant.conferenceRoom.conferenceRoomId;
        // Inform other participants about the temporary disconnection
        let leaveMsg = new ParticipantLeftMsg();
        leaveMsg.data = {
            participantId: participant.participantId,
            conferenceRoomId: conferenceRoomId,
            temporary: true // Add this flag to indicate temporary disconnection
        };
        participant.conferenceRoom.broadCastExcept(participant, leaveMsg);
        //create a timeout, and execute a final disconnect
        const timeout = setTimeout(() => {
            console.log(`Reconnection timeout for participant ${participant.participantId}.`);
            this.finalizeConfDisconnection(participant.participantId);
        }, this.config.conf_reconnection_timeout);
        // Store the disconnected participant with its timeout and conference info
        this.disconnectedParticipants.set(participant.participantId, {
            participant,
            timeout,
            conferenceRoomId
        });
        // set socket reference to null
        participant.socket = null;
        // Remove from conference room participants but don't clear the reference
        // This marks the participant as disconnected but still part of the conference
        participant.conferenceRoom.removeParticipant(participant);
    }
    /**
     * Permanently removes a disconnected participant after timeout
     * @param participantId The ID of the participant to remove
     */
    finalizeConfDisconnection(participantId) {
        const disconnectedInfo = this.disconnectedParticipants.get(participantId);
        if (!disconnectedInfo) {
            console.error("no disconnect info found.");
            return;
        }
        const { participant, conferenceRoomId } = disconnectedInfo;
        const conferenceRoom = this.conferences.get(conferenceRoomId);
        // Remove from tracking maps
        this.disconnectedParticipants.delete(participantId);
        // If the conference still exists, notify about permanent departure
        if (conferenceRoom) {
            let leaveMsg = new ConferenceLeaveMsg();
            leaveMsg.data = {
                participantId: participantId,
                conferenceRoomId: conferenceRoom.conferenceRoomId
            };
            conferenceRoom.broadCastAll(leaveMsg);
            // Properly remove from the conference if still referenced
            if (participant.conferenceRoom) {
                participant.conferenceRoom.removeParticipant(participant);
            }
        }
    }
    /**
     * Handle reconnection attempts
     * @param ws New WebSocket connection
     * @param msgIn Reconnection message
     */
    async onReconnect(ws, msgIn) {
        console.log(`Reconnection attempt for participant ${msgIn.data.participantId}`);
        const disconnectedInfo = this.disconnectedParticipants.get(msgIn.data.participantId);
        // If no disconnected participant found or room no longer exists
        if (!disconnectedInfo) {
            let msg = new ReconnectResultMsg();
            msg.data.error = "Session expired or not found";
            this.send(ws, msg);
            return;
        }
        const { participant, timeout, conferenceRoomId } = disconnectedInfo;
        const conferenceRoom = this.conferences.get(conferenceRoomId);
        // If conference no longer exists
        if (!conferenceRoom) {
            let msg = new ReconnectResultMsg();
            msg.data.error = "Conference no longer exists";
            this.send(ws, msg);
            this.disconnectedParticipants.delete(msgIn.data.participantId);
            return;
        }
        // Clear reconnection timeout
        clearTimeout(timeout);
        this.disconnectedParticipants.delete(msgIn.data.participantId);
        // Update socket reference and add back to active maps
        participant.socket = ws;
        this.participants.set(ws, participant);
        // Add participant back to conference
        conferenceRoom.addParticipant(participant);
        // Notify other participants about reconnection
        let reconnectedMsg = new ParticipantReconnectedMsg();
        reconnectedMsg.data = {
            participantId: participant.participantId,
            conferenceRoomId: conferenceRoom.conferenceRoomId
        };
        conferenceRoom.broadCastExcept(participant, reconnectedMsg);
        // Send existing participants to the reconnected user
        let reconnectResultMsg = new ReconnectResultMsg();
        reconnectResultMsg.data.conferenceRoomId = conferenceRoomId;
        // Add all other participants
        const otherParticipants = conferenceRoom.getParticipantsExcept(participant);
        for (let p of otherParticipants) {
            reconnectResultMsg.data.participants.push({
                participantId: p.participantId,
                displayName: p.displayName
            });
        }
        this.send(ws, reconnectResultMsg);
        // alert the partcipant to send offers to others
        if (conferenceRoom.confType == ConferenceType.rooms) {
        }
        else {
            for (let p of otherParticipants) {
                let needOfferMsg = new RTCNeedOfferMsg();
                needOfferMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
                needOfferMsg.data.participantId = p.participantId;
                needOfferMsg.data.isReconnection = true;
                this.send(participant.socket, needOfferMsg);
            }
        }
    }
    async onConferenceLeave(participant) {
        console.log("onConferenceLeave");
        if (!participant.conferenceRoom) {
            console.error("no room found.");
            return;
        }
        let confRoom = participant.conferenceRoom;
        confRoom.removeParticipant(participant);
        //broadcast to all participants that the participant has left the room
        let msg = new ConferenceLeaveMsg();
        msg.data = {
            participantId: participant.participantId,
            conferenceRoomId: confRoom.conferenceRoomId
        };
        confRoom.broadCastExcept(participant, msg);
    }
    /**
     * registers a socket connection
     * @param ws
     * @param msgIn
     */
    async onRegister(ws, msgIn) {
        console.log("onRegister " + msgIn.data.userName);
        let participant;
        //check if this is an existing user that dropped from a conference
        for (let disInfo of this.disconnectedParticipants.values()) {
            if (disInfo.participant.userName == msgIn.data.userName) {
                //we found an existing participant that was disconnected
                participant = disInfo.participant;
                //update the socket reference
                participant.socket = ws;
                // Clear reconnection timeout
                clearTimeout(disInfo.timeout);
                this.disconnectedParticipants.delete(msgIn.data.participantId);
                //add participant back to participants
                this.participants.set(ws, participant);
                let confRoom = this.conferences.get(disInfo.conferenceRoomId);
                if (confRoom) {
                    confRoom.addParticipant(participant);
                }
                break;
            }
        }
        let otherParticipants;
        //we found an existing participant, check if the confRoom is still valid
        if (participant && participant.conferenceRoom) {
            //send offer to all participants
            otherParticipants = participant.conferenceRoom.getParticipantsExcept(participant);
            if (participant.conferenceRoom.confType == ConferenceType.rooms) {
            }
            else {
                // alert the partcipant to send offer to otherParticipants
                for (let p of otherParticipants) {
                    let needOfferMsg = new RTCNeedOfferMsg();
                    needOfferMsg.data.conferenceRoomId = participant.conferenceRoom.conferenceRoomId;
                    needOfferMsg.data.participantId = p.participantId;
                    needOfferMsg.data.isReconnection = true;
                    this.send(participant.socket, needOfferMsg);
                }
            }
        }
        // If not found or no ID provided, create new participant
        if (!participant) {
            participant = new Participant();
            participant.participantId = "part-" + randomUUID().toString();
            participant.displayName = msgIn.data.userName;
            participant.userName = msgIn.data.userName;
            console.log("new participant created " + participant.participantId);
        }
        else {
            console.log("returning participant " + participant.participantId);
            // Update display name if changed
            if (msgIn.data.userName) {
                participant.displayName = msgIn.data.userName;
            }
        }
        // Update socket and maps
        participant.socket = ws;
        this.participants.set(ws, participant);
        //TODO: get user from database, generate authtoken
        let msg = new RegisterResultMsg();
        msg.data = {
            userName: participant.displayName,
            authToken: "", // TODO: implement auth tokens
            participantId: participant.participantId,
            conferenceRoomId: participant.conferenceRoom ? participant.conferenceRoom.conferenceRoomId : ""
        };
        this.send(ws, msg);
        if (!otherParticipants) {
            otherParticipants = this.getParticipantsExcept(ws);
        }
        //broadcast to all participants of contacts
        let contactsMsg = new GetContactsMsg();
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
        let msg = new GetContactsMsg();
        this.getParticipantsExcept(ws).forEach((p) => {
            msg.data.push({
                contactId: "",
                displayName: p.displayName,
                participantId: p.participantId,
                status: "online"
            });
        });
        // Also include disconnected participants with "reconnecting" status
        // this.disconnectedParticipants.forEach((info, participantId) => {
        //     msg.data.push({
        //         contactId: "", //database pk
        //         displayName: info.participant.displayName,
        //         participantId: participantId,
        //         status: "reconnecting"
        //     });
        // });
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
    async onCloseConference(ws, msgIn) {
        let participant = this.participants.get(ws);
        if (participant && participant.conferenceRoom && participant == participant.conferenceRoom.leader) {
            participant.conferenceRoom.close();
        }
    }
    /*
    * schedule a conference
    */
    async onNewConference(ws, msgIn) {
        let participant = this.participants.get(ws);
        if (!participant) {
            console.error("participant not found.");
            return;
        }
        let confRoom = await this.newConferenceRoom(msgIn.data.conferenceTitle, "", participant, msgIn.data.conferenceConfig);
        if (!confRoom) {
            let msg = new NewConferenceResultMsg();
            msg.data.error = "conference not created.";
            return;
        }
        let msg = new NewConferenceResultMsg();
        msg.data.conferenceRoomId = confRoom.conferenceRoomId;
        msg.data.conferenceToken = confRoom.conferenceToken;
        msg.data.roomToken = confRoom.roomToken;
        msg.data.roomId = confRoom.roomId;
        this.send(participant.socket, msg);
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
        let confRoom = caller.conferenceRoom;
        if (!confRoom) {
            //create the room and join
            let config = msgIn.data.conferenceConfig;
            confRoom = await this.newConferenceRoom(msgIn.data.conferenceTitle, msgIn.data.conferenceRoomId, caller, config);
        }
        if (confRoom) {
        }
        else {
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference.";
            this.send(caller.socket, errorMsg);
            return;
        }
        if (confRoom.confType == ConferenceType.rooms) {
            this.conferences.set(confRoom.conferenceRoomId, confRoom);
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
            console.log("roomToken", roomToken);
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
        }
        let receiver = this.getParticipant(msgIn.data.participantId);
        if (!receiver) {
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party not found.";
            this.send(caller.socket, errorMsg);
            return;
        }
        if (receiver.conferenceRoom) {
            //receiver is already in a room
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party is already in a room.";
            this.send(caller.socket, errorMsg);
            return;
        }
        let inviteResultMsg = new InviteResultMsg();
        if (msgIn.data.conferenceConfig && msgIn.data.conferenceConfig.type == ConferenceType.rooms) {
            inviteResultMsg.data.conferenceConfig.type = ConferenceType.rooms;
        }
        else {
            inviteResultMsg.data.conferenceConfig.type = ConferenceType.p2p;
        }
        //send InviteResult back to the caller
        inviteResultMsg.data.conferenceTitle = confRoom.title;
        inviteResultMsg.data.participantId = receiver.participantId;
        inviteResultMsg.data.conferenceRoomId = confRoom.conferenceRoomId;
        inviteResultMsg.data.conferenceToken = confRoom.conferenceToken;
        inviteResultMsg.data.roomId = confRoom.roomId;
        inviteResultMsg.data.roomToken = confRoom.roomToken;
        inviteResultMsg.data.roomAuthUserToken = roomAuthUserTokens[0]; //send the first user token
        this.send(ws, inviteResultMsg);
        //forward the call to the receiver
        let msg = new InviteMsg();
        msg.data.participantId = caller.participantId;
        msg.data.displayName = caller.displayName;
        msg.data.conferenceRoomId = confRoom.conferenceRoomId;
        msg.data.conferenceToken = confRoom.conferenceToken;
        msg.data.conferenceTitle = confRoom.title;
        msg.data.conferenceConfig = confRoom.config;
        msg.data.roomId = confRoom.roomId;
        msg.data.roomToken = confRoom.roomToken;
        msg.data.roomAuthUserToken = roomAuthUserTokens[1]; //send the second user token
        this.send(receiver.socket, msg);
        //both participants should now have the conferenceToken and the room token
    }
    async onReject(ws, msgIn) {
        console.log("onReject");
        let caller = this.getParticipant(msgIn.data.toParticipantId);
        if (caller.conferenceRoom && caller.conferenceRoom.conferenceRoomId == msgIn.data.conferenceRoomId) {
            let participant = this.getParticipant(msgIn.data.toParticipantId);
            if (participant && participant.socket) {
                this.send(participant.socket, msgIn);
            }
            else {
                console.error("onReject - participant not found or not connected");
            }
        }
        else {
            console.log("reject failed to find room/participant");
        }
    }
    async onJoin(ws, msgIn) {
        console.log("onJoin()");
        let participant = this.participants.get(ws);
        let conferenceRoom = this.conferences.get(msgIn.data.conferenceRoomId);
        if (!conferenceRoom) {
            console.log("invalid conference room");
            let msg = new JoinResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "unable to join conference";
            this.send(ws, msg);
            return;
        }
        //TODO: validate conference token
        //send back all participants to the user
        if (conferenceRoom.addParticipant(participant)) {
            console.log("addParticipant: " + participant.participantId);
            let newParticipantMsg = new NewParticipantMsg();
            newParticipantMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
            newParticipantMsg.data.participantId = participant.participantId;
            newParticipantMsg.data.displayName = participant.displayName;
            conferenceRoom.broadCastExcept(participant, newParticipantMsg);
            let otherParticipants = conferenceRoom.getParticipantsExcept(participant);
            //send existing participants to back to receiver
            let joinResultMsg = new JoinResultMsg();
            joinResultMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
            joinResultMsg.data.conferenceToken = conferenceRoom.conferenceToken;
            joinResultMsg.data.roomId = conferenceRoom.roomId;
            joinResultMsg.data.roomToken = conferenceRoom.roomToken;
            joinResultMsg.data.conferenceConfig = conferenceRoom.config;
            for (let p of otherParticipants) {
                joinResultMsg.data.participants.push({
                    participantId: p.participantId,
                    displayName: p.displayName
                });
            }
            this.send(ws, joinResultMsg);
            if (conferenceRoom.confType == ConferenceType.rooms) {
                //clients will create transports and connect tranports through the rooms client api
            }
            else {
                //send need offer to participants except
                for (let p of otherParticipants) {
                    let needOfferMsg = new RTCNeedOfferMsg();
                    needOfferMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
                    needOfferMsg.data.participantId = participant.participantId;
                    this.send(p.socket, needOfferMsg);
                }
            }
        }
        else {
            let msg = new JoinResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "unable to join conference";
            this.send(ws, msg);
        }
    }
    async onLeave(ws, msgIn) {
        console.log("onLeave");
        let participant = this.participants.get(ws);
        if (participant) {
            if (participant.conferenceRoom) {
                let room = participant.conferenceRoom;
                participant.conferenceRoom.removeParticipant(participant);
                // Clean up any pending reconnection
                if (this.disconnectedParticipants.has(participant.participantId)) {
                    const info = this.disconnectedParticipants.get(participant.participantId);
                    clearTimeout(info.timeout);
                    this.disconnectedParticipants.delete(participant.participantId);
                }
                let msg = new ParticipantLeftMsg();
                msg.data.conferenceRoomId = room.conferenceRoomId;
                msg.data.participantId = participant.participantId;
                room.broadCastAll(msg);
                // if(room.confType == ConferenceType.rooms) {
                //clients will talk directly to the roomserver
                //}
            }
        }
    }
    /*
    this is for RTC p2p calls
    */
    async onRTCCall(ws, msgIn) {
        console.log("onRTCCall");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        }
        else {
            console.error("onRTCCall - participant not found or not connected");
        }
    }
    async onRTCAnswer(ws, msgIn) {
        console.log("onRTCAnswer");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        }
        else {
            console.error("onRTCAnswer - participant not found or not connected");
        }
    }
    async onRTCOffer(ws, msgIn) {
        console.log("onRTCOffer");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        }
        else {
            console.error("onRTCOffer - participant not found or not connected");
        }
    }
    async onRTCIce(ws, msgIn) {
        console.log("onRTCIce");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        }
        else {
            console.error("onRTCIce - participant not found or not connected");
        }
    }
}
