import {
    AcceptMsg, AcceptResultMsg, CallMessageType, ConferenceClosedMsg, ConferenceReadyMsg,
    ConferenceScheduledInfo, CreateConferenceParams,
    CreateConfMsg, CreateConfResultMsg, GetConferencesMsg, GetConferencesResultMsg, GetParticipantsMsg,
    GetParticipantsResultMsg, GetUserMediaConfig, InviteCancelledMsg, InviteMsg, InviteResultMsg,
    JoinConferenceParams, JoinConfMsg, JoinConfResultMsg, LeaveMsg, ParticipantInfo,
    PresenterInfoMsg,
    RegisterMsg, RegisterResultMsg, RejectMsg,
    LoggedOffMsg,
    //NotRegisteredMsg,
    UnauthorizedMsg,
    TerminateConfMsg,
    ConferenceConfig
} from "@conf/conf-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { RoomsClient, Peer, IPeer } from "@rooms/rooms-client";
import { callStates, Conference, ConferenceClientConfig, Participant, SelectedDevices } from "./models.js";
import { EventParticpantNewTrackMsg, EventTypes } from "./conferenceEvents.js";
import { ConferenceAPIClient } from "./conferenceAPIClient.js";
import { IMsg, OkMsg, payloadTypeServer } from "@rooms/rooms-models";
import { getBrowserDisplayMedia, getBrowserUserMedia } from "./conferenceUtils.js";

export type ConferenceEvent = (eventType: EventTypes, payload: IMsg) => Promise<void>;

export class ConferenceClient {

    private socket: WebSocketClient;
    localParticipant = new Participant();
    participantGroup: string = "";
    username: string = "";
    authToken: string = "";
    clientData = {};
    conference: Conference = new Conference();
    callState: callStates = "disconnected";

    public participantsOnline: ParticipantInfo[] = [];
    public conferencesOnline: ConferenceScheduledInfo[] = [];
    private roomsClient: RoomsClient;
    private roomsClientDisconnectTimerId: any;

    isScreenSharing = false;
    selectedDevices: SelectedDevices = new SelectedDevices();

    inviteSendMsg: InviteMsg;
    inviteReceivedMsg: InviteMsg;

    CallConnectTimeoutSeconds = 30;

    onEvent: ConferenceEvent;
    apiClient: ConferenceAPIClient;

    CallConnectTimeoutTimerIds = new Set<any>();
    private config: ConferenceClientConfig;

    private tryRegisterTimerId: any;
    private messageListener: Array<((event: any) => void)> = [];

    constructor() {
        console.log(`*** new instance of ConferenceClient`);
    }

    init(config: ConferenceClientConfig) {
        console.log(`*** init ConferenceClient`, config);

        this.config = config;
        this.apiClient = new ConferenceAPIClient(config);

        if (!this.config.conf_call_connect_timeout_secs) {
            this.CallConnectTimeoutSeconds = this.config.conf_call_connect_timeout_secs;
        }
    }

    dispose() {

        console.log("dispose");

        this.onEvent = null;
        this.disconnectRoomsClient("dispose", 0);

        if (this.socket) {
            console.log(`disconnecting from socket`);
            this.socket.disconnect();
            this.socket = null;
        }

        this.apiClient = null;

    }

    connect(participantGroup: string, username: string, authToken: string, clientData: any, options?: { socket_ws_uri?: string }) {
        console.log(`connect to socket server. participantGroup:${participantGroup} username:${username}`, this.config);

        if (this.socket && this.socket.state != "disconnected") {
            console.log(`socket already exists and in connecting state, disconnect.`);
            return;
        }

        if (!this.config) {
            console.error(`config is not initialized.`);
            return;
        }

        if (!participantGroup) {
            console.error("participantGroup is required.");
        }

        if (!username) {
            console.error("username is required.");
        }

        if (!authToken) {
            console.error("authToken is required.");
        }

        if (options && options.socket_ws_uri) {
            this.config.conf_ws_url = options.socket_ws_uri;
        }
        this.participantGroup = participantGroup;
        this.username = username;
        this.authToken = authToken;
        this.clientData = clientData;

        if (this.socket) {
            console.log(`disconnect existing target.`);
            this.socket.disconnect();
        }

        // Connect to WebSocket server
        console.log("new socket created, ", this.config);
        this.socket = new WebSocketClient({ enableLogs: this.config.socket_enable_logs });

        this.socket.addEventHandler("onopen", async () => {
            console.log("onopen - socket opened");
            this.onSocketConnected();
        });

        this.socket.addEventHandler("onclose", async () => {
            this.onSocketClosed("WebSocket connection closed");
        });

        this.socket.addEventHandler("onerror", async (error: any) => {
            console.error('WebSocket Error:', error);
            this.onSocketClosed("WebSocket error:" + error);
        });

        this.socket.addEventHandler("onmessage", async (event: any) => {
            const message = JSON.parse(event.data);
            await this.onSocketMessage(message);
        });

        this.socket.addEventHandler("networkchange", () => {
            this.onNetworkChange();
        });

        this.socket.connect(this.config.conf_ws_url, this.config.socket_autoReconnect ?? true, this.config.socket_reconnect_secs ?? 5);

    }

    disconnect() {
        console.log("conferenceClient disconnect");

        this.disconnectRoomsClient("disconnect");


        if (this.socket) {
            console.log(`disconnecting from socket`);
            this.socket.disconnect();
            this.socket = null;
        }

        this.resetLocalParticipant();
        this.resetLocalTracks();

        for (const p of this.conference.participants.values()) {
            p.stream.getTracks().forEach(t => t.stop());
        }

        for (const timerid of this.CallConnectTimeoutTimerIds.values()) {
            if (timerid) {
                clearTimeout(timerid);
            }
        }

        this.CallConnectTimeoutTimerIds.clear();

        this.inviteSendMsg = null;
        this.inviteReceivedMsg = null;

        this.authToken = "";
        this.callState = "disconnected";
        this.clientData = {};
        this.resetConferenceRoom();
        this.conferencesOnline = [];
        this.participantsOnline = [];
        this.isScreenSharing = false;
    }

    waitRegisterConnection(participantGroup: string, username: string, authToken: string, clientData: {}) {
        console.log("waitRegisterConnection");

        return new Promise<RegisterResultMsg>((resolve, reject) => {
            let _onmessage: (event: any) => void;

            let _removeEvents = () => {
                if (_onmessage) {
                    this.socket.removeEventHandler("onmessage", _onmessage);
                }
            }

            try {
                let timerid = setTimeout(() => {
                    _removeEvents();
                    reject("failed to register connection, register timed out.");
                }, (this.config.conf_socket_register_timeout_secs ?? 30) * 1000);

                _onmessage = (event: any) => {
                    console.log("** onmessage", event.data);
                    let msg = JSON.parse(event.data);

                    if (msg.type == CallMessageType.registerResult) {
                        clearTimeout(timerid);
                        _removeEvents();

                        let msgIn = msg as RegisterResultMsg;
                        if (msgIn.data.error) {
                            console.log(msgIn.data.error);
                            reject("failed to register connection, " + msgIn.data.error);
                            return;
                        }
                        resolve(msgIn);
                    }
                };

                this.socket.addEventHandler("onmessage", _onmessage);
                this.registerConnection(participantGroup, username, authToken, clientData);

            } catch (err: any) {
                console.log(err);
                _removeEvents();
                reject("error: failed to register connection");
            }
        });
    }

