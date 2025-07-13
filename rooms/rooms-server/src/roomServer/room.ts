import * as mediasoup from 'mediasoup';
import { Peer } from './peer.js';
import { RoomCallBackData, RoomConfig, RoomLog, RoomLogAction, RoomPeerCallBackData } from "@rooms/rooms-models";
import { setTimeout, setInterval } from 'node:timers';
import axios from 'axios';

export interface RoomLogAdapter {
    save: (log: RoomLog) => Promise<void>;
    get: (roomId: string) => Promise<RoomLog[]>;
}

export class Room {
    id: string;
    roomName: string;
    trackingId: string;
    adminTrackingId: string;
    admin: Peer;
    private peers: Map<string, Peer> = new Map();
    roomToken: string;

    config = new RoomConfig();

    timerIdMaxRoomDuration?: NodeJS.Timeout = null;
    timerIdNoParticipants?: NodeJS.Timeout = null;

    roomRouter?: mediasoup.types.Router;
    roomLogAdapter: RoomLogAdapter;
    roomRtpCapabilities: mediasoup.types.RtpCapabilities;
    onClosedEvent: (room: Room, peers: Peer[], reason: string) => void;
    onPeerRemovedEvent: (room: Room, peers: Peer) => void;

    constructor() {

    }

    startTimers() {

        console.log(`room startTimer() maxRoomDurationMinutes:${this.config.maxRoomDurationMinutes}`);

        if (this.config.maxRoomDurationMinutes > 0) {
            this.timerIdMaxRoomDuration = setTimeout(async () => {
                console.log("room timeOutMaxDurationSecs timed out");
                this.close("timeOutMaxDurationSecs");
            }, this.config.maxRoomDurationMinutes * 60 * 1000);

            console.log(`closing room in  ${this.config.maxRoomDurationMinutes} minutes.`);
        }

        this.startTimerNoParticipants();

        this.writeRoomLog({
            Action: RoomLogAction.roomCreated,
            Date: new Date(),
            PeerId: "",
            RoomId: this.id
        });
    }

    private startTimerNoParticipants() {
        console.log(`startTimerNoParticipants() ${this.config.timeOutNoParticipantsSecs}`);

        if (this.peers.size == 0 && this.config.timeOutNoParticipantsSecs > 0) {

            this.timerIdNoParticipants = setTimeout(async () => {
                if (this.peers.size == 0) {
                    console.log("timerIdNoParticipantsSecs timed out");
                    this.close("timerIdNoParticipantsSecs");
                }
            }, this.config.timeOutNoParticipantsSecs * 1000);

            console.log(`closing room in  ${this.config.timeOutNoParticipantsSecs} seconds if no peers join.`);
        }
    }

    addPeer(peer: Peer, roomToken: string): boolean {
        console.log("addPeer()");

        if (this.roomToken && this.roomToken !== roomToken) {
            console.error("token provided does not match room token");
            console.error(this.roomToken);
            console.error(roomToken);
            return false;
        }

        peer.room = this;

        console.log("addPeer", peer.id);
        this.peers.set(peer.id, peer);

        if (!this.admin && this.adminTrackingId && peer.trackingId && this.adminTrackingId === peer.trackingId) {
            this.admin = peer;
        }

        if (this.timerIdNoParticipants) {
            clearTimeout(this.timerIdNoParticipants);
        }

        this.writeRoomLog({
            Action: RoomLogAction.peerJoined,
            Date: new Date(),
            PeerId: peer.id,
            RoomId: this.id
        });

        if (peer.role != "monitor") {
            if (this.config.callBackURL_OnPeerJoined) {
                let cbData: RoomPeerCallBackData = {
                    peerId: peer.id,
                    roomId: this.id,
                    peerTrackingId: peer.trackingId,
                    roomTrackingId: this.trackingId
                }

                axios.post(this.config.callBackURL_OnPeerJoined, cbData);
            }
        }

        return true;
    }

    removePeer(peerId: string): void {
        console.log("removePeer() - ", peerId);
        let peer = this.peers.get(peerId);

        if (!peer) {
            console.error("removePeer() - peer not found.");
            return;
        }
        if (peer) {
            peer.room = null;
            this.peers.delete(peerId);
        }

        if (this.peers.size == 0) {
            this.startTimerNoParticipants();
        }

        if (this.onPeerRemovedEvent) {
            this.onPeerRemovedEvent(this, peer);
        }

        if (this.config.closeRoomOnPeerCount == this.peers.size) {
            this.close("closeRoomOnPeerCount");
        }

        this.writeRoomLog({
            Action: RoomLogAction.peerLeft,
            Date: new Date(),
            PeerId: peer.id,
            RoomId: this.id
        });

        if (this.config.callBackURL_OnPeerLeft) {
            let cbData: RoomPeerCallBackData = {
                peerId: peer.id,
                roomId: this.id,
                peerTrackingId: peer.trackingId,
                roomTrackingId: this.trackingId
            }

            axios.post(this.config.callBackURL_OnPeerLeft, cbData);
        }
    }

    getPeers(): Peer[] {
        return [...this.peers.values()];
    }

    getPeer(peerId: string) {
        return this.peers.get(peerId);
    }

    getPeerCount() {
        return this.peers.size;
    }

    otherPeers(peerId: string) {
        return [...this.peers].filter(([id,]) => id !== peerId);
    }

    /**
     * removes all peers and fires the onClose()
     */
    close(reason: string) {
        console.log(`room - close(), reason: ${reason}`);
        let peersCopy = [...this.peers.values()];

        this.peers.forEach(p => {
            p.close();
            p.room = null;
        });

        this.peers.clear();
        this.admin = null;

        if (this.timerIdNoParticipants) {
            clearTimeout(this.timerIdNoParticipants);
        }

        if (this.timerIdMaxRoomDuration) {
            clearTimeout(this.timerIdMaxRoomDuration);
        }

        this.roomRouter?.close();
        this.roomRouter = null;

        if (this.onClosedEvent) {
            this.onClosedEvent(this, peersCopy, reason);
        }

        this.writeRoomLog({
            Action: RoomLogAction.roomClosed,
            Date: new Date(),
            PeerId: "",
            RoomId: this.id
        });

        if (this.config.callBackURL_OnRoomClosed) {
            let roomCallBackData: RoomCallBackData = {
                peers: [],
                roomId: this.id,
                status: "closed",
                trackingId: this.trackingId
            }

            axios.post(this.config.callBackURL_OnRoomClosed, roomCallBackData);
        }
    }

    writeRoomLog(log: RoomLog) {
        if (this.roomLogAdapter) {
            this.roomLogAdapter.save(log);
        }
    }

}


