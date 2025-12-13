import * as mediasoup from 'mediasoup';
import { Room } from './room.js';
import * as roomUtils from "./utils.js";
import chalk from 'chalk';
import { Peer } from './peer.js';
import { consoleError, consoleWarn, generateShortUID } from '../utils/utils.js';
import { Consumer, MediaKind, Producer, Transport } from 'mediasoup/types';
import { UniqueMap } from '@rooms/rooms-models';
import { RoomServerConfig, WorkerData } from './models.js';
import { SdpEndpoint } from '../sdp/SDPEndpoint.js';
import { chrome } from '../sdp/BrowserRtpCapabilities.js';

export class RoomPeer {

    joinInstance: string;
    peer: Peer;
    room: Room;
    config: RoomServerConfig;
    lastPong: number = Date.now();
    dateCreated = new Date();

    constructor(config: RoomServerConfig, room: Room, peer: Peer) {
        this.room = room;
        this.peer = peer;
        this.config = config;
        this.joinInstance = "join-" + generateShortUID();
    }

    producerTransport?: mediasoup.types.WebRtcTransport;
    consumerTransport?: mediasoup.types.WebRtcTransport;
    producers: UniqueMap<MediaKind, mediasoup.types.Producer> = new UniqueMap();
    consumers: UniqueMap<string, mediasoup.types.Consumer> = new UniqueMap();

    private producerSdpEndPoint: SdpEndpoint;
    private consumerSdpEndPoint: SdpEndpoint;
    
