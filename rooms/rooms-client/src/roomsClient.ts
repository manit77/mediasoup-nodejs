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
  UniqueMap,
} from "@rooms/rooms-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { Transport } from 'mediasoup-client/types';
import { IPeer, LocalPeer, Peer } from './models/peers.js';

export class RoomsClient {

  private ws: WebSocketClient;
  public localPeer: LocalPeer = new LocalPeer();

  peers: UniqueMap<Peer> = new UniqueMap();
  audioEnabled = true;
  videoEnabled = true;

  private device: mediasoupClient.types.Device;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ]

  config = {
    socket_ws_uri: "wss://localhost:3000",
    socket_auto_reconnect: true,
    socket_enable_logs: false
  }

  constructor(options: { socket_ws_uri: string, socket_auto_reconnect: boolean, socket_enable_logs: boolean }) {
    console.warn(`*** new RoomsClient`);

    this.config.socket_auto_reconnect = options.socket_auto_reconnect;
    this.config.socket_enable_logs = options.socket_enable_logs;
    this.config.socket_ws_uri = options.socket_ws_uri;
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

  inititalize = async (options: { rtp_capabilities?: any }) => {
    console.log("inititalize");

    this.config.socket_ws_uri = this.config.socket_ws_uri;
    this.config.socket_auto_reconnect = this.config.socket_auto_reconnect;
    await this.initMediaSoupDevice(options.rtp_capabilities);
    console.log("init complete");

  };

  dispose = () => {
    console.log("disposeRoom()");

    this.disconnect();
    this.eventOnRoomJoinFailed = null;
    this.eventOnRoomJoined = null;
    this.eventOnRoomPeerJoined = null;
    this.eventOnPeerNewTrack = null;
    this.eventOnRoomPeerLeft = null;
    this.eventOnRoomClosed = null;
    this.eventOnPeerTrackToggled = null;
    this.eventOnRoomSocketClosed = null;
    console.log("dispose() - complete");
  };

  connect = async (wsURI: string = "") => {
    console.log(`connect ${wsURI} autoReconnect: ${this.config.socket_auto_reconnect}`);
    if (wsURI) {
      this.config.socket_ws_uri = wsURI;
    }

    if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
      console.log("socket already " + this.ws.state)
      return;
    }

    console.log("connect " + this.config.socket_ws_uri);
    this.ws = new WebSocketClient();

    this.ws.addEventHandler("onopen", this.socketOnOpen);
    this.ws.addEventHandler("onmessage", this.onSocketEvent);
    this.ws.addEventHandler("onclose", this.socketOnClose);
    this.ws.addEventHandler("onerror", this.socketOnClose);

    this.ws.connect(this.config.socket_ws_uri, this.config.socket_auto_reconnect);

  };

  disconnect = () => {
    console.log("disconnect");

    if (this.ws) {
      this.ws.disconnect();
    }
    this.resetLocalPeer();
    this.resetPeers();
  };

  resetLocalPeer() {
    console.log(`resetLocalPeer`);
    //this.localPeer.tracks = new UniqueTracks();
    this.localPeer.clearProducers();
    this.localPeer.transportReceive?.close();
    this.localPeer.transportSend?.close();

    this.localPeer.transportReceive = null;
    this.localPeer.transportSend = null;
    this.localPeer = new LocalPeer();
  }

  resetPeers() {
    console.log(`resetPeers`);

    for (let peer of this.peers.values()) {
      peer.clearConsumers();
    }
    this.peers.clear();
  }

  private socketOnOpen = async () => {
    console.log("websocket open " + this.config.socket_ws_uri);
  };

  private socketOnClose = async () => {
    console.error("socketOnClose closed");
    let roomId = this.localPeer.roomId;
    if (roomId) {
      let copyPeers = [...this.peers.values()];
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
  waitForConnect = (socketURI: string = ""): Promise<IMsg> => {
    console.log(`waitForConnect() ${socketURI}`);
    return new Promise<IMsg>((resolve, reject) => {
      try {

        if (socketURI) {
          this.config.socket_ws_uri = socketURI;
        }

        console.log("config.socket_ws_uri:", this.config.socket_ws_uri);

        if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
          console.log("socket already created. current state: " + this.ws.state);
          resolve(new OkMsg(payloadTypeServer.ok, "already connecting"));
          return;
        }

        this.ws = new WebSocketClient({ enableLogs: this.config.socket_enable_logs });
        console.log("waitForConnect() - " + this.config.socket_ws_uri + " state:" + this.ws.state);

        const _onOpen = () => {
          console.log("websocket onOpen " + this.config.socket_ws_uri);
          this.socketOnOpen();
          resolve(new OkMsg(payloadTypeServer.ok, "socket opened."));
          clearTimeout(timerid);
        };

        const _onClose = () => {
          console.log("websocket onClose");
          this.socketOnClose();
          resolve(new ErrorMsg(payloadTypeServer.error, "closed"));
        };

        this.ws.addEventHandler("onopen", _onOpen);
        this.ws.addEventHandler("onmessage", this.onSocketEvent);
        this.ws.addEventHandler("onclose", _onClose);
        this.ws.addEventHandler("onerror", _onClose);

        this.ws.connect(this.config.socket_ws_uri, this.config.socket_auto_reconnect);

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

  /**
   * register a client connection and wait for a result
   * @param trackingId 
   * @param displayName 
   * @returns 
   */
  waitForRegister = (authToken: string, trackingId: string, displayName: string): Promise<IMsg> => {
    console.log("waitForRegister");

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
          console.log("--waitForRegister() - onmessage", msg);
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
          console.log("waitForNewRoomToken() -- onmessage", msg);

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
          console.log("waitForNewRoom() -- onmessage", msg);

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
          console.log("** onmessage", event.data);
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

  register = (authToken: string, trackingId: string, displayName: string) => {
    console.log(`-- register trackingId: ${trackingId}, displayName: ${displayName}`);

    if (this.localPeer.peerId) {
      console.log(`-- register, already registered. ${this.localPeer.peerId}`);
      return true;
    }

    if (!authToken) {
      console.log("** register, authtoken is required.");
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
    console.log(`Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
  };

  toggleVideo = () => {
    this.videoEnabled = !this.videoEnabled;
    console.log(`Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
  };

  publishTracks = async (tracks: MediaStreamTrack[]) => {
    console.log("publishTracks");

    if (!tracks) {
      console.error("ERROR: tracks is required.")
      return;
    }

    if (!this.localPeer.transportSend) {
      console.error('No transportSend');
      return;
    }

    let localTracks = this.localPeer.getTracks();
    console.log(`localTracks`, localTracks);
    for (const track of tracks) {
      try {
        console.log(`track ${track.kind}`);
        let existingTrack = localTracks.find(t => t.kind === track.kind);
        if (existingTrack) {
          console.error(`existingTrack of kind ${track.kind}, track must be replaced or unpublished.`);
          return;
        }

        let producer = await this.localPeer.createProducer(track);
        console.log("producer add with track added: " + producer.track.kind);
      } catch (error) {
        console.error(`Failed to produce track: ${error.message}`);
        console.error(error);
      }
    }

    console.log(`local producers:`, this.localPeer.getProducers());
    console.log(`local tracks:`, this.localPeer.getTracks());


  };

  unPublishTracks = async (tracks: MediaStreamTrack[]) => {
    console.log(`removeLocalTracks`);

    for (const track of tracks) {
      let producer = this.localPeer.getProducers().get(track.kind);
      if (producer) {
        console.log(`producer found, closing ${track.kind}`)
        producer.close();
        this.localPeer.removeProducer(producer);
        console.log(`track removed ${track.kind}`);
      }
    }

  };

  // findTrack = (kind: string) => {
  //   return this.localPeer.tracks.getTrack(kind);
  // }

  replaceTrack = async (existingTrack: MediaStreamTrack, newTrack: MediaStreamTrack) => {
    console.log("replaceTrack");

    if (!existingTrack) {
      console.error("existing track is null");
      return;
    }

    if (!newTrack) {
      console.error("new track is null");
      return;
    }

    let producer = this.localPeer.getProducers().get(existingTrack.kind);
    if (producer) {
      producer.replaceTrack({ track: newTrack });

      // this.localPeer.tracks.removeTrack(existingTrack.kind);
      // this.localPeer.tracks.addTrack(newTrack);
    } else {
      console.error(`producer not found, existing track not found. ${existingTrack.kind} ${existingTrack.id}`);
    }

  };

  roomProducerToggleStream = async (peerId: string) => {
    console.log(`roomProducerToggleStream`);

    let tracks: MediaStreamTrack[];
    if (peerId === this.localPeer.peerId) {
      //this is a local peer that was updated
      tracks = this.localPeer.getTracks();
    } else {
      // remote peer updated
      let remotePeer = [...this.peers.values()].find(p => p.peerId === peerId);
      if (!remotePeer) {
        console.log(`remote peer not found.`);
        return;
      }

      tracks = remotePeer.getTracks();
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
    console.log(`roomNewToken`);

    let msg = new RoomNewTokenMsg();
    msg.data = {
      authToken: this.localPeer.authToken,
      expiresInMin: expiresInMin
    };

    return this.send(msg);
  };

  roomNew = (maxPeers: number, maxRoomDurationMinutes: number) => {
    console.log(`${maxPeers} ${maxRoomDurationMinutes}`);

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
    console.log(`roomJoin ${roomid} ${roomToken}`);

    let msg = new RoomJoinMsg();
    msg.data = {
      roomId: roomid,
      roomToken: roomToken
    };
    this.send(msg);
  };

  roomLeave = () => {
    console.log("roomLeave");

    if (!this.localPeer.roomId) {
      console.error("not in room");
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
    console.log("initMediaSoupDevice");

    if (this.device) {
      console.log("device already initialized");
      return;
    }

    try {
      // In real implementation, this would use the actual mediasoup-client
      this.device = new mediasoupClient.Device();
      console.log("MediaSoup device initialized");
      if (rtpCapabilities) {
        console.log(rtpCapabilities);

        await this.device.load({ routerRtpCapabilities: rtpCapabilities });
        console.log("MediaSoup device loaded");
      }

    } catch (error) {
      console.log(`Error initializing MediaSoup: ${error.message}`);
    }
  };

  private onSocketEvent = async (event: any) => {

    let msgIn = JSON.parse(event.data);
    console.log("** onmessage", msgIn.type, msgIn);
    //parse the msgIn
    if (!msgIn.type) {
      console.log("invalid message type");
      return;
    }

    if (!msgIn.data) {
      console.log("invalid message data");
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
    console.log("send", msg.type, msg);

    return this.ws.send(JSON.stringify(msg));
  };

  private addPeer = (remotePeer: Peer) => {
    console.log(`addPeer() - ${remotePeer.displayName} ${remotePeer.peerId} ${remotePeer.trackingId}`);

    if (this.peers.has(remotePeer.peerId)) {
      console.error(`peer already exists, ${remotePeer.peerId}`);
      return false;
    }

    if (remotePeer.peerId === this.localPeer.peerId) {
      console.log(`cannot add yourself as a peerid: ${this.localPeer.peerId}`);
      return false;
    }

    this.peers.set(remotePeer.peerId, remotePeer);
    return true;
  };

  private removePeer = (remotePeer: Peer) => {
    console.log(`removePeer() - ${remotePeer.displayName} ${remotePeer.peerId} ${remotePeer.trackingId}`);

    remotePeer.clearConsumers();
    remotePeer.producersToConsume = [];

    return this.peers.delete(remotePeer.peerId);
  };

  // private getPeer = (peerId: string) => {
  //   return this.peers.find(p => p.peerId == peerId);
  // };


  private onAuthUserNewTokenResult = async (msgIn: AuthUserNewTokenResultMsg) => {
    console.log("onAuthUserNewTokenResult");

    if (msgIn.data.authToken) {
      this.localPeer.authToken = msgIn.data.authToken;
    } else {
      console.log(`Error getting authtoken ${msgIn.data.error}`);
    }

  };

  private onRegisterResult = async (msgIn: RegisterPeerResultMsg) => {
    console.log(`** onRegisterResult - peerId: ${msgIn.data?.peerId}`);

    if (msgIn.data.error) {
      console.log(`register failed ${msgIn.data.error}`);
      this.localPeer.peerId = "";
      return;
    }

    this.localPeer.peerId = msgIn.data!.peerId;

  };

  private createProducerTransport = (): boolean => {
    console.log("** createProducerTransport");

    let msg = new CreateProducerTransportMsg();
    msg.data.roomId = this.localPeer.roomId;
    this.send(msg);

    return true;
  };

  private createConsumerTransport = (): boolean => {
    console.log("** createConsumerTransport");

    let msg = new CreateConsumerTransportMsg();
    msg.data.roomId = this.localPeer.roomId;
    this.send(msg);

    return true;
  };

  private onRoomNewTokenResult = async (msgIn: RoomNewTokenResultMsg) => {
    console.log("** onRoomNewTokenResult()");

    if (msgIn.data.error) {
      console.error(msgIn.data.error);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId
    this.localPeer.roomToken = msgIn.data.roomToken;
    console.log("room token set " + this.localPeer.roomToken, this.localPeer.roomId);

  };

  private onRoomNewResult = async (msgIn: RoomNewResultMsg) => {

    console.log("** onRoomNewResult()");

    if (!msgIn.data.roomRtpCapabilities) {
      console.error("ERROR: not  rtpCapabilities received.");
      return;
    }

    if (!this.device.loaded) {
      console.log("loading device with rtpCapabilities");
      await this.device.load({ routerRtpCapabilities: msgIn.data.roomRtpCapabilities });
      console.log("** device loaded ", this.device.loaded);
    }

  };

  private onRoomJoinResult = async (msgIn: RoomJoinResultMsg) => {

    console.log("** onRoomJoinResult()");
    if (msgIn.data.error) {
      console.error(msgIn.data.error);
      await this.eventOnRoomJoinFailed(this.localPeer.roomId);
      return;
    }

    this.localPeer.roomId = msgIn.data.roomId;

    console.log("joined room " + msgIn.data!.roomId);
    console.log(`-- onRoomJoinResult() peers : ${msgIn.data?.peers.length}`);

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

        console.log(p.peerId);
        console.log("** onRoomJoinResult producers :" + p.producers?.length);

      }
    }

    for (const peer of this.peers.values()) {
      await this.consumePeerProducers(peer);
      await this.eventOnRoomPeerJoined(this.localPeer.roomId, peer);
    }

    await this.eventOnRoomJoined(this.localPeer.roomId);
  }

  private createPeer(peerId: string, trackingId: string, displayName: string) {
    console.log(`createPeer() - ${displayName}, peerId:${peerId}, trackingId:${trackingId} `);
    let newpeer: Peer = new Peer();
    newpeer.peerId = peerId;
    newpeer.trackingId = trackingId;
    newpeer.displayName = displayName;

    this.addPeer(newpeer);

    return newpeer;
  }

  private onRoomNewPeer = async (msgIn: RoomNewPeerMsg) => {
    console.log("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    console.log(`new PeeerJoined ${msgIn.data?.peerId} `);

    let newpeer: Peer = this.createPeer(msgIn.data.peerId, msgIn.data.peerTrackingId, msgIn.data.displayName);
    if (msgIn.data?.producers) {
      for (const producerInfo of msgIn.data.producers) {
        await this.consumeProducer(msgIn.data.peerId, producerInfo.producerId, producerInfo.kind);
      }
    }

    await this.eventOnRoomPeerJoined(msgIn.data.roomId, newpeer);
  }

  private onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    console.log("peer left the room, peerid:" + msgIn.data.peerId);

    let peer = this.peers.get(msgIn.data.peerId);
    if (!peer) {
      console.error(`peer not found ${msgIn.data.peerId}, current peers:`, this.peers);
      return;
    }

    this.removePeer(peer);
    let roomid = msgIn.data.roomId;
    await this.eventOnRoomPeerLeft(roomid, peer);
  }

  private onRoomProducerToggleStream(msgIn: RoomProducerToggleStreamMsg) {
    console.log("onRoomProducerToggleStream");

    if (!this.localPeer.roomId) {
      console.error("not in a room.");
      return;
    }

    if (this.localPeer.roomId !== msgIn.data.roomId) {
      console.error("not the same room.");
      return;
    }

    let kinds = msgIn.data.tracksInfo.map(i => i.kind);

    let peer: IPeer;
    let tracks: MediaStreamTrack[];
    //some remote person shut me off
    if (this.localPeer.peerId == msgIn.data.peerId) {
      peer = this.localPeer;
      tracks = this.localPeer.getTracks();
    } else {
      peer = this.peers.get(msgIn.data.peerId);
      tracks = (peer as Peer).getConsumers().map(c => c.consumer.track);
    }

    tracks = tracks.filter(t => kinds.includes(t.kind));

    if (!peer) {
      console.error(`peer not found ${msgIn.data.peerId}`);
      return;
    }

    if (!tracks || tracks.length == 0) {
      console.error(`no tracks found for kinds:`, kinds);
      return;
    }

    for (const track of tracks) {
      console.log(`track ${track.id} ${track.kind} ${track.enabled}`);
      let info = msgIn.data.tracksInfo.find(i => i.kind === track.kind);
      if (!info) {
        console.log(`info not found for track of kind ${track.kind}`);
        continue;
      }
      if (info.enabled !== track.enabled) {
        track.enabled = info.enabled;
        console.log(`track toggled to: ${track.enabled}`);
        this.eventOnPeerTrackToggled(peer, track, track.enabled);
      } else {
        console.log(`no change to track state. ${peer.displayName}'s ${track.kind}`);
      }
    }
  }

  private onRoomClosed = async (msgIn: RoomClosedMsg) => {
    console.log("onRoomClosed:" + msgIn.data.roomId);

    let copyPeers = [...this.peers.values()];
    this.roomClose();

    await this.eventOnRoomClosed(msgIn.data.roomId, copyPeers);
  }

  private roomClose() {
    console.log("** roomClose");

    if (!this.localPeer.roomId) {
      console.error("not in a room.")
      return;
    }

    this.resetLocalPeer();
    this.resetPeers()

    console.log("** room closed");
  }

  /**
   * when you join a room transports need be created and published to a room
   */
  private waitForRoomTransports = async (): Promise<IMsg> => {
    console.log("** waitForRoomTransports");

    if (!this.localPeer.roomId) {
      console.error("room is required for creating transports");
      return new ErrorMsg(payloadTypeServer.error, "cannot create transports before joining a room.");
    }

    let waitFunc = () => {
      return new Promise<IMsg>((resolve, reject) => {
        try {
          let transTrack = { recv: false, send: false };

          let timerid = setTimeout(() => {
            console.error("transport timed out.");
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
    console.log("** waitForTransportConnected created " + transport.direction)
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
          console.log("connectionstatechange transport: " + state);
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
    console.log(`connectToPeer() ${peer.peerId}`);

    if (!this.localPeer.roomId) {
      console.error("cannot connect to a peer. not in a room.");
      return;
    }

    if (!this.localPeer.transportReceive || !this.localPeer.transportSend) {
      console.error("transports have not been created.");
      return;
    }

    //consume transports
    if (peer.producersToConsume.length == 0) {
      console.log("peer has no producersToConsume");
    }

    for (const producerInfo of peer.producersToConsume) {
      await this.consumeProducer(peer.peerId, producerInfo.producerId, producerInfo.kind);
    }
  }

  private onConsumerTransportCreated = async (msgIn: ConsumerTransportCreatedMsg) => {
    console.log("** onConsumerTransportCreated");

    //the server has created a consumer transport for the peer 
    //roomid should match the local roomid
    if(msgIn.data.roomId != this.localPeer.roomId) {
      console.error(`onConsumerTransportCreated: invalid message for roomid`);
      return;
    }

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
    console.log("** onConsumerTransportConnected");
  }

  private onProducerTransportCreated = async (msgIn: ProducerTransportCreatedMsg) => {
    console.log("** onProducerTransportCreated");
    
    //the server has created a producer transport for the peer
    //roomid should match the local roomid
    if(msgIn.data.roomId != this.localPeer.roomId) {
      console.error(`onProducerTransportCreated: invalid message for roomid`);
      return;
    }

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
      console.log("** sendTransport connect");
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

      console.log("** sendTransport produce");

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
    console.log("** onProducerTransportConnected");

  }

  private onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    console.log("onRoomNewProducer: " + msgIn.data.kind);

    let peer = this.peers.get(msgIn.data.peerId);
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
    console.log("consumeProducer() :" + remotePeerId, producerId);

    if (remotePeerId === this.localPeer.peerId) {
      console.error("consumeProducer() - you can't consume yourself.");
      return;
    }

    if (!this.isInRoom()) {
      console.error("not in a room");
      return;
    }

    let peer = this.peers.get(remotePeerId);
    if (!peer) {
      console.error(`peer not found. ${remotePeerId}`);
      return;
    }

    //if already consuming a producer stop and remove
    let existingConsumer = peer.getConsumers().find(c => c.peerId === remotePeerId && c.consumer.kind === kind);
    if (existingConsumer) {
      console.log(`existingConsumer found for peer ${remotePeerId} ${kind}`)
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
    console.log("onConsumed() " + msgIn.data?.kind);

    let peer = this.peers.get(msgIn.data.peerId);
    if (!peer) {
      console.error(`onConsumed - peer not found, peerId: ${msgIn.data.peerId}`);
      return;
    }

    const consumer = await peer.createConsumer(this.localPeer.transportReceive, msgIn.data.peerId, msgIn.data.consumerId, msgIn.data.producerId, msgIn.data.kind, msgIn.data.rtpParameters);
    console.log(`add track for ${peer.displayName} of type ${consumer.track.kind}`);

    if (this.eventOnPeerNewTrack) {
      await this.eventOnPeerNewTrack(peer, consumer.track);
    }
  };

  private onProduced = async (msgIn: RoomProduceStreamResultMsg) => {
    console.log("onProduced " + msgIn.data?.kind);
  };
}
