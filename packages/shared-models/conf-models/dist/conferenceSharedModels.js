export var CallMessageType;
(function (CallMessageType) {
    CallMessageType["authenticate"] = "authenticate";
    CallMessageType["authenticateResult"] = "authenticateResult";
    CallMessageType["register"] = "register";
    CallMessageType["registerResult"] = "registerResult";
    CallMessageType["invite"] = "invite";
    CallMessageType["inviteResult"] = "inviteResult";
    CallMessageType["reject"] = "reject";
    CallMessageType["accept"] = "accept";
    CallMessageType["leave"] = "leave";
    CallMessageType["conferenceReady"] = "conferenceReady";
    CallMessageType["getContacts"] = "getContacts";
    CallMessageType["getContactsResults"] = "getContactsResults";
})(CallMessageType || (CallMessageType = {}));
export var WebRoutes;
(function (WebRoutes) {
    WebRoutes["authenticate"] = "authenticate";
    WebRoutes["onRoomClosed"] = "onRoomClosed";
    WebRoutes["onPeerJoined"] = "onPeerJoined";
    WebRoutes["onPeerLeft"] = "onPeerLeft";
})(WebRoutes || (WebRoutes = {}));
export class AuthenticateMsg {
    type;
    data = { username: "", password: "" };
}
export class AuthenticateResultMsg {
    type;
    data = {};
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
export class GetContactsMsg {
    type = CallMessageType.getContacts;
    data;
}
export class GetContactsResultsMsg {
    type = CallMessageType.getContactsResults;
    data = [];
}
export class InviteMsg {
    type = CallMessageType.invite;
    data = {};
}
export class InviteResultMsg {
    type = CallMessageType.inviteResult;
    data = {};
}
export class RejectMsg {
    type = CallMessageType.reject;
    data = {};
}
export class AcceptMsg {
    type = CallMessageType.accept;
    data = {};
}
export class AcceptResultMsg {
    type = CallMessageType.accept;
    data = {};
}
export class LeaveMsg {
    type = CallMessageType.leave;
    data = {
        conferenceRoomId: "",
        participantId: ""
    };
}
export class ConferenceReadyMsg {
    type = CallMessageType.conferenceReady;
    data = {
        conferenceRoomId: "",
        authToken: "",
        roomId: "",
        roomToken: "",
        roomURI: ""
    };
}
//# sourceMappingURL=conferenceSharedModels.js.map