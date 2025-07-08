export enum CallMessageType {

    authenticate = "authenticate", //gets an authtoken
    authenticateResult = "authenticateResult",
    register = "register", //register the partcipant as online
    registerResult = "registerResult", //partcipant recieves a registration result

    createConf = "createConf",
    createConfResult = "createConfResult",
    joinConf = "joinConf",
    joinConfResult = "joinConfResult",

    invite = "invite", //invite to join room
    inviteCancelled = "inviteCancelled", //invite cancelled
    inviteResult = "inviteResult", //result of the invite, the other participant could reject it

    reject = "reject", //the receiver rejects
    accept = "accept", //participant requests to join the conference room
    leave = "leave", //participant signals to leave the room
    conferenceReady = "conferenceReady",

    getParticipants = "getParticipants",
    getParticipantsResult = "getParticipantsResult",
    getConferences = "getConferences",
    getConferencesResult = "getConferencesResult",


}
export enum WebRoutes {
    authenticate = "authenticate",
    onRoomClosed = "onRoomClosed",
    onPeerJoined = "onPeerJoined",
    onPeerLeft = "onPeerLeft"
}

export type ParticipantRole = "admin" | "user" | "guest";

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

export interface ParticipantInfo {
    participantId: string,
    displayName: string,
    status: "online" | "offline" | "reconnecting",
}

// export interface IParticipant {
//     participantId: string;
//     displayName: string
// }

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
        userName?: string,
        authToken?: string,
        participantId?: string,
        role?: ParticipantRole,
        error?: string
    } = {
        }
}

export class GetParticipantsMsg {
    type = CallMessageType.getParticipants;
    data = {}
}

export class GetParticipantsResultMsg {
    type = CallMessageType.getParticipantsResult;
    data: ParticipantInfo[] = [];
}

export class GetConferencesMsg {
    type = CallMessageType.getConferences;
    data = {}
}

export class GetConferencesResultMsg {
    type = CallMessageType.getConferencesResult;
    data: ConferenceRoomInfo[] = [];
}

export class CreateConfMsg {
    type = CallMessageType.createConf;
    data: {
        conferenceRoomTrackingId?: string,
        conferenceRoomConfig?: ConferenceRoomConfig,
        roomName?: string,
        error?: string
    } = {
        }
}

export class CreateConfResultMsg {
    type = CallMessageType.createConfResult;
    data: {
        conferenceRoomId?: string,
        trackingId?: string,
        roomName?: string,
        error?: string
    } = {
        }
}

export class JoinConfMsg {
    type = CallMessageType.joinConf;
    data: {
        conferenceRoomId?: string,
        trackingId?: string,
        error?: string
    } = {
        }
}

export class JoinConfResultMsg {
    type = CallMessageType.joinConfResult;
    data: {
        conferenceRoomId?: string,
        error?: string
    } = {
        }
}

export class InviteMsg {
    type = CallMessageType.invite;
    data: {
        conferenceRoomId?: string,
        participantId?: string,
        displayName?: string,
        conferenceRoomConfig?: ConferenceRoomConfig
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
        roomURI: "",
        roomRtpCapabilities: undefined,
    }
}

export class ConferenceRoomConfig {
    roomTimeoutSecs: number = 60 * 60;
    maxGuests: number = 99;
    guestAllowMic: boolean = true;
    guestAllowCamera: boolean = true;
}

export class ConferenceRoomInfo {
    conferenceRoomId: string = "";
    roomTrackingId: string = "";
    roomName: string = "";
    roomStatus: string = "";
}