    waitTryRegister() {
        console.log("waitTryRegister");

        return new Promise<boolean>((resolve, reject) => {
            let _onmessage: (event: any) => void;

            let _removeEvents = () => {
                if (_onmessage) {
                    this.messageListener = this.messageListener.filter(cb => cb != _onmessage);
                }
            }

            try {
                let timerid = setTimeout(() => {
                    _removeEvents();
                    reject("failed to register connection, register timed out.");
                }, (this.config.conf_socket_register_timeout_secs ?? 30) * 1000);

                _onmessage = (msg: any) => {
                    console.log("** onmessage", msg.data);

                    if (msg.type == CallMessageType.registerResult) {
                        clearTimeout(timerid);
                        _removeEvents();

                        let msgIn = msg as RegisterResultMsg;
                        if (msgIn.data.error) {
                            console.log(msgIn.data.error);
                            return;
                        }
                        resolve(true);
                    }
                };

                this.messageListener.push(_onmessage);

            } catch (err: any) {
                console.log(err);
                _removeEvents();
                reject("error: failed to register connection");
            }
        });
    }

    private async onSocketConnected() {
        console.log("onSocketConnected()");

        this.resetConferenceRoom();
        this.resetLocalParticipant();
        this.resetLocalTracks();

        if (this.username && this.authToken) {
            this.tryRegister();
        } else {
            console.log("not credentials registerConnection");
        }
    }

    private async register() {
        console.log("register()");
        try {
            let registerResult = await this.waitRegisterConnection(this.participantGroup, this.username, this.authToken, this.clientData);
            if (!registerResult.data.error) {
                await this.onEvent(EventTypes.connected, new OkMsg());
                return true;
            }
        } catch (err) {
            console.error(err);
        }
        return false;

    }

    private async tryRegister() {
        console.log("tryRegister()");

        if (this.tryRegisterTimerId) {
            clearTimeout(this.tryRegisterTimerId);
        }

        await this.register();

        if (this.isRegistered()) {
            return;
        }

        this.tryRegisterTimerId = setTimeout(async () => {
            if (!await this.register()) {
                this.tryRegister();
                return;
            }
        }, 5000);

    }

    private async onSocketClosed(reason: string = "") {
        console.log(`onSocketClosed() - reconnecting: ${this.socket.autoReconnect}, state: ${this.socket.state} reason: ${reason}`);

        //the socket client has a reconnect feature
        console.log(`is autoReconnecting: ${this.socket.autoReconnect} in ${this.config.socket_reconnect_secs}`);

        if (this.roomsClient) {
            console.log(`closing roomsClient`);
            this.roomsClient.roomLeave();
            this.roomsClient.disconnect();
            this.roomsClient.dispose();
            this.roomsClient = null;
        }

        if (this.isInConference()) {
            let msg = new ConferenceClosedMsg();
            msg.data.conferenceId = this.conference.conferenceId;
            msg.data.reason = "connection closed";
            await this.onEvent(EventTypes.conferenceClosed, msg);
        }

        this.resetConferenceRoom();
        this.resetLocalParticipant();
        this.resetLocalTracks();

        console.log(`reconnectAttempts: ${this.socket.reconnectAttempts}`);
        if (this.socket.reconnectAttempts == 0) {
            console.log(`fire EventTypes.disconnected`);
            await this.onEvent(EventTypes.disconnected, new OkMsg());
        }
    }

    private async onSocketMessage(message: { type: CallMessageType, data: any }) {
        console.log('onSocketMessage ' + message.type, message);

        switch (message.type) {
            case CallMessageType.registerResult:
                await this.onRegisterResult(message);
                break;
            case CallMessageType.getParticipantsResult:
                await this.onParticipantsReceived(message);
                break;
            case CallMessageType.getConferencesResult:
                await this.onConferencesReceived(message);
                break;
            case CallMessageType.invite:
                await this.onInviteReceived(message);
                break;
            case CallMessageType.reject:
                await this.onRejectReceived(message);
                break;
            case CallMessageType.inviteResult:
                await this.onInviteResult(message);
                break;
            case CallMessageType.inviteCancelled:
                await this.onInviteCancelled(message);
                break;
            case CallMessageType.acceptResult: {
                await this.onAcceptResult(message);
                break;
            }
            case CallMessageType.createConfResult:
                await this.onCreateConfResult(message);
                break;
            case CallMessageType.joinConfResult:
                await this.onJoinConfResult(message);
                break;
            case CallMessageType.conferenceReady:
                await this.onConferenceReady(message);
                break;
            case CallMessageType.conferenceClosed:
                await this.onConferenceClosed(message);
                break;
            case CallMessageType.presenterInfo:
                await this.onPresenterInfo(message);
                break;
            case CallMessageType.loggedOff:
                {
                    await this.onLoggedOff(message);
                    break;
                }
            case CallMessageType.unauthorized: {
                await this.onUnauthorized(message);
                break;
            }
            // case CallMessageType.notRegistered: {
            //     await this.onNotRegistred(message);
            //     break;
            // }
        }

        this.messageListener.forEach(cb => cb(message));
    }

    private async onNetworkChange() {
        console.log("onNetworkChange");
        //send a test message
        if (!this.sendToServer(new OkMsg(payloadTypeServer.ok, {}))) {
            console.error("failed to send ok message, forcing a reconnect");
            //disconnected from server
            //this.waitRegisterConnection(this.username, this.authToken, this.clientData);
            //this.disconnectRoomsClient("network change", 0);            
            this.connect(this.participantGroup, this.username, this.authToken, this.clientData);
        }
    }

    startCallConnectTimer() {
        console.log("startCallConnectTimer");

        this.clearCallConnectTimer();

        const timerId = setTimeout(async () => {
            console.error(`CallConnectTimer executed conference ${this.conference.conferenceId}`);
            if (this.conference.conferenceId) {

                let msg = new ConferenceClosedMsg();
                msg.data.conferenceId = this.conference.conferenceId;

                if (this.callState === "calling") {
                    msg.data.reason = "no answer";
                } else if (this.callState === "answering") {
                    msg.data.reason = "answer failed";
                } else {
                    msg.data.reason = "call timed out.";
                }

                await this.onEvent(EventTypes.conferenceClosed, msg);

                this.leave();
            }
            this.CallConnectTimeoutTimerIds.delete(timerId);

        }, this.CallConnectTimeoutSeconds * 1000);
        this.CallConnectTimeoutTimerIds.add(timerId);
        console.log("startCallConnectTimer - Added Timer ID:", timerId);
    }

    clearCallConnectTimer() {
        console.log("clearCallConnectTimer");

        for (const timerId of this.CallConnectTimeoutTimerIds) {
            clearTimeout(timerId as any);
            console.log("clearCallConnectTimer - Cleared Timer ID:", timerId);
        }
        this.CallConnectTimeoutTimerIds.clear();
        console.log("clearCallConnectTimer - All timers cleared");
    }

    /**
     * gets usermedia from browser, removes all tracks from localstream
     * @param constraints 
     * @returns 
     */
    async getNewTracksForLocalParticipant(options: GetUserMediaConfig): Promise<MediaStreamTrack[]> {
        console.log(`getNewTracksForLocalParticipant constraints:`, options.constraints);

        if (!options.constraints) {
            console.warn(`no constraints`);
            return;
        }

        let newStream = await getBrowserUserMedia(options.constraints);
        if (newStream) {
            let newTracks = newStream.getTracks();
            this.localParticipant.stream.getTracks().forEach(t => {
                t.stop();
                this.localParticipant.stream.removeTrack(t);
            });

            newTracks.forEach(t => this.localParticipant.stream.addTrack(t));
            console.log(`new tracks created for localParticipant tracks`, this.localParticipant.stream.getTracks());
            console.log(`new tracks created for localParticipant tracksInfo`, this.localParticipant.tracksInfo);


            let audioTrack = newTracks.find(t => t.kind === "audio");
            if (audioTrack) {
                audioTrack.enabled = this.localParticipant.tracksInfo.isAudioEnabled;
                console.log(`track of type audio enabled set to `, audioTrack.enabled);
            }

            let videoTrack = newTracks.find(t => t.kind === "video");
            if (videoTrack) {
                videoTrack.enabled = this.localParticipant.tracksInfo.isVideoEnabled;
                console.log(`track of type video enabled set to `, videoTrack.enabled);
            }

            return newTracks;
        }

        console.error('no tracks returned');
        return [];
    }

