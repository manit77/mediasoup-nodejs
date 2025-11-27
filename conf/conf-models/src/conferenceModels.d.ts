export declare enum WebRoutes {
    login = "/login",
    loginGuest = "/loginGuest",
    getClientConfig = "/getClientConfig",
    authenticate = "/authenticate",
    getConferencesScheduled = "/getConferencesScheduled",
    getConferenceScheduled = "/getConferenceScheduled",
    onRoomClosed = "/onRoomClosed",
    onPeerJoined = "/onPeerJoined",
    onPeerLeft = "/onPeerLeft",
    getParticipantsOnline = "/getParticipantsOnline"
}
export type conferenceType = "p2p" | "room";
export type conferenceLayout = "pip" | "nopresenter" | "presenter" | "auto";
export declare enum ParticipantRole {
    "admin" = "admin",
    "monitor" = "monitor",
    "user" = "user",
    "guest" = "guest"
}
export interface ParticipantInfo {
    participantId: string;
    displayName: string;
    status: "online" | "offline" | "reconnecting" | "busy";
}
export interface CreateConferenceParams {
    conferenceId: string;
    conferenceCode: string;
    roomName: string;
    externalId: string;
    config: ConferenceConfig;
}
export interface JoinConferenceParams {
    conferenceId: string;
    conferenceCode: string;
    roomName: string;
    externalId: string;
    joinMediaConfig: GetUserMediaConfig;
    clientData: {};
}
export declare class ConferenceConfig {
    roomTimeoutSecs: number;
    conferenceCode: string;
    conferenceGroup: string;
    usersMax: number;
    usersRequireConferenceCode: boolean;
    guestsMax: number;
    guestsAllowed: boolean;
    guestsAllowMic: boolean;
    guestsAllowCamera: boolean;
    guestsAllowScreenShare: boolean;
    guestsRequireConferenceCode: boolean;
    guestsAllowDeviceControls: boolean;
    guestsRequireMic: boolean;
    guestsRequireCamera: boolean;
    isRecordable: boolean;
    isRecorded: boolean;
    isPrivate: boolean;
    leaderTrackingId: string;
    layout: conferenceLayout;
}
export declare class ConferenceScheduledInfo {
    conferenceId: string;
    externalId: string;
    name: string;
    description: string;
    config: ConferenceConfig;
}
export declare class ConferenceRoomJoinConfig {
    micEnabled: boolean;
    cameraEnabled: boolean;
}
export declare class GetUserMediaConfig {
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    constraints: MediaStreamConstraints;
}
export declare class TestObject {
    hello(): void;
}
export declare class ClientConfig {
    guest_login_require_password: boolean;
    guest_login_require_participant_group: boolean;
    guest_login_require_conference_group: boolean;
    guest_login_generate_username: boolean;
    user_login_require_participant_group: boolean;
    user_login_require_conference_group: boolean;
}
