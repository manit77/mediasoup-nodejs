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
    constructor() {
        this.dateStart = new Date();
        this.dateEnd = undefined;
        this.maxParticipants = 2;
        this.allowConferenceVideo = true;
        this.allowConferenceAudio = true;
        this.allowParticipantVideo = true;
        this.allowParticpantAudio = true;
        this.inviteOnly = false; //anyone can join or by invite only
        this.type = ConferenceType.p2p; //p2p is using p2p webrtc calls, room is using sfu conferencing
        /**
         * room will terminate when there are not participants for this duration
         */
        this.timeOutNoParticipantsSecs = 30000;
        /**
         * maxDuration for the room
         */
        this.timeOutMaxDurationSecs = 3600000;
        /**
         username of the leader, if no match then all are participants
          */
        this.leaderUserName = "";
        /**
         * if the leader exits close the room
         */
        this.closeConferenceOnLeaderExit = false;
        this.expiresIn = 0;
    }
}
// Message sent by client to attempt reconnection
export class ReconnectMsg {
    constructor() {
        this.type = CallMessageType.reconnect;
        this.data = {
            participantId: ""
        };
    }
}
// Server response to reconnection attempt
export class ReconnectResultMsg {
    constructor() {
        this.type = CallMessageType.reconnectResult;
        this.data = {
            conferenceRoomId: "",
            participants: []
        };
    }
}
// Broadcast to other participants when someone reconnects
export class ParticipantReconnectedMsg {
    constructor() {
        this.type = CallMessageType.participantReconnected;
        this.data = {
            participantId: "",
            conferenceRoomId: ""
        };
    }
}
export class RegisterMsg {
    constructor() {
        this.type = CallMessageType.register;
        this.data = {
            userName: "",
            authToken: "",
            participantId: ""
        };
    }
}
export class RegisterResultMsg {
    constructor() {
        this.type = CallMessageType.registerResult;
        this.data = {
            userName: "",
            authToken: "",
            participantId: "",
            conferenceRoomId: ""
        };
    }
}
export class NewConferenceMsg {
    constructor() {
        this.type = CallMessageType.newConference;
        this.data = {
            conferenceTitle: "",
            conferenceConfig: new ConferenceConfig()
        };
    }
}
export class NewConferenceResultMsg {
    constructor() {
        this.type = CallMessageType.newConferenceResult;
        this.data = {
            conferenceRoomId: "",
            conferenceToken: "",
            roomId: "",
            roomToken: "",
            error: ""
        };
    }
}
export class ConferenceLeaveMsg {
    constructor() {
        this.type = CallMessageType.participantLeft;
        this.data = {
            conferenceRoomId: "",
            participantId: ""
        };
    }
}
export class GetContactsMsg {
    constructor() {
        this.type = CallMessageType.getContacts;
        this.data = [];
    }
}
export class InviteMsg {
    constructor() {
        this.type = CallMessageType.invite;
        this.data = {
            conferenceConfig: new ConferenceConfig()
        };
    }
}
export class InviteResultMsg {
    constructor() {
        this.type = CallMessageType.inviteResult;
        this.data = {
            conferenceConfig: new ConferenceConfig()
        };
    }
}
export class RejectMsg {
    constructor() {
        this.type = CallMessageType.reject;
        this.data = {};
    }
}
export class JoinMsg {
    constructor() {
        this.type = CallMessageType.join;
        this.data = {};
    }
}
export class JoinResultMsg {
    constructor() {
        this.type = CallMessageType.joinResult;
        this.data = {
            participants: []
        };
    }
}
export class RTCNeedOfferMsg {
    constructor() {
        this.type = CallMessageType.rtc_needOffer;
        this.data = {
            participantId: "",
            displayName: "",
            conferenceRoomId: ""
        };
    }
}
export class LeaveMsg {
    constructor() {
        this.type = CallMessageType.leave;
        this.data = {
            conferenceRoomId: "",
            participantId: ""
        };
    }
}
export class NewParticipantMsg {
    constructor() {
        this.type = CallMessageType.newParticipant;
        this.data = {
            conferenceRoomId: "",
            participantId: "",
            displayName: ""
        };
    }
}
// Add the temporary flag to the ParticipantLeftMsg
// This lets clients know if a participant just dropped or intentionally left
export class ParticipantLeftMsg {
    constructor() {
        this.type = CallMessageType.participantLeft;
        this.data = {
            participantId: "",
            conferenceRoomId: ""
        };
    }
}
export class ConferenceClosedMsg {
    constructor() {
        this.type = CallMessageType.conferenceClosed;
        this.data = {
            conferenceRoomId: ""
        };
    }
}
export class CloseConference {
    constructor() {
        this.type = CallMessageType.conferenceClosed;
        this.data = {
            conferenceRoomId: ""
        };
    }
}
