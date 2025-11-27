import { ConferenceConfig } from "./conferenceModels.js";
import { BaseMsg, IMsg } from "./conferenceMsg.js";

export const apiMsgTypes = {
    login: "login",
    loginResult: "loginResult",
    getScheduledConference: "getScheduledConference",
    getScheduledConferenceResult: "getScheduledConferenceResult",
    getScheduledConferences: "getScheduledConferences",
    getScheduledConferencesResult: "getScheduledConferencesResult",
    getParticipantsOnline: "getParticipantsOnline",
    getClientConfig: "getClientConfig",
    getClientConfigResult: "getClientConfigResult",
}

export class apiLoginPost extends BaseMsg {
    type = apiMsgTypes.login;
    data: {
        username?: string;
        password?: string;
        externalId?: string;
        clientData?: {};
    } = {}
}

export class apiLoginResult extends BaseMsg {
    type = apiMsgTypes.loginResult;
    data: {
        participantGroup?: string;
        participantGroupName?: string;
        conferenceGroup?: string;
        username?: string;
        displayName?: string;
        externalId?: string;
        role?: string;
        clientData?: {};        
    } = {}
}

export class apiGetScheduledConferencePost extends BaseMsg {
    type = apiMsgTypes.getScheduledConference;
    data: {
        id?: string;
        clientData?: {};
    } = {}
}

export class apiGetScheduledConferenceResult extends BaseMsg {
    type = apiMsgTypes.getScheduledConferenceResult;
    data: {
        conference?: apiScheduledConference;        
    } = {}
}

export class apiGetScheduledConferencesPost extends BaseMsg {
    type = apiMsgTypes.getScheduledConferences;
    data: {
        clientData?: {};
    } = {}
}

export class apiGetScheduledConferencesResult extends BaseMsg {
    type = apiMsgTypes.getScheduledConferencesResult;
    data: {
        conferences?: apiScheduledConference[];       
    } = {}
}

export class apiScheduledConference {
    id: string;
    name: string;
    description: string;
    config: ConferenceConfig
}

export class apiGetParticipantsOnlinePost extends BaseMsg {
    type = apiMsgTypes.getParticipantsOnline;
    data: {
        username?: string;
        clientData?: {};
    } = {}
}

export class apiGetClientConfigPost extends BaseMsg {
    type = apiMsgTypes.getClientConfig;
    data: { clientData?: {} } = {};
}



