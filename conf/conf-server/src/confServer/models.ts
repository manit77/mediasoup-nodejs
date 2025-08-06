export interface ConferenceServerConfig {
    
    conf_server_port: number,
    conf_reconnection_timeout: number,
    conf_secret_key: string,
    conf_max_peers_per_conf: number,
    conf_allow_guests: boolean;
    conf_token_expires_min: number,
    conf_callback_urls: {},
    conf_data_access_token: string,
    conf_data_cache_timeoutsecs: number,
    conf_data_urls: { getScheduledConferencesURL: string, getScheduledConferenceURL: string, loginURL: string, loginGuestURL: string },
    conf_socket_timeout_secs: 60,
    conf_require_participant_group: boolean;

    room_access_token: string,
    room_servers_uris: string[],

    cert_file_path: string,
    cert_key_path: string,
}

export enum ConferenceServerEventTypes {
    onSendMsg = 'onSendMsg',
}