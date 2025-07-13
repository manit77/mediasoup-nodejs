import * as mediasoupClient from 'mediasoup-client';
import {
  AuthUserNewTokenMsg,
  AuthUserNewTokenResultMsg,
  ConnectConsumerTransportMsg, ConnectProducerTransportMsg,
  ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg,
  ErrorMsg, IMsg, OkMsg, payloadTypeClient, payloadTypeServer, ProducerTransportConnectedMsg, ProducerTransportCreatedMsg,
  RegisterPeerMsg, RegisterPeerResultMsg, RoomClosedMsg, RoomConfig, RoomConsumeStreamMsg, RoomConsumeStreamResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg,
  RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
  RoomProducerToggleStreamMsg,
  RoomProduceStreamMsg,
  RoomProduceStreamResultMsg,
  UniqueTracks,
} from "@rooms/rooms-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { Consumer, Producer, Transport } from 'mediasoup-client/types';

const DSTR = "RoomsClient";

export interface JoinInfo { roomId: string, roomToken: string };
export interface DeviceInfo {
  id: string;
  label: string;
}

interface ConsumerInfo {
  peerId: string,
  consumer: mediasoupClient.types.Consumer;
}

export class LocalPeer implements IPeer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";

  roomId: string = "";
  authToken: string = "";
  roomToken: string = "";

  transportSend: mediasoupClient.types.Transport;
  transportReceive: mediasoupClient.types.Transport;

  private producers: mediasoupClient.types.Producer[] = [];

  tracks: UniqueTracks = new UniqueTracks();

  getProducers() {
    return this.producers;
  }

  clearProducers() {
    this.producers.forEach(p => p.close());
    this.producers = [];
  }

  removeProducer(producer: Producer) {
    console.warn(`removeProducer ${producer.kind}`);
    let idx = this.producers.findIndex(p => p == producer);
    if (idx > -1) {
      let removed = this.producers.splice(idx, 1);
      console.log(`producer with kind ${producer.track.kind} removed.`, this.producers);

      for (let producer of removed) {
        producer.track.stop();
        this.tracks.removeTrack(producer.track.kind);
      }
    }
  }

  /**
   * local producer, one producer per track
   * only 1 video and 1 audio is allowed
   * @param track 
   * @returns 
   */
  async createProducer(track: MediaStreamTrack) {
    console.warn(DSTR, `createProducer ${track.kind}`);

    //if the producer exists by kind throw an error
    let existingProducer = this.producers.find(p => p.kind === track.kind);
    if (existingProducer) {
      throw `producer already exists for kind ${existingProducer.kind}`;
    }

    let producer = await this.transportSend.produce({ track });
    this.addProducer(producer);
    return producer;
  }

  private addProducer(producer: Producer) {
    console.warn(DSTR, `addProducer ${producer.kind}`);

    producer.on("trackended", () => {
      console.log(DSTR, `producer - track ended ${producer.track?.id} ${producer.track?.kind}`);
    });
    producer.observer.on('pause', () => {
      console.log('producer - paused (muted)');
    });

    producer.observer.on('resume', () => {
      console.log('producer - resumed (unmuted)');
    });

    this.producers.push(producer);
  }
}

export interface IPeer {
  peerId: string;
  trackingId: string;
  displayName: string;
  tracks: UniqueTracks;
}

