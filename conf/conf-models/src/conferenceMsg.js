import { ConferenceConfig } from "./conferenceModels.js";
export const CallMessageType = {
    login: "login",
    loginGuest: "loginGuest",
    loginResult: "loginResult",
    loggedOff: "loggedOff",
    unauthorized: "unauthorized",
    //notRegistered : "notRegistered",
    register: "register", //register the partcipant as online
    registerResult: "registerResult", //partcipant recieves a registration result
    createConf: "createConf",
    createConfResult: "createConfResult",
    joinConf: "joinConf",
    joinConfResult: "joinConfResult",
    terminateConf: "terminateConf",
    invite: "invite", //invite to join room
    inviteCancelled: "inviteCancelled", //invite cancelled
    inviteResult: "inviteResult", //result of the invite, the other participant could reject it
    reject: "reject", //the receiver rejects
    accept: "accept", //participant requests to join the conference room
    acceptResult: "acceptResult",
    leave: "leave", //participant signals to leave the room
    conferenceReady: "conferenceReady",
    conferenceClosed: "conferenceClosed",
    conferencePong: "conferencePong",
    getParticipants: "getParticipants",
    getParticipantsResult: "getParticipantsResult",
    getConferences: "getConferences",
    getConferencesResult: "getConferencesResult",
    particpantNewTrack: "particpantNewTrack",
    presenterInfo: "presenterInfo",
    joinLobby: "joinLobby",
    leaveLobby: "leaveLobby",
    getClientConfigResult: "getClientConfigResult",
};
export class BaseMsg {
    type;
    error;
    data;
}
export function isMsgErorr(msg) {
    if (!msg) {
        return true;
    }
    if (msg.error) {
        return true;
    }
}
export class LoginGuestMsg extends BaseMsg {
    type = CallMessageType.loginGuest;
    data = {};
}
export class LoginMsg extends BaseMsg {
    type = CallMessageType.login;
    data = {};
}
export class LoginResultMsg extends BaseMsg {
    type = CallMessageType.loginResult;
    data = {};
}
export class LoggedOffMsg extends BaseMsg {
    type = CallMessageType.loggedOff;
    data = {};
}
export class RegisterMsg extends BaseMsg {
    type = CallMessageType.register;
    data = {};
}
export class RegisterResultMsg extends BaseMsg {
    type = CallMessageType.registerResult;
    data = {};
}
export class GetParticipantsMsg extends BaseMsg {
    type = CallMessageType.getParticipants;
    data = {};
}
export class GetParticipantsResultMsg extends BaseMsg {
    type = CallMessageType.getParticipantsResult;
    data = { participants: [] };
}
export class GetConferencesMsg extends BaseMsg {
    type = CallMessageType.getConferences;
    data = {};
}
export class GetConferenceScheduledResultMsg extends BaseMsg {
    type = CallMessageType.getConferencesResult;
    data = {};
}
export class GetConferencesScheduledResultMsg extends BaseMsg {
    type = CallMessageType.getConferencesResult;
    data = {};
}
export class GetConferencesResultMsg extends BaseMsg {
    type = CallMessageType.getConferencesResult;
    data = { conferences: [] };
}
export class CreateConfMsg extends BaseMsg {
    type = CallMessageType.createConf;
    data = {
        conferenceConfig: new ConferenceConfig(),
    };
}
export class CreateConfResultMsg extends BaseMsg {
    type = CallMessageType.createConfResult;
    data = {};
}
export class JoinConfMsg extends BaseMsg {
    type = CallMessageType.joinConf;
    data = {};
}
export class JoinConfResultMsg extends BaseMsg {
    type = CallMessageType.joinConfResult;
    data = {};
}
export class InviteMsg extends BaseMsg {
    type = CallMessageType.invite;
    data = {};
}
export class InviteCancelledMsg extends BaseMsg {
    type = CallMessageType.inviteCancelled;
    data = {};
}
export class InviteResultMsg extends BaseMsg {
    type = CallMessageType.inviteResult;
    data = {};
}
export class RejectMsg extends BaseMsg {
    type = CallMessageType.reject;
    data = {};
}
export class AcceptMsg extends BaseMsg {
    type = CallMessageType.accept;
    data = {};
}
export class AcceptResultMsg extends BaseMsg {
    type = CallMessageType.acceptResult;
    data = {};
}
export class LeaveMsg extends BaseMsg {
    type = CallMessageType.leave;
    data = {};
}
export class ConferenceReadyMsg extends BaseMsg {
    type = CallMessageType.conferenceReady;
    data = {};
}
export class ConferenceClosedMsg extends BaseMsg {
    type = CallMessageType.conferenceClosed;
    data = {};
}
export class ConferencePongMsg extends BaseMsg {
    type = CallMessageType.conferencePong;
    data = {};
}
export class PresenterInfoMsg extends BaseMsg {
    type = CallMessageType.presenterInfo;
    data = {};
}
export class JoinLobbyMsg extends BaseMsg {
    type = CallMessageType.joinLobby;
    data = {};
}
export class LeaveLobbyMsg extends BaseMsg {
    type = CallMessageType.leaveLobby;
    data = {};
}
export class GetClientConfigResultMsg extends BaseMsg {
    type = CallMessageType.getClientConfigResult;
    data = {};
}
// export class NotRegisteredMsg extends BaseMsg {
//     type = CallMessageType.notRegistered;
//     data?: {
//         
//     } = {};
// }
export class UnauthorizedMsg extends BaseMsg {
    type = CallMessageType.unauthorized;
}
export class TerminateConfMsg extends BaseMsg {
    type = CallMessageType.terminateConf;
    data = {};
}
//# sourceMappingURL=conferenceMsg.js.map