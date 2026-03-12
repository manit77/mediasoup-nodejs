import { PeerTracksInfo, UniqueMap } from "@rooms/rooms-models";
import { IPeer, Peer } from "./models/peers.js";
import { LocalRoom } from "./models/localRoom.js";

export class RoomStateManager {
    public localRoom: LocalRoom = new LocalRoom();

    public get roomId(): string | undefined {
        return this.localRoom.roomId;
    }

    public set roomId(id: string) {
        this.localRoom.roomId = id;
    }

    public get peers(): UniqueMap<string, IPeer> {
        return this.localRoom.peers;
    }

    public addPeer(remotePeer: Peer): boolean {
        console.log(`addPeer() - ${remotePeer.displayName} ${remotePeer.peerId}`);
        if (this.localRoom.peers.has(remotePeer.peerId)) {
            console.error(`peer already exists, ${remotePeer.peerId}`);
            return false;
        }
        this.localRoom.peers.set(remotePeer.peerId, remotePeer);
        return true;
    }

    public removePeer(peerId: string): Peer | undefined {
        const peer = this.localRoom.peers.get(peerId);
        if (peer) {
            console.log(`removePeer() - ${peer.displayName} ${peer.peerId}`);
            let consumers = this.localRoom.getConsumers(peer);
            consumers.values().forEach(c => c.close());
            this.localRoom.removeConsumer(peer);
            this.localRoom.peers.delete(peerId);
        }
        return peer;
    }

    public createPeer(peerId: string, trackingId: string, displayName: string, tracksInfo: PeerTracksInfo): Peer {
        console.log(`createPeer() - ${displayName}, peerId:${peerId}, trackingId:${trackingId},tracksInfo:`, tracksInfo);
        const newPeer = new Peer();
        newPeer.peerId = peerId;
        newPeer.trackingId = trackingId;
        newPeer.displayName = displayName;
        newPeer.tracksInfo = tracksInfo;
        this.addPeer(newPeer);
        return newPeer;
    }

    public close() {
        this.localRoom.close();
    }
}