    /**
     * remove existing tracks with the same kind from localParticipant
     * if in conference, check if track is allowed based on conference configs
     * publish tracks too rooms
     * add tracks to localParticipant
     * @param tracks 
     * @returns 
     */
    async publishTracks(tracks: MediaStreamTrack[], why: string) {
        console.log(`publishTracks, length: ${tracks?.length}, why ${why}`);

        //filter for live tracks only
        tracks.filter(t => t.readyState == "ended").forEach(t => this.localParticipant.stream.removeTrack(t));
        tracks = tracks.filter(t => t.readyState === "live");

        if (tracks.length == 0) {
            console.error(`no tracks`);
            return false;
        }

        //find and remove tracks or add to localParticipant
        for (let track of tracks) {
            //is the track in the localparticipants?
            let partTrack = this.localParticipant.stream.getTracks().find(t => t == track);
            if (!partTrack) {
                //do we have an existing track of the same kind? if so remove it
                partTrack = this.localParticipant.stream.getTracks().find(t => t.kind == track.kind);
                if (partTrack) {
                    this.localParticipant.stream.removeTrack(partTrack);
                    console.log(`track ${track.kind} removed from localParticipant`);
                    partTrack.stop();
                }
                this.localParticipant.stream.addTrack(track);
                console.log(`track ${track.kind} added to localParticipant`);
            } else {
                console.log(`track ${track.kind} already in localParticipant`);
            }
        }

        //check whether new tracks should be enabled
        if (this.isInConference()) {
            console.log(`disable mic or cam based on user preference`, this.conference.joinParams);

            let videoTrack = tracks.find(t => t.kind === "video");
            if (videoTrack) {
                videoTrack.enabled = this.localParticipant.tracksInfo.isVideoEnabled;
                this.checkTrackAllowed(videoTrack);
            }

            let audioTrack = tracks.find(t => t.kind === "audio");
            if (audioTrack) {
                audioTrack.enabled = this.localParticipant.tracksInfo.isAudioEnabled;
                this.checkTrackAllowed(audioTrack);
            }
            console.log(`track status audioTrack: ${audioTrack?.enabled}, videoTrack: ${videoTrack?.enabled}`);
            console.log(`localParticipant.tracksInfo:`, this.localParticipant.tracksInfo);
        }

        //publish the tracks
        if (this.roomsClient) {
            await this.roomsClient.publishTracks(tracks);
        }

        return true;
    }

    /**
     * stop all tracks and remove from localParticipant
     * unpublish tracks
     * @param tracks 
     */
    unPublishTracks(tracks: MediaStreamTrack[]) {
        console.log(`unpublishTracks:`, tracks);

        tracks.forEach(track => {
            track.enabled = false;
            track.stop();
            this.localParticipant?.stream?.removeTrack(track);
            console.log(`track remoted and stopped ${track.kind}`);
        });

        if (this.roomsClient) {
            this.roomsClient.unPublishTracks(tracks);
        }
    }

    /**
     * update Trackinfo for the local participant
     * this will send message the the server
     */
    broadCastTrackInfo() {
        console.warn(`broadCastTrackInfo`);

        if (this.roomsClient) {
            this.roomsClient?.broadCastTrackInfo(this.localParticipant.tracksInfo);
        }
    }

    isBroadcastingVideo() {
        if (!this.roomsClient) {
            return false;
        }

        return this.roomsClient.isBroadcastingVideo();
    }

    isBroadcastingAudio() {
        if (!this.roomsClient) {
            return false;
        }

        return this.roomsClient.isBroadcastingAudio();
    }

    /**
     * this will force mute/unmute a participant on the server based on the local tracks
     * @param participantId 
     */
    muteParticipantTrack(participantId: string, audioEnabled: boolean, videoEnabled: boolean) {
        console.log(`muteParticipantTrack participantId: ${participantId}`);

        if (this.roomsClient) {

            console.log(`conference.participants`, [...this.conference.participants.values()]);
            let peerId = this.conference.participants.get(participantId)?.peerId;
            if (!peerId) {
                console.error(`peer not found. ${peerId}`);
                return;
            }

            //console.log("particpant tracks", particpant.mediaStream.getTracks());
            this.roomsClient.muteParticipantTrack(peerId, audioEnabled, videoEnabled);
        }

    }

    async startScreenShare(): Promise<boolean> {
        console.log(`startScreenShare`);

        if (!this.isInConference()) {
            console.error(`not in conference`);
            return false;
        }

        if (this.localParticipant.role === "guest" && !this.conference.conferenceConfig.guestsAllowScreenShare) {
            console.error(`screen sharing not allowed.`);
            return false;
        }

        const screenTrack = (await getBrowserDisplayMedia())?.getVideoTracks()[0];
        if (!screenTrack) {
            console.error(`could not get screenTrack, user may have cancelled or permission error.`);
            return false;
        }

        //camera track will be removed and stopped
        let cameraTrack = this.localParticipant.stream.getVideoTracks()[0];

        if (screenTrack) {
            this.localParticipant.prevTracksInfo = {
                isVideoEnabled: this.localParticipant.tracksInfo.isVideoEnabled,
                isAudioEnabled: this.localParticipant.tracksInfo.isAudioEnabled,
                screenShareTrackId: screenTrack.id,
            };

            this.localParticipant.tracksInfo.isVideoEnabled = true;

            if (await this.publishTracks([screenTrack], "startScreenShare")) {
                this.conference.setPresenter(this.localParticipant);
                this.isScreenSharing = true;

                //broadCastTrackInfo
                this.broadCastTrackInfo();

                this.sendPresenting(true);

                return true;
            }

            //reset back to previous settings
            this.localParticipant.tracksInfo = { ...this.localParticipant.prevTracksInfo };
        } else {
            console.error(`could not get screen track.`);
        }
        return false;
    }

    async stopScreenShare(constraints: MediaStreamConstraints): Promise<boolean> {
        console.log("stopScreenShare", this.localParticipant.stream.getVideoTracks());

        try {

            this.isScreenSharing = false;
            if (this.conference.presenter == this.localParticipant) {
                this.conference.setPresenter(null);
            }

            const screenTrack = this.localParticipant.stream.getVideoTracks().find(track => track.id === this.localParticipant.prevTracksInfo?.screenShareTrackId);

            if (screenTrack) {
                console.log(`Stopping screenTrack: ${screenTrack.id}`);
                screenTrack.stop();

                //unpublish track
                this.unPublishTracks([])
            } else {
                console.log("screenshare track not found")
            }

            //set from the prev state
            if (this.localParticipant.prevTracksInfo) {
                this.localParticipant.tracksInfo.isVideoEnabled = this.localParticipant.prevTracksInfo.isVideoEnabled;
            }

            //if the video was previously enabled, get the camera stream again
            if (this.localParticipant.tracksInfo.isVideoEnabled) {
                let newStream = await getBrowserUserMedia(constraints);
                let newTracks = newStream.getTracks();
                let cameraTrack = newStream.getTracks().find(t => t.kind === "video");

                if (cameraTrack) {
                    await this.publishTracks(newTracks, "stopScreenShare");
                    this.sendPresenting(false);
                }
            } else {
                //remove the track since we didn't publish it
                if (screenTrack) {
                    this.localParticipant.stream.removeTrack(screenTrack);
                }
            }

            this.broadCastTrackInfo();

            return true;

        } catch (error) {
            console.error("Error stopping screen share:", error);
        }

        this.broadCastTrackInfo();
        return false;
    }

