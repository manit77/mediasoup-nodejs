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
    roomTimeoutSecs: number = 0;
    conferenceCode: string = "";
    usersMax = 99;
    usersRequireConferenceCode: boolean = false;
    guestsMax: number = 99;
    guestsAllowed = true;
    guestsAllowMic: boolean = true;
    guestsAllowCamera: boolean = true;
    guestsRequireConferenceCode: boolean = false;
    isRecorded = false;
    isPrivate = false;
}

export class ConferenceScheduledInfo {
    conferenceId: string = "";
    externalId: string = "";
    name: string = "";
    description: string = "";   
    config: ConferenceRoomConfig = new ConferenceRoomConfig();
}

export class ConferenceRoomJoinConfig {
    micEnabled: boolean;
    cameraEnabled: boolean;
}

export class GetUserMediaConfig {
    /**
     * muted or unumuted
     */
    isAudioEnabled: boolean = false;
    /**
     * muted or unumuted
     */
    isVideoEnabled: boolean = false;

    // getVideo: boolean = false;
    // getAudio: boolean = false;
    constraints: MediaStreamConstraints;
}