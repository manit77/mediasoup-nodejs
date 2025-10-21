import * as mediasoup from 'mediasoup';
import { Peer } from './peer.js';
import { PeerTracksInfo, RoomCallBackMsg, RoomConfig, RoomLog, RoomLogAction, RoomPeerCallBackMsg, UniqueMap } from "@rooms/rooms-models";
import { setTimeout, setInterval, clearInterval } from 'node:timers';
import axios from 'axios';
import { RoomPeer } from './roomPeer.js';
import { consoleError, consoleWarn } from '../utils/utils.js';
import { Consumer, MediaKind, Producer } from 'mediasoup/types';
import { RoomServerConfig } from './models.js';
import { RecPeer } from '../recording/recPeer.js';

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
    private roomPeers: UniqueMap<Peer, RoomPeer> = new UniqueMap();
    private recPeers: UniqueMap<Peer, RecPeer> = new UniqueMap();

    roomToken: string;

    config = new RoomConfig();
    serverConfig: RoomServerConfig;
    dateCreated = new Date();

    timerIdInterval?: NodeJS.Timeout = null;
    timerIdMaxRoomDuration?: NodeJS.Timeout = null;
    timerIdNoParticipants?: NodeJS.Timeout = null;

    roomRouter?: mediasoup.types.Router;
    roomLogAdapter: RoomLogAdapter;
    roomRtpCapabilities: mediasoup.types.RtpCapabilities;

    recServerURI = "";

    onClosedEvent: (room: Room, peers: Peer[], reason: string) => void;
    onPeerRemovedEvent: (room: Room, peers: Peer) => void;
    onConsumerClosed: (peer: Peer, consumer: Consumer) => void;
    onNeedPing: (peer: Peer) => void;
    onProducerCreated: (peer: Peer, producer: Producer) => void;

    constructor(serverConfig: RoomServerConfig) {
        this.serverConfig = serverConfig;
    }

    printStats() {
        consoleWarn(`# Room: ${this.roomName} ${this.id}`);
        consoleWarn(`## RoomPeers: ${this.roomPeers.size}`);
        this.roomPeers.values().forEach(rp => {
            consoleWarn(`### ${rp.peer.displayName} send closed: ${rp.producerTransport?.closed} receive closed:  ${rp.consumerTransport?.closed}`);
            consoleWarn(`### ${rp.peer.displayName} producers: ${rp.producers?.size} consumers:  ${rp.consumers?.size}`);
            rp.producers?.values().forEach(p => {
                consoleWarn(`#### producers ${p.closed}`);
            });
            rp.consumers?.values().forEach(c => {
                consoleWarn(`#### consumers ${c.closed}`);
            });
        });

    }

    startTimers() {

        console.log(`room - startTimer() maxRoomDurationMinutes:${this.config.maxRoomDurationMinutes}`);

        if (this.config.maxRoomDurationMinutes > 0) {
            this.timerIdMaxRoomDuration = setTimeout(async () => {
                console.log("room timeOutMaxDurationSecs timed out");
                this.close("timeOutMaxDurationSecs");
            }, this.config.maxRoomDurationMinutes * 60 * 1000);

            console.log(`closing room in  ${this.config.maxRoomDurationMinutes} minutes.`);
        }

        this.startTimerNoParticipants();

        //every 10 seconds check of the peer has responded
        let room_socket_pong_timeout_secs = 30;
        this.timerIdInterval = setInterval(() => {

            for (let roomPeer of this.roomPeers.values()) {
                const timeSincePong = Date.now() - roomPeer.lastPong;
                consoleWarn(roomPeer.peer.displayName, timeSincePong, room_socket_pong_timeout_secs * 1000);

                if (timeSincePong >= room_socket_pong_timeout_secs * 1000) {
                    consoleError(`No pong received, removing peer. ${roomPeer.peer.displayName}`);
                    this.removePeer(roomPeer.peer);
                    return;
                }

                this.onNeedPing(roomPeer.peer);
                consoleWarn(`room ping sent`);
            }

        }, 10000);

        this.writeRoomLog({
            Action: RoomLogAction.roomCreated,
            Date: new Date(),
            PeerId: "",
            RoomId: this.id
        });
    }

    pong(peer: Peer) {
        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            return;
        }
        roomPeer.lastPong = Date.now();
    }

    private startTimerNoParticipants() {
        console.log(`room - startTimerNoParticipants() ${this.config.timeOutNoParticipantsSecs}`);

        if (this.roomPeers.size == 0 && this.config.timeOutNoParticipantsSecs > 0) {

            this.timerIdNoParticipants = setTimeout(async () => {
                if (this.roomPeers.size == 0) {
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

        if (peer.room) {
            consoleWarn(`peer already in a room. ${peer.id} ${peer.displayName}`);
            return false;
        }

        peer.room = this;
        this.roomPeers.set(peer, new RoomPeer(this.serverConfig, this, peer));
        consoleWarn(`peer added to room. ${peer.id} ${peer.displayName}`);

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

        if (this.config.callBackURL_OnPeerJoined) {
            let cbData = new RoomPeerCallBackMsg();
            cbData.data.peerId = peer.id;
            cbData.data.roomId = this.id;
            cbData.data.peerTrackingId = peer.trackingId;
            cbData.data.roomTrackingId = this.trackingId;
            axios.post(this.config.callBackURL_OnPeerJoined, cbData);
        }

        this.printStats();

        return true;
    }

    removePeer(peer: Peer): void {
        console.log(`room.removePeer() - ${peer.id} ${peer.displayName}`);
        let roomPeer = this.roomPeers.get(peer);

        if (!roomPeer) {
            console.error(`peer not found in room.`);
            return;
        }

        roomPeer.close();

        this.roomPeers.delete(peer);
        consoleWarn(`peer removed from room ${peer.id} ${peer.displayName}`);

        let recPeer = this.recPeers.get(peer);
        if (recPeer) {
            console.error(`recPeer not found room.`);
            recPeer.close();
            this.recPeers.delete(peer);
            consoleWarn(`recPeer removed from room ${peer.id} ${peer.displayName}`);
        }

        if (this.roomPeers.size == 0) {
            this.startTimerNoParticipants();
        }

        if (this.onPeerRemovedEvent) {
            this.onPeerRemovedEvent(this, peer);
        }

        if (this.config.closeRoomOnPeerCount == this.roomPeers.size) {
            this.close("closeRoomOnPeerCount");
        }

        this.writeRoomLog({
            Action: RoomLogAction.peerLeft,
            Date: new Date(),
            PeerId: peer.id,
            RoomId: this.id
        });

        if (this.config.callBackURL_OnPeerLeft) {

            let cbData = new RoomPeerCallBackMsg();
            cbData.data.peerId = peer.id;
            cbData.data.roomId = this.id;
            cbData.data.peerTrackingId = peer.trackingId;
            cbData.data.roomTrackingId = this.trackingId;

            axios.post(this.config.callBackURL_OnPeerLeft, cbData);
        }

        this.printStats();
    }

    getPeers(): Peer[] {
        return this.roomPeers.values().map(p => p.peer);
    }

    getPeer(peerId: string) {
        return this.roomPeers.values().find(p => p.peer.id === peerId)?.peer;
    }

    getRoomPeer(peer: Peer) {
        return this.roomPeers.get(peer);
    }

    getRecPeer(peer: Peer) {
        return this.recPeers.get(peer);
    }

    getPeerCount() {
        return this.roomPeers.size;
    }

    otherPeers(peerId: string) {
        return this.roomPeers.values().filter(p => p.peer.id !== peerId).map(p => p.peer);
    }

    otherRoomPeers(peerId: string) {
        return this.roomPeers.values().filter(p => p.peer.id !== peerId);
    }

    getProducerTransport(peer: Peer) {
        console.log(`room - getProducerTransport ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }
        return roomPeer.producerTransport;
    }

    getConsumerTransport(peer: Peer) {
        console.log(`room - getConsumerTransport ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }
        return roomPeer.consumerTransport;
    }

    createProducerTransport(peer: Peer) {
        console.log(`room - createProducerTransport ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }
        return roomPeer.createProducerTransport();
    }

    createConsumerTransport(peer: Peer) {
        console.log(`room - createConsumerTransport ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }
        return roomPeer.createConsumerTransport();
    }

    async createProducer(peer: Peer, kind: MediaKind, rtpParameters: mediasoup.types.RtpParameters) {
        console.log(`room - createProducer ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }
        let producer = await roomPeer.createProducer(kind, rtpParameters);
        if (this.onProducerCreated) {
            this.onProducerCreated(peer, producer);
        }

        if (this.config.isRecorded && this.config.closeOnRecordingFailed && this.config.closeOnRecordingTimeoutSecs) {
            // let timeoutid = setTimeout(() => {
            //     consoleError(`recording timed out. ${peer.trackingId} ${peer.displayName}`);
            //     this.close(`recording timed out. ${peer.trackingId} ${peer.displayName}`);
            // }, this.config.closeOnRecordingTimeoutSecs * 1000)

            //init the recording peer and set the timeout
            let recPeer = this.recPeers.get(peer);
            if (!recPeer) {
                recPeer = new RecPeer(this, peer);
                this.recPeers.set(peer, recPeer);
            }
            
            recPeer.eventRecordingTimeout = (peer: Peer, kind: MediaKind) => {
                consoleError(`recording failed for ${peer.displayName} ${kind}`);
                this.close(`recording failed.`);
            };

            recPeer.startTimeout(producer.kind, this.config.closeOnRecordingTimeoutSecs);
        }

        return producer;
    }

    async recordProducer(peer: Peer, producerId: string, recIP: string, recPort: number) {
        console.log(`room - recordProducer ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }

        let producer = roomPeer.getProducer(producerId);
        if (!producer) {
            consoleError(`producer not found. ${producerId}`);
            return;
        }

        let recPeer = this.recPeers.get(peer);
        if (!recPeer) {
            consoleError(`recoding peer not found. ${peer.displayName}`);
            return;
        }

        await recPeer.startRecording(producer, recIP, recPort);

    }

    async createConsumer(peer: Peer, remotePeer: Peer, producerId: string, rtpParameters: mediasoup.types.RtpCapabilities) {
        console.log(`room - createConsumer ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }

        let remoteRoomPeer = this.roomPeers.get(remotePeer);

        let producer = remoteRoomPeer.producers.values().find(p => p.id === producerId);
        if (!producer) {
            consoleError(`producer not found ${producer.id}`);
        }

        return await roomPeer.createConsumer(peer, producer, rtpParameters);

    }

    // getProducer(peer: Peer, kind: MediaKind) {
    //     let roomPeer = this.roomPeers.get(peer);
    //     if (!roomPeer) {
    //         consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
    //         return;
    //     }
    //     return roomPeer.producers.get(kind);
    // }

    async closeProducer(peer: Peer, kind: MediaKind) {
        console.log(`room - closeProducer ${peer.id} ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }
        await roomPeer.closeProducer(kind);
    }

    async muteProducer(peer: Peer) {
        consoleWarn(`room - muteProducer ${peer.displayName}`);

        let roomPeer = this.roomPeers.get(peer);
        if (!roomPeer) {
            consoleError(`peer not found. ${peer.id} ${peer.displayName}`);
            return;
        }

        roomPeer.muteProducer();
    }

    /**
     * removes all peers and fires the onClose()
     */
    close(reason: string) {
        console.log(`room - close(), reason: ${reason}`);

        let peersCopy = this.roomPeers.values().map(p => p.peer);

        this.roomPeers.values().forEach(roomPeer => {
            roomPeer.close();
        });
        this.roomPeers.clear();

        this.recPeers.values().forEach(recPeer => {
            recPeer.close();
        });
        this.recPeers.clear();

        this.admin = null;

        if (this.timerIdNoParticipants) {
            clearTimeout(this.timerIdNoParticipants);
        }

        if (this.timerIdMaxRoomDuration) {
            clearTimeout(this.timerIdMaxRoomDuration);
        }
        if (this.timerIdInterval) {
            clearInterval(this.timerIdInterval);
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
            let roomCallBackData = new RoomCallBackMsg();
            roomCallBackData.data.peers = [];
            roomCallBackData.data.roomId = this.id;
            roomCallBackData.data.status = "closed";
            roomCallBackData.data.roomTrackingId = this.trackingId;
            axios.post(this.config.callBackURL_OnRoomClosed, roomCallBackData);
        }
    }

    writeRoomLog(log: RoomLog) {
        if (this.roomLogAdapter) {
            this.roomLogAdapter.save(log);
        }
    }

}


