import { WebSocketManager } from "../../utils/webSocketManager";
import * as mediasoupClient from 'mediasoup-client';
import {
  ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg
  , ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg
  , payloadTypeServer, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg, RegisterMsg, RegisterResultMsg
  , RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomPeerLeftMsg
} from './payload';
import { Peer } from "./peer";

class RoomsService {

  ws : WebSocketManager;

  localRoomId: string = "";
  localPeer: Peer = { peerId: "", displayName: "", hasAudio: false, hasVideo: false, stream: null };
  isConnected = false;
  isRoomConnected = false;

  peers: Peer[] = [];
  audioEnabled = true;
  videoEnabled = true;

  device: mediasoupClient.types.Device;
  sendTransportRef: mediasoupClient.types.Transport;
  recvTransportRef: mediasoupClient.types.Transport;
  wsURI: string = "";

  async init() {

    this.wsURI = "wss://localhost:3000";

    await this.initMediaSoupDevice();
    await this.initWebSocket();


    return () => {
      this.ws.disconnect();
    };

  };

  writeLog = async (log: string) => {
    console.log(log);
  }

  initMediaSoupDevice = async () => {

    if (this.device) return;

    try {
      // In real implementation, this would use the actual mediasoup-client
      this.device = new mediasoupClient.Device();
      this.writeLog("MediaSoup device initialized");
    } catch (error) {
      this.writeLog(`Error initializing MediaSoup: ${error.message}`);
    }
  };

  initWebSocket = async () => {

    // In a real implementation, actually connect to WebSocket
    this.writeLog("initWebSocket");
    this.ws = new WebSocketManager();    

    const onopen = async () => {
      this.isConnected = true;
      this.writeLog("websocket open " + this.wsURI);
      this.register();
    };

    const onmessage = async (msgIn: any) => {

      console.log("-- onmessage", msgIn);

      switch (msgIn.type) {
        case payloadTypeServer.registerResult:
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
      }

    };

    const onclose = async () => {
      this.writeLog("websocket closed");
      this.isConnected = false;
    };

    this.ws.on("onopen", onopen);
    this.ws.on("onmessage", onmessage);
    this.ws.on("onclose", onclose);

    this.ws.initialize(this.wsURI, "", true);

  };

  send = async (msg: any) => {
    this.ws.send(msg);
  };

