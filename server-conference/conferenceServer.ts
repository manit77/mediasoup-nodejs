import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { CallMessageType, ConferenceClosedMsg, ConferenceLeaveMsg, ConferenceRole, GetContactsMsg, InviteMsg, InviteResultMsg, JoinMsg, JoinResultMsg, LeaveMsg, NeedOfferMsg, NewConferenceMsg, NewConferenceResultMsg, NewParticipantMsg, ParticipantLeftMsg, RegisterMsg, RegisterResultMsg, ReconnectMsg, ReconnectResultMsg, ParticipantReconnectedMsg } from './sharedModels';
import { ConferenceConfig, ConferenceRoom, Participant } from './models';

export class ConferenceServer {

    webSocketServer: WebSocketServer;
    participants = new Map<WebSocket, Participant>();
    conferences = new Map<string, ConferenceRoom>();
    // Track disconnected participants for reconnection (timeout in milliseconds)
    disconnectedParticipants = new Map<string, { participant: Participant, timeout: NodeJS.Timeout, conferenceRoomId: string }>();


    config = {
        serverPort: 3001,
        // Reconnection timeout in milliseconds (default 30 seconds)
        reconnectionTimeout: 30000
    }

    constructor(private httpServer: https.Server) {

    }

    async start() {
        this.httpServer.listen(this.config.serverPort, async () => {
            console.log(`Server running at https://localhost:${this.config.serverPort}`);
            this.initWebSocket();
        });
    }


