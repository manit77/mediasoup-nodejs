import { setTimeout } from 'node:timers';
export class Peer {
    id;
    trackingid;
    displayName;
    authToken;
    timeOutInactivitySecs = 3600; //if not activity for 60 minutes terminate the peer
    timerIdInactivity;
    onInactive;
    constructor() {
    }
    producerTransport;
    consumerTransport;
    producers = [];
    consumers = [];
    recordings = new Map();
    room;
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
        });
        this.producers = [];
        this.consumers = [];
        this.producerTransport = null;
        this.consumerTransport = null;
        if (this.room) {
            this.room.removePeer(this.id);
        }
    }
}
;