    sendPresenting(isPresenting: boolean) {
        console.log(`sendPresenting`);

        let msg = new PresenterInfoMsg();
        msg.data.status = isPresenting ? "on" : "off";
        this.sendToServer(msg);
    }

    isInConference() {
        return !!(this.isConnected() && this.conference.conferenceId);
    }

    isConnected() {
        return !!(this.socket && this.socket.state === "connected");
    }

    isRegistered() {
        return !!(this.isConnected() && this.localParticipant.participantId);
    }

    isConnecting() {
        return !!(this.socket && ["connecting", "reconnecting"].includes(this.socket.state));
    }

    /**
     * registers a websocket connection
     * @param username 
     * @param authToken 
     */
    private registerConnection(participantGroup: string, username: string, authToken: string, clientData: {}) {
        console.log("registerConnection");

        if (this.isRegistered()) {
            console.error(`connection already registered.`);
            return;
        }

        if (!username) {
            console.error(`username is required.`);
            return;
        }
        if (!authToken) {
            console.error(`authToken is required.`);
            return;
        }

        console.log(`sending server registration`);

        // Register with the server
        const registerMsg: RegisterMsg = new RegisterMsg();
        registerMsg.data.username = username;
        registerMsg.data.displayName = username;
        registerMsg.data.authToken = authToken;
        registerMsg.data.participantGroup = participantGroup;
        registerMsg.data.clientData = clientData;

        this.sendToServer(registerMsg);
    }

    getParticipantsOnline() {
        console.log("getParticipantsOnline");

        if (!this.isRegistered()) {
            console.error("not registered");
            return;
        }

        if (this.localParticipant.role === "guest") {
            console.error("guest cannot get participants");
            return;
        }

        const getParticipantsMsg = new GetParticipantsMsg();
        this.sendToServer(getParticipantsMsg);
    }

    getConferenceRoomsOnline() {
        console.log("getConferenceRooms");

        if (!this.isRegistered()) {
            console.error("not registered");
            return;
        }

        const msg = new GetConferencesMsg();
        this.sendToServer(msg);
    }

    /**
     * send an invite to a participant
     * this is a p2p conference room
     * send InviteMsg, wait to receive InviteResultMsg
     * @param participantId 
     */
    sendInvite(participantId: string, args: JoinConferenceParams): InviteMsg {
        console.log(`sendInvite() ${participantId}`, args);

        if (!this.isRegistered()) {
            console.error(`connection not registered.`);
            return null;
        }

        if (this.isInConference()) {
            console.error("invite() - already in a conference.", this.conference);
            return null;
        }

        if (this.inviteSendMsg || this.inviteReceivedMsg) {
            console.error(`pending invite message`);
            return null;
        }

        if (!participantId) {
            console.error(`participantId is requiried.`);
            return null;
        }

        this.callState = "calling";
        let inviteMsg = new InviteMsg();
        inviteMsg.data.participantId = participantId;
        if (!this.sendToServer(inviteMsg)) {
            console.error(`failed to send inviteSendMsg`);
            this.resetConferenceRoom();
            this.resetLocalTracks();
            return null;
        }

        this.inviteSendMsg = inviteMsg;

        this.startCallConnectTimer();
        this.conference.joinParams = args;

        return this.inviteSendMsg;
    }

    cancelInvite(invite: InviteMsg) {
        console.log(`cancelInvite() ${invite.data.participantId} ${invite.data.conferenceId}`);

        if (!this.isRegistered()) {
            console.error(`connection not registered.`);
            return null;
        }

        const callMsg = new InviteCancelledMsg();
        callMsg.data.participantId = invite.data.participantId;
        callMsg.data.conferenceId = invite.data.conferenceId;
        this.sendToServer(callMsg);

        this.resetConferenceRoom();
        this.resetLocalTracks();
    }

    createConferenceRoom(args: CreateConferenceParams): boolean {
        console.log(`createConferenceRoom trackingId: ${args.externalId}, roomName: ${args.roomName}`);

        if (!this.isRegistered()) {
            console.error(`connection not registered.`);
            return false;
        }

        const msg = new CreateConfMsg();
        msg.data.conferenceExternalId = args.externalId;
        msg.data.roomName = args.roomName;
        msg.data.conferenceCode = args.conferenceCode;
        msg.data.conferenceConfig = args.config;
        return this.sendToServer(msg);
    }

    /**
     * admins can always create a room and join a room
     * if role is a user, conferenceCode is required and must match the scheduled conference's conferenceCode
     * @param trackingId 
     * @param roomName 
     * @param conferenceCode 
     * @param config 
     * @returns 
     */
    waitCreateConferenceRoom(args: CreateConferenceParams) {
        console.log(`waitCreateConferenceRoom externalId: ${args.externalId}, roomName: ${args.roomName}, conferenceCode: ${args.conferenceCode}`);
        return new Promise<CreateConfResultMsg>((resolve, reject) => {

            if (!this.isRegistered()) {
                console.error(`connection not registered.`);
                reject(`connection not registered.`);
            }

            if (!args.externalId) {
                console.error("createArgs externalId is required.");
                reject(`externalId is required.`);
            }

            let _onmessage: (event: any) => void;

            let _removeEvents = () => {
                if (_onmessage) {
                    this.socket.removeEventHandler("onmessage", _onmessage);
                }
            }

            try {
                let timerid = setTimeout(() => {
                    _removeEvents();
                    reject("failed to create conference");
                }, 5000);

                _onmessage = (event: any) => {
                    console.log("** onmessage", event.data);
                    let msg = JSON.parse(event.data);

                    if (msg.type == CallMessageType.createConfResult) {
                        clearTimeout(timerid);
                        _removeEvents();

                        let msgIn = msg as CreateConfResultMsg;
                        if (msgIn.data.error) {
                            console.log(msgIn.data.error);
                            reject("failed to create conference");
                            return;
                        }
                        resolve(msgIn);
                    }
                };

                this.socket.addEventHandler("onmessage", _onmessage);
                if (!this.createConferenceRoom(args)) {
                    reject("failed send conference room msg.");
                }

            } catch (err: any) {
                console.log(err);
                _removeEvents();
                reject("erorr on creating conference room");
            }
        });
    }

    waitJoinConferenceRoom(args: JoinConferenceParams) {
        console.log(`waitJoinConferenceRoom trackingId: ${args.conferenceId}, conferenceCode: ${args.conferenceCode}`);

        return new Promise<JoinConfResultMsg>((resolve, reject) => {

            if (!this.isRegistered()) {
                console.error(`connection not registered.`);
                reject(`connection not registered.`);
            }

            if (!args.externalId) {
                console.error("createArgs externalId is required.");
                reject(`externalId is required.`);
            }

            let _onmessage: (event: any) => void;

            let _removeEvents = () => {
                if (_onmessage) {
                    this.socket.removeEventHandler("onmessage", _onmessage);
                }
            }

            try {
                let timerid = setTimeout(() => {
                    _removeEvents();
                    reject("failed to join conference");
                }, 5000);

                _onmessage = (event: any) => {
                    console.log("** onmessage", event.data);
                    let msg = JSON.parse(event.data);

                    if (msg.type == CallMessageType.joinConfResult) {
                        clearTimeout(timerid);
                        _removeEvents();

                        let msgIn = msg as JoinConfResultMsg;

                        if (msgIn.data.error) {
                            console.log(msgIn.data.error);
                            reject("failed to join conference");
                            return;
                        }
                        resolve(msgIn);
                    }
                };

                this.socket.addEventHandler("onmessage", _onmessage);
                if (!this.joinConferenceRoom(args)) {
                    reject(`failed to send joinConferenceRoom`);
                }

            } catch (err: any) {
                console.log(err);
                _removeEvents();
                reject("failed to join room");
            }
        });
    }