    async initWebSocket() {

        this.webSocketServer = new WebSocketServer({ server: this.httpServer });
        this.webSocketServer.on('connection', (ws) => {

            console.log("socket connected participants: " + this.participants.size);

            ws.onmessage = async (message) => {

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
     * 
     * @param conferenceId pk for conference object in a database
     * @param conferenceRoomId user assigned or randonly generated UUID
     * @param maxParticipants 
     * @returns 
     */
    newConferenceRoom(conferenceRoomId: string = "", leader: Participant, config: ConferenceConfig) {

        if (conferenceRoomId == null || conferenceRoomId === undefined) {
            console.error("invalid conferenceRoomId.");
            return;
        }

        conferenceRoomId = (conferenceRoomId == "") ? randomUUID().toString() : conferenceRoomId;
        if (this.conferences.has(conferenceRoomId)) {
            console.error("conference already exists " + conferenceRoomId);
            return null;
        }

        if (!config) {
            config = new ConferenceConfig();
        }

        let confRoom = new ConferenceRoom();
        confRoom.conferenceRoomId = conferenceRoomId == "" ? randomUUID().toString() : conferenceRoomId;
        confRoom.config = config;
        confRoom.leader = leader;

        this.conferences.set(confRoom.conferenceRoomId, confRoom);

        confRoom.onParticipantRemove = (participant: Participant) => {
            console.log("onParticipantRemove");
            if (confRoom.participants.length == 0) {
                this.conferences.delete(confRoom.conferenceRoomId);
                console.log("delete conference. total conferences: " + this.conferences.size);
            }
        };

        confRoom.onParticipantAdd = (participant: Participant) => {
            console.log("onParticipantAdd");
            participant.conferenceRoom = confRoom;
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
        };

        return confRoom;
    }

    /**
     * Handles temporary disconnection of a participant
     * @param participant The participant that disconnected
     */
    handleConfDisconnection(participant: Participant) {
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
        }, this.config.reconnectionTimeout);

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
    finalizeConfDisconnection(participantId: string) {
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
    async onReconnect(ws: WebSocket, msgIn: ReconnectMsg) {
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
        for (let p of otherParticipants) {
            let needOfferMsg = new NeedOfferMsg();
            needOfferMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
            needOfferMsg.data.participantId = p.participantId;
            needOfferMsg.data.isReconnection = true;
            this.send(participant.socket, needOfferMsg);
        }
    }



    async onConferenceLeave(participant: Participant) {
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
        }
        confRoom.broadCastExcept(participant!, msg);
    }

    /**
     * registers a socket connection
     * @param ws 
     * @param msgIn 
     */
    async onRegister(ws: WebSocket, msgIn: RegisterMsg) {
        console.log("onRegister " + msgIn.data.userName);

        let participant: Participant;
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

        //we found an existing participant, check if the confRoom is still valid
        if (participant && participant.conferenceRoom) {

            //send offer to all participants
            let otherParticipants = participant.conferenceRoom.getParticipantsExcept(participant);
            // alert the partcipant to send offer to otherParticipants
            for (let p of otherParticipants) {
                let needOfferMsg = new NeedOfferMsg();
                needOfferMsg.data.conferenceRoomId = participant.conferenceRoom.conferenceRoomId;
                needOfferMsg.data.participantId = p.participantId;
                needOfferMsg.data.isReconnection = true;
                this.send(participant.socket, needOfferMsg);
            }

        }

        // If not found or no ID provided, create new participant
        if (!participant) {
            participant = new Participant();
            participant.participantId = randomUUID().toString();
            participant.displayName = msgIn.data.userName;
            participant.userName = msgIn.data.userName;
            console.log("new participant created " + participant.participantId);
        } else {
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
            authToken: "",  // TODO: implement auth tokens
            participantId: participant.participantId,
            conferenceRoomId: participant.conferenceRoom ? participant.conferenceRoom.conferenceRoomId : ""
        };

        this.send(ws, msg);

        //MOCK: send the list of contacts to all that is online
        for (let [key, value] of this.participants.entries()) {
            this.onGetContacts(value.socket);
        }
    }

    async onGetContacts(ws: WebSocket, msgIn?: any) {

        //TODO: get list of contacts from database

        //For concept, get all participants online

        let msg = new GetContactsMsg();

        this.participants.forEach((p) => {
            if (p.socket != ws) {
                msg.data.push({
                    contactId: "", //database pk
                    displayName: p.displayName,
                    participantId: p.participantId,
                    status: "online"
                });
            }
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

    getParticipant(participantId: string) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.participantId == participantId) {
                return participant;
            }
        }
        return null;
    }

    async onCloseConference(ws: WebSocket, msgIn: any) {
        let participant = this.participants.get(ws);
        if (participant && participant.conferenceRoom && participant == participant.conferenceRoom.leader) {
            participant.conferenceRoom.close();
        }
    }

    async onNewConference(ws: WebSocket, msgIn: NewConferenceMsg) {
        let participant = this.participants.get(ws);
        if (!participant) {
            console.error("participant not found.")
            return;
        }

        let confRoom = this.newConferenceRoom(msgIn.data.conferenceRoomId, participant, msgIn.data.config);
        if (!confRoom) {
            let msg = new NewConferenceResultMsg();
            msg.data.error = "conference not created."
            return;
        }

        let msg = new NewConferenceResultMsg();
        msg.data.conferenceRoomId = confRoom.conferenceRoomId;

        this.send(participant.socket, msg);
    }

    async onInvite(ws: WebSocket, msgIn: InviteMsg) {
        //new call
        //create a room if needed
        let caller = this.participants.get(ws);
        let confRoom: ConferenceRoom = caller.conferenceRoom;


        if (!confRoom) {
            //create the room and join
            let config = msgIn.data.newConfConfig;
            confRoom = this.newConferenceRoom(msgIn.data.conferenceRoomId, caller, config)

            if (confRoom) {
                if (!confRoom.addParticipant(caller)) {
                    let errorMsg = new InviteResultMsg();
                    errorMsg.data.error = "failed to add you to the conference.";
                    this.send(caller.socket, errorMsg);
                    return;
                }
            } else {
                let errorMsg = new InviteResultMsg();
                errorMsg.data.error = "error creating conference.";
                this.send(caller.socket, errorMsg);
                return;
            }

        }

        if (!caller.conferenceRoom) {
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "you are not in a conference";
            this.send(caller.socket, errorMsg);
            return;
        }

        let receiver = this.getParticipant(msgIn.data.participantId);
        if (!receiver) {
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "participant not found.";
            this.send(caller.socket, errorMsg);
            return;
        }

        if (receiver.conferenceRoom) {
            //receiver is already in a room
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "participant is already in a room.";
            this.send(caller.socket, errorMsg);
            return;
        }

        //forward the call to the receiver
        let msg = new InviteMsg();
        msg.data.participantId = caller.participantId;
        msg.data.conferenceRoomId = caller.conferenceRoom.conferenceRoomId;
        msg.data.displayName = caller.displayName;

        // Only try to send if the receiver has an active socket
        if (receiver.socket && !this.send(receiver.socket, msg)) {
            console.error("failed to send call to receiver");
            return;
        }

    }

    async onJoin(ws: WebSocket, msgIn: JoinMsg) {

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

        if (!conferenceRoom) {
            let msg = new JoinResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "invalid conference";
            this.send(ws, msg);
        }

        //send back all participants to the user
        if (conferenceRoom.addParticipant(participant)) {

            let newParticipantMsg = new NewParticipantMsg();
            newParticipantMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
            newParticipantMsg.data.participantId = participant.participantId;
            conferenceRoom.broadCastExcept(participant, newParticipantMsg);

            let otherParticipants = conferenceRoom.getParticipantsExcept(participant);
            //send existing participants to back to receiver
            let joinResultMsg = new JoinResultMsg();
            joinResultMsg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            for (let p of otherParticipants) {
                joinResultMsg.data.participants.push({
                    participantId: p.participantId,
                    displayName: p.displayName
                });
            }
            this.send(ws, joinResultMsg);

            //send need offer to participants except
            for (let p of otherParticipants) {
                let needOfferMsg = new NeedOfferMsg();
                needOfferMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
                needOfferMsg.data.participantId = participant.participantId;
                this.send(p.socket, needOfferMsg);
            }

        } else {
            let msg = new JoinResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "unable to join conference";
            this.send(ws, msg);
        }
    }

    async onLeave(ws: WebSocket, msgIn: LeaveMsg) {
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
            }
        }
    }

    async onRTCCall(ws: WebSocket, msgIn: any) {
        console.log("onRTCCall");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCCall - participant not found or not connected");
        }
    }

    async onRTCAnswer(ws: WebSocket, msgIn: any) {
        console.log("onRTCAnswer");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCAnswer - participant not found or not connected");
        }
    }

    async onRTCOffer(ws: WebSocket, msgIn: any) {
        console.log("onRTCOffer");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCOffer - participant not found or not connected");
        }
    }

    async onRTCIce(ws: WebSocket, msgIn: any) {
        console.log("onRTCIce");

        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant && participant.socket) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCIce - participant not found or not connected");
        }
    }
}