import * as mediasoup from 'mediasoup';
import { WebSocket } from 'ws';
import { Peer } from './peer';

export class Room {
    id: string;
    peers: Map<string, Peer> = new Map();
    roomToken: string = "";
    maxPeers = 2;

    onClose: (room: Room) => void;

    // Timers
    timeOutMaxCallDurationSecs = 3600; //one hour
    timerIdMaxCallDuration?: NodeJS.Timeout = null;

    //executes when room is created and no participants has joined
    timeOutNoParticipantsSecs = 15 * 60; //15 minutes
    timerIdNoParticipants?: NodeJS.Timeout = null;

    constructor() {

    }

    startTimers() {
        console.log("startTimer()");

        if (this.timeOutMaxCallDurationSecs > 0) {
            this.timerIdMaxCallDuration = setTimeout(async () => {
                console.log("timeOutMaxDurationSecs timed out");
                this.close();
            }, this.timeOutMaxCallDurationSecs * 1000);
        }

        this.startTimerNoParticipants();

    }

    private startTimerNoParticipants() {
        console.log("startTimer()");
        if (this.peers.size == 0 && this.timeOutNoParticipantsSecs > 0) {
            this.timerIdNoParticipants = setTimeout(async () => {
                console.log("timerIdNoParticipantsSecs timed out");
                this.close();
            }, this.timeOutNoParticipantsSecs * 1000);
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

        this.startTimerNoParticipants();
    }

    otherPeers(peerId: string) {
        return [...this.peers].filter(([id,]) => id !== peerId);
    }

    close() {
        console.log("close()");
        if (this.onClose) {
            this.onClose(this);
        }

        this.peers.forEach(p => p.room = null);
        this.peers.clear();
    }

}