    async waitCreateAndJoinConference(createArgs: CreateConferenceParams, joinArgs: JoinConferenceParams) {
        console.log(`waitCreateAndJoinConference`, createArgs, joinArgs);

        try {
            if (!this.isRegistered()) {
                console.error(`connection not registered.`);
                return false;
            }

            let newResult = await this.waitCreateConferenceRoom(createArgs);
            if (newResult.data.error) {
                console.error(newResult.data.error);
                return false;
            }

            joinArgs.conferenceId = newResult.data.conferenceId;

            let joinResult = await this.waitJoinConferenceRoom(joinArgs);
            if (joinResult.data.error) {
                console.error(joinResult.data.error);
                return false;
            }

            console.log("join conference, waiting for room ready message");
            return true;

        } catch (err) {
            console.error(err);
            return false;
        }
    }

    /**
     * join a conference room
     * send JoinConfMsg wait for JoinConfResultMsg
     * @param args 
     * @returns 
     */
    async joinConferenceRoom(args: JoinConferenceParams) {
        console.log(`joinConferenceRoom conferenceId: ${args.conferenceId} conferenceCode: ${args.conferenceCode}`);

        if (!this.isRegistered()) {
            console.error(`connection not registered.`);
            return false;
        }

        if (this.conference.conferenceId) {
            console.error(`already in conferenceroom ${this.conference.conferenceId}`);
            return false;
        }

        this.resetConferenceRoom();

        this.conference.joinParams = args;

        //get the conference config first
        if (!this.conference.conferenceConfig) {

            if (!args.externalId) {
                console.error(`trackingId is required.`);
                return false;
            }

            console.log(`getConferenceScheduled config `, args.externalId, args.clientData);
            let scheduled = await this.apiClient.getConferenceScheduled(this.authToken, args.externalId, args.clientData);
            if (scheduled.data.error) {
                console.error(scheduled.data.error);
                return false;
            }
            console.log(`getConferenceScheduled result `, scheduled);
            this.conference.conferenceConfig = scheduled.data.conference.config;
        }

        if (!this.conference.conferenceConfig) {
            console.error(`no conference config found.`);
            return false;
        }

        this.startCallConnectTimer();
        this.callState = "connecting";

        const msg = new JoinConfMsg();
        msg.data.conferenceId = args.conferenceId;
        msg.data.conferenceCode = args.conferenceCode;

        this.conference.conferenceId = args.conferenceId;

        return this.sendToServer(msg);
    }

    private checkTrackAllowed(track: MediaStreamTrack) {
        console.log("checkTrackAllowed", track.kind, this.conference.conferenceConfig);

        if (!this.conference.conferenceConfig) {
            console.error(`not conference config found.`);
            return;
        }

        if (this.localParticipant.role === "guest") {
            if (track.kind === "audio" && !this.conference.conferenceConfig.guestsAllowMic) {
                if (track) {
                    track.enabled = false;
                }
            }

            if (track.kind === "video" && !this.conference.conferenceConfig.guestsAllowCamera) {
                if (track) {
                    track.enabled = false;
                }
            }
        }

        console.log(`track ${track.kind} ${track.enabled}`);

    }

    /**
     * sent and InviteMsg, received InviteResultMsg, wait to receive ConferenceReadyMsg or RejectMsg
     */
    private async onInviteResult(message: InviteResultMsg) {
        console.log("onInviteResult()");
        //the conferenceId must be empty or it must match

        if (message.data.error) {
            console.error("onInviteResult() - error received");
            this.callState = "disconnected";

        }

        if (!message.data.conferenceId) {
            console.error("onInviteResult() - no conferenceId");
            this.callState = "disconnected";
        }

        if (!this.inviteSendMsg) {
            console.error("onInviteResult() - no invite sent");
            this.callState = "disconnected";
        }

        if (this.conference.conferenceId && this.conference.conferenceId != message.data.conferenceId) {
            console.error(`onInviteResult() - incorrect conferenceId ${this.conference.conferenceId} ${message.data.conferenceId}`);
            this.callState = "disconnected";
        }

        if (this.inviteSendMsg.data.participantId != message.data.participantId) {
            console.error(`onInviteResult() - incorrect participantId, invite:${this.inviteSendMsg.data.participantId} msg:${message.data.participantId}`);
            this.callState = "disconnected";
        }

        if (this.callState === "disconnected") {
            await this.onEvent(EventTypes.inviteResult, message);
            this.resetConferenceRoom();
            this.resetLocalTracks();
            return;
        }

        console.log(`onInviteResult() - received a new conferenceId ${message.data.conferenceId}`);
        console.log(`set conferenceId ${message.data.conferenceId}`);

        //clear the inviteSendMsg, set the conference variables
        this.inviteSendMsg = null;
        this.conference.conferenceId = message.data.conferenceId;
        this.conference.conferenceName = message.data.conferenceName || `Call with ${message.data.displayName}`;
        this.conference.conferenceExternalId = message.data.conferenceExternalId;
        this.conference.conferenceType = message.data.conferenceType;

        this.startCallConnectTimer();

        await this.onEvent(EventTypes.inviteResult, message);
    }

    async onInviteReceived(message: InviteMsg) {
        console.log("onInviteReceived()");
        if (this.isInConference()) {
            console.log(`already in a conference. ${this.conference.conferenceId}`);
            return;
        }

        if (this.inviteSendMsg || this.inviteReceivedMsg) {
            console.log("onInviteReceived() - already have an pending invite message.");
            return;
        }

        if (!message.data.conferenceId) {
            console.error(`no conferenceId received.`);
            return;
        }

        this.callState = "answering";
        this.conference.conferenceId = message.data.conferenceId;
        this.conference.conferenceName = message.data.conferenceName || `Call with ${message.data.displayName}`;
        this.conference.conferenceExternalId = message.data.conferenceExternalId;
        this.conference.conferenceType = message.data.conferenceType;

        this.inviteReceivedMsg = message;

        console.log(`set conferenceId ${message.data.conferenceId}`, this.conference);
        this.startCallConnectTimer();

        await this.onEvent(EventTypes.inviteReceived, message);
    }

    /**
     * remote participant cancelled the invite
     * @param message 
     * @returns 
     */
    async onInviteCancelled(message: InviteCancelledMsg) {
        console.log("onInviteCancelled()");

        if (!message.data.conferenceId) {
            console.error(`conferenceId is required.`);
            return;
        }

        if (message.data.conferenceId != this.conference.conferenceId) {
            console.error("onInviteCancelled() - not the same conferenceId.");
            return;
        }

        await this.onEvent(EventTypes.inviteCancelled, message);

        this.resetConferenceRoom();
        this.resetLocalTracks();
    }

    /**
     * accept an invite from a received invite
     * wait for AcceptResultMsg
     * @param message 
     * @returns 
     */
    acceptInvite(message: InviteMsg, joinArgs: JoinConferenceParams) {
        console.log("acceptInvite()");

        if (!this.isRegistered()) {
            console.error(`connection not registered.`);
            return;
        }

        if (!this.inviteReceivedMsg) {
            console.error(`not invite received.`);
            return;
        }

        if (!message.data.conferenceId) {
            console.error("conferenceId is required to accept an invite.");
            return;
        }

        if (message.data.conferenceId != this.inviteReceivedMsg.data.conferenceId) {
            console.error("accept failed. not the same conferenceId");
            return false;
        }

        if (message.data.participantId != this.inviteReceivedMsg.data.participantId) {
            console.error("accept failed. not the same participantId");
            return false;
        }

        const acceptMsg = new AcceptMsg();
        acceptMsg.data.conferenceId = message.data.conferenceId;
        if (!this.sendToServer(acceptMsg)) {
            console.error(`failed to send AcceptMsg`);
            return;
        }

        this.conference.conferenceId = message.data.conferenceId;
        this.conference.joinParams = joinArgs;

        this.callState = "connecting";
        this.inviteReceivedMsg = null;

        this.startCallConnectTimer();
    }

