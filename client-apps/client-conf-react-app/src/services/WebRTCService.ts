import { Conference, ConferenceClient, EventTypes, Participant } from '@conf/conf-client';
import { SelectedDevices, User } from '../types';
import { AcceptResultMsg, ConferenceClosedMsg, ConferenceRoomInfo, CreateConfResultMsg, InviteMsg, InviteResultMsg, JoinConfResultMsg, ParticipantInfo } from '@conf/conf-models';

const confServerURI = 'https://localhost:3100'; // conference

class WebRTCService {

    get localStream(): MediaStream {
        return this.confClient.localParticipant.stream;
    }

    confClient: ConferenceClient;
    participantsOnline: ParticipantInfo[] = [];
    conferencesOnline: ConferenceRoomInfo[] = [];

    get isConnected() {
        return this.confClient.isConnected;
    }

    get inviteSendMsg(): InviteMsg | null {
        return this.confClient.inviteSendMsg;
    }

    get inviteRecievedMsg(): InviteMsg | null {
        return this.confClient.inviteReceivedMsg;
    }

    get localParticipant(): Participant {
        return this.confClient.localParticipant;
    }

    get conferenceRoom(): Conference {
        return this.confClient.conferenceRoom;
    }

    get participants(): Map<string, Participant> {
        return this.confClient.conferenceRoom.participants;
    }

    isScreenSharing = false;

    selectedDevices: SelectedDevices = new SelectedDevices();

    constructor() {
        this.confClient = new ConferenceClient();
    }
    public onServerConnected: () => Promise<void> = async () => { };
    public onServerDisconnected: () => Promise<void> = async () => { };
    public onRegistered: (participantId: string) => Promise<void> = async () => { };
    public onRegisterFailed: (error: string) => Promise<void> = async () => { };
    public onParticipantsReceived: (participants: ParticipantInfo[]) => Promise<void> = async () => { };
    public onConferencesReceived: (conferences: ConferenceRoomInfo[]) => Promise<void> = async () => { };
    public onInviteReceived: (msg: InviteMsg) => Promise<void> = async () => { };
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
        this.onInviteReceived = null;
        this.onConferenceJoined = null;
        this.onConferenceEnded = null;
        this.onParticipantTrack = null;
        this.onParticipantJoined = null;
        this.onParticipantLeft = null;

        this.removeTracks();
        if (this.confClient) {
            this.confClient.onEvent = null;
            this.confClient.disconnect();
            this.confClient = null;
        }
    }

    public connectSignaling(user: User): void {
        console.log("connectSignaling");

        this.confClient.connect(confServerURI);

        this.confClient.onEvent = async (eventType: EventTypes, payload?: any) => {
            console.log("** onEvent", eventType, payload);

            switch (eventType) {
                case EventTypes.connected: {
                    this.confClient.register(user.displayName);
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
                case EventTypes.participantTrackToggled: {
                    await this.eventParticipantTrackToggled(payload);
                    break;
                }
                default: {
                    console.log("Unknown event type:", eventType);
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

    public getConferenceRoomsOnline() {
        if (this.confClient) {
            this.confClient.getConferenceRoomsOnline();
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
        console.log("removeTracks");
        this.localStream.getTracks().forEach(track => {
            console.log("removing track", track.kind);
            track.stop();
            this.localStream.removeTrack(track);
        });
    }

    public updateTrackEnabled(participantId: string) {
        console.log(`updateTracksStatus participantId: ${participantId}`);
        console.log(`localStream tracks:`, this.localStream.getTracks());

        if (this.confClient) {
            this.confClient.updateTrackEnabled(participantId);
        }
    }

    public isOnCall() {
        return this.confClient && this.confClient.isInConference();
    }

    public getConferenceRoom() {
        return this.confClient.conferenceRoom;
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
    public async sendInvite(participantId: string): Promise<InviteMsg> {
        console.log(`sendInvite ${participantId}`);
        return this.confClient.invite(participantId);
    }

    /**
     * accepts an invite
     */
    public async acceptInvite(): Promise<void> {
        console.log(`acceptInvite:`, this.inviteRecievedMsg);
        this.confClient.acceptInvite(this.inviteRecievedMsg);
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

    public disconnectSignaling(): void {
        console.log("disconnectSignaling");

        this.confClient.disconnect();
        this.confClient = null;
    }

    private async eventSignalingConnected() {
        console.log("eventSignalingDisconnected");
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

    private async eventConferencesReceived(msg: any) {
        console.log("eventConferencesReceived", msg);

        this.conferencesOnline = msg.data;
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
            await this.onConferenceEnded(msg.data.conferenceRoomId, msg.data.error);
            this.removeTracks();
            return;
        }

    }

    private async eventInviteCancelled(msg: any) {
        console.log("eventInviteCancelled", msg);

        await this.onConferenceEnded(msg.data.conferenceRoomId, "call cancelled");
        this.removeTracks();
    }

    private async eventAcceptResult(msg: AcceptResultMsg) {
        console.log("eventAcceptResult", msg);

        if (msg.data.error) {
            console.error(msg.data.error);
            await this.onConferenceEnded(msg.data.conferenceRoomId, "accept failed.");
            this.removeTracks();
        }
    }

    private async eventRejectReceived(msg: any) {
        console.log("eventRejectReceived", msg);

        await this.onConferenceEnded(msg.data.conferenceRoomId, "call rejected");
        this.removeTracks();
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
        await this.onConferenceJoined(msg.data.conferenceRoomId);
    }

    private async eventConferenceFailed(msg: any) {
        console.log("eventConferenceFailed", msg);
        await this.onConferenceEnded(msg.data.conferenceRoomId, msg.data.error || "conference failed.");
        this.removeTracks();
    }

    private async eventConferenceClosed(msg: ConferenceClosedMsg) {
        console.log("eventConferenceClosed", msg);

        await this.onConferenceEnded(msg.data.conferenceRoomId, msg.data.reason ?? "call ended.");
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

    private async eventParticipantTrackToggled(msg: any) {
        console.log("eventParticipantTrackToggled", msg.data);

        await this.onParticipantTrackToggled(msg.data.participantId, msg.data.track)
    }

}

export const webRTCService = new WebRTCService(); // Singleton instance