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

  transportSend: mediasoupClient.types.Transport;
  transportReceive: mediasoupClient.types.Transport;
  consumers: mediasoupClient.types.Consumer[] = [];
  producers: mediasoupClient.types.Producer[] = [];

  tracks: MediaStream = new MediaStream();
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

  private sfu_onTransportsReadyEvent: (transport: mediasoupClient.types.Transport) => void;

  onRoomJoinedEvent: (roomId: string) => void;
  onRoomPeerJoinedEvent: (roomId: string, peer: Peer) => void;
  onPeerNewTrackEvent: (peer: Peer, track: MediaStreamTrack) => void;
  onRoomPeerLeftEvent: (roomId: string, peer: Peer) => void;
  onRoomClosedEvent: (roomId: string, peers: Peer[]) => void;

  init = async (uri: string) => {
    this.writeLog("init");
    this.config.wsURI = uri;
    this.initMediaSoupDevice();

    this.rtcClient = new WebRTCClient();
    this.rtcClient.onIceCandidate = this.rtc_SendIceCandidate;
    this.rtcClient.onPeerTrack = this.rtc_OnPeerTrack;

    this.writeLog("init complete");

  };

  dispose = () => {

    this.writeLog("disposeRoom()");

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
    this.writeLog("dispose() - complete");

  };

  writeLog = async (...params: any) => {
    console.log("RoomsClient", ...params);
  };

  writeError = async (...params: any) => {
    console.error("RoomsClient", ...params);
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


  /**
  * resolves when the socket is connected
  * @param wsURI 
  * @returns 
  */
  waitForConnect = async (wsURI: string = ""): Promise<IMsg> => {
    this.writeLog(`waitForConnect() ${wsURI}`);
    return new Promise<IMsg>((resolve, reject) => {

      try {

        let timerid = setTimeout(() => reject("failed to connect"), 5000);

        if (wsURI) {
          this.config.wsURI = wsURI;
        }

        this.writeLog("config.wsURI:", this.config.wsURI);

        if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
          this.writeLog("socket already created. current state: " + this.ws.state);
          resolve(new OkMsg("already connecting"));
          return;
        }

        this.ws = new WebSocketClient();
        this.writeLog("waitForConnect() - " + this.config.wsURI + " state:" + this.ws.state);

        const onOpen = async () => {
          this.writeLog("websocket onOpen " + this.config.wsURI);
          resolve(new OkMsg("socket opened."));
          clearTimeout(timerid);
        };

        const onClose = async () => {
          this.writeLog("websocket onClose");
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

  setAuthtoken = (authToken: string) => {
    this.localPeer.authToken = authToken;
  }

  getAuthoken = (serviceToken: string) => {
    this.writeLog(`-- getAuthoken `);
    //the server may reject this request due to server settings
    //in a typical setting, your application will request an authtoken from the rooms server using a service auth token

    let msg = new AuthUserNewTokenMsg();
    msg.data.authToken = serviceToken;
    msg.data.expiresInMin = 60;

    this.send(msg);

  };

  register = (authToken: string, trackingId: string, displayName: string) => {
    this.writeLog(`-- register trackingId: ${trackingId}, displayName: ${displayName}`);

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
      displayName: this.localPeer.displayName,
      trackingId: trackingId
    }

    this.send(msg);

    return true;
  };

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

  toggleAudio = () => {
    this.audioEnabled = !this.audioEnabled;
    this.writeLog(`Microphone ${!this.audioEnabled ? 'enabled' : 'disabled'}`);
  };

  toggleVideo = () => {
    this.videoEnabled = !this.videoEnabled;
    this.writeLog(`Camera ${!this.videoEnabled ? 'enabled' : 'disabled'}`);
  };

  addLocalTracks = async (tracks: MediaStream) => {
    this.writeLog("addLocalTrack() ");
    this.writeLog(`current tracks=${this.localPeer.tracks.getTracks().length}`);

    tracks.getTracks().forEach(t => {
      this.localPeer.tracks.addTrack(t);
    })

    this.writeLog("track added to localPeer.stream");

    tracks.getTracks().forEach(t => {
      t.enabled = t.kind === "audio" ? this.audioEnabled : this.videoEnabled;
    });


    if (this.localPeer.roomType == "sfu") {
      if (this.localPeer.transportSend) {

        for (let track of tracks.getTracks()) {
          try {
            this.writeLog(`produce track ${track.kind}`);
            let producer = this.localPeer.producers.find(p => p.track.id == track.id);
            if (producer) {
              this.writeError("producer found with existing track.");
              return;
            }

            producer = await this.localPeer.transportSend.produce({ track });
            this.localPeer.producers.push(producer);
            this.writeLog("track added: " + track.kind);
          } catch (error) {
            this.writeError(`Failed to produce track: ${error.message}`);
            this.writeError(error);
          }
        }

      } else {
        this.writeLog('No transportSend');
      }
    } else {
      // P2P mode
      for (let peer of this.peers) {
        let pc = peer.rtc_Connection?.pc;
        if (pc) {
          let tracksAdded = false;
          for (let track of tracks.getTracks()) {
            try {
              let sender = pc.getSenders().find(s => s.track.id == track.id);
              if (sender) {
                this.writeError(`peer ${peer.peerId} already sending track.`);
                continue;
              }
              pc.addTrack(track);
              tracksAdded = true;
              this.writeLog(`Added track ${track.kind} to peer ${peer.peerId}`);
            } catch (error) {
              this.writeLog(`Failed to add track ${track.kind} to peer ${peer.peerId}: ${error.message}`);
              continue;
            }
          }
          if (tracksAdded) {
            let offer = await this.rtcClient.createOffer(peer.peerId);
            if (offer) {
              let msg = new RTCOfferMsg();
              msg.data.remotePeerId = peer.peerId;
              msg.data.sdp = offer;
              this.send(msg);
              this.writeLog(`Sent offer for tracks to peer ${peer.peerId}`);
            }
          } else {
            this.writeLog(`no tracks added to peer ${peer.peerId}`);
          }

        } else {
          this.writeLog(`No RTCPeerConnection for peer ${peer.peerId}`);
        }
      }
    }

  };

  removeLocalTracks = async (tracks: MediaStream) => {

    let localTracks = this.localPeer.tracks.getTracks();
    tracks.getTracks().forEach(track => {
      track.stop();
      let existingTrack = localTracks.find(t => t.id === track.id)
      if (existingTrack) {
        this.localPeer.tracks.removeTrack(existingTrack);
      }
    });


    if (this.localPeer.roomType == "sfu") {

      for (let track of tracks.getTracks()) {
        let producer = this.localPeer.producers.find(p => p.track.id === track.id);
        if (producer) {
          producer.close();
          this.localPeer.producers = this.localPeer.producers.filter(p => p != producer);
          this.writeLog(`track removed ${track.kind}`);
        }
      }

    } else {
      // P2P mode
      for (let peer of this.peers) {
        let pc = peer.rtc_Connection?.pc;
        if (pc) {
          try {

            let offerNeeded = false;
            for (let track of tracks.getTracks()) {
              //remove the track from the senders
              const sender = pc.getSenders().find(s => s.track === track);
              if (sender) {
                pc.removeTrack(sender);
                offerNeeded = true;
              }
            }

            if (offerNeeded) {
              // Trigger renegotiation to reflect removed track, even if 0 tracks
              let offer = await this.rtcClient.createOffer(peer.peerId);
              if (offer) {
                let msg = new RTCOfferMsg();
                msg.data.remotePeerId = peer.peerId;
                msg.data.sdp = offer;
                // Include track metadata for clarity
                //msg.data.trackInfo = { id: track.id, kind: track.kind, action: "remove" };
                this.send(msg);
                this.writeLog(`Sent offer for removed tracks to peer ${peer.peerId}`);
              }
            }
          } catch (error) {
            this.writeLog(`Failed to renegotiate for peer ${peer.peerId}: ${error.message}`);
          }
        } else {
          this.writeLog(`No RTCPeerConnection for peer ${peer.peerId}`);
        }
      }
    }

  };

  findTrack = (kind: string) => {
    return this.localPeer.tracks.getTracks().find(t => t.kind === kind);
  }

  replaceTrack = async (existingTrack: MediaStreamTrack, newTrack: MediaStreamTrack) => {
    this.writeLog("replaceTrack");

    if (!existingTrack) {
      this.writeError("existing track is null");
      return;
    }

    if (!newTrack) {
      this.writeError("new track is null");
      return;
    }

    this.localPeer.tracks.removeTrack(existingTrack);
    this.localPeer.tracks.addTrack(newTrack);

    if (this.localPeer.roomType == "sfu") {
      let producer = this.localPeer.producers.find(p => p.track.id === existingTrack.id);
      if (producer) {
        producer.replaceTrack({ track: newTrack })
      } else {
        this.writeError("existing track not found.");
      }

    } else {
      for (let peer of this.peers) {
        let pc = peer.rtc_Connection?.pc;
        if (pc) {
          let sender = pc.getSenders().find(s => s.track.id === existingTrack.id);
          if (sender) {
            sender.replaceTrack(newTrack);
          } else {
            this.writeError(`track not found for peer ${peer.peerId}.`);
          }
        } else {
          this.writeLog(`No RTCPeerConnection for peer ${peer.peerId}`);
        }
      }
    }

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

  private onSocketEvent = async (event: any) => {

    let msgIn = JSON.parse(event.data);
    this.writeLog("-- onmessage", msgIn.type, msgIn);
    //parse the msgIn
    if (!msgIn.type) {
      this.writeLog("invalid message type");
      return;
    }

    if (!msgIn.data) {
      this.writeLog("invalid message data");
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

  private send = (msg: any) => {
    this.writeLog("send", msg.type, msg);
    this.ws.send(JSON.stringify(msg));
  };

  private addPeer = (peer: Peer) => {
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

  private removePeer = (peer: Peer) => {
    this.writeLog(`removePeer() ${peer.peerId}`);

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
  private sfu_publishLocalStream = async () => {
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

    console.log("tracks=" + this.localPeer.tracks.getTracks().length);
    this.localPeer.tracks.getTracks().forEach(track => this.localPeer.transportSend.produce({ track: track }));

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

  private sfu_createProducerTransport = (): boolean => {
    this.writeLog("-- createProducerTransport");

    if (this.localPeer.roomType != "sfu") {
      this.writeLog("invalid roomType.");
      return false;
    }

    let msg = new CreateProducerTransportMsg();
    this.send(msg);
    return true;
  };

  private sfu_createConsumerTransport = (): boolean => {
    this.writeLog("-- createConsumerTransport");

    if (this.localPeer.roomType != "sfu") {
      this.writeLog("invalid roomType.");
      return false;
    }

    let msg = new CreateConsumerTransportMsg();
    this.send(msg);
    return true;
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
      if (!msgIn.data.rtpCapabilities) {
        this.writeLog("ERROR: not  rtpCapabilities received.");
        return;
      }

      if (!this.device.loaded) {
        this.writeLog("loading device with rtpCapabilities");
        await this.device.load({ routerRtpCapabilities: msgIn.data.rtpCapabilities });
        this.writeLog("device loaded ", this.device.loaded);
      }

      let transports = await this.sfu_waitForRoomTransports();

      if (transports.data.error) {
        console.log("unable to create transports");
        return;
      }

      console.log("transports created.");

      await this.sfu_publishLocalStream();

    } else {
      this.rtcClient.addTracks(this.localPeer.tracks.getTracks());
    }

    if (this.onRoomJoinedEvent) {
      this.onRoomJoinedEvent(this.localPeer.roomId);
    }

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let p of msgIn.data.peers) {

        let newpeer: Peer = this.createPeer(p.peerId, p.peerTrackingId, p.displayName);
        if (this.localPeer.roomType == RoomType.sfu) {
          newpeer.producers.push(...p.producers.map(p => ({ id: p.producerId, kind: p.kind })));
        } else {
          newpeer.rtc_Connection = this.rtcClient.getOrCreatePeerConnection(newpeer.peerId);
        }

        this.writeLog(p.peerId);
        this.writeLog("-- onRoomJoinResult producers :" + p.producers?.length);

      }
    }


    for (let peer of this.peers) {

      this.sfu_consumePeerProducers(peer);

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
    this.writeLog("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    this.writeLog(`new PeeerJoined ${msgIn.data?.peerId} `);

    let newpeer: Peer = this.createPeer(msgIn.data.peerId, msgIn.data.peerTrackingId, msgIn.data.displayName);

    if (this.localPeer.roomType == "sfu") {

      await this.sfu_publishLocalStream();

      if (msgIn.data?.producers) {
        for (let producer of msgIn.data.producers) {
          this.sfu_consumeProducer(msgIn.data.peerId, producer.producerId);
        }
      }
    } else {

      newpeer.rtc_Connection = this.rtcClient.getOrCreatePeerConnection(newpeer.peerId, { iceServers: this.iceServers });
      this.rtcClient.publishTracks(newpeer.peerId);

      let offer = await this.rtcClient.createOffer(newpeer.peerId);
      if (offer) {
        let msg = new RTCOfferMsg();
        msg.data.remotePeerId = newpeer.peerId;
        msg.data.sdp = offer;
        this.send(msg);
      }

    }

    if (this.onRoomPeerJoinedEvent) {
      this.onRoomPeerJoinedEvent(msgIn.data.roomId, newpeer);
    }

  }

  private onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    this.writeLog("peer left the room, peerid:" + msgIn.data.peerId);

    let peer = this.peers.find(p => p.peerId === msgIn.data.peerId);
    if (!peer) {
      this.writeLog(`peer not found ${msgIn.data.peerId}`);
      return;
    }

    //stop all tracks
    if (peer.stream) {
      peer.stream.getTracks().forEach((track) => track.stop());
      peer.stream = null;
    }

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

    for (let t of this.localPeer.tracks.getTracks()) {
      t.stop();
    }
    this.localPeer.tracks = new MediaStream();
    this.localPeer.roomId = "";
    this.localPeer.roomType = RoomType.p2p;
    this.peers = [];

  }

  /**
   * when you join a room transports need be created and published to a room
   */
  private sfu_waitForRoomTransports = async (): Promise<IMsg> => {

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

        this.sfu_onTransportsReadyEvent = (transport: Transport) => {

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

  private sfu_waitForTransportConnected = async (transport: mediasoupClient.types.Transport): Promise<IMsg> => {
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

    if (this.sfu_onTransportsReadyEvent) {
      this.sfu_onTransportsReadyEvent(this.localPeer.transportReceive);
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

    if (this.sfu_onTransportsReadyEvent) {
      this.sfu_onTransportsReadyEvent(this.localPeer.transportSend);
    }

  }

  private sfu_onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    this.writeLog("onRoomNewProducer: " + msgIn.data.kind);
    this.sfu_consumeProducer(msgIn.data.peerId!, msgIn.data.producerId!);
  }

  private sfu_consumeProducer = async (remotePeerId: string, producerId: string) => {
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
      this.rtcClient.publishTracks(peer.peerId);
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
    this.rtcClient.publishTracks(peer.peerId);
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
