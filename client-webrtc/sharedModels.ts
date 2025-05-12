export enum CallType {
    webrtc = "webrtc",
    rooms = "rooms"
}

export enum CallMessageType {
    register = "register", //register the partcipant
    register_result = "register_result", //partcipant recieves a registration result
    call = "call", //participant requests a party to join a conference, participant joins the conference on the server
    call_result = "call_result", //participant receives a call result with the conferenceroomid
    join = "join", //participant requests to join the conference room
    joinResult = "joinResult", //participant receives the joinResult
    leave = "leave", //participant signals the sever to leave the room
    newParticipant = "newParticipant", // all participants gets alerted of a new participant in the room
    participantLeft = "participantLeft", // a participants leaves the room
    conferenceClosed = "conferenceClosed",
    closeConference = "closeConference", // the participant closes the conference, and the confernece room is terminated on the server
    getContacts = "getContacts",
    needOffer = "needOffer",
    rtc_offer = "rtc_offer",
    rtc_answer = "rtc_answer",
    rtc_ice = "rtc_ice",

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

export interface Contact {
    contactId: string, //unique identifier of the contact, normally from the primary key
    participantId: string
    displayName: string,
    status: "online" | "offline",
}

export type ConferenceRole = "participant" | "leader" | "monitor";

export class RegisterMsg {
    type = CallMessageType.register;
    data = {
        userName: "",
        authToken: ""
    }
}

export class RegisterResultMsg {
    type = CallMessageType.register_result;
    data = {
        userName: "",
        authToken: "",
        participantId: ""
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

export class CallMsg {
    type = CallMessageType.call;
    data = {
        participantId: "",
        displayName : "",
        conferenceRoomId: ""
    }
}

export class CallResultMsg {
    type = CallMessageType.call_result;
    data = {
        conferenceRoomId: "",
        conferenceToken: "",
        error: ""
    }
}

export class JoinMsg {
    type = CallMessageType.join;
    data = {
        conferenceRoomId: "",
        error: ""
    }
}

export class JoinResultMsg {
    type = CallMessageType.joinResult;
    data = {        
        conferenceRoomId: "",
        participants: [],
        error: ""
    }
}

export class NeedOfferMsg {
    type = CallMessageType.needOffer;
    data = {
        conferenceRoomId: "",
        participantId: ""        
    }
}

export class LeaveMsg {
    type = CallMessageType.leave;
    data = {
        conferenceRoomId: "",
        participantId : ""
    }
}

export class NewParticipantMsg {
    type = CallMessageType.newParticipant;
    data = {
        conferenceRoomId: "",
        participantId: ""
    }
}

export class ParticipantLeftMsg {
    type = CallMessageType.participantLeft;
    data = {
        conferenceRoomId: "",
        participantId: "",
        message: ""
    }
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