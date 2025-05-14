type ConnectionInfo = {
  key: string,
  pc: RTCPeerConnection;
  stream: MediaStream;
};

export class WebRTCClient {
  private DSTR = "WebRTCClient";

  localStream: MediaStream | null = null;
  private peerConnections: Map<string, ConnectionInfo> = new Map();

  //private onNewConnection: (conn: ConnectionInfo)=> void,
  constructor(private onIceCandidate: (key: string, candidate: RTCIceCandidate) => void
  ) {

  }

  async initLocalMedia(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return this.localStream;
  }

  closeAll(): void {
    for (const [key, remote] of this.peerConnections) {
      remote.pc.close();
    }
    this.peerConnections.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * creates or returns a peerconnection and media stream
   * @param key 
   * @returns 
   */
  createPeerConnection(key: string): ConnectionInfo {
    console.log(this.DSTR, "createPeerConnection");

    if (this.peerConnections.has(key)) {
      console.log(this.DSTR, "existing connnection.");
      return this.peerConnections.get(key);
    }

    console.log(this.DSTR, "new peer connnection.");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const remoteStream = new MediaStream();

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log(this.DSTR, "ontrack");
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      console.log(this.DSTR, "onicecandidate");
      if (event.candidate) {
        this.onIceCandidate(key, event.candidate);
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
    }

    const connInfo = { key: key, pc: pc, stream: remoteStream };
    this.peerConnections.set(key, connInfo);

    return connInfo;
  }

  //removes a peer connection
  removePeerConnection(key: string): void {
    console.log(this.DSTR, "removePeerConnection");
    const remote = this.peerConnections.get(key);
    if (remote) {
      remote.pc.close();
      this.peerConnections.delete(key);
    }
  }

  /**
   * creates a new webrtc offer, this initiates a webrtc stream
   * @param key 
   * @returns 
   */
  async createOffer(key: string): Promise<RTCSessionDescriptionInit> {
    console.log(this.DSTR, "createOffer");
    const remote = this.peerConnections.get(key);
    if (!remote){
      throw new Error(`Peer ${key} not found`);
    } 

    const offer = await remote.pc.createOffer();
    await remote.pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * generates a webrtc answer in reply to an offer, returns the peer connections localDescription
   * @param key 
   * @returns 
   */
  async createAnswer(key: string): Promise<RTCSessionDescription> {
    console.log(this.DSTR, "createAnswer");
    const remote = this.peerConnections.get(key);
    if (!remote) {
      throw new Error(`Peer ${key} not found`);
    }

    const answer = await remote.pc.createAnswer();
    await remote.pc.setLocalDescription(answer);

    return remote.pc.localDescription;
  }

  /**
   * sets the sdpDesc from an answer
   * @param key 
   * @param desc 
   */
  async setRemoteDescription(key: string, desc: RTCSessionDescriptionInit): Promise<void> {
    console.log(this.DSTR, "setRemoteDescription");
    const remote = this.peerConnections.get(key);
    if (!remote){
      throw new Error(`Peer ${key} not found`);
    }
    if(!remote.pc)   {
      throw new Error(`PeerConnection not found for :${key}`);
    }

    await remote.pc.setRemoteDescription(new RTCSessionDescription(desc));

  }

  /***
   * add ice candidate
   */
  async addIceCandidate(key: string, candidate: RTCIceCandidateInit): Promise<void> {
    console.log(this.DSTR, "addIceCandidate");
    const remote = this.peerConnections.get(key);
    if (!remote) {
      throw new Error(`Peer ${key} not found`);
    }
    await remote.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }


}
