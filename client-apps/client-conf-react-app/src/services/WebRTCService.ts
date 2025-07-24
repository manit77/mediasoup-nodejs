import { Conference, ConferenceClient, EventTypes, Participant } from '@conf/conf-client';
import { SelectedDevices, User } from '../types';
import { AcceptResultMsg, ConferenceClosedMsg, ConferenceRoomInfo, CreateConferenceParams, CreateConfResultMsg, GetConferencesResultMsg, InviteMsg, InviteResultMsg, JoinConferenceParams, JoinConfResultMsg, ParticipantInfo } from '@conf/conf-models';
import { ConferenceClientConfig } from '@conf/conf-client/src/models';

class WebRTCService {

    config: ConferenceClientConfig;
    confClient: ConferenceClient;
    participantsOnline: ParticipantInfo[] = [];
    conferencesOnline: ConferenceRoomInfo[] = [];
    localUser: User;
    registerAttempts = 0;
    maxRegisterAttempts = 3;


    init(config: ConferenceClientConfig) {
        console.log(`WebRTCService: *** new WebRTCService initialized.`, config);
        this.config = config;
        this.confClient =  new ConferenceClient(this.config);
    }

    get localStream(): MediaStream | null {
        return this.confClient?.localParticipant?.stream;
    }

    get isConnected() {
        return this.confClient?.isConnected ?? false;
    }

    get inviteSendMsg(): InviteMsg | null {
        return this.confClient?.inviteSendMsg;
    }

    get inviteRecievedMsg(): InviteMsg | null {
        return this.confClient?.inviteReceivedMsg;
    }

    get localParticipant(): Participant {
        return this.confClient?.localParticipant;
    }

    get conference(): Conference {
        return this.confClient?.conference;
    }

    get participants(): Map<string, Participant> {
        return this.confClient?.conference.participants;
    }

    isScreenSharing = false;

    selectedDevices: SelectedDevices = new SelectedDevices();

    public onServerConnected: () => Promise<void> = async () => { };
    public onServerDisconnected: () => Promise<void> = async () => { };
    public onRegistered: (participantId: string) => Promise<void> = async () => { };
    public onRegisterFailed: (error: string) => Promise<void> = async () => { };
    public onLoggedOff: (reason: string) => Promise<void> = async () => { };
    public onParticipantsReceived: (participants: ParticipantInfo[]) => Promise<void> = async () => { };
    public onConferencesReceived: (conferences: ConferenceRoomInfo[]) => Promise<void> = async () => { };
    public onInviteReceived: (msg: InviteMsg) => Promise<void> = async () => { };
    public onConferenceJoined: (conferenceId: string) => Promise<void> = async () => { };
    public onConferenceEnded: (conferenceId: string, reason: string) => Promise<void> = async () => { };
    public onParticipantTrack: (participantId: string, track: MediaStreamTrack) => Promise<void> = async () => { };
    public onParticipantTrackInfoUpdated: (participantId: string) => Promise<void> = async () => { };
    public onParticipantJoined: (participantId: string, displayName: string) => Promise<void> = async () => { };
    public onParticipantLeft: (participantId: string) => Promise<void> = async () => { };

    public dispose() {
        console.log("WebRTCService: dispose");
        this.onServerConnected = null;
        this.onServerDisconnected = null;
        this.onRegistered = null;
        this.onRegisterFailed = null;
        this.onParticipantsReceived = null;
        this.onConferencesReceived = null;
        this.onInviteReceived = null;
        this.onConferenceJoined = null;
        this.onConferenceEnded = null;
        this.onParticipantTrack = null;
        this.onParticipantTrackInfoUpdated = null;
        this.onParticipantJoined = null;
        this.onParticipantLeft = null;

        this.removeTracks();

        if (this.confClient) {
            this.confClient.dispose();
        }
    }

