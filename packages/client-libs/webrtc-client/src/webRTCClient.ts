export type ConnectionInfo = {
  key: string,
  pc: RTCPeerConnection;
  stream: MediaStream;
};

export class WebRTCClient {
  private DSTR = "WebRTCClient";

  private localStream: MediaStream | null = null;
  /**
   * map of all peer connections, 1 peerConnection per remote peer
   */
  private peerConnections: Map<string, ConnectionInfo> = new Map();

  //private onNewConnection: (conn: ConnectionInfo)=> void,
  onIceCandidate: (key: string, candidate: RTCIceCandidate) => void;
  onPeerTrack: (key: string, track: MediaStreamTrack) => void;

  constructor() {

  }

  async getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  async getDevices(): Promise<{ cameras: { id: string, label: string }[], mics: { id: string, label: string }[], speakers: { id: string, label: string }[] }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras: { id: string, label: string }[] = [];
      const mics: { id: string, label: string }[] = [];
      const speakers: { id: string, label: string }[] = [];
      devices.forEach(device => {
        if (device.kind === 'videoinput') cameras.push({ id: device.deviceId, label: device.label || `Camera ${cameras.length + 1}` });
        else if (device.kind === 'audioinput') mics.push({ id: device.deviceId, label: device.label || `Mic ${mics.length + 1}` });
        else if (device.kind === 'audiooutput') speakers.push({ id: device.deviceId, label: device.label || `Speaker ${speakers.length + 1}` });
      });

      return { cameras, mics, speakers };
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }

    return null;
  };

  /**
   * speaker output is set on the audio or video element 
   * @param video 
   */
  async setSpeakerOutput(video: HTMLVideoElement, speakerDeviceId: string) {
    // Set the speaker/output device
    if (typeof video.setSinkId === "function") {
      await video.setSinkId(speakerDeviceId);
    } else {
      console.warn("setSinkId not supported in this browser.");
    }
  }

  setLocalstream(stream: MediaStream) {
    console.log(this.DSTR, "setLocalStream");
    if (stream === this.localStream) {
      return;
    }
    this.localStream = stream;
    console.log(this.DSTR, "localSteam set");

  }

  closeAll(): void {
    for (const [key, connInfo] of this.peerConnections) {
      connInfo.pc.close();
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
  getOrCreatePeerConnection(key: string, config?: RTCConfiguration): ConnectionInfo {
    console.log(this.DSTR, "createPeerConnection");

    if (this.peerConnections.has(key)) {
      console.log(this.DSTR, "existing connnection.");
      return this.peerConnections.get(key);
    }

    console.log(this.DSTR, "new peer connnection.");
    if (!config) {
      //default configs 
      config = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
    }
    const pc = new RTCPeerConnection(config);

    const remoteStream = new MediaStream();

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log(this.DSTR, `peer ${key} ontrack`);
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
        if (this.onPeerTrack) {
          this.onPeerTrack(key, track)
        }
      });

    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      console.log(this.DSTR, "onicecandidate");
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(key, event.candidate);
      }
    };

    const connInfo = { key: key, pc: pc, stream: remoteStream };
    this.peerConnections.set(key, connInfo);

    return connInfo;
  }

  publishLocalStreamToPeer(key: string) {
    console.log(this.DSTR, `publishLocalStreamToPeer ${key}`);

    let conn = this.peerConnections.get(key);
    if (!conn) {
      console.error(this.DSTR, "peer connection not found.");
      return;
    }

    if (!this.localStream) {
      console.error(this.DSTR, "localStream is null");
      return;
    }

    //publish the local stream to the remote peer connection
    this.localStream.getTracks().forEach(localTrack => {
      if (!conn.pc.getSenders().some(sender => sender.track === localTrack)) {
        console.log(this.DSTR, `track added ${localTrack.kind} to ${key}`);
        conn.pc.addTrack(localTrack, this.localStream);
      }
    });

  }

  //removes a peer connection
  removePeerConnection(key: string): void {
    console.log(this.DSTR, "removePeerConnection");
    const connInfo = this.peerConnections.get(key);
    if (connInfo) {
      connInfo.pc.close();
      this.peerConnections.delete(key);
    }
  }

  /**
   * creates a new webrtc offer, this initiates a webrtc stream
   * @param key 
   * @returns 
   */
  async createOffer(key: string): Promise<RTCSessionDescriptionInit> {
    console.log(this.DSTR, `createOffer ${key}`);
    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      throw new Error(`Peer ${key} not found`);
    }

    const hasLocalTracks = connInfo.pc.getSenders().some(sender => sender.track);
    if (!hasLocalTracks) {
      throw new Error(`not tracks published to this PeerConnection`);
    }

    const offer = await connInfo.pc.createOffer();
    await connInfo.pc.setLocalDescription(offer);
    console.log(this.DSTR, `LocalDescription set ${key}`);
    return offer;
  }

  /**
   * generates a webrtc answer in reply to an offer, returns the peer connections localDescription
   * @param key 
   * @returns 
   */
  async createAnswer(key: string): Promise<RTCSessionDescription> {
    console.log(this.DSTR, `createAnswer ${key}`);

    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      throw new Error(`Peer ${key} not found`);
    }
    //local stream is required to be published to the PC
    const hasLocalTracks = connInfo.pc.getSenders().some(sender => sender.track);
    if (!hasLocalTracks) {
      throw new Error(`no tracks published to this PeerConnection`);
    }

    const answer = await connInfo.pc.createAnswer();
    await connInfo.pc.setLocalDescription(answer);
    console.log(this.DSTR, `LocalDescription set ${key}`);
    return connInfo.pc.localDescription;
  }

  /**
   * sets the sdpDesc from an answer
   * @param key 
   * @param desc 
   */
  async setRemoteDescription(key: string, desc: RTCSessionDescriptionInit): Promise<void> {
    console.log(this.DSTR, `setRemoteDescription ${key}`);
    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      throw new Error(`Peer ${key} not found`);
    }
    if (!connInfo.pc) {
      throw new Error(`PeerConnection not found for :${key}`);
    }

    await connInfo.pc.setRemoteDescription(new RTCSessionDescription(desc));
    console.log(this.DSTR, `RemoteDescription set ${key}`);

  }

  /***
   * add ice candidate
   */
  async addIceCandidate(key: string, candidate: RTCIceCandidateInit): Promise<void> {
    console.log(this.DSTR, `addIceCandidate ${key}`);
    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      throw new Error(`Peer ${key} not found`);
    }
    await connInfo.pc.addIceCandidate(new RTCIceCandidate(candidate));
    console.log(this.DSTR, `candidate added ${key}`);
  }


}
