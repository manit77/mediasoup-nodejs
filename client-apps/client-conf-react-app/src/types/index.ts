export interface User {
    id: string;
    displayName: string;
    role: "admin" | "user" | "guest";
}

export interface Device {
    id: string;
    label: string;
}

export class SelectedDevices {
    videoId?: string;
    videoLabel?:string;
    audioInId?: string;
    audioInLabel?:string;
    audioOutId?: string;
    audioOutLabel?: string;
    isVideoEnabled = true;
    isAudioEnabled = true;
}

export class ConferenceRoomScheduled {
    id: string;
    conferenceRoomId: string;
    roomStatus : string;
    roomName: string;

    constructor(uniqeId: string, name: string) {
        this.id = uniqeId;
        this.roomName = name;
    }

    
}