export class Peer implements IPeer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";

  tracks: UniqueTracks = new UniqueTracks();

  producersToConsume: {
    producerId: string, kind: "audio" | "video" | string
  }[] = []

  private consumers: ConsumerInfo[] = [];
  getConsumers() {
    return this.consumers;
  }

  clearConsumers() {
    this.consumers.forEach(c => c.consumer.close());
    this.consumers = [];
  }

  removeConsumer(consumer: Consumer) {
    console.warn(`removeConsumer ${consumer.kind}`);
    let idx = this.consumers.findIndex(c => c.consumer === consumer);
    if (idx > -1) {
      let removed = this.consumers.splice(idx, 1);
      console.warn(`consumer with kind ${consumer.track.kind} removed.`, this.consumers);

      for (let consumer of removed) {
        console.warn(`remove track ${consumer.consumer.track.kind}`)
        this.tracks.removeTrack(consumer.consumer.track.kind);
      }
    }
    console.log(this.consumers);


  }

  /**
 * creates a consumer to consume a remote producer
 * 1 video and 1 audio is aloweed per peer
 * @param serverConsumerId 
 * @param serverProducerId 
 * @param kind 
 * @param rtpParameters 
 * @returns 
 */
  async createConsumer(transportReceive: mediasoupClient.types.Transport, peerId: string, serverConsumerId: string, serverProducerId: string, kind: "audio" | "video", rtpParameters: any) {
    console.warn(`createConsumer peerId:${peerId}, serverConsumerId:${serverConsumerId}, serverProducerId: ${serverProducerId}, kind: ${kind}`);

    let existingConsumer = this.consumers.find(c => c.peerId == peerId && c.consumer.kind === kind);
    if (existingConsumer) {
      throw `consumer of ${existingConsumer.consumer.kind} already exists for peerId: ${peerId}`;
    }

    let consumer = await transportReceive.consume({
      id: serverConsumerId,
      producerId: serverProducerId,
      kind: kind,
      rtpParameters: rtpParameters
    });

    this.addConsumer(peerId, consumer);

    return consumer;
  }

  private addConsumer(peerId: string, consumer: Consumer) {
    console.warn(DSTR, `addConsumer ${consumer.kind}`);

    consumer.on("trackended", () => {
      console.log(DSTR, `consumer - track ended ${consumer.track?.id} ${consumer.track?.kind}`);
    });

    consumer.observer.on('pause', () => {
      console.log('consumer - paused (muted)');
    });

    consumer.observer.on('resume', () => {
      console.log('consumer - resumed (unmuted)');
    });

    this.consumers.push({ peerId, consumer });
  }


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

  private ws: WebSocketClient;
  public localPeer: LocalPeer = new LocalPeer();

  peers: Peer[] = [];
  audioEnabled = true;
  videoEnabled = true;

  private device: mediasoupClient.types.Device;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ]

  config = {
    wsURI: "wss://localhost:3000",
    socketAutoReconnect: true,
    socketEnableLogs: false
  }

  constructor() {

  }

  private onTransportsReadyEvent: (transport: mediasoupClient.types.Transport) => void;

  eventOnRoomJoinFailed: (roomId: string) => Promise<void> = async () => { };
  eventOnRoomJoined: (roomId: string) => Promise<void> = async () => { };
  eventOnRoomPeerJoined: (roomId: string, peer: IPeer) => Promise<void> = async () => { };
  eventOnPeerNewTrack: (peer: IPeer, track: MediaStreamTrack) => Promise<void> = async () => { };
  eventOnRoomPeerLeft: (roomId: string, peer: IPeer) => Promise<void> = async () => { };
  eventOnRoomClosed: (roomId: string, peers: IPeer[]) => Promise<void> = async () => { };
  eventOnPeerTrackToggled: (peer: IPeer, track: MediaStreamTrack, enabled: boolean) => Promise<void> = async () => { };
  eventOnRoomSocketClosed: () => Promise<void> = async () => { };

  inititalize = async (conf: { socketAutoConnect: boolean, socketURI: string, rtpCapabilities?: any }) => {
    console.log(DSTR, "inititalize");

    this.config.wsURI = conf.socketURI;
    this.config.socketAutoReconnect = conf.socketAutoConnect;
    await this.initMediaSoupDevice(conf.rtpCapabilities);
    console.log(DSTR, "init complete");

  };

  dispose = () => {

    console.log(DSTR, "disposeRoom()");

    this.disconnect();
    this.eventOnRoomJoinFailed = null;
    this.eventOnRoomJoined = null;
    this.eventOnRoomPeerJoined = null;
    this.eventOnPeerNewTrack = null;
    this.eventOnRoomPeerLeft = null;
    this.eventOnRoomClosed = null;
    this.eventOnPeerTrackToggled = null;
    this.eventOnRoomSocketClosed = null;
    console.log(DSTR, "dispose() - complete");
  };

  connect = async (wsURI: string = "") => {
    console.log(DSTR, `connect ${wsURI} autoReconnect: ${this.config.socketAutoReconnect}`);
    if (wsURI) {
      this.config.wsURI = wsURI;
    }

    if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
      console.log(DSTR, "socket already " + this.ws.state)
      return;
    }

    console.log(DSTR, "connect " + this.config.wsURI);
    this.ws = new WebSocketClient();

    this.ws.addEventHandler("onopen", this.socketOnOpen);
    this.ws.addEventHandler("onmessage", this.onSocketEvent);
    this.ws.addEventHandler("onclose", this.socketOnClose);
    this.ws.addEventHandler("onerror", this.socketOnClose);

    this.ws.connect(this.config.wsURI, this.config.socketAutoReconnect);

  };

  disconnect = () => {
    console.log(DSTR, "disconnect");
    this.peers = [];

    if (this.ws) {
      this.ws.disconnect();
    }
    this.resetLocalPeer();
  };

  resetLocalPeer() {

    console.warn(`resetLocalPeer`);
    this.localPeer.tracks = new UniqueTracks();
    this.localPeer.clearProducers();
    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend?.close();

    this.localPeer.transportReceive = null;
    this.localPeer.transportSend = null;
    this.localPeer = new LocalPeer();

  }

  private socketOnOpen = async () => {
    console.info(DSTR, "websocket open " + this.config.wsURI);
  };

  private socketOnClose = async () => {
    console.error(DSTR, "socketOnClose closed");
    let roomId = this.localPeer.roomId;
    if (roomId) {
      let copyPeers = [...this.peers];
      this.roomClose();
      await this.eventOnRoomClosed(roomId, copyPeers);
    }

    await this.eventOnRoomSocketClosed();
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

        if (wsURI) {
          this.config.wsURI = wsURI;
        }

        console.log(DSTR, "config.wsURI:", this.config.wsURI);

        if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
          console.log(DSTR, "socket already created. current state: " + this.ws.state);
          resolve(new OkMsg(payloadTypeServer.ok, "already connecting"));
          return;
        }

        this.ws = new WebSocketClient({ enableLogs: this.config.socketEnableLogs });
        console.log(DSTR, "waitForConnect() - " + this.config.wsURI + " state:" + this.ws.state);

        const _onOpen = () => {
          console.log(DSTR, "websocket onOpen " + this.config.wsURI);
          this.socketOnOpen();
          resolve(new OkMsg(payloadTypeServer.ok, "socket opened."));
          clearTimeout(timerid);
        };

        const _onClose = () => {
          console.log(DSTR, "websocket onClose");
          this.socketOnClose();
          resolve(new ErrorMsg(payloadTypeServer.error, "closed"));
        };

        this.ws.addEventHandler("onopen", _onOpen);
        this.ws.addEventHandler("onmessage", this.onSocketEvent);
        this.ws.addEventHandler("onclose", _onClose);
        this.ws.addEventHandler("onerror", _onClose);

        this.ws.connect(this.config.wsURI, this.config.socketAutoReconnect);

        let timerid = setTimeout(() => {

          if (this.ws) {
            this.ws.disconnect();
          }

          reject("failed to connect");
        }, 5000);

      } catch (err: any) {
        console.error(err);
        reject("failed to connect");
      }

    });
  };

  waitForGetAuthoken = (serviceToken: string): Promise<IMsg> => {
    console.log("waitForGetAuthoken()");

    return new Promise<IMsg>((resolve, reject) => {

      let _onmessage: (event: any) => void;

      try {

        let timerid = setTimeout(() => {
          if (_onmessage) {
            this.ws.removeEventHandler("onmessage", _onmessage);
          }
          reject("failed to get authtoken");
        }, 5000);

        _onmessage = (event: any) => {

          try {
            let msg = JSON.parse(event.data);
            if (msg.type == payloadTypeServer.authUserNewTokenResult) {
              console.log(DSTR, "** waitForGetAuthoken() - onmessage", msg);
              let msgIn = msg as AuthUserNewTokenResultMsg;
              clearTimeout(timerid);
              this.ws.removeEventHandler("onmessage", _onmessage);
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

        this.ws.addEventHandler("onmessage", _onmessage);

        this.getAuthoken(serviceToken);
      } catch (err) {
        if (_onmessage) {
          this.ws.removeEventHandler("onmessage", _onmessage);
        }
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

    return new Promise<IMsg>((resolve, reject) => {

      if (!this.ws) {
        reject("websocket not initialized");
        return;
      }

      if (this.ws.state !== "connected") {
        reject("websocket not connected");
        return;
      }

      if (this.localPeer.peerId) {
        console.log(`"localPeer already authenticated"`);
        resolve(new OkMsg(payloadTypeServer.ok, {}));
        return;
      }

      let _onmessage: (event: any) => void;
      try {

        _onmessage = (event: any) => {
          let msg = JSON.parse(event.data);
          console.log(DSTR, "--waitForRegister() - onmessage", msg);
          if (msg.type == payloadTypeServer.registerPeerResult) {

            let msgIn: RegisterPeerResultMsg = msg;
            if (msgIn.data) {
              this.localPeer.peerId = msgIn.data.peerId;
            }

            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", _onmessage);
            console.log(`register result received, remove _onmessage`);
            resolve(msgIn);

          }
        };
        this.ws.addEventHandler("onmessage", _onmessage);

        if (authToken) {
          this.localPeer.authToken = authToken;
        }

        let timerid = setTimeout(() => {
          if (_onmessage) {
            this.ws.removeEventHandler("onmessage", _onmessage);
          }
          reject("failed to register");
        }, 5000);

        let registerSent = this.register(this.localPeer.authToken, trackingId, displayName);

        if (!registerSent) {
          this.ws.removeEventHandler("onmessage", _onmessage);
          reject("register failed to send.");
        }
      } catch (err: any) {
        console.error(err);
        if (_onmessage) {
          this.ws.removeEventHandler("onmessage", _onmessage);
        }
        reject("failed to register");
      }
    });
  };

  waitForNewRoomToken = (expiresInMin: number): Promise<IMsg> => {
    return new Promise<IMsg>((resolve, reject) => {
      let _onmessage: (event: any) => void;
      try {
        let timerid = setTimeout(() => {
          if (_onmessage) {
            this.ws.removeEventHandler("onmessage", _onmessage);
          }
          reject("failed to create new room token");
        }, 5000);

        _onmessage = (event: any) => {

          let msg = JSON.parse(event.data);
          console.log(DSTR, "waitForNewRoomToken() -- onmessage", msg);

          if (msg.type == payloadTypeServer.roomNewTokenResult) {
            let msgIn: RoomNewTokenResultMsg = msg;
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", _onmessage);
            resolve(msgIn);
          }

        };

        this.ws.addEventHandler("onmessage", _onmessage);

        if (!this.roomNewToken(expiresInMin)) {
          this.ws.removeEventHandler("onmessage", _onmessage);
          reject("unable to request new token");
        }

      } catch (err: any) {
        if (_onmessage) {
          this.ws.removeEventHandler("onmessage", _onmessage);
        }
        reject("unable to get data");
      }
    });
  };

  waitForNewRoom = (maxPeers: number, maxRoomDurationMinutes: number): Promise<IMsg> => {
    return new Promise<IMsg>((resolve, reject) => {
      let _onmessage: (event: any) => void;

      try {
        let timerid = setTimeout(() => {
          if (_onmessage) {
            this.ws.removeEventHandler("onmessage", _onmessage);
          }
          reject("failed to create new room");
        }, 5000);

        _onmessage = (event: any) => {

          let msg = JSON.parse(event.data);
          console.log(DSTR, "waitForNewRoom() -- onmessage", msg);

          if (msg.type == payloadTypeServer.roomNewResult) {
            let msgIn: RoomNewResultMsg = msg;
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", _onmessage);
            resolve(msgIn);
          }

        };

        this.ws.addEventHandler("onmessage", _onmessage);

        if (!this.roomNew(maxPeers, maxRoomDurationMinutes)) {
          this.ws.removeEventHandler("onmessage", _onmessage);
          reject("unable to reqeust new room");
        }

      } catch (err: any) {
        console.error(err);
        if (_onmessage) {
          this.ws.removeEventHandler("onmessage", _onmessage);
        }
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
      let _onmessage: (event: any) => void;
      try {
        let timerid = setTimeout(() => {
          if (_onmessage) {
            this.ws.removeEventHandler("onmessage", _onmessage);
          }
          reject("failed to join room");
        }, 5000);

        _onmessage = (event: any) => {
          console.log(DSTR, "** onmessage", event.data);
          let msg = JSON.parse(event.data);

          if (msg.type == payloadTypeServer.roomJoinResult) {
            clearTimeout(timerid);
            this.ws.removeEventHandler("onmessage", _onmessage);
            let msgIn = msg as RoomJoinResultMsg;
            resolve(msgIn);
          }
        };

        this.ws.addEventHandler("onmessage", _onmessage);
        this.roomJoin(roomid, roomToken);
      } catch (err: any) {
        console.log(err);
        if (_onmessage) {
          this.ws.removeEventHandler("onmessage", _onmessage);
        }
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
      console.log(DSTR, "** register, authtoken is required.");
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

  toggleAudio = () => {
    this.audioEnabled = !this.audioEnabled;
    console.log(DSTR, `Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
  };

  toggleVideo = () => {
    this.videoEnabled = !this.videoEnabled;
    console.log(DSTR, `Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
  };

  publishTracks = async (tracks: MediaStreamTrack[]) => {
    console.warn(DSTR, "publishTracks");
    console.log(DSTR, `current tracks=${this.localPeer.tracks.length}`);

    if (!tracks) {
      console.error("ERROR: tracks is required.")
      return;
    }

    tracks.forEach(t => {
      this.localPeer.tracks.addTrack(t);
    })

    console.log(DSTR, "track added to localPeer.stream");

    tracks.forEach(t => {
      t.enabled = t.kind === "audio" ? this.audioEnabled : this.videoEnabled;
    });

    if (this.localPeer.transportSend) {

      for (const track of tracks) {
        try {
          console.log(DSTR, `produce track ${track.kind}`);
          let producer = this.localPeer.getProducers().find(p => p.track.id == track.id);
          if (producer) {
            console.error(DSTR, "producer found with existing track.");
            return;
          }

          producer = await this.localPeer.createProducer(track);
          console.log(DSTR, "track added: " + track.kind);
        } catch (error) {
          console.error(DSTR, `Failed to produce track: ${error.message}`);
          console.error(DSTR, error);
        }
      }

    } else {
      console.error(DSTR, 'No transportSend');
    }

  };

  unPublishTracks = async (tracks: MediaStreamTrack[]) => {
    console.log(`removeLocalTracks`);

    tracks.forEach(track => {
      let existingTrack = this.localPeer.tracks.getTracks().find(t => t.id === track.id)
      if (existingTrack) {
        this.localPeer.tracks.removeTrack(existingTrack.kind);
        console.log(`existing track removed ${existingTrack.kind}`);
      }
    });

    for (const track of tracks) {
      let producer = this.localPeer.getProducers().find(p => p.track.id === track.id);
      if (producer) {
        producer.close();
        this.localPeer.removeProducer(producer);
        console.log(DSTR, `track removed ${track.kind}`);
      }
    }

  };

  findTrack = (kind: string) => {
    return this.localPeer.tracks.getTrack(kind);
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

    let producer = this.localPeer.getProducers().find(p => p.track.id === existingTrack.id);
    if (producer) {
      producer.replaceTrack({ track: newTrack });

      this.localPeer.tracks.removeTrack(existingTrack.kind);
      this.localPeer.tracks.addTrack(newTrack);
    } else {
      console.error(DSTR, `producer not found, existing track not found. ${existingTrack.kind} ${existingTrack.id}`);
    }

  };

  roomProducerToggleStream = async (peerId: string) => {
    console.log(DSTR, `roomProducerToggleStream`);

    let tracks: MediaStreamTrack[];

    //local producers consumers
    tracks = this.localPeer.getProducers().map(p => p.track);
    console.log("local producer tracks", tracks);
    console.log("localPeer tracks", this.localPeer.tracks);
    tracks = this.localPeer.getProducers().map(p => p.track);
    console.log("local consumer tracks", tracks);

    //remote producers
    for (const peer of this.peers.values()) {
      console.log(`remtoe peer ${peer.peerId} ${peer.displayName} tracks:`, peer.tracks);
    }

    if (peerId === this.localPeer.peerId) {
      //this is a local peer that was updated
      tracks = this.localPeer.getProducers().map(p => p.track);
    } else {
      // remote peer updated
      let remotePeer = [...this.peers.values()].find(p => p.peerId === peerId);
      if (!remotePeer) {
        console.log(`remote peer not found.`);
        return;
      }

      tracks = remotePeer.tracks.getTracks();
    }

    if (!tracks || tracks.length == 0) {
      console.log("no tracks found.");
      return;
    }

    let msg = new RoomProducerToggleStreamMsg();
    msg.data.peerId = peerId;
    msg.data.roomId = this.localPeer.roomId;
    msg.data.tracksInfo = [];

    for (const track of tracks) {
      msg.data.tracksInfo.push({
        enabled: track.enabled,
        kind: track.kind
      });
    }

    this.send(msg);
  }

  roomNewToken = (expiresInMin: number = 60) => {
    console.log(DSTR, `roomNewToken`);

    let msg = new RoomNewTokenMsg();
    msg.data = {
      authToken: this.localPeer.authToken,
      expiresInMin: expiresInMin
    };

    return this.send(msg);
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

    return this.send(msg);
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

    this.roomClose();
    return this.send(msg);
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
    console.log(DSTR, "** onmessage", msgIn.type, msgIn);
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
        case payloadTypeClient.roomProducerToggleStream:
          this.onRoomProducerToggleStream(msgIn);
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

  private send = (msg: any): boolean => {
    console.log(DSTR, "send", msg.type, msg);

    return this.ws.send(JSON.stringify(msg));
  };

  private addPeer = (peer: Peer) => {
    console.log(DSTR, `addPeer() ${peer.peerId} ${peer.trackingId}`);

    if (this.peers.find(p => p.peerId === peer.peerId)) {
      console.error(DSTR, "peer already exists");
      return false;
    }

    if (peer.peerId === this.localPeer.peerId) {
      console.log(DSTR, `cannot add yourself as a peerid: ${this.localPeer.peerId}`);
      return false;
    }

    this.peers.push(peer);
    return true;
  };

  private removePeer = (peer: Peer) => {
    console.log(DSTR, `removePeer() ${peer.peerId}`);

    peer.tracks.getTracks().forEach((track) => track.stop());
    peer.tracks.clearTracks();
    peer.producersToConsume = [];

    let idx = this.peers.findIndex(p => p == peer);
    if (idx > -1) {
      this.peers.splice(idx, 1);
      return true;
    }
    return false;

  };

  private getPeer = (peerId: string) => {
    return this.peers.find(p => p.peerId == peerId);
  };


  private onAuthUserNewTokenResult = async (msgIn: AuthUserNewTokenResultMsg) => {
    console.log("onAuthUserNewTokenResult");

    if (msgIn.data.authToken) {
      this.localPeer.authToken = msgIn.data.authToken;
    } else {
      console.log(`Error getting authtoken ${msgIn.data.error}`);
    }

  };

  private onRegisterResult = async (msgIn: RegisterPeerResultMsg) => {
    console.log(DSTR, `** onRegisterResult - peerId: ${msgIn.data?.peerId}`);

    if (msgIn.data.error) {
      console.log(DSTR, `register failed ${msgIn.data.error}`);
      this.localPeer.peerId = "";
      return;
    }

    this.localPeer.peerId = msgIn.data!.peerId;

  };

  private createProducerTransport = (): boolean => {
    console.log(DSTR, "** createProducerTransport");

    let msg = new CreateProducerTransportMsg();
    msg.data.roomId = this.localPeer.roomId;
    this.send(msg);

    return true;
  };

  private createConsumerTransport = (): boolean => {
    console.log(DSTR, "** createConsumerTransport");

    let msg = new CreateConsumerTransportMsg();
    msg.data.roomId = this.localPeer.roomId;
    this.send(msg);

    return true;
  };

  private onRoomNewTokenResult = async (msgIn: RoomNewTokenResultMsg) => {
    console.log(DSTR, "** onRoomNewTokenResult()");

    if (msgIn.data.error) {
      console.error(DSTR, msgIn.data.error);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId
    this.localPeer.roomToken = msgIn.data.roomToken;
    console.log(DSTR, "room token set " + this.localPeer.roomToken, this.localPeer.roomId);

  };

  private onRoomNewResult = async (msgIn: RoomNewResultMsg) => {

    console.log(DSTR, "** onRoomNewResult()");

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

    console.log(DSTR, "** onRoomJoinResult()");
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
      for (const p of msgIn.data.peers) {

        let newpeer: Peer = this.createPeer(p.peerId, p.peerTrackingId, p.displayName);

        //save the existing producers for later to consume
        newpeer.producersToConsume.push(...p.producers.map(p => ({ producerId: p.producerId, kind: p.kind })));

        console.log(DSTR, p.peerId);
        console.log(DSTR, "** onRoomJoinResult producers :" + p.producers?.length);

      }
    }

    for (const peer of this.peers) {
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
      for (const producerInfo of msgIn.data.producers) {
        await this.consumeProducer(msgIn.data.peerId, producerInfo.producerId, producerInfo.kind);
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

    this.removePeer(peer);
    let roomid = msgIn.data.roomId;
    await this.eventOnRoomPeerLeft(roomid, peer);
  }

  private onRoomProducerToggleStream(msgIn: RoomProducerToggleStreamMsg) {
    console.warn(DSTR, "onRoomProducerToggleStream");

    if (!this.localPeer.roomId) {
      console.error(DSTR, "not in a room.");
      return;
    }

    if (this.localPeer.roomId !== msgIn.data.roomId) {
      console.error(DSTR, "not the same room.");
      return;
    }

    let kinds = msgIn.data.tracksInfo.map(i => i.kind);

    let peer: IPeer;
    let tracks: MediaStreamTrack[];
    //some remote person shut me off
    if (this.localPeer.peerId == msgIn.data.peerId) {
      peer = this.localPeer;
      tracks = this.localPeer.tracks.getTracks();
    } else {
      peer = this.peers.find(p => p.peerId === msgIn.data.peerId);
      tracks = peer.tracks.getTracks();
    }

    tracks = tracks.filter(t => kinds.includes(t.kind));

    if (!peer) {
      console.error(DSTR, `peer not found ${msgIn.data.peerId}`);
      return;
    }

    if (!tracks || tracks.length == 0) {
      console.error(DSTR, `no tracks found for kinds:`, kinds);
      return;
    }

    for (const track of tracks) {
      console.warn(`track ${track.id} ${track.kind} ${track.enabled}`);
      let info = msgIn.data.tracksInfo.find(i => i.kind === track.kind);
      if (!info) {
        console.warn(`info not found for track of kind ${track.kind}`);
        continue;
      }
      if (info.enabled !== track.enabled) {
        track.enabled = info.enabled;
        console.warn(DSTR, `track toggled to: ${track.enabled}`);
        this.eventOnPeerTrackToggled(peer, track, track.enabled);
      } else {
        console.warn(DSTR, `no change to track state. ${peer.displayName}'s ${track.kind}`);
      }
    }
  }

  private onRoomClosed = async (msgIn: RoomClosedMsg) => {
    console.log(DSTR, "onRoomClosed:" + msgIn.data.roomId);

    let copyPeers = [...this.peers];
    this.roomClose();

    await this.eventOnRoomClosed(msgIn.data.roomId, copyPeers);
  }

  private roomClose() {
    console.log(DSTR, "** roomClose");

    if (!this.localPeer.roomId) {
      console.error(DSTR, "not in a room.")
      return;
    }


    this.localPeer.clearProducers();

    this.localPeer.transportSend?.close();
    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend = null;
    this.localPeer.transportReceive = null;

    for (const t of this.localPeer.tracks.getTracks()) {
      t.stop();
    }

    for (const p of this.peers) {
      p.tracks.getTracks().forEach(t => t.stop());
      p.tracks.clearTracks();
      p.producersToConsume = [];
      p.clearConsumers();
    }

    this.localPeer.tracks.clearTracks();
    this.localPeer.roomId = "";
    this.peers = [];

    console.log(DSTR, "** room closed");

  }

  /**
   * when you join a room transports need be created and published to a room
   */
  private waitForRoomTransports = async (): Promise<IMsg> => {
    console.log(DSTR, "** waitForRoomTransports");

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
    console.log(DSTR, "** waitForTransportConnected created " + transport.direction)
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
    if (peer.producersToConsume.length == 0) {
      console.log(DSTR, "peer has no producersToConsume");
    }

    for (const producerInfo of peer.producersToConsume) {
      await this.consumeProducer(peer.peerId, producerInfo.producerId, producerInfo.kind);
    }
  }

  private onConsumerTransportCreated = async (msgIn: ConsumerTransportCreatedMsg) => {
    console.log(DSTR, "** onConsumerTransportCreated");

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
    console.log(DSTR, "** onConsumerTransportConnected");
  }

  private onProducerTransportCreated = async (msgIn: ProducerTransportCreatedMsg) => {
    console.log(DSTR, "** onProducerTransportCreated");

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
      console.log(DSTR, "** sendTransport connect");
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

      console.log(DSTR, "** sendTransport produce");

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
    console.log(DSTR, "** onProducerTransportConnected");

  }

  private onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    console.log(DSTR, "onRoomNewProducer: " + msgIn.data.kind);

    let peer = this.peers.find(p => p.peerId === msgIn.data.peerId);
    if (!peer) {
      console.error(`peer not found. peerId: ${msgIn.data.peerId}`);
      return;
    }

    if (!this.isInRoom()) {
      console.error("not in a room");
      return;
    }

    this.consumeProducer(msgIn.data.peerId, msgIn.data.producerId, msgIn.data.kind);
  }

  private consumeProducer = async (remotePeerId: string, producerId: string, kind: string) => {
    console.log(DSTR, "consumeProducer() :" + remotePeerId, producerId);

    if (remotePeerId === this.localPeer.peerId) {
      console.error("consumeProducer() - you can't consume yourself.");
      return;
    }

    if (!this.isInRoom()) {
      console.error("not in a room");
      return;
    }

    let peer = this.peers.find(p => p.peerId === remotePeerId);

    if (!peer) {
      console.error(`peer not found. ${remotePeerId}`);
      return;
    }

    //if already consuming a producer stop and remove
    let existingConsumer = peer.getConsumers().find(c => c.peerId === remotePeerId && c.consumer.kind === kind);
    if (existingConsumer) {
      console.warn(`existingConsumer found for peer ${remotePeerId} ${kind}`)
      peer.removeConsumer(existingConsumer.consumer);
    }

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
    console.warn(DSTR, "onConsumed() " + msgIn.data?.kind);

    let peer = this.peers.find(p => p.peerId === msgIn.data.peerId);

    if (!peer) {
      console.error(DSTR, `onConsumed - peer not found, peerId: ${msgIn.data.peerId}`);
      return;
    }

    const consumer = await peer.createConsumer(this.localPeer.transportReceive, msgIn.data.peerId, msgIn.data.consumerId, msgIn.data.producerId, msgIn.data.kind, msgIn.data.rtpParameters);
    let track = consumer.track;
    track.enabled = true;

    console.warn(`add track for ${peer.displayName} of type ${track.kind}`);
    console.warn(`existing tracks:`, peer.tracks);
    peer.tracks.addTrack(track);

    if (this.eventOnPeerNewTrack) {
      await this.eventOnPeerNewTrack(peer, track);
    }
  };

  private onProduced = async (msgIn: RoomProduceStreamResultMsg) => {
    console.log(DSTR, "onProduced " + msgIn.data?.kind);
  };
}
