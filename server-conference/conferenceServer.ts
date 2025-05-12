
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { CallMessageType, CallMsg, CallResultMsg, ConferenceClosedMsg, ConferenceLeaveMsg, ConferenceRole, GetContactsMsg, JoinMsg, JoinResultMsg, LeaveMsg, NeedOfferMsg, NewParticipantMsg, ParticipantLeftMsg, RegisterMsg, RegisterResultMsg } from './sharedModels';

export interface Participant {
    participantId: string,
    displayName: string,
    socket: WebSocket,
    conferenceRoom: ConferenceRoom,
    role: ConferenceRole
}

export class ConferenceRoom {
    conferenceId: number; //primary key from database
    conferenceRoomId: string; //conference server roomid generated
    participants: Participant[] = [];
    maxParticipants: number = 2;
    dateCreated = new Date();
    dateEnd?: Date = null;
    timerId?: NodeJS.Timeout = null;
    isClosed = false;

    onParticipantRemove: ((participant: Participant) => void);
    onParticipantAdd: (participant: Participant) => void;
    onClosed: () => void;

    async addParticipant(participant: Participant): Promise<boolean> {
        if (this.isClosed) {
            console.error("conference is closed.");
            return false;
        }

        if (this.maxParticipants > 2 && this.participants.length >= this.maxParticipants) {
            console.error("max participants reached");
            return false;
        }

        if (participant.conferenceRoom) {
            console.error("already in conference room");
            return false;
        }

        console.log("addParticipant", participant.participantId);
        this.participants.push(participant);
        participant.conferenceRoom = this;

        if (this.onParticipantAdd) {
            this.onParticipantAdd(participant);
        }

        return true;
    }

    removeParticipant(participant: Participant): void {
        console.log("removeParticipant ", participant.participantId);
        if (participant.conferenceRoom == this) {
            let idx = this.participants.findIndex(p => p.participantId == participant.participantId);
            if (idx > -1) {
                this.participants.splice(idx, 1);
            }
            participant.conferenceRoom = null;
        }

        if (this.onParticipantRemove) {
            this.onParticipantRemove(participant);
        }
    }

    async broadCastExcept(except: Participant, msg: any) {
        console.log("broadCastExcept ", msg.type);
        for (let p of this.participants.values()) {
            if (except != p) {
                p.socket.send(JSON.stringify(msg));
            }
        }
    }

    async broadCastAll(msg: any) {
        for (let p of this.participants.values()) {
            p.socket.send(JSON.stringify(msg));
        }
    }

    close() {
        this.isClosed = true;
        if (this.onClosed) {
            this.onClosed();
        }
    }
}

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
                    case CallMessageType.call:
                        this.onCall(ws, msgIn);
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

    newConferenceRoom(conferenceId: number = 0, maxParticipants: number = 2) {
        let confRoom = new ConferenceRoom();
        confRoom.conferenceRoomId = randomUUID().toString();
        confRoom.conferenceId = conferenceId;
        confRoom.maxParticipants = maxParticipants;
        this.conferences.set(confRoom.conferenceRoomId, confRoom);

        confRoom.onParticipantRemove = (participant: Participant) => {
            console.log("onParticipantRemove");
            if (confRoom.participants.length == 0) {
                this.conferences.delete(confRoom.conferenceRoomId);
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
            participant = {
                participantId: randomUUID().toString(),
                socket: ws,
                displayName: msgIn.data.userName,
                conferenceRoom: null,
                role: "participant"
            };

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

    async onCloseConference(ws: WebSocket, msgIn: CallMsg) {
        let participant = this.participants.get(ws);
        if (participant && participant.conferenceRoom) {
            participant.conferenceRoom.close();
        }
    }

    async onCall(ws: WebSocket, msgIn: CallMsg) {
        //new call
        //create a room
        let caller = this.participants.get(ws);

        if (caller.conferenceRoom) {
            //already in a room
            let errorMsg = new CallResultMsg();
            errorMsg.data.error = "alrady  in  a conference.";
            this.send(ws, errorMsg);
            return;
        }

        let receiver = this.getParticipant(msgIn.data.participantId);
        if (receiver) {
            if (receiver.conferenceRoom) {
                //receiver is already in a room
                let errorMsg = new CallResultMsg();
                errorMsg.data.error = "participant is already in a room.";
                this.send(caller.socket, errorMsg);
            } else {

                let newRoom = this.newConferenceRoom(0);
                let callResultMsg = new CallResultMsg();
                callResultMsg.data.conferenceRoomId = newRoom.conferenceRoomId;
                //msg.data.conferenceToken = randomUUID().toString(); //to do generate an authtoken      

                if (!this.send(caller.socket, callResultMsg)) {
                    console.error("failed to send call result");
                    return;
                }

                //forward the call to the receiver
                let msg = new CallMsg();
                msg.data.participantId = caller.participantId;
                msg.data.conferenceRoomId = newRoom.conferenceRoomId;
                msg.data.displayName = caller.displayName;

                if (!this.send(receiver.socket, msg)) {
                    console.error("failed to send call to receiver");
                    return;
                }

                if (!newRoom.addParticipant(caller)) {
                    console.error("failed to add participant");
                    return;
                }

            }
        } else {
            let errorMsg = new CallResultMsg();
            errorMsg.data.error = "participant not found.";
            this.send(caller.socket, errorMsg);
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

            //send existing participants to back to receiver
            let joinResultMsg = new JoinResultMsg();
            joinResultMsg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            for (let [id, p] of conferenceRoom.participants.entries()) {
                if (p != participant) {
                    joinResultMsg.data.participants.push({
                        participantId: p.participantId,
                        displayName: p.displayName
                    });
                }
            }
            this.send(ws, joinResultMsg);

            //send need offer to leader
            let needOfferMsg = new NeedOfferMsg();
            needOfferMsg.data.conferenceRoomId = conferenceRoom.conferenceRoomId;
            needOfferMsg.data.participantId = participant.participantId;

            let leader = conferenceRoom.participants[0];
            if (leader) {
                this.send(leader.socket, needOfferMsg);
            } else {
                console.error("leader not found.");
            }

        } else {
            let msg = new JoinResultMsg();
            msg.data.conferenceRoomId = msgIn.data.conferenceRoomId;
            msg.data.error = "unable to join conference";
            this.send(ws, msg);
        }
    }

    async onLeave(ws: WebSocket, msgIn: LeaveMsg) {
        let participant = this.participants.get(ws);
        if (participant) {
            if (participant.conferenceRoom) {
                let room = participant.conferenceRoom;
                participant.conferenceRoom.removeParticipant(participant);
                
                let msg = new ParticipantLeftMsg();
                msg.data.conferenceRoomId =room.conferenceRoomId;
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