import { RoomConfig } from "@rooms/rooms-models";
export class Room {
    constructor(r) {
        this.peers = new Map();
        this.roomToken = "";
        this.config = new RoomConfig();
        this.timerIdMaxRoomDuration = null;
        this.timerIdNoParticipants = null;
        this.router = r;
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
    startTimerNoParticipants() {
        console.log("startTimerNoParticipants()");
        if (this.peers.size == 0 && this.config.timeOutNoParticipantsSecs > 0) {
            this.timerIdNoParticipants = setTimeout(async () => {
                console.log("timerIdNoParticipantsSecs timed out");
                this.close();
            }, this.config.timeOutNoParticipantsSecs * 1000);
        }
    }
    addPeer(peer, roomToken) {
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
    removePeer(peerId) {
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
    getPeers() {
        return [...this.peers.values()];
    }
    getPeer(peerId) {
        return this.peers.get(peerId);
    }
    getPeerCount() {
        return this.peers.size;
    }
    otherPeers(peerId) {
        return [...this.peers].filter(([id,]) => id !== peerId);
    }
    /**
     * removes all peers and fires the onClose()
     */
    close() {
        console.log("room - close()");
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
        if (this.onClose) {
            this.onClose(this);
        }
    }
}