    /**
     * after accepting and invite, receive AcceptResultMsg from the server
     * wait for ConferenceReadyMsg to join room
     * @param message 
     */
    async onAcceptResult(message: AcceptResultMsg) {
        console.log("onAcceptResult()");

        if (message.data.error) {
            console.error(`error accepting a call:`, message.data.error);
            this.resetConferenceRoom();
            this.resetLocalTracks();
            return;
        }

        await this.onEvent(EventTypes.acceptResult, message);

    }

    /**
     * local user rejected an inviteReceivedMsg
     * @param message 
     * @returns 
     */
    rejectInvite(message: InviteMsg) {
        console.log("reject()");

        if (!this.isRegistered()) {
            console.error(`connection not registered.`);
            return;
        }

        if (!this.inviteReceivedMsg) {
            console.error(`no invite received.`);
        }

        if (message.data.conferenceId != this.inviteReceivedMsg.data.conferenceId) {
            console.error("accept failed. not the same conferenceId");
            return false;
        }

        if (message.data.participantId != this.inviteReceivedMsg.data.participantId) {
            console.error("accept failed. not the same participantId");
            return false;
        }

        let msg = new RejectMsg();
        msg.data.conferenceId = message.data.conferenceId;
        msg.data.fromParticipantId = this.localParticipant.participantId;
        msg.data.toParticipantId = message.data.participantId;
        this.sendToServer(msg);

        this.resetConferenceRoom();

    }

    /**
     * local user leaves the conference
     * @returns 
     */
    leave() {
        console.log("leave()");

        if (this.inviteSendMsg) {
            this.cancelInvite(this.inviteSendMsg);
        }

        if (this.inviteReceivedMsg) {
            this.rejectInvite(this.inviteReceivedMsg);
        }

        if (this.roomsClient) {
            this.roomsClient.roomLeave();
            this.disconnectRoomsClient("leave");
        }

        if (!this.isInConference()) {
            console.log("leave() - failed, not in conference");
            return;
        }

        let msg = new LeaveMsg();
        msg.data.conferenceId = this.conference.conferenceId;
        this.sendToServer(msg);

        this.resetConferenceRoom();
        this.resetLocalTracks();
    }

    terminate() {
        console.log(`terminate`);

        if (!this.isInConference()) {
            console.error("not in conference");
            return;
        }

        let conferenceId = this.conference.conferenceId;

        let terminateMsg = new TerminateConfMsg();
        terminateMsg.data.conferenceId = conferenceId;
        this.sendToServer(terminateMsg);

        //leave room incase we don't have permissions to terminate the room
        this.leave();
    }

    private resetConferenceRoom() {
        console.log("resetConferenceRoom()");

        this.callState = "disconnected";

        this.conference.conferenceExternalId = "";
        this.conference.conferenceConfig = new ConferenceConfig();
        this.conference.conferenceId = "";
        this.conference.conferenceName = "";
        this.conference.conferenceType = "p2p";
        this.conference.joinParams = null;
        this.conference.leaderId = null;
        this.conference.participants.clear();
        this.conference.presenter = null;
        this.conference.presenterId = "";
        this.conference.roomAuthToken = "";
        this.conference.roomId = "";
        this.conference.roomAuthToken = "";
        this.conference.roomToken = "";
        this.conference.roomURI = "";

        this.inviteSendMsg = null;
        this.inviteReceivedMsg = null;
        this.clearCallConnectTimer();
        this.localParticipant.peerId = "";
        this.isScreenSharing = false;
    }

    private resetLocalParticipant() {
        console.log("resetLocalParticipant()");

        this.localParticipant.participantId = "";
        this.localParticipant.displayName = "";
        this.localParticipant.peerId = "";
        this.localParticipant.role = "";
    }

    private resetLocalTracks() {
        console.log("resetLocalTracks()");

        this.localParticipant.stream.getTracks().forEach(t => {
            t.stop();
            this.localParticipant.stream.removeTrack(t);
        });
        this.isScreenSharing = false;
    }

    getParticipant(participantId: string): Participant {
        console.log("getParticipant");
        return this.conference.participants.get(participantId);
    }

    sendPong(conferenceId: string) {
        console.log(`sendPong `, conferenceId);

        if (!this.isInConference()) {
            return;
        }

        if (conferenceId !== this.conference.conferenceId) {
            console.error(`not the same conference`, conferenceId, this.conference.conferenceId);
            return;
        }

        if (!this.roomsClient) {
            console.error(`room not initialized.`);
            return;
        }

        this.roomsClient.roomPong(this.conference.roomId);
    }

    private sendToServer(message: IMsg) {
        console.log("sendToServer " + message.type, message);

        if (this.socket) {
            return this.socket.send(JSON.stringify(message));
        } else {
            console.error('Error sending message, socket is not connected');
        }
        return false;
    }

    private async onRegisterResult(message: RegisterResultMsg) {
        console.log("onRegisterResult");

        if (message.data.error) {
            console.error(message.data.error);
            await this.onEvent(EventTypes.registerResult, message);
        } else {
            this.localParticipant.participantId = message.data.participantId;
            this.localParticipant.displayName = message.data.username;
            this.localParticipant.role = message.data.role;
            console.log('*** Registered with participantId:', this.localParticipant);
            await this.onEvent(EventTypes.registerResult, message);

            this.getParticipantsOnline();
        }
    }

    private async onLoggedOff(message: LoggedOffMsg) {
        console.log("onRegisterResult");

        await this.onEvent(EventTypes.loggedOff, message);
    }

    private async onUnauthorized(message: UnauthorizedMsg) {
        console.log("onUnauthorized");

        this.connect(this.participantGroup, this.username, this.authToken, this.clientData);
        await this.onEvent(EventTypes.unAuthorized, message);
    }

    // private async onNotRegistred(message: NotRegisteredMsg) {
    //     console.log("onNotRegistred");
    //     this.onSocketClosed("not registered.");
    // }

    private async onParticipantsReceived(message: GetParticipantsResultMsg) {
        console.log("onParticipantsReceived");

        this.participantsOnline = message.data.participants.filter(c => c.participantId !== this.localParticipant.participantId);
        await this.onEvent(EventTypes.participantsReceived, message);
    }

    private async onConferencesReceived(message: GetConferencesResultMsg) {
        //console.log("onConferencesReceived");

        this.conferencesOnline = message.data.conferences;
        await this.onEvent(EventTypes.conferencesReceived, message);
    }

    /**
     * the remote user rejected the invite
     * @param message 
     */
    private async onRejectReceived(message: InviteResultMsg) {
        console.log("onRejectReceived");

        if (this.conference.conferenceId != message.data.conferenceId) {
            console.error(`conferenceId does not match ${this.conference.conferenceId} ${message.data.conferenceId}`);
            return;
        }

        await this.onEvent(EventTypes.rejectReceived, message);
        this.resetConferenceRoom();
        this.resetLocalTracks();
        this.disconnectRoomsClient("onRejectReceived");
    }

