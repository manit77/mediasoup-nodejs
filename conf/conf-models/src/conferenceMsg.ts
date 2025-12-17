import { ClientConfig, ConferenceConfig, ConferenceScheduledInfo, conferenceType, ParticipantInfo, ParticipantRole } from "./conferenceModels.js";

export const CallMessageType = {

    login: "login",
    loginGuest: "loginGuest",
    loginResult: "loginResult",

    loggedOff: "loggedOff",
    unauthorized: "unauthorized",
    //notRegistered : "notRegistered",

    register: "register",//register the partcipant as online
    registerResult: "registerResult", //partcipant recieves a registration result

    createConf: "createConf",
    createConfResult: "createConfResult",
    joinConf: "joinConf",
    joinConfResult: "joinConfResult",
    terminateConf: "terminateConf",

    invite: "invite", //invite to join room
    inviteCancelled: "inviteCancelled", //invite cancelled
    inviteResult: "inviteResult", //result of the invite, the other participant could reject it

    reject: "reject", //the receiver rejects
    accept: "accept", //participant requests to join the conference room
    acceptResult: "acceptResult",
    leave: "leave", //participant signals to leave the room
    conferenceReady: "conferenceReady",
    conferenceClosed: "conferenceClosed",
    conferencePong: "conferencePong",

    getParticipants: "getParticipants",
    getParticipantsResult: "getParticipantsResult",
    getConferences: "getConferences",
    getConferencesResult: "getConferencesResult",

    particpantNewTrack: "particpantNewTrack",
    presenterInfo: "presenterInfo",

    joinLobby: "joinLobby",
    leaveLobby: "leaveLobby",

    getClientConfigResult: "getClientConfigResult",

}

export interface IMsg {
    type: string;
    error?: string;
    data?: {};
}

export class BaseMsg implements IMsg {
    type: string;
    error?: string;
    data?: {};
}

export function isMsgErorr(msg: IMsg) {
    //if msg is null
    if (!msg) {
        return true;
    }

    //if msg contains an error
    if (msg.error) {
        return true;
    }

    //msg must contain a type
    if(!msg.type) {
        return true;
    }

    return false;
}

export function getMsgErorr(msg: IMsg) {
    if (msg?.error) {
        return msg.error;
    }
    if (!msg) {
        return "unknown";
    }

    if(!msg.type) {
        return "invalid msg type";
    }

    return "";
}

export class LoginGuestMsg extends BaseMsg {
    type = CallMessageType.loginGuest;
    data?: {
        username?: string,
        password?: string,
        clientData?: {}
    } = {};
}

export class LoginMsg extends BaseMsg {
    type = CallMessageType.login;
    data?: {
        username?: string,
        password?: string,
        authToken?: string,
        clientData?: {}
    } = {};
}

export class LoginResultMsg extends BaseMsg {
    type = CallMessageType.loginResult
    data?: {
        participantGroup?: string,
        participantGroupName?: string,
        conferenceGroup?: string,
        username?: string,
        displayName?: string,
        authToken?: string,
        role?: string,
        clientData?: {},
    } = {};
}

export class LoggedOffMsg extends BaseMsg {
    type = CallMessageType.loggedOff;
    data?: {
        reason?: string
    } = {};
}

export class RegisterMsg extends BaseMsg {
    type = CallMessageType.register;
    data?: {
        username?: string,
        displayName?: string,
        authToken?: string,
        participantId?: string,
        participantGroup?: string, //groups users together
        conferenceGroup?: string, //groups users to conferences
        clientData?: {}
    } = {};
}

export class RegisterResultMsg extends BaseMsg {
    type = CallMessageType.registerResult;
    data?: {
        username?: string,
        participantId?: string,
        role?: ParticipantRole | string,

    } = {};
}

export class GetParticipantsMsg extends BaseMsg {
    type = CallMessageType.getParticipants;
    data?: {} = {};
}

export class GetParticipantsResultMsg extends BaseMsg {
    type = CallMessageType.getParticipantsResult;
    data?: {
        participants?: ParticipantInfo[],

    } = { participants: [] };
}

export class GetConferencesMsg extends BaseMsg {
    type = CallMessageType.getConferences;
    data? = {};
}

export class GetConferenceScheduledResultMsg extends BaseMsg {
    type = CallMessageType.getConferencesResult;
    data?: {
        conference?: ConferenceScheduledInfo,
    } = {};
}

export class GetConferencesScheduledResultMsg extends BaseMsg {
    type = CallMessageType.getConferencesResult;
    data?: {
        conferences?: ConferenceScheduledInfo[],
    } = {};
}

export class GetConferencesResultMsg extends BaseMsg {
    type = CallMessageType.getConferencesResult;
    data?: {
        conferences: ConferenceScheduledInfo[],
    } = { conferences: [] };
}

export class CreateConfMsg extends BaseMsg {
    type = CallMessageType.createConf;
    data?: {
        conferenceExternalId?: string,
        roomName?: string,
        conferenceCode?: string,
        conferenceConfig?: ConferenceConfig,
    } = {
            conferenceExternalId: "",
            roomName: "",
            conferenceCode: "",
            conferenceConfig: new ConferenceConfig(),
        };
}

export class CreateConfResultMsg extends BaseMsg {
    type = CallMessageType.createConfResult;
    data?: {
        conferenceId?: string,
        externalId?: string,
        roomName?: string,
    } = {};
}

export class JoinConfMsg extends BaseMsg {
    type = CallMessageType.joinConf;
    data?: {
        conferenceId?: string,
        conferenceCode?: string,
        externalId?: string
    } = {
            conferenceId: "",
            conferenceCode: "",
            externalId: ""
        }
}

export class JoinConfResultMsg extends BaseMsg {
    type = CallMessageType.joinConfResult;
    data?: {
        conferenceId?: string,
        leaderId?: string,
        presenterId?: string,
    } = {};
}

export class InviteMsg extends BaseMsg {
    type = CallMessageType.invite;
    data?: {
        participantId?: string,
        displayName?: string,
        conferenceId?: string,
        conferenceName?: string,
        conferenceExternalId?: string,
        conferenceType?: conferenceType,
        withAudio? : boolean,
        withVideo?: boolean
    } = {};
}

export class InviteCancelledMsg extends BaseMsg {
    type = CallMessageType.inviteCancelled;
    data?: {
        conferenceId?: string,
        participantId?: string
    } = {};
}

export class InviteResultMsg extends BaseMsg {
    type = CallMessageType.inviteResult;
    data?: {
        participantId?: string,
        displayName?: string,
        conferenceId?: string,
        conferenceName?: string,
        conferenceExternalId?: string,
        conferenceType?: conferenceType,

    } = {};
}

export class RejectMsg extends BaseMsg {
    type = CallMessageType.reject;
    data?: {
        conferenceId?: string,
        fromParticipantId?: string,
        toParticipantId?: string,
    } = {};
}

export class AcceptMsg extends BaseMsg {
    type = CallMessageType.accept;
    data?: {
        conferenceId?: string,

    } = {};
}

export class AcceptResultMsg extends BaseMsg {
    type = CallMessageType.acceptResult;
    data?: {
        conferenceId?: string,

    } = {};
}

export class LeaveMsg extends BaseMsg {
    type = CallMessageType.leave;
    data?: {
        conferenceId?: string,
        participantId?: string
    } = {};
}

export class ConferenceReadyMsg extends BaseMsg {
    type = CallMessageType.conferenceReady;
    data?: {
        participantId?: string,
        displayName?: string,
        leaderId?: string,
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

export class ConferenceClosedMsg extends BaseMsg {
    type = CallMessageType.conferenceClosed;
    data?: {
        conferenceId?: string,
        reason?: string
    } = {};
}

export class ConferencePongMsg extends BaseMsg {
    type = CallMessageType.conferencePong;
    data?: {
        conferenceId?: string,
    } = {};
}

export class PresenterInfoMsg extends BaseMsg {
    type = CallMessageType.presenterInfo;
    data?: {
        participantId?: string,
        status?: "on" | "off"
    } = {};
}

export class JoinLobbyMsg extends BaseMsg {
    type = CallMessageType.joinLobby;
    data?: {
        participantId?: string,
        conferenceExternalId?: string,
        conferenceId?: string
    } = {};
}

export class LeaveLobbyMsg extends BaseMsg {
    type = CallMessageType.leaveLobby;
    data?: {
        participantId?: string,
        conferenceExternalId?: string,
        conferenceId?: string
    } = {};
}

export class GetClientConfigResultMsg extends BaseMsg {
    type = CallMessageType.getClientConfigResult;
    data?: {
        participantGroupName?: string,
        participantGroup?: string,
        conferenceGroup?: string,
        config?: ClientConfig,
    } = {};
}

// export class NotRegisteredMsg extends BaseMsg {
//     type = CallMessageType.notRegistered;
//     data?: {
//         
//     } = {};
// }


export class UnauthorizedMsg extends BaseMsg {
    type = CallMessageType.unauthorized;
}


export class TerminateConfMsg extends BaseMsg {
    type = CallMessageType.terminateConf;
    data?: {
        conferenceId?: string
    } = {};
}

