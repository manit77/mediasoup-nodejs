import { IPeer, RoomsClient } from "@rooms/rooms-client";
import { IMsg } from "@rooms/rooms-models";
import { Conference, Participant } from "./models.js";
import { EventParticpantNewTrackMsg, EventTypes } from "./conferenceEvents.js";

export type RoomManagerEvent = (eventType: string, payload: IMsg) => Promise<void>;

export class RoomManager {
    private roomsClient: RoomsClient;
    private onEvent: RoomManagerEvent;

    constructor(private conference: Conference, private localParticipant: Participant, private username: string) {}

    public async initialize(roomURI: string, roomRtpCapabilities: string): Promise<void> {
        console.log("RoomManager: Initializing RoomsClient");

        if (this.roomsClient) {
            console.log("RoomManager: RoomsClient already initialized.");
            return;
        }

        this.roomsClient = new RoomsClient({
            socket_auto_reconnect: true,
            socket_enable_logs: false, // Or get from config
            socket_ws_uri: roomURI,
        });

        this.setupRoomsClientEvents();

        await this.roomsClient.inititalize({ rtp_capabilities: roomRtpCapabilities });
    }

    public async connectAndJoin(): Promise<void> {
        console.log("RoomManager: Connecting and joining room.");
        if (!this.roomsClient) throw new Error("RoomsClient not initialized.");

        await this.roomsClient.waitForConnect();
        console.log("-- RoomManager: Room socket connected.");

        const registerResult = await this.roomsClient.waitForRegister({
            authToken: this.conference.roomAuthToken,
            username: this.username,
            trackingId: this.localParticipant.participantId,
            displayName: this.localParticipant.displayName,
            timeoutSecs: 30,
        });

        if (registerResult.error) {
            throw new Error(`RoomManager: Failed to register with room: ${registerResult.error}`);
        }
        this.localParticipant.peerId = this.roomsClient.getPeerId();
        console.log(`-- RoomManager: Room socket registered. New peerId: ${this.localParticipant.peerId}`);

        await this.roomsClient.broadCastTrackInfo(this.localParticipant.tracksInfo);

        const joinResult = await this.roomsClient.waitForRoomJoin(this.conference.roomId, this.conference.roomToken);
        if (joinResult.error) {
            throw new Error(`RoomManager: Failed to join room: ${joinResult.error}`);
        }
        console.log("-- RoomManager: Room joined.");
    }

    public setEventHandler(handler: RoomManagerEvent) {
        this.onEvent = handler;
    }

    public publishTracks(tracks: MediaStreamTrack[]): Promise<void> {
        if (!this.roomsClient) return;
        return this.roomsClient.publishTracks(tracks);
    }

    public unPublishTracks(tracks: MediaStreamTrack[]): void {
        if (!this.roomsClient) return;
        this.roomsClient.unPublishTracks(tracks);
    }

    public broadCastTrackInfo(): void {
        if (!this.roomsClient) return;
        this.roomsClient.broadCastTrackInfo(this.localParticipant.tracksInfo);
    }

    public muteParticipantTrack(peerId: string, audioMuted: boolean, videoMuted: boolean): void {
        if (!this.roomsClient) return;
        this.roomsClient.muteParticipantTrack(peerId, audioMuted, videoMuted);
    }

    public roomPong(roomId: string): void {
        if (!this.roomsClient) return;
        this.roomsClient.roomPong(roomId);
    }

    public isBroadcastingVideo(): boolean {
        return this.roomsClient?.isBroadcastingVideo() ?? false;
    }

    public isBroadcastingAudio(): boolean {
        return this.roomsClient?.isBroadcastingAudio() ?? false;
    }

    public dispose(): void {
        console.log("RoomManager: Disposing RoomsClient.");
        if (this.roomsClient) {
            this.roomsClient.roomLeave();
            this.roomsClient.dispose();
            this.roomsClient = null;
        }
    }

    private setupRoomsClientEvents(): void {
        if (!this.onEvent) {
            console.warn("RoomManager: onEvent handler not set. Events will be lost.");
            this.onEvent = async () => {};
        }

        this.roomsClient.eventOnRoomSocketClosed = async () => {
            await this.onEvent(EventTypes.disconnected, { type: "roomSocketClosed", data: { reason: "disconnected from room server" } });
        };

        this.roomsClient.eventOnRoomJoined = async (roomId: string) => {
            await this.onEvent(EventTypes.conferenceJoined, { type: EventTypes.conferenceJoined, data: { conferenceId: this.conference.conferenceId, roomId } });
        };

        this.roomsClient.eventRoomTransportsCreated = async () => {
            await this.onEvent('eventRoomTransportsCreated', null);
        };

        this.roomsClient.eventOnRoomClosed = async (roomId: string) => {
            await this.onEvent(EventTypes.conferenceClosed, { type: EventTypes.conferenceClosed, data: { conferenceId: this.conference.conferenceId, reason: "room closed" } });
        };

        this.roomsClient.eventOnRoomPeerJoined = async (roomId: string, peer: IPeer) => {
            await this.onEvent(EventTypes.participantJoined, { type: EventTypes.participantJoined, data: { peer, roomId } });
        };

        this.roomsClient.eventOnPeerNewTrack = async (peer: IPeer, track: MediaStreamTrack) => {
            const msg = new EventParticpantNewTrackMsg();
            msg.data.participantId = peer.trackingId;
            msg.data.track = track;
            await this.onEvent(EventTypes.participantNewTrack, { type: EventTypes.participantNewTrack, data: { peer, track } });
        };

        this.roomsClient.eventOnRoomPeerLeft = async (roomId: string, peer: IPeer) => {
            await this.onEvent(EventTypes.participantLeft, { type: EventTypes.participantLeft, data: { peer, roomId } });
        };

        this.roomsClient.eventOnPeerTrackInfoUpdated = async (peer: IPeer) => {
            await this.onEvent(EventTypes.participantTrackInfoUpdated, { type: EventTypes.participantTrackInfoUpdated, data: { peer } });
        };

        this.roomsClient.eventOnRoomPing = async (roomId: string) => {
            await this.onEvent(EventTypes.conferencePing, { type: EventTypes.conferencePing, data: { conferenceId: this.conference.conferenceId } });
        };
    }
}