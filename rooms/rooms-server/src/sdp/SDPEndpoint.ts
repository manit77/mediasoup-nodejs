import * as MsSdpUtils from "mediasoup-client/handlers/sdp/commonUtils";
import { RemoteSdp } from "mediasoup-client/handlers/sdp/RemoteSdp";
import type { IceCandidate as ClientIceCandidate } from "mediasoup-client/types";

import {
    Consumer,
    MediaKind,
    Producer,
    RtpCapabilities,
    RtpParameters,
    WebRtcTransport,
} from "mediasoup/types";

import * as SdpTransform from "sdp-transform";
import type { MediaDescription } from "sdp-transform";
import { randomUUID } from "node:crypto";
import debug from "debug";

import * as BrowserRtpCapabilities from "./BrowserRtpCapabilities.js";
import * as SdpUtils from "./SdpUtils.js";

const logger = debug("mediasoup-sdp-bridge:SdpEndpoint");
const loggerWarn = logger.extend("WARN");

export class SdpEndpoint {

    private webRtcTransport: WebRtcTransport;
    private localCaps: RtpCapabilities;
    private localSdp: string | undefined;
    private remoteSdp: string | undefined;

    private producers = new Map<string, Producer>();
    private producerOfferMedias: MediaDescription[] = [];
    private producerOfferParams: RtpParameters[] = [];

    private consumers = new Map<string, Consumer>();

    constructor(webRtcTransport: WebRtcTransport, localCaps: RtpCapabilities) {
        this.webRtcTransport = webRtcTransport;
        this.localCaps = localCaps;
    }
    
    /**
     * client >> offer >> server
     * client wants to publish tracks
     * @param sdpOffer 
     * @returns 
     */
    public async processOffer(sdpOffer: string): Promise<Producer[]> {

        console.warn("processOffer dtlsState", this.webRtcTransport.dtlsState);

        this.remoteSdp = sdpOffer;
        // Parse the SDP message text into an object.
        const remoteSdpObj = SdpTransform.parse(sdpOffer);

        // sdp-transform bug #94: Type inconsistency in payloads
        // https://github.com/clux/sdp-transform/issues/94
        // Force "payloads" to be a string field.
        for (const media of remoteSdpObj.media) {
            media.payloads = `${media.payloads}`;
        }

        //connect only once
        if (["new", "failed", "closed"].includes(this.webRtcTransport.dtlsState)) {
            // Use DTLS info from the remote SDP to connect the WebRTC transport.
            let dtlsParameters;
            dtlsParameters = MsSdpUtils.extractDtlsParameters({ sdpObject: remoteSdpObj, });

            await this.webRtcTransport.connect({
                dtlsParameters,
            });
        }

        let newProducers = [];

        //Get a list of media and make Producers for all of them.
        //1 audio and 1 video only
        const mediaKinds = new Set<MediaKind>();

        for (const media of remoteSdpObj.media) {
            if (!("rtp" in media)) {
                // Skip media that is not RTP.
                continue;
            }

            if (!("direction" in media)) {
                // Skip media for which the direction is unknown.
                continue;
            }

            const mediaKind = media.type as MediaKind;
            if (mediaKinds.has(mediaKind)) {
                // Skip media if the same kind was already processed.
                console.warn(`more than 1 '${mediaKind}' media was requested; skipping it`,);
                continue;
            }

            let existingProducer = [...this.producers.values()].find(p => p.kind == mediaKind);
            if (existingProducer) {
                console.warn(`existing producer ${existingProducer.kind}`);
                mediaKinds.add(mediaKind);
                continue;
            }

            //Generate RtpSendParameters to be used for the new Producer
            //max 1 video 1 audio
            const rtpParameters = SdpUtils.sdpToProducerRtpParameters(
                remoteSdpObj,
                this.localCaps,
                mediaKind,
            );

            let producer: Producer;
            producer = await this.webRtcTransport.produce({
                kind: mediaKind,
                rtpParameters: rtpParameters,
                paused: false,
            });

            this.producers.set(producer.id, producer);
            this.producerOfferMedias.push(media);
            this.producerOfferParams.push(rtpParameters);
            newProducers.push(producer);

            logger(`[SdpEndpoint.processOffer] mediasoup Producer created, kind: ${producer.kind}, type: ${producer.type}, paused: ${producer.paused}`);
            mediaKinds.add(mediaKind);
        }

        return newProducers;
    }

