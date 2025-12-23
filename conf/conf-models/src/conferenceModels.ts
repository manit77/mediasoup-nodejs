
export enum WebRoutes {
    login = "/login",
    loginGuest = "/loginGuest",
    getClientConfig = "/getClientConfig",
    authenticate = "/authenticate",
    getConferencesScheduled = "/getConferencesScheduled",
    getConferenceScheduled = "/getConferenceScheduled",
    onRoomClosed = "/onRoomClosed",
    onPeerJoined = "/onPeerJoined",
    onPeerLeft = "/onPeerLeft",
    getParticipantsOnline = "/getParticipantsOnline",
}

export type conferenceType = "p2p" | "room";
export type conferenceLayout = "pip" | "nopresenter" | "presenter" | "auto";

export enum ParticipantRole {
    "admin" = "admin",
    "monitor" = "monitor",
    "user" = "user",
    "guest" = "guest"
}

export interface ParticipantInfo {
    participantId: string,
    displayName: string,
    status: "online" | "offline" | "reconnecting" | "busy",
}

export interface CreateConferenceParams {
    conferenceId: string,
    conferenceCode: string,
    roomName: string,
    externalId: string,
    config: ConferenceConfig,
}

export interface JoinConferenceLobbyParams {
    conferenceId: string,
    conferenceCode: string,   
    externalId: string,    
    clientData: {},
}

export interface JoinConferenceParams {
    conferenceId: string,
    conferenceCode: string,
    roomName: string,
    externalId: string,
    joinMediaConfig: GetUserMediaConfig,
    clientData: {},
}

export class ConferenceConfig {
    roomTimeoutSecs: number = 0;
    conferenceCode: string = "";
    conferenceGroup: string = "";
    usersMax = 99;
    usersRequireConferenceCode: boolean = false;
    guestsMax: number = 99;
    guestsAllowed = true;
    guestsAllowMic: boolean = true;
    guestsAllowCamera: boolean = true;
    guestsAllowScreenShare: boolean = true;
    guestsRequireConferenceCode: boolean = false;
    guestsAllowDeviceControls: boolean = true; //guests can enabled disable devices
    guestsRequireMic: boolean = false;
    guestsRequireCamera : boolean = false;
    guestsInviteOnly : boolean = false;
    isRecordable = false;
    isRecorded = false;
    isPrivate = false;
    leaderTrackingId : string = "";
    layout: conferenceLayout = "auto";
}

export class ConferenceScheduledInfo {
    conferenceId: string = "";
    externalId: string = "";
    name: string = "";
    description: string = "";   
    config: ConferenceConfig = new ConferenceConfig();
}

export class ConferenceRoomJoinConfig {
    micEnabled: boolean;
    cameraEnabled: boolean;
}

export class GetUserMediaConfig {  
    isAudioEnabled: boolean = false;   
    isVideoEnabled: boolean = false;
    constraints: MediaStreamConstraints;
}

export class TestObject {
    hello() {
        console.error("hello.")
    }
}

export class ClientConfig  {
    guest_login_require_password = false;
    guest_login_require_participant_group = false;
    guest_login_require_conference_group = false;
    guest_login_generate_username = false;
    
    user_login_require_participant_group = false;
    user_login_require_conference_group  = false;
}