    public connectSignaling(user: User): void {
        console.log("WebRTCService: connectSignaling.");
        this.localUser = user;

        if (!user.authToken || !user.username) {
            console.error("authtoken and username is required.", user);
            return;
        }

        if (!this.confClient) {
            console.error(`conference client not initialized.`);
            this.confClient = new ConferenceClient(this.config);
        }

        this.confClient.connect();

        this.confClient.onEvent = async (eventType: EventTypes, payload?: any) => {
            console.log("** onEvent", eventType, payload);

            switch (eventType) {
                case EventTypes.connected: {
                    this.registerConnection(user);
                    this.eventSignalingConnected();
                    break;
                }
                case EventTypes.disconnected: {
                    await this.eventSignalingDisconnected();
                    break;
                }
                case EventTypes.registerResult: {
                    await this.eventRegisterResult(payload);
                    break;
                }
                case EventTypes.participantsReceived: {
                    await this.eventParticipantsReceived(payload);
                    break;
                }
                case EventTypes.conferencesReceived: {
                    await this.eventConferencesReceived(payload);
                    break;
                }
                case EventTypes.inviteReceived: {
                    await this.eventInviteReceived(payload);
                    break;
                }
                case EventTypes.rejectReceived: {
                    await this.eventRejectReceived(payload);
                    break;
                }
                case EventTypes.inviteResult: {
                    await this.eventInviteResult(payload);
                    break;
                }
                case EventTypes.inviteCancelled: {
                    await this.eventInviteCancelled(payload);
                    break;
                }
                case EventTypes.acceptResult: {
                    await this.eventAcceptResult(payload);
                    break;
                }
                case EventTypes.conferenceCreatedResult: {
                    await this.eventConferenceCreatedResult(payload);
                    break;
                }
                case EventTypes.conferenceJoined: {
                    await this.eventConferenceJoined(payload);
                    break;
                }
                case EventTypes.conferenceFailed: {
                    await this.eventConferenceFailed(payload);
                    break;
                }
                case EventTypes.conferenceClosed: {
                    await this.eventConferenceClosed(payload);
                    break;
                }
                case EventTypes.participantJoined: {
                    await this.eventParticipantJoined(payload);
                    break;
                }
                case EventTypes.participantLeft: {
                    await this.eventParticipantLeft(payload);
                    break;
                }
                case EventTypes.participantNewTrack: {
                    await this.eventParticipantNewTrack(payload);
                    break;
                }
                case EventTypes.participantTrackInfoUpdated: {
                    await this.eventParticipantTrackInfoUpdated(payload);
                    break;
                }
                default: {
                    console.error("WebRTCService: Unknown event type:", eventType);
                    break;
                }
            }

        };
    }

    public async registerConnection(user: User) {
        console.log(`register registerAttempts: ${this.registerAttempts}`);
        this.registerAttempts++;
        if (this.registerAttempts > this.maxRegisterAttempts) {
            console.error('max register attempts reached.');
            this.registerAttempts = 0;
            this.disconnectSignaling("max register attempts reached");
            this.onServerDisconnected();
            this.onLoggedOff("max register attempts reached.");
            return;
        }

        if (!user) {
            console.error("no user provided");
            await this.onRegisterFailed("user is required to register connection");
            return;
        }

        this.localUser = user;

        if (!user.authToken || !user.username) {
            console.error("authtoken and username is required.", user);
            await this.onRegisterFailed("username is required to register a connection");
            return;
        }
        try {
            await this.confClient.waitRegisterConnection(user.username, user.authToken);
        } catch (err) {
            console.error(err);
            await this.onRegisterFailed("failed to register connection");
        }
    }

    public disconnectSignaling(reason: string): void {
        console.log(`disconnectSignaling ${reason}`);
        this.localUser = null;
        this.registerAttempts = 0;
        this.confClient?.disconnect();
        //this.confClient = null;
    }

    public getParticipantsOnline() {
        if (this.confClient) {
            this.confClient.getParticipantsOnline();
        }
    }

    public getConferenceRoomsOnline() {
        if (this.confClient) {
            this.confClient.getConferenceRoomsOnline();
        }
    }

    public async getNewTracksForLocalParticipant(constraints?: MediaStreamConstraints) {
        return this.confClient.getNewTracksForLocalParticipant(constraints);
    }

