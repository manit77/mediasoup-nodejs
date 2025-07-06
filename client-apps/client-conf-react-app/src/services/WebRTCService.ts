import { ConferenceClient, EventTypes } from '@conf/conf-client';
import { User } from '../types';
import { Contact, CreateConfResultMsg, InviteMsg, InviteResultMsg } from '@conf/conf-models';
import { getUserMedia } from '@rooms/webrtc-client';

const confServerURI = 'https://localhost:3100'; // conference

class WebRTCService {
    localStream: MediaStream;
    confClient: ConferenceClient;
    contacts: Contact[] = [];
    inviteMsg: InviteMsg;

    public onServerConnected: (() => void) = () => { };
    public onServerDisconnected: (() => void) = () => { };

    public onRegistered: (participantId: string) => void = () => { };
    public onRegisterFailed: (error: string) => void = () => { };
    public onContactsReceived: (contacts: Contact[]) => void = () => { };

    public onLocalStreamReady: (stream: MediaStream) => void = () => { };

    public onInviteReceived: ((participantId: string, displayName: string) => void) = () => { };

    public onConferenceCreated: (conferenceId: string, trackingId: string) => void = () => { };
    public onConferenceJoined: () => void = () => { };
    public onConferenceEnded: (conferenceId: string, reason: string) => void = () => { };

    public onParticipantTrack: ((participantId: string, track: MediaStreamTrack) => void) | null = () => { };
    public onParticipantJoined: ((participantId: string, displayName: string) => void) | null = () => { };
    public onParticipantLeft: ((participantId: string) => void) | null = () => { };

    public dispose() {
        console.log("dispose");
        this.onServerConnected = null;
        this.onServerDisconnected = null;
        this.onRegistered = null;
        this.onRegisterFailed = null;
        this.onContactsReceived = null;
        this.onLocalStreamReady = null;
        this.onInviteReceived = null;
        this.onConferenceCreated = null;
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

        this.confClient.onEvent = (eventType: EventTypes, payload?: any) => {
            console.log("** onEvent", eventType, payload);

            switch (eventType) {
                case EventTypes.connected: {
                    this.confClient.register(user.displayName);
                    break;
                }
                case EventTypes.disconnected: {
                    this.eventSignalingDisconnected();
                    break;
                }
                case EventTypes.registerResult: {
                    this.eventRegisterResult(payload);
                    break;
                }
                case EventTypes.contactsReceived: {
                    this.eventContactsReceived(payload as Contact[]);
                    break;
                }
                case EventTypes.inviteReceived: {
                    this.eventInviteReceived(payload);
                    break;
                }
                case EventTypes.rejectReceived: {
                    this.eventRejectReceived(payload);
                    break;
                }
                case EventTypes.inviteResult: {
                    this.eventInviteResult(payload);
                    break;
                }
                case EventTypes.inviteCancelled: {
                    this.eventInviteCancelled(payload);
                    break;
                }
                case EventTypes.conferenceCreatedResult: {
                    this.eventConferenceCreatedResult(payload);
                    break;
                }             
                case EventTypes.conferenceJoined: {
                    this.eventConferenceJoined(payload);
                    break;
                }
                case EventTypes.conferenceFailed: {
                    this.eventConferenceFailed(payload);
                    break;
                }
                case EventTypes.conferenceClosed: {
                    this.eventConferenceClosed(payload);
                    break;
                }
                case EventTypes.participantJoined: {
                    this.eventParticipantJoined(payload);
                    break;
                }
                case EventTypes.participantLeft: {
                    this.eventParticipantLeft(payload);
                    break;
                }
                case EventTypes.participantNewTrack: {
                    this.eventParticipantNewTrack(payload);
                    break;
                }
            }

        };
    }

    public getContacts() {
        if (this.confClient) {
            this.confClient.getContacts();
        }
    }

