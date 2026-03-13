import * as mediasoupClient from 'mediasoup-client';
import {
  AuthUserNewTokenResultMsg,
  ConnectConsumerTransportMsg, ConnectProducerTransportMsg,
  CreateConsumerTransportMsg, CreateProducerTransportMsg,
  ErrorMsg, IMsg, OkMsg, payloadTypeClient, payloadTypeServer, ProducerTransportConnectedMsg, CreateProducerTransportResultMsg,
  RegisterPeerMsg, RegisterPeerResultMsg, RoomClosedMsg, RoomConfig, RoomConsumeProducerMsg, RoomConsumeProducerResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg,
  RoomNewMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomPeerLeftMsg,
  PeerMuteTracksMsg,
  PeerTracksInfoMsg,
  RoomProduceStreamMsg,
  RoomProduceStreamResultMsg,
  PeerTracksInfo,
  RoomCloseProducerMsg,
  RoomPingMsg,
  RoomPongMsg,
  CreateConsumerTransportResultMsg,
} from "@rooms/rooms-models";
import { MediaKind, Transport } from 'mediasoup-client/types';
import { IPeer, Peer } from './models/peers.js';
import { Signaling } from "./signaling.js";
import { RoomStateManager } from "./roomStateManager.js";

/**
 * Represents the local user's identity and state within the signaling system.
 * This class stores details like peerId, authentication tokens, and track information.
 * @implements {IPeer}
 */
class LocalPeer implements IPeer {
  peerId = "";
  trackingId = "";
  displayName: string = "";
  roomToken: string = "";
  tracksInfo: PeerTracksInfo = { isAudioEnabled: false, isVideoEnabled: false };
  authToken: string = "";
  username: string = "";
}

/**
 * The main client for interacting with the mediasoup-based room server.
 * This class encapsulates the signaling logic over WebSocket, manages the mediasoup
 * device, handles media transports (producer and consumer), and exposes an event-driven
 * API for room lifecycle events (joining, leaving, new peers, etc.).
 */
export class RoomsClient {

  /** The underlying WebSocket client for signaling. */
  private signaling: Signaling;
  /** Represents the local user's state. */
  private localPeer: LocalPeer = new LocalPeer();
  /** Manages the state of the room the local user is in, including peers, transports, and tracks. */
  private roomState: RoomStateManager = new RoomStateManager();
  /** The mediasoup-client Device instance, which is the entry point for creating transports. */
  private device: mediasoupClient.types.Device;
  /** Default STUN servers to be used for ICE. */
  private iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  /** A list of generic message listeners for observing all incoming WebSocket messages. */
  private messageListener: Array<((msg: IMsg) => void)> = [];

  /** Configuration for the WebSocket connection. */
  config = {
    socket_ws_uri: "wss://localhost:3000",
    socket_auto_reconnect: true,
    socket_enable_logs: false
  }

  /**
   * Gets the unique ID assigned to the local peer by the server after registration.
   * @returns {string} The local peer's ID.
   */
  public getPeerId(): string {
    return this.localPeer.peerId;
  }

  /**
   * Initializes a new instance of the RoomsClient.
   * @param options - Configuration options for the client.
   * @param options.socket_ws_uri - The WebSocket URI of the signaling server.
   * @param options.socket_auto_reconnect - Whether the WebSocket should automatically reconnect.
   * @param options.socket_enable_logs - Whether to enable detailed logging from the WebSocket client.
   */
  constructor(options: { socket_ws_uri: string, socket_auto_reconnect: boolean, socket_enable_logs: boolean }) {
    console.log(`*** new RoomsClient`);

    this.config.socket_auto_reconnect = options.socket_auto_reconnect;
    this.config.socket_enable_logs = options.socket_enable_logs;
    this.config.socket_ws_uri = options.socket_ws_uri;

    this.signaling = new Signaling(options);
    this.signaling.addOnMessageListener(this.onSocketEvent);
    this.signaling.addOnCloseListener(this.socketOnClose);
    this.signaling.addOnErrorListener(this.socketOnClose);
  }

  /** @internal A callback used internally to signal when both send and receive transports are ready. */
  private onTransportsReadyEvent: (transport: mediasoupClient.types.Transport) => void;

  /** Event fired if joining a room fails. */
  eventOnRoomJoinFailed: (roomId: string) => Promise<void> = async () => { };
  /** Event fired successfully after joining a room. */
  eventOnRoomJoined: (roomId: string) => Promise<void> = async () => { };
  /** Event fired after both send and receive mediasoup transports have been created. */
  eventRoomTransportsCreated: () => void = () => { };
  /** Event fired when a new peer joins the room. */
  eventOnRoomPeerJoined: (roomId: string, peer: IPeer) => Promise<void> = async () => { };
  /** Event fired when a new media track from a remote peer is available for consumption. */
  eventOnPeerNewTrack: (peer: IPeer, track: MediaStreamTrack) => Promise<void> = async () => { };
  /** Event fired when a peer leaves the room. */
  eventOnRoomPeerLeft: (roomId: string, peer: IPeer) => Promise<void> = async () => { };
  /** Event fired when the server closes the room. */
  eventOnRoomClosed: (roomId: string) => Promise<void> = async () => { };
  /** Event fired when a peer's track information (e.g., enabled/disabled state) is updated. */
  eventOnPeerTrackInfoUpdated: (peer: IPeer) => Promise<void> = async () => { };
  /** Event fired when the underlying WebSocket connection is closed. */
  eventOnRoomSocketClosed: () => Promise<void> = async () => { };
  /** Event fired when a ping is received from the server, used for keep-alive. */
  eventOnRoomPing: (roomId: string) => Promise<void> = async () => { };

  /**
   * Initializes the RoomsClient, primarily by setting up the mediasoup-client Device.
   * This must be called before attempting to join a room.
   * @param options - Initialization options.
   * @param options.rtp_capabilities - Optional. If provided, the device is loaded immediately with these capabilities.
   * This is useful if the capabilities are fetched out-of-band.
   */
  inititalize = async (options: { rtp_capabilities?: any }) => {
    console.log("inititalize");

    this.config.socket_ws_uri = this.config.socket_ws_uri;
    this.config.socket_auto_reconnect = this.config.socket_auto_reconnect;
    await this.initMediaSoupDevice(options.rtp_capabilities);
    console.log("init complete");

  };