    async publishTracks(tracks: MediaStreamTrack[]) {
        console.log("publishTracks tracks:", tracks);

        if (!this.confClient.isInConference()) {
            console.info(`cannot publish tracks, not in a conference.`);
            return;
        }

        let kinds = tracks.map(t => t.kind);

        let tracksToRemove = this.localStream?.getTracks().filter(t => kinds.includes(t.kind));
        tracksToRemove.forEach(t => {
            this.localStream?.removeTrack(t);
        });

        this.confClient.unPublishTracks(tracksToRemove);
        this.confClient.publishTracks(tracks);

        tracks.forEach(track => {
            this.localStream?.addTrack(track);
        });

        console.log("localStream tracks after publish:", this.localStream?.getTracks());
    }

    public async unPublishTracks(tracks: MediaStreamTrack[]) {
        console.log("unPublishTracks");
        this.confClient.unPublishTracks(tracks);
    }

    public async getScreenTrack(): Promise<MediaStreamTrack | null> {
        console.log("getScreenShareTrack");
        return (await this.confClient.getDisplayMedia()).getVideoTracks()[0] || null;
    }

    public removeTracks() {
        console.log("removeTracks");
        this.localStream?.getTracks().forEach(track => {
            console.log("removing track", track.kind);
            track.stop();
            this.localStream?.removeTrack(track);
        });
    }

    public muteParticipantTrack(participantId: string, audioEnabled: boolean, videoEnabled: boolean) {
        this.confClient?.muteParticipantTrack(participantId, audioEnabled, videoEnabled);
    }

    public broadCastTrackInfo() {
        console.log(`broadCastTrackInfo`);
        this.confClient?.broadCastTrackInfo();

    }

    public isOnCall() {
        return this.confClient?.isInConference();
    }

    public getConferenceRoom() {
        return this.confClient?.conference;
    }

    public createConferenceRoom(createArgs: CreateConferenceParams) {
        this.confClient.createConferenceRoom(createArgs);
    }

    public async createConferenceAndJoin(createArgs: CreateConferenceParams, joinArgs: JoinConferenceParams): Promise<boolean> {
        console.log("createConferenceAndJoin", createArgs, joinArgs);

        if (!createArgs.externalId) {
            console.error("createArgs externalId is required.");
            return false;
        }

        if (!joinArgs.externalId) {
            console.error("joinArgs externalId is required.");
            return false;
        }

        try {
            let newResult = await this.confClient.waitCreateConferenceRoom(createArgs);
            if (newResult.data.error) {
                console.error(newResult.data.error);
                return false;
            }

            joinArgs.conferenceId = newResult.data.conferenceId;

            let joinResult = await this.confClient.waitJoinConferenceRoom(joinArgs);
            if (joinResult.data.error) {
                console.error(joinResult.data.error);
                return false;
            }

            console.log("join conference, waiting for room ready message");

        } catch (err) {
            console.error(err);
            return false;
        }
    }

    public async joinConferenceRoom(joinArgs: JoinConferenceParams) {      
        let joinResult = await this.confClient.waitJoinConferenceRoom(joinArgs);
        if (joinResult.data.error) {
            console.error(joinResult.data.error);
            return false;
        }

        console.log("join conference, waiting for room ready message");
        return true;
    }

    /**
     * calls a participant that is online
     * @param participantId 
     */
    public async sendInvite(participantId: string, args: JoinConferenceParams): Promise<InviteMsg> {
        console.log(`sendInvite ${participantId}`, args);
        return this.confClient.sendInvite(participantId, args);
    }

    /**
     * accepts an invite
     */
    public async acceptInvite(args: JoinConferenceParams): Promise<boolean> {
        console.log(`acceptInvite:`, this.inviteRecievedMsg);

        return this.confClient.acceptInvite(this.inviteRecievedMsg, args);
    }

    public declineInvite(): void {
        this.confClient.rejectInvite(this.inviteRecievedMsg);
    }

    public endCall(): void {
        console.log("** endCall()");

        if (this.inviteSendMsg) {
            this.confClient.cancelInvite(this.inviteSendMsg);
        }

        if (this.inviteRecievedMsg) {
            this.confClient.rejectInvite(this.inviteRecievedMsg);
        }

        this.confClient.leave();
        this.removeTracks();
    }

    private async eventSignalingConnected() {
        console.log("eventSignalingConnected");
        await this.onServerConnected();
    }

