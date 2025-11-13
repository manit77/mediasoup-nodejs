export interface ConferenceServerConfig {
    
    conf_server_port: number,
    conf_reconnection_timeout: number,
    conf_secret_key: string,
    conf_max_peers_per_conf: number,
    conf_allow_guests: boolean;
    conf_token_expires_min: number,
    conf_callback_urls: {},
    conf_data_access_token: string,
    conf_data_cache_timeout_secs: number,
    conf_data_urls: { get_scheduled_conferences_url: string, get_scheduled_conference_url: string, login_url: string, login_guest_url: string, getUser: string },
    conf_socket_timeout_secs: 300,
    /**
     * socket has x seconds to respond to a ping
     */
    conf_socket_pong_timeout_secs: 10,
    /**
     * ping the socket every x seconds
     */
    conf_socket_ping_interval_secs: 15,
    conf_require_participant_group: boolean;

    room_access_token: string,
    room_servers_uris: string[],

    cert_file_path: string,
    cert_key_path: string,
}

export enum ConferenceServerEventTypes {
    onSendMsg = 'onSendMsg',
}