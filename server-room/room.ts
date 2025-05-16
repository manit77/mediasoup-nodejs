import * as mediasoup from 'mediasoup';
import { WebSocket } from 'ws';

export class Room {
    id: string;
    peers: Map<string, Peer> = new Map();
    roomToken: string = "";
    maxPeers = 2;

    constructor() {
    }

    addPeer(peer: Peer, roomToken: string): boolean {

        if (this.roomToken && this.roomToken !== roomToken) {
            console.error("token provided does not match room token");
            console.error(this.roomToken);
            console.error(roomToken);

            return false;
        }

        peer.room = this;

        console.log("addPeer", peer.id);
        this.peers.set(peer.id, peer);

        return true;

    }

    removePeer(peerId: string): void {
        console.log("removePeer ", peerId);
        let peer = this.peers.get(peerId);
        if (peer) {
            peer.room = null;
            this.peers.delete(peerId);
        }
    }

    otherPeers(peerId: string) {
        return [...this.peers].filter(([id,]) => id !== peerId);
    }

}

export class Peer {
    public id: string;
    public trackingid: string;
    public displayName: string;

    constructor() {
    }

    producerTransport?: mediasoup.types.WebRtcTransport;
    consumerTransport?: mediasoup.types.WebRtcTransport;
    producers: mediasoup.types.Producer[] = [];
    consumers: mediasoup.types.Consumer[] = [];
    recordings?: Map<string, any> = new Map();
    room?: Room;
};