    /**
     * server >> answer >> client
     * @returns 
     */
    public createAnswer(): string {

        const sdpBuilder: RemoteSdp = new RemoteSdp({
            iceParameters: this.webRtcTransport.iceParameters,
            iceCandidates: this.webRtcTransport.iceCandidates as ClientIceCandidate[],
            dtlsParameters: this.webRtcTransport.dtlsParameters,
            sctpParameters: this.webRtcTransport.sctpParameters,
        });

        logger("[SdpEndpoint.createAnswer] Make 'recvonly' SDP Answer");

        let producersArr = [...this.producers.values()];
        for (let i = 0; i < this.producers.size; i++) {
            // Each call to RemoteSdp.send() creates a new AnswerMediaSection,
            // which always assumes an `a=recvonly` direction.
            sdpBuilder.send({
                offerMediaObject: this.producerOfferMedias[i],
                reuseMid: undefined,
                offerRtpParameters: this.producerOfferParams[i],
                answerRtpParameters: producersArr[i].rtpParameters,
                codecOptions: undefined,
            });
        }

        this.localSdp = sdpBuilder.getSdp();
        return this.localSdp;
    }

    public addConsumer(consumer: Consumer): void {
        this.consumers.set(consumer.id, consumer);
    }

    /**
     * creates offer to send to client
     * client will receive tracks
     * @returns 
     */    
    public createOffer(): string {

        const sdpBuilder: RemoteSdp = new RemoteSdp({
            iceParameters: this.webRtcTransport.iceParameters,
            iceCandidates: this.webRtcTransport.iceCandidates as ClientIceCandidate[],
            dtlsParameters: this.webRtcTransport.dtlsParameters,
            sctpParameters: this.webRtcTransport.sctpParameters,
        });

        // Make an MSID to be used for both "audio" and "video" kinds.
        const sendMsid = randomUUID().replace(/-/g, "").slice(0, 8);

        logger("[SdpEndpoint.createOffer] Make 'sendonly' SDP Offer");
        let consumersArr = [...this.consumers.values()];
        for (let i = 0; i < this.consumers.size; i++) {
            const mid = consumersArr[i].rtpParameters.mid ?? "nomid";
            const kind = consumersArr[i].kind;
            const sendParams = consumersArr[i].rtpParameters;

            // Each call to RemoteSdp.receive() creates a new OfferMediaSection,
            // which always assumes an `a=sendonly` direction.
            sdpBuilder.receive({
                mid,
                kind,
                offerRtpParameters: sendParams,
                streamId: sendMsid,
                trackId: `${sendMsid}-${kind}`,
            });
        }

        this.localSdp = sdpBuilder.getSdp();      
        return this.localSdp;
    }

    /**
     * server >> offer >> client >> answer >> server 
     * client receives new tracks
     * process the answer from the client
     * @param sdpAnswer 
     */
    public async processAnswer(sdpAnswer: string): Promise<void> {

        this.remoteSdp = sdpAnswer;
        const remoteSdpObj = SdpTransform.parse(sdpAnswer);

        if (["new", "failed", "closed"].includes(this.webRtcTransport.dtlsState)) {
            let dtlsParameters = MsSdpUtils.extractDtlsParameters({ sdpObject: remoteSdpObj });
            await this.webRtcTransport.connect({ dtlsParameters });
        }
    }
}

export function generateRtpCapabilities(): RtpCapabilities {
    return BrowserRtpCapabilities.chrome;
}
