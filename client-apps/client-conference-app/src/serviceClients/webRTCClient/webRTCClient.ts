type RemoteInfo = {
  pc: RTCPeerConnection;
  stream: MediaStream;
};

export class WebRTCClient {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RemoteInfo> = new Map();

  constructor(
    private onRemoteStream: (peerId: string, stream: MediaStream) => void,
    private onIceCandidate: (peerId: string, candidate: RTCIceCandidate) => void
  ) {}

  async initLocalMedia(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return this.localStream;
  }

  addPeer(peerId: string): void {
    if (this.peerConnections.has(peerId)) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const remoteStream = new MediaStream();

    pc.ontrack = (event: RTCTrackEvent) => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      this.onRemoteStream(peerId, remoteStream);
    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        this.onIceCandidate(peerId, event.candidate);
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
    }

    this.peerConnections.set(peerId, { pc, stream: remoteStream });
  }

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const remote = this.peerConnections.get(peerId);
    if (!remote) throw new Error(`Peer ${peerId} not found`);
    const offer = await remote.pc.createOffer();
    await remote.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const remote = this.peerConnections.get(peerId);
    if (!remote) throw new Error(`Peer ${peerId} not found`);
    const answer = await remote.pc.createAnswer();
    await remote.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(peerId: string, desc: RTCSessionDescriptionInit): Promise<void> {
    const remote = this.peerConnections.get(peerId);
    if (!remote) throw new Error(`Peer ${peerId} not found`);
    await remote.pc.setRemoteDescription(new RTCSessionDescription(desc));
  }

  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const remote = this.peerConnections.get(peerId);
    if (!remote) throw new Error(`Peer ${peerId} not found`);
    await remote.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  removePeer(peerId: string): void {
    const remote = this.peerConnections.get(peerId);
    if (remote) {
      remote.pc.close();
      this.peerConnections.delete(peerId);
    }
  }

  closeAll(): void {
    for (const [peerId, remote] of this.peerConnections) {
      remote.pc.close();
    }
    this.peerConnections.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }
}
