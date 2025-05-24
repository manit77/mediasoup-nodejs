import * as mediasoup from 'mediasoup';
import { WebSocket } from 'ws';
import { Peer } from './peer.js';
import { RoomConfig } from "@rooms/rooms-models";
import { setTimeout, setInterval } from 'node:timers';


export class Room {
    id: string;
    private peers: Map<string, Peer> = new Map();
    roomToken: string;

    config = new RoomConfig();

    timerIdMaxRoomDuration?: NodeJS.Timeout = null;
    timerIdNoParticipants?: NodeJS.Timeout = null;

    router?: mediasoup.types.Router;
    onClosedEvent: (room: Room, peers: Peer[], reason: string) => void;
    onPeerRemovedEvent: (room: Room, peers: Peer) => void;

    constructor(r: mediasoup.types.Router) {
        this.router = r;
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

        if (this.timerIdNoParticipants) {
            clearTimeout(this.timerIdNoParticipants);
        }

        return true;
    }

    removePeer(peerId: string): void {
        console.log("removePeer ", peerId);
        let peer = this.peers.get(peerId);
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

        if (this.timerIdNoParticipants) {
            clearTimeout(this.timerIdNoParticipants);
        }

        if (this.timerIdMaxRoomDuration) {
            clearTimeout(this.timerIdMaxRoomDuration);
        }

        this.router?.close();
        this.router = null;

        if (this.onClosedEvent) {
            this.onClosedEvent(this, peersCopy, reason);
        }
    }

}


