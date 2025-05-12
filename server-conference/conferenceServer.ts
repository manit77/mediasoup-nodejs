
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { CallMessageType, ConferenceClosedMsg, ConferenceLeaveMsg, ConferenceRole, GetContactsMsg, InviteMsg, InviteResultMsg, JoinMsg, JoinResultMsg, LeaveMsg, NeedOfferMsg, NewConferenceMsg, NewConferenceResultMsg, NewParticipantMsg, ParticipantLeftMsg, RegisterMsg, RegisterResultMsg } from './sharedModels';
import { ConferenceConfig, ConferenceRoom, Participant } from './models';

export class ConferenceServer {

    webSocketServer: WebSocketServer;
    participants = new Map<WebSocket, Participant>();
    conferences = new Map<string, ConferenceRoom>();
    config = {
        serverPort: 3001
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
                }
            };

            ws.onclose = () => {
                const participant = this.participants.get(ws);
                if (participant) {
                    //delete from participants
                    this.participants.delete(ws);

                    if (participant.conferenceRoom) {
                        this.onConferenceLeave(participant)
                    }

                    console.log(`participant ${participant.participantId} disconnected and resources cleaned up. participants: ` + this.participants.size + " rooms:" + this.conferences.size);
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

        if(conferenceRoomId == null || conferenceRoomId === undefined) {
            console.error("invalid conferenceRoomId.");
            return;
        }
        
        conferenceRoomId = (conferenceRoomId == "") ? randomUUID().toString() : conferenceRoomId;
        if(this.conferences.has(conferenceRoomId)){
            console.error("conference already exists " + conferenceRoomId);
            return null;
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
                this.send(participant.socket, msg);
            }

            confRoom.participants = [];
            this.conferences.delete(confRoom.conferenceRoomId);
            console.log("delete conference. total conferences: " + this.conferences.size);
        };

        return confRoom;
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

    async onRegister(ws: WebSocket, msgIn: RegisterMsg) {
        console.log("onRegister " + msgIn.data.userName);

        //get or set participant
        let participant: Participant = this.participants.get(ws);
        if (!participant) {
            participant = new Participant();
            participant.participantId = randomUUID().toString();
            participant.socket = ws;
            participant.displayName = msgIn.data.userName;
            this.participants.set(ws, participant);
            console.log("new participant created " + participant.participantId);
        }

        //TODO: get user from database, generate authtoken

        let msg = new RegisterResultMsg();
        msg.data = {
            userName: "",
            authToken: "",
            participantId: participant.participantId
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
        this.send(ws, msg);

    }

    getParticipant(participantId: string) {
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

        if (!caller.conferenceRoom) {
            //receiver is already in a room
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "you are not in a conference";
            this.send(caller.socket, errorMsg);
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
        } else {

            //forward the call to the receiver
            let msg = new InviteMsg();
            msg.data.participantId = caller.participantId;
            msg.data.conferenceRoomId = caller.conferenceRoom.conferenceRoomId;
            msg.data.displayName = caller.displayName;

            if (!this.send(receiver.socket, msg)) {
                console.error("failed to send call to receiver");
                return;
            }


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

        //send back all participants  to the user


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
        if (participant) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCCall - participant not found");
        }
    }

    async onRTCAnswer(ws: WebSocket, msgIn: any) {
        console.log("onRTCAnswer");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCAnswer - participant not found");
        }
    }

    async onRTCOffer(ws: WebSocket, msgIn: any) {
        console.log("onRTCOffer");
        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCOffer - participant not found");
        }
    }

    async onRTCIce(ws: WebSocket, msgIn: any) {
        console.log("onRTCIce");

        let participant = this.getParticipant(msgIn.data.toParticipantId);
        if (participant) {
            this.send(participant.socket, msgIn);
        } else {
            console.error("onRTCIce - participant not found");
        }

    }

}