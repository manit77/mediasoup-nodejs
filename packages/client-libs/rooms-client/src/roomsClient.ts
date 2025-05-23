import * as mediasoupClient from 'mediasoup-client';
import {
  AuthUserNewTokenMsg,
  AuthUserNewTokenResultMsg,
  ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg
  , ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg
  , ErrorMsg, IMsg, OkMsg, payloadTypeClient, payloadTypeServer, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg
  , RegisterPeerMsg, RegisterPeerResultMsg, RoomConfig, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg, RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg
} from "@rooms/rooms-models";
import { WebSocketClient } from "@rooms/websocket-client";
import { Transport } from 'mediasoup-client/types';

export interface JoinInfo { roomId: string, roomToken: string };

export class LocalPeer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";
  hasVideo: boolean = true;
  hasAudio: boolean = true;
  stream: MediaStream = null;
  consumers: mediasoupClient.types.Consumer[] = [];
  producers: mediasoupClient.types.Producer[] = [];
}

export class Peer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";
  hasVideo: boolean = true;
  hasAudio: boolean = true;
  stream: MediaStream = null;
  producers: {
    id: string, kind: "audio" | "video"
  }[] = [];
}

export class RoomsClient {

  ws: WebSocketClient;

  serviceToken: string = ""; //used to request an authtoken

  authToken: string = "";
  roomToken: string = "";
  localRoomId: string = "";
  localPeer: LocalPeer = new LocalPeer();
  isConnected = false;
  isRoomConnected = false;

  peers: Peer[] = [];
  audioEnabled = true;
  videoEnabled = true;

  device: mediasoupClient.types.Device;
  transportSend: mediasoupClient.types.Transport;
  transportReceive: mediasoupClient.types.Transport;

  config = {
    wsURI: "wss://localhost:3000",
  }

  onRoomJoinedEvent: (roomId: string) => void;
  onTransportsReadyEvent: (transport: mediasoupClient.types.Transport) => void;
  onRoomPeerJoinedEvent: (roomId: string, peer: Peer) => void;
  onPeerNewTrackEvent: (peer: Peer, track: MediaStreamTrack) => void;
  onRoomPeerLeftEvent: (roomId: string, peer: Peer) => void;

  init = async (uri: string) => {
    this.config.wsURI = uri;
    this.initMediaSoupDevice();
  };

  writeLog = async (...params: any) => {
    console.log("RoomsClient", ...params);
  }

  initMediaSoupDevice = () => {
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
    this.writeLog("-- onmessage", msgIn);

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
        case payloadTypeServer.consumerTransportCreated:
          this.onConsumerTransportCreated(msgIn);
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
        case payloadTypeServer.roomTerminate:
          this.onRoomTerminate(msgIn);
          break;
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
      this.isConnected = true;
      this.writeLog("websocket open " + this.config.wsURI);
    };

    const onClose = async () => {
      this.writeLog("websocket closed");
      this.isConnected = false;
    };

    this.ws.addEventHandler("onopen", onOpen);
    this.ws.addEventHandler("onmessage", this.onSocketEvent);
    this.ws.addEventHandler("onclose", onClose);
    this.ws.addEventHandler("onerror", onClose);