  /**
   * Cleans up all resources, disconnects the WebSocket, and resets all event handlers.
   * This should be called when the client is no longer needed.
   */
  dispose = () => {
    console.log("disposeRoom()");

    this.disconnect();
    this.eventOnRoomJoinFailed = async () => { };
    this.eventOnRoomJoined = async () => { };
    this.eventOnRoomPeerJoined = async () => { };
    this.eventOnPeerNewTrack = async () => { };
    this.eventOnRoomPeerLeft = async () => { };
    this.eventOnRoomClosed = async () => { };
    this.eventOnPeerTrackInfoUpdated = async () => { };
    this.eventOnRoomSocketClosed = async () => { };
    console.log("dispose() - complete");
  };

  /**
   * Removes a previously added generic message listener.
   * @param cbFunc - The callback function to remove.
   */
  removeMessageListener = (cbFunc: any) => {
    if (!cbFunc) {
      return;
    }
    this.messageListener = this.messageListener.filter(cb => cb != cbFunc);
  }

  /**
   * Establishes a WebSocket connection to the signaling server.
   * @param wsURI - Optional. The WebSocket URI to connect to. If not provided, the one from the config is used.
   * @returns A promise that resolves when the connection attempt is initiated.
   */
  connect = async (wsURI: string = "") => {
    return this.signaling.connect(wsURI);
  };

  /**
   * Disconnects the WebSocket and disposes of the local room state.
   */
  disconnect = () => {
    console.log("disconnect");

    this.signaling.disconnect();
    this.roomState.close();
  };


  /**
   * @internal
   * Handles the 'onopen' event from the WebSocket client.
   */
  private socketOnOpen = async () => {
    console.log("websocket open " + this.config.socket_ws_uri);
  };

  private socketOnClose = async () => {
    /** @internal Handles the 'onclose' event from the WebSocket client, cleaning up the room state. */
    console.error("socketOnClose closed");
    let roomId = this.roomState.roomId;
    if (roomId) {
      this.roomClose();
      await this.eventOnRoomClosed(roomId);
    }

    await this.eventOnRoomSocketClosed();
  };

  /**
   * Connects to the WebSocket server and waits for the connection to be established.
   * @param socketURI - The WebSocket URI to connect to.
   * @param timeoutSecs - The timeout in seconds to wait for the connection.
   * @returns A promise that resolves with an `OkMsg` on success or rejects on timeout/error.
   */
  waitForConnect = async (socketURI: string = "", timeoutSecs: number = 30): Promise<IMsg> => {
    console.log(`waitForConnect() ${socketURI}`);

    if (!socketURI) {
      socketURI = this.config.socket_ws_uri;
    }

    if (!socketURI) {
      console.error(`socketURI is empty.`);
      return;
    }

    if (!this.signaling) {
      console.error(`signaling socket is null.`);
      return;
    }

    return this.signaling.waitForOpen(timeoutSecs);
  };

  /**
   * Sends a registration request to the server and waits for the result.
   * This is a crucial step to authenticate the client and get a unique `peerId`.
   * @param args - The registration arguments.
   * @param args.authToken - The authentication token for the user.
   * @param args.username - The user's username.
   * @param args.trackingId - A client-side generated unique ID for tracking.
   * @param args.displayName - The name to be displayed to other peers.
   * @param args.timeoutSecs - The timeout for the operation.
   * @returns A promise that resolves with the registration result message.
   */
  waitForRegister = async (args: {
    authToken: string,
    username: string,
    trackingId: string,
    displayName: string,
    timeoutSecs: number,
    clientType?: "sdp" | "mediasoup"
  }): Promise<IMsg> => {
    console.log("waitForRegister");

    if (this.localPeer.peerId) {
      console.log("Already registered.");
      return new OkMsg(payloadTypeServer.ok, { peerId: this.localPeer.peerId });
    }

    if (!this.register({ ...args })) {
      throw new Error("Failed to send 'register' request. Check input parameters.");
    }

    const resultMsg = await this.signaling.waitForResponse(payloadTypeServer.registerPeerResult, args.timeoutSecs * 1000);

    if (resultMsg.error) {
      throw new Error(`Registration failed: ${resultMsg.error}`);
    }

    // The onRegisterResult handler will set the peerId, but we can return the message directly.
    return resultMsg;
  };

  /**
   * Requests a new room token from the server and waits for the response.
   * @param expiresInMin - The desired expiration time for the token in minutes.
   * @param timeoutSecs - The timeout for the operation.
   * @returns A promise that resolves with the `RoomNewTokenResultMsg`.
   */
  waitForNewRoomToken = async (expiresInMin: number, timeoutSecs: number = 30): Promise<IMsg> => {
    if (!this.roomNewToken(expiresInMin)) {
      // The `send` method in WebSocketClient returns false if the socket is not connected.
      throw new Error("Failed to send 'roomNewToken' request. WebSocket not connected.");
    }
    return this.signaling.waitForResponse(payloadTypeServer.roomNewTokenResult, timeoutSecs * 1000);
  };

  /**
   * Requests the server to create a new room and waits for the result.
   * @param maxPeers - The maximum number of peers allowed in the room.
   * @param maxRoomDurationMinutes - The maximum duration of the room in minutes.
   * @param timeoutSecs - The timeout for the operation.
   * @returns A promise that resolves with the `RoomNewResultMsg`.
   */
  waitForNewRoom = async (maxPeers: number, maxRoomDurationMinutes: number, timeoutSecs: number = 30): Promise<IMsg> => {
    if (!this.roomNew(maxPeers, maxRoomDurationMinutes)) {
      // The `send` method in WebSocketClient returns false if the socket is not connected.
      // We can reject immediately in that case.
      throw new Error("Failed to send 'roomNew' request.");
    }
    return this.signaling.waitForResponse(payloadTypeServer.roomNewResult, timeoutSecs * 1000);
  };

