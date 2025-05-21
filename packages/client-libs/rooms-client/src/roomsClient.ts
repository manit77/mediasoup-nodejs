import * as mediasoupClient from 'mediasoup-client';
import {
  ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg
  , ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg
  , payloadTypeServer, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg
  , RegisterPeerMsg, RegisterPeerResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomPeerLeftMsg
} from "@rooms/rooms-models";
import { Transport } from "mediasoup-client/lib/Transport";
import { WebSocketManager } from "@rooms/websocket-client";

export class Peer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";
  hasVideo: boolean = true;
  hasAudio: boolean = true;
  stream: MediaStream = null;
  consumers: mediasoupClient.types.Consumer[] = [];
  producers: mediasoupClient.types.Producer[] = [];

}

export class RoomsClient {

  ws: WebSocketManager;

  localRoomId: string = "";
  localPeer: Peer = new Peer();
  isConnected = false;
  isRoomConnected = false;

  peers: Peer[] = [];
  audioEnabled = true;
  videoEnabled = true;

  device: mediasoupClient.types.Device;
  sendTransportRef: mediasoupClient.types.Transport;
  recvTransportRef: mediasoupClient.types.Transport;
  config = {
    wsURI: "wss://localhost:3000",
  }

  onTransportsReady: (transport: mediasoupClient.types.Transport) => void;
  onRoomNewPeerEvent: (peer: Peer) => void;
  onPeerNewTrack: (peer: Peer, track: MediaStreamTrack) => void;

  async init(uri: string) {

    if (uri) {
      this.config.wsURI = uri;
    }

    this.initMediaSoupDevice();

  };

  writeLog = async (...params) => {
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
        case payloadTypeServer.registerPeerResult:
          this.onRegisterResult(msgIn);
          break;
        case payloadTypeServer.producerTransportCreated:
          this.onProducerTransportCreated(msgIn);
          break;
        case payloadTypeServer.consumerTransportCreated:
          this.onConsumerTransportCreated(msgIn);
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
    this.ws = new WebSocketManager();

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

  /**
 * resolves when the socket is connected
 * @param wsURI 
 * @returns 
 */
  waitForConnect(wsURI: string): Promise<void> {
    this.writeLog(`connectAsync ${wsURI}`);

    return new Promise<void>((resolve, reject) => {

      if (wsURI) {
        this.config.wsURI = wsURI;
      }

      if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
        this.writeLog("socket already created. current state: " + this.ws.state);
        resolve();
        return;
      }


      this.ws = new WebSocketManager();
      this.writeLog("connectAsync " + this.config.wsURI + " state:" + this.ws.state);

      const onOpen = async () => {
        this.isConnected = true;
        this.writeLog("websocket onOpen " + this.config.wsURI);
        resolve();
      };

      const onClose = async () => {
        this.writeLog("websocket onClose");
        this.isConnected = false;
        resolve();
      };

      this.ws.addEventHandler("onopen", onOpen);
      this.ws.addEventHandler("onmessage", this.onSocketEvent);
      this.ws.addEventHandler("onclose", onClose);
      this.ws.addEventHandler("onerror", onClose);

      this.ws.connect(this.config.wsURI, true);

    })
  }

  waitForRegister(trackingId: string, displayName: string): Promise<void> {

    return new Promise<void>((resolve, reject) => {

      this.register(trackingId, displayName);

      let timerid = setTimeout(() => reject("failed to register"), 5000);

      const onmessage = (event: any) => {
        let msgIn = JSON.parse(event.data);
        this.writeLog("-- onmessage", msgIn);
        if (msgIn.type == payloadTypeServer.registerPeerResult) {
          clearTimeout(timerid);
          this.ws.removeEventHandler("onmessage", onmessage);
          resolve();
        }
      }

      this.ws.addEventHandler("onmessage", onmessage);

      this.ws.connect(this.config.wsURI, true);

    });
  }

  waitForRoomJoin(roomid: string, roomToken: string): Promise<void> {

    return new Promise<void>((resolve, reject) => {

      this.roomJoin(roomid, roomToken);

      let timerid = setTimeout(() => reject("failed to join room"), 5000);

      const onmessage = (event: any) => {
        let msgIn = JSON.parse(event.data);
        this.writeLog("-- onmessage", msgIn);
        if (msgIn.type == payloadTypeServer.roomJoinResult) {
          clearTimeout(timerid);
          this.ws.removeEventHandler("onmessage", onmessage);
          resolve();
        }
      }

      this.ws.addEventHandler("onmessage", onmessage);

      this.ws.connect(this.config.wsURI, true);

    });
  }

