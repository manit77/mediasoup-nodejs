export var WebRoutes;
(function (WebRoutes) {
    WebRoutes["login"] = "/login";
    WebRoutes["loginGuest"] = "/loginGuest";
    WebRoutes["getClientConfig"] = "/getClientConfig";
    WebRoutes["authenticate"] = "/authenticate";
    WebRoutes["getConferencesScheduled"] = "/getConferencesScheduled";
    WebRoutes["getConferenceScheduled"] = "/getConferenceScheduled";
    WebRoutes["onRoomClosed"] = "/onRoomClosed";
    WebRoutes["onPeerJoined"] = "/onPeerJoined";
    WebRoutes["onPeerLeft"] = "/onPeerLeft";
    WebRoutes["getParticipantsOnline"] = "/getParticipantsOnline";
})(WebRoutes || (WebRoutes = {}));
export var ParticipantRole;
(function (ParticipantRole) {
    ParticipantRole["admin"] = "admin";
    ParticipantRole["monitor"] = "monitor";
    ParticipantRole["user"] = "user";
    ParticipantRole["guest"] = "guest";
})(ParticipantRole || (ParticipantRole = {}));
export class ConferenceConfig {
    roomTimeoutSecs = 0;
    conferenceCode = "";
    conferenceGroup = "";
    usersMax = 99;
    usersRequireConferenceCode = false;
    guestsMax = 99;
    guestsAllowed = true;
    guestsAllowMic = true;
    guestsAllowCamera = true;
    guestsAllowScreenShare = true;
    guestsRequireConferenceCode = false;
    guestsAllowDeviceControls = true; //guests can enabled disable devices
    guestsRequireMic = false;
    guestsRequireCamera = false;
    isRecordable = false;
    isRecorded = false;
    isPrivate = false;
    leaderTrackingId = "";
    layout = "auto";
}
export class ConferenceScheduledInfo {
    conferenceId = "";
    externalId = "";
    name = "";
    description = "";
    config = new ConferenceConfig();
}
export class ConferenceRoomJoinConfig {
    micEnabled;
    cameraEnabled;
}
export class GetUserMediaConfig {
    isAudioEnabled = false;
    isVideoEnabled = false;
    constraints;
}
export class TestObject {
    hello() {
        console.error("hello.");
    }
}
export class ClientConfig {
    guest_login_require_password = false;
    guest_login_require_participant_group = false;
    guest_login_require_conference_group = false;
    guest_login_generate_username = false;
    user_login_require_participant_group = false;
    user_login_require_conference_group = false;
}
//# sourceMappingURL=conferenceModels.js.map