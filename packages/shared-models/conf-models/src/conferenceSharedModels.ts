export enum CallMessageType {

    authenticate = "authenticate", //gets an authtoken
    authenticateResult = "authenticateResult",
    register = "register", //register the partcipant as online
    registerResult = "registerResult", //partcipant recieves a registration result

    invite = "invite", //invite to join room
    inviteCancelled = "inviteCancelled", //invite cancelled
    inviteResult = "inviteResult", //result of the invite, the other participant could reject it

    reject = "reject", //the receiver rejects
    accept = "accept", //participant requests to join the conference room
    leave = "leave", //participant signals to leave the room
    conferenceReady = "conferenceReady",

    getContacts = "getContacts",
    getContactsResults = "getContactsResults",

}
export enum WebRoutes {
    authenticate = "authenticate",
    onRoomClosed = "onRoomClosed",
    onPeerJoined = "onPeerJoined",
    onPeerLeft = "onPeerLeft"
}

export class AuthenticateMsg {
    type: CallMessageType.authenticate
    data: {
        username: string,
        password: string
    } = { username: "", password: "" }
}

export class AuthenticateResultMsg {
    type: CallMessageType.authenticateResult;
    data: {
        authToken?: string,
        error?: string
    } = {}
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
        error?: string
    } = {
            userName: "",
            authToken: "",
            participantId: "",
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
        conferenceRoomId?: string,
        participantId?: string,
        displayName?: string,
    } = {
        }
}

export class InviteCancelledMsg {
    type = CallMessageType.inviteCancelled;
    data: {
        conferenceRoomId?: string,
        participantId?: string
    } = {
        }
}

export class InviteResultMsg {
    type = CallMessageType.inviteResult;
    data: {
        conferenceRoomId?: string,
        participantId?: string,
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
        error?: string
    } = {
        }
}

export class AcceptResultMsg {
    type = CallMessageType.accept;
    data: {
        conferenceRoomId?: string,
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

export class ConferenceReadyMsg {
    type = CallMessageType.conferenceReady;
    data = {
        conferenceRoomId: "",
        authToken: "",
        roomId: "",
        roomToken: "",
        roomURI: ""
    }
}