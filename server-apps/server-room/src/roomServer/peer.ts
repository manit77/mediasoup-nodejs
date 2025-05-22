import * as mediasoup from 'mediasoup';
import { Room } from './room.js';
import { clearTimeout } from 'timers';

export class Peer {

    public id: string;
    public trackingid: string;
    public displayName: string;
    public authToken: string;

    timeOutInactivitySecs = 3600; //if not activity for 60 minutes terminate the peer
    timerIdInactivity: NodeJS.Timeout;

    onInactive: (peer: Peer) => void;

    constructor() {

    }

    producerTransport?: mediasoup.types.WebRtcTransport;
    consumerTransport?: mediasoup.types.WebRtcTransport;
    producers: mediasoup.types.Producer[] = [];
    consumers: mediasoup.types.Consumer[] = [];
    recordings?: Map<string, any> = new Map();
    room?: Room;

    restartInactiveTimer() {
        console.log(`restartInactiveTimer ${this.id}`);
        if (this.timerIdInactivity) {
            clearTimeout(this.timerIdInactivity);
        }

        this.timerIdInactivity = setTimeout(() => {
            if (this.onInactive) {
                this.onInactive(this);
            }
        }, this.timeOutInactivitySecs);

    }


    close() {
        console.log(`peer close() - ${this.id}`);


        if (this.timerIdInactivity) {
            console.log(`clearTimeout`);
            clearTimeout(this.timerIdInactivity);
        }

        this.producerTransport?.close();
        this.consumerTransport?.close();

        this.producers.forEach(p => {
            p.close();
        });

        this.consumers.forEach(c => {
            c.close();
        })

        this.producers = [];
        this.consumers = [];
        this.producerTransport = null;
        this.consumerTransport = null;


        if (this.room) {
            this.room.removePeer(this.id);
        }

    }

};