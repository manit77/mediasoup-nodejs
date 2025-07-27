import { Conference, Participant } from "./models.js";

export function getBrowserUserMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
    console.log(`getUserMedia constraints:`, constraints);
    return navigator.mediaDevices.getUserMedia(constraints);
}

export function getBrowserDisplayMedia(): Promise<MediaStream | null> {
    console.log(`getBrowserDisplayMedia`);
    return navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
    });
}

export function isVideoAllowedFor(conference: Conference, participant: Participant) {

    if (participant.role === "admin" || participant.role === "user") {
        return true;
    }

    if (participant.role === "guest" && conference.conferenceRoomConfig.guestsAllowCamera) {
        return true;
    }
}


export function isAudioAllowedFor(conference: Conference, participant: Participant) {
    if (participant.role === "admin" || participant.role === "user") {
        return true;
    }

    if (participant.role === "guest" && conference.conferenceRoomConfig.guestsAllowMic) {
        return true;
    }
}

