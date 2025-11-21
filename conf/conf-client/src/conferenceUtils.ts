import { Conference, Participant } from "./models.js";

export async function getBrowserUserMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream | null> {
    console.log(`getBrowserUserMedia constraints:`, constraints);
    
    try {
        return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        console.error(err);
        return null;
    }
}

export async function getBrowserDisplayMedia(): Promise<MediaStream | null> {
    console.log(`getBrowserDisplayMedia`);

    try {
        if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
            console.error(`getDisplayMedia is not available for this device.`);
            return null;
        }

        return await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });
    } catch (err) {
        console.error(err);
        return null;
    }
}

export function isVideoAllowedFor(conference: Conference, participant: Participant) {

    if (participant.role === "admin" || participant.role === "user") {
        return true;
    }

    if (participant.role === "guest" && conference.conferenceConfig.guestsAllowCamera) {
        return true;
    }
}


export function isAudioAllowedFor(conference: Conference, participant: Participant) {
    if (participant.role === "admin" || participant.role === "user") {
        return true;
    }

    if (participant.role === "guest" && conference.conferenceConfig.guestsAllowMic) {
        return true;
    }
}

