"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseConference = exports.ConferenceClosedMsg = exports.ParticipantLeftMsg = exports.NewParticipantMsg = exports.LeaveMsg = exports.NeedOfferMsg = exports.JoinResultMsg = exports.JoinMsg = exports.CallResultMsg = exports.CallMsg = exports.GetContactsMsg = exports.ConferenceLeaveMsg = exports.RegisterResultMsg = exports.RegisterMsg = exports.CallMessageType = exports.CallType = void 0;
var CallType;
(function (CallType) {
    CallType["webrtc"] = "webrtc";
    CallType["rooms"] = "rooms";
})(CallType || (exports.CallType = CallType = {}));
var CallMessageType;
(function (CallMessageType) {
    CallMessageType["register"] = "register";
    CallMessageType["register_result"] = "register_result";
    CallMessageType["call"] = "call";
    CallMessageType["call_result"] = "call_result";
    CallMessageType["join"] = "join";
    CallMessageType["joinResult"] = "joinResult";
    CallMessageType["leave"] = "leave";
    CallMessageType["newParticipant"] = "newParticipant";
    CallMessageType["participantLeft"] = "participantLeft";
    CallMessageType["conferenceClosed"] = "conferenceClosed";
    CallMessageType["closeConference"] = "closeConference";
    CallMessageType["getContacts"] = "getContacts";
    CallMessageType["needOffer"] = "needOffer";
    CallMessageType["rtc_offer"] = "rtc_offer";
    CallMessageType["rtc_answer"] = "rtc_answer";
    CallMessageType["rtc_ice"] = "rtc_ice";
})(CallMessageType || (exports.CallMessageType = CallMessageType = {}));
class RegisterMsg {
    constructor() {
        this.type = CallMessageType.register;
        this.data = {
            userName: "",
            authToken: ""
        };
    }
}
exports.RegisterMsg = RegisterMsg;
class RegisterResultMsg {
    constructor() {
        this.type = CallMessageType.register_result;
        this.data = {
            userName: "",
            authToken: "",
            participantId: ""
        };
    }
}
exports.RegisterResultMsg = RegisterResultMsg;
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
class CallMsg {
    constructor() {
        this.type = CallMessageType.call;
        this.data = {
            participantId: "",
            displayName: "",
            conferenceRoomId: ""
        };
    }
}
exports.CallMsg = CallMsg;
class CallResultMsg {
    constructor() {
        this.type = CallMessageType.call_result;
        this.data = {
            conferenceRoomId: "",
            conferenceToken: "",
            error: ""
        };
    }
}
exports.CallResultMsg = CallResultMsg;
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
            conferenceRoomId: "",
            participantId: ""
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
class ParticipantLeftMsg {
    constructor() {
        this.type = CallMessageType.participantLeft;
        this.data = {
            conferenceRoomId: "",
            participantId: "",
            message: ""
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
