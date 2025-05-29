export enum ConferenceType {
    p2p = "p2p",
    rooms = "rooms"
}

export enum CallMessageType {

    login = "login",
    register = "register", //register the partcipant
    registerResult = "registerResult", //partcipant recieves a registration result

    invite = "invite", //invite to join room
    inviteResult = "inviteResult", //result of the invite, the other participant could reject it

    reject = "reject", //the receiver rejects
    accept = "accept", //participant requests to join the conference room
    leave = "leave", //participant signals to leave the room

    getContacts = "getContacts",
    getContactsResults = "getContactsResults",

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

export interface Contact {
    contactId: string, //unique identifier of the contact, normally from the primary key
    participantId: string,
    displayName: string,
    status: "online" | "offline" | "reconnecting",
}

export interface IParticipant {
    participantId: string;
    displayName: string
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

export class GetContactsMsg {
    type = CallMessageType.getContacts;
    data: {}
}

export class GetContactsResultsMsg {
    type = CallMessageType.getContactsResults;
    data: Contact[] = [];
}

export class InviteMsg {
    type = CallMessageType.invite;
    data: {
        participantId?: string,
        displayName?: string,
        roomId?: string,
        roomToken?: string
        roomAuthUserToken?: string
    } = {
        }
}

export class InviteResultMsg {
    type = CallMessageType.inviteResult;
    data: {
        participantId?: string,
        displayName?: string,
        conferenceToken?: string,
        conferenceTitle?: string,
        roomId?: string,
        roomToken?: string,
        roomAuthUserToken?: string
        error?: string
    } = {
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

export class AcceptMsg {
    type = CallMessageType.accept;
    data: {
        conferenceRoomId?: string,
        conferenceToken?: string,
        roomId?: string,
        roomToken?: string,
        error?: string
    } = {
        }
}

export class AcceptResultMsg {
    type = CallMessageType.accept;
    data: {
        conferenceRoomId?: string,
        conferenceToken?: string,
        roomId?: string,
        roomToken?: string,
        error?: string
    } = {
        }
}

export class LeaveMsg {
    type = CallMessageType.leave;
    data = {
        conferenceRoomId: "",
        participantId: ""
    }
}

