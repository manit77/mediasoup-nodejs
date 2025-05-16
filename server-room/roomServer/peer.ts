import * as mediasoup from 'mediasoup';
import { Room } from './room';

export class Peer {

    public id: string;
    public trackingid: string;
    public displayName: string;

    timeOutInactivitySecs = 3600; //if not activity for 60 minutes terminate the peer
    timerIdInactivity: NodeJS.Timeout;

    onPeerInactive: (peer: Peer) => void;
    
    constructor() {

    }

    producerTransport?: mediasoup.types.WebRtcTransport;
    consumerTransport?: mediasoup.types.WebRtcTransport;
    producers: mediasoup.types.Producer[] = [];
    consumers: mediasoup.types.Consumer[] = [];
    recordings?: Map<string, any> = new Map();
    room?: Room;

    restartInactiveTimer() {

        if (this.timerIdInactivity) {
            clearTimeout(this.timerIdInactivity);
        }

        setTimeout(() => {
            if (this.onPeerInactive) {
                this.onPeerInactive(this);
            }
        }, this.timeOutInactivitySecs);

    }

};