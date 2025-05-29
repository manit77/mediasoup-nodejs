import * as mediasoupClient from 'mediasoup-client';
import {
  AuthUserNewTokenMsg,
  AuthUserNewTokenResultMsg,
  ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg
  , ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg
  , ErrorMsg, IMsg, OkMsg, payloadTypeClient, payloadTypeServer, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg
  , RegisterPeerMsg, RegisterPeerResultMsg, RoomClosedMsg, RoomConfig, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg
  , RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
  RoomType,
  RTCAnswerMsg,
  RTCIceMsg,
  RTCOfferMsg
} from "@rooms/rooms-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { WebRTCClient, ConnectionInfo } from "@rooms/webrtc-client";
import { Transport } from 'mediasoup-client/types';

export interface JoinInfo { roomId: string, roomToken: string };
export interface DeviceInfo {
  id: string;
  label: string;
}

export class LocalPeer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";

  roomId: string = "";
  roomType: RoomType = RoomType.p2p;
  authToken: string = "";
  roomToken: string = "";

  stream: MediaStream = null;

  transportSend: mediasoupClient.types.Transport;
  transportReceive: mediasoupClient.types.Transport;
  consumers: mediasoupClient.types.Consumer[] = [];
  producers: mediasoupClient.types.Producer[] = [];
}

export class Peer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";

  stream?: MediaStream;
  rtc_Connection?: ConnectionInfo;

  producers: {
    id: string, kind: "audio" | "video"
  }[] = [];
}

export type MediaDeviceOptions = {
  videoDeviceId?: string;
  audioDeviceId?: string;
  outputDevice?: string;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
  resolution?: {
    width: number;
    height: number;
    frameRate: number;
  };
};

export class RoomsClient {

  ws: WebSocketClient;
  rtcClient: WebRTCClient;
  serviceToken: string = ""; //used to request an authtoken
  localPeer: LocalPeer = new LocalPeer();

  peers: Peer[] = [];
  audioEnabled = true;
  videoEnabled = true;

  device: mediasoupClient.types.Device;
  iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ]

  config = {
    wsURI: "wss://localhost:3000",
  }

  onRoomJoinedEvent: (roomId: string) => void;
  onTransportsReadyEvent: (transport: mediasoupClient.types.Transport) => void;
  onRoomPeerJoinedEvent: (roomId: string, peer: Peer) => void;
  onPeerNewTrackEvent: (peer: Peer, track: MediaStreamTrack) => void;
  onRoomPeerLeftEvent: (roomId: string, peer: Peer) => void;
  onRoomClosedEvent: (roomId: string, peers: Peer[]) => void;

  init = async (uri: string) => {
    this.config.wsURI = uri;
    this.initMediaSoupDevice();

    this.rtcClient = new WebRTCClient();
    this.rtcClient.onIceCandidate = this.rtc_SendIceCandidate;
    this.rtcClient.onPeerTrack = this.rtc_OnPeerTrack;

  };

  writeLog = async (...params: any) => {
    console.log("RoomsClient", ...params);
  };

  private initMediaSoupDevice = () => {
    this.writeLog("initMediaSoupDevice=");
    if (this.device) {
      this.writeLog("device already initialized");
      return;
    }

    try {
      // In real implementation, this would use the actual mediasoup-client
      this.device = new mediasoupClient.Device();
      this.writeLog("MediaSoup device initialized");
    } catch (error) {
      this.writeLog(`Error initializing MediaSoup: ${error.message}`);
    }
  };

  onSocketEvent = async (event: any) => {

    let msgIn = JSON.parse(event.data);
    this.writeLog("-- onmessage", msgIn.type, msgIn);

    try {
      switch (msgIn.type) {
        case payloadTypeServer.authUserNewTokenResult:
          this.onAuthUserNewTokenResult(msgIn);
          break;
        case payloadTypeServer.registerPeerResult:
          this.onRegisterResult(msgIn);
          break;
        case payloadTypeServer.producerTransportCreated:
          this.sfu_onProducerTransportCreated(msgIn);
          break;
        case payloadTypeServer.consumerTransportCreated:
          this.sfu_onConsumerTransportCreated(msgIn);
          break;
        case payloadTypeServer.roomNewTokenResult:
          this.onRoomNewTokenResult(msgIn);
          break;
        case payloadTypeServer.roomJoinResult:
          this.onRoomJoinResult(msgIn);
          break;
        case payloadTypeServer.roomNewPeer:
          this.onRoomNewPeer(msgIn);
          break;
        case payloadTypeServer.roomNewProducer:
          this.sfu_onRoomNewProducer(msgIn);
          break;
        case payloadTypeServer.roomPeerLeft:
          this.onRoomPeerLeft(msgIn);
          break;
        case payloadTypeServer.produced:
          this.sfu_onProduced(msgIn);
          break;
        case payloadTypeServer.consumed:
          this.sfu_onConsumed(msgIn);
          break;
        case payloadTypeServer.roomClosed:
          this.onRoomClosed(msgIn);
          break;
        case payloadTypeServer.rtc_offer: {
          this.onRTCOffer(msgIn);
          break;
        }
        case payloadTypeServer.rtc_answer: {
          this.onRTCAnswer(msgIn);
          break;
        }
        case payloadTypeServer.rtc_ice: {
          this.onRTCIce(msgIn);
          break;
        }
      }
    } catch (err) {
      console.error(err);
    }

  };

  connect = async (wsURI: string = "") => {
    if (wsURI) {
      this.config.wsURI = wsURI;
    }

    if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
      this.writeLog("socket already " + this.ws.state)
      return;
    }

    this.writeLog("connect " + this.config.wsURI);
    this.ws = new WebSocketClient();

    const onOpen = async () => {
      this.writeLog("websocket open " + this.config.wsURI);
    };

    const onClose = async () => {
      this.writeLog("websocket closed");
    };

    this.ws.addEventHandler("onopen", onOpen);
    this.ws.addEventHandler("onmessage", this.onSocketEvent);
    this.ws.addEventHandler("onclose", onClose);
    this.ws.addEventHandler("onerror", onClose);

    this.ws.connect(this.config.wsURI, true);

  };

  async getUserMedia(opts?: MediaDeviceOptions): Promise<MediaStream> {

    if (!opts) {
      opts = {
        resolution: {
          frameRate: 15,
          height: 480,
          width: 640
        },
        audioEnabled: true,
        videoEnabled: true
      }
    }

    const constraints: MediaStreamConstraints = {
      video: opts.videoEnabled
        ? {
          deviceId: opts.videoDeviceId ? { exact: opts.videoDeviceId } : undefined,
          width: opts.resolution?.width,
          height: opts.resolution?.height,
          frameRate: opts.resolution?.frameRate
        }
        : false,
      audio: opts.audioEnabled
        ? { deviceId: opts.audioDeviceId ? { exact: opts.audioDeviceId } : undefined }
        : false
    };

    if (this.localPeer.stream) {
      this.writeLog("stream already exists");
      return;
    }

    try {
      this.localPeer.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localPeer.stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
      throw error;
    }
  };

  async getDevices(): Promise<{ cameras: DeviceInfo[], mics: DeviceInfo[], speakers: DeviceInfo[] }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras: DeviceInfo[] = [];
      const mics: DeviceInfo[] = [];
      const speakers: DeviceInfo[] = [];
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

  /**
  * resolves when the socket is connected
  * @param wsURI 
  * @returns 
  */
  waitForConnect = async (wsURI: string = ""): Promise<IMsg> => {
    this.writeLog(`waitForConnect() ${wsURI}`);
    return new Promise<IMsg>((resolve, reject) => {

      try {
        if (wsURI) {
          this.config.wsURI = wsURI;
        }

        if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
          this.writeLog("socket already created. current state: " + this.ws.state);
          resolve(new OkMsg("connected"));
          return;
        }

        this.ws = new WebSocketClient();
        this.writeLog("waitForConnect() - " + this.config.wsURI + " state:" + this.ws.state);

        const onOpen = async () => {
          this.writeLog("websocket onOpen " + this.config.wsURI);
          resolve(new OkMsg("connected"));
        };

        const onClose = async () => {
          this.writeLog("websocket onClose");
          resolve(new OkMsg("connected"));
        };

        this.ws.addEventHandler("onopen", onOpen);
        this.ws.addEventHandler("onmessage", this.onSocketEvent);
        this.ws.addEventHandler("onclose", onClose);
        this.ws.addEventHandler("onerror", onClose);

        this.ws.connect(this.config.wsURI, true);
      } catch (err: any) {
        console.error(err);
        resolve(new ErrorMsg("failed to connect"));
      }

    });
  };

  /**
   * register a client connection and wait for a result
   * @param trackingId 
   * @param displayName 
   * @returns 
   */
  waitForRegister = async (trackingId: string, displayName: string): Promise<IMsg> => {
    return new Promise<IMsg>(async (resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to register"), 5000);

        const onmessage = (event: any) => {
          let msg = JSON.parse(event.data);
          this.writeLog("--waitForRegister() - onmessage", msg);
          if (msg.type == payloadTypeServer.registerPeerResult) {

            let msgIn: RegisterPeerResultMsg = msg;
            if (msgIn.data) {
              this.localPeer.peerId = msgIn.data.peerId;
            }

            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", onmessage);
            resolve(msgIn);

          }
        };
        this.ws.addEventHandler("onmessage", onmessage);
        this.register(this.localPeer.authToken, trackingId, displayName);
      } catch (err: any) {
        console.error(err);
        resolve(new ErrorMsg("failed to register"));
      }
    });
  };

  waitForNewRoomToken = async (expiresInMin: number): Promise<IMsg> => {
    return new Promise<IMsg>((resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to create new room token"), 5000);

        const onmessage = (event: any) => {

          let msg = JSON.parse(event.data);
          this.writeLog("waitForNewRoomToken() -- onmessage", msg);

          if (msg.type == payloadTypeServer.roomNewTokenResult) {
            let msgIn: RoomNewTokenResultMsg = msg;
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", onmessage);
            resolve(msgIn);
          }

        };

        this.ws.addEventHandler("onmessage", onmessage);

        this.roomNewToken(expiresInMin);

      } catch (err: any) {
        resolve(new ErrorMsg("unable to get data"));
      }
    });
  };

  waitForNewRoom = async (roomType: RoomType, maxPeers: number, maxRoomDurationMinutes: number): Promise<IMsg> => {
    return new Promise<IMsg>((resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to create new room"), 5000);

        const onmessage = (event: any) => {

          let msg = JSON.parse(event.data);
          this.writeLog("waitForNewRoom() -- onmessage", msg);

          if (msg.type == payloadTypeServer.roomNewResult) {
            let msgIn: RoomNewResultMsg = msg;
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", onmessage);
            resolve(msgIn);
          }

        };

        this.ws.addEventHandler("onmessage", onmessage);

        this.roomNew(roomType, maxPeers, maxRoomDurationMinutes);

      } catch (err: any) {
        console.error(err);
        resolve(new ErrorMsg("failed to create new room"));
      }
    });
  };

  /**
   * join an existing room and wait for a result
   * @param roomid 
   * @param roomToken 
   * @returns 
   */
  waitForRoomJoin = async (roomid: string, roomToken: string): Promise<IMsg> => {

    //remove the old event hanlder    
    return new Promise<IMsg>((resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to join room"), 5000);

        const onmessage = (event: any) => {
          this.writeLog("-- onmessage", event.data);
          let msg = JSON.parse(event.data);

          if (msg.type == payloadTypeServer.roomJoinResult) {
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", onmessage);
            let msgIn = msg as RoomJoinResultMsg;
            resolve(msgIn);
          }
        };

        this.ws.addEventHandler("onmessage", onmessage);
        this.roomJoin(roomid, roomToken);
      } catch (err: any) {
        console.log(err);
        resolve(new ErrorMsg("failed to join room"));
      }
    });
  };

  /**
   * when you join a room transports need be created and published to a room
   */
  private waitForRoomTransports = async (): Promise<IMsg> => {

    if (!this.localPeer.roomId) {
      this.writeLog("room is required for creating transports");
      return new ErrorMsg("cannot create transports before joining a room.");
    }

    if (this.localPeer.roomType != "sfu") {
      this.writeLog("invalid room type, cannot call transports");
      return new ErrorMsg("cannot create transports for this roomtype.");
    }

    let waitFunc = () => {
      return new Promise<IMsg>((resolve, reject) => {
        let transTrack = { recv: false, send: false };

        let timerid = setTimeout(() => {
          console.log("transport timed out.");
          resolve(new ErrorMsg("transport timeout"));
        }, 5000);

        this.onTransportsReadyEvent = (transport: Transport) => {

          try {

            if (transport.direction == "recv") {
              transTrack.recv = true;
            } else {
              transTrack.send = true;
            }
            if (transTrack.recv && transTrack.send) {
              clearTimeout(timerid);
              resolve(new OkMsg("transportCreated"));
            }
          } catch (err) {
            console.log(err);
            clearTimeout(timerid);
            resolve(new ErrorMsg("failed to create transport"));
          }
        }

        this.sfu_createConsumerTransport();
        this.sfu_createProducerTransport();
      });
    };

    let waitResult = await waitFunc();
    return waitResult;

  };

  waitForTransportConnected = async (transport: mediasoupClient.types.Transport): Promise<IMsg> => {
    this.writeLog("-- waitForTransportConnected created " + transport.direction)
    return new Promise<IMsg>((resolve, reject) => {

      let timeoutId = setTimeout(() => {
        console.log("waitForTransportConnected timeout " + transport.direction);
        resolve(new ErrorMsg("tranport timed out"));
      }, 5000);

      try {
        if (transport.connectionState === 'connected') {
          clearTimeout(timeoutId);
          resolve(new OkMsg("connected"));
          return;
        }
        const onStateChange = (state: string) => {
          this.writeLog("connectionstatechange transport: " + state);
          if (state === 'connected') {
            clearTimeout(timeoutId);
            resolve(new OkMsg("connected"));
            transport.off('connectionstatechange', onStateChange);
          } else if (state === 'failed' || state === 'closed') {
            clearTimeout(timeoutId);
            resolve(new ErrorMsg("failed to connect"));
            transport.off('connectionstatechange', onStateChange);
          }
        };
        transport.on('connectionstatechange', onStateChange);
      } catch (err: any) {
        console.error(err);
        clearTimeout(timeoutId);
        resolve(new ErrorMsg("failed to connect"));
      }
    });
  };

  /**
   * if sfu, consume the producers in the room
   * if rtc, create offer
   * @param peer
   * @returns 
   */
  async sfu_consumePeerProducers(peer: Peer) {
    this.writeLog(`connectToPeer() ${peer.peerId}`);

    if (!this.localPeer.roomId) {
      this.writeLog("cannot connect to a peer. not in a room.");
      return;
    }

    if (this.localPeer.roomType == "sfu") {

      if (!this.localPeer.transportReceive || !this.localPeer.transportSend) {
        this.writeLog("transports have not been created.");
        return;
      }

      //consume transports
      if (peer.producers && peer.producers.length > 0) {
        this.writeLog("peer has no producers");
      }

      peer.producers.forEach(p => {
        this.sfu_consumeProducer(peer.peerId, p.id);
      });

    }

  }

  disconnect = () => {
    this.writeLog("disconnect");
    for (let peer of this.peers) {
      peer.rtc_Connection?.pc.close();
    }

    this.localPeer.consumers?.forEach(c => c.close());
    this.localPeer.producers?.forEach(c => c.close());

    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend?.close();

    this.ws.disconnect();

    //reset the local peer
    this.localPeer = new LocalPeer();
  };

  send = (msg: any) => {
    this.writeLog("send", msg.type, msg);
    this.ws.send(JSON.stringify(msg));
  };

  toggleAudio = () => {
    this.audioEnabled = !this.audioEnabled;
    this.writeLog(`Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
  };

  toggleVideo = () => {
    this.videoEnabled = !this.videoEnabled;
    this.writeLog(`Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
  };

  addPeer = (peer: Peer) => {
    this.writeLog(`addPeer() ${peer.peerId} ${peer.trackingId}`);

    if (this.peers.find(p => p.peerId === peer.peerId)) {
      this.writeLog("peer already exists");
      return;
    }

    if (peer.peerId === this.localPeer.peerId) {
      this.writeLog(`cannot add yourself as a peerid: ${this.localPeer.peerId}`);
      return;
    }

    this.peers.push(peer);

  };

  removePeer = (peer: Peer) => {
    this.writeLog(`removePeer() ${peer.peerId}`);

    let idx = this.peers.findIndex(p => p == peer);
    if (idx > -1) {
      this.peers.splice(idx, 1);
    }
  };

  getPeer = (peerId: string) => {
    return this.peers.find(p => p.peerId == peerId);
  };

  /**
   * if sfu, sends the localPeer tracks to the server 
   * if rtc, publish local streams to the remote peerConnection
   * @returns 
   */
  sfu_publishLocalStream = async () => {
    console.log(`publishLocalStream() ${this.localPeer.roomType}`);

    if (!this.localPeer.roomId) {
      this.writeLog("not in a room.");
      return;
    }

    if (this.localPeer.roomType != "sfu") {
      this.writeLog("invalid roomType.");
      return;
    }

    if (!this.localPeer.transportSend) {
      this.writeLog("transportSend is required.");
      return;
    }

    let tracks = this.localPeer.stream.getTracks();
    console.log("tracks=" + tracks.length);
    tracks.forEach(track => this.localPeer.transportSend.produce({ track: track }));

  };

  private addRemoteTrack = (peerId: string, track: MediaStreamTrack) => {
    this.writeLog("addRemoteTrack()");

    track.enabled = true;

    let peer = this.peers.find(p => p.peerId === peerId);
    if (!peer) {
      this.writeLog(`addRemoteTrack() - peer not found, peerId: ${peerId}`);
      return;
    }

    if (this.onPeerNewTrackEvent) {
      this.onPeerNewTrackEvent(peer, track);
    } else {
      if (!peer.stream) {
        peer.stream = new MediaStream();
      }
      peer.stream.addTrack(track);
    }

  };

  removeRemoteStream = (peer: Peer) => {
    this.writeLog("removeRemoteStream()");
    if (peer.stream) {
      peer.stream.getTracks().forEach((track) => track.stop());
      peer.stream = null;
    }
  };

  getAuthoken = (serviceToken: string) => {
    this.writeLog(`-- getAuthoken `);
    //the server may reject this request due to server settings
    //in a typical setting, your application will request an authtoken from the rooms server using a service auth token

    let msg = new AuthUserNewTokenMsg();
    msg.data.authToken = serviceToken;
    msg.data.expiresInMin = 60;

    this.send(msg);

  };

  waitForGetAuthoken = (serviceToken: string): Promise<IMsg> => {
    console.log("waitForGetAuthoken()");

    return new Promise<IMsg>(async (resolve, reject) => {

      let timerid = setTimeout(() => reject("failed to get authtoken"), 5000);

      const onmessage = (event: any) => {

        try {
          let msg = JSON.parse(event.data);
          if (msg.type == payloadTypeServer.authUserNewTokenResult) {
            this.writeLog("-- waitForGetAuthoken() - onmessage", msg);
            let msgIn = msg as AuthUserNewTokenResultMsg;
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", onmessage);
            if (msgIn.data.authToken) {
              resolve(new OkMsg("token received"));
              return;
            }
            resolve(new ErrorMsg("failed to get token"));
          }
        } catch (err) {
          console.error(err);
          resolve(new ErrorMsg("error getting token"));
        }

      };

      this.ws.addEventHandler("onmessage", onmessage);

      this.getAuthoken(serviceToken);

    });
  };

  register = (authToken: string, trackingId: string, displayName: string) => {
    this.writeLog(`-- register `);

    if (this.localPeer.peerId) {
      this.writeLog(`-- register, already registered. ${this.localPeer.peerId}`);
      return false;
    }

    if (!authToken) {
      this.writeLog("-- register, authtoken is required.");
      return false;
    }

    this.localPeer.trackingId = trackingId;
    this.localPeer.displayName = displayName;

    let msg = new RegisterPeerMsg();
    msg.data = {
      authToken: authToken,
      displayName: this.localPeer.displayName
    }

    this.send(msg);

    return true;
  };

  private onAuthUserNewTokenResult = async (msgIn: AuthUserNewTokenResultMsg) => {
    console.log("onAuthUserNewTokenResult()");

    if (msgIn.data.authToken) {
      this.localPeer.authToken = msgIn.data.authToken;
    } else {
      console.log(`Error getting authtoken ${msgIn.data.error}`);
    }

  };

  private onRegisterResult = async (msgIn: RegisterPeerResultMsg) => {

    this.writeLog(`-- onRegisterResult() peerId: ${msgIn.data?.peerId}`);

    if (msgIn.data.error) {
      this.writeLog(`register failed ${msgIn.data.error}`);
      this.localPeer.peerId = "";
      return;
    }

    this.localPeer.peerId = msgIn.data!.peerId;

  };

  sfu_createProducerTransport = (): boolean => {
    this.writeLog("-- createProducerTransport");

    if (this.localPeer.roomType != "sfu") {
      this.writeLog("invalid roomType.");
      return false;
    }

    let msg = new CreateProducerTransportMsg();
    this.send(msg);
    return true;
  };

  sfu_createConsumerTransport = (): boolean => {
    this.writeLog("-- createConsumerTransport");

    if (this.localPeer.roomType != "sfu") {
      this.writeLog("invalid roomType.");
      return false;
    }

    let msg = new CreateConsumerTransportMsg();
    this.send(msg);
    return true;
  };

  roomNewToken = (expiresInMin: number = 60) => {
    this.writeLog(`roomNewToken`);

    let msg = new RoomNewTokenMsg();
    msg.data = {
      authToken: this.localPeer.authToken,
      expiresInMin: expiresInMin
    };

    this.send(msg);
  };

  private onRoomNewTokenResult = async (msgIn: RoomNewTokenResultMsg) => {

    this.writeLog("-- onRoomNewTokenResult()");
    if (msgIn.data.error) {
      this.writeLog(msgIn.data.error);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId
    this.localPeer.roomToken = msgIn.data.roomToken;
    this.writeLog("room token set " + this.localPeer.roomToken, this.localPeer.roomId);

  }

  roomNew = (roomType: RoomType, maxPeers: number, maxRoomDurationMinutes: number) => {
    this.writeLog(`roomNew ${roomType} ${maxPeers} ${maxRoomDurationMinutes}`)
    let config = new RoomConfig();
    config.roomType = roomType;
    config.maxPeers = maxPeers;
    config.maxRoomDurationMinutes = maxRoomDurationMinutes;
    config.newRoomTokenExpiresInMinutes = maxRoomDurationMinutes;
    config.timeOutNoParticipantsSecs = 30;
    config.closeRoomOnPeerCount = 0; //close the room when there are zero participants

    let msg = new RoomNewMsg();
    msg.data = {
      authToken: this.localPeer.authToken,
      peerId: this.localPeer.peerId,
      roomId: this.localPeer.roomId,
      roomToken: this.localPeer.roomToken,
      roomConfig: config
    };

    this.send(msg);
  };

  roomJoin = (roomid: string, roomToken: string) => {
    this.writeLog(`roomJoin ${roomid} ${roomToken}`)
    let msg = new RoomJoinMsg();
    msg.data = {
      roomId: roomid,
      roomToken: roomToken
    };
    this.send(msg);
  };

  private onRoomJoinResult = async (msgIn: RoomJoinResultMsg) => {

    this.writeLog("-- onRoomJoinResult()");
    if (msgIn.data.error) {
      this.writeLog(msgIn.data.error);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId;
    this.localPeer.roomType = msgIn.data.roomType;

    this.writeLog("joined room " + msgIn.data!.roomId);
    this.writeLog(`-- onRoomJoinResult() peers : ${msgIn.data?.peers.length} roomType:${msgIn.data.roomType}`);


    if (msgIn.data.roomType == "sfu") {
      if (!this.device.loaded) {
        this.writeLog("loading device with rtpCapabilities");
        await this.device.load({ routerRtpCapabilities: msgIn.data.rtpCapabilities });
      }

      let transports = await this.waitForRoomTransports();

      if (transports.data.error) {
        console.log("unable to create transports");
        return;
      }

      await this.sfu_publishLocalStream();

    } else {
      this.rtcClient.setLocalstream(this.localPeer.stream);
    }


    if (this.onRoomJoinedEvent) {
      this.onRoomJoinedEvent(this.localPeer.roomId);
    }

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let peer of msgIn.data.peers) {

        let newpeer: Peer = new Peer();

        newpeer.peerId = peer.peerId;
        if (this.localPeer.roomType == RoomType.sfu) {
          newpeer.producers.push(...peer.producers.map(p => ({ id: p.producerId, kind: p.kind })));
        } else {
          newpeer.rtc_Connection = this.rtcClient.getOrCreatePeerConnection(newpeer.peerId);
        }

        this.addPeer(newpeer);

        this.writeLog(peer.peerId);
        this.writeLog("-- onRoomJoinResult producers :" + peer.producers?.length);

      }
    }


    for (let peer of this.peers) {

      this.sfu_consumePeerProducers(peer);

      if (this.onRoomPeerJoinedEvent) {
        this.onRoomPeerJoinedEvent(this.localPeer.roomId, peer);
      }
    }

  }

  roomLeave = async () => {
    let msg = new RoomLeaveMsg();
    msg.data = {
      roomId: this.localPeer.roomId,
      roomToken: ""
    };
    this.send(msg);
    this.roomClose();
  };

  isInRoom = () => {
    return !!this.localPeer.roomId;
  };

  dispose = () => {

    this.writeLog("disposeRoom()");
    if (this.localPeer.stream) {
      let tracks = this.localPeer.stream.getTracks();
      tracks.forEach((track) => {
        this.localPeer.stream.removeTrack(track);
      });
    }

    this.localPeer.consumers.forEach(c => c.close());
    this.localPeer.producers.forEach(c => c.close());
    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend?.close();

    this.localPeer.transportReceive = null;
    this.localPeer.transportSend = null;
    this.peers = [];
    this.localPeer = new LocalPeer();
    this.ws.disconnect();
    this.writeLog("dispose() - complete");

  };

  private sfu_onConsumerTransportCreated = async (msgIn: ConsumerTransportCreatedMsg) => {
    this.writeLog("-- onConsumerTransportCreated");

    this.localPeer.transportReceive = this.device.createRecvTransport({
      id: msgIn.data.transportId,
      iceServers: msgIn.data.iceServers ?? this.iceServers,
      iceCandidates: msgIn.data.iceCandidates,
      iceParameters: msgIn.data.iceParameters,
      dtlsParameters: msgIn.data.dtlsParameters,
      iceTransportPolicy: msgIn.data.iceTransportPolicy
    });

    this.localPeer.transportReceive.on('connect', ({ dtlsParameters }, callback) => {
      let msg = new ConnectConsumerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      }
      this.send(msg);
      callback();
    });

    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.localPeer.transportReceive);
    }
  }

  private sfu_onProducerTransportCreated = async (msgIn: ProducerTransportCreatedMsg) => {
    this.writeLog("-- onProducerTransportCreated");

    //the server has created a transport
    //create a client transport to connect to the server transport
    this.localPeer.transportSend = this.device.createSendTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data.iceServers ?? this.iceServers,
      iceCandidates: msgIn.data.iceCandidates,
      iceParameters: msgIn.data.iceParameters,
      dtlsParameters: msgIn.data.dtlsParameters,
      iceTransportPolicy: msgIn.data.iceTransportPolicy
    });

    this.localPeer.transportSend.on("connect", ({ dtlsParameters }, callback) => {
      this.writeLog("-- sendTransport connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      };
      this.send(msg);

      callback();

    });

    this.localPeer.transportSend.on('produce', ({ kind, rtpParameters }, callback) => {

      this.writeLog("-- sendTransport produce");

      //fires when we call produce with local tracks
      let msg = new ProduceMsg();
      msg.data = {
        kind: kind,
        rtpParameters: rtpParameters
      }
      this.send(msg);
      //what is the id value???
      callback({ id: 'placeholder' });
    });

    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.localPeer.transportSend);
    }

  }

  private onRoomNewPeer = async (msgIn: RoomNewPeerMsg) => {
    this.writeLog("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    this.writeLog(`new PeeerJoined ${msgIn.data?.peerId} `);

    let newPeer = new Peer();
    newPeer.peerId = msgIn.data.peerId;

    this.addPeer(newPeer);

    if (this.localPeer.roomType == "sfu") {

      await this.sfu_publishLocalStream();

      if (msgIn.data?.producers) {
        for (let producer of msgIn.data.producers) {
          this.sfu_consumeProducer(msgIn.data.peerId, producer.producerId);
        }
      }
    } else {

      newPeer.rtc_Connection = this.rtcClient.getOrCreatePeerConnection(newPeer.peerId, { iceServers: this.iceServers });
      this.rtcClient.publishLocalStreamToPeer(newPeer.peerId);

      let offer = await this.rtcClient.createOffer(newPeer.peerId);
      if (offer) {
        let msg = new RTCOfferMsg();
        msg.data.remotePeerId = newPeer.peerId;
        msg.data.sdp = offer;
        this.send(msg);
      }

    }

    if (this.onRoomPeerJoinedEvent) {
      this.onRoomPeerJoinedEvent(msgIn.data.roomId, newPeer);
    }

  }

  private onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    this.writeLog("peer left the room, peerid:" + msgIn.data?.peerId);

    let peer = this.peers.find(p => p.peerId === msgIn.data.peerId);
    if (!peer) {
      this.writeLog(`peer not found ${peer.peerId}`);
      return;
    }

    this.removeRemoteStream(peer);
    this.removePeer(peer);

    if (this.onRoomPeerLeftEvent) {
      let roomid = msgIn.data.roomId;
      this.onRoomPeerLeftEvent(roomid, peer);
    }

  }

  private onRoomClosed = async (msgIn: RoomClosedMsg) => {
    this.writeLog("onRoomClosed:" + msgIn.data.roomId);
    let peers = [...this.peers];
    this.roomClose();

    if (this.onRoomClosedEvent) {
      this.onRoomClosedEvent(msgIn.data.roomId, peers);
    }
  }

  private roomClose() {
    if (!this.localPeer.roomId) {
      this.writeLog("not in a room.")
      return;
    }

    this.peers.forEach(p => {
      p.rtc_Connection?.pc?.close();
    });


    if (this.localPeer.roomType == "sfu") {
      this.localPeer.producers.forEach(p => {
        p.close();
      });

      this.localPeer.consumers.forEach(p => {
        p.close();
      });

      this.localPeer.transportSend?.close();
      this.localPeer.transportReceive?.close();
    }

    let tracks = this.localPeer.stream.getTracks()
    for (let t of tracks) {
      t.stop();
      this.localPeer.stream.removeTrack(t);
    }

    this.localPeer.roomId = "";
    this.localPeer.roomType = RoomType.p2p;
    this.peers = [];

  }

  private sfu_onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    this.writeLog("onRoomNewProducer: " + msgIn.data?.kind);
    this.sfu_consumeProducer(msgIn.data?.peerId!, msgIn.data?.producerId!);
  }

  addLocalTrack = async (track: MediaStreamTrack) => {
    console.log("addLocalTrack() " + track.kind);

    if (!this.localPeer.stream) {
      this.writeLog("no local stream, creating one");
      this.localPeer.stream = new MediaStream();
    }

    let currentTracks = this.localPeer.stream.getTracks();
    console.log(`tracks=${currentTracks.length}`);

    if (this.localPeer.roomType == "sfu") {
      if (!currentTracks.find(t => t.id === track.id)) {
        this.localPeer.stream.addTrack(track);
        this.writeLog("track added: " + track.kind);
        await this.localPeer.transportSend.produce({ track });
      }
    }

  };

  removeLocalTrack(track: MediaStreamTrack) {
    if (this.localPeer.stream) {
      this.localPeer.stream.removeTrack(track);
      this.writeLog("track removed: " + track.kind);
    }
  };

  sfu_consumeProducer = async (remotePeerId: string, producerId: string) => {
    this.writeLog("consumeProducer() :" + remotePeerId, producerId);
    if (remotePeerId === this.localPeer.peerId) {
      console.error("consumeProducer() - you can't consume yourself.");
    }

    if (!this.isInRoom()) {
      console.error("not in a room");
      return;
    }

    if (this.localPeer.roomType != "sfu") {
      console.error("invalid roomtype");
      return;
    }

    let msg = new ConsumeMsg();
    msg.data = {
      remotePeerId: remotePeerId,
      producerId: producerId,
      rtpCapabilities: this.device.rtpCapabilities
    }
    this.send(msg);
  };

  private sfu_onConsumed = async (msgIn: ConsumedMsg) => {
    this.writeLog("onConsumed() " + msgIn.data?.kind);
    const consumer = await this.localPeer.transportReceive.consume({
      id: msgIn.data!.consumerId,
      producerId: msgIn.data!.producerId,
      kind: msgIn.data!.kind,
      rtpParameters: msgIn.data!.rtpParameters
    });
    this.addRemoteTrack(msgIn.data!.peerId, consumer.track);
  };

  private sfu_onProduced = async (msgIn: ProducedMsg) => {
    this.writeLog("onProduced " + msgIn.data?.kind);
  };

  private rtc_SendIceCandidate = (remotePeerId: string, candidate: RTCIceCandidate) => {
    this.writeLog("rtc_sendIceCandidate");
    //send ice candidate to server
    if (candidate) {
      const iceMsg: RTCIceMsg = {
        type: payloadTypeClient.rtc_ice,
        data: {
          remotePeerId: remotePeerId,
          candidate: candidate
        }
      };
      this.send(iceMsg);
    }
  };

  private rtc_OnPeerTrack = (remotePeerId: string, track: MediaStreamTrack) => {
    this.writeLog("rtc_OnPeerTrack");
    let peer = this.getPeer(remotePeerId);
    if (!peer) {
      this.writeLog("peer not found.");
      return;
    }

    if (this.onPeerNewTrackEvent) {
      this.onPeerNewTrackEvent(peer, track);
    }

  };

  private async onRTCOffer(msgIn: RTCOfferMsg) {
    this.writeLog("onRTCOffer()");
    //incoming call
    try {

      let peer = this.getPeer(msgIn.data.remotePeerId);
      if (!peer) {
        this.writeLog(`peer not found ${msgIn.data.remotePeerId}`);
        return;
      }

      await this.rtcClient.setRemoteDescription(peer.peerId, msgIn.data.sdp);
      //a track is required before an answer can be generated
      this.rtcClient.publishLocalStreamToPeer(peer.peerId);
      const answer = await this.rtcClient.createAnswer(peer.peerId);

      let msg = new RTCAnswerMsg();
      msg.data.remotePeerId = peer.peerId;;
      msg.data.sdp = answer;

      this.send(msg);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  }


  private onRTCAnswer = async (msgIn: RTCAnswerMsg) => {
    //received a call response
    let peer = this.getPeer(msgIn.data.remotePeerId);
    if (!peer) {
      this.writeLog(`peer not found ${msgIn.data.remotePeerId}`);
      return;
    }
    this.rtcClient.publishLocalStreamToPeer(peer.peerId);
    this.rtcClient.setRemoteDescription(msgIn.data.remotePeerId, msgIn.data.sdp);
  }

  private onRTCIce = async (msgIn: RTCIceMsg) => {
    let peer = this.getPeer(msgIn.data.remotePeerId);
    if (!peer) {
      this.writeLog(`peer not found ${msgIn.data.remotePeerId}`);
      return;
    }

    this.rtcClient.addIceCandidate(msgIn.data.remotePeerId, msgIn.data.candidate);
  }

}