    /**
     * received a result from the server after creating a conference
     * @param message 
     * @returns 
     */
    private async onCreateConfResult(message: CreateConfResultMsg) {
        console.log("onCreateConfResult");

        if (message.data.error) {
            console.error(message.data.error);

            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: message.data.error } });
            this.disconnectRoomsClient("onCreateConfResult");
            return;
        }

        if (!message.data.conferenceId) {
            console.error(`no conferenceId`);

            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: message.data.error } });
            this.disconnectRoomsClient("no conferenceId");
            return;
        }

        await this.onEvent(EventTypes.conferenceCreatedResult, message);
    }

    /**
     * received a result from the server after joining a conference
     * @param message 
     * @returns 
     */
    private async onJoinConfResult(message: JoinConfResultMsg) {
        console.log("onJoinConfResult");

        if (message.data.error) {
            console.error("onJoinConfResult() - error received");

            this.clearCallConnectTimer();
            this.callState = "disconnected";
            this.conference.conferenceId = "";

            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: message.data.error } });
            this.disconnectRoomsClient("onJoinConfResult");
            return;
        }

        this.conference.leaderId = message.data.leaderId;
        this.conference.presenterId = message.data.presenterId;
        console.log(`onJoinConfResult leaderId: ${this.conference.leaderId}, presenterId: ${this.conference.presenterId} `);

        //!!! don't send event for EventTypes.conferenceJoined, wait for room client to send event
        //!!! next event received is onConferenceReady

    }

    /**
     * conference is ready to be used
     * @param message 
     * @returns 
     */
    private async onConferenceReady(message: ConferenceReadyMsg) {
        console.log(`onConferenceReady(), leaderId:${message.data.leaderId}, presenterId: ${message.data.presenterId}`);

        if (this.conference.conferenceId != message.data.conferenceId) {
            console.error(`onConferenceReady() - conferenceId does not match ${this.conference.conferenceId} ${message.data.conferenceId}`);
            return;
        }

        //p2p call
        this.conference.conferenceName = message.data.conferenceName || `Call with ${message.data.displayName}`;

        this.conference.presenterId = message.data.presenterId;
        this.conference.leaderId = message.data.leaderId;

        this.conference.conferenceExternalId = message.data.conferenceId;
        this.conference.conferenceExternalId = message.data.conferenceExternalId;
        this.conference.conferenceType = message.data.conferenceType;
        this.conference.conferenceConfig = message.data.conferenceConfig;

        this.conference.roomId = message.data.roomId;
        this.conference.roomToken = message.data.roomToken;
        this.conference.roomURI = message.data.roomURI;
        this.conference.roomAuthToken = message.data.roomAuthToken;

        if (!this.conference.roomId) {
            console.error("ERROR: no roomId");
            return;
        }

        if (!this.conference.roomToken) {
            console.error("ERROR: no roomToken");
            return;
        }

        if (!this.conference.roomURI) {
            console.error("ERROR: no roomURI");
            return;
        }

        if (!this.conference.roomAuthToken) {
            console.error("ERROR: no roomAuthToken");
            return;
        }

        if (!message.data.roomRtpCapabilities) {
            console.error("ERROR: no roomRtpCapabilities");
            return;
        }

        try {
            await this.initRoomsClient(message.data.roomURI, message.data.roomRtpCapabilities);
            console.log("-- room initialized.")

            let connectResult = await this.roomsClient.waitForConnect();
            if (!connectResult.data.error) {
                console.log("-- room socket connected.");
            } else {
                console.log("-- room socket failed to connect.");
            }

            let registerResult = await this.roomsClient.waitForRegister({
                authToken: this.conference.roomAuthToken,
                username: this.username,
                trackingId: this.localParticipant.participantId,
                displayName: this.localParticipant.displayName,
                timeoutSecs: 30
            });

            if (!registerResult.data.error) {
                console.log(`-- room socket registered. new peerId ${this.roomsClient.getPeerId()}`);
                this.localParticipant.peerId = this.roomsClient.getPeerId();

                console.log("update the tracksInfo on the rooms clicent", this.localParticipant.tracksInfo);
                await this.roomsClient.broadCastTrackInfo(this.localParticipant.tracksInfo);
            } else {
                console.log("-- room socket failed to register.");
            }

            let roomJoinResult = connectResult = await this.roomsClient.waitForRoomJoin(this.conference.roomId, this.conference.roomToken);
            if (!roomJoinResult.data.error) {
                console.log("-- room join.");
            } else {
                console.log("-- room failed to join.");
            }

            if (connectResult.data.error || registerResult.data.error || roomJoinResult.data.error) {
                //call failed
                let msg = {
                    type: EventTypes.conferenceFailed,
                    data: {
                        conferenceId: this.conference.conferenceId
                    }
                };

                this.resetConferenceRoom();
                this.resetLocalTracks();

                this.disconnectRoomsClient("join conference failed.");
                await this.onEvent(EventTypes.conferenceFailed, msg);

            }
        } catch (err) {
            console.error(err);

            this.resetConferenceRoom();
            this.resetLocalTracks();

            this.disconnectRoomsClient("join conference error.");
            await this.onEvent(EventTypes.conferenceFailed, { type: EventTypes.conferenceFailed, data: { error: "error connecting to conference." } });
        }
    }

    private async onPresenterInfo(message: PresenterInfoMsg) {
        console.log("onPresenterInfo()");
        let participant = this.conference.participants.get(message.data.participantId);
        if (participant) {
            if (message.data.status == "on") {
                this.conference.setPresenter(participant);
            } else {
                this.conference.setPresenter(null);
            }

            let msg: IMsg = {
                type: EventTypes.prensenterInfo,
                data: {
                    presenter: participant
                }
            }

            await this.onEvent(EventTypes.prensenterInfo, msg);
        }
    }

    private async onConferenceClosed(message: ConferenceClosedMsg) {
        console.log("onConferenceClosed()");

        if (!this.isInConference()) {
            console.error("onConferenceClosed() - not in a conference.");
            return;
        }

        if (this.conference.conferenceId != message.data.conferenceId) {
            console.error(`onConferenceClosed() - conferenceId does not match ${this.conference.conferenceId} ${message.data.conferenceId}`);
            return;
        }

        // the room may still be open leave the room
        if (this.roomsClient) {
            this.roomsClient.roomLeave();
            this.disconnectRoomsClient("onConferenceClosed");
        }

        await this.onEvent(EventTypes.conferenceClosed, message);
        this.resetConferenceRoom();
        this.resetLocalTracks();
    }

    private async initRoomsClient(roomURI: string, roomRtpCapabilities: string) {
        console.log("initRoomsClient");

        if (this.roomsClientDisconnectTimerId) {
            console.log(`clear roomsClientDisconnectTimer ${this.roomsClientDisconnectTimerId}`);
            clearTimeout(this.roomsClientDisconnectTimerId);
        }

        if (this.roomsClient) {
            console.log("room already initialized with URI:", roomURI);
            return false;
        }

        this.roomsClient = new RoomsClient({
            socket_auto_reconnect: true,
            socket_enable_logs: this.config.socket_enable_logs,
            socket_ws_uri: roomURI
        });

        this.roomsClient.eventOnRoomSocketClosed = async () => {
            console.log("onRoomSocketClosedEvent");

            //room socket closed
            //leave the conference
            this.leave();

            //if in conference, notify the conference closed
            if (this.isInConference()) {
                let msg = new ConferenceClosedMsg();
                msg.data.conferenceId = this.conference.conferenceId;
                msg.data.reason = "disconnected from room server";
                this.onEvent(EventTypes.conferenceClosed, msg);
            }

            this.resetConferenceRoom();
            this.resetLocalTracks();

            //disconnect the rooms client immediately
            this.disconnectRoomsClient("onRoomClosedEvent", 0);

        };

        this.roomsClient.eventOnRoomJoined = async (roomId: string) => {
            //confirmation for local user has joined a room
            console.log(`onRoomJoinedEvent roomId: ${roomId} ${this.conference.conferenceId} `);
            this.clearCallConnectTimer();
            this.callState = "connected";

            //add self to the call participants
            this.conference.participants.set(this.localParticipant.participantId, this.localParticipant);
            console.log(`add self to conference.participants ${this.conference.participants.size}`);

            if (this.conference.presenterId === this.localParticipant.participantId) {
                this.conference.setPresenter(this.localParticipant);
            }

            let msg = {
                type: EventTypes.conferenceJoined,
                data: {
                    conferenceId: this.conference.conferenceId
                }
            }
            await this.onEvent(EventTypes.conferenceJoined, msg);

        };

        this.roomsClient.eventRoomTransportsCreated = async () => {
            console.log(`eventRoomTransportsCreated`);
            if (this.conference.joinParams.joinMediaConfig) {
                await this.getNewTracksForLocalParticipant(this.conference.joinParams.joinMediaConfig);
                this.publishTracks(this.localParticipant.stream.getTracks(), "eventRoomTransportsCreated");
            } else {
                console.log(`no joinMediaConfig`);
            }
        };

        this.roomsClient.eventOnRoomClosed = async (roomId: string) => {
            console.log("onRoomClosedEvent roomId:", roomId);

            //leave the conference
            this.leave();

            this.clearCallConnectTimer();
            this.callState = "disconnected";

            this.disconnectRoomsClient("onRoomClosedEvent");

            let msg = {
                type: EventTypes.conferenceClosed,
                data: {
                    conferenceId: this.conference.conferenceId,
                    reason: "room closed"
                }
            };
            await this.onEvent(EventTypes.conferenceClosed, msg);

            this.resetConferenceRoom();
            this.resetLocalTracks();
        };

        this.roomsClient.eventOnRoomPeerJoined = async (roomId: string, peer: Peer) => {
            console.log(`onRoomPeerJoinedEvent roomId: ${roomId} ${peer.peerId} ${peer.displayName} `, peer);

            //the peer.trackingId is the participantId
            let participant = this.conference.participants.get(peer.trackingId);
            if (participant) {
                console.error(`participant already in local conference: ${peer.trackingId} ${participant.displayName}`);
                return;
            }

            if (!peer.tracksInfo) {
                console.error(`peer tracksInfo is required.`);
                return;
            }

            //create a new participant and add it to the conference
            participant = new Participant();
            participant.displayName = peer.displayName;
            participant.participantId = peer.trackingId;
            participant.peerId = peer.peerId;
            participant.tracksInfo = peer.tracksInfo;

            this.conference.participants.set(participant.participantId, participant);
            console.log(`adding new participant to the room: ${participant.displayName}, ${this.conference.participants.size}`);

            if (this.conference.presenterId === participant.participantId) {
                this.conference.setPresenter(participant);
            }

            let msg = {
                type: EventTypes.participantJoined,
                data: {
                    participantId: participant.participantId,
                    displayName: participant.displayName,
                    conferenceId: this.conference.conferenceId,
                    peerId: peer.peerId,
                    roomId: roomId
                }
            }
            await this.onEvent(EventTypes.participantJoined, msg);
        };

        this.roomsClient.eventOnPeerNewTrack = async (peer: IPeer, track: MediaStreamTrack) => {
            console.warn(`onPeerNewTrackEvent peerId: ${peer.displayName} ${peer.peerId}, ${peer.trackingId}`);

            let participant = this.conference.participants.get(peer.trackingId);
            if (!participant) {
                console.error(`participant not found. ${peer.displayName} ${peer.trackingId}`, participant, this.conference.participants);
                return;
            }
            console.warn(`add track for ${participant.displayName} of type ${track.kind} `);

            //remove the track is exists
            let existingTrack = participant.stream.getTracks().find(t => t.kind === track.kind);
            if (existingTrack) {
                console.warn(`existing track removed ${existingTrack.id}`);
                participant.stream.removeTrack(existingTrack);
            }
            participant.stream.addTrack(track);
            console.warn(`total tracks for ${participant.displayName}`, participant.stream.getTracks());

            let msg = new EventParticpantNewTrackMsg();
            msg.data.participantId = participant.participantId;
            msg.data.participant = participant;
            msg.data.track = track;
            await this.onEvent(EventTypes.participantNewTrack, msg);

        };

        this.roomsClient.eventOnRoomPeerLeft = async (roomId: string, peer: IPeer) => {
            console.log("eventOnRoomPeerLeft roomId:", roomId);

            let participant = this.conference.participants.get(peer.trackingId);
            if (!participant) {
                console.error(`participant not found. ${peer.trackingId} ${peer.displayName}`, participant, this.conference.participants);
                return;
            }

            this.conference.participants.delete(participant.participantId);
            if (this.conference.presenter == participant) {
                this.conference.setPresenter(null);
            }

            let msg = {
                type: EventTypes.participantLeft,
                data: {
                    conferenceId: this.conference.conferenceId,
                    participantId: participant.participantId
                }
            }
            await this.onEvent(EventTypes.participantLeft, msg);

        };

        this.roomsClient.eventOnPeerTrackInfoUpdated = async (peer: IPeer) => {
            console.log(`eventOnPeerTrackInfoUpdated peerId: ${peer.peerId} trackingId: ${peer.trackingId} displayName: ${peer.displayName}`);
            console.log(`participants:`, this.conference.participants);

            let participant: Participant;
            if (this.localParticipant.participantId === peer.trackingId) {
                participant = this.localParticipant;
            } else {
                participant = this.conference.participants.get(peer.trackingId);
            }

            if (!participant) {
                console.error(`participant not found. ${peer.trackingId} ${peer.displayName}`, participant, this.conference.participants);
                return;
            }

            participant.tracksInfo = peer.tracksInfo;
            console.log(`participant tracksInfo updated:`, participant.tracksInfo);

            let msg = {
                type: EventTypes.participantTrackInfoUpdated,
                data: {
                    participantId: participant.participantId,
                    tracksInfo: participant.tracksInfo
                }
            }
            await this.onEvent(EventTypes.participantTrackInfoUpdated, msg);
        };

        this.roomsClient.eventOnRoomPing = async (roomId: string) => {
            //send this to the UI
            if (!this.isInConference()) {
                console.error(`not in conference`);
                return;
            }

            if (this.conference.roomId !== roomId) {
                console.error(`not in the same room`);
                return;
            }

            let msg = {
                type: EventTypes.conferencePing,
                data: {
                    conferenceId: this.conference.conferenceId
                }
            }
            await this.onEvent(EventTypes.conferencePing, msg);

        };

        await this.roomsClient.inititalize({ rtp_capabilities: roomRtpCapabilities });

        return true;
    }

    private disconnectRoomsClient(reason: string, inSeconds: number = 0) {
        console.log(`disconnectRoomsClient in ${inSeconds} seconds ${reason}`);

        if (this.roomsClientDisconnectTimerId) {
            console.log(`clear roomsClientDisconnectTimer ${this.roomsClientDisconnectTimerId}`);
            clearTimeout(this.roomsClientDisconnectTimerId);
            this.roomsClientDisconnectTimerId = null;
        }
        const _destroy = () => {
            if (this.roomsClient) {
                this.roomsClientDisconnectTimerId = null;
                this.roomsClient.roomLeave();
                this.roomsClient.disconnect();
                this.roomsClient.dispose();
                this.roomsClient = null;
            }
        };

        if (inSeconds <= 0) {
            console.log(`disconnectRoomsClient immediately ${reason}`);
            _destroy();
            return;
        }

        this.roomsClientDisconnectTimerId = setTimeout(() => {
            console.log(`disconnectRoomsClient timeout ${reason}`);
            _destroy();
        }, inSeconds * 1000);
    }

}
