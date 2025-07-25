import * as mediasoupClient from 'mediasoup-client';
import { Consumer, Producer } from 'mediasoup-client/types';
import { PeerTracksInfo, UniqueMap } from '@rooms/rooms-models';

export interface IPeer {
  peerId: string;
  trackingId: string;
  displayName: string;
  tracksInfo: PeerTracksInfo
}

export class Peer implements IPeer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";
  tracksInfo: PeerTracksInfo = { isAudioEnabled: false, isVideoEnabled: false }
}
