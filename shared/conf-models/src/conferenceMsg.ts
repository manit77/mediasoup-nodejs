import { ConferenceRoomConfig, ConferenceScheduledInfo, conferenceType, ParticipantInfo, ParticipantRole } from "./conferenceModels.js";

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

    particpantNewTrack = "particpantNewTrack",
}

export interface IMsg {
    type: any;
    data: any | { error?: any };
}

export class LoginGuestMsg implements IMsg {
    type = CallMessageType.loginGuest;
    data: {
        displayName?: string,
        clientData?: {}
    } = {}
}

export class LoginMsg implements IMsg {
    type = CallMessageType.login;
    data: {
        username?: string,
        password?: string,
        authToken?: string,
        clientData?: {}
    } = {}
}

export class LoginResultMsg implements IMsg {
    type = CallMessageType.loginResult
    data: {
        username?: string,
        displayName?: string,
        authToken?: string,
        role?: string,
        error?: string,
        clientData?: {},
    } = {}
}

export class RegisterMsg implements IMsg {
    type = CallMessageType.register;
    data = {
        username: "",
        displayName: "",
        authToken: "",
        participantId: ""
    }
}

export class RegisterResultMsg implements IMsg {
    type = CallMessageType.registerResult;
    data: {
        username?: string,
        participantId?: string,
        role?: ParticipantRole | string,
        error?: string
    } = {
        }
}

export class GetParticipantsMsg implements IMsg {
    type = CallMessageType.getParticipants;
    data = {}
}

export class GetParticipantsResultMsg implements IMsg {
    type = CallMessageType.getParticipantsResult;
    data: { participants: ParticipantInfo[] } = { participants: [] };
}

export class GetConferencesMsg implements IMsg {
    type = CallMessageType.getConferences;
    data = { }
}

export class GetConferenceScheduledResultMsg implements IMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conference?: ConferenceScheduledInfo,
        error?: string,
    } = {}
}

export class GetConferencesScheduledResultMsg implements IMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conferences?: ConferenceScheduledInfo[],
        error?: string,
    } = {}
}

export class GetConferencesResultMsg implements IMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conferences: ConferenceScheduledInfo[],
        error?: string,
    } = { conferences: [] }
}

export class CreateConfMsg implements IMsg {
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

export class CreateConfResultMsg implements IMsg {
    type = CallMessageType.createConfResult;
    data: {
        conferenceId?: string,
        externalId?: string,
        roomName?: string,
        error?: string
    } = {
        }
}

export class JoinConfMsg implements IMsg {
    type = CallMessageType.joinConf;
    data: {
        conferenceId?: string,
        conferenceCode?: string,
        externalId?: string,
        error?: string
    } = {
        }
}

export class JoinConfResultMsg implements IMsg {
    type = CallMessageType.joinConfResult;
    data: {
        conferenceId?: string,
        error?: string
    } = {
        }
}

export class InviteMsg implements IMsg {
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

export class InviteCancelledMsg implements IMsg {
    type = CallMessageType.inviteCancelled;
    data: {
        conferenceId?: string,
        participantId?: string
    } = {
        }
}

export class InviteResultMsg implements IMsg {
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

export class RejectMsg implements IMsg {
    type = CallMessageType.reject;
    data: {
        conferenceId?: string,
        fromParticipantId?: string,
        toParticipantId?: string,
    } = {
        }
}

export class AcceptMsg implements IMsg {
    type = CallMessageType.accept;
    data: {
        conferenceId?: string,
        error?: string
    } = {
        }
}

export class AcceptResultMsg implements IMsg {
    type = CallMessageType.acceptResult;
    data: {
        conferenceId?: string,
        error?: string
    } = {
        }
}

export class LeaveMsg implements IMsg {
    type = CallMessageType.leave;
    data = {
        conferenceId: "",
        participantId: ""
    }
}

export class ConferenceReadyMsg implements IMsg {
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

export class ConferenceClosedMsg implements IMsg {
    type = CallMessageType.conferenceClosed;
    data: {
        conferenceId?: string,
        reason?: string
    } = {}
}