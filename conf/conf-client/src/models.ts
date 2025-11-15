import { ConferenceConfig, conferenceType, JoinConferenceParams, ParticipantRole } from "@conf/conf-models";
import { IMsg, PeerTracksInfo } from "@rooms/rooms-models";

export class ConferenceClientConfig {
    title = "Video Conferencing Server";
    debug_auto_answer : true;
    conf_ws_url = 'wss://localhost:3001';
    socket_enable_logs = false;
    socket_auto_reconnect = true;
    socket_reconnect_secs = 5;
    conf_require_participant_group = false;
    conf_server_url = "https://localhost:3100";
    conf_call_connect_timeout_secs = 30;
    conf_socket_register_timeout_secs = 15;
    version = "0.0";
    commit = "####"
}

export type callStates = "calling" | "answering" | "connecting" | "connected" | "disconnected";

export class Participant {
    participantId: string;
    displayName: string;
    stream: MediaStream = new MediaStream();
    role: string = ParticipantRole.guest;
    videoEle: HTMLVideoElement;

    peerId: string;
    tracksInfo: PeerTracksInfo = { isAudioEnabled: false, isVideoEnabled: false, isAudioMuted: false, isVideoMuted: false };
    prevTracksInfo: { isAudioMuted?: boolean, isVideoMuted?: boolean, isAudioEnabled: boolean, isVideoEnabled: boolean, screenShareTrackId: string } = null;
    constructor() {
        this.videoEle = document.createElement("video");
        this.videoEle.playsInline = true;
        this.videoEle.muted = true;
    }
}

export class Conference {

    conferenceId: string;
    conferenceName: string;
    conferenceExternalId: string;
    conferenceType: conferenceType = "p2p"; // default to p2p
    conferenceConfig: ConferenceConfig;
    leaderId?: string;

    roomAuthToken: string;
    roomToken: string;
    roomId: string;
    roomURI: string;
    joinParams: JoinConferenceParams;

    /**
     * remote participants
     */
    participants: Map<string, Participant> = new Map();

    presenterId: string;
    presenter: Participant;
    setPresenter(participant: Participant) {
        console.log(`setPresenter:`, participant);
        this.presenter = participant;
        if (participant) {
            this.presenterId == participant.participantId;
        } else {
            this.presenterId = "";
        }
    }

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
