import { MediaKind, PlainTransport, Producer } from "mediasoup/types";
import { consoleError, consoleInfo, consoleWarn } from "../utils/utils.js";
import { Room } from "../roomServer/room.js";
import { UniqueMap } from "@rooms/rooms-models";
import { Peer } from "../roomServer/peer.js";

export class RecPeer {

    recTransports: UniqueMap<MediaKind, PlainTransport> = new UniqueMap();
    recordingTimeouts = new UniqueMap<MediaKind, any>();

    eventRecordingTimeout = (peer: Peer, kind: MediaKind) => { }

    constructor(private room: Room, private peer: Peer) {
        consoleInfo(`RecPeer created ${peer.displayName}`);
    }

    close() {
        for (let transport of this.recTransports.values()) {
            if (!transport.closed) {
                transport.close();
            }
        }
        this.recTransports.clear();

        for (let timeoutid of this.recordingTimeouts.values()) {
            if (timeoutid) {
                clearTimeout(timeoutid);
            }
        }
        this.recordingTimeouts.clear();
    }

    async startTimeout(kind: MediaKind, timeoutSecs: number) {

        let timeoutid = setTimeout(() => {
            consoleError(`recording timed out. ${this.peer.trackingId} ${this.peer.displayName}`);
            this.eventRecordingTimeout(this.peer, kind);

        }, timeoutSecs * 1000);

        this.recordingTimeouts.set(kind, timeoutid);
    }

    async startRecording(producer: Producer, recIP: string, recPort: number) {
        consoleWarn(`startRecording ${producer.kind} ${recIP} ${recPort}`);

        let rtcpMux = true; //mix rtp and rtcp on the same port
        //the recording sever has a port ready
        let recTransport = await this.room.roomRouter.createPlainTransport({
            listenIp: { ip: this.room.serverConfig.room_server_ip },
            rtcpMux,
            comedia: false,
        });

        // let getStats = async () => {
        //     if (!recTransport.closed) {
        //         const stats = await recTransport.getStats();
        //         console.log(stats);
        //         setTimeout(() => {
        //             getStats();
        //         }, 1000);
        //     }
        // };

        // getStats();


        await recTransport.enableTraceEvent(['bwe', 'probation']);

        if (this.recTransports.get(producer.kind)) {
            consoleError(`recording transport already exists for ${producer.kind}`);
            return;
        }

        this.recTransports.set(producer.kind, recTransport);

        recTransport.on("@close", () => {
            consoleWarn(`recTransport close ${producer.kind}`);
        });

        recTransport.on("@dataproducerclose", () => {
            consoleWarn(`recTransport dataproducerclose ${producer.kind}`);
        });

        recTransport.on("@listenserverclose", () => {
            consoleWarn(`recTransport listenserverclose ${producer.kind}`);
        });

        recTransport.on("@newdataproducer", () => {
            consoleWarn(`recTransport newdataproducer ${producer.kind}`);
        });

        recTransport.on("@newproducer", () => {
            consoleWarn(`recTransport newproducer ${producer.kind}`);
        });

        recTransport.on("@producerclose", () => {
            consoleWarn(`recTransport producerclose ${producer.kind}`);
        });

        recTransport.on("listenererror", () => {
            consoleWarn(`recTransport listenererror ${producer.kind}`);
        });

        recTransport.on("listenserverclose", () => {
            consoleWarn(`recTransport listenserverclose ${producer.kind}`);
        });

        recTransport.on("routerclose", () => {
            consoleWarn(`recTransport routerclose ${producer.kind}`);
        });

        recTransport.on("rtcptuple", () => {
            consoleWarn(`recTransport rtcptuple ${producer.kind}`);
        });

        recTransport.on("sctpstatechange", () => {
            consoleWarn(`recTransport sctpstatechange ${producer.kind}`);
        });

        recTransport.on("trace", () => {
            consoleWarn(`recTransport trace ${producer.kind}`);
        });

        recTransport.on("tuple", () => {
            consoleWarn(`recTransport tuple ${producer.kind}`);
        });

        consoleWarn(`recTransport created ${producer.kind}`);
        if (rtcpMux) {
            await recTransport.connect({ ip: recIP, port: recPort });
        }
        else {
            await recTransport.connect({ ip: recIP, port: recPort, rtcpPort: recPort + 1 });
        }

        consoleWarn(`recTransport  ${producer.kind}, connect ${recIP} ${recPort}`);

        const recConsumer = await recTransport.consume({
            producerId: producer.id,
            rtpCapabilities: this.room.roomRouter.rtpCapabilities,
            paused: true
        });

        recConsumer.on("@close", () => {
            consoleWarn(`recConsumer created ${producer.kind}`);
        });

        recConsumer.on("@producerclose", () => {
            consoleWarn(`recConsumer producerclose ${producer.kind}`);
        });

        recConsumer.on("layerschange", () => {
            consoleWarn(`recConsumer layerschange ${producer.kind}`);
        });

        recConsumer.on("listenererror", () => {
            consoleWarn(`recConsumer listenererror ${producer.kind}`);
        });

        recConsumer.on("producerclose", () => {
            consoleWarn(`recConsumer producerclose ${producer.kind}`);
        });

        recConsumer.on("producerpause", () => {
            consoleWarn(`recConsumer producerpause ${producer.kind}`);
        });

        recConsumer.on("producerresume", () => {
            consoleWarn(`recConsumer producerresume ${producer.kind}`);
        });

        recConsumer.on("rtp", () => {
            consoleWarn(`recConsumer rtp ${producer.kind}`);
        });

        recConsumer.on("score", () => {
            consoleWarn(`recConsumer score ${producer.kind}`);
        });

        // recConsumer.on("trace", () => {
        //     consoleWarn(`recConsumer trace`);
        // });

        recConsumer.on("transportclose", () => {
            consoleWarn(`recConsumer transportclose ${producer.kind}`);
        });

        await recConsumer.resume();

        await recConsumer.enableTraceEvent(['rtp', "keyframe"]);

        recConsumer.on("trace", packet => {
            //console.log("trace:", packet.type);
            if (packet.type == "keyframe") {
                console.log(`***  ${producer.kind} keyframe received`);
            }

        });

        if (producer.kind == "video") {
            recConsumer.requestKeyFrame();
        }
    }

    clearTimeout(kind: MediaKind) {
        console.log(`onPacketRecorded ${kind} - ${this.peer.id} ${this.peer.displayName}`);

        if (this.recordingTimeouts.has(kind)) {
            console.log(`timeout cleared ${kind}`);
            clearTimeout(this.recordingTimeouts.get(kind));
            this.recordingTimeouts.delete(kind);
        } else {
            console.log(`timeout not found ${kind}`);
        }
    }

}