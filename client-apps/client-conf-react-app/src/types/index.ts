export interface User {
    id: string;
    displayName: string;
}

export interface Conference {
    id: string;
    trackingId: string;
    name: string;
}

export interface Device {
    id: string;
    label: string;
}

export class CallParticipant implements User {
    constructor(id: string, name: string) {
        this.id = id;
        this.displayName = name;
    }

    id: string = "";
    displayName: string = "";
    stream: MediaStream = new MediaStream();
    isMuted: boolean = false;
    isVideoOff: boolean = false;
}

