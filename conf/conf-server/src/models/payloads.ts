import { ParticipantRole } from "@conf/conf-models";

export interface IAuthPayload {
    username: string,
    externalId: string,
    participantGroup: string,
    conferenceGroup: string,
    role: ParticipantRole | string,
}

export interface InvitePayload { conferenceId: string, participantId: string }
