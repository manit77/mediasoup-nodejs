import * as mediasoupClient from 'mediasoup-client';
import {
  AuthUserNewTokenMsg,
  AuthUserNewTokenResultMsg,
  ConnectConsumerTransportMsg, ConnectProducerTransportMsg,
  ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg,
  ErrorMsg, IMsg, OkMsg, payloadTypeServer, ProducerTransportConnectedMsg, ProducerTransportCreatedMsg,
  RegisterPeerMsg, RegisterPeerResultMsg, RoomClosedMsg, RoomConfig, RoomConsumeStreamMsg, RoomConsumeStreamResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg,
  RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
  RoomProduceStreamMsg,
  RoomProduceStreamResultMsg,
} from "@rooms/rooms-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { WebRTCClient } from "@rooms/webrtc-client";
import { Consumer, Producer, Transport } from 'mediasoup-client/types';

const DSTR = "RoomsClient";

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
  authToken: string = "";
  roomToken: string = "";

  transportSend: mediasoupClient.types.Transport;
  transportReceive: mediasoupClient.types.Transport;
  consumers: mediasoupClient.types.Consumer[] = [];
  producers: mediasoupClient.types.Producer[] = [];

  tracks: MediaStream = new MediaStream();

  removeConsumer(consumer: Consumer) {
    this.consumers = this.consumers.filter(c => c != consumer);
  }

  removeProducer(producer: Producer) {
    this.producers = this.producers.filter(p => p != producer);
  }

  addProducer(producer: Producer) {
    producer.on("trackended", () => {
      console.log(DSTR, `producer - track ended ${producer.track?.id} ${producer.track?.kind}`);
    });
    this.producers.push(producer);
  }

  addConsumer(consumer: Consumer) {
    console.log(DSTR, "addConsumer");
    consumer.on("trackended", () => {
      console.log(DSTR, `consumer - track ended ${consumer.track?.id} ${consumer.track?.kind}`);
    });

    this.consumers.push(consumer);
  }
}

export class Peer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";

  stream?: MediaStream;

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

  private onTransportsReadyEvent: (transport: mediasoupClient.types.Transport) => void;
  eventOnRoomJoinFailed: (roomId: string) => Promise<void> = async () => { };
  eventOnRoomJoined: (roomId: string) => Promise<void> = async () => { };
  eventOnRoomPeerJoined: (roomId: string, peer: Peer) => Promise<void> = async () => { };
  eventOnPeerNewTrack: (peer: Peer, track: MediaStreamTrack) => Promise<void> = async () => { };
  eventOnRoomPeerLeft: (roomId: string, peer: Peer) => Promise<void> = async () => { };
  eventOnRoomClosed: (roomId: string, peers: Peer[]) => Promise<void> = async () => { };

  init = async (websocketURI: string, rtpCapabilities?: any) => {

    console.log(DSTR, "init");

    this.config.wsURI = websocketURI;
    await this.initMediaSoupDevice(rtpCapabilities);
    console.log(DSTR, "init complete");

  };

  dispose = () => {

    console.log(DSTR, "disposeRoom()");

    this.localPeer.tracks.getTracks().forEach((track) => {
      track.stop();
    });

    this.localPeer.consumers.forEach(c => c.close());
    this.localPeer.producers.forEach(c => c.close());
    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend?.close();

    this.localPeer.transportReceive = null;
    this.localPeer.transportSend = null;
    this.peers = [];
    this.localPeer = new LocalPeer();
    this.ws.disconnect();
    console.log(DSTR, "dispose() - complete");

  };

  connect = async (wsURI: string = "") => {
    if (wsURI) {
      this.config.wsURI = wsURI;
    }

    if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
      console.log(DSTR, "socket already " + this.ws.state)
      return;
    }

    console.log(DSTR, "connect " + this.config.wsURI);
    this.ws = new WebSocketClient();

    const onOpen = async () => {
      console.log(DSTR, "websocket open " + this.config.wsURI);
    };

    const onClose = async () => {
      console.log(DSTR, "websocket closed");
    };

    this.ws.addEventHandler("onopen", onOpen);
    this.ws.addEventHandler("onmessage", this.onSocketEvent);
    this.ws.addEventHandler("onclose", onClose);
    this.ws.addEventHandler("onerror", onClose);

    this.ws.connect(this.config.wsURI, true);

  };


  /**
  * resolves when the socket is connected
  * @param wsURI 
  * @returns 
  */
  waitForConnect = (wsURI: string = ""): Promise<IMsg> => {
    console.log(DSTR, `waitForConnect() ${wsURI}`);
    return new Promise<IMsg>((resolve, reject) => {

      try {

        let timerid = setTimeout(() => reject("failed to connect"), 5000);

        if (wsURI) {
          this.config.wsURI = wsURI;
        }

        console.log(DSTR, "config.wsURI:", this.config.wsURI);

        if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
          console.log(DSTR, "socket already created. current state: " + this.ws.state);
          resolve(new OkMsg(payloadTypeServer.ok, "already connecting"));
          return;
        }

        this.ws = new WebSocketClient();
        console.log(DSTR, "waitForConnect() - " + this.config.wsURI + " state:" + this.ws.state);

        const onOpen = async () => {
          console.log(DSTR, "websocket onOpen " + this.config.wsURI);
          resolve(new OkMsg(payloadTypeServer.ok, "socket opened."));
          clearTimeout(timerid);
        };

        const onClose = async () => {
          console.log(DSTR, "websocket onClose");
          resolve(new ErrorMsg(payloadTypeServer.error, "closed"));
        };

        this.ws.addEventHandler("onopen", onOpen);
        this.ws.addEventHandler("onmessage", this.onSocketEvent);
        this.ws.addEventHandler("onclose", onClose);
        this.ws.addEventHandler("onerror", onClose);

        this.ws.connect(this.config.wsURI, true);
      } catch (err: any) {
        console.error(err);
        reject("failed to connect");
      }

    });
  };

  waitForGetAuthoken = (serviceToken: string): Promise<IMsg> => {
    console.log("waitForGetAuthoken()");

    return new Promise<IMsg>(async (resolve, reject) => {
      try {

        let timerid = setTimeout(() => reject("failed to get authtoken"), 5000);

        const onmessage = (event: any) => {

          try {
            let msg = JSON.parse(event.data);
            if (msg.type == payloadTypeServer.authUserNewTokenResult) {
              console.log(DSTR, "-- waitForGetAuthoken() - onmessage", msg);
              let msgIn = msg as AuthUserNewTokenResultMsg;
              clearTimeout(timerid);
              this.ws.removeEventHandler("onmessage", onmessage);
              if (msgIn.data.authToken) {
                resolve(new OkMsg(payloadTypeServer.ok, "token received"));
                return;
              }
              resolve(new ErrorMsg(payloadTypeServer.ok, "failed to get token"));
            }
          } catch (err) {
            console.error(err);
            resolve(new ErrorMsg(payloadTypeServer.ok, "error getting token"));
          }

        };

        this.ws.addEventHandler("onmessage", onmessage);

        this.getAuthoken(serviceToken);
      } catch (err) {
        reject(err);
        console.error(err);
      }

    });
  };

  /**
   * register a client connection and wait for a result
   * @param trackingId 
   * @param displayName 
   * @returns 
   */
  waitForRegister = (authToken: string, trackingId: string, displayName: string): Promise<IMsg> => {
    console.log(DSTR, "waitForRegister");

    return new Promise<IMsg>(async (resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to register"), 5000);

        const onmessage = (event: any) => {
          let msg = JSON.parse(event.data);
          console.log(DSTR, "--waitForRegister() - onmessage", msg);
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

        if (authToken) {
          this.localPeer.authToken = authToken;
        }

        let registerSent = this.register(this.localPeer.authToken, trackingId, displayName);
        if (registerSent) {
          resolve(new OkMsg(payloadTypeServer.ok, "register sent."));
        } else {
          reject("register failed to send.");
        }
      } catch (err: any) {
        console.error(err);
        reject("failed to register");
      }
    });
  };

  waitForNewRoomToken = (expiresInMin: number): Promise<IMsg> => {
    return new Promise<IMsg>((resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to create new room token"), 5000);

        const onmessage = (event: any) => {

          let msg = JSON.parse(event.data);
          console.log(DSTR, "waitForNewRoomToken() -- onmessage", msg);

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
        reject("unable to get data");
      }
    });
  };

  waitForNewRoom = (maxPeers: number, maxRoomDurationMinutes: number): Promise<IMsg> => {
    return new Promise<IMsg>((resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to create new room"), 5000);

        const onmessage = (event: any) => {

          let msg = JSON.parse(event.data);
          console.log(DSTR, "waitForNewRoom() -- onmessage", msg);

          if (msg.type == payloadTypeServer.roomNewResult) {
            let msgIn: RoomNewResultMsg = msg;
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", onmessage);
            resolve(msgIn);
          }

        };

        this.ws.addEventHandler("onmessage", onmessage);

        this.roomNew(maxPeers, maxRoomDurationMinutes);

      } catch (err: any) {
        console.error(err);
        reject("failed to create new room");
      }
    });
  };

  /**
   * join an existing room and wait for a result
   * @param roomid 
   * @param roomToken 
   * @returns 
   */
  waitForRoomJoin = (roomid: string, roomToken: string): Promise<IMsg> => {

    //remove the old event hanlder    
    return new Promise<IMsg>((resolve, reject) => {
      try {
        let timerid = setTimeout(() => reject("failed to join room"), 5000);

        const onmessage = (event: any) => {
          console.log(DSTR, "-- onmessage", event.data);
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
        reject("failed to join room");
      }
    });
  };

  setAuthtoken = (authToken: string) => {
    this.localPeer.authToken = authToken;
  }

  getAuthoken = (serviceToken: string) => {
    console.log(DSTR, `-- getAuthoken `);
    //the server may reject this request due to server settings
    //in a typical setting, your application will request an authtoken from the rooms server using a service auth token

    let msg = new AuthUserNewTokenMsg();
    msg.data.authToken = serviceToken;
    msg.data.expiresInMin = 60;

    this.send(msg);

  };

  register = (authToken: string, trackingId: string, displayName: string) => {
    console.log(DSTR, `-- register trackingId: ${trackingId}, displayName: ${displayName}`);

    if (this.localPeer.peerId) {
      console.log(DSTR, `-- register, already registered. ${this.localPeer.peerId}`);
      return true;
    }

    if (!authToken) {
      console.log(DSTR, "-- register, authtoken is required.");
      return false;
    }

    this.localPeer.trackingId = trackingId;
    this.localPeer.displayName = displayName;

    let msg = new RegisterPeerMsg();
    msg.data = {
      authToken: authToken,
      displayName: this.localPeer.displayName,
      trackingId: trackingId
    }

    this.send(msg);

    return true;
  };

  disconnect = () => {
    console.log(DSTR, "disconnect");

    this.localPeer.consumers.forEach(c => c.close());
    this.localPeer.producers.forEach(c => c.close());

    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend?.close();

    this.ws.disconnect();

    //reset the local peer
    this.localPeer = new LocalPeer();
  };

  toggleAudio = () => {
    this.audioEnabled = !this.audioEnabled;
    console.log(DSTR, `Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
  };

  toggleVideo = () => {
    this.videoEnabled = !this.videoEnabled;
    console.log(DSTR, `Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
  };

  publishTracks = async (tracks: MediaStream) => {
    console.log(DSTR, "addLocalTrack() ");
    console.log(DSTR, `current tracks=${this.localPeer.tracks.getTracks().length}`);

    if (!tracks) {
      console.error("ERROR: tracks is required.")
      return;
    }

    tracks.getTracks().forEach(t => {
      this.localPeer.tracks.addTrack(t);
    })

    console.log(DSTR, "track added to localPeer.stream");

    tracks.getTracks().forEach(t => {
      t.enabled = t.kind === "audio" ? this.audioEnabled : this.videoEnabled;
    });

    if (this.localPeer.transportSend) {

      for (let track of tracks.getTracks()) {
        try {
          console.log(DSTR, `produce track ${track.kind}`);
          let producer = this.localPeer.producers.find(p => p.track.id == track.id);
          if (producer) {
            console.error(DSTR, "producer found with existing track.");
            return;
          }

          producer = await this.localPeer.transportSend.produce({ track });
          this.localPeer.addProducer(producer);
          console.log(DSTR, "track added: " + track.kind);
        } catch (error) {
          console.error(DSTR, `Failed to produce track: ${error.message}`);
          console.error(DSTR, error);
        }
      }

    } else {
      console.log(DSTR, 'No transportSend');
    }

  };

  unPublishTracks = async (tracks: MediaStream) => {
    console.log(`removeLocalTracks`);

    let localTracks = this.localPeer.tracks.getTracks();
    tracks.getTracks().forEach(track => {
      let existingTrack = localTracks.find(t => t.id === track.id)
      if (existingTrack) {
        this.localPeer.tracks.removeTrack(existingTrack);
        console.log(`existing track removed ${existingTrack.kind}`);
      }
    });

    for (let track of tracks.getTracks()) {
      let producer = this.localPeer.producers.find(p => p.track.id === track.id);
      if (producer) {
        producer.close();
        this.localPeer.removeProducer(producer);
        console.log(DSTR, `track removed ${track.kind}`);
      }
    }

  };

  findTrack = (kind: string) => {
    return this.localPeer.tracks.getTracks().find(t => t.kind === kind);
  }

  replaceTrack = async (existingTrack: MediaStreamTrack, newTrack: MediaStreamTrack) => {
    console.log(DSTR, "replaceTrack");

    if (!existingTrack) {
      console.error(DSTR, "existing track is null");
      return;
    }

    if (!newTrack) {
      console.error(DSTR, "new track is null");
      return;
    }

    let producer = this.localPeer.producers.find(p => p.track.id === existingTrack.id);
    if (producer) {
      producer.replaceTrack({ track: newTrack })
      this.localPeer.tracks.removeTrack(existingTrack);
      this.localPeer.tracks.addTrack(newTrack);
    } else {
      console.error(DSTR, `producer not found, existing track not found. ${existingTrack.kind} ${existingTrack.id}`);
    }

  };

  // updateProducerTracksStatus = async () => {
  //   console.log(DSTR, `updateProducerTracksStatus`);
    
  //   let msg = new RoomProducerStreamUpdatedMsg();
  //   msg.data.peerId = this.localPeer.peerId;
  //   msg.data.roomId = this.localPeer.roomId;
  //   msg.data.producers = [];
    
  //   for(let p of this.localPeer.producers){
  //     msg.data.producers.push({
  //       enabled: p.track.enabled,
  //       kind: p.track.kind
  //     });
  //   }

  //   this.send(msg);
  // }

  roomNewToken = (expiresInMin: number = 60) => {
    console.log(DSTR, `roomNewToken`);

    let msg = new RoomNewTokenMsg();
    msg.data = {
      authToken: this.localPeer.authToken,
      expiresInMin: expiresInMin
    };

    this.send(msg);
  };

  roomNew = (maxPeers: number, maxRoomDurationMinutes: number) => {
    console.log(DSTR, `${maxPeers} ${maxRoomDurationMinutes}`);

    let config = new RoomConfig();
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
    console.log(DSTR, `roomJoin ${roomid} ${roomToken}`)
    let msg = new RoomJoinMsg();
    msg.data = {
      roomId: roomid,
      roomToken: roomToken
    };
    this.send(msg);
  };

  roomLeave = () => {
    console.log(DSTR, "roomLeave");
    if (!this.localPeer.roomId) {
      console.error(DSTR, "not in room");
      return;
    }

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

  private initMediaSoupDevice = async (rtpCapabilities?: any) => {
    console.log(DSTR, "initMediaSoupDevice");
    if (this.device) {
      console.log(DSTR, "device already initialized");
      return;
    }

    try {
      // In real implementation, this would use the actual mediasoup-client
      this.device = new mediasoupClient.Device();
      console.log(DSTR, "MediaSoup device initialized");
      if (rtpCapabilities) {
        console.log(rtpCapabilities);

        await this.device.load({ routerRtpCapabilities: rtpCapabilities });
        console.log(DSTR, "MediaSoup device loaded");
      }

    } catch (error) {
      console.log(DSTR, `Error initializing MediaSoup: ${error.message}`);
    }
  };

  private onSocketEvent = async (event: any) => {

    let msgIn = JSON.parse(event.data);
    console.log(DSTR, "-- onmessage", msgIn.type, msgIn);
    //parse the msgIn
    if (!msgIn.type) {
      console.log(DSTR, "invalid message type");
      return;
    }

    if (!msgIn.data) {
      console.log(DSTR, "invalid message data");
      return;
    }

    try {
      switch (msgIn.type) {
        case payloadTypeServer.authUserNewTokenResult:
          this.onAuthUserNewTokenResult(msgIn);
          break;
        case payloadTypeServer.registerPeerResult:
          this.onRegisterResult(msgIn);
          break;
        case payloadTypeServer.producerTransportCreated:
          this.onProducerTransportCreated(msgIn);
          break;
        case payloadTypeServer.producerTransportConnected:
          this.onProducerTransportConnected(msgIn);
          break;
        case payloadTypeServer.consumerTransportCreated:
          this.onConsumerTransportCreated(msgIn);
          break;
        case payloadTypeServer.consumerTransportConnected:
          this.onConsumerTransportConnected(msgIn);
          break;
        case payloadTypeServer.roomNewTokenResult:
          this.onRoomNewTokenResult(msgIn);
          break;
        case payloadTypeServer.roomNewResult:
          this.onRoomNewResult(msgIn);
          break;
        case payloadTypeServer.roomJoinResult:
          this.onRoomJoinResult(msgIn);
          break;
        case payloadTypeServer.roomNewPeer:
          this.onRoomNewPeer(msgIn);
          break;
        case payloadTypeServer.roomNewProducer:
          this.onRoomNewProducer(msgIn);
          break;
        case payloadTypeServer.roomPeerLeft:
          this.onRoomPeerLeft(msgIn);
          break;
        case payloadTypeServer.roomProduceStreamResult:
          this.onProduced(msgIn);
          break;
        case payloadTypeServer.roomConsumeStreamResult:
          this.onConsumed(msgIn);
          break;
        case payloadTypeServer.roomClosed:
          this.onRoomClosed(msgIn);
          break;
      }
    } catch (err) {
      console.error(err);
    }

  };

  private send = (msg: any) => {
    console.log(DSTR, "send", msg.type, msg);
    this.ws.send(JSON.stringify(msg));
  };

  private addPeer = (peer: Peer) => {
    console.log(DSTR, `addPeer() ${peer.peerId} ${peer.trackingId}`);

    if (this.peers.find(p => p.peerId === peer.peerId)) {
      console.error(DSTR, "peer already exists");
      return;
    }

    if (peer.peerId === this.localPeer.peerId) {
      console.log(DSTR, `cannot add yourself as a peerid: ${this.localPeer.peerId}`);
      return;
    }

    this.peers.push(peer);

  };

  private removePeer = (peer: Peer) => {
    console.log(DSTR, `removePeer() ${peer.peerId}`);

    let idx = this.peers.findIndex(p => p == peer);
    if (idx > -1) {
      this.peers.splice(idx, 1);
    }
  };

  private getPeer = (peerId: string) => {
    return this.peers.find(p => p.peerId == peerId);
  };

  /**
   * if sfu, sends the localPeer tracks to the server 
   * if rtc, publish local streams to the remote peerConnection
   * @returns 
   */
  // private publishLocalStream = async () => {
  //   console.log(`publishLocalStream()`);

  //   if (!this.localPeer.roomId) {
  //     console.log(DSTR, "not in a room.");
  //     return;
  //   }

  //   if (!this.localPeer.transportSend) {
  //     console.log(DSTR, "transportSend is required.");
  //     return;
  //   }

  //   console.log("tracks=" + this.localPeer.tracks.getTracks().length);

  //   for (let track of this.localPeer.tracks.getTracks()) {
  //     let producer = await this.localPeer.transportSend.produce({ track: track });
  //     this.localPeer.addProducer(producer);
  //   };

  // };

  private addRemoteTrack = async (peerId: string, track: MediaStreamTrack) => {
    console.log(DSTR, "addRemoteTrack()");

    track.enabled = true;

    let peer = this.peers.find(p => p.peerId === peerId);
    if (!peer) {
      console.error(DSTR, `addRemoteTrack() - peer not found, peerId: ${peerId}`);
      return;
    }

    if (!peer.stream) {
      peer.stream = new MediaStream();
    }
    peer.stream.addTrack(track);

    if (this.eventOnPeerNewTrack) {
      await this.eventOnPeerNewTrack(peer, track);
    }
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
    console.log(DSTR, `-- onRegisterResult() peerId: ${msgIn.data?.peerId}`);

    if (msgIn.data.error) {
      console.log(DSTR, `register failed ${msgIn.data.error}`);
      this.localPeer.peerId = "";
      return;
    }

    this.localPeer.peerId = msgIn.data!.peerId;

  };

  private createProducerTransport = (): boolean => {
    console.log(DSTR, "-- createProducerTransport");

    let msg = new CreateProducerTransportMsg();
    msg.data.roomId = this.localPeer.roomId;
    this.send(msg);

    return true;
  };

  private createConsumerTransport = (): boolean => {
    console.log(DSTR, "-- createConsumerTransport");

    let msg = new CreateConsumerTransportMsg();
    msg.data.roomId = this.localPeer.roomId;
    this.send(msg);

    return true;
  };

  private onRoomNewTokenResult = async (msgIn: RoomNewTokenResultMsg) => {
    console.log(DSTR, "-- onRoomNewTokenResult()");

    if (msgIn.data.error) {
      console.error(DSTR, msgIn.data.error);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId
    this.localPeer.roomToken = msgIn.data.roomToken;
    console.log(DSTR, "room token set " + this.localPeer.roomToken, this.localPeer.roomId);

  };

  private onRoomNewResult = async (msgIn: RoomNewResultMsg) => {

    console.log(DSTR, "-- onRoomNewResult()");

    if (!msgIn.data.roomRtpCapabilities) {
      console.error(DSTR, "ERROR: not  rtpCapabilities received.");
      return;
    }

    if (!this.device.loaded) {
      console.log(DSTR, "loading device with rtpCapabilities");
      await this.device.load({ routerRtpCapabilities: msgIn.data.roomRtpCapabilities });
      console.log(DSTR, "** device loaded ", this.device.loaded);
    }

  };

  private onRoomJoinResult = async (msgIn: RoomJoinResultMsg) => {

    console.log(DSTR, "-- onRoomJoinResult()");
    if (msgIn.data.error) {
      console.error(DSTR, msgIn.data.error);
      await this.eventOnRoomJoinFailed(this.localPeer.roomId);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId;

    console.log(DSTR, "joined room " + msgIn.data!.roomId);
    console.log(DSTR, `-- onRoomJoinResult() peers : ${msgIn.data?.peers.length}`);

    let transports = await this.waitForRoomTransports();

    if (transports.data.error) {
      console.log("unable to create transports");
      return;
    }

    console.log("transports created.");

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let p of msgIn.data.peers) {

        let newpeer: Peer = this.createPeer(p.peerId, p.peerTrackingId, p.displayName);
        newpeer.producers.push(...p.producers.map(p => ({ id: p.producerId, kind: p.kind })));

        console.log(DSTR, p.peerId);
        console.log(DSTR, "-- onRoomJoinResult producers :" + p.producers?.length);

      }
    }

    for (let peer of this.peers) {
      await this.consumePeerProducers(peer);
      await this.eventOnRoomPeerJoined(this.localPeer.roomId, peer);
    }

    await this.eventOnRoomJoined(this.localPeer.roomId);
  }

  private createPeer(peerId: string, trackingId: string, displayName: string) {
    console.log(DSTR, `createPeer peerId:${peerId}, trackingId:${trackingId} `);
    let newpeer: Peer = new Peer();
    newpeer.peerId = peerId;
    newpeer.trackingId = trackingId;
    newpeer.displayName = displayName;

    this.addPeer(newpeer);

    return newpeer;
  }

  private onRoomNewPeer = async (msgIn: RoomNewPeerMsg) => {
    console.log(DSTR, "onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    console.log(DSTR, `new PeeerJoined ${msgIn.data?.peerId} `);

    let newpeer: Peer = this.createPeer(msgIn.data.peerId, msgIn.data.peerTrackingId, msgIn.data.displayName);
    if (msgIn.data?.producers) {
      for (let producer of msgIn.data.producers) {
        await this.consumeProducer(msgIn.data.peerId, producer.producerId);
      }
    }

    await this.eventOnRoomPeerJoined(msgIn.data.roomId, newpeer);
  }

  private onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    console.log(DSTR, "peer left the room, peerid:" + msgIn.data.peerId);

    let peer = this.peers.find(p => p.peerId === msgIn.data.peerId);
    if (!peer) {
      console.error(DSTR, `peer not found ${msgIn.data.peerId}`);
      return;
    }

    //stop all tracks
    if (peer.stream) {
      peer.stream.getTracks().forEach((track) => track.stop());
      peer.stream = null;
    }

    this.removePeer(peer);
    let roomid = msgIn.data.roomId;
    await this.eventOnRoomPeerLeft(roomid, peer);
  }

  private onRoomClosed = async (msgIn: RoomClosedMsg) => {
    console.log(DSTR, "onRoomClosed:" + msgIn.data.roomId);

    let peers = [...this.peers];
    this.roomClose();

    await this.eventOnRoomClosed(msgIn.data.roomId, peers);
  }

  private roomClose() {
    if (!this.localPeer.roomId) {
      console.error(DSTR, "not in a room.")
      return;
    }

    this.localPeer.producers.forEach(p => {
      p.close();
    });

    this.localPeer.consumers.forEach(c => {
      c.close();
    });

    this.localPeer.consumers = [];
    this.localPeer.producers = [];

    this.localPeer.transportSend?.close();
    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend = null;
    this.localPeer.transportReceive = null;

    for (let t of this.localPeer.tracks.getTracks()) {
      t.stop();
    }

    this.localPeer.tracks = new MediaStream();
    this.localPeer.roomId = "";
    this.peers = [];
  }

  /**
   * when you join a room transports need be created and published to a room
   */
  private waitForRoomTransports = async (): Promise<IMsg> => {
    console.log(DSTR, "-- waitForRoomTransports");

    if (!this.localPeer.roomId) {
      console.error(DSTR, "room is required for creating transports");
      return new ErrorMsg(payloadTypeServer.error, "cannot create transports before joining a room.");
    }

    let waitFunc = () => {
      return new Promise<IMsg>((resolve, reject) => {
        try {
          let transTrack = { recv: false, send: false };

          let timerid = setTimeout(() => {
            console.error(DSTR, "transport timed out.");
            resolve(new ErrorMsg(payloadTypeServer.error, "transport timeout"));
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
                resolve(new OkMsg(payloadTypeServer.ok, "transportCreated"));
              }
            } catch (err) {
              console.log(err);
              clearTimeout(timerid);
              reject("failed to create transport");
            }
          }

          this.createConsumerTransport();
          this.createProducerTransport();
        } catch (err) {
          console.error(err);
          reject(err);
        }
      });
    };

    let waitResult = await waitFunc();
    return waitResult;
  };

  private waitForTransportConnected = async (transport: mediasoupClient.types.Transport): Promise<IMsg> => {
    console.log(DSTR, "-- waitForTransportConnected created " + transport.direction)
    return new Promise<IMsg>((resolve, reject) => {

      let timeoutId = setTimeout(() => {
        console.log("waitForTransportConnected timeout " + transport.direction);
        resolve(new ErrorMsg(payloadTypeServer.error, "tranport timed out"));
      }, 5000);

      try {
        if (transport.connectionState === 'connected') {
          clearTimeout(timeoutId);
          resolve(new OkMsg(payloadTypeServer.ok, "connected"));
          return;
        }
        const onStateChange = (state: string) => {
          console.log(DSTR, "connectionstatechange transport: " + state);
          if (state === 'connected') {
            clearTimeout(timeoutId);
            resolve(new OkMsg(payloadTypeServer.ok, "connected"));
            transport.off('connectionstatechange', onStateChange);
          } else if (state === 'failed' || state === 'closed') {
            clearTimeout(timeoutId);
            resolve(new ErrorMsg(payloadTypeServer.error, "failed to connect"));
            transport.off('connectionstatechange', onStateChange);
          }
        };
        transport.on('connectionstatechange', onStateChange);
      } catch (err: any) {
        console.error(err);
        clearTimeout(timeoutId);
        reject("failed to connect transport");
      }
    });
  };

  /**
   * if sfu, consume the producers in the room
   * if rtc, create offer
   * @param peer
   * @returns 
   */
  async consumePeerProducers(peer: Peer) {
    console.log(DSTR, `connectToPeer() ${peer.peerId}`);

    if (!this.localPeer.roomId) {
      console.error(DSTR, "cannot connect to a peer. not in a room.");
      return;
    }

    if (!this.localPeer.transportReceive || !this.localPeer.transportSend) {
      console.error(DSTR, "transports have not been created.");
      return;
    }

    //consume transports
    if (peer.producers && peer.producers.length > 0) {
      console.warn(DSTR, "peer has no producers");
    }

    for (let producer of peer.producers) {
      await this.consumeProducer(peer.peerId, producer.id);
    }
  }

  private onConsumerTransportCreated = async (msgIn: ConsumerTransportCreatedMsg) => {
    console.log(DSTR, "-- onConsumerTransportCreated");

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
        roomId: this.localPeer.roomId,
        dtlsParameters: dtlsParameters
      }
      this.send(msg);
      callback();
    });

    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.localPeer.transportReceive);
    }
  }

  private onConsumerTransportConnected(msgIn: ProducerTransportConnectedMsg) {
    console.log(DSTR, "-- onConsumerTransportConnected");
  }

  private onProducerTransportCreated = async (msgIn: ProducerTransportCreatedMsg) => {
    console.log(DSTR, "-- onProducerTransportCreated");

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
      console.log(DSTR, "-- sendTransport connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        roomId: this.localPeer.roomId,
        dtlsParameters: dtlsParameters
      };
      this.send(msg);

      callback();

    });

    this.localPeer.transportSend.on('produce', ({ kind, rtpParameters }, callback) => {

      console.log(DSTR, "-- sendTransport produce");

      //fires when we call produce with local tracks
      let msg = new RoomProduceStreamMsg();
      msg.data = {
        roomId: this.localPeer.roomId,
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

  private onProducerTransportConnected(msgIn: ProducerTransportConnectedMsg) {
    console.log(DSTR, "-- onProducerTransportConnected");

  }

  private onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    console.log(DSTR, "onRoomNewProducer: " + msgIn.data.kind);
    this.consumeProducer(msgIn.data.peerId!, msgIn.data.producerId!);
  }

  private consumeProducer = async (remotePeerId: string, producerId: string) => {
    console.log(DSTR, "consumeProducer() :" + remotePeerId, producerId);
    if (remotePeerId === this.localPeer.peerId) {
      console.error("consumeProducer() - you can't consume yourself.");
    }

    if (!this.isInRoom()) {
      console.error("not in a room");
      return;
    }

    console.log(`** device loaded: ${this.device.loaded}`)

    let msg = new RoomConsumeStreamMsg();
    msg.data = {
      roomId: this.localPeer.roomId,
      remotePeerId: remotePeerId,
      producerId: producerId,
      rtpCapabilities: this.device.rtpCapabilities
    }
    this.send(msg);
  };

  private onConsumed = async (msgIn: RoomConsumeStreamResultMsg) => {
    console.log(DSTR, "onConsumed() " + msgIn.data?.kind);
    const consumer = await this.localPeer.transportReceive.consume({
      id: msgIn.data!.consumerId,
      producerId: msgIn.data!.producerId,
      kind: msgIn.data!.kind,
      rtpParameters: msgIn.data!.rtpParameters
    });
    this.addRemoteTrack(msgIn.data!.peerId, consumer.track);
    this.localPeer.addConsumer(consumer);
  };

  private onProduced = async (msgIn: RoomProduceStreamResultMsg) => {
    console.log(DSTR, "onProduced " + msgIn.data?.kind);
  };
}
