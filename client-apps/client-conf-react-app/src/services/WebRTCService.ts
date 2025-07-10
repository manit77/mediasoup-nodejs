import { ConferenceClient, EventTypes } from '@conf/conf-client';
import { User } from '../types';
import { AcceptResultMsg, ConferenceClosedMsg, ConferenceRoomInfo, CreateConfResultMsg, InviteMsg, InviteResultMsg, JoinConfResultMsg, ParticipantInfo } from '@conf/conf-models';

const confServerURI = 'https://localhost:3100'; // conference

class WebRTCService {
    /**
     * local MediaStream is managed here, no other streams will be used for presentation
     */
    localStream: MediaStream = new MediaStream();
    confClient: ConferenceClient;
    participants: ParticipantInfo[] = [];
    conferences: ConferenceRoomInfo[] = [];
    inviteMsg: InviteMsg;

    public onServerConnected: () => Promise<void> = async () => { };
    public onServerDisconnected: () => Promise<void> = async () => { };
    public onRegistered: (participantId: string) => Promise<void> = async () => { };
    public onRegisterFailed: (error: string) => Promise<void> = async () => { };
    public onParticipantsReceived: (participants: ParticipantInfo[]) => Promise<void> = async () => { };
    public onConferencesReceived: (conferences: ConferenceRoomInfo[]) => Promise<void> = async () => { };
    public onInviteReceived: (participantId: string, displayName: string) => Promise<void> = async () => { };
    public onConferenceJoined: (conferenceId: string) => Promise<void> = async () => { };
    public onConferenceEnded: (conferenceId: string, reason: string) => Promise<void> = async () => { };
    public onParticipantTrack: (participantId: string, track: MediaStreamTrack) => Promise<void> = async () => { };
    public onParticipantTrackToggled: (participantId: string, track: MediaStreamTrack) => Promise<void> = async () => { };
    public onParticipantJoined: (participantId: string, displayName: string) => Promise<void> = async () => { };
    public onParticipantLeft: (participantId: string) => Promise<void> = async () => { };

    public dispose() {
        console.log("dispose");
        this.onServerConnected = null;
        this.onServerDisconnected = null;
        this.onRegistered = null;
        this.onRegisterFailed = null;
        this.onParticipantsReceived = null;
        this.onConferencesReceived = null;
        //this.onLocalStreamReady = null;
        this.onInviteReceived = null;
        //this.onConferenceCreated = null;
        this.onConferenceJoined = null;
        this.onConferenceEnded = null;
        this.onParticipantTrack = null;
        this.onParticipantJoined = null;
        this.onParticipantLeft = null;

    }

