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
    room_recordings_dir: string,
    room_secret_key: string,
    room_new_room_token_expire_min: number,
    room_max_room_dur_min: number,
    room_timeout_no_participants_secs: number,
    room_peer_timeout_inactivity_secs: number,

    room_ice_servers :[];
    room_rec_enabled: boolean;
    room_rec_callback_uri : string;    
    rec_servers_uris: [];
    room_ice_transport_policy: "all" | "relay"
    
    cert_file_path: string,
    cert_key_path: string,
}

export interface WorkerData {
    minPort : number,
    maxPort : number
}