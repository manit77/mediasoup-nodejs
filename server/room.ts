import * as mediasoup from 'mediasoup';
import { WebSocket } from 'ws';

export class Room {
    id: string;
    peers: Map<string, Peer> = new Map();

    constructor(roomId: string) {
        this.id = roomId;
        this.peers = new Map();
    }

    async addPeer(peer: Peer) {
        console.log("addPeer", peer.id);
        this.peers.set(peer.id, peer);
    }

    removePeer(peerId: string): void {
        this.peers.delete(peerId);
    }

    async broadCastExcept(except: Peer, msg: any) {
        console.log("broadCastExcept", this.peers.size);
        for (let peer of this.peers.values()) {
            if (except != peer) {
                peer.socket.send(JSON.stringify(msg));
            }
        }
    }

    async broadCastAll(msg: any) {
        for (let peer of this.peers.values()) {
            peer.socket.send(JSON.stringify(msg));
        }
    }

}

export class Peer {
    public id: string;
    public socket: WebSocket;

    constructor(roomId: string, socket: WebSocket) {
        this.id = roomId;
        this.socket = socket;
    }

    producerTransport?: mediasoup.types.WebRtcTransport;
    consumerTransport?: mediasoup.types.WebRtcTransport;
    producers: mediasoup.types.Producer[] = [];
    consumers: mediasoup.types.Consumer[] = [];
    recordings?: Map<string, any> = new Map();
    room?: Room;
};
