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
    getConferenceScheduled = "/getConferenceScheduled",
    onRoomClosed = "/onRoomClosed",
    onPeerJoined = "/onPeerJoined",
    onPeerLeft = "/onPeerLeft"
}

export type conferenceType = "p2p" | "room";
export enum ParticipantRole {
    "admin" = "admin",
    "monitor" = "monitor",
    "user" = "user",
    "guest" = "guest"
}

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
        error?: string,
        clientData?: string,
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
        displayName: "",
        authToken: "",
        participantId: ""
    }
}

export class RegisterResultMsg {
    type = CallMessageType.registerResult;
    data: {
        username?: string,        
        participantId?: string,
        role?: ParticipantRole | string,
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

export class GetConferenceScheduledResultMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conference?: ConferenceScheduledInfo,
        error?: string,
    } = {}
}

export class GetConferencesScheduledResultMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conferences?: ConferenceScheduledInfo[],
        error?: string,
    } = {}
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
        conferenceExternalId?: string,
        conferenceRoomConfig?: ConferenceRoomConfig,
        roomName?: string,
        /**
         * a user trying to create a conference room with a externalId
         * the conference config requires a conference code
         * the user must pass a conference code to start it
         */
        conferenceCode?: string,
        error?: string
    } = {
        }
}

export class CreateConfResultMsg {
    type = CallMessageType.createConfResult;
    data: {
        conferenceId?: string,
        externalId?: string,
        roomName?: string,
        error?: string
    } = {
        }
}

export class JoinConfMsg {
    type = CallMessageType.joinConf;
    data: {
        conferenceId?: string,
        conferenceCode?: string,
        externalId?: string,
        error?: string
    } = {
        }
}

export class JoinConfResultMsg {
    type = CallMessageType.joinConfResult;
    data: {
        conferenceId?: string,
        error?: string
    } = {
        }
}

export class InviteMsg {
    type = CallMessageType.invite;
    data: {
        participantId?: string,
        displayName?: string,
        conferenceId?: string,
        conferenceName?: string,
        conferenceExternalId?: string,
        conferenceType?: conferenceType,
    } = {
        }
}

export class InviteCancelledMsg {
    type = CallMessageType.inviteCancelled;
    data: {
        conferenceId?: string,
        participantId?: string
    } = {
        }
}

export class InviteResultMsg {
    type = CallMessageType.inviteResult;
    data: {
        participantId?: string,
        displayName?: string,
        conferenceId?: string,
        conferenceName?: string,
        conferenceExternalId?: string,
        conferenceType?: conferenceType,
        error?: string
    } = {
        }
}

export class RejectMsg {
    type = CallMessageType.reject;
    data: {
        conferenceId?: string,
        fromParticipantId?: string,
        toParticipantId?: string,
    } = {
        }
}

export class AcceptMsg {
    type = CallMessageType.accept;
    data: {
        conferenceId?: string,
        error?: string
    } = {
        }
}

export class AcceptResultMsg {
    type = CallMessageType.acceptResult;
    data: {
        conferenceId?: string,
        error?: string
    } = {
        }
}

export class LeaveMsg {
    type = CallMessageType.leave;
    data = {
        conferenceId: "",
        participantId: ""
    }
}

export class ConferenceReadyMsg {
    type = CallMessageType.conferenceReady;
    data: {
        participantId?: string,
        displayName?: string,
        
        conferenceId?: string,
        conferenceName?: string,
        conferenceExternalId?: string,
        conferenceType?: conferenceType,
        conferenceRoomConfig?: ConferenceRoomConfig,

        roomAuthToken?: string,
        roomId?: string,
        roomToken?: string,
        roomURI?: string,
        roomRtpCapabilities?: any,
    } = {}
}

export class ConferenceClosedMsg {
    type = CallMessageType.conferenceClosed;
    data: {
        conferenceId?: string,
        reason?: string
    } = {}
}

export interface CreateConferenceParams {
    conferenceId: string,
    conferenceCode: string,
    roomName: string,
    externalId: string,    
    config: ConferenceRoomConfig,
}

export interface JoinConferenceParams {
    conferenceId: string,
    conferenceCode: string,
    roomName: string,
    externalId: string,
    //audioEnabledOnStart: boolean,
    //videoEnabledOnStart: boolean,
    clientData: {},
}

export class ConferenceRoomConfig {
    roomTimeoutSecs: number = 60 * 60;
    conferenceCode: string = "";
    requireConferenceCode: boolean = false;
    usersMax = 99;
    guestsMax: number = 99;
    guestsAllowed = true;
    guestsAllowMic: boolean = true;
    guestsAllowCamera: boolean = true;
}

export class ConferenceRoomInfo {
    conferenceId: string = "";
    externalId: string = "";
    roomId: string = "";    
    roomName: string = "";
    roomStatus: string = "";
    participantCount = 0;
}

export class ConferenceScheduledInfo {
    externalId: string = "";
    name: string = "";
    description: string = "";
    config: ConferenceRoomConfig = new ConferenceRoomConfig();
}

export class ConferenceRoomJoinConfig {
    micEnabled: boolean;
    cameraEnabled: boolean;
}