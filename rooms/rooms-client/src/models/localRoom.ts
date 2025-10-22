import * as mediasoupClient from 'mediasoup-client';
import { Consumer, MediaKind, Producer } from 'mediasoup-client/types';
import { PeerTracksInfo, UniqueMap } from '@rooms/rooms-models';
import { IPeer, Peer } from './peers.js';

export class LocalRoom {

    roomId: string = "";
    transportSend: mediasoupClient.types.Transport;
    transportReceive: mediasoupClient.types.Transport;
    producersToConsume = new UniqueMap<Peer, { producerId: string, kind: MediaKind | string }[]>();
    peers: UniqueMap<string, IPeer> = new UniqueMap();
    private producers: UniqueMap<MediaKind, mediasoupClient.types.Producer> = new UniqueMap();
    private peerConsumers: UniqueMap<IPeer, UniqueMap<MediaKind, mediasoupClient.types.Consumer>> = new UniqueMap();

    constructor() {

    }

    close() {
        this.roomId = "";
        this.producers.values().forEach(p => p.close());
        this.producers.clear();

        for (let arr of this.peerConsumers.values()) {
            arr.values().forEach(c => c.close());
        }
        this.peerConsumers.clear();

        this.transportSend?.close();
        this.transportReceive?.close();

        this.peers.clear();
    }

    dispose() {
        this.close();

    }

    getProducerTracks() {
        return this.producers.values().map(p => p.track);
    }

    getProducers() {
        return this.producers;
    }

    removeProducer(kind: MediaKind) {
        console.log(`removeProducer ${kind}`);
        this.producers.delete(kind);
    }

    /**
     * local producer, one producer per track
     * only 1 video and 1 audio is allowed
     * @param track 
     * @returns 
     */
    async createProducer(track: MediaStreamTrack) {
        console.log(`createProducer ${track.kind}`);

        if (!this.transportSend) {
            console.error(`cannot create producer, no transportSend.`)
            return;
        }

        //if the producer exists by kind throw an error
        let existingProducer = this.producers.get(track.kind as any);
        if (existingProducer) {
            throw `producer already exists for kind ${existingProducer.kind}`;
        }

        let producer = await this.transportSend.produce({ track });
        this.addProducer(producer);
        return producer;
    }

    private addProducer(producer: Producer) {
        console.log(`addProducer ${producer.kind}`);

        producer.on("@close", () => {
            console.log(`producer - ${producer.track?.kind} closed`);
            this.producers.delete(producer.kind);
            console.log(`producer - deleted`);
        });

        producer.on("trackended", () => {
            console.log(`producer - ${producer.track?.kind} track ended ${producer.track?.id} ${producer.track?.kind}`);
        });

        producer.observer.on('pause', () => {
            console.log(`producer - ${producer.track?.kind} track paused (muted)`);
        });

        producer.observer.on('resume', () => {
            console.log(`producer - ${producer.track?.kind} track resumed (unmuted)`);
        });

        this.producers.set(producer.kind, producer);
    }

    getConsumerTracks(peer: IPeer) {
        let consumers = this.peerConsumers.get(peer);
        if (consumers) {
            return consumers.values().map(c => c.track);
        }
        return [];
    }

    getConsumers(peer: IPeer) {
        let consumers = this.peerConsumers.get(peer);
        if (consumers) {
            return consumers;
        }
        return new UniqueMap<MediaKind, mediasoupClient.types.Consumer>();
    }

    removeConsumerByKind(peer: IPeer, kind: MediaKind) {
        let consumers = this.peerConsumers.get(peer);
        if (consumers) {
            return consumers.delete(kind)
        }

        return false;
    }

    removeConsumer(peer: IPeer) {
        return this.peerConsumers.delete(peer);
    }

    async createConsumer(peer: IPeer, serverConsumerId: string, serverProducerId: string, kind: MediaKind, rtpParameters: any) {
        console.log(`createConsumer serverConsumerId:${serverConsumerId}, serverProducerId: ${serverProducerId}, kind: ${kind}`);

        if (!this.transportReceive) {
            console.error(`cannot create producer, no transportSend.`)
            return;
        }

        let consumers = this.peerConsumers.get(peer);
        if (consumers) {
            let existing = consumers.get(kind);
            if (existing) {
                throw `consumer of ${existing.kind} already exists for peerId: ${peer.displayName}`;
            }
        }

        let consumer = await this.transportReceive.consume({
            id: serverConsumerId,
            producerId: serverProducerId,
            kind: kind,
            rtpParameters: rtpParameters
        });

        this.addConsumer(peer, consumer);

        return consumer;
    }

    private addConsumer(peer: IPeer, consumer: Consumer) {
        console.warn(`addConsumer ${peer.displayName} ${consumer.kind}`);

        let consumers = this.peerConsumers.get(peer);
        if (!consumers) {
            consumers = new UniqueMap<MediaKind, Consumer>();
            this.peerConsumers.set(peer, consumers);
        }

        consumers.set(consumer.kind, consumer);

        consumer.on("trackended", () => {
            console.log(`consumer - track ended ${consumer.track?.id} ${consumer.track?.kind}`);
        });

        consumer.observer.on('pause', () => {
            console.log('consumer - paused (muted)');
        });

        consumer.observer.on('resume', () => {
            console.log('consumer - resumed (unmuted)');
        });


    }
}
