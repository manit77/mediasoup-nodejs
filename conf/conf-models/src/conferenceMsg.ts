import { ConferenceConfig, ConferenceScheduledInfo, conferenceType, ParticipantInfo, ParticipantRole } from "./conferenceModels.js";

export enum CallMessageType {

    login = "login",
    loginGuest = "loginGuest",
    loginResult = "loginResult",

    loggedOff = "loggedOff",
    unauthorized = "unauthorized",
    //notRegistered = "notRegistered",

    register = "register", //register the partcipant as online
    registerResult = "registerResult", //partcipant recieves a registration result

    createConf = "createConf",
    createConfResult = "createConfResult",
    joinConf = "joinConf",
    joinConfResult = "joinConfResult",
    terminateConf = "terminateConf",

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
    presenterInfo = "presenterInfo",
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
    } = {};
}

export class LoginMsg implements IMsg {
    type = CallMessageType.login;
    data: {
        username?: string,
        password?: string,
        authToken?: string,
        clientData?: {}
    } = {};
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
    } = {};
}

export class LoggedOffMsg implements IMsg {
    type = CallMessageType.loggedOff;
    data: {
        reason?: string        
    } = {};
}

export class RegisterMsg implements IMsg {
    type = CallMessageType.register;
    data: {
        username?: string,
        displayName?: string,
        authToken?: string,
        participantId?: string,
        clientData?: {}
    } = {};
}

export class RegisterResultMsg implements IMsg {
    type = CallMessageType.registerResult;
    data: {
        username?: string,
        participantId?: string,
        role?: ParticipantRole | string,
        error?: string
    } = {};
}

export class GetParticipantsMsg implements IMsg {
    type = CallMessageType.getParticipants;
    data = {};
}

export class GetParticipantsResultMsg implements IMsg {
    type = CallMessageType.getParticipantsResult;
    data: { participants: ParticipantInfo[] } = { participants: [] };
}

export class GetConferencesMsg implements IMsg {
    type = CallMessageType.getConferences;
    data = {};
}

export class GetConferenceScheduledResultMsg implements IMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conference?: ConferenceScheduledInfo,
        error?: string,
    } = {};
}

export class GetConferencesScheduledResultMsg implements IMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conferences?: ConferenceScheduledInfo[],
        error?: string,
    } = {};
}

export class GetConferencesResultMsg implements IMsg {
    type = CallMessageType.getConferencesResult;
    data: {
        conferences: ConferenceScheduledInfo[],
        error?: string,
    } = { conferences: [] };
}

export class CreateConfMsg implements IMsg {
    type = CallMessageType.createConf;
    data = {
        conferenceExternalId: "",
        conferenceConfig: new ConferenceConfig(),
        roomName: "",
        conferenceCode: "",
    }
}

export class CreateConfResultMsg implements IMsg {
    type = CallMessageType.createConfResult;
    data: {
        conferenceId?: string,
        externalId?: string,
        roomName?: string,
        error?: string
    } = {};
}

export class JoinConfMsg implements IMsg {
    type = CallMessageType.joinConf;
    data = {
        conferenceId: "",
        conferenceCode: "",
        externalId: "",
    }
}

export class JoinConfResultMsg implements IMsg {
    type = CallMessageType.joinConfResult;
    data: {
        conferenceId?: string,
        leaderId?: string,
        error?: string
    } = {};
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
    } = {};
}

export class InviteCancelledMsg implements IMsg {
    type = CallMessageType.inviteCancelled;
    data: {
        conferenceId?: string,
        participantId?: string
    } = {};
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
    } = {};
}

export class RejectMsg implements IMsg {
    type = CallMessageType.reject;
    data: {
        conferenceId?: string,
        fromParticipantId?: string,
        toParticipantId?: string,
    } = {};
}

export class AcceptMsg implements IMsg {
    type = CallMessageType.accept;
    data: {
        conferenceId?: string,
        error?: string
    } = {};
}

export class AcceptResultMsg implements IMsg {
    type = CallMessageType.acceptResult;
    data: {
        conferenceId?: string,
        error?: string
    } = {};
}

export class LeaveMsg implements IMsg {
    type = CallMessageType.leave;
    data: {
        conferenceId?: string,
        participantId?: string
    } = {};
}

export class ConferenceReadyMsg implements IMsg {
    type = CallMessageType.conferenceReady;
    data: {
        participantId?: string,
        displayName?: string,
        presenterId?: string,

        conferenceId?: string,
        conferenceName?: string,
        conferenceExternalId?: string,
        conferenceType?: conferenceType,
        conferenceConfig?: ConferenceConfig,

        roomAuthToken?: string,
        roomId?: string,
        roomToken?: string,
        roomURI?: string,
        roomRtpCapabilities?: any,
    } = {};
}

export class ConferenceClosedMsg implements IMsg {
    type = CallMessageType.conferenceClosed;
    data: {
        conferenceId?: string,
        reason?: string
    } = {};
}

export class PresenterInfoMsg implements IMsg {
    type = CallMessageType.presenterInfo;
    data: {
        participantId?: string,
        status?: "on" | "off"
    } = {};
}

// export class NotRegisteredMsg implements IMsg {
//     type = CallMessageType.notRegistered;
//     data: {
//         error?: string
//     } = {};
// }


export class UnauthorizedMsg implements IMsg {
    type = CallMessageType.unauthorized;
    data: {
        error?: string
    } = {};
}


export class TerminateConfMsg implements IMsg {
    type = CallMessageType.terminateConf;
    data: {
        conferenceId?: string,
        error?: string
    } = {};
}