    async createProducerTransport() {
        console.log(`createProducerTransport() ${this.peer.displayName}`);

        if (this.producerTransport) {
            console.log(`producer transport already created.`);
            return this.producerTransport;
        }

        if (!this.room) {
            console.log(`not in a room`);
            return;
        }

        if (!this.room.roomRouter) {
            console.log(`no room router.`);
            return;
        }

        //let workerData: WorkerData = this.room.roomRouter.appData as any;
        this.producerTransport = await roomUtils.createWebRtcTransport(this.room.roomRouter, this.config.room_server_ip, this.config.room_public_ip, this.config.room_rtc_start_port, this.config.room_rtc_end_port);

        this.producerTransport.on('@close', () => {
            consoleWarn(`Producer transport closed for peer ${this.peer.id} ${this.peer.displayName}`);
        });

        this.producerTransport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'failed' || dtlsState === 'closed') {
                console.log(`Producer transport DTLS state: ${dtlsState} for peer ${this.peer.id} ${this.peer.displayName}`);
            }
        });

        if (this.peer.clientType == "sdp") {
           this.producerSdpEndPoint = new SdpEndpoint(this.producerTransport, this.room.roomRtpCapabilities);
        }

        return this.producerTransport;
    }

    async createConsumerTransport() {
        console.log(`createConsumerTransport() ${this.peer.displayName}`);

        if (this.consumerTransport) {
            console.log(`consumer transport already created. ${this.peer.id} ${this.peer.displayName}`);
            return this.consumerTransport;
        }

        if (!this.room) {
            console.log(`not in a room.`);
            return;
        }

        if (!this.room.roomRouter) {
            console.log(`no room router.`);
            return;
        }
        
        this.consumerTransport = await roomUtils.createWebRtcTransport(this.room.roomRouter, this.config.room_server_ip, this.config.room_public_ip, this.config.room_rtc_start_port, this.config.room_rtc_end_port);
        
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

        if (this.peer.clientType == "sdp") {
            this.consumerSdpEndPoint = new SdpEndpoint(this.consumerTransport, this.room.roomRtpCapabilities);
        }

        return this.consumerTransport;

    }

    /**
     * consume a remote peer's producer
     * @param producer 
     * @param rtpCapabilities 
     * @returns 
     */
    async createConsumer(remotePeer: Peer, producer: Producer, rtpCapabilities: mediasoup.types.RtpCapabilities) {
        console.log(`createConsumer: ${this.peer.displayName} consuming ${remotePeer.displayName} ${producer.kind}`);

        if (!this.consumerTransport) {
            consoleError(`no consumer transport. ${this.peer.id} ${this.peer.displayName}`);
            return;
        }

        let existingProducers = this.producers.values().find(p => p === producer);
        if (existingProducers) {
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

        //the remote peer's producer closed, close this consumer and remove it
        consumer.on("producerclose", () => {
            consoleWarn(`producerclose ${remotePeer.displayName} ${producer.kind}, removing from peer ${this.peer.id} ${this.peer.displayName}. producerid: ${consumer.producerId}`);
            consumer.close();
            this.consumers.delete(consumer.id);

            //TODO: need to send, alert all consumers
            this.room.onConsumerClosed(this.peer, consumer);
        });

        consumer.on('@close', () => {
            consoleWarn(`Consumer ${consumer.id} closed, removing from peer ${this.peer.id}`);
            this.consumers.delete(consumer.id);
        });

        // Handle transport close events
        consumer.on('transportclose', () => {
            consoleWarn(`Consumer ${consumer.id} transport closed`);
            this.consumers.delete(consumer.id);
        });

        return consumer;
    }

    async createProducer(kind: MediaKind, rtpParameters: mediasoup.types.RtpParameters) {
        console.log(`createProducer ${this.peer.displayName}, ${this.producers.size}`);

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

        if (this.producers.get(kind)) {
            consoleError(`producer with ${kind} already exists`);
            return;
        }

        this.producers.set(kind, producer);

        consoleWarn(`producer ceated for ${this.peer.displayName}, paused: ${producer.paused}`);

        // Auto-cleanup when producer closes                
        producer.on('@close', () => {
            console.log(chalk.yellow(`Producer ${producer.id} ${producer.kind} closed, removing from peer ${this.peer.id} ${this.peer.displayName}`));
            this.producers.delete(kind);
        });

        // Handle transport close events
        producer.on('transportclose', () => {
            console.log(chalk.yellow(`Producer ${producer.id} ${producer.kind} transport closed for ${this.peer.id} ${this.peer.displayName}`));
            this.producers.delete(producer.kind);
        });

        producer.on("videoorientationchange", (args) => {
            console.log(chalk.yellow(`Producer ${producer.id} ${producer.kind} videoorientationchange for ${this.peer.id} ${this.peer.displayName}`));
            console.log(args);
        });

        producer.on("listenererror", (args) => {
            console.log(chalk.yellow(`Producer ${producer.id} ${producer.kind} listenererror for ${this.peer.id} ${this.peer.displayName}`));
            console.log(args);
        });

        return producer;
    }


    async closeProducer(kind: MediaKind) {
        console.log(`closeProducuer ${kind} - ${this.peer.id} ${this.peer.displayName}`);

        let producer = this.producers.get(kind);
        if (producer) {
            producer.close();
        }
    }

    /***
     * creates producers and returns an answer
     */
    async processOfferForSDP(sdpOffer: string): Promise<{ producers: Producer[], answer: string }> {

        let producers = await this.producerSdpEndPoint.processOffer(sdpOffer);

        for (let producer of producers) {
            this.producers.set(producer.kind, producer);
        }

        roomUtils.startProducerMonitor(producers);

        let answer = this.producerSdpEndPoint.createAnswer();
        return { producers, answer };
    }

    //consumes a peers producers
    async consumePeerSDP(roomPeer: RoomPeer) {
        console.log(`consumePeerSDP: ${this.peer.displayName} consuming ${roomPeer.peer.displayName}`);

        if (!this.consumerTransport) {
            consoleError("consumerTransport not created.");
            return;
        }

        //assume chrome
        let rtpCapabilitiesClient = chrome;

        for (let producer of roomPeer.producers.values()) {

            //consume the producer
            let consumer: Consumer;
            try {
                consumer = await this.consumerTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities: rtpCapabilitiesClient,
                    paused: false,
                });
            } catch (err) {
                consoleError("unable to consumer producer", err);
            }

            if (!consumer) {
                consoleError("unable to createConsumerForSDP ");
                return;
            }

            // Add consumer to SDP
            this.consumerSdpEndPoint.addConsumer(consumer);

            this.consumers.set(consumer.id, consumer);
        }

        return this.consumerSdpEndPoint.createOffer();

        //await this.consumerSdpEndPoint.processOffer(offerSDP);
        //return this.consumerSdpEndPoint.createAnswer();

        

    }

    async processAnswerForSDP(sdpAnswer: string) {
        await this.consumerSdpEndPoint.processAnswer(sdpAnswer);
        return true;
    }

    close() {
        consoleWarn(`peerRoom close() - ${this.peer.id} ${this.peer.displayName}`);

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

        this.producers.clear();
        this.consumers.clear();


        this.producerTransport?.close();
        this.consumerTransport?.close();
        this.producerTransport = null;
        this.consumerTransport = null;

        this.room = null;
        this.peer.room = null;
        this.peer.tracksInfo = {
            isAudioEnabled: false,
            isVideoEnabled: false,
            isAudioMuted: false,
            isVideoMuted: false
        };

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

    getProducer(id: string): mediasoup.types.Producer | undefined {
        for (const producer of this.producers.values()) {
            if (producer.id === id) {
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

    async toggleProducer(kind: string, isEnabled: boolean) {
        consoleWarn(`toggleProducer ${this.peer.displayName} to ${isEnabled}`);

        //the peer has mute/unmute a remotePeer
        for (let producer of this.producers.values()) {
            if (producer.kind === kind) {
                if (isEnabled) {
                    if (producer.paused) {
                        await producer.resume();
                        consoleWarn(`producer ${producer.kind} is resumed`);
                    }
                } else {
                    if (!producer.paused) {
                        await producer.pause();
                        consoleWarn(`producer ${producer.kind} is paused`);
                    }
                }
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