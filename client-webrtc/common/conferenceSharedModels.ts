export enum ConferenceType {
    p2p = "p2p",
    rooms = "rooms"
}

export enum CallMessageType {
    login = "login",
    register = "register", //register the partcipant
    registerResult = "registerResult", //partcipant recieves a registration result
    newConference = "newConference",
    newConferenceResult = "newConferenceResult",
    invite = "invite", //invite to join room
    inviteResult = "inviteResult", //result of the invite, the other participant could reject it
    reject = "reject", //the receiver rejects
    join = "join", //participant requests to join the conference room
    joinResult = "joinResult", //participant receives the joinResult
    leave = "leave", //participant signals to leave the room
    newParticipant = "newParticipant", // all participants gets alerted of a new participant in the room
    participantLeft = "participantLeft", // a participants leaves the room
    conferenceClosed = "conferenceClosed",
    closeConference = "closeConference", // the participant closes the conference, and the confernece room is terminated on the server
    getContacts = "getContacts",

    reconnect = "reconnect",
    reconnectResult = "reconnectResult",
    participantReconnected = "participantReconnected",

    rtc_needOffer = "rtc_needOffer",
    rtc_offer = "rtc_offer",
    rtc_answer = "rtc_answer",
    rtc_ice = "rtc_ice",
}

export interface LoginMsg {
    type: "login"
    data: {
        username: string,
        password: string
    }
}

export interface LoginResultMsg {
    type: "loginResult"
    data: {
        authToken: string,
        error?: string
    }
}


//object mapped from a database object
export interface ConferenceObj {
    conferenceId: number, //primary key
    leaderId: number //user that created the conference
    isRecorded: boolean,
    maxParticipants: number,
    dateStart: Date,
    dateEnd: Date
}

export class ConferenceConfig {
    dateStart? = new Date();
    dateEnd?: Date = null;
    maxParticipants?: number = 2;
    allowConferenceVideo? = true;
    allowConferenceAudio? = true;

    allowParticipantVideo? = true;
    allowParticpantAudio? = true;

    inviteOnly? = false; //anyone can join or by invite only
    type?: ConferenceType = ConferenceType.p2p; //p2p is using p2p webrtc calls, room is using sfu conferencing

    /**
     * room will terminate when there are not participants for this duration
     */
    timeOutNoParticipantsSecs? = 30000;
    /**
     * maxDuration for the room
     */
    timeOutMaxDurationSecs? = 3600000;

    /**
     username of the leader, if no match then all are participants
      */
    leaderUserName? = "";
    /**
     * if the leader exits close the room
     */
    closeConferenceOnLeaderExit? = false;
    expiresIn? = 0;

}

export interface Contact {
    contactId: string, //unique identifier of the contact, normally from the primary key
    participantId: string,
    displayName: string,
    status: "online" | "offline" | "reconnecting",
}

export type ConferenceRole = "participant" | "leader" | "monitor";

export interface IParticipant {
    participantId: string;
    displayName: string
}

// Message sent by client to attempt reconnection
export class ReconnectMsg {
    type = CallMessageType.reconnect;
    data: {
        participantId: string;
        conferenceRoomId?: string;
    } = {
            participantId: ""
        };
}

// Server response to reconnection attempt
export class ReconnectResultMsg {
    type = CallMessageType.reconnectResult;
    data: {
        conferenceRoomId: string;
        participants: IParticipant[];
        error?: string;
    } = {
            conferenceRoomId: "",
            participants: []
        };
}

// Broadcast to other participants when someone reconnects
export class ParticipantReconnectedMsg {
    type = CallMessageType.participantReconnected;
    data: {
        participantId: string;
        conferenceRoomId: string;
    } = {
            participantId: "",
            conferenceRoomId: ""
        };
}

export class RegisterMsg {
    type = CallMessageType.register;
    data = {
        userName: "",
        authToken: "",
        participantId: ""
    }
}

export class RegisterResultMsg {
    type = CallMessageType.registerResult;
    data: {
        userName: string,
        authToken: string,
        participantId: string,
        conferenceRoomId: string,
        error?: string
    } = {
            userName: "",
            authToken: "",
            participantId: "",
            conferenceRoomId: ""
        }
}

export class NewConferenceMsg {
    type = CallMessageType.newConference;
    data = {
        conferenceTitle: "",
        conferenceConfig: new ConferenceConfig()
    }
}

export class NewConferenceResultMsg {
    type = CallMessageType.newConferenceResult;
    data = {
        conferenceRoomId: "",
        conferenceToken: "",
        roomId: "",
        roomToken: "",
        error: ""
    }
}

export class ConferenceLeaveMsg {
    type = CallMessageType.participantLeft;
    data = {
        conferenceRoomId: "",
        participantId: ""
    }
}

export class GetContactsMsg {
    type = CallMessageType.getContacts;
    data: Contact[] = [];
}

export class InviteMsg {
    type = CallMessageType.invite;
    data: {
        participantId?: string,
        displayName?: string,
        conferenceRoomId?: string,
        conferenceConfig?: ConferenceConfig,
        conferenceToken?: string,
        conferenceTitle?: string,
        roomId?: string,
        roomToken?: string
    } = {
            conferenceConfig: new ConferenceConfig()
        }
}

export class InviteResultMsg {
    type = CallMessageType.inviteResult;
    data: {
        participantId?: string,
        displayName?: string,
        conferenceRoomId?: string,
        conferenceConfig?: ConferenceConfig,
        conferenceToken?: string,
        conferenceTitle?: string,
        roomId?: string,
        roomToken?: string,
        error?: string
    } = {
            conferenceConfig: new ConferenceConfig()
        }
}

export class RejectMsg {
    type = CallMessageType.reject;
    data: {
        conferenceRoomId?: string,
        fromParticipantId?: string,
        toParticipantId?: string,
    } = {
        }
}

export class JoinMsg {
    type = CallMessageType.join;
    data: {
        conferenceRoomId?: string,
        conferenceToken?: string,
        roomId?: string,
        roomToken?: string,
        error?: string
    } = {
        }
}

export class JoinResultMsg {
    type = CallMessageType.joinResult;
    data?: {
        conferenceRoomId?: string,
        conferenceToken?: string;
        roomId?: string;
        roomToken?: string;
        participants?: IParticipant[],
        conferenceConfig?: ConferenceConfig,
        error?: string
    } = {
            participants: []
        }
}

export class RTCNeedOfferMsg {
    type = CallMessageType.rtc_needOffer;
    data: {
        participantId: string;
        displayName: string
        conferenceRoomId: string;
        isReconnection?: boolean;
    } = {
            participantId: "",
            displayName: "",
            conferenceRoomId: ""
        };
}

export class LeaveMsg {
    type = CallMessageType.leave;
    data = {
        conferenceRoomId: "",
        participantId: ""
    }
}

export class NewParticipantMsg {
    type = CallMessageType.newParticipant;
    data = {
        conferenceRoomId: "",
        participantId: "",
        displayName: ""
    }
}

// Add the temporary flag to the ParticipantLeftMsg
// This lets clients know if a participant just dropped or intentionally left
export class ParticipantLeftMsg {
    type = CallMessageType.participantLeft;
    data: {
        participantId: string;
        conferenceRoomId: string;
        temporary?: boolean;
    } = {
            participantId: "",
            conferenceRoomId: ""
        };
}

export class ConferenceClosedMsg {
    type = CallMessageType.conferenceClosed;
    data = {
        conferenceRoomId: ""
    }
}

export class CloseConference {
    type = CallMessageType.conferenceClosed;
    data = {
        conferenceRoomId: ""
    }
}