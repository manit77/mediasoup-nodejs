import { WebSocketManager } from "../../utils/webSocketManager";
import { AuthUser, Conference, ConferenceModel, Contacts, Participant } from "./serverModels";


export interface Participant {
    participantId : string, //unique identifier assinged by the server, references the connection
    displayName: string
}


export class CallSession {
    callId: string = ""; //if room then callid is the roomid
    participantId: string = ""; //when on a call the participantid is the peer
    callState: "" | "connecting" | "connected" | "disconnecting" | "disconnected" = "";
    callType = CallType.rooms;   
}

export class ConferenceServiceConfig {
    conferenceURI = "wss://localhost:3001";
    presensceURI = "wss://localhost:3001";
    apiURI = "https://localhost:3001";
}

export class ConferenceService {

    authUser: AuthUser;
    localParticipant: Participant;
    localConference: Conference;

    //presence signalling, realtime contacts list
    wsPresence: WebSocketManager;

    //oncall conference
    wsConference: WebSocketManager;
    isConnected = false;
    config: ConferenceServiceConfig;

    //single call session
    callSession: CallSession;

    init(config: ConferenceServiceConfig) {
        this.config = config;
    }

    setAuthUser(authUser: AuthUser) {
        this.authUser = authUser;
    }

    async getContacts(): Promise<Contacts[]> {

        let msg = {
            type: "getContacts",
            data: {
                authToken: this.authUser.authToken
            }
        };

        this.wsPresence.send(msg);

        return [];
    }

    async goOnline(): Promise<boolean> {

        this.wsPresence = new WebSocketManager();

        this.wsPresence.on("onopen", () => {
            this.isConnected = true;
        });

        this.wsPresence.on("onmessage", (msgIn: any) => {
            console.log("onmessage:", msgIn);

            switch (msgIn.type) {
                case CallMessageType.call:
                    //incoming call
                    this.callSession = new CallSession();
                    this.callSession.callId = msgIn.data.callId;
                    if (msgIn.data.callType == CallType.rooms) {
                        this.callSession.callType = CallType.rooms;
                    } else {
                        this.callSession.callType = CallType.webrtc;
                    }
                    this.callSession.participantId = msgIn.data.participantId;
                    this.callSession.callState = "connecting";
                    break;
                case CallMessageType.call_result:
                    if (msgIn.data.status === "ok") {
                        this.callSession = new CallSession();
                        this.callSession.callId = msgIn.data.callId;
                        if (msgIn.data.callType == CallType.rooms) {
                            this.callSession.callType = CallType.rooms;
                        } else {
                            this.callSession.callType = CallType.webrtc;
                        }
                        this.callSession.callState = "connecting";
                    } else {
                        console.log("call failed " + msgIn.data.error);
                        this.callSession.callState = "disconnected";
                    }
                    break;
                case CallMessageType.answer:
                    //remote participant answered
                    this.callSession = new CallSession();
                    this.callSession.callId = msgIn.data.callId;
                    if (msgIn.data.callType == CallType.rooms) {
                        this.callSession.callType = CallType.rooms;
                    } else {
                        this.callSession.callType = CallType.webrtc;
                    }
                    break;
            }
        });

        this.wsPresence.on("onclose", () => {
            this.isConnected = false;
        });

        this.wsConference.initialize(this.config.presensceURI, this.authUser.authToken, true);

        return true;
    }

    async makeCall(contactId: string): Promise<boolean> {

        let msg = {
            type: CallMessageType.call,
            data: {
                authToken: this.authUser.authToken
            }
        };

        this.wsPresence.send(msg);

        return true;
    }

    async joinConference(conferenceId: string): Promise<boolean> {

        return true;
    }

    async leaveConference(): Promise<boolean> {

        return true;
    }


}

const conferenceService = new ConferenceService();

export default conferenceService;