  /**
   * Sends a request to join an existing room and waits for the result.
   * @param roomid - The ID of the room to join.
   * @param roomToken - The token required to join the room.
   * @param timeoutSecs - The timeout for the operation.
   * @returns A promise that resolves with the `RoomJoinResultMsg`.
   */
  waitForRoomJoin = async (roomid: string, roomToken: string, timeoutSecs: number = 30): Promise<IMsg> => {
    if (!this.roomJoin(roomid, roomToken)) {
      throw new Error("Failed to send 'roomJoin' request.");
    }
    return this.signaling.waitForResponse(payloadTypeServer.roomJoinResult, timeoutSecs * 1000);
  }

  /**
   * Sets the authentication token for the local peer.
   * @param authToken - The authentication token.
   */
  setAuthtoken = (authToken: string) => {
    this.localPeer.authToken = authToken;
  }

  /**
   * Sends a registration message to the server to identify the client.
   * @param args - Registration details.
   * @param args.authToken - The authentication token.
   * @param args.username - The user's username.
   * @param args.trackingId - A client-side unique ID.
   * @param args.displayName - The user's display name.
   * @returns `true` if the message was sent, `false` if there was a validation error.
   */
  register = (args: { authToken: string, username: string, trackingId: string, displayName: string, clientType?: "sdp" | "mediasoup" }) => {
    console.log(`-- register username: ${args.username}, trackingId: ${args.trackingId}, displayName: ${args.displayName}`);

    if (!args.clientType) {
      args.clientType = "mediasoup";
    }

    if (this.localPeer.peerId) {
      console.error(`-- register, already registered. ${this.localPeer.peerId}`);
      return true;
    }

    if (!args.username) {
      console.error("** username, is required.");
      return false;
    }

    if (!args.authToken) {
      console.error("** register, authtoken is required.");
      return false;
    }

    if (!args.trackingId) {
      console.error("** trackingId, is required.");
      return false;
    }

    this.localPeer.authToken = args.authToken;
    this.localPeer.username = args.username;
    this.localPeer.trackingId = args.trackingId;
    this.localPeer.displayName = args.displayName;

    let msg = new RegisterPeerMsg();
    msg.data = {
      username: args.username,
      authToken: args.authToken,
      displayName: this.localPeer.displayName,
      peerTrackingId: args.trackingId,
      clientType: args.clientType
    }

    this.send(msg);

    return true;
  };

  /**
   * Publishes local media tracks (e.g., from a webcam or microphone) to the room.
   * It creates mediasoup producers for each track. If a producer for a given kind already exists, it replaces the track.
   * @param tracks - An array of `MediaStreamTrack` objects to publish.
   */
  publishTracks = async (tracks: MediaStreamTrack[]) => {
    console.log(`publishTracks: ${tracks.length}`);
    console.log(`trying to publish tracks`, tracks);

    if (!tracks) {
      console.error("ERROR: tracks is required.")
      return;
    }

    if (tracks.length == 0) {
      console.error("ERROR: no tracks.")
      return;
    }

    if (!this.roomState.localRoom.transportSend) {
      console.error('No transportSend');
      return;
    }

    let localTracks = this.roomState.localRoom.getProducerTracks();
    console.log(`local tracks`, tracks);

    for (const track of tracks) {
      try {
        console.log(`publishTracks: track ${track.kind}`);
        let existingTrack = localTracks.find(t => t.kind === track.kind);
        if (existingTrack) {
          console.log(`existingTrack of kind ${track.kind}, track must be replaced or unpublished.`);
          //swap the track          
          let producer = this.roomState.localRoom.getProducers()?.values().find(p => p.kind === track.kind);
          if (producer) {
            await producer.replaceTrack({ track: track });
            console.log(`producer, replacing existing ${track.kind}`);
          }
          return;
        }
        let producer = await this.roomState.localRoom.createProducer(track);
        console.log("publishing new track: " + producer.track.kind);

      } catch (error) {
        console.error(`Failed to produce track: ${error.message}`);
        console.error(error);
      }
    }

    console.log(`publishTracks: local producers:`, this.roomState.localRoom.getProducers());
    console.log(`publishTracks: local tracks:`, this.roomState.localRoom.getProducerTracks());

  };

  /**
   * Stops publishing the specified media tracks. It closes the corresponding mediasoup producers.
   * @param tracks - An array of `MediaStreamTrack` objects to unpublish.
   */
  unPublishTracks = async (tracks: MediaStreamTrack[]) => {
    console.log(`unPublishTracks`);

    if (!tracks.length) {
      console.error(`no tracks to unpublish`);
      return;
    }

    let msg = new RoomCloseProducerMsg();
    msg.data.kinds = [];

    for (const track of tracks) {
      let producer = this.roomState.localRoom.getProducers().get(track.kind as any);
      if (producer) {
        console.log(`producer found, closing ${track.kind}`)
        producer.close();
        msg.data.kinds.push(producer.kind);
      }
    }

    this.send(msg);
  };

  /**
   * Checks if the client is currently broadcasting video.
   * @returns `true` if a live video track is being produced, `false` otherwise.
   */
  isBroadcastingVideo() {
    if (!this.isInRoom()) {
      return false;
    }

    let videoTrack = this.roomState.localRoom.getProducerTracks().find(t => t.kind == "video");
    if (videoTrack && videoTrack.readyState == "live") {
      return true;
    }
    return false;
  }

  /**
   * Checks if the client is currently broadcasting audio.
   * @returns `true` if a live audio track is being produced, `false` otherwise.
   */
  isBroadcastingAudio() {
    if (!this.isInRoom()) {
      return false;
    }

    let audioTrack = this.roomState.localRoom.getProducerTracks().find(t => t.kind == "audio");
    if (audioTrack && audioTrack.readyState == "live") {
      return true;
    }

    return false;
  }

  /**
   * Replaces an existing media track with a new one without needing to create a new producer.
   * @param existingTrack - The track that is currently being published.
   * @param newTrack - The new track to publish in its place.
   */
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

