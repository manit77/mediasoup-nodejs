(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // sharedModels.ts
  var ConferenceConfig, RegisterMsg, GetContactsMsg, InviteMsg, RejectMsg, JoinMsg, LeaveMsg, NewParticipantMsg;
  var init_sharedModels = __esm({
    "sharedModels.ts"() {
      ConferenceConfig = class {
        constructor() {
          this.dateStart = /* @__PURE__ */ new Date();
          this.dateEnd = null;
          this.maxParticipants = 2;
          this.allowConferenceVideo = true;
          this.allowConferenceAudio = true;
          this.allowParticipantVideo = true;
          this.allowParticpantAudio = true;
          this.inviteOnly = false;
          //anyone can join or by invite only
          this.type = "adhoc";
        }
        //adhoc is making a call to another peer 1-1
      };
      RegisterMsg = class {
        constructor() {
          this.type = "register" /* register */;
          this.data = {
            userName: "",
            authToken: "",
            participantId: ""
          };
        }
      };
      GetContactsMsg = class {
        constructor() {
          this.type = "getContacts" /* getContacts */;
          this.data = [];
        }
      };
      InviteMsg = class {
        constructor() {
          this.type = "invite" /* invite */;
          this.data = {
            participantId: "",
            displayName: "",
            conferenceRoomId: ""
          };
        }
      };
      RejectMsg = class {
        constructor() {
          this.type = "reject" /* reject */;
          this.data = {
            conferenceRoomId: "",
            fromParticipantId: "",
            toParticipantId: ""
          };
        }
      };
      JoinMsg = class {
        constructor() {
          this.type = "join" /* join */;
          this.data = {
            conferenceRoomId: ""
          };
        }
      };
      LeaveMsg = class {
        constructor() {
          this.type = "leave" /* leave */;
          this.data = {
            conferenceRoomId: "",
            participantId: ""
          };
        }
      };
      NewParticipantMsg = class {
        constructor() {
          this.type = "newParticipant" /* newParticipant */;
          this.data = {
            conferenceRoomId: "",
            participantId: "",
            displayName: ""
          };
        }
      };
    }
  });

  // webSocketManager.ts
  var WebSocketManager;
  var init_webSocketManager = __esm({
    "webSocketManager.ts"() {
      WebSocketManager = class {
        constructor() {
          this.socket = null;
          this.callbacks = /* @__PURE__ */ new Map();
          this.autoReconnect = false;
          // Initialize WebSocket connection
          this.initialize = async (uri, autoReconnect = false) => {
            this.autoReconnect = autoReconnect;
            this.socket = new WebSocket(`${uri}`);
            this.state = "connecting";
            this.socket.onopen = () => {
              this.state = "connected";
              console.log("Signaling server connected");
              this.fireEvent("onopen");
            };
            this.socket.onerror = (error) => {
              this.state = "disconnected";
              console.error("Signaling server error:", error);
              this.fireEvent("onerror");
            };
            this.socket.onclose = () => {
              if (autoReconnect) {
                this.state = "reconnecting";
                this.fireEvent("onclose");
                setTimeout(() => {
                  this.initialize(uri, autoReconnect);
                }, 1e3);
              } else {
                this.state = "disconnected";
                console.log("Signaling server disconnected");
                this.fireEvent("onclose");
              }
            };
            this.socket.onmessage = (event) => {
              this.fireEvent("onmessage", event);
            };
          };
        }
        fireEvent(type, data) {
          if (this.callbacks.has(type)) {
            this.callbacks.get(type).forEach((callback) => callback(data));
          }
        }
        // Register a callback for a specific message type (e.g., 'offer', 'answer', 'ice-candidate')
        addEventHandler(type, callback) {
          if (!this.callbacks.has(type)) {
            this.callbacks.set(type, []);
          }
          this.callbacks.get(type).push(callback);
        }
        //remove the event handler
        removeEventHandler(type, callback) {
          this.callbacks.get(type).push(callback);
          let cbarr = this.callbacks.get(type);
          let idx = cbarr.findIndex((cb) => cb === callback);
          if (idx > -1) {
            cbarr.splice(idx, 1);
          }
        }
        // Send a message to the signaling server
        send(data) {
          try {
            if (this.socket.readyState === WebSocket.OPEN) {
              this.socket.send(data);
            } else {
              console.error("socket not connected.");
            }
          } catch (err) {
            console.error(err);
          }
        }
        // Close the connection
        disconnect() {
          this.autoReconnect = false;
          this.callbacks.clear();
          this.state = "";
          if (this.socket) {
            this.socket.close();
            this.socket = null;
          }
        }
      };
    }
  });

  // rtcClients/webRTCClient.ts
  var WebRTCClient;
  var init_webRTCClient = __esm({
    "rtcClients/webRTCClient.ts"() {
      WebRTCClient = class {
        //private onNewConnection: (conn: ConnectionInfo)=> void,
        constructor(onIceCandidate) {
          this.onIceCandidate = onIceCandidate;
          this.DSTR = "WebRTCClient";
          this.localStream = null;
          this.peerConnections = /* @__PURE__ */ new Map();
        }
        async initLocalMedia() {
          this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          return this.localStream;
        }
        closeAll() {
          for (const [key, remote] of this.peerConnections) {
            remote.pc.close();
          }
          this.peerConnections.clear();
          if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
          }
        }
        /**
         * creates or returns a peerconnection and media stream
         * @param key 
         * @returns 
         */
        createPeerConnection(key) {
          console.log(this.DSTR, "createPeerConnection");
          if (this.peerConnections.has(key)) {
            console.log(this.DSTR, "existing connnection.");
            return this.peerConnections.get(key);
          }
          console.log(this.DSTR, "new peer connnection.");
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
          });
          const remoteStream = new MediaStream();
          pc.ontrack = (event) => {
            console.log(this.DSTR, "ontrack");
            event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
          };
          pc.onicecandidate = (event) => {
            console.log(this.DSTR, "onicecandidate");
            if (event.candidate) {
              this.onIceCandidate(key, event.candidate);
            }
          };
          if (this.localStream) {
            this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
          }
          const connInfo = { key, pc, stream: remoteStream };
          this.peerConnections.set(key, connInfo);
          return connInfo;
        }
        //removes a peer connection
        removePeerConnection(key) {
          console.log(this.DSTR, "removePeerConnection");
          const remote = this.peerConnections.get(key);
          if (remote) {
            remote.pc.close();
            this.peerConnections.delete(key);
          }
        }
        /**
         * creates a new webrtc offer, this initiates a webrtc stream
         * @param key 
         * @returns 
         */
        async createOffer(key) {
          console.log(this.DSTR, "createOffer");
          const remote = this.peerConnections.get(key);
          if (!remote) {
            throw new Error(`Peer ${key} not found`);
          }
          const offer = await remote.pc.createOffer();
          await remote.pc.setLocalDescription(offer);
          return offer;
        }
        /**
         * generates a webrtc answer in reply to an offer, returns the peer connections localDescription
         * @param key 
         * @returns 
         */
        async createAnswer(key) {
          console.log(this.DSTR, "createAnswer");
          const remote = this.peerConnections.get(key);
          if (!remote) {
            throw new Error(`Peer ${key} not found`);
          }
          const answer = await remote.pc.createAnswer();
          await remote.pc.setLocalDescription(answer);
          return remote.pc.localDescription;
        }
        /**
         * sets the sdpDesc from an answer
         * @param key 
         * @param desc 
         */
        async setRemoteDescription(key, desc) {
          console.log(this.DSTR, "setRemoteDescription");
          const remote = this.peerConnections.get(key);
          if (!remote) {
            throw new Error(`Peer ${key} not found`);
          }
          if (!remote.pc) {
            throw new Error(`PeerConnection not found for :${key}`);
          }
          await remote.pc.setRemoteDescription(new RTCSessionDescription(desc));
        }
        /***
         * add ice candidate
         */
        async addIceCandidate(key, candidate) {
          console.log(this.DSTR, "addIceCandidate");
          const remote = this.peerConnections.get(key);
          if (!remote) {
            throw new Error(`Peer ${key} not found`);
          }
          await remote.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      };
    }
  });

  // conferenceCallManager.ts
  var ConferenceCallManager;
  var init_conferenceCallManager = __esm({
    "conferenceCallManager.ts"() {
      init_sharedModels();
      init_webSocketManager();
      init_webRTCClient();
      ConferenceCallManager = class {
        constructor() {
          this.DSTR = "ConferenceCallManager";
          this.localStream = null;
          this.participantId = "";
          this.conferenceRoom = {
            conferenceRoomId: "",
            participants: /* @__PURE__ */ new Map(),
            config: new ConferenceConfig()
          };
          this.contacts = [];
          this.isConnected = false;
          this.config = {
            wsURI: "wss://localhost:3001"
          };
          this.rtc_onIceCandidate = (participantId, candidate) => {
            console.log(this.DSTR, "rtc_onIceCandidate");
            if (candidate) {
              const iceMsg = {
                type: "rtc_ice" /* rtc_ice */,
                data: {
                  toParticipantId: participantId,
                  fromParticipantId: this.participantId,
                  candidate
                }
              };
              this.sendToServer(iceMsg);
            }
          };
          this.rtcClient = new WebRTCClient(this.rtc_onIceCandidate);
        }
        connect(autoReconnect, wsURLOverride = "") {
          console.log(this.DSTR, "connect");
          if (wsURLOverride) {
            this.config.wsURI = wsURLOverride;
          }
          this.socket = new WebSocketManager();
          this.socket.addEventHandler("onopen", () => {
            this.isConnected = true;
            this.onEvent("connected" /* connected */);
          });
          this.socket.addEventHandler("onclose", () => {
            this.isConnected = false;
            this.onEvent("disconnected" /* disconnected */);
          });
          this.socket.addEventHandler("onerror", (error) => {
            console.error("WebSocket Error:", error);
            this.onEvent("disconnected" /* disconnected */);
          });
          this.socket.addEventHandler("onmessage", (event) => {
            const message = JSON.parse(event.data);
            console.log("Received message " + message.type, message);
            switch (message.type) {
              case "registerResult" /* registerResult */:
                this.onRegisterResult(message);
                break;
              case "getContacts" /* getContacts */:
                this.onContactsReceived(message);
                break;
              case "invite" /* invite */:
                this.onInviteReceived(message);
                break;
              case "reject" /* reject */:
                this.onRejectReceived(message);
                break;
              case "inviteResult" /* inviteResult */:
                this.onInviteResult(message);
                break;
              case "needOffer" /* needOffer */:
                this.onNeedOffer(message);
                break;
              case "joinResult" /* joinResult */:
                this.onJoinResult(message);
                break;
              case "newParticipant" /* newParticipant */:
                this.onNewParticipant(message);
                break;
              case "participantLeft" /* participantLeft */:
                this.onParticipantLeft(message);
                break;
              case "conferenceClosed" /* conferenceClosed */:
                this.onConferenceClosed(message);
                break;
              case "rtc_offer" /* rtc_offer */:
                this.onRTCOffer(message);
                break;
              case "rtc_answer" /* rtc_answer */:
                this.onRTCAnswer(message);
                break;
              case "rtc_ice" /* rtc_ice */:
                this.onRTCIce(message);
                break;
            }
          });
          this.socket.initialize(this.config.wsURI, autoReconnect);
        }
        disconnect() {
          console.log(this.DSTR, "disconnect");
          this.socket.disconnect();
        }
        isInConference() {
          return this.conferenceRoom.conferenceRoomId > "";
        }
        async getUserMedia() {
          console.log(this.DSTR, "getUserMedia");
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true
            });
            this.rtcClient.localStream = this.localStream;
            return this.localStream;
          } catch (err) {
            console.error("Error accessing media devices:", err);
          }
          return null;
        }
        register(username) {
          console.log(this.DSTR, "register");
          const registerMsg = new RegisterMsg();
          registerMsg.data.userName = username;
          this.sendToServer(registerMsg);
        }
        getContacts() {
          console.log(this.DSTR, "getContacts");
          const contactsMsg = new GetContactsMsg();
          this.sendToServer(contactsMsg);
        }
        join(conferenceRoomId) {
          console.log(this.DSTR, "join");
          const joinMsg = new JoinMsg();
          joinMsg.data.conferenceRoomId = conferenceRoomId;
          this.sendToServer(joinMsg);
        }
        invite(contact) {
          console.log(this.DSTR, "invite");
          const callMsg = new InviteMsg();
          callMsg.data.participantId = contact.participantId;
          this.sendToServer(callMsg);
        }
        reject(participantId, conferenceRoomId) {
          console.log(this.DSTR, "reject");
          let msg = new RejectMsg();
          msg.data.conferenceRoomId = conferenceRoomId;
          msg.data.fromParticipantId = this.participantId;
          msg.data.toParticipantId = participantId;
          this.sendToServer(msg);
          this.conferenceRoom.conferenceRoomId = "";
        }
        toggleVideo() {
          console.log(this.DSTR, "toggleVideo");
          if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.enabled = !videoTrack.enabled;
            }
          }
        }
        toggleAudio() {
          console.log(this.DSTR, "toggleAudio");
          if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
            }
          }
        }
        leave() {
          console.log(this.DSTR, "leave");
          if (this.conferenceRoom.conferenceRoomId) {
            const leaveMsg = new LeaveMsg();
            leaveMsg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            leaveMsg.data.participantId = this.participantId;
            this.sendToServer(leaveMsg);
            this.conferenceRoom.conferenceRoomId = "";
          } else {
            console.log(this.DSTR, "not in conerence");
          }
          this.resetCallState();
        }
        getParticipant(participantId) {
          console.log(this.DSTR, "getParticipant");
          return this.conferenceRoom.participants.get(participantId);
        }
        sendToServer(message) {
          console.log(this.DSTR, "sendToServer " + message.type, message);
          if (this.socket) {
            this.socket.send(JSON.stringify(message));
          } else {
            console.error("Socket is not connected");
          }
        }
        onRegisterResult(message) {
          console.log(this.DSTR, "onRegisterResult");
          if (message.data.error) {
            console.error(message.data.error);
            this.onEvent("registerResult" /* registerResult */, message);
          } else {
            this.onEvent("registerResult" /* registerResult */, message);
            this.participantId = message.data.participantId;
            console.log("Registered with participantId:", this.participantId, "conferenceRoomId:", message.data.conferenceRoomId);
            if (message.data.conferenceRoomId) {
              this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
            }
          }
        }
        onContactsReceived(message) {
          console.log(this.DSTR, "onContactsReceived");
          this.contacts = message.data.filter((c) => c.participantId !== this.participantId);
          this.onEvent("contactsReceived" /* contactsReceived */, this.contacts);
        }
        onInviteReceived(message) {
          console.log(this.DSTR, "onInviteReceived");
          this.onEvent("inviteReceived" /* inviteReceived */, message);
        }
        onRejectReceived(message) {
          console.log(this.DSTR, "onRejectReceived");
          this.onEvent("rejectReceived" /* rejectReceived */, message);
        }
        onInviteResult(message) {
          console.log(this.DSTR, "onInviteResult");
          if (message.data.conferenceRoomId) {
            this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
          }
          this.onEvent("inviteResult" /* inviteResult */, message);
        }
        onNeedOffer(message) {
          console.log(this.DSTR, "onNeedOffer " + message.data.participantId);
          let connInfo = this.rtcClient.createPeerConnection(message.data.participantId);
          this.conferenceRoom.participants.set(message.data.participantId, {
            participantId: message.data.participantId,
            displayName: message.data.displayName,
            peerConnection: connInfo.pc,
            mediaStream: connInfo.stream
          });
          this.sendOffer(connInfo.pc, message.data.participantId);
        }
        onJoinResult(message) {
          console.log(this.DSTR, "onJoinResult");
          this.onEvent("joinResult" /* joinResult */, message);
          if (message.data.error) {
            console.log(this.DSTR, "onJoinResult error: ", message.data.error);
            return;
          }
          this.conferenceRoom.conferenceRoomId = message.data.conferenceRoomId;
          console.log(this.DSTR, "joined conference room:", this.conferenceRoom.conferenceRoomId);
          console.log(this.DSTR, "participants:", message.data.participants.length);
          for (let p of message.data.participants) {
            console.log(this.DSTR, "createPeerConnection for existing:", p.participantId);
            let connInfo = this.rtcClient.createPeerConnection(p.participantId);
            this.conferenceRoom.participants.set(p.participantId, {
              participantId: p.participantId,
              displayName: p.displayName,
              peerConnection: connInfo.pc,
              mediaStream: connInfo.stream
            });
            let msg = new NewParticipantMsg();
            msg.data.participantId = p.participantId;
            msg.data.displayName = p.displayName;
            msg.data.conferenceRoomId = this.conferenceRoom.conferenceRoomId;
            this.onEvent("newParticipant" /* newParticipant */, msg);
          }
        }
        onNewParticipant(message) {
          console.log(this.DSTR, "New participant joined:", message.data);
          let connInfo = this.rtcClient.createPeerConnection(message.data.participantId);
          this.conferenceRoom.participants.set(message.data.participantId, {
            participantId: message.data.participantId,
            displayName: message.data.participantId,
            peerConnection: connInfo.pc,
            mediaStream: connInfo.stream
          });
          this.onEvent("newParticipant" /* newParticipant */, message);
        }
        onParticipantLeft(message) {
          const participantId = message.data.participantId;
          console.log(this.DSTR, "Participant left:", participantId);
          let p = this.conferenceRoom.participants.get(participantId);
          if (p) {
            if (p.mediaStream) {
              for (let track of p.mediaStream.getTracks()) {
                track.stop();
              }
            }
            if (p.peerConnection) {
              p.peerConnection.close();
            }
            this.conferenceRoom.participants.delete(participantId);
          }
          this.onEvent("participantLeft" /* participantLeft */, message);
        }
        onConferenceClosed(message) {
          console.log(this.DSTR, "onConferenceClosed");
          this.resetCallState();
        }
        resetCallState() {
          this.conferenceRoom.conferenceRoomId = "";
          this.conferenceRoom.participants.forEach((p) => {
            p.peerConnection?.close();
            for (let t of p.mediaStream.getTracks()) {
              t.stop();
            }
          });
          this.conferenceRoom.participants.clear();
        }
        async sendOffer(pc, toParticipantId) {
          console.log(this.DSTR, "sendOffer");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const offerMsg = {
            type: "rtc_offer" /* rtc_offer */,
            data: {
              toParticipantId,
              fromParticipantId: this.participantId,
              sdp: pc.localDescription
            }
          };
          this.sendToServer(offerMsg);
        }
        async onRTCOffer(message) {
          console.log(this.DSTR, "onRTCOffer");
          try {
            const fromParticipantId = message.data.fromParticipantId;
            await this.rtcClient.setRemoteDescription(fromParticipantId, new RTCSessionDescription(message.data.sdp));
            const answer = await this.rtcClient.createAnswer(fromParticipantId);
            const answerMsg = {
              type: "rtc_answer" /* rtc_answer */,
              data: {
                toParticipantId: fromParticipantId,
                fromParticipantId: this.participantId,
                sdp: answer
              }
            };
            this.sendToServer(answerMsg);
          } catch (err) {
            console.error("Error handling offer:", err);
          }
        }
        async onRTCAnswer(message) {
          console.log(this.DSTR, "onRTCAnswer");
          try {
            const fromParticipantId = message.data.fromParticipantId;
            const p = this.conferenceRoom.participants.get(fromParticipantId);
            if (p.peerConnection) {
              await p.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
            }
          } catch (err) {
            console.error("Error handling answer:", err);
          }
        }
        async onRTCIce(message) {
          console.log(this.DSTR, "onRTCIce");
          try {
            const fromParticipantId = message.data.fromParticipantId;
            const p = this.conferenceRoom.participants.get(fromParticipantId);
            if (p.peerConnection) {
              await p.peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
            }
          } catch (err) {
            console.error("Error handling ICE candidate:", err);
          }
        }
      };
    }
  });

  // main.ts
  var require_main = __commonJS({
    "main.ts"() {
      init_conferenceCallManager();
      var ConferenceApp = class {
        constructor() {
          this.confMgr = new ConferenceCallManager();
          this.initElements();
          this.addEventListeners();
          this.confMgr.onEvent = (eventType, msg) => {
            console.log("Client App EventType: " + eventType, msg);
            switch (eventType) {
              case "connected" /* connected */: {
                this.connectionStatus.textContent = "Connected";
                this.connectionStatus.classList.add("connected");
                this.connectionStatus.classList.remove("disconnected");
                break;
              }
              case "disconnected" /* disconnected */: {
                this.connectionStatus.textContent = "Disconnected";
                this.connectionStatus.classList.remove("connected");
                this.connectionStatus.classList.add("disconnected");
                break;
              }
              case "registerResult" /* registerResult */: {
                this.handleRegisterResult(msg);
                break;
              }
              case "contactsReceived" /* contactsReceived */: {
                this.handleContactsReceived(msg);
                break;
              }
              case "inviteReceived" /* inviteReceived */: {
                this.handleInviteReceived(msg);
                break;
              }
              case "joinResult" /* joinResult */: {
                this.handleJoinResult(msg);
                break;
              }
              case "inviteResult" /* inviteResult */: {
                this.handleInviteResult(msg);
                break;
              }
              case "newParticipant" /* newParticipant */: {
                this.handleNewParticipant(msg);
                break;
              }
              case "participantLeft" /* participantLeft */: {
                this.handleParticipantLeft(msg);
                break;
              }
              case "rejectReceived" /* rejectReceived */: {
                this.handleRejectReceived(msg);
                break;
              }
              case "confClosed" /* confClosed */: {
                this.handleConferenceClosed(msg);
                break;
              }
            }
          };
        }
        get isInCall() {
          return this.confMgr.isInConference();
        }
        get isConnected() {
          return this.confMgr.isConnected;
        }
        async init() {
          let uri = `${window.location.protocol == "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port}`;
          this.confMgr.connect(true, uri);
        }
        initElements() {
          this.loginPanel = document.getElementById("loginPanel");
          this.mainPanel = document.getElementById("mainPanel");
          this.usernameInput = document.getElementById("username");
          this.loginBtn = document.getElementById("loginBtn");
          this.connectionStatus = document.getElementById("connectionStatus");
          this.userNameLabel = document.getElementById("userNameLabel");
          this.contactsList = document.getElementById("contactsList");
          this.refreshContactsBtn = document.getElementById("refreshContactsBtn");
          this.localVideo = document.getElementById("localVideo");
          this.videoContainer = document.getElementById("videoContainer");
          this.toggleVideoBtn = document.getElementById("toggleVideoBtn");
          this.toggleAudioBtn = document.getElementById("toggleAudioBtn");
          this.hangupBtn = document.getElementById("hangupBtn");
          this.messageModal = document.getElementById("messageModal");
          this.modalHeader = document.getElementById("modalHeader");
          this.modalBody = document.getElementById("modalBody");
          this.modalConfirmBtn = document.getElementById("modalConfirmBtn");
          this.modalCancelBtn = document.getElementById("modalCancelBtn");
          this.modalNewConference = document.getElementById("confModal");
          this.modalNewConferenceOkButtton = document.getElementById("confModalCloseBtn");
          this.modalNewConferenceCloseButtton = document.getElementById("confModalCancelBtn");
          this.modalJoinConference = document.getElementById("confJoinModal");
          this.modalJoinConferenceCancelButton = document.getElementById("confJoinModalCancelButton");
          this.newConferenceButton = document.getElementById("newConferenceButton");
          this.joinConferenceButton = document.getElementById("joinConferenceButton");
        }
        addEventListeners() {
          console.log("addEventListeners");
          this.loginBtn.addEventListener("click", () => this.login());
          this.refreshContactsBtn.addEventListener("click", () => this.getContacts());
          this.toggleVideoBtn.addEventListener("click", () => this.toggleVideo());
          this.toggleAudioBtn.addEventListener("click", () => this.toggleAudio());
          this.hangupBtn.addEventListener("click", () => this.hangupBtn_Click());
          this.modalCancelBtn.addEventListener("click", () => this.hideModal());
          this.newConferenceButton.addEventListener("click", () => this.showNewConference());
          this.joinConferenceButton.addEventListener("click", () => this.showJoinConference());
          this.modalNewConferenceOkButtton.addEventListener("click", () => this.hideNewConference());
          this.modalNewConferenceCloseButtton.addEventListener("click", () => this.hideNewConference());
          this.modalJoinConferenceCancelButton.addEventListener("click", () => this.hideJoinConference());
        }
        async initLocalMedia() {
          this.localVideo.srcObject = await this.confMgr.getUserMedia();
        }
        login() {
          if (!this.confMgr.isConnected) {
            this.showModal("No connected", "server is not connected.");
            return;
          }
          const username = this.usernameInput.value.trim();
          if (!username) {
            this.showModal("Input Error", "Please enter a username");
            return;
          }
          this.confMgr.register(username);
        }
        showModal(header, message, callback) {
          console.log("showModal", header);
          this.modalHeader.textContent = header;
          this.modalBody.textContent = message;
          this.messageModal.style.display = "flex";
          let clickOk = () => {
            if (callback) {
              callback(true);
            }
            this.hideModal();
            this.modalConfirmBtn.removeEventListener("click", clickOk);
            this.modalCancelBtn.removeEventListener("click", clickCancel);
          };
          let clickCancel = () => {
            if (callback) {
              callback(false);
            }
            this.hideModal();
            this.modalConfirmBtn.removeEventListener("click", clickOk);
            this.modalCancelBtn.removeEventListener("click", clickCancel);
          };
          this.modalConfirmBtn.addEventListener("click", clickOk);
          this.modalCancelBtn.addEventListener("click", clickCancel);
        }
        hideModal() {
          this.messageModal.style.display = "none";
        }
        showNewConference() {
          console.log("showNewConference");
          this.modalNewConference.style.display = "flex";
        }
        hideNewConference() {
          console.log("hideNewConference");
          this.modalNewConference.style.display = "none";
        }
        showJoinConference() {
          console.log("showJoinConference");
          this.modalJoinConference.style.display = "flex";
        }
        hideJoinConference() {
          console.log("hideJoinConference");
          this.modalJoinConference.style.display = "none";
        }
        handleRegisterResult(msg) {
          if (msg.data.error) {
            this.showModal("Login Failed", msg.data.error);
          } else {
            this.initLocalMedia();
            this.userNameLabel.innerText = msg.data.userName;
            this.loginPanel.classList.add("hidden");
            this.mainPanel.classList.remove("hidden");
            if (msg.data.conferenceRoomId) {
              this.updateUIForCall();
            }
            this.getContacts();
          }
        }
        getContacts() {
          this.confMgr.getContacts();
        }
        handleContactsReceived(contacts) {
          console.log("handleContactsReceived", contacts);
          this.contactsList.innerHTML = "";
          contacts.forEach((contact) => {
            const li = document.createElement("li");
            li.className = "contact-item";
            const statusIndicator = document.createElement("span");
            statusIndicator.className = `status-indicator ${contact.status}`;
            const nameSpan = document.createElement("span");
            nameSpan.textContent = contact.displayName || `User ${contact.participantId.substring(0, 8)}`;
            const callButton = document.createElement("button");
            callButton.textContent = "Call";
            callButton.className = "call-btn";
            callButton.addEventListener("click", () => {
              this.callContact(contact);
            });
            li.appendChild(statusIndicator);
            li.appendChild(nameSpan);
            li.appendChild(callButton);
            this.contactsList.appendChild(li);
          });
        }
        callContact(contact) {
          this.confMgr.invite(contact);
        }
        handleInviteReceived(msg) {
          console.log("handleInviteReceived");
          this.showModal(
            "Incoming Call",
            `Incoming call from ${msg.data.displayName}. Accept?`,
            (accepted) => {
              if (accepted) {
                this.confMgr.join(msg.data.conferenceRoomId);
              } else {
                this.confMgr.reject(msg.data.participantId, msg.data.conferenceRoomId);
              }
              this.updateUIForCall();
            }
          );
        }
        handleRejectReceived(msg) {
          console.log("handleRejectReceived");
        }
        handleInviteResult(msg) {
          if (msg.data.error) {
            this.showModal("Call Error", `Call error: ${msg.data.error}`);
            return;
          }
          this.updateUIForCall();
        }
        async handleJoinResult(msg) {
          console.log("handleJoinResult");
          if (msg.data.error) {
            this.showModal("Join Error", `Join error: ${msg.data.error}`);
            return;
          }
          this.confMgr.conferenceRoom.conferenceRoomId = msg.data.conferenceRoomId;
          console.log("joined conference room:", this.confMgr.conferenceRoom.conferenceRoomId);
          this.updateUIForCall();
        }
        async handleNewParticipant(msg) {
          console.log("handleNewParticipant:", msg.data);
          this.createVideoElement(msg.data.participantId, msg.data.displayName);
        }
        handleParticipantLeft(msg) {
          console.log("handleParticipantLeft:", msg.data);
          const participantId = msg.data.participantId;
          console.log("Participant left:", participantId);
          this.removeVideoElement(participantId);
        }
        handleConferenceClosed(msg) {
          this.showModal("Conference Closed", "The conference has been closed");
          this.resetCallState();
        }
        /**
         * leave the conference, remove all videos
         */
        resetCallState() {
          this.confMgr.leave();
          const remoteVideos = document.querySelectorAll(".remote-video-wrapper");
          remoteVideos.forEach((videoEl) => {
            videoEl.remove();
          });
          this.updateUIForCall();
        }
        updateUIForCall() {
          this.hangupBtn.disabled = !this.isInCall;
        }
        createVideoElement(remotePeerId, displayName) {
          console.log("createVideoElement");
          if (!remotePeerId) {
            console.error("remotePeerId is required.");
            return;
          }
          let participant = this.confMgr.getParticipant(remotePeerId);
          const remoteVideoWrapper = document.createElement("div");
          remoteVideoWrapper.className = "video-wrapper remote-video-wrapper";
          const remoteVideo = document.createElement("video");
          remoteVideo.id = `video-${remotePeerId}`;
          remoteVideo.className = "remote-video";
          remoteVideo.autoplay = true;
          remoteVideo.playsInline = true;
          remoteVideo.srcObject = participant.mediaStream;
          const participantName = document.createElement("div");
          participantName.className = "participant-name";
          participantName.textContent = `Participant ${displayName}`;
          remoteVideoWrapper.appendChild(remoteVideo);
          remoteVideoWrapper.appendChild(participantName);
          this.videoContainer.appendChild(remoteVideoWrapper);
          return remoteVideo;
        }
        removeVideoElement(remotePeerId) {
          let id = `video-${remotePeerId}`;
          const remoteVideo = document.getElementById(id);
          const remoteVideoWrapper = remoteVideo.parentElement;
          remoteVideoWrapper.remove();
        }
        toggleVideo() {
          this.confMgr.toggleVideo();
        }
        toggleAudio() {
          this.confMgr.toggleAudio();
        }
        hangupBtn_Click() {
          this.resetCallState();
        }
      };
      document.addEventListener("DOMContentLoaded", () => {
        const app = new ConferenceApp();
        app.init();
      });
    }
  });
  require_main();
})();
