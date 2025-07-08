const DSTR = "WebRTCClient";

export type ConnectionInfo = {
  key: string,
  pc: RTCPeerConnection;
  stream: MediaStream;
};

export async function getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
  if (!constraints) {
    constraints = {
      audio: true
      , video: true
    }
  }
  console.log(DSTR, "getUserMedia", constraints);
  return await navigator.mediaDevices.getUserMedia(constraints);
}

export async function getDevices(): Promise<{ cameras: { id: string, label: string }[], mics: { id: string, label: string }[], speakers: { id: string, label: string }[] }> {
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

export class WebRTCClient {


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

  /**
   * speaker output is set on the audio or video element 
   * @param video 
   */
  async setSpeakerOutput(video: HTMLVideoElement, speakerDeviceId: string) {
    // Set the speaker/output device
    if (typeof (video as any).setSinkId === "function") {
      await (video as any).setSinkId(speakerDeviceId);
    } else {
      console.warn(DSTR, "setSinkId not supported in this browser.");
    }
  }

  addTracks(tracks: MediaStreamTrack[]) {
    if (!this.localStream) {
      this.localStream = new MediaStream();
    }
    console.log(DSTR, "addTrack");
    tracks.forEach(t => this.localStream.addTrack(t));
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
    console.log(DSTR, "createPeerConnection");

    if (this.peerConnections.has(key)) {
      console.log(DSTR, "existing connnection.");
      return this.peerConnections.get(key);
    }

    console.log(DSTR, "new peer connnection.");
    if (!config) {
      //default configs 
      config = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
    }
    const pc = new RTCPeerConnection(config);

    const remoteStream = new MediaStream();

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log(DSTR, `peer ${key} ontrack`);
      remoteStream.addTrack(event.track);
      if (this.onPeerTrack) {
        this.onPeerTrack(key, event.track)
      }

    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      console.log(DSTR, "onicecandidate");
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(key, event.candidate);
      }
    };

    const connInfo = { key: key, pc: pc, stream: remoteStream };
    this.peerConnections.set(key, connInfo);

    return connInfo;
  }

  publishTracks(key: string) {
    console.log(DSTR, `publishLocalStreamToPeer ${key}`);

    let conn = this.peerConnections.get(key);
    if (!conn) {
      console.error(DSTR, "peer connection not found.");
      return false;
    }

    if (!this.localStream) {
      console.error(DSTR, "localStream is null");
      return false;
    }

    //publish the tracks to the peer
    this.localStream.getTracks().forEach(localTrack => {
      if (!conn.pc.getSenders().some(sender => sender.track === localTrack)) {
        console.log(DSTR, `track added ${localTrack.kind} to ${key}`);
        conn.pc.addTrack(localTrack, this.localStream);
      }
    });

    return true;

  }

  //removes a peer connection
  removePeerConnection(key: string): void {
    console.log(DSTR, "removePeerConnection");
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
    console.log(DSTR, `createOffer ${key}`);
    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      throw new Error(`Peer ${key} not found`);
    }

    if (!connInfo.pc.getSenders()) {
      throw new Error(`not tracks published to this PeerConnection`);
    }

    const offer = await connInfo.pc.createOffer();
    await connInfo.pc.setLocalDescription(offer);
    console.log(DSTR, `LocalDescription set ${key}`);
    return offer;
  }

  /**
   * generates a webrtc answer in reply to an offer, returns the peer connections localDescription
   * @param key 
   * @returns 
   */
  async createAnswer(key: string): Promise<RTCSessionDescription> {
    console.log(DSTR, `createAnswer ${key}`);

    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      throw new Error(`Peer ${key} not found`);
    }

    //there needs to be at least one sender
    const hasLocalTracks = connInfo.pc.getSenders();
    if (!hasLocalTracks) {
      throw new Error(`no tracks published to this PeerConnection`);
    }

    const answer = await connInfo.pc.createAnswer();
    await connInfo.pc.setLocalDescription(answer);
    console.log(DSTR, `LocalDescription set ${key}`);
    return connInfo.pc.localDescription;
  }

  /**
   * sets the sdpDesc from an answer
   * @param key 
   * @param desc 
   */
  async setRemoteDescription(key: string, desc: RTCSessionDescriptionInit): Promise<boolean> {
    console.log(DSTR, `setRemoteDescription ${key}`);
    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      console.error(`Peer ${key} not found`);
      return false;
    }
    if (!connInfo.pc) {
      console.error(`PeerConnection not found for :${key}`);
    }

    await connInfo.pc.setRemoteDescription(new RTCSessionDescription(desc));
    console.log(DSTR, `RemoteDescription set ${key}`);
    return true;
  }

  /***
   * add ice candidate
   */
  async addIceCandidate(key: string, candidate: RTCIceCandidateInit): Promise<boolean> {
    console.log(DSTR, `addIceCandidate ${key}`);
    const connInfo = this.peerConnections.get(key);
    if (!connInfo) {
      console.error(`Peer ${key} not found`);
      return false;
    }
    await connInfo.pc.addIceCandidate(new RTCIceCandidate(candidate));
    console.log(DSTR, `candidate added ${key}`);
    return true;
  }


}
