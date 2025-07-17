
export enum apiMsgTypes {
    login = "login",
    loginResult = "loginResult",
    getScheduledConference = "getScheduledConference",
    getScheduledConferenceResult = "getScheduledConferenceResult",
    getScheduledConferences = "getScheduledConferences",
    getScheduledConferencesResult = "getScheduledConferencesResult",
}

export class apiLoginPost {
    type = apiMsgTypes.login;
    data: {
        username: string;
        password?: string;
        authToken?: string;
        clientData?: {};
    }
}

export class apiLoginResult {
    type = apiMsgTypes.loginResult;
    data: {
        username?: string;
        displayName?: string;
        role?: string;
        appData?: {};
        error?: string;
    }
}

export class apiGetScheduledConferencePost {
    type = apiMsgTypes.getScheduledConference;
    data: {
        id: string;
        clientData: {};
    }
}

export interface apiGetScheduledConferenceResult {
    type: apiMsgTypes.getScheduledConferenceResult;
    data: {
        conference: apiScheduledConference;
        error?: string;
    }
}

export class apiGetScheduledConferencesPost {
    type = apiMsgTypes.getScheduledConference;
    data: {
        clientData: {};
    }
}

export interface apiGetScheduledConferencesResult {
    type: apiMsgTypes.getScheduledConferencesResult;
    data: {
        conferences: apiScheduledConference[];
        error?: string;
    }
}

export class apiScheduledConference {
    d: string;
    name: string;
    description: string;
    config: { conferenceCode: string, guestsMax: number, guestsAllowed: boolean, guestsAllowMic: boolean, guestsAllowCamera: boolean }
}


