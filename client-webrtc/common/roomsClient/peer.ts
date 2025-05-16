import * as mediasoupClient from 'mediasoup-client';


export class Peer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";
  hasVideo: boolean = true;
  hasAudio: boolean = true;
  stream: MediaStream = null;
  consumers : mediasoupClient.types.Consumer[] = [];
  producers : mediasoupClient.types.Producer[]= [];

}