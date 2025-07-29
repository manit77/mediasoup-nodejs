import * as mediasoup from 'mediasoup';
import { Room } from './room.js';
import * as roomUtils from "./utils.js";
import { setTimeout, setInterval } from 'node:timers';
import chalk, { Chalk } from 'chalk';
import { AuthUserRoles, PeerTracksInfo } from '@rooms/rooms-models';

export class Peer {

    public id: string;
    public trackingId: string;
    public displayName: string;
    public authToken: string;
    public role = AuthUserRoles.guest;

    constructor() {

    }
    
    room?: Room;
    trackInfo: PeerTracksInfo = { isAudioEnabled: false, isVideoEnabled: false };


    close() {
        console.log(`peer close() - ${this.id} ${this.displayName}`);
        if (this.room) {
            this.room.removePeer(this);
        }
        console.log(`peer closed`);
    }

};