export var ConferenceType;
(function (ConferenceType) {
    ConferenceType["p2p"] = "p2p";
    ConferenceType["rooms"] = "rooms";
})(ConferenceType || (ConferenceType = {}));
export var CallMessageType;
(function (CallMessageType) {
    CallMessageType["login"] = "login";
    CallMessageType["register"] = "register";
    CallMessageType["registerResult"] = "registerResult";
    CallMessageType["newConference"] = "newConference";
    CallMessageType["newConferenceResult"] = "newConferenceResult";
    CallMessageType["invite"] = "invite";
    CallMessageType["inviteResult"] = "inviteResult";
    CallMessageType["reject"] = "reject";
    CallMessageType["join"] = "join";
    CallMessageType["joinResult"] = "joinResult";
    CallMessageType["leave"] = "leave";
    CallMessageType["newParticipant"] = "newParticipant";
    CallMessageType["participantLeft"] = "participantLeft";
    CallMessageType["conferenceClosed"] = "conferenceClosed";
    CallMessageType["closeConference"] = "closeConference";
    CallMessageType["getContacts"] = "getContacts";
    CallMessageType["reconnect"] = "reconnect";
    CallMessageType["reconnectResult"] = "reconnectResult";
    CallMessageType["participantReconnected"] = "participantReconnected";
    CallMessageType["rtc_needOffer"] = "rtc_needOffer";
    CallMessageType["rtc_offer"] = "rtc_offer";
    CallMessageType["rtc_answer"] = "rtc_answer";
    CallMessageType["rtc_ice"] = "rtc_ice";
})(CallMessageType || (CallMessageType = {}));
export class ConferenceConfig {
    dateStart = new Date();
    dateEnd = undefined;
    maxParticipants = 2;
    allowConferenceVideo = true;
    allowConferenceAudio = true;
    allowParticipantVideo = true;
    allowParticpantAudio = true;
    inviteOnly = false; //anyone can join or by invite only
    type = ConferenceType.p2p; //p2p is using p2p webrtc calls, room is using sfu conferencing
    /**
     * room will terminate when there are not participants for this duration
     */
    timeOutNoParticipantsSecs = 30000;
    /**
     * maxDuration for the room
     */
    timeOutMaxDurationSecs = 3600000;
    /**
     username of the leader, if no match then all are participants
      */
    leaderUserName = "";
    /**
     * if the leader exits close the room
     */
    closeConferenceOnLeaderExit = false;
    expiresIn = 0;
}
// Message sent by client to attempt reconnection
export class ReconnectMsg {
    type = CallMessageType.reconnect;
    data = {
        participantId: ""
    };
}
// Server response to reconnection attempt
export class ReconnectResultMsg {
    type = CallMessageType.reconnectResult;
    data = {
        conferenceRoomId: "",
        participants: []
    };
}
// Broadcast to other participants when someone reconnects
export class ParticipantReconnectedMsg {
    type = CallMessageType.participantReconnected;
    data = {
        participantId: "",
        conferenceRoomId: ""
    };
}
export class RegisterMsg {
    type = CallMessageType.register;
    data = {
        userName: "",
        authToken: "",
        participantId: ""
    };
}
export class RegisterResultMsg {
    type = CallMessageType.registerResult;
    data = {
        userName: "",
        authToken: "",
        participantId: "",
        conferenceRoomId: ""
    };
}
export class NewConferenceMsg {
    type = CallMessageType.newConference;
    data = {
        conferenceTitle: "",
        conferenceConfig: new ConferenceConfig()
    };
}
export class NewConferenceResultMsg {
    type = CallMessageType.newConferenceResult;
    data = {
        conferenceRoomId: "",
        conferenceToken: "",
        roomId: "",
        roomToken: "",
        error: ""
    };
}
export class ConferenceLeaveMsg {
    type = CallMessageType.participantLeft;
    data = {
        conferenceRoomId: "",
        participantId: ""
    };
}
export class GetContactsMsg {
    type = CallMessageType.getContacts;
    data = [];
}
export class InviteMsg {
    type = CallMessageType.invite;
    data = {
        conferenceConfig: new ConferenceConfig()
    };
}
export class InviteResultMsg {
    type = CallMessageType.inviteResult;
    data = {
        conferenceConfig: new ConferenceConfig()
    };
}
export class RejectMsg {
    type = CallMessageType.reject;
    data = {};
}
export class JoinMsg {
    type = CallMessageType.join;
    data = {};
}
export class JoinResultMsg {
    type = CallMessageType.joinResult;
    data = {
        participants: []
    };
}
export class RTCNeedOfferMsg {
    type = CallMessageType.rtc_needOffer;
    data = {
        participantId: "",
        displayName: "",
        conferenceRoomId: ""
    };
}
export class LeaveMsg {
    type = CallMessageType.leave;
    data = {
        conferenceRoomId: "",
        participantId: ""
    };
}
export class NewParticipantMsg {
    type = CallMessageType.newParticipant;
    data = {
        conferenceRoomId: "",
        participantId: "",
        displayName: ""
    };
}
// Add the temporary flag to the ParticipantLeftMsg
// This lets clients know if a participant just dropped or intentionally left
export class ParticipantLeftMsg {
    type = CallMessageType.participantLeft;
    data = {
        participantId: "",
        conferenceRoomId: ""
    };
}
export class ConferenceClosedMsg {
    type = CallMessageType.conferenceClosed;
    data = {
        conferenceRoomId: ""
    };
}
export class CloseConference {
    type = CallMessageType.conferenceClosed;
    data = {
        conferenceRoomId: ""
    };
}
