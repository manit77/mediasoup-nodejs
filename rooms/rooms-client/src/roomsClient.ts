import * as mediasoupClient from 'mediasoup-client';
import {
  AuthUserNewTokenMsg,
  AuthUserNewTokenResultMsg,
  ConnectConsumerTransportMsg, ConnectConsumerTransportResultMsg, ConnectProducerTransportMsg, ConnectProducerTransportResultMsg, ConsumedMsg,
  ConsumeMsg, CreateConsumerTransportMsg, CreateConsumerTransportResultMsg, CreateProducerTransportMsg,
  CreateProducerTransportResultMsg,
  ErrorMsg, IMsg, OkMsg, payloadTypeServer, ProducedMsg, ProduceMsg,
  RegisterPeerMsg, RegisterPeerResultMsg, RoomClosedMsg, RoomConfig, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg,
  RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
} from "@rooms/rooms-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { Consumer, Producer, Transport } from 'mediasoup-client/types';

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

  transportProduce: mediasoupClient.types.Transport;
  transportConsume: mediasoupClient.types.Transport;
  consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  producers: Map<string, mediasoupClient.types.Producer> = new Map();


  getProducers() {
    return [...this.producers.values()];
  }

  getProducerTracks() {
    return this.getProducers().map(p => p.track);
  }

  getConsumers() {
    return [...this.consumers.values()];
  }

  getConsumerTracks() {
    return this.getConsumers().map(c => c.track);
  }

  removeConsumer(consumer: Consumer) {
    this.consumers.delete(consumer.id);
  }

  removeProducer(producer: Producer) {
    this.producers.delete(producer.id);
  }

  addProducer(producer: Producer) {
    producer.on("trackended", () => {
      console.log(`producer - track ended ${producer.track?.id} ${producer.track?.kind}`);
      this.producers.delete(producer.id);
    });
    this.producers.set(producer.id, producer);
  }

  addConsumer(consumer: Consumer) {
    consumer.on("trackended", () => {
      console.log(`consumer - track ended ${consumer.track?.id} ${consumer.track?.kind}`);
      this.consumers.delete(consumer.id);
    });

    this.consumers.set(consumer.id, consumer);
  }

}

export class Peer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";
  //stream?: MediaStream;
  // producerInfos: {
  //   id: string, kind: "audio" | "video"
  // }[] = [];
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

const DSTR = "RoomsClient";

export class RoomsClient {

  ws: WebSocketClient;
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

  onRoomJoinedEvent: (roomId: string) => void;
  onRoomPeerJoinedEvent: (roomId: string, peer: Peer) => void;
  onPeerNewTrackEvent: (peer: Peer, track: MediaStreamTrack) => void;
  onRoomPeerLeftEvent: (roomId: string, peer: Peer) => void;
  onRoomClosedEvent: (roomId: string, peers: Peer[]) => void;

  init = async (websocketURI: string, rtpCapabilities?: any) => {

    console.log(DSTR, "init");
    this.config.wsURI = websocketURI;
    await this.initMediaSoupDevice(rtpCapabilities);
    console.log(DSTR, "init complete");

  };