  toggleAudio = () => {
    this.audioEnabled = !this.audioEnabled;
    this.writeLog(`Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
  };

  toggleVideo = () => {
    this.videoEnabled = !this.videoEnabled;
    this.writeLog(`Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
  };

  addPeer = (newPeer: Peer) => {
    this.peers.push(newPeer);
  };

  removePeer = (peerId: string) => {
    let idx = this.peers.findIndex(p => p.peerId == peerId);
    if (idx > -1) {
      this.peers.splice(idx, 1);
    }
  };

  addRemoteTrack = (peerId: string, track: MediaStreamTrack) => {

    let peer = this.peers.find(p => p.peerId === peerId);
    if (!peer) {
      this.writeLog("peer not found.");
      return;
    }
    if (!peer.stream) {
      peer.stream = new MediaStream();
    }
    peer.stream.addTrack(track);
  };

  removeRemoteStream = (peerId: string) => {

    let peer = this.peers.find(p => p.peerId === peerId);
    if (!peer) {
      this.writeLog("peer not found.");
      return;
    }

    if (peer.stream) {
      peer.stream.getTracks().forEach((track) => track.stop());
      peer.stream = null;
    }

  };

  register = async () => {
    this.writeLog("-- register");

    let msg = new RegisterMsg();
    msg.authToken = ""; //need authtoken from server
    msg.displayName = this.localPeer.displayName;
    this.ws.send(msg);
  }

  onRegisterResult = async (msgIn: RegisterResultMsg) => {

    this.writeLog("-- onRegisterResult");

    this.localPeer.peerId = msgIn.data!.peerid;

    await this.device.load({ routerRtpCapabilities: msgIn.data!.rtpCapabilities });

    await this.createProducerTransport();
    await this.createConsumerTransport();
  };

  createProducerTransport = async () => {
    console.log("-- createProducerTransport");
    let msg = new CreateProducerTransportMsg();
    this.ws.send(msg);
  }

  createConsumerTransport = async () => {
    console.log("-- createConsumerTransport");
    let msg = new CreateConsumerTransportMsg();
    this.ws.send(msg);
  }

  roomJoin = async (roomid: string) => {
    let msg = new RoomJoinMsg();
    msg.data = {
      roomId: roomid,
      roomToken: ""
    };
    this.ws.send(msg);
  }

  roomLeave = async () => {
    let msg = new RoomLeaveMsg();
    msg.data = {
      roomId: this.localRoomId,
      roomToken: ""
    };

    this.isRoomConnected = false
    this.localPeer.peerId = "";

    this.ws.send(msg);

  }

  isInRoom = () => {
    return !!this.isRoomConnected;
  }

  onConsumerTransportCreated = async (msgIn: ConsumerTransportCreatedMsg) => {
    console.log("-- onConsumerTransportCreated");

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
      this.ws.send(msg);
      callback();
    });

  }

  onProducerTransportCreated = async (msgIn: ProducerTransportCreatedMsg) => {
    console.log("-- onProducerTransportCreated");

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
      console.log("-- sendTransport connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      };
      this.ws.send(msg);

      callback();

    });

    this.sendTransportRef.on('produce', ({ kind, rtpParameters }, callback) => {

      console.log("-- sendTransport produce");

      //fires when we call produce with local tracks
      let msg = new ProduceMsg();
      msg.data = {
        kind: kind,
        rtpParameters: rtpParameters
      }
      this.ws.send(msg);
      //what is the id value???
      callback({ id: 'placeholder' });
    });

  }

  onRoomJoinResult = async (msgIn: RoomJoinResultMsg) => {

    console.log("-- onRoomJoinResult");

    if (msgIn.data!.roomId) {
      this.localRoomId = msgIn.data!.roomId;
      this.isRoomConnected = true
      this.writeLog("joined room " + msgIn.data!.roomId);
    } else {
      this.localRoomId = "";
      this.isRoomConnected = false;
    }

    this.localPeer.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    //publish local stream
    await this.produceLocalStreams();

    console.log("-- onRoomJoinResult peers :" + msgIn.data?.peers.length);

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let peer of msgIn.data.peers) {
        let newpeer: Peer = {
          peerId: peer.peerId,
          displayName: "",
          hasAudio: false,
          hasVideo: false,
          stream: null
        };

        this.addPeer(newpeer);

        console.log(peer.peerId);
        console.log("-- onRoomJoinResult producers :" + peer.producers?.length);
        if (peer.producers) {
          for (let producer of peer.producers) {
            console.log("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
            this.consumeProducer(peer.peerId, producer.producerId);
          }
        }
      }
    }
  }

  onRoomNewPeer = (msgIn: RoomNewPeerMsg) => {
    this.writeLog("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    this.writeLog("new PeeerJoined " + msgIn.data?.peerId);

    let newPeer: Peer = {
      peerId: msgIn.data.peerId,
      displayName: "",
      hasAudio: false,
      hasVideo: false,
      stream: null
    };

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

  onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    this.writeLog("onRoomNewProducer: " + msgIn.data?.kind);
    this.consumeProducer(msgIn.data?.peerId!, msgIn.data?.producerId!);
  }

  produceLocalStreams = async () => {
    this.writeLog("produceLocalStreams");
    if (!this.localPeer.stream) {
      this.writeLog("not local stream");
    }
    for (const track of this.localPeer.stream.getTracks()) {
      console.log("sendTransport produce ");
      await this.sendTransportRef.produce({ track });
    }
  }

  consumeProducer = async (remotePeerId: string, producerId: string) => {
    console.log("consumeProducer :" + remotePeerId, producerId);
    if (remotePeerId === this.localPeer.peerId) {
      console.error("you can't consume yourself.");
    }

    let msg = new ConsumeMsg();
    msg.data = {
      remotePeerId: remotePeerId,
      producerId: producerId,
      rtpCapabilities: this.device.rtpCapabilities
    }
    this.ws.send(msg);
  }

  onConsumed = async (msgIn: ConsumedMsg) => {

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

const roomsService = new RoomsService();

export default roomsService;