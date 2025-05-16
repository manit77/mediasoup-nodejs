"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseConference = exports.ConferenceClosedMsg = exports.ParticipantLeftMsg = exports.NewParticipantMsg = exports.LeaveMsg = exports.RTCNeedOfferMsg = exports.JoinResultMsg = exports.JoinMsg = exports.RejectMsg = exports.InviteResultMsg = exports.InviteMsg = exports.GetContactsMsg = exports.ConferenceLeaveMsg = exports.NewConferenceResultMsg = exports.NewConferenceMsg = exports.RegisterResultMsg = exports.RegisterMsg = exports.ParticipantReconnectedMsg = exports.ReconnectResultMsg = exports.ReconnectMsg = exports.ConferenceConfig = exports.CallMessageType = exports.ConferenceType = void 0;
var ConferenceType;
(function (ConferenceType) {
    ConferenceType["p2p"] = "p2p";
    ConferenceType["rooms"] = "rooms";
})(ConferenceType || (exports.ConferenceType = ConferenceType = {}));
var CallMessageType;
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
})(CallMessageType || (exports.CallMessageType = CallMessageType = {}));
class ConferenceConfig {
    constructor() {
        this.dateStart = new Date();
        this.dateEnd = null;
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
exports.ConferenceConfig = ConferenceConfig;
// Message sent by client to attempt reconnection
class ReconnectMsg {
    constructor() {
        this.type = CallMessageType.reconnect;
        this.data = {
            participantId: ""
        };
    }
}
exports.ReconnectMsg = ReconnectMsg;
// Server response to reconnection attempt
class ReconnectResultMsg {
    constructor() {
        this.type = CallMessageType.reconnectResult;
        this.data = {
            conferenceRoomId: "",
            participants: []
        };
    }
}
exports.ReconnectResultMsg = ReconnectResultMsg;
// Broadcast to other participants when someone reconnects
class ParticipantReconnectedMsg {
    constructor() {
        this.type = CallMessageType.participantReconnected;
        this.data = {
            participantId: "",
            conferenceRoomId: ""
        };
    }
}
exports.ParticipantReconnectedMsg = ParticipantReconnectedMsg;
class RegisterMsg {
    constructor() {
        this.type = CallMessageType.register;
        this.data = {
            userName: "",
            authToken: "",
            participantId: ""
        };
    }
}
exports.RegisterMsg = RegisterMsg;
class RegisterResultMsg {
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
exports.RegisterResultMsg = RegisterResultMsg;
class NewConferenceMsg {
    constructor() {
        this.type = CallMessageType.newConference;
        this.data = {
            conferenceTitle: "",
            conferenceConfig: new ConferenceConfig()
        };
    }
}
exports.NewConferenceMsg = NewConferenceMsg;
class NewConferenceResultMsg {
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
exports.NewConferenceResultMsg = NewConferenceResultMsg;
class ConferenceLeaveMsg {
    constructor() {
        this.type = CallMessageType.participantLeft;
        this.data = {
            conferenceRoomId: "",
            participantId: ""
        };
    }
}
exports.ConferenceLeaveMsg = ConferenceLeaveMsg;
class GetContactsMsg {
    constructor() {
        this.type = CallMessageType.getContacts;
        this.data = [];
    }
}
exports.GetContactsMsg = GetContactsMsg;
class InviteMsg {
    constructor() {
        this.type = CallMessageType.invite;
        this.data = {
            conferenceConfig: new ConferenceConfig()
        };
    }
}
exports.InviteMsg = InviteMsg;
class InviteResultMsg {
    constructor() {
        this.type = CallMessageType.inviteResult;
        this.data = {
            conferenceConfig: new ConferenceConfig()
        };
    }
}
exports.InviteResultMsg = InviteResultMsg;
class RejectMsg {
    constructor() {
        this.type = CallMessageType.reject;
        this.data = {};
    }
}
exports.RejectMsg = RejectMsg;
class JoinMsg {
    constructor() {
        this.type = CallMessageType.join;
        this.data = {};
    }
}
exports.JoinMsg = JoinMsg;
class JoinResultMsg {
    constructor() {
        this.type = CallMessageType.joinResult;
        this.data = {
            participants: []
        };
    }
}
exports.JoinResultMsg = JoinResultMsg;
class RTCNeedOfferMsg {
    constructor() {
        this.type = CallMessageType.rtc_needOffer;
        this.data = {
            participantId: "",
            displayName: "",
            conferenceRoomId: ""
        };
    }
}
exports.RTCNeedOfferMsg = RTCNeedOfferMsg;
class LeaveMsg {
    constructor() {
        this.type = CallMessageType.leave;
        this.data = {
            conferenceRoomId: "",
            participantId: ""
        };
    }
}
exports.LeaveMsg = LeaveMsg;
class NewParticipantMsg {
    constructor() {
        this.type = CallMessageType.newParticipant;
        this.data = {
            conferenceRoomId: "",
            participantId: "",
            displayName: ""
        };
    }
}
exports.NewParticipantMsg = NewParticipantMsg;
// Add the temporary flag to the ParticipantLeftMsg
// This lets clients know if a participant just dropped or intentionally left
class ParticipantLeftMsg {
    constructor() {
        this.type = CallMessageType.participantLeft;
        this.data = {
            participantId: "",
            conferenceRoomId: ""
        };
    }
}
exports.ParticipantLeftMsg = ParticipantLeftMsg;
class ConferenceClosedMsg {
    constructor() {
        this.type = CallMessageType.conferenceClosed;
        this.data = {
            conferenceRoomId: ""
        };
    }
}
exports.ConferenceClosedMsg = ConferenceClosedMsg;
class CloseConference {
    constructor() {
        this.type = CallMessageType.conferenceClosed;
        this.data = {
            conferenceRoomId: ""
        };
    }
}
exports.CloseConference = CloseConference;
