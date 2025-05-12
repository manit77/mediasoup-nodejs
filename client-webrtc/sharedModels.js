"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseConference = exports.ConferenceClosedMsg = exports.ParticipantLeftMsg = exports.NewParticipantMsg = exports.LeaveMsg = exports.NeedOfferMsg = exports.JoinResultMsg = exports.JoinMsg = exports.InviteResultMsg = exports.InviteMsg = exports.GetContactsMsg = exports.ConferenceLeaveMsg = exports.NewConferenceResultMsg = exports.NewConferenceMsg = exports.RegisterResultMsg = exports.RegisterMsg = exports.ParticipantReconnectedMsg = exports.ReconnectResultMsg = exports.ReconnectMsg = exports.CallMessageType = exports.CallType = void 0;
var CallType;
(function (CallType) {
    CallType["webrtc"] = "webrtc";
    CallType["rooms"] = "rooms";
})(CallType || (exports.CallType = CallType = {}));
var CallMessageType;
(function (CallMessageType) {
    CallMessageType["register"] = "register";
    CallMessageType["registerResult"] = "registerResult";
    CallMessageType["newConference"] = "newConference";
    CallMessageType["newConferenceResult"] = "newConferenceResult";
    CallMessageType["invite"] = "invite";
    CallMessageType["inviteResult"] = "inviteResult";
    CallMessageType["join"] = "join";
    CallMessageType["joinResult"] = "joinResult";
    CallMessageType["leave"] = "leave";
    CallMessageType["newParticipant"] = "newParticipant";
    CallMessageType["participantLeft"] = "participantLeft";
    CallMessageType["conferenceClosed"] = "conferenceClosed";
    CallMessageType["closeConference"] = "closeConference";
    CallMessageType["getContacts"] = "getContacts";
    CallMessageType["needOffer"] = "needOffer";
    CallMessageType["reconnect"] = "reconnect";
    CallMessageType["reconnectResult"] = "reconnectResult";
    CallMessageType["participantReconnected"] = "participantReconnected";
    CallMessageType["rtc_offer"] = "rtc_offer";
    CallMessageType["rtc_answer"] = "rtc_answer";
    CallMessageType["rtc_ice"] = "rtc_ice";
})(CallMessageType || (exports.CallMessageType = CallMessageType = {}));
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
            conferenceRoomId: "",
            error: ""
        };
    }
}
exports.RegisterResultMsg = RegisterResultMsg;
class NewConferenceMsg {
    constructor() {
        this.type = CallMessageType.newConference;
        this.data = {
            conferenceRoomId: "",
            config: {
                dateStart: new Date(),
                dateEnd: null,
                maxParticipants: 2,
                allowConferenceVideo: true,
                allowConferenceAudio: true,
                allowParticipantVideo: true,
                allowParticpantAudio: true,
                inviteOnly: false, //anyone can join or by invite only
            }
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
            participantId: "",
            displayName: "",
            conferenceRoomId: "",
            newConfConfig: null
        };
    }
}
exports.InviteMsg = InviteMsg;
class InviteResultMsg {
    constructor() {
        this.type = CallMessageType.inviteResult;
        this.data = {
            conferenceRoomId: "",
            conferenceToken: "",
            error: ""
        };
    }
}
exports.InviteResultMsg = InviteResultMsg;
class JoinMsg {
    constructor() {
        this.type = CallMessageType.join;
        this.data = {
            conferenceRoomId: "",
            error: ""
        };
    }
}
exports.JoinMsg = JoinMsg;
class JoinResultMsg {
    constructor() {
        this.type = CallMessageType.joinResult;
        this.data = {
            conferenceRoomId: "",
            participants: [],
            error: ""
        };
    }
}
exports.JoinResultMsg = JoinResultMsg;
class NeedOfferMsg {
    constructor() {
        this.type = CallMessageType.needOffer;
        this.data = {
            participantId: "",
            conferenceRoomId: ""
        };
    }
}
exports.NeedOfferMsg = NeedOfferMsg;
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
            participantId: ""
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
