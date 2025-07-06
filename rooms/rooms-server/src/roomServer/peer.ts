import * as mediasoup from 'mediasoup';
import { Room } from './room.js';
import * as roomUtils from "./utils.js";
import { setTimeout, setInterval } from 'node:timers';

export class Peer {

    public id: string;
    public trackingId: string;
    public displayName: string;
    public authToken: string;
    public role: "admin" | "peer" | "monitor" = "peer";

    constructor() {

    }

    producerTransport?: mediasoup.types.WebRtcTransport;
    consumerTransport?: mediasoup.types.WebRtcTransport;
    producers: Map<string, mediasoup.types.Producer> = new Map();
    consumers: Map<string, mediasoup.types.Consumer> = new Map();

    recordings?: Map<string, any> = new Map();
    room?: Room;

    async createProducerTransport() {
        console.log(`createProducerTransport()`);
        if (this.producerTransport) {
            console.log(`producer transport already created.`);
            return true;
        }

        if (!this.room) {
            console.log(`not in a room`);
            return true;
        }

        if (!this.room.roomRouter) {
            console.log(`no room router.`);
            return true;
        }

        try {
            this.producerTransport = await roomUtils.createTransport(this.room.roomRouter);
        } catch (err: any) {
            console.error(err);
            return false;
        }        

        this.producerTransport.on('@close', () => {
            console.log(`Producer transport closed for peer ${this.id}`);
            // Producers will auto-cleanup via their event handlers
        });

        this.producerTransport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'failed' || dtlsState === 'closed') {
                console.log(`Producer transport DTLS state: ${dtlsState} for peer ${this.id}`);
            }
        });

        return true;

    }

    async createConsumerTransport(): Promise<boolean> {
        console.log(`createConsumerTransport()`);
        if (this.consumerTransport) {
            console.log(`consumer transport already created.`);
            return true;
        }

        if (!this.room) {
            console.log(`not in a room.`);
            return true;
        }

        if (!this.room.roomRouter) {
            console.log(`no room router.`);
            return true;
        }

        try {
            this.consumerTransport = await roomUtils.createTransport(this.room.roomRouter);
        } catch (err: any) {
            console.error(err);
            return false;
        }

        // Consumer transport events
        this.consumerTransport.on('@close', () => {
            console.log(`Consumer transport closed for peer ${this.id}`);
            // Consumers will auto-cleanup via their event handlers
        });

        this.consumerTransport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'failed' || dtlsState === 'closed') {
                console.log(`Consumer transport DTLS state: ${dtlsState} for peer ${this.id}`);
            }
        });

        return true;

    }

    addConsumer(consumer: mediasoup.types.Consumer) {
        this.consumers.set(consumer.id, consumer);

        // Auto-cleanup when consumer closes
        consumer.on('@close', () => {
            console.log(`Consumer ${consumer.id} closed, removing from peer ${this.id}`);
            this.consumers.delete(consumer.id);
        });

        // Handle transport close events
        consumer.on('transportclose', () => {
            console.log(`Consumer ${consumer.id} transport closed`);
            this.consumers.delete(consumer.id);
        });
    }

    addProducer(producer: mediasoup.types.Producer) {
        this.producers.set(producer.id, producer);

        // Auto-cleanup when producer closes
        producer.on('@close', () => {
            console.log(`Producer ${producer.id} closed, removing from peer ${this.id}`);
            this.producers.delete(producer.id);
        });

        // Handle transport close events
        producer.on('transportclose', () => {
            console.log(`Producer ${producer.id} transport closed`);
            this.producers.delete(producer.id);
        });

    }


    close() {
        console.log(`peer close() - ${this.id}`);

        this.producerTransport?.close();
        this.consumerTransport?.close();

        this.producers.forEach(p => {
            if (!p.closed) {
                p.close();
            }
        });

        this.consumers.forEach(c => {
            if (!c.closed) {
                c.close();
            }
        })

        this.producers.clear()
        this.consumers.clear()
        this.producerTransport = undefined;
        this.consumerTransport = undefined;


        if (this.room) {
            this.room.removePeer(this.id);
        }

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