export interface Peer {
    peerId: string;
    displayName: string;
    hasVideo: boolean;
    hasAudio: boolean;
    stream: MediaStream;
  }