  waitForTransportConnected(transport: Transport): Promise<void> {
    this.writeLog("-- waitForTransportConnected created")
    return new Promise((resolve, reject) => {
      if (transport.connectionState === 'connected') {
        resolve();
        return;
      }
      const onStateChange = (state: string) => {

        this.writeLog("connectionstatechange transport: " + state);

        if (state === 'connected') {
          resolve();
          transport.off('connectionstatechange', onStateChange);
        } else if (state === 'failed' || state === 'closed') {
          reject(new Error(`Transport failed to connect: ${state}`));
          transport.off('connectionstatechange', onStateChange);
        }
      };

      transport.on('connectionstatechange', onStateChange);
    });
  }

  setLocalstream(stream: MediaStream) {
    this.writeLog("setLocalstream");
    this.localPeer.stream = stream;
  }

  disconnect = () => {
    this.writeLog("disconnect");
    this.ws.disconnect();
  };

  send = async (msg: any) => {
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

  addRemoteTrack = (peerId: string, track: MediaStreamTrack) => {
    this.writeLog("addRemoteTrack()");

    let peer = this.peers.find(p => p.peerId === peerId);
    if (!peer) {
      this.writeLog(`addRemoteTrack() - peer not found, peerId: ${peerId}`);
      return;
    }

    if (this.onPeerNewTrack) {
      this.onPeerNewTrack(peer, track);
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

  register = (trackingId: string, displayName: string) => {
    this.writeLog(`-- register `);

    if (this.localPeer.peerId) {
      this.writeLog(`-- register, already registered. ${this.localPeer.peerId}`);
      return;
    }

    this.localPeer.trackingId = trackingId;
    this.localPeer.displayName = displayName;

    let msg = new RegisterPeerMsg();
    msg.data = {
      authToken: "",  //need authtoken from server
      displayName: this.localPeer.displayName
    }

    this.send(msg);
  }

  onRegisterResult = async (msgIn: RegisterPeerResultMsg) => {

    this.writeLog(`-- onRegisterResult() peerId: ${msgIn.data?.peerId}`);

    if (msgIn.data.error) {
      this.writeLog(`register failed ${msgIn.data.error}`);
      this.localPeer.peerId = "";
      return;
    }

    this.localPeer.peerId = msgIn.data!.peerId;

    if (!this.device.loaded) {
      this.writeLog("loading device with rtpCapabilities");
      await this.device.load({ routerRtpCapabilities: msgIn.data!.rtpCapabilities });
    }

    if (!this.sendTransportRef) {
      this.createProducerTransport();
    }

    if (!this.recvTransportRef) {
      this.createConsumerTransport();
    }

  };

  createProducerTransport = () => {
    this.writeLog("-- createProducerTransport");
    let msg = new CreateProducerTransportMsg();
    this.send(msg);
  }

  createConsumerTransport = () => {
    this.writeLog("-- createConsumerTransport");
    let msg = new CreateConsumerTransportMsg();
    this.send(msg);
  }



  roomJoin = (roomid: string, roomToken: string) => {
    this.writeLog(`roomJoin ${roomid} ${roomToken}`)
    let msg = new RoomJoinMsg();
    msg.data = {
      roomId: roomid,
      roomToken: roomToken
    };
    this.send(msg);
  }

  private onRoomJoinResult = async (msgIn: RoomJoinResultMsg) => {

    this.writeLog("-- onRoomJoinResult()");
    if (msgIn.data.error) {
      this.writeLog(msgIn.data.error);
      return;
    }

    if (msgIn.data!.roomId) {
      this.localRoomId = msgIn.data!.roomId;
      this.isRoomConnected = true
      this.writeLog("joined room " + msgIn.data!.roomId);
    } else {
      this.localRoomId = "";
      this.isRoomConnected = false;
      return;
    }

    if (!this.localPeer.stream) {
      this.writeLog("-- get user media, one does not exist");
      this.localPeer.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    }

    this.localPeer.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    //publish local stream
    await this.produceLocalStream();

    this.writeLog(`-- onRoomJoinResult() peers : ${msgIn.data?.peers.length}`);

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let peer of msgIn.data.peers) {

        let newpeer: Peer = new Peer();

        newpeer.peerId = peer.peerId,
          newpeer.trackingId = peer.trackingId;

        this.addPeer(newpeer);

        this.writeLog(peer.peerId);
        this.writeLog("-- onRoomJoinResult producers :" + peer.producers?.length);
        if (peer.producers) {
          for (let producer of peer.producers) {
            this.writeLog("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
            this.consumeProducer(peer.peerId, producer.producerId);
          }
        }

        if (this.onRoomNewPeerEvent) {
          this.onRoomNewPeerEvent(newpeer);
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
  }

  isInRoom = () => {
    return !!this.isRoomConnected;
  }

  disposeRoom() {

    this.writeLog("disposeRoom()");

    this.isRoomConnected = false

    this.localPeer.consumers.forEach(c => c.close());
    this.localPeer.producers.forEach(c => c.close());
    this.recvTransportRef?.close();
    this.sendTransportRef?.close();

    this.recvTransportRef = null;
    this.sendTransportRef = null;
    this.peers = [];
    this.localRoomId = "";
    this.localPeer = new Peer();
    this.isConnected = false;
    this.isRoomConnected = false;
    this.ws.disconnect();
    this.writeLog("disposeRoom() - complete");

  }

  onConsumerTransportCreated = async (msgIn: ConsumerTransportCreatedMsg) => {
    this.writeLog("-- onConsumerTransportCreated");

    this.recvTransportRef = this.device.createRecvTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data!.iceServers,
      iceCandidates: msgIn.data!.iceCandidates,
      iceParameters: msgIn.data!.iceParameters,
      dtlsParameters: msgIn.data!.dtlsParameters,
      iceTransportPolicy: msgIn.data!.iceTransportPolicy
    });

    this.recvTransportRef.on('connect', ({ dtlsParameters }, callback) => {
      let msg = new ConnectConsumerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      }
      this.send(msg);
      callback();
    });

    if (this.onTransportsReady) {
      this.onTransportsReady(this.recvTransportRef);
    }

  }

  onProducerTransportCreated = async (msgIn: ProducerTransportCreatedMsg) => {
    this.writeLog("-- onProducerTransportCreated");

    //the server has created a transport
    //create a client transport to connect to the server transport
    this.sendTransportRef = this.device.createSendTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data!.iceServers,
      iceCandidates: msgIn.data!.iceCandidates,
      iceParameters: msgIn.data!.iceParameters,
      dtlsParameters: msgIn.data!.dtlsParameters,
      iceTransportPolicy: msgIn.data!.iceTransportPolicy
    });

    this.sendTransportRef.on("connect", ({ dtlsParameters }, callback) => {
      this.writeLog("-- sendTransport connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      };
      this.send(msg);

      callback();

    });

    this.sendTransportRef.on('produce', ({ kind, rtpParameters }, callback) => {

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

    if (this.onTransportsReady) {
      this.onTransportsReady(this.sendTransportRef);
    }

  }

  onRoomNewPeer = (msgIn: RoomNewPeerMsg) => {
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
  }

  onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    this.writeLog("peer left the room, peerid:" + msgIn.data?.peerId);

    this.removePeer(msgIn.data.peerId);
    this.removeRemoteStream(msgIn.data.peerId);

  }

  onRoomTerminate = async (msgIn: RoomPeerLeftMsg) => {
    this.writeLog("onRoomTerminate:" + msgIn.data.roomId);
    this.disposeRoom();
  }

  onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    this.writeLog("onRoomNewProducer: " + msgIn.data?.kind);
    this.consumeProducer(msgIn.data?.peerId!, msgIn.data?.producerId!);
  }

  produceLocalStream = async () => {
    this.writeLog("produceLocalStreams");
    if (!this.localPeer.stream) {
      this.writeLog("not local stream");
    }
    for (const track of this.localPeer.stream.getTracks()) {
      this.writeLog("sendTransport produce ");
      await this.sendTransportRef.produce({ track });
    }
  }

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
  }

  onConsumed = async (msgIn: ConsumedMsg) => {
    this.writeLog("onConsumed() " + msgIn.data?.kind);
    const consumer = await this.recvTransportRef.consume({
      id: msgIn.data!.consumerId,
      producerId: msgIn.data!.producerId,
      kind: msgIn.data!.kind,
      rtpParameters: msgIn.data!.rtpParameters
    });
    this.addRemoteTrack(msgIn.data!.peerId, consumer.track);
  }

  onProduced = async (msgIn: ProducedMsg) => {
    this.writeLog("onProduced " + msgIn.data?.kind);
  }

}
