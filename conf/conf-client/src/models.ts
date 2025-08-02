import { ConferenceRoomConfig, conferenceType, JoinConferenceParams, ParticipantRole } from "@conf/conf-models";
import { IMsg, PeerTracksInfo } from "@rooms/rooms-models";

export class ConferenceClientConfig {
    conf_ws_url = 'wss://localhost:3001';
    socket_enable_logs = false;
    conf_server_url = "https://localhost:3100";
    rooms_ws_url = "wss://localhost:3000"
}

export type callStates = "calling" | "answering" | "connecting" | "connected" | "disconnected";

export class Participant {
    participantId: string;
    displayName: string;
    stream: MediaStream = new MediaStream();
    role: string = ParticipantRole.guest;

    peerId: string;
    tracksInfo: PeerTracksInfo = { isAudioEnabled: true, isVideoEnabled: true };
    prevTracksInfo: { isAudioEnabled: boolean, isVideoEnabled: boolean, screenShareTrackId: string };
}

export class Conference {
    conferenceId: string;
    conferenceName: string;
    conferenceExternalId: string;
    conferenceType: conferenceType = "p2p"; // default to p2p
    conferenceRoomConfig: ConferenceRoomConfig;
    roomAuthToken: string;
    roomToken: string;
    roomId: string;
    roomURI: string;
    joinParams: JoinConferenceParams;

    /**
     * remote participants
     */
    participants: Map<string, Participant> = new Map();

    presenter: Participant;
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
}
