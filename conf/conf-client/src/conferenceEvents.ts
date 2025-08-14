import { IMsg } from "@rooms/rooms-models";
import { Participant } from "./models.js";

export enum EventTypes {

    connected = "connected",
    disconnected = "disconnected",

    registerResult = "registerResult",
    loggedOff = "loggedOff",
    unAuthorized = "unAuthorized",
    //onNotRegistred = "onNotRegistred",

    participantsReceived = "participantsReceived",
    conferencesReceived = "conferencesReceived",

    acceptResult = "acceptResult",
    inviteResult = "inviteResult",
    inviteReceived = "inviteReceived",
    inviteCancelled = "inviteCancelled",
    rejectReceived = "rejectReceived",

    conferenceCreatedResult = "conferenceCreatedResult",
    conferenceJoined = "conferenceJoined",
    conferenceClosed = "conferenceClosed",
    conferenceFailed = "conferenceFailed",
    conferencePing = "conferencePing",

    participantNewTrack = "participantNewTrack",
    participantTrackInfoUpdated = "participantTrackInfoUpdated",
    participantJoined = "participantJoined",
    participantLeft = "participantLeft",
    particpantNewTrack = "particpantNewTrack",

    prensenterInfo = "prensenterInfo"
}


export class EventParticpantNewTrackMsg implements IMsg {
    type = EventTypes.particpantNewTrack;
    data: {
        participant?: Participant,        
        track?: MediaStreamTrack
    } = {}
}