import * as mediasoup from 'mediasoup';
import { Room } from './room.js';
import * as roomUtils from "./utils.js";
import chalk, { Chalk } from 'chalk';
import { Peer } from './peer.js';
import { consoleError, consoleWarn } from '../utils/utils.js';
import { MediaKind, Producer } from 'mediasoup/types';
import { UniqueMap } from '@rooms/rooms-models';

export class RoomPeer {

    peer: Peer;
    room: Room;

    constructor(room: Room, peer: Peer) {
        this.room = room;
        this.peer = peer;
    }

    producerTransport?: mediasoup.types.WebRtcTransport;
    consumerTransport?: mediasoup.types.WebRtcTransport;
    producers: UniqueMap<MediaKind, mediasoup.types.Producer> = new UniqueMap();
    consumers: UniqueMap<string, mediasoup.types.Consumer> = new UniqueMap();

    async createProducerTransport() {
        console.log(`createProducerTransport()`);
        if (this.producerTransport) {
            console.log(`producer transport already created.`);
            return;
        }

        if (!this.room) {
            console.log(`not in a room`);
            return;
        }

        if (!this.room.roomRouter) {
            console.log(`no room router.`);
            return;
        }

        this.producerTransport = await roomUtils.createTransport(this.room.roomRouter);

        this.producerTransport.on('@close', () => {
            consoleWarn(`Producer transport closed for peer ${this.peer.id} ${this.peer.displayName}`);
        });

        this.producerTransport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'failed' || dtlsState === 'closed') {
                console.log(`Producer transport DTLS state: ${dtlsState} for peer ${this.peer.id} ${this.peer.displayName}`);
            }
        });

        return this.producerTransport;
    }

    async createConsumerTransport() {
        console.log(`createConsumerTransport() ${this.peer.id} ${this.peer.displayName}`);
        if (this.consumerTransport) {
            console.log(`consumer transport already created. ${this.peer.id} ${this.peer.displayName}`);
            return;
        }

        if (!this.room) {
            console.log(`not in a room.`);
            return;
        }

        if (!this.room.roomRouter) {
            console.log(`no room router.`);
            return;
        }

        this.consumerTransport = await roomUtils.createTransport(this.room.roomRouter);

        // Consumer transport events
        this.consumerTransport.on('@close', () => {
            console.log(`Consumer transport closed for peer ${this.peer.id} ${this.peer.displayName}`);
            // Consumers will auto-cleanup via their event handlers
        });

        this.consumerTransport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'failed' || dtlsState === 'closed') {
                console.log(`Consumer transport DTLS state: ${dtlsState} for peer ${this.peer.id} ${this.peer.displayName}`);
            }
        });

        return this.consumerTransport;

    }

    async createConsumer(producer: Producer, rtpCapabilities: mediasoup.types.RtpCapabilities) {
        console.log(`createConsumer`);

        if (!this.consumerTransport) {
            consoleError(`no consumer transport. ${this.peer.id} ${this.peer.displayName}`);
            return;
        }

        let existingProducers = this.producers.values().find(p => p === producer );
        if(existingProducers){
            consoleError(`cannot consume your own producer.`);
            return;
        }

        //consume the producer
        const consumer = await this.consumerTransport.consume({
            producerId: producer.id,
            rtpCapabilities: rtpCapabilities,
            paused: false,
        });

        this.consumers.set(consumer.id, consumer);

        // Auto-cleanup when consumer closes
        consumer.on('@close', () => {
            console.log(`Consumer ${consumer.id} closed, removing from peer ${this.peer.id}`);
            this.consumers.delete(consumer.id);
        });

        // Handle transport close events
        consumer.on('transportclose', () => {
            console.log(`Consumer ${consumer.id} transport closed`);
            this.consumers.delete(consumer.id);
        });

        return consumer;
    }

    async createProducer(kind: MediaKind, rtpParameters: mediasoup.types.RtpParameters) {
        console.log(`createProducer`);

        //requires a producerTransport
        if (!this.producerTransport) {
            consoleError(`Transport not found for peer ${this.peer.id} ${this.peer.displayName}`);
            return
        }

        //init a producer with rtpParameters
        const producer = await this.producerTransport.produce({
            kind: kind,
            rtpParameters: rtpParameters,
        });

        this.producers.set(kind, producer);

        // Auto-cleanup when producer closes
        producer.on('@close', () => {
            console.log(chalk.yellow(`Producer ${producer.id} closed, removing from peer ${this.peer.id} ${this.peer.displayName}`));
            this.producers.delete(kind);
        });

        // Handle transport close events
        producer.on('transportclose', () => {
            console.log(chalk.yellow(`Producer ${producer.id} transport closed for ${this.peer.id} ${this.peer.displayName}`));
            this.producers.delete(producer.kind);
        });

        producer.on("videoorientationchange", (args) => {
            console.log(chalk.yellow(`Producer ${producer.id} videoorientationchange for ${this.peer.id} ${this.peer.displayName}`));
            console.log(args);
        });

        producer.on("listenererror", (args) => {
            console.log(chalk.yellow(`Producer ${producer.id} listenererror for ${this.peer.id} ${this.peer.displayName}`));
            console.log(args);
        });

        return producer;
    }

    close() {
        console.log(`peerRoom close() - ${this.peer.id} ${this.peer.displayName}`);

        this.producerTransport?.close();
        this.consumerTransport?.close();
        this.producerTransport = null;
        this.consumerTransport = null;

        this.producers.values().forEach(p => {
            if (!p.closed) {
                p.close();
            }
        });

        this.consumers.values().forEach(c => {
            if (!c.closed) {
                c.close();
            }
        })

        this.producers.clear()
        this.consumers.clear()

        if (this.room) {
            this.room.removePeer(this.peer);
        }
        this.room = null;
        this.peer.room = null;

        console.log(`peer closed`);

    }

    getProducerByKind(kind: mediasoup.types.MediaKind): mediasoup.types.Producer | undefined {
        for (const producer of this.producers.values()) {
            if (producer.kind === kind) {
                return producer;
            }
        }
        return undefined;
    }

    // Get all consumers for a specific producer
    getConsumersForProducer(producerId: string): mediasoup.types.Consumer[] {
        return Array.from(this.consumers.values()).filter(
            consumer => consumer.producerId === producerId
        );
    }

    async muteProducer() {
        //the peer has mute/unmute a remotePeer
        for (let producer of this.producers.values()) {

            let trackEnabled = producer.kind == "audio" ? this.peer.trackInfo.isAudioEnabled : this.peer.trackInfo.isVideoEnabled;

            //toggle the producer track
            if (trackEnabled && producer.paused) {
                await producer.resume();
                consoleWarn(`${this.peer.displayName}:Producer ${producer.id} ${producer.kind} resumed.`);
            } else if (!trackEnabled && !producer.paused) {
                await producer.pause();
                consoleWarn(`${this.peer.displayName}:Producer ${producer.id} ${producer.kind} paused.`);
            }
        }
    }

    // Check if peer has active media
    hasActiveMedia(): boolean {
        return this.producers.size > 0 || this.consumers.size > 0;
    }

    async getStats(): Promise<{ producerTransport: any, consumerTransport: any }> {
        const stats: any = { producerTransport: undefined, consumerTransport: undefined };

        if (this.producerTransport) {
            stats.producerTransport = await this.producerTransport.getStats();
        }

        if (this.consumerTransport) {
            stats.consumerTransport = await this.consumerTransport.getStats();
        }

        return stats;
    }

};