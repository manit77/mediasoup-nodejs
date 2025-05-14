export interface Peer {
    peerId: string;
    trackingId: string;
    displayName: string;
    hasVideo: boolean;
    hasAudio: boolean;
    stream: MediaStream;
  }