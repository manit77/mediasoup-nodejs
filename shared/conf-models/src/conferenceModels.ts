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

export interface ParticipantInfo {
    participantId: string,
    displayName: string,
    status: "online" | "offline" | "reconnecting",
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