    public async getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
        this.localStream = await getUserMedia(constraints);
        if (this.confClient) {
            this.confClient.publishTracks(this.localStream);
        }
        return this.localStream;
    }

    public async getNewStream(constraints?: MediaStreamConstraints): Promise<MediaStream> {
        return await getUserMedia(constraints);
    }

    public async replaceStream(newStream: MediaStream) {
        console.log(`replaceStream`);

        if (!this.confClient) {
            console.log("client not ready");
            return;
        }

        if (!this.localStream) {
            console.log("no localStream");
            return;
        }
        let existingTracks = this.confClient.getTracks();

        //remove all tracks by kind: video, and audio
        let tracksToRemove = new MediaStream();
        newStream.getTracks().forEach(newTrack => {
            let existingTrack = existingTracks.find(t => t.kind === newTrack.kind);
            if (existingTrack) {
                tracksToRemove.addTrack(existingTrack);
            }
        });

        this.confClient.unpublishTracks(tracksToRemove);

        this.confClient.publishTracks(newStream);
    }

    public isOnCall() {
        return this.confClient && this.confClient.isInConference();
    }

    public createConferenceRoom(trackingId: string) {
        this.confClient.createConferenceRoom(trackingId);
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
    }

    public toggleAudioMute(): boolean {
        //mute the track the local stream
        return true;
    }

    public toggleVideoMute(): boolean {
        return true;
    }

    public async startScreenShare(): Promise<MediaStream | null> {
        if (!this.confClient) {
            console.error(`conference not started`);
            return;
        }

        return await this.confClient.startScreenShare();
    }

    public stopScreenShare(screenStream: MediaStream | null): void {
        this.confClient.stopScreenShare(screenStream);
    }

    public disconnectSignaling(): void {
        console.log("disconnectSignaling");
        this.confClient.disconnect();
        this.confClient = null;
    }

    private eventSignalingDisconnected() {
        console.log("eventSignalingDisconnected");
        if (this.onServerDisconnected) {
            this.onServerDisconnected();
        }
    }

    private eventRegisterResult(msg: any) {
        console.log("eventRegisterResult", msg);
        if (msg.data.error) {
            this.onRegisterFailed(msg.data.error);
        } else {
            this.onRegistered(msg.data.participantId);
        }
    }

    private eventContactsReceived(msg: any) {
        console.log("eventContactsReceived", msg);
        this.contacts = (msg.data as Contact[]).filter(c => c.participantId !== this.confClient.participantId)
        console.log("eventContactsReceived", msg.data);
        this.onContactsReceived(this.contacts);
    }

    private eventInviteReceived(msg: any) {
        console.log("eventInviteReceived", msg);
        this.inviteMsg = msg;
        this.onInviteReceived(msg.data.participantId, msg.data.displayName);
    }

    private eventInviteResult(msg: InviteResultMsg) {
        console.log("eventInviteResult", msg);
        if (msg.data.error) {
            this.onConferenceEnded(msg.data.conferenceRoomId, msg.data.error);
            this.inviteMsg = null;
            return;
        }

        if (this.inviteMsg) {
            this.inviteMsg.data.conferenceRoomId = msg.data.conferenceRoomId;
        }
    }

    private eventInviteCancelled(msg: any) {
        console.log("eventInviteCancelled", msg);
        this.onConferenceEnded(msg.data.conferenceRoomId, "call cancelled");
        this.inviteMsg = null;
    }

    private eventRejectReceived(msg: any) {
        console.log("eventRejectReceived", msg);
        this.onConferenceEnded(msg.data.conferenceRoomId, "call rejected");
        this.inviteMsg = null;
    }

    private eventConferenceCreatedResult(msg: CreateConfResultMsg) {
        console.log("eventConferenceCreatedResult", msg);
        if (msg.data.error) {
            console.error("failed to create conference.");
            this.onConferenceEnded(msg.data.trackingId, "failed to create conference");
            return;
        }
        this.onConferenceCreated(msg.data.conferenceRoomId, msg.data.trackingId);
        this.joinConferenceRoom(msg.data.conferenceRoomId);
    }

    private eventConferenceJoined(msg: any) {
        if (this.localStream) {
            this.confClient.publishTracks(this.localStream);
        }
        this.inviteMsg = null;
        this.onConferenceJoined();
    }

    private eventConferenceFailed(msg: any) {
        console.log("eventConferenceFailed", msg);
        this.onConferenceEnded(msg.data.conferenceRoomId, "system error");
        this.inviteMsg = null;
    }

    private eventConferenceClosed(msg: any) {
        console.log("eventConferenceClosed", msg);
        this.onConferenceEnded(msg.data.conferenceRoomId, "call ended.");
        this.inviteMsg = null;
    }

    private eventParticipantJoined(msg: any) {
        console.log("eventParticipantJoined", msg);
        this.onParticipantJoined(msg.data.participantId, msg.data.displayName);
    }

    private eventParticipantLeft(msg: any) {
        console.log("eventParticipantLeft", msg.data);
        this.onParticipantLeft(msg.data.participantId);
    }

    private eventParticipantNewTrack(msg: any) {
        console.log("eventParticipantNewTrack", msg.data);
        this.onParticipantTrack(msg.data.participantId, msg.data.track)
    }
}

export const webRTCService = new WebRTCService(); // Singleton instance