export enum CallMessageType {

    login = "login",
    loginGuest = "loginGuest",
    loginResult = "loginResult",   

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
    acceptResult = "acceptResult",
    leave = "leave", //participant signals to leave the room
    conferenceReady = "conferenceReady",
    conferenceClosed = "conferenceClosed",

    getParticipants = "getParticipants",
    getParticipantsResult = "getParticipantsResult",
    getConferences = "getConferences",
    getConferencesResult = "getConferencesResult",


}
export enum WebRoutes {
    login = "/login",
    loginGuest = "/loginGuest",
    authenticate = "/authenticate",
    getConferencesScheduled = "/getConferencesScheduled",
    onRoomClosed = "/onRoomClosed",
    onPeerJoined = "/onPeerJoined",
    onPeerLeft = "/onPeerLeft"
}

export type conferenceType = "p2p" | "room";
export type ParticipantRole = "admin" | "user" | "guest";

export class LoginGuestMsg {
    type = CallMessageType.loginGuest;
    data: {
        displayName?: string,
        clientData?: {}
    } = {}
}

export class LoginMsg {
    type = CallMessageType.login;
    data: {
        username?: string,
        password?: string,
        authToken?: string,
        clientData?: {}
    } = {}
}

export class LoginResultMsg {
    type = CallMessageType.loginResult
    data: {
        username?: string,
        displayName?: string,
        authToken?: string,
        role?: string,
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
        username: "",
        authToken: "",
        participantId: ""
    }
}

export class RegisterResultMsg {
    type = CallMessageType.registerResult;
    data: {
        username?: string,
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

export class GetConferencesScheduledResultMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        scheduled: ConferenceScheduledInfo[],
        error?: string,
    } = { scheduled: [] }
}

export class GetConferencesResultMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conferences: ConferenceRoomInfo[],
        error?: string,
    } = { conferences: [] }
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
        conferenceCode?: string,
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
        participantId?: string,
        displayName?: string,
        conferenceRoomId?: string,
        conferenceRoomName?: string,
        conferenceRoomTrackingId?: string,
        conferenceType?: conferenceType,
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
        participantId?: string,
        displayName?: string,
        conferenceRoomId?: string,
        conferenceRoomName?: string,
        conferenceRoomTrackingId?: string,
        conferenceType?: conferenceType,
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
    type = CallMessageType.acceptResult;
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
    data: {
        participantId?: string,
        displayName?: string,
        conferenceRoomId?: string,
        conferenceRoomName?: string,
        conferenceRoomTrackingId?: string,
        conferenceType?: conferenceType,
        conferenceRoomConfig?: ConferenceRoomConfig,
        authToken?: string,
        roomId?: string,
        roomToken?: string,
        roomURI?: string,
        roomRtpCapabilities?: any,
    } = {}
}

export class ConferenceClosedMsg {
    type = CallMessageType.conferenceClosed;
    data: {
        conferenceRoomId?: string,
        reason?: string
    } = {}
}

export class ConferenceRoomConfig {
    roomTimeoutSecs: number = 60 * 60;
    conferenceCode: string;

    usersMax = 99;
    guestsMax: number = 99;
    guestsAllowed = true;
    guestsAllowMic: boolean = true;
    guestsAllowCamera: boolean = true;
    
}

export class ConferenceRoomInfo {
    conferenceRoomId: string = "";
    roomTrackingId: string = "";
    roomName: string = "";
    roomStatus: string = "";
    participantCount = 0;
}

export class ConferenceScheduledInfo {
    id: string = "";
    name: string = "";
    description: string = "";
    config: ConferenceRoomConfig = new ConferenceRoomConfig();
}

