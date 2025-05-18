import * as mediasoup from 'mediasoup';
import { WebSocket } from 'ws';
import { Peer } from './peer';
import { RoomConfig } from '../models/roomSharedModels';

export class Room {
    id: string;
    peers: Map<string, Peer> = new Map();
    roomToken: string = "";

    config = new RoomConfig();

    timerIdMaxRoomDuration?: NodeJS.Timeout = null;
    timerIdNoParticipants?: NodeJS.Timeout = null;

    router?: mediasoup.types.Router;
    worker?: mediasoup.types.Worker;

    constructor(worker: mediasoup.types.Worker) {

        this.worker = worker;
        this.worker.createRouter({
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                },
            ],
        }).then((r) => {
            this.router = r;
        });

    }

    startTimers() {
        console.log("startTimer()");

        if (this.config.maxRoomDurationMinutes > 0) {
            this.timerIdMaxRoomDuration = setTimeout(async () => {
                console.log("timeOutMaxDurationSecs timed out");
                this.close();
            }, this.config.maxRoomDurationMinutes * 1000);
        }

        this.startTimerNoParticipants();
    }

    private startTimerNoParticipants() {
        console.log("startTimer()");
        if (this.peers.size == 0 && this.config.timeOutNoParticipantsSecs > 0) {
            this.timerIdNoParticipants = setTimeout(async () => {
                console.log("timerIdNoParticipantsSecs timed out");
                this.close();
            }, this.config.timeOutNoParticipantsSecs * 1000);
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
    }

    otherPeers(peerId: string) {
        return [...this.peers].filter(([id,]) => id !== peerId);
    }

    /**
     * removes all peers and fires the onClose()
     */
    close() {
        console.log("room - close()");

        if (this.timerIdNoParticipants) {
            clearTimeout(this.timerIdNoParticipants);
        }

        if (this.timerIdMaxRoomDuration) {
            clearTimeout(this.timerIdMaxRoomDuration);
        }       

        this.peers.forEach(p => {
            p.close();
            p.room = null;
        });

        this.peers.clear();

        this.router?.close();
        this.router = null;
    }

}


