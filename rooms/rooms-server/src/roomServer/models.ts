export type outMessageEventListener = (peerId: string, msg: any) => void;

export interface RoomServerConfig {
    room_public_ip: string,
    room_server_ip: string,
    room_server_https_port: number,
    room_server_http_port: number,
    
    room_audio_codec : string,
    room_audio_clock_rate : number,
    room_audio_channels : number,
    room_video_codec : string,
    room_video_clock_rate : number,

    room_rtc_start_port: number,
    room_rtc_end_port: number,
    room_recordingsDir: string,
    room_secretKey: string,
    room_newRoomTokenExpiresInMinutes: number,
    room_maxRoomDurationMinutes: number,
    room_timeOutNoParticipantsSecs: number,
    room_peer_timeOutInactivitySecs: number,

    room_iceServers :[];
    room_rec_enabled: boolean;
    room_rec_callback_uri : string;    
    rec_servers_uris: [];
    room_iceTransportPolicy: "all" | "relay"
    
    cert_file_path: string,
    cert_key_path: string,
}

export interface WorkerData {
    minPort : number,
    maxPort : number
}