    public connectSignaling(user: User): void {
        console.log("connectSignaling");
        if (this.confClient) {
            console.log("already connecting to ConferenceCallManager");
            return;
        }

        this.confClient = new ConferenceClient();
        this.confClient.connect(true, confServerURI);

        this.confClient.onEvent = async (eventType: EventTypes, payload?: any) => {
            console.log("** onEvent", eventType, payload);

            switch (eventType) {
                case EventTypes.connected: {
                    this.confClient.register(user.displayName);
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
                case EventTypes.participantTrackToggled: {
                    await this.eventParticipantTrackToggled(payload);
                    break;
                }
                default: {
                    console.warn("Unknown event type:", eventType);
                    break;
                }
            }

        };
    }

    public getParticipantsOnline() {
        if (this.confClient) {
            this.confClient.getParticipantsOnline();
        }
    }

    public getConferenceRooms() {
        if (this.confClient) {
            this.confClient.getConferenceRooms();
        }
    }

    public async getNewTracks(constraints?: MediaStreamConstraints) {
        console.log(`getNewTracks constraints:`, constraints);
        let stream = await this.confClient.getUserMedia(constraints);
        this.publishTracks(stream.getTracks());
        return stream.getTracks();
    }

    public async publishTracks(tracks: MediaStreamTrack[]) {
        console.log("publishTracks tracks:", tracks);

        let kinds = tracks.map(t => t.kind);

        let tracksToRemove = this.localStream.getTracks().filter(t => kinds.includes(t.kind));
        tracksToRemove.forEach(t => {
            this.localStream.removeTrack(t);
        });

        this.confClient.unPublishTracks(tracksToRemove);
        this.confClient.publishTracks(tracks);

        tracks.forEach(track => {
            this.localStream.addTrack(track);
        });

        console.log("localStream tracks after publish:", this.localStream.getTracks());
    }

    public async unPublishTracks(tracks: MediaStreamTrack[]) {
        console.log("unPublishTracks");

        tracks.forEach(track => {
            this.localStream.removeTrack(track);
        });
        this.confClient.unPublishTracks(tracks);
    }

    public toggleTrack(enabled: boolean, track: MediaStreamTrack) {
        track.enabled = enabled;
    }

    public async getScreenTrack(): Promise<MediaStreamTrack | null> {
        console.log("getScreenShareTrack");
        return (await this.confClient.getDisplayMedia()).getVideoTracks()[0] || null;
    }

    public removeTracks() {
        console.warn("removeTracks");
        this.localStream.getTracks().forEach(track => {
            console.log("removing track", track.kind);
            track.stop();
            this.localStream.removeTrack(track);
        });
    }

    public updateTrackEnabled(participantId: string) {
        console.log(`updateTracksStatus participantId: ${participantId}`);
        if(this.confClient) {
            this.confClient.updateTrackEnabled(participantId);
        }
    }

    public isOnCall() {
        return this.confClient && this.confClient.isInConference();
    }

    public createConferenceRoom(trackingId: string, roomName: string) {
        this.confClient.createConferenceRoom(trackingId, roomName);
    }

    public joinConferenceRoom(conferenceRoomId: string) {
        this.confClient.joinConferenceRoom(conferenceRoomId);
    }

    /**
     * calls a participant that is online
     * @param participantId 
     */
    public async sendInvite(participantId: string): Promise<void> {
        this.inviteMsg = this.confClient.invite(participantId);
    }

    /**
     * accepts an invite
     */
    public async acceptInvite(): Promise<void> {
        this.confClient.acceptInvite(this.inviteMsg);
        this.inviteMsg = null;
    }

    public declineInvite(): void {
        this.confClient.rejectInvite(this.inviteMsg);
        this.inviteMsg = null;
    }

    public endCall(): void {
        console.log("** endCall()");
        if (this.inviteMsg) {
            this.confClient.cancelInvite(this.inviteMsg);
            this.inviteMsg = null;
        }

        this.confClient.leave();
        this.removeTracks();

    }

    public disconnectSignaling(): void {
        console.log("disconnectSignaling");
        this.confClient.disconnect();
        this.confClient = null;
    }

    private async eventSignalingDisconnected() {
        console.log("eventSignalingDisconnected");
        if (this.onServerDisconnected) {
            await this.onServerDisconnected();
        }
    }

    private async eventRegisterResult(msg: any) {
        console.log("eventRegisterResult", msg);
        if (msg.data.error) {
            await this.onRegisterFailed(msg.data.error);
        } else {
            await this.onRegistered(msg.data.participantId);
            this.getConferenceRooms();
        }
    }

    private async eventParticipantsReceived(msg: any) {
        console.log("eventParticipantsReceived", msg);
        this.participants = (msg.data as ParticipantInfo[]).filter(c => c.participantId !== this.confClient.participantId)
        await this.onParticipantsReceived(this.participants);
    }

    private async eventConferencesReceived(msg: any) {
        console.log("eventConferencesReceived", msg);
        this.conferences = msg.data;
        await this.onConferencesReceived(this.conferences);
    }

    private async eventInviteReceived(msg: any) {
        console.log("eventInviteReceived", msg);
        this.inviteMsg = msg;
        await this.onInviteReceived(msg.data.participantId, msg.data.displayName);
    }

    private async eventInviteResult(msg: InviteResultMsg) {
        console.log("eventInviteResult", msg);
        if (msg.data.error) {
            console.error("eventInviteResult failed", msg.data.error);
            await this.onConferenceEnded(msg.data.conferenceRoomId, msg.data.error);
            this.removeTracks();
            this.inviteMsg = null;
            return;
        }

        if (this.inviteMsg) {
            this.inviteMsg.data.conferenceRoomId = msg.data.conferenceRoomId;
        }
    }

    private async eventInviteCancelled(msg: any) {
        console.log("eventInviteCancelled", msg);
        await this.onConferenceEnded(msg.data.conferenceRoomId, "call cancelled");
        this.removeTracks();
        this.inviteMsg = null;
    }

    private async eventAcceptResult(msg: AcceptResultMsg) {
        console.log("eventAcceptResult", msg);
        if (msg.data.error) {
            console.error(msg.data.error);
            await this.onConferenceEnded(msg.data.conferenceRoomId, "accept failed.");
            this.removeTracks();
        } else {
            await this.onConferenceJoined(msg.data.conferenceRoomId);
        }
    }

    private async eventRejectReceived(msg: any) {
        console.log("eventRejectReceived", msg);
        await this.onConferenceEnded(msg.data.conferenceRoomId, "call rejected");
        this.removeTracks();
        this.inviteMsg = null;
    }

    private async eventConferenceCreatedResult(msg: CreateConfResultMsg) {
        console.log("eventConferenceCreatedResult", msg);
        if (msg.data.error) {
            console.error("failed to create conference.");
            await this.onConferenceEnded(msg.data.trackingId, "failed to create conference");
            this.removeTracks();
            return;
        }
        //this.onConferenceCreated(msg.data.conferenceRoomId, msg.data.trackingId);
        this.joinConferenceRoom(msg.data.conferenceRoomId);
    }

    private async eventConferenceJoined(msg: JoinConfResultMsg) {
        console.log("eventConferenceJoined", msg);
        if (this.localStream) {
            this.confClient.publishTracks(this.localStream.getTracks());
        }
        this.inviteMsg = null;
        await this.onConferenceJoined(msg.data.conferenceRoomId);
    }

    private async eventConferenceFailed(msg: any) {
        console.log("eventConferenceFailed", msg);
        await this.onConferenceEnded(msg.data.conferenceRoomId, "system error");
        this.removeTracks();
        this.inviteMsg = null;
    }

    private async eventConferenceClosed(msg: ConferenceClosedMsg) {
        console.log("eventConferenceClosed", msg);
        await this.onConferenceEnded(msg.data.conferenceRoomId, msg.data.reason ?? "call ended.");
        this.removeTracks();
        this.inviteMsg = null;
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

    private async eventParticipantTrackToggled(msg: any) {
        console.log("eventParticipantTrackToggled", msg.data);
        await this.onParticipantTrackToggled(msg.data.participantId, msg.data.track)
    }
    
}

export const webRTCService = new WebRTCService(); // Singleton instance