    this.ws.connect(this.config.wsURI, true);

  };

  async getUserMedia(enableAudio: boolean = true, enableVideo: boolean = true): Promise<MediaStream> {
    this.localPeer.stream = await navigator.mediaDevices.getUserMedia({
      video: enableVideo,
      audio: enableAudio
    });
    return this.localPeer.stream;
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
          this.isConnected = true;
          this.writeLog("websocket onOpen " + this.config.wsURI);
          resolve(new OkMsg("connected"));
        };

        const onClose = async () => {
          this.writeLog("websocket onClose");
          this.isConnected = false;
          resolve(new OkMsg("connected"));
        };

        this.ws.addEventHandler("onopen", onOpen);
        this.ws.addEventHandler("onmessage", this.onSocketEvent);
        this.ws.addEventHandler("onclose", onClose);
        this.ws.addEventHandler("onerror", onClose);

        this.isConnected = false;
        this.ws.connect(this.config.wsURI, true);
      } catch (err: any) {
        console.error(err);
        resolve(new ErrorMsg("failed to connect"));
      }

    });
  }

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
        this.register(this.authToken, trackingId, displayName);
      } catch (err: any) {
        console.error(err);
        resolve(new ErrorMsg("failed to register"));
      }
    });
  }

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
  }

  waitForNewRoom = async (maxPeers: number, maxRoomDurationMinutes: number): Promise<IMsg> => {
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

        this.roomNew(maxPeers, maxRoomDurationMinutes);

      } catch (err: any) {
        console.error(err);
        resolve(new ErrorMsg("failed to create new room"));
      }
    });
  }

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
  }

  /**
   * when you join a room transports need be created and published to a room
   */
  private waitForRoomTransports = async (): Promise<IMsg> => {

    if (!this.localRoomId) {
      this.writeLog("room is required for creating transports");
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

  }

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
  }

  connectToPeer(peer: Peer) {
    this.writeLog(`connectToPeer() ${peer.peerId}`);

    if (!this.localRoomId) {
      this.writeLog("cannot connect to a peer. not in a room.");
      return;
    }

    if (!this.transportReceive || !this.transportSend) {
      this.writeLog("transports have not been created.");
      return;
    }

    //consume transports
    if (peer.producers && peer.producers.length > 0) {
      this.writeLog("peer has no producers");
    }
    peer.producers.forEach(p => {
      this.consumeProducer(peer.peerId, p.id);
    });
  }

  disconnect = () => {
    this.writeLog("disconnect");
    this.ws.disconnect();
    this.isConnected = false;
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

  removePeer = (peerId: string) => {
    this.writeLog(`removePeer() ${peerId}`);

    let idx = this.peers.findIndex(p => p.peerId == peerId);
    if (idx > -1) {
      this.peers.splice(idx, 1);
    }
  };

  publishLocalStream() {
    console.log("publishLocalStream()");

    if (!this.localRoomId) {
      this.writeLog("not in a room.");
      return;
    }

    if (!this.transportSend) {
      this.writeLog("transportSend is required.");
      return;
    }

    let tracks = this.localPeer.stream.getTracks();
    console.log("tracks=" + tracks.length);
    tracks.forEach(track => this.transportSend.produce({ track: track }));
  }

  addRemoteTrack = (peerId: string, track: MediaStreamTrack) => {
    this.writeLog("addRemoteTrack()");

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

  removeRemoteStream = (peerId: string) => {
    this.writeLog("removeRemoteStream()");

    let peer = this.peers.find(p => p.peerId === peerId);
    if (!peer) {
      this.writeLog("removeRemoteStream() - peer not found.");
      return;
    }

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

  }

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
  }

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
  }

  private onAuthUserNewTokenResult = async (msgIn: AuthUserNewTokenResultMsg) => {
    console.log("onAuthUserNewTokenResult()");

    if (msgIn.data.authToken) {
      this.authToken = msgIn.data.authToken;
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

  createProducerTransport = () => {
    this.writeLog("-- createProducerTransport");
    let msg = new CreateProducerTransportMsg();
    this.send(msg);
  };

  createConsumerTransport = () => {
    this.writeLog("-- createConsumerTransport");
    let msg = new CreateConsumerTransportMsg();
    this.send(msg);
  };

  roomNewToken = (expiresInMin: number = 60) => {
    this.writeLog(`roomNewToken`);

    let msg = new RoomNewTokenMsg();
    msg.data = {
      authToken: this.authToken,
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

    this.localRoomId = msgIn.data.roomId
    this.roomToken = msgIn.data.roomToken;
    this.writeLog("room token set " + this.roomToken, this.localRoomId);

  }

  roomNew = (maxPeers: number, maxRoomDurationMinutes: number) => {
    this.writeLog(`roomNew`)
    let config = new RoomConfig();
    config.maxPeers = maxPeers;
    config.maxRoomDurationMinutes = maxRoomDurationMinutes;
    config.newRoomTokenExpiresInMinutes = maxRoomDurationMinutes;
    config.timeOutNoParticipantsSecs = 60;

    let msg = new RoomNewMsg();
    msg.data = {
      authToken: this.authToken,
      peerId: this.localPeer.peerId,
      roomId: this.localRoomId,
      roomToken: this.roomToken,
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

    this.localRoomId = msgIn.data.roomId;
    this.isRoomConnected = true
    this.writeLog("joined room " + msgIn.data!.roomId);


    if (!this.device.loaded) {
      this.writeLog("loading device with rtpCapabilities");
      await this.device.load({ routerRtpCapabilities: msgIn.data.rtpCapabilities });
    }

    this.writeLog(`-- onRoomJoinResult() peers : ${msgIn.data?.peers.length}`);

    let transports = await this.waitForRoomTransports();

    if (transports.data.error) {
      console.log("unable to create transports");
      return;
    }

    if (this.onRoomJoinedEvent) {
      this.onRoomJoinedEvent(this.localRoomId);
    }

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let peer of msgIn.data.peers) {

        let newpeer: Peer = new Peer();

        newpeer.peerId = peer.peerId;
        newpeer.trackingId = peer.trackingId;

        newpeer.producers.push(...peer.producers.map(p => ({ id: p.producerId, kind: p.kind })));

        this.addPeer(newpeer);

        this.writeLog(peer.peerId);
        this.writeLog("-- onRoomJoinResult producers :" + peer.producers?.length);

        // if (peer.producers) {
        //   for (let producer of peer.producers) {
        //     this.writeLog("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
        //     this.consumeProducer(peer.peerId, producer.producerId);
        //   }
        // }

        if (this.onRoomPeerJoinedEvent) {
          this.onRoomPeerJoinedEvent(msgIn.data.roomId, newpeer);
        }

      }
    }

  }


  roomLeave = async () => {
    let msg = new RoomLeaveMsg();
    msg.data = {
      roomId: this.localRoomId,
      roomToken: ""
    };
    this.send(msg);
    this.disposeRoom();
  };

  isInRoom = () => {
    return !!this.isRoomConnected;
  };

  disposeRoom = () => {

    this.writeLog("disposeRoom()");

    this.isRoomConnected = false;
    if (this.localPeer.stream) {
      let tracks = this.localPeer.stream.getTracks();
      tracks.forEach((track) => {
        this.localPeer.stream.removeTrack(track);
      });
    }

    this.localPeer.consumers.forEach(c => c.close());
    this.localPeer.producers.forEach(c => c.close());
    this.transportReceive?.close();
    this.transportSend?.close();

    this.transportReceive = null;
    this.transportSend = null;
    this.peers = [];
    this.localRoomId = "";
    this.localPeer = new LocalPeer();
    this.isConnected = false;
    this.isRoomConnected = false;
    this.ws.disconnect();
    this.writeLog("disposeRoom() - complete");

  };

  private onConsumerTransportCreated = async (msgIn: ConsumerTransportCreatedMsg) => {
    this.writeLog("-- onConsumerTransportCreated");

    this.transportReceive = this.device.createRecvTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data!.iceServers,
      iceCandidates: msgIn.data!.iceCandidates,
      iceParameters: msgIn.data!.iceParameters,
      dtlsParameters: msgIn.data!.dtlsParameters,
      iceTransportPolicy: msgIn.data!.iceTransportPolicy
    });

    this.transportReceive.on('connect', ({ dtlsParameters }, callback) => {
      let msg = new ConnectConsumerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      }
      this.send(msg);
      callback();
    });

    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.transportReceive);
    }
  }

  private onProducerTransportCreated = async (msgIn: ProducerTransportCreatedMsg) => {
    this.writeLog("-- onProducerTransportCreated");

    //the server has created a transport
    //create a client transport to connect to the server transport
    this.transportSend = this.device.createSendTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data!.iceServers,
      iceCandidates: msgIn.data!.iceCandidates,
      iceParameters: msgIn.data!.iceParameters,
      dtlsParameters: msgIn.data!.dtlsParameters,
      iceTransportPolicy: msgIn.data!.iceTransportPolicy
    });

    this.transportSend.on("connect", ({ dtlsParameters }, callback) => {
      this.writeLog("-- sendTransport connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      };
      this.send(msg);

      callback();

    });

    this.transportSend.on('produce', ({ kind, rtpParameters }, callback) => {

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
      this.onTransportsReadyEvent(this.transportSend);
    }

  }

  private onRoomNewPeer = (msgIn: RoomNewPeerMsg) => {
    this.writeLog("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    this.writeLog(`new PeeerJoined ${msgIn.data?.peerId} ${msgIn.data.trackingId} `);

    let newPeer = new Peer();
    newPeer.peerId = msgIn.data.peerId;
    newPeer.trackingId = msgIn.data.trackingId;

    this.addPeer(newPeer);
    if (msgIn.data?.producers) {
      for (let producer of msgIn.data.producers) {
        this.consumeProducer(msgIn.data.peerId, producer.producerId);
      }
    }

    if (this.onRoomPeerJoinedEvent) {
      this.onRoomPeerJoinedEvent(msgIn.data.roomId, newPeer);
    }

  }

  private onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    this.writeLog("peer left the room, peerid:" + msgIn.data?.peerId);

    this.removePeer(msgIn.data.peerId);
    this.removeRemoteStream(msgIn.data.peerId);

    if (this.onRoomPeerLeftEvent) {
      let peer = this.peers.find(p => p.peerId === msgIn.data.peerId);
      let roomid = msgIn.data.roomId;
      this.onRoomPeerLeftEvent(roomid, peer);
    }

  }

  private onRoomTerminate = async (msgIn: RoomPeerLeftMsg) => {
    this.writeLog("onRoomTerminate:" + msgIn.data.roomId);
    this.disposeRoom();
  }

  private onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    this.writeLog("onRoomNewProducer: " + msgIn.data?.kind);
    this.consumeProducer(msgIn.data?.peerId!, msgIn.data?.producerId!);
  }

  addLocalTrack = async (track: MediaStreamTrack) => {
    console.log("addLocalTrack() " + track.kind);
    if (!this.localPeer.stream) {
      this.writeLog("no local stream, creating one");
      this.localPeer.stream = new MediaStream();
    }

    let currentTracks = this.localPeer.stream.getTracks();
    console.log(`tracks=${currentTracks.length}`);

    if (!currentTracks.find(t => t.id === track.id)) {
      this.localPeer.stream.addTrack(track);
      this.writeLog("track added: " + track.kind);
      await this.transportSend.produce({ track });
    }

  };

  removeLocalTrack(track: MediaStreamTrack) {
    if (this.localPeer.stream) {
      this.localPeer.stream.removeTrack(track);
      this.writeLog("track removed: " + track.kind);
    }
  };

  consumeProducer = async (remotePeerId: string, producerId: string) => {
    this.writeLog("consumeProducer() :" + remotePeerId, producerId);
    if (remotePeerId === this.localPeer.peerId) {
      console.error("consumeProducer() - you can't consume yourself.");
    }

    let msg = new ConsumeMsg();
    msg.data = {
      remotePeerId: remotePeerId,
      producerId: producerId,
      rtpCapabilities: this.device.rtpCapabilities
    }
    this.send(msg);
  };

  private onConsumed = async (msgIn: ConsumedMsg) => {
    this.writeLog("onConsumed() " + msgIn.data?.kind);
    const consumer = await this.transportReceive.consume({
      id: msgIn.data!.consumerId,
      producerId: msgIn.data!.producerId,
      kind: msgIn.data!.kind,
      rtpParameters: msgIn.data!.rtpParameters
    });
    this.addRemoteTrack(msgIn.data!.peerId, consumer.track);
  };

  private onProduced = async (msgIn: ProducedMsg) => {
    this.writeLog("onProduced " + msgIn.data?.kind);
  };

}
