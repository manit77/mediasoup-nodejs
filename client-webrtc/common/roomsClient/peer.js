"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Peer = void 0;
class Peer {
    constructor() {
        this.peerId = "";
        this.trackingId = "";
        this.displayName = "";
        this.hasVideo = true;
        this.hasAudio = true;
        this.stream = null;
        this.consumers = [];
        this.producers = [];
    }
}
exports.Peer = Peer;
