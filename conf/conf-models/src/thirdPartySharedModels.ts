import { ConferenceConfig } from "./conferenceModels.js";
import { IMsg } from "./conferenceMsg.js";

export enum apiMsgTypes {
    login = "login",
    loginResult = "loginResult",
    getScheduledConference = "getScheduledConference",
    getScheduledConferenceResult = "getScheduledConferenceResult",
    getScheduledConferences = "getScheduledConferences",
    getScheduledConferencesResult = "getScheduledConferencesResult",
    getParticipantsOnline = "getParticipantsOnline",
    getClientConfig = "getClientConfig",
    getClientConfigResult = "getClientConfigResult",
}

export class apiLoginPost {
    type = apiMsgTypes.login;
    data: {
        username?: string;
        password?: string;
        externalId?: string;
        clientData?: {};
    } = {}
}

export class apiLoginResult {
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
        error?: string;
    } = {}
}

export class apiGetScheduledConferencePost {
    type = apiMsgTypes.getScheduledConference;
    data: {
        id?: string;
        clientData?: {};
    } = {}
}

export class apiGetScheduledConferenceResult {
    type: apiMsgTypes.getScheduledConferenceResult;
    data: {
        conference?: apiScheduledConference;
        error?: string;
    } = {}
}

export class apiGetScheduledConferencesPost {
    type = apiMsgTypes.getScheduledConferences;
    data: {
        id?: string,
        clientData?: {};
    } = {}
}

export class apiGetScheduledConferencesResult {
    type: apiMsgTypes.getScheduledConferencesResult;
    data: {
        conferences?: apiScheduledConference[];
        error?: string;
    } = {}
}

export class apiScheduledConference {
    id: string;
    name: string;
    description: string;
    config: ConferenceConfig
}

export class apiGetParticipantsOnlinePost {
    type = apiMsgTypes.getParticipantsOnline;
    data: {
        username?: string;
        clientData?: {};
    } = {}
}

export class apiGetClientConfigPost {
    type = apiMsgTypes.getClientConfig;
    data: { clientData?: {} } = {};
}

export function createIMsg<T>(type: apiMsgTypes): T {
    return {
        type: type,
        data: {}
    } as T;
}


