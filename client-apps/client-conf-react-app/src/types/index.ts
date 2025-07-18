export interface User {
    username: string;
    displayName: string;
    role: "admin" | "user" | "guest" | "monitor";
    authToken: string;
}

export interface Device {
    id: string;
    label: string;
}

export class SelectedDevices {
    videoId?: string;
    videoLabel?: string;
    audioInId?: string;
    audioInLabel?: string;
    audioOutId?: string;
    audioOutLabel?: string;
    isVideoEnabled = true;
    isAudioEnabled = true;
}

export class ConferenceRoomScheduled {
    id: string = "";
    conferenceRoomId: string = "";
    roomStatus: string = "";
    roomName: string = "";
    roomDescription: string = "";
    config: {
        roomTimeoutSecs: number;
        conferenceCode: string;
        requireConferenceCode: boolean;
        usersMax: number;
        guestsMax: number;
        guestsAllowed: boolean;
        guestsAllowMic: boolean;
        guestsAllowCamera: boolean;
    }

    constructor(uniqeId: string, name: string) {
        this.id = uniqeId;
        this.roomName = name;
    }


}