export interface User {
    username: string;
    displayName: string;
    role: "admin" | "user" | "guest" | "monitor";
    authToken: string;
    clientData: {};
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
    /**
     * third party unique id, this will always have a value
     */
    externalId: string = "";
    conferenceRoomId: string = "";
    roomId: string = "";
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

    constructor(externalId: string, name: string) {
        this.externalId = externalId;
        this.roomName = name;
    }


}