    let producer = this.roomState.localRoom.getProducers().get(existingTrack.kind as any);
    if (producer) {
      producer.replaceTrack({ track: newTrack });

      // this.localRoom.tracks.removeTrack(existingTrack.kind);
      // this.localRoom.tracks.addTrack(newTrack);
    } else {
      console.error(`producer not found, existing track not found. ${existingTrack.kind} ${existingTrack.id}`);
    }

  };

  /**
   * Broadcasts the current state of the local user's tracks (e.g., enabled/disabled) to all peers in the room.
   * @param tracksInfo - The current track state information.
   */
  broadCastTrackInfo = async (tracksInfo: PeerTracksInfo) => {
    console.log(`broadCastTrackInfo`, tracksInfo);

    this.localPeer.tracksInfo = tracksInfo;
    console.log(`tracksInfo updated`, this.localPeer.tracksInfo);

    let msg = new PeerTracksInfoMsg();
    msg.data.peerId = this.localPeer.peerId;
    msg.data.tracksInfo = this.localPeer.tracksInfo;

    this.send(msg);

    console.log(`${this.localPeer.displayName} sent PeerTracksInfoMsg:`, this.localPeer.tracksInfo);
    await this.eventOnPeerTrackInfoUpdated({
      displayName: this.localPeer.displayName,
      peerId: this.localPeer.peerId,
      trackingId: this.localPeer.trackingId,
      tracksInfo: this.localPeer.tracksInfo
    });

  }

  /**
   * Sends a request to the server to mute/unmute the tracks of a specific participant in the room.
   * This is typically used by a moderator.
   * @param peerId - The ID of the peer to mute/unmute.
   * @param audioMuted - Whether to mute the audio.
   * @param videoMuted - Whether to mute the video.
   */
  muteParticipantTrack = async (peerId: string, audioMuted: boolean, videoMuted: boolean) => {
    console.log(`muteParticipantTrack audioMuted: ${audioMuted}, videoMuted:${videoMuted}`);

    let msg = new PeerMuteTracksMsg();
    msg.data.peerId = peerId;
    msg.data.roomId = this.roomState.roomId;
    msg.data.tracksInfo = { isAudioEnabled: !audioMuted, isVideoEnabled: !videoMuted, isVideoMuted: videoMuted, isAudioMuted: audioMuted };
    this.send(msg);
  }

  /**
   * Requests a new, single-use token for creating a room.
   * @param expiresInMin - The desired validity period for the new token.
   * @returns `true` if the request was sent successfully.
   */
  roomNewToken = (expiresInMin: number = 60) => {
    console.log(`roomNewToken`);

    let msg = new RoomNewTokenMsg();
    msg.data = {
      expiresInMin: expiresInMin
    };

    return this.send(msg);
  };

  /**
   * Sends a request to create a new room with specific configuration.
   * @param maxPeers - The maximum number of peers for the new room.
   * @param maxRoomDurationMinutes - The maximum duration of the new room.
   * @returns `true` if the request was sent successfully.
   */
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
      peerId: this.localPeer.peerId,
      roomId: this.roomState.roomId,
      roomToken: this.localPeer.roomToken,
      roomConfig: config
    };

    return this.send(msg);
  };

  /**
   * Sends a request to join an existing room, returns false if there was a send error
   * @param roomid - The ID of the room to join.
   * @param roomToken - The token required for entry.
   */
  roomJoin = (roomid: string, roomToken: string) => {
    console.log(`roomJoin ${roomid} ${roomToken}`);

    let msg = new RoomJoinMsg();
    msg.data = {
      roomId: roomid,
      roomToken: roomToken
    };
    return this.send(msg);
  };

  /**
   * Sends a request to leave the current room and cleans up local room state.
   */
  roomLeave = () => {
    console.log("roomLeave");

    if (!this.roomState.roomId) {
      console.error("not in room");
      return;
    }

    let msg = new RoomLeaveMsg();
    msg.data = {
      roomId: this.roomState.roomId,
    };

    this.roomClose();
    return this.send(msg);
  };

  /**
   * Checks if the client is currently in a room.
   * @returns `true` if the client has a `roomId`, `false` otherwise.
   */
  isInRoom = () => {
    return !!this.roomState.roomId;
  };

  /**
   * @internal
   * Initializes the mediasoup-client Device. If router RTP capabilities are provided, it loads them.
   * @param rtpCapabilities - The RTP capabilities of the mediasoup router.
   */
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

  /**
   * @internal
   * The main message handler for all incoming WebSocket events. It parses the message,
   * identifies its type, and delegates it to the appropriate `on...` handler.
   */
  private onSocketEvent = async (msgIn: any) => {
    console.log("** onmessage", msgIn);

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
        case payloadTypeServer.createProducerTransportResult:
          this.oncreateProducerTransportResult(msgIn);
          break;
        case payloadTypeServer.producerTransportConnected:
          this.onProducerTransportConnected(msgIn);
          break;
        case payloadTypeServer.createConsumerTransportResult:
          this.onCreateConsumerTransportResult(msgIn);
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
        case payloadTypeClient.peerTracksInfo:
          this.onPeerTracksInfo(msgIn);
          break;
        case payloadTypeClient.peerMuteTracks:
          this.onPeerMuteTracks(msgIn);
          break;
        case payloadTypeServer.roomPeerLeft:
          this.onRoomPeerLeft(msgIn);
          break;
        case payloadTypeServer.roomProduceStreamResult:
          this.onProduced(msgIn);
          break;
        case payloadTypeServer.roomConsumeProducerResult:
          this.onConsumed(msgIn);
          break;
        case payloadTypeServer.roomClosed:
          this.onRoomClosed(msgIn);
          break;
        case payloadTypeServer.roomPing:
          this.onRoomPing(msgIn);
          break;
      }

      this.messageListener.forEach(cb => cb(msgIn));
    } catch (err) {
      console.error(err);
    }

  };

  /**
   * @internal
   * A helper method to send a message object to the server via WebSocket.
   * @param msg - The message object to send. It will be JSON-stringified.
   * @returns `true` if the message was sent successfully.
   */
  private send = (msg: any): boolean => {
    console.log("send", msg.type, msg);

    return this.signaling.send(msg);
  };

  /**
   * @internal
   * Adds a remote peer to the local room's state.
   */
  private addPeer = (remotePeer: Peer) => {
    console.log(`addPeer() - ${remotePeer.displayName} ${remotePeer.peerId} ${remotePeer.trackingId}`);

    if (this.roomState.peers.has(remotePeer.peerId)) {
      console.error(`peer already exists, ${remotePeer.peerId}`);
      return false;
    }

    if (remotePeer.peerId === this.localPeer.peerId) {
      console.log(`cannot add yourself as a peerid: ${this.localPeer.peerId}`);
      return false;
    }

    this.roomState.peers.set(remotePeer.peerId, remotePeer);
    return true;
  };

  /**
   * @internal
   * Removes a remote peer from the local room's state and cleans up associated consumers.
   */
  private removePeer = (remotePeer: Peer) => {
    console.log(`removePeer() - ${remotePeer.displayName} ${remotePeer.peerId} ${remotePeer.trackingId}`);

    let consumers = this.roomState.localRoom.getConsumers(remotePeer);
    consumers.values().forEach(c => c.close());
    this.roomState.localRoom.removeConsumer(remotePeer);

    return this.roomState.peers.delete(remotePeer.peerId);
  };

  /**
   * @internal
   * Handles the result of an auth token request.
   */
  private onAuthUserNewTokenResult = async (msgIn: AuthUserNewTokenResultMsg) => {
    console.log("onAuthUserNewTokenResult");

    if (msgIn.data.authToken) {
      this.localPeer.authToken = msgIn.data.authToken;
    } else {
      console.log(`Error getting authtoken ${msgIn.error}`);
    }

  };

  /**
   * @internal
   * Handles the result of a peer registration request, setting the local `peerId`.
   */
  private onRegisterResult = async (msgIn: RegisterPeerResultMsg) => {
    console.log(`** onRegisterResult - peerId: ${msgIn.data?.peerId}`);

    if (msgIn.error) {
      console.log(`register failed ${msgIn.error}`);
      this.localPeer.peerId = "";
      return;
    }

    this.localPeer.peerId = msgIn.data!.peerId;

  };

  /**
   * @internal
   * Sends a request to the server to create a producer transport.
   */
  private createProducerTransport = (): boolean => {
    console.log("** createProducerTransport");

    let msg = new CreateProducerTransportMsg();
    msg.data.roomId = this.roomState.roomId;
    this.send(msg);

    return true;
  };

  /**
   * @internal
   * Sends a request to the server to create a consumer transport.
   */
  private createConsumerTransport = (): boolean => {
    console.log("** createConsumerTransport");

    let msg = new CreateConsumerTransportMsg();
    msg.data.roomId = this.roomState.roomId;
    this.send(msg);

    return true;
  };

  /**
   * @internal
   * Handles the result of a `roomNewToken` request, storing the new room ID and token.
   */
  private onRoomNewTokenResult = async (msgIn: RoomNewTokenResultMsg) => {
    console.log("** onRoomNewTokenResult()");

    if (msgIn.error) {
      console.error(msgIn.error);
      return;
    }

    this.roomState.roomId = msgIn.data.roomId;
    console.log("roomId set", msgIn.data.roomId)
    this.localPeer.roomToken = msgIn.data.roomToken;
    console.log("room token set " + this.localPeer.roomToken, this.roomState.roomId);

  };

  /**
   * @internal
   * Handles the result of a `roomNew` request, loading the mediasoup device with the router's RTP capabilities.
   */
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

  /**
   * @internal
   * Handles the result of a `roomJoin` request. This is a critical method that sets up the room,
   * processes the list of existing peers, creates the necessary transports, and starts consuming media from other peers.
   */
  private onRoomJoinResult = async (msgIn: RoomJoinResultMsg) => {
    console.log("** onRoomJoinResult()", msgIn.data);

    if (msgIn.error) {
      console.error(msgIn.error);
      await this.eventOnRoomJoinFailed(this.roomState.roomId);
      return;
    }

    //race condition can occur when onRoomNewProducer is fired before onRoomJoinResult
    //we may need to store the producer info or fetch the produce info for the peer if we don't have one
    this.roomState.roomId = msgIn.data.roomId;
    await this.eventOnRoomJoined(this.roomState.roomId);

    if (msgIn.data && msgIn.data.peers) {
      for (const peerInfo of msgIn.data.peers) {
        let newpeer: Peer = this.createPeer(peerInfo.peerId, peerInfo.peerTrackingId, peerInfo.displayName, peerInfo.trackInfo);
        await this.eventOnRoomPeerJoined(this.roomState.roomId, newpeer);
        let producerInfo = peerInfo.producers.map(p => ({ peer: newpeer, producerId: p.producerId, kind: p.kind }));
        this.roomState.localRoom.producersToConsume.set(newpeer, producerInfo);
        console.log("** onRoomJoinResult producers :" + peerInfo.producers?.length);
      }
    }

    console.log("roomId set, joined room " + msgIn.data!.roomId);
    console.log(`-- onRoomJoinResult() peers : ${msgIn.data?.peers.length}`);

    let transports = await this.waitForRoomTransports();
    if (transports.error) {
      console.log("unable to create transports");
      return;
    }
    console.log("transports created.");

    for (const peer of this.roomState.peers.values()) {
      await this.consumePeerProducers(peer);
      console.log(`fire eventOnRoomPeerJoined onRoomJoinResult`);
    }

    await this.eventRoomTransportsCreated();

  }

  /**
   * @internal
   * A factory method to create and add a `Peer` object to the local state.
   */
  private createPeer(peerId: string, trackingId: string, displayName: string, tracksInfo: PeerTracksInfo) {
    console.log(`createPeer() - ${displayName}, peerId:${peerId}, trackingId:${trackingId},tracksInfo:`, tracksInfo);

    let newpeer: Peer = new Peer();
    newpeer.peerId = peerId;
    newpeer.trackingId = trackingId;
    newpeer.displayName = displayName;
    newpeer.tracksInfo = tracksInfo

    this.addPeer(newpeer);

    return newpeer;
  }

  /**
   * @internal
   * Handles the `roomNewPeer` message from the server, which indicates a new user has joined the room.
   */
  private onRoomNewPeer = async (msgIn: RoomNewPeerMsg) => {
    console.log("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    console.log(`new PeeerJoined ${msgIn.data?.peerId} `);

    let newpeer: Peer = this.createPeer(msgIn.data.peerId, msgIn.data.peerTrackingId, msgIn.data.displayName, msgIn.data.trackInfo);
    newpeer.tracksInfo = msgIn.data.trackInfo;
    if (msgIn.data?.producers) {
      for (const producerInfo of msgIn.data.producers) {
        await this.consumeProducer(msgIn.data.peerId, producerInfo.producerId, producerInfo.kind);
      }
    }
    console.log(`fire eventOnRoomPeerJoined onRoomNewPeer`);
    await this.eventOnRoomPeerJoined(msgIn.data.roomId, newpeer);
  }

  /**
   * @internal
   * Handles the `roomPeerLeft` message, cleaning up the state associated with the departed peer.
   */
  private onRoomPeerLeft = async (msgIn: RoomPeerLeftMsg) => {
    console.log("peer left the room, peerid:" + msgIn.data.peerId);

    if (msgIn.data.peerId === this.localPeer.peerId) {
      console.log("local peer removed from room");
      this.roomClose();
      await this.eventOnRoomClosed(msgIn.data.roomId);

      return;
    }

    let peer = this.roomState.peers.get(msgIn.data.peerId);
    if (!peer) {
      console.error(`peer not found ${msgIn.data.peerId}, current peers:`, this.roomState.peers);
      return;
    }

    this.roomState.removePeer(peer.peerId);
    let roomid = msgIn.data.roomId;
    await this.eventOnRoomPeerLeft(roomid, peer);
  }

  /**
   * @internal
   * Handles the `peerTracksInfo` message, updating the enabled/disabled state of a remote peer's tracks.
   */
  private onPeerTracksInfo(msgIn: PeerTracksInfoMsg) {
    console.log("onPeerTracksInfo");

    if (!this.roomState.roomId) {
      console.error("not in a room.");
      return;
    }

    let peer = this.roomState.peers.get(msgIn.data.peerId);
    if (!peer) {
      console.error(`peer not found ${msgIn.data.peerId}`);
      return;
    }

    peer.tracksInfo = msgIn.data.tracksInfo;
    console.log(`updated tracksInfo for ${peer.displayName}:`, peer.tracksInfo);

    let tracks = this.roomState.localRoom.getConsumerTracks(peer);

    let audioTrack = tracks.find(t => t.kind == "audio");
    if (audioTrack) {
      audioTrack.enabled = peer.tracksInfo.isAudioEnabled;
      console.log(`track updated, audio enabled:`, audioTrack.enabled);
    }

    let videoTrack = tracks.find(t => t.kind == "video");
    if (videoTrack) {
      videoTrack.enabled = peer.tracksInfo.isVideoEnabled;
      console.log(`track updated, video enabled:`, videoTrack.enabled);
    }

    this.eventOnPeerTrackInfoUpdated(peer);
  }

  /**
   * @internal
   * Handles the `peerMuteTracks` message, which is a command from a moderator to mute the local user's tracks.
   */
  private onPeerMuteTracks(msgIn: PeerMuteTracksMsg) {
    console.log("PeerMuteTracksMsg, someone muted me!");

    //someone muted me!
    if (!this.roomState.roomId) {
      console.error("not in a room.");
      return;
    }

    if (this.localPeer.peerId != msgIn.data.peerId) {
      console.error("invalid peer");
      return;
    }

    if (this.roomState.roomId != msgIn.data.roomId) {
      console.error("not the same room.", msgIn.data.roomId);
      return;
    }

    this.localPeer.tracksInfo = msgIn.data.tracksInfo;
    console.log(`updated localPeer tracksInfo:`, msgIn.data.tracksInfo);

    //mute the producer track
    let audioTrack = this.roomState.localRoom.getProducerTracks().find(t => t.kind == "audio");
    if (audioTrack) {
      audioTrack.enabled = this.localPeer.tracksInfo.isAudioEnabled;
    }

    let videoTrack = this.roomState.localRoom.getProducerTracks().find(t => t.kind == "video");
    if (videoTrack) {
      videoTrack.enabled = this.localPeer.tracksInfo.isVideoEnabled;
    }

    this.eventOnPeerTrackInfoUpdated({
      displayName: this.localPeer.displayName,
      peerId: this.localPeer.peerId,
      trackingId: this.localPeer.trackingId,
      tracksInfo: this.localPeer.tracksInfo
    });

  }

  /**
   * @internal
   * Handles the `roomClosed` message from the server.
   */
  private onRoomClosed = async (msgIn: RoomClosedMsg) => {
    console.log("onRoomClosed:" + msgIn.data.roomId);
    this.roomClose();
    await this.eventOnRoomClosed(msgIn.data.roomId);
  }

  /**
   * @internal
   * Cleans up the local state associated with being in a room.
   */
  private roomClose() {
    console.log("** roomClose");

    if (!this.isInRoom()) {
      console.error("not in a room.", this.roomState.localRoom)
      return;
    }
    this.roomState.close();
    console.log("** room closed");
  }

  /**
   * @internal
   * Waits for both the send and receive transports to be created after joining a room.
   * It initiates the creation and uses a promise to wait for both to complete.
   */
  private waitForRoomTransports = async (): Promise<IMsg> => {
    console.log("** waitForRoomTransports");

    if (!this.roomState.roomId) {
      console.error("room is required for creating transports");
      return new ErrorMsg(payloadTypeServer.error, "cannot create transports before joining a room.");
    }

    const createTransportsPromise = new Promise<IMsg>((resolve) => {
      let transportsReady = { send: false, recv: false };
      this.onTransportsReadyEvent = (transport: Transport) => {
        if (transport.direction === 'send') transportsReady.send = true;
        if (transport.direction === 'recv') transportsReady.recv = true;

        if (transportsReady.send && transportsReady.recv) {
          resolve(new OkMsg(payloadTypeServer.ok, "transports created"));
        }
      };
    });

    // Trigger the creation
    this.createProducerTransport();
    this.createConsumerTransport();

    // Race against a timeout
    const timeoutPromise = new Promise<IMsg>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out waiting for transports to be created.")), 5000)
    );

    return Promise.race([createTransportsPromise, timeoutPromise]);
  };

  /**
   * @internal
   * Waits for a given mediasoup transport to reach the 'connected' state.
   * @param transport - The transport to monitor.
   * @param timeoutMs - The timeout in milliseconds.
   */
  private waitForTransportConnected = async (transport: mediasoupClient.types.Transport, timeoutMs: number = 5000): Promise<IMsg> => {
    console.log("** waitForTransportConnected created " + transport.direction)

    if (transport.connectionState === 'connected') {
      return new OkMsg(payloadTypeServer.ok, "already connected");
    }

    return new Promise<IMsg>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Transport connection timed out for ${transport.direction}`));
      }, timeoutMs);

      const onStateChange = (state: string) => {
        console.log(`transport connectionstatechange: ${state}`);
        if (state === 'connected') {
          cleanup();
          resolve(new OkMsg(payloadTypeServer.ok, "connected"));
        } else if (state === 'failed' || state === 'closed') {
          cleanup();
          reject(new Error(`Transport connection failed with state: ${state}`));
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        transport.off('connectionstatechange', onStateChange);
      };

      transport.on('connectionstatechange', onStateChange);
    });
  };

  /**
   * @internal
   * Iterates through the known producers of a given peer and initiates consumption for each.
   * @param peer - The peer whose producers should be consumed.
   */
  async consumePeerProducers(peer: Peer) {
    console.log(`consumePeerProducers() ${peer.peerId} ${peer.displayName}`);

    if (!this.roomState.roomId) {
      console.error("cannot connect to a peer. not in a room.");
      return;
    }

    if (!this.roomState.localRoom.transportReceive || !this.roomState.localRoom.transportSend) {
      console.error("transports have not been created.");
      return;
    }

    let producersToConsume = this.roomState.localRoom.producersToConsume.get(peer);
    if (producersToConsume) {
      for (const producerInfo of producersToConsume.values()) {
        await this.consumeProducer(peer.peerId, producerInfo.producerId, producerInfo.kind);
      }
    }
  }

  /**
   * @internal
   * Handles the server's response for creating a consumer transport. It then creates the
   * corresponding `RecvTransport` on the client side using the provided parameters.
   */
  private onCreateConsumerTransportResult = async (msgIn: CreateConsumerTransportResultMsg) => {
    console.log("** onCreateConsumerTransportResult", msgIn);

    //the server has created a consumer transport for the peer 
    //roomid should match the local roomid
    if (msgIn.data.roomId != this.roomState.roomId) {
      console.error(`onConsumerTransportCreated: invalid message for roomid`);
      return;
    }

    this.roomState.localRoom.transportReceive = this.device.createRecvTransport({
      id: msgIn.data.transportId,
      iceServers: msgIn.data.iceServers ?? this.iceServers,
      iceCandidates: msgIn.data.iceCandidates,
      iceParameters: msgIn.data.iceParameters,
      dtlsParameters: msgIn.data.dtlsParameters,
      iceTransportPolicy: msgIn.data.iceTransportPolicy ?? "all"
      //iceTransportPolicy: "relay"
    });

    this.roomState.localRoom.transportReceive.on('connect', ({ dtlsParameters }, callback) => {
      let msg = new ConnectConsumerTransportMsg();
      msg.data = {
        transportId: msgIn.data.transportId,
        roomId: this.roomState.roomId,
        dtlsParameters: dtlsParameters
      }
      this.send(msg);
      callback();
    });

    this.roomState.localRoom.transportReceive.on("connectionstatechange", (args) => {
      console.log(`transportReceive connectionstatechange`, args);
    });

    this.roomState.localRoom.transportReceive.on("icecandidateerror", (args) => {
      console.log(`transportReceive icecandidateerror`, args);
    });

    this.roomState.localRoom.transportReceive.on("icegatheringstatechange", (args) => {
      console.log(`transportReceive icegatheringstatechange`, args);
    });

    this.roomState.localRoom.transportReceive.on("produce", (args) => {
      console.log(`transportReceive produce`, args);
    });

    this.roomState.localRoom.transportReceive.on("producedata", (args) => {
      console.log(`transportReceive producedata`, args);
    });


    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.roomState.localRoom.transportReceive);
    }
  }

  /**
   * @internal
   * Handles the `consumerTransportConnected` message. Currently a no-op.
   */
  private onConsumerTransportConnected(msgIn: ProducerTransportConnectedMsg) {
    console.log("** onConsumerTransportConnected");
  }

  /**
   * @internal
   * Handles the server's response for creating a producer transport. It then creates the
   * corresponding `SendTransport` on the client side and sets up its event listeners ('connect', 'produce').
   */
  private oncreateProducerTransportResult = async (msgIn: CreateProducerTransportResultMsg) => {
    console.log("** oncreateProducerTransportResult:", msgIn);

    //the server has created a producer transport for the peer
    //roomid should match the local roomid
    if (msgIn.data.roomId != this.roomState.roomId) {
      console.error(`oncreateProducerTransportResult: invalid message for roomid`);
      return;
    }

    //create a client transport to connect to the server transport
    this.roomState.localRoom.transportSend = this.device.createSendTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data.iceServers ?? this.iceServers,
      iceCandidates: msgIn.data.iceCandidates,
      iceParameters: msgIn.data.iceParameters,
      dtlsParameters: msgIn.data.dtlsParameters,
      iceTransportPolicy: msgIn.data.iceTransportPolicy ?? "all"
      //iceTransportPolicy: "relay"
    });

    this.roomState.localRoom.transportSend.on("connect", ({ dtlsParameters }, callback) => {
      console.log("** transportSend connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        transportId: msgIn.data.transportId,
        roomId: this.roomState.roomId,
        dtlsParameters: dtlsParameters
      };

      this.send(msg);

      callback();

    });

    this.roomState.localRoom.transportSend.on('produce', ({ kind, rtpParameters }, callback) => {

      console.log("** transportSend produce");

      //fires when we call produce with local tracks
      let msg = new RoomProduceStreamMsg();
      msg.data = {
        roomId: this.roomState.roomId,
        kind: kind,
        rtpParameters: rtpParameters
      }
      this.send(msg);
      //what is the id value???
      callback({ id: msgIn.data!.transportId });
    });

    this.roomState.localRoom.transportSend.on("connectionstatechange", (args) => {
      console.log(`transportSend connectionstatechange`, args);
    });

    this.roomState.localRoom.transportSend.on("icecandidateerror", (args) => {
      console.log(`transportSend icecandidateerror`, args);
    });

    this.roomState.localRoom.transportSend.on("icegatheringstatechange", (args) => {
      console.log(`transportSend icegatheringstatechange`, args);
    });


    if (this.onTransportsReadyEvent) {
      this.onTransportsReadyEvent(this.roomState.localRoom.transportSend);
    }

  }

  /**
   * @internal
   * Handles the `producerTransportConnected` message. Currently a no-op.
   */
  private onProducerTransportConnected(msgIn: ProducerTransportConnectedMsg) {
    console.log("** onProducerTransportConnected");

  }

  /**
   * @internal
   * Handles the `roomNewProducer` message, which signals that a remote peer has started publishing a new track.
   */
  private onRoomNewProducer = async (msgIn: RoomNewProducerMsg) => {
    console.log("onRoomNewProducer: " + msgIn.data.kind, msgIn.data.peerId);

    let peer = this.roomState.peers.get(msgIn.data.peerId);
    if (!peer) {
      console.error(`peer not found. peerId: ${msgIn.data.peerId}`);
      return;
    }

    if (!this.isInRoom()) {
      console.error("not in a room", this.roomState.localRoom);
      return;
    }

    this.consumeProducer(msgIn.data.peerId, msgIn.data.producerId, msgIn.data.kind);
  }

  /**
   * @internal
   * Sends a request to the server to consume a specific producer from a remote peer.
   * @param remotePeerId - The ID of the peer who owns the producer.
   * @param producerId - The ID of the producer to consume.
   * @param kind - The media kind ('audio' or 'video').
   */
  private consumeProducer = async (remotePeerId: string, producerId: string, kind: string) => {
    console.log("consumeProducer() :" + remotePeerId, producerId, kind);

    if (remotePeerId === this.localPeer.peerId) {
      console.error("consumeProducer() - you can't consume yourself.");
      return false;
    }

    if (!this.isInRoom()) {
      console.error("not in a room", this.roomState.localRoom);
      return false;
    }

    let peer = this.roomState.peers.get(remotePeerId);
    if (!peer) {
      console.error(`peer not found. ${remotePeerId}`);
      return false;
    }

    let consumers = this.roomState.localRoom.getConsumers(peer);
    let consumer = consumers.get(kind as MediaKind);
    if (consumer) {
      console.error(`consumer already exists for ${remotePeerId} of type ${kind}`);
      return false;
    }

    let msg = new RoomConsumeProducerMsg();
    msg.data = {
      roomId: this.roomState.roomId,
      remotePeerId: remotePeerId,
      producerId: producerId,
      rtpCapabilities: this.device.rtpCapabilities
    }
    return this.send(msg);

  };

  /**
   * @internal
   * Handles the result of a consumption request. It creates the client-side `Consumer`
   * and fires the `eventOnPeerNewTrack` event with the newly available `MediaStreamTrack`.
   */
  private onConsumed = async (msgIn: RoomConsumeProducerResultMsg) => {
    console.log("onConsumed() " + msgIn.data?.kind);

    let peer = this.roomState.peers.get(msgIn.data.peerId);
    if (!peer) {
      console.error(`onConsumed - peer not found, peerId: ${msgIn.data.peerId}`, this.roomState.peers);
      return;
    }

    const consumer = await this.roomState.localRoom.createConsumer(peer, msgIn.data.consumerId, msgIn.data.producerId, msgIn.data.kind, msgIn.data.rtpParameters);
    console.log(`new track for remote peer ${peer.displayName} of type ${consumer.track.kind}`);

    //sync the tracks with tracksinfo
    if (consumer.track.kind === "audio") {
      consumer.track.enabled = peer.tracksInfo.isAudioEnabled;
    } else {
      consumer.track.enabled = peer.tracksInfo.isVideoEnabled;
    }

    console.log(`updated track: consumer track ${consumer.kind} set to enabled=${consumer.track.enabled}`);

    await this.eventOnPeerNewTrack(peer, consumer.track);

  };

  /**
   * @internal
   * Handles the result of a `produce` request. Currently a no-op.
   */
  private onProduced = async (msgIn: RoomProduceStreamResultMsg) => {
    console.log("onProduced " + msgIn.data?.kind);

  };

  /**
   * @internal
   * Handles a `ping` message from the server and fires the corresponding event.
   */
  private onRoomPing = async (msgIn: RoomPingMsg) => {
    console.log("onRoomPing ");

    if (!this.roomState.roomId) {
      console.log("not in room");
      return;
    }

    await this.eventOnRoomPing(this.roomState.roomId);

  };

  /**
   * Sends a `pong` message back to the server in response to a `ping`.
   * @param roomId - The ID of the current room.
   */
  roomPong(roomId: string) {
    console.log("roomPong ");

    if (!this.isInRoom()) {
      console.log("not in room.");
      return;
    }

    if (roomId !== this.roomState.roomId) {
      console.error(`not the same roomid`);
      return;
    }

    //send back pong
    let msg = new RoomPongMsg();
    msg.data.roomId = this.roomState.roomId;

    this.send(msg);

  }

}
