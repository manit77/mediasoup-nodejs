import { ClientConfig, ConferenceConfig, ConferenceScheduledInfo, conferenceType, ParticipantInfo, ParticipantRole } from "./conferenceModels.js";
export declare const CallMessageType: {
    login: string;
    loginGuest: string;
    loginResult: string;
    loggedOff: string;
    unauthorized: string;
    register: string;
    registerResult: string;
    createConf: string;
    createConfResult: string;
    joinConf: string;
    joinConfResult: string;
    terminateConf: string;
    invite: string;
    inviteCancelled: string;
    inviteResult: string;
    reject: string;
    accept: string;
    acceptResult: string;
    leave: string;
    conferenceReady: string;
    conferenceClosed: string;
    conferencePong: string;
    getParticipants: string;
    getParticipantsResult: string;
    getConferences: string;
    getConferencesResult: string;
    particpantNewTrack: string;
    presenterInfo: string;
    joinLobby: string;
    leaveLobby: string;
    getClientConfigResult: string;
};
export interface IMsg {
    type: string;
    error?: string;
    data?: {};
}
export declare class BaseMsg implements IMsg {
    type: string;
    error?: string;
    data?: {};
}
export declare function isMsgErorr(msg: IMsg): boolean;
export declare class LoginGuestMsg extends BaseMsg {
    type: string;
    data?: {
        username?: string;
        password?: string;
        clientData?: {};
    };
}
export declare class LoginMsg extends BaseMsg {
    type: string;
    data?: {
        username?: string;
        password?: string;
        authToken?: string;
        clientData?: {};
    };
}
export declare class LoginResultMsg extends BaseMsg {
    type: string;
    data?: {
        participantGroup?: string;
        participantGroupName?: string;
        conferenceGroup?: string;
        username?: string;
        displayName?: string;
        authToken?: string;
        role?: string;
        clientData?: {};
    };
}
export declare class LoggedOffMsg extends BaseMsg {
    type: string;
    data?: {
        reason?: string;
    };
}
export declare class RegisterMsg extends BaseMsg {
    type: string;
    data?: {
        username?: string;
        displayName?: string;
        authToken?: string;
        participantId?: string;
        participantGroup?: string;
        conferenceGroup?: string;
        clientData?: {};
    };
}
export declare class RegisterResultMsg extends BaseMsg {
    type: string;
    data?: {
        username?: string;
        participantId?: string;
        role?: ParticipantRole | string;
    };
}
export declare class GetParticipantsMsg extends BaseMsg {
    type: string;
    data?: {};
}
export declare class GetParticipantsResultMsg extends BaseMsg {
    type: string;
    data?: {
        participants?: ParticipantInfo[];
    };
}
export declare class GetConferencesMsg extends BaseMsg {
    type: string;
    data?: {};
}
export declare class GetConferenceScheduledResultMsg extends BaseMsg {
    type: string;
    data?: {
        conference?: ConferenceScheduledInfo;
    };
}
export declare class GetConferencesScheduledResultMsg extends BaseMsg {
    type: string;
    data?: {
        conferences?: ConferenceScheduledInfo[];
    };
}
export declare class GetConferencesResultMsg extends BaseMsg {
    type: string;
    data?: {
        conferences: ConferenceScheduledInfo[];
    };
}
export declare class CreateConfMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceExternalId?: string;
        roomName?: string;
        conferenceCode?: string;
        conferenceConfig?: ConferenceConfig;
    };
}
export declare class CreateConfResultMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
        externalId?: string;
        roomName?: string;
    };
}
export declare class JoinConfMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
        conferenceCode?: string;
        externalId?: string;
    };
}
export declare class JoinConfResultMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
        leaderId?: string;
        presenterId?: string;
    };
}
export declare class InviteMsg extends BaseMsg {
    type: string;
    data?: {
        participantId?: string;
        displayName?: string;
        conferenceId?: string;
        conferenceName?: string;
        conferenceExternalId?: string;
        conferenceType?: conferenceType;
    };
}
export declare class InviteCancelledMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
        participantId?: string;
    };
}
export declare class InviteResultMsg extends BaseMsg {
    type: string;
    data?: {
        participantId?: string;
        displayName?: string;
        conferenceId?: string;
        conferenceName?: string;
        conferenceExternalId?: string;
        conferenceType?: conferenceType;
    };
}
export declare class RejectMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
        fromParticipantId?: string;
        toParticipantId?: string;
    };
}
export declare class AcceptMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
    };
}
export declare class AcceptResultMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
    };
}
export declare class LeaveMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
        participantId?: string;
    };
}
export declare class ConferenceReadyMsg extends BaseMsg {
    type: string;
    data?: {
        participantId?: string;
        displayName?: string;
        leaderId?: string;
        presenterId?: string;
        conferenceId?: string;
        conferenceName?: string;
        conferenceExternalId?: string;
        conferenceType?: conferenceType;
        conferenceConfig?: ConferenceConfig;
        roomAuthToken?: string;
        roomId?: string;
        roomToken?: string;
        roomURI?: string;
        roomRtpCapabilities?: any;
    };
}
export declare class ConferenceClosedMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
        reason?: string;
    };
}
export declare class ConferencePongMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
    };
}
export declare class PresenterInfoMsg extends BaseMsg {
    type: string;
    data?: {
        participantId?: string;
        status?: "on" | "off";
    };
}
export declare class JoinLobbyMsg extends BaseMsg {
    type: string;
    data?: {
        participantId?: string;
        conferenceExternalId?: string;
        conferenceId?: string;
    };
}
export declare class LeaveLobbyMsg extends BaseMsg {
    type: string;
    data?: {
        participantId?: string;
        conferenceExternalId?: string;
        conferenceId?: string;
    };
}
export declare class GetClientConfigResultMsg extends BaseMsg {
    type: string;
    data?: {
        participantGroupName?: string;
        participantGroup?: string;
        conferenceGroup?: string;
        config?: ClientConfig;
    };
}
export declare class UnauthorizedMsg extends BaseMsg {
    type: string;
}
export declare class TerminateConfMsg extends BaseMsg {
    type: string;
    data?: {
        conferenceId?: string;
    };
}
