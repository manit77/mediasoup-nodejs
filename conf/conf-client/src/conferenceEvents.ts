import { IMsg } from "@rooms/rooms-models";

export enum EventTypes {

    connected = "connected",
    disconnected = "disconnected",

    registerResult = "registerResult",
    loggedOff = "loggedOff",

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

    participantNewTrack = "participantNewTrack",
    participantTrackInfoUpdated = "participantTrackInfoUpdated",
    participantJoined = "participantJoined",
    participantLeft = "participantLeft",
    particpantNewTrack = "particpantNewTrack",

    prensenterInfo = "prensenterInfo"
}

export class EventParticpantNewTrackMsg implements IMsg {
    type: EventTypes.particpantNewTrack;
    data: {
        participantId?: string,
        track?: MediaStreamTrack
    } = {}
}