  dispose = () => {

    console.log(DSTR, "disposeRoom()");

    this.localPeer.getConsumers().forEach(c => c.close());
    this.localPeer.getProducers().forEach(c => c.close());
    this.localPeer.transportConsume?.close();
    this.localPeer.transportProduce?.close();

    this.localPeer.transportConsume = null;
    this.localPeer.transportProduce = null;
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
  waitForConnect = async (wsURI: string = ""): Promise<IMsg> => {
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
          resolve(new OkMsg("already connecting"));
          return;
        }

        this.ws = new WebSocketClient();
        console.log(DSTR, "waitForConnect() - " + this.config.wsURI + " state:" + this.ws.state);

        const onOpen = async () => {
          console.log(DSTR, "websocket onOpen " + this.config.wsURI);
          resolve(new OkMsg("socket opened."));
          clearTimeout(timerid);
        };

        const onClose = async () => {
          console.log(DSTR, "websocket onClose");
          resolve(new ErrorMsg("closed"));
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

  waitForGetAuthoken = (serviceToken: string): Promise<IMsg> => {
    console.log("waitForGetAuthoken()");

    return new Promise<IMsg>(async (resolve, reject) => {

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

  /**
   * register a client connection and wait for a result
   * @param trackingId 
   * @param displayName 
   * @returns 
   */
  waitForRegister = async (authToken: string, trackingId: string, displayName: string): Promise<IMsg> => {
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
        resolve(new ErrorMsg("unable to get data"));
      }
    });
  };

  waitForNewRoom = async (maxPeers: number, maxRoomDurationMinutes: number): Promise<IMsg> => {
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
        resolve(new ErrorMsg("failed to join room"));
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
      return false;
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
    this.localPeer.getConsumers().forEach(c => c.close());
    this.localPeer.getProducers().forEach(c => c.close());

    this.localPeer.transportConsume?.close();
    this.localPeer.transportProduce?.close();

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
    console.log(DSTR, "publishTracks() ");

    if (!tracks) {
      console.error("ERROR: tracks is required.")
      return;
    }

    if (!this.localPeer.roomId) {
      console.error("ERROR: not in a room.");
      return;
    }

    if (!this.localPeer.transportProduce) {
      console.log(DSTR, 'No transportProduce');
      return;
    }

    tracks.getTracks().forEach(t => {
      t.enabled = t.kind === "audio" ? this.audioEnabled : this.videoEnabled;
    });

    for (let track of tracks.getTracks()) {
      try {
        console.log(DSTR, `produce track ${track.kind}`);
        let producer = this.localPeer.getProducers().find(p => p.track.id == track.id);
        if (producer) {
          console.error(DSTR, "producer found with existing track.");
          return;
        }

        producer = await this.localPeer.transportProduce.produce({ track });
        this.localPeer.addProducer(producer);
        console.log(DSTR, "track added: " + track.kind);
      } catch (error) {
        console.error(DSTR, `Failed to produce track: ${error.message}`);
        console.error(DSTR, error);
      }
    }
  };

  unpublishTracks = async (tracks: MediaStream) => {
    console.log(`removeLocalTracks`);

    for (let track of tracks.getTracks()) {
      let producer = this.localPeer.getProducers().find(p => p.track.id === track.id);
      if (producer) {
        producer.close();
        this.localPeer.removeProducer(producer);
        console.log(DSTR, `track removed ${track.kind}`);
      }
    }

  };

  findTrack = (kind: string): MediaStreamTrack => {
    return this.localPeer.getProducers().filter(p => p.track.kind === kind).map(p => p.track)[0];
  }

  getTracks = () => {
    return this.localPeer.getProducers().map(p => p.track);
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

    this.unpublishTracks(new MediaStream([existingTrack]));

    let producer = this.localPeer.getProducers().find(p => p.track.id === existingTrack.id);
    if (producer) {
      producer.replaceTrack({ track: newTrack });
      this.publishTracks(new MediaStream([newTrack]));
    } else {
      console.error(DSTR, `producer not found, existing track not found. ${existingTrack.kind} ${existingTrack.id}`);
    }

  };

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
    console.log(DSTR, `roomNew ${maxPeers} ${maxRoomDurationMinutes}`)
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
        case payloadTypeServer.createProducerTransportResult:
          this.onCreateProducerTransport(msgIn);
          break;
        case payloadTypeServer.createConsumerTransportResult:
          this.onCreateConsumerTransport(msgIn);
          break;
        case payloadTypeServer.connectProducerTransportResult:
          this.onConnectProducerTransport(msgIn);
          break;
        case payloadTypeServer.connectConsumerTransportResult:
          this.onConnectConsumerTransport(msgIn);
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
        case payloadTypeServer.produced:
          this.onProduced(msgIn);
          break;
        case payloadTypeServer.consumed:
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
      console.log(DSTR, "peer already exists");
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

  // public publishTrack = async (track: MediaStreamTrack) => {
  //   console.log(`publishTrack() ${track.kind}`);

  //   if (!this.localPeer.roomId) {
  //     console.log(DSTR, "not in a room.");
  //     return;
  //   }

  //   if (this.localPeer.roomType != "sfu") {
  //     console.log(DSTR, "invalid roomType.");
  //     return;
  //   }

  //   if (!this.localPeer.transportProduce) {
  //     console.log(DSTR, "transportProduce is required.");
  //     return;
  //   }    

  //   let producer = await this.localPeer.transportProduce.produce({ track: track });
  //   this.localPeer.addProducer(producer);

  // }

  /**
   * if sfu, sends the localPeer tracks to the server 
   * if rtc, publish local streams to the remote peerConnection
   * @returns 
   */
  // private publishLocalStream = async () => {
  //   console.log(`publishLocalStream() ${this.localPeer.roomType}`);

  //   if (!this.localPeer.roomId) {
  //     console.log(DSTR, "not in a room.");
  //     return;
  //   }

  //   if (this.localPeer.roomType != "sfu") {
  //     console.log(DSTR, "invalid roomType.");
  //     return;
  //   }

  //   if (!this.localPeer.transportProduce) {
  //     console.log(DSTR, "transportProduce is required.");
  //     return;
  //   }

  //   console.log("tracks=" + this.localPeer.tracks.getTracks().length);

  //   for (let track of this.localPeer.tracks.getTracks()) {
  //     //produce only enabled and live streams
  //     if (track.enabled && track.readyState === "live") {
  //       let producer = await this.localPeer.transportProduce.produce({ track: track });
  //       this.localPeer.addProducer(producer);
  //     }
  //   };

  // };

  // private addRemoteTrack = (peerId: string, track: MediaStreamTrack) => {
  //   console.log(DSTR, "addRemoteTrack()");

  //   track.enabled = true;

  //   let peer = this.peers.find(p => p.peerId === peerId);
  //   if (!peer) {
  //     console.log(DSTR, `addRemoteTrack() - peer not found, peerId: ${peerId}`);
  //     return;
  //   }

  //   if (this.onPeerNewTrackEvent) {
  //     this.onPeerNewTrackEvent(peer, track);
  //   } else {
  //     if (!peer.stream) {
  //       peer.stream = new MediaStream();
  //     }
  //     peer.stream.addTrack(track);
  //   }

  // };

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
    this.send(msg);
    return true;
  };

  private createConsumerTransport = (): boolean => {
    console.log(DSTR, "-- createConsumerTransport");
    let msg = new CreateConsumerTransportMsg();
    this.send(msg);
    return true;
  };

  private onRoomNewTokenResult = async (msgIn: RoomNewTokenResultMsg) => {

    console.log(DSTR, "-- onRoomNewTokenResult()");
    if (msgIn.data.error) {
      console.log(DSTR, msgIn.data.error);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId
    this.localPeer.roomToken = msgIn.data.roomToken;
    console.log(DSTR, "room token set " + this.localPeer.roomToken, this.localPeer.roomId);

  };

  private onRoomNewResult = async (msgIn: RoomNewResultMsg) => {

    console.log(DSTR, "-- onRoomNewResult()");

    if (!msgIn.data.roomRtpCapabilities) {
      console.log(DSTR, "ERROR: not  rtpCapabilities received.");
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
      console.log(DSTR, msgIn.data.error);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId;

    console.log(DSTR, "joined room " + msgIn.data!.roomId);
    console.log(DSTR, `-- onRoomJoinResult() peers : ${msgIn.data?.peers.length}`);

    let transportsResult = await this.waitForCreateTransports();
    if (transportsResult.data.error) {
      console.log("unable to create transports");
      return;
    }
    console.log("transports created.");
    let produceConnected = await this.waitForTransportConnected(this.localPeer.transportProduce);
    let consumeConnect = await this.waitForTransportConnected(this.localPeer.transportConsume);

    if(produceConnected.data.error) {
      console.log("producer not connected");
      return;
    }

    if(consumeConnect.data.error) {
      console.log("consumer not connected");
      return;
    }

    console.log("transports connected.");

    if (this.onRoomJoinedEvent) {
      this.onRoomJoinedEvent(this.localPeer.roomId);
    }

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let p of msgIn.data.peers) {
        this.createPeer(p.peerId, p.peerTrackingId, p.displayName);
        //newpeer.producerInfos.push(...p.producers.map(p => ({ id: p.producerId, kind: p.kind })));
        console.log(DSTR, p.peerId);
        console.log(DSTR, "-- onRoomJoinResult producers :" + p.producerInfos?.length);
        if (p.producerInfos) {
          for (let producerInfo of p.producerInfos) {
            this.consumeProducer(p.peerId, producerInfo.producerId);
          }
        }
      }
    }

    for (let peer of this.peers) {
      if (this.onRoomPeerJoinedEvent) {
        this.onRoomPeerJoinedEvent(this.localPeer.roomId, peer);
      }
    }

  }

  private createPeer(peerId: string, trackingId: string, displayName: string) {
    let newpeer: Peer = new Peer();
    newpeer.peerId = peerId;
    newpeer.trackingId = trackingId;
    newpeer.displayName = displayName;

    this.addPeer(newpeer);

    return newpeer;
  }

  private onRoomNewPeer = async (msgIn: RoomNewPeerMsg) => {
    console.log(DSTR, "onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producerInfos?.length);
    console.log(DSTR, `new PeeerJoined ${msgIn.data?.peerId} `);

    let newpeer: Peer = this.createPeer(msgIn.data.peerId, msgIn.data.peerTrackingId, msgIn.data.displayName);
    if (msgIn.data?.producerInfos) {
      for (let producer of msgIn.data.producerInfos) {
        this.consumeProducer(msgIn.data.peerId, producer.producerId);
      }
    }

    if (this.onRoomPeerJoinedEvent) {
      this.onRoomPeerJoinedEvent(msgIn.data.roomId, newpeer);
    }

  }

  private onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    console.log(DSTR, "peer left the room, peerid:" + msgIn.data.peerId);

    let peer = this.peers.find(p => p.peerId === msgIn.data.peerId);
    if (!peer) {
      console.log(DSTR, `peer not found ${msgIn.data.peerId}`);
      return;
    }

    this.removePeer(peer);

    if (this.onRoomPeerLeftEvent) {
      let roomid = msgIn.data.roomId;
      this.onRoomPeerLeftEvent(roomid, peer);
    }

  }

  private onRoomClosed = async (msgIn: RoomClosedMsg) => {
    console.log(DSTR, "onRoomClosed:" + msgIn.data.roomId);
    let peers = [...this.peers];
    this.roomClose();

    if (this.onRoomClosedEvent) {
      this.onRoomClosedEvent(msgIn.data.roomId, peers);
    }
  }

  private roomClose() {
    if (!this.localPeer.roomId) {
      console.log(DSTR, "not in a room.")
      return;
    }

    for (let producer of this.localPeer.producers.values()) {
      producer.close();
    }

    for (let consumer of this.localPeer.consumers.values()) {
      consumer.close();
    }

    this.localPeer.transportProduce?.close();
    this.localPeer.transportConsume?.close();

    this.localPeer.roomId = "";
    this.peers = [];

  }

  /**
   * when you join a room transports need be created and published to a room
   */
  private waitForCreateTransports = async (): Promise<IMsg> => {

    if (!this.localPeer.roomId) {
      console.log(DSTR, "room is required for creating transports");
      return new ErrorMsg("cannot create transports before joining a room.");
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

        this.createConsumerTransport();
        this.createProducerTransport();
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
        resolve(new ErrorMsg("tranport timed out"));
      }, 5000);

      try {
        if (transport.connectionState === 'connected') {
          clearTimeout(timeoutId);
          resolve(new OkMsg("connected"));
          return;
        }
        const onStateChange = (state: string) => {
          console.log(DSTR, "connectionstatechange transport: " + state);
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
  // async consumePeerProducers(peer: Peer) {
  //   console.log(DSTR, `connectToPeer() ${peer.peerId}`);

  //   if (!this.localPeer.roomId) {
  //     console.log(DSTR, "cannot connect to a peer. not in a room.");
  //     return;
  //   }

  //   if (!this.localPeer.transportConsume || !this.localPeer.transportProduce) {
  //     console.log(DSTR, "transports have not been created.");
  //     return;
  //   }

  //   //consume transports
  //   if (peer.producerInfos && peer.producerInfos.length > 0) {
  //     console.log(DSTR, "peer has no producers");
  //     return;
  //   }

  //   peer.producerInfos.forEach(p => {
  //     this.consumeProducer(peer.peerId, p.id);
  //   });

  // }

  private onCreateConsumerTransport = async (msgIn: CreateConsumerTransportResultMsg) => {
    console.log(DSTR, "-- onCreateConsumerTransport");

    if (msgIn.data.error) {
      console.error(msgIn.data.error);
      return;
    }

    this.localPeer.transportConsume = this.device.createRecvTransport({
      id: msgIn.data.transportId,
      iceServers: msgIn.data.iceServers ?? this.iceServers,
      iceCandidates: msgIn.data.iceCandidates,
      iceParameters: msgIn.data.iceParameters,
      dtlsParameters: msgIn.data.dtlsParameters,
      iceTransportPolicy: msgIn.data.iceTransportPolicy
    });

    this.localPeer.transportConsume.on('connect', ({ dtlsParameters }, callback) => {
      let msg = new ConnectConsumerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      }
      this.send(msg);
      callback();
    });
  
  }

  private onConnectConsumerTransport(msgIn: ConnectConsumerTransportResultMsg) {
    if (msgIn.data.error) {
      console.error(msgIn.data.error);
      return;
    }

    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.localPeer.transportConsume);
    }

  }

  private onCreateProducerTransport = async (msgIn: CreateProducerTransportResultMsg) => {
    console.log(DSTR, "-- onCreateProducerTransport");

    if (msgIn.data.error) {
      console.error(msgIn.data.error);
      return;
    }

    //the server has created a transport
    //create a client transport to connect to the server transport
    this.localPeer.transportProduce = this.device.createSendTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data.iceServers ?? this.iceServers,
      iceCandidates: msgIn.data.iceCandidates,
      iceParameters: msgIn.data.iceParameters,
      dtlsParameters: msgIn.data.dtlsParameters,
      iceTransportPolicy: msgIn.data.iceTransportPolicy
    });
    
    this.localPeer.transportProduce.on("connect", ({ dtlsParameters }, callback) => {
      console.log(DSTR, "-- sendTransport connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      };
      this.send(msg);

      callback();

    });

    this.localPeer.transportProduce.on('produce', ({ kind, rtpParameters }, callback) => {

      console.log(DSTR, "-- sendTransport produce");

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

  }

  private onConnectProducerTransport(msgIn: ConnectProducerTransportResultMsg) {
    if (msgIn.data.error) {
      console.error(msgIn.data.error);
      return;
    }

    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.localPeer.transportProduce);
    }

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

    let msg = new ConsumeMsg();
    msg.data = {
      remotePeerId: remotePeerId,
      producerId: producerId,
      rtpCapabilities: this.device.rtpCapabilities
    }
    this.send(msg);
  };

  private onConsumed = async (msgIn: ConsumedMsg) => {
    console.log(DSTR, "onConsumed() " + msgIn.data?.kind);
    let peer = this.peers.find(p => p.peerId === msgIn.data!.peerId);
    if (!peer) {
      console.log(DSTR, `addRemoteTrack() - peer not found, peerId: ${msgIn.data!.peerId}`);
      return;
    }

    const consumer = await this.localPeer.transportConsume.consume({
      id: msgIn.data!.consumerId,
      producerId: msgIn.data!.producerId,
      kind: msgIn.data!.kind,
      rtpParameters: msgIn.data!.rtpParameters
    });

    this.onPeerNewTrackEvent(peer, consumer.track);

  };

  private onProduced = async (msgIn: ProducedMsg) => {
    console.log(DSTR, "onProduced " + msgIn.data?.kind);
  };

}
