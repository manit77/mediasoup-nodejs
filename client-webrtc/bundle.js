(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // sharedModels.ts
  var RegisterMsg, InviteMsg, JoinMsg, LeaveMsg;
  var init_sharedModels = __esm({
    "sharedModels.ts"() {
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
      InviteMsg = class {
        constructor() {
          this.type = "invite" /* invite */;
          this.data = {
            participantId: "",
            displayName: "",
            conferenceRoomId: "",
            newConfConfig: null
          };
        }
      };
      JoinMsg = class {
        constructor() {
          this.type = "join" /* join */;
          this.data = {
            conferenceRoomId: "",
            error: ""
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

  // main.ts
  var require_main = __commonJS({
    "main.ts"() {
      init_sharedModels();
      init_webSocketManager();
      var ConferenceApp = class {
        constructor() {
          this.localStream = null;
          this.peerConnections = /* @__PURE__ */ new Map();
          this.participantId = "";
          this.conferenceRoomId = "";
          this.isInCall = false;
          this.wsURI = "wss://localhost:3001";
          this.confirmCallback = null;
          this.initElements();
          this.addEventListeners();
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
          this.modalCloseBtn = document.getElementById("modalCloseBtn");
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
          this.hangupBtn.addEventListener("click", () => this.hangup());
          this.modalCloseBtn.addEventListener("click", () => this.hideModal());
          this.modalConfirmBtn.addEventListener("click", () => {
            if (this.confirmCallback) {
              this.confirmCallback(true);
              this.confirmCallback = null;
            }
            this.hideModal();
          });
          this.modalCancelBtn.addEventListener("click", () => {
            if (this.confirmCallback) {
              this.confirmCallback(false);
              this.confirmCallback = null;
            }
            this.hideModal();
          });
          this.newConferenceButton.addEventListener("click", () => this.showNewConference());
          this.joinConferenceButton.addEventListener("click", () => this.showJoinConference());
          this.modalNewConferenceOkButtton.addEventListener("click", () => this.hideNewConference());
          this.modalNewConferenceCloseButtton.addEventListener("click", () => this.hideNewConference());
          this.modalJoinConferenceCancelButton.addEventListener("click", () => this.hideJoinConference());
        }
        showModal(header, message, isConfirmation = false, callback) {
          this.modalHeader.textContent = header;
          this.modalBody.textContent = message;
          this.messageModal.style.display = "flex";
          if (isConfirmation) {
            this.modalCloseBtn.classList.add("hidden");
            this.modalConfirmBtn.classList.remove("hidden");
            this.modalCancelBtn.classList.remove("hidden");
            this.confirmCallback = callback || null;
          } else {
            this.modalCloseBtn.classList.remove("hidden");
            this.modalConfirmBtn.classList.add("hidden");
            this.modalCancelBtn.classList.add("hidden");
            this.confirmCallback = null;
          }
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
        async init() {
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true
            });
            this.localVideo.srcObject = this.localStream;
          } catch (err) {
            console.error("Error accessing media devices:", err);
            this.showModal("Media Error", "Error accessing camera and microphone. Please check permissions.");
          }
        }
        login() {
          const username = this.usernameInput.value.trim();
          if (!username) {
            this.showModal("Input Error", "Please enter a username");
            return;
          }
          this.socket = new WebSocketManager();
          this.socket.addEventHandler("onopen", () => {
            this.connectionStatus.textContent = "Status: Connected";
            this.connectionStatus.classList.add("connected");
            this.connectionStatus.classList.remove("disconnected");
            const registerMsg = new RegisterMsg();
            registerMsg.data.userName = username;
            this.sendToServer(registerMsg);
          });
          this.socket.addEventHandler("onclose", () => {
            this.connectionStatus.textContent = "Status: Disconnected";
            this.connectionStatus.classList.remove("connected");
            this.connectionStatus.classList.add("disconnected");
          });
          this.socket.addEventHandler("onerror", (error) => {
            console.error("WebSocket Error:", error);
            this.connectionStatus.textContent = "Status: Connection Error";
            this.connectionStatus.classList.remove("connected");
            this.connectionStatus.classList.add("disconnected");
          });
          this.socket.addEventHandler("onmessage", (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          });
          this.socket.initialize(this.wsURI, true);
        }
        sendToServer(message) {
          console.log("sendToServer " + message.type, message);
          if (this.socket) {
            this.socket.send(JSON.stringify(message));
          } else {
            console.error("Socket is not connected");
          }
        }
        handleMessage(message) {
          console.log("Received message " + message.type, message);
          switch (message.type) {
            case "registerResult" /* registerResult */:
              this.handleRegisterResult(message);
              break;
            case "getContacts" /* getContacts */:
              this.handleContactsReceived(message);
              break;
            case "invite" /* invite */:
              this.handleInviteReceived(message);
              break;
            case "inviteResult" /* inviteResult */:
              this.handleInviteResult(message);
              break;
            case "needOffer" /* needOffer */:
              this.handleNeedOffer(message);
              break;
            case "joinResult" /* joinResult */:
              this.handleJoinResult(message);
              break;
            case "newParticipant" /* newParticipant */:
              this.handleNewParticipant(message);
              break;
            case "participantLeft" /* participantLeft */:
              this.handleParticipantLeft(message);
              break;
            case "conferenceClosed" /* conferenceClosed */:
              this.handleConferenceClosed(message);
              break;
            case "rtc_offer" /* rtc_offer */:
              this.handleRTCOffer(message);
              break;
            case "rtc_answer" /* rtc_answer */:
              this.handleRTCAnswer(message);
              break;
            case "rtc_ice" /* rtc_ice */:
              this.handleRTCIce(message);
              break;
          }
        }
        handleRegisterResult(message) {
          if (message.data.error) {
            this.showModal("Login Failed", message.data.error, false);
          } else {
            this.userNameLabel.innerText = message.data.userName;
            this.participantId = message.data.participantId;
            console.log("Registered with participantId:", this.participantId, "conferenceRoomId:", message.data.conferenceRoomId);
            this.loginPanel.classList.add("hidden");
            this.mainPanel.classList.remove("hidden");
            if (message.data.conferenceRoomId) {
              this.conferenceRoomId = message.data.conferenceRoomId;
              this.updateUIForCall();
            }
            this.getContacts();
          }
        }
        getContacts() {
          const contactsMsg = {
            type: "getContacts" /* getContacts */,
            data: {}
          };
          this.sendToServer(contactsMsg);
        }
        handleContactsReceived(message) {
          this.contactsList.innerHTML = "";
          message.data.forEach((contact) => {
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
          const callMsg = new InviteMsg();
          callMsg.data.participantId = contact.participantId;
          this.sendToServer(callMsg);
        }
        handleInviteReceived(message) {
          this.showModal(
            "Incoming Call",
            `Incoming call from ${message.data.displayName}. Accept?`,
            true,
            (accepted) => {
              if (accepted) {
                const joinMsg = new JoinMsg();
                joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
                this.sendToServer(joinMsg);
                this.conferenceRoomId = message.data.conferenceRoomId;
                this.isInCall = true;
                this.updateUIForCall();
              }
            }
          );
        }
        handleInviteResult(message) {
          if (message.data.error) {
            this.showModal("Call Error", `Call error: ${message.data.error}`);
            return;
          }
          this.conferenceRoomId = message.data.conferenceRoomId;
          this.isInCall = true;
          this.updateUIForCall();
        }
        async handleNeedOffer(message) {
          console.log("handleNeedOffer " + message.data.participantId);
          let pc = await this.createPeerConnection(message.data.participantId);
          if (pc) {
            this.sendOffer(pc, message.data.participantId);
          }
        }
        async handleJoinResult(message) {
          if (message.data.error) {
            this.showModal("Join Error", `Join error: ${message.data.error}`);
            this.isInCall = false;
            this.updateUIForCall();
            return;
          }
          console.log("Successfully joined conference room:", this.conferenceRoomId);
        }
        async handleNewParticipant(message) {
          console.log("New participant joined:", message.data);
        }
        handleParticipantLeft(message) {
          const participantId = message.data.participantId;
          console.log("Participant left:", participantId);
          if (this.peerConnections.has(participantId)) {
            this.peerConnections.get(participantId)?.close();
            this.peerConnections.delete(participantId);
          }
          const videoEl = document.getElementById(`video-${participantId}`);
          if (videoEl) {
            videoEl.parentElement?.remove();
          }
        }
        handleConferenceClosed(message) {
          this.showModal("Conference Closed", "The conference has been closed");
          this.resetCallState();
        }
        resetCallState() {
          this.isInCall = false;
          this.conferenceRoomId = "";
          this.peerConnections.forEach((pc) => {
            pc.close();
          });
          this.peerConnections.clear();
          const remoteVideos = document.querySelectorAll(".remote-video-wrapper");
          remoteVideos.forEach((videoEl) => {
            videoEl.remove();
          });
          this.updateUIForCall();
        }
        updateUIForCall() {
          this.hangupBtn.disabled = !this.isInCall;
        }
        async createPeerConnection(remotePeerId) {
          console.log("createPeerConnection");
          try {
            const remoteVideoWrapper = document.createElement("div");
            remoteVideoWrapper.className = "video-wrapper remote-video-wrapper";
            const remoteVideo = document.createElement("video");
            remoteVideo.id = `video-${remotePeerId}`;
            remoteVideo.className = "remote-video";
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.srcObject = new MediaStream();
            const participantName = document.createElement("div");
            participantName.className = "participant-name";
            participantName.textContent = `Participant ${remotePeerId.substring(0, 8)}`;
            remoteVideoWrapper.appendChild(remoteVideo);
            remoteVideoWrapper.appendChild(participantName);
            this.videoContainer.appendChild(remoteVideoWrapper);
            const pc = new RTCPeerConnection({
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
              ]
            });
            this.localStream?.getTracks().forEach((track) => {
              pc.addTrack(track, this.localStream);
            });
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                const iceMsg = {
                  type: "rtc_ice" /* rtc_ice */,
                  data: {
                    toParticipantId: remotePeerId,
                    fromParticipantId: this.participantId,
                    candidate: event.candidate
                  }
                };
                this.sendToServer(iceMsg);
              }
            };
            pc.ontrack = (event) => {
              console.log("*** RTCPeerConnection: event", event);
              if (event.type == "track") {
                remoteVideo.srcObject.addTrack(event.track);
              }
            };
            this.peerConnections.set(remotePeerId, pc);
            return pc;
          } catch (err) {
            console.error("Error creating peer connection:", err);
            return null;
          }
        }
        async sendOffer(pc, toParticipantId) {
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
        async handleRTCOffer(message) {
          try {
            const fromParticipantId = message.data.fromParticipantId;
            let pc = this.peerConnections.get(fromParticipantId);
            if (!pc) {
              pc = await this.createPeerConnection(fromParticipantId);
              if (!pc) {
                this.showModal("Peer Connection Error", "Failed to create peer connection");
                throw new Error("Failed to create peer connection");
              }
            }
            await pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const answerMsg = {
              type: "rtc_answer" /* rtc_answer */,
              data: {
                toParticipantId: fromParticipantId,
                fromParticipantId: this.participantId,
                sdp: pc.localDescription
              }
            };
            this.sendToServer(answerMsg);
          } catch (err) {
            console.error("Error handling offer:", err);
            this.showModal("WebRTC Error", "Error handling WebRTC offer");
          }
        }
        async handleRTCAnswer(message) {
          try {
            const fromParticipantId = message.data.fromParticipantId;
            const pc = this.peerConnections.get(fromParticipantId);
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
            }
          } catch (err) {
            console.error("Error handling answer:", err);
            this.showModal("WebRTC Error", "Error handling WebRTC answer");
          }
        }
        async handleRTCIce(message) {
          try {
            const fromParticipantId = message.data.fromParticipantId;
            const pc = this.peerConnections.get(fromParticipantId);
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(message.data.candidate));
            }
          } catch (err) {
            console.error("Error handling ICE candidate:", err);
            this.showModal("WebRTC Error", "Error handling ICE candidate");
          }
        }
        toggleVideo() {
          if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.enabled = !videoTrack.enabled;
              this.toggleVideoBtn.textContent = videoTrack.enabled ? "Toggle Video" : "Show Video";
            }
          }
        }
        toggleAudio() {
          if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
              this.toggleAudioBtn.textContent = audioTrack.enabled ? "Toggle Audio" : "Unmute";
            }
          }
        }
        hangup() {
          if (this.isInCall) {
            const leaveMsg = new LeaveMsg();
            leaveMsg.data.conferenceRoomId = this.conferenceRoomId;
            leaveMsg.data.participantId = this.participantId;
            this.sendToServer(leaveMsg);
            this.resetCallState();
          }
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