    private async eventSignalingDisconnected() {
        console.log("eventSignalingDisconnected");
        await this.onServerDisconnected();

    }

    private async eventRegisterResult(msg: any) {
        console.log("eventRegisterResult", msg);

        if (msg.data.error) {
            await this.onRegisterFailed(msg.data.error);
        } else {
            await this.onRegistered(msg.data.participantId);
            this.getConferenceRoomsOnline();
        }
    }

    private async eventParticipantsReceived(msg: any) {
        console.log("eventParticipantsReceived", msg);

        this.participantsOnline = (msg.data as ParticipantInfo[]).filter(c => c.participantId !== this.confClient.localParticipant.participantId)
        await this.onParticipantsReceived(this.participantsOnline);
    }

    private async eventConferencesReceived(msg: GetConferencesResultMsg) {
        console.log("eventConferencesReceived", msg);

        this.conferencesOnline = msg.data.conferences;
        await this.onConferencesReceived(this.conferencesOnline);
    }

    private async eventInviteReceived(msg: InviteMsg) {
        console.log("eventInviteReceived", msg);
        await this.onInviteReceived(msg);
    }

    private async eventInviteResult(msg: InviteResultMsg) {
        console.log("eventInviteResult", msg);

        if (msg.data.error) {
            console.error("eventInviteResult failed", msg.data.error);
            await this.onConferenceEnded(msg.data.conferenceId, msg.data.error);
            this.removeTracks();
            return;
        }

    }

    private async eventInviteCancelled(msg: any) {
        console.log("eventInviteCancelled", msg);

        await this.onConferenceEnded(msg.data.conferenceId, "call cancelled");
        this.removeTracks();
    }

    private async eventAcceptResult(msg: AcceptResultMsg) {
        console.log("eventAcceptResult", msg);

        if (msg.data.error) {
            console.error(msg.data.error);
            await this.onConferenceEnded(msg.data.conferenceId, "accept failed.");
            this.removeTracks();
        }
    }

    private async eventRejectReceived(msg: any) {
        console.log("eventRejectReceived", msg);

        await this.onConferenceEnded(msg.data.conferenceId, "call rejected");
        this.removeTracks();
    }

    private async eventConferenceCreatedResult(msg: CreateConfResultMsg) {
        console.log("eventConferenceCreatedResult", msg);

        if (msg.data.error) {
            console.error("failed to create conference.");
            await this.onConferenceEnded(msg.data.externalId, "failed to create conference");
            this.removeTracks();
            return;
        }
    }

    private async eventConferenceJoined(msg: JoinConfResultMsg) {
        console.log("eventConferenceJoined, try to publishTracks", msg);
        if (this.localStream) {
            this.confClient.publishTracks(this.localStream.getTracks());
        }
        await this.onConferenceJoined(msg.data.conferenceId);
    }

    private async eventConferenceFailed(msg: any) {
        console.log("eventConferenceFailed", msg);
        await this.onConferenceEnded(msg.data.conferenceId, msg.data.error || "conference failed.");
        this.removeTracks();
    }

    private async eventConferenceClosed(msg: ConferenceClosedMsg) {
        console.log("eventConferenceClosed", msg);

        await this.onConferenceEnded(msg.data.conferenceId, msg.data.reason ?? "call ended.");
        this.removeTracks();
    }

    private async eventParticipantJoined(msg: any) {
        console.log("eventParticipantJoined", msg);

        await this.onParticipantJoined(msg.data.participantId, msg.data.displayName);
    }

    private async eventParticipantLeft(msg: any) {
        console.log("eventParticipantLeft", msg.data);

        await this.onParticipantLeft(msg.data.participantId);
    }

    private async eventParticipantNewTrack(msg: any) {
        console.log("eventParticipantNewTrack", msg.data);

        await this.onParticipantTrack(msg.data.participantId, msg.data.track)
    }

    private async eventParticipantTrackInfoUpdated(msg: any) {
        console.log("eventParticipanTrackInfoUpdated", msg.data);

        await this.onParticipantTrackInfoUpdated(msg.data.participantId)
    }

}

export const webRTCService = new WebRTCService(); // Singleton instance