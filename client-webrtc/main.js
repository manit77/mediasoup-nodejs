"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sharedModels_1 = require("./sharedModels");
class ConferenceApp {
    constructor() {
        this.localStream = null;
        this.peerConnections = new Map();
        this.participantId = '';
        this.conferenceRoomId = '';
        this.isInCall = false;
        this.confirmCallback = null;
        this.initElements();
        this.addEventListeners();
    }
    initElements() {
        this.loginPanel = document.getElementById('loginPanel');
        this.mainPanel = document.getElementById('mainPanel');
        this.usernameInput = document.getElementById('username');
        this.loginBtn = document.getElementById('loginBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.contactsList = document.getElementById('contactsList');
        this.refreshContactsBtn = document.getElementById('refreshContactsBtn');
        this.localVideo = document.getElementById('localVideo');
        this.videoContainer = document.getElementById('videoContainer');
        this.toggleVideoBtn = document.getElementById('toggleVideoBtn');
        this.toggleAudioBtn = document.getElementById('toggleAudioBtn');
        this.hangupBtn = document.getElementById('hangupBtn');
        this.messageModal = document.getElementById('messageModal');
        this.modalHeader = document.getElementById('modalHeader');
        this.modalBody = document.getElementById('modalBody');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');
        this.modalConfirmBtn = document.getElementById('modalConfirmBtn');
        this.modalCancelBtn = document.getElementById('modalCancelBtn');
    }
    addEventListeners() {
        this.loginBtn.addEventListener('click', () => this.login());
        this.refreshContactsBtn.addEventListener('click', () => this.getContacts());
        this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.hangupBtn.addEventListener('click', () => this.hangup());
        this.modalCloseBtn.addEventListener('click', () => this.hideModal());
        this.modalConfirmBtn.addEventListener('click', () => {
            if (this.confirmCallback) {
                this.confirmCallback(true);
                this.confirmCallback = null;
            }
            this.hideModal();
        });
        this.modalCancelBtn.addEventListener('click', () => {
            if (this.confirmCallback) {
                this.confirmCallback(false);
                this.confirmCallback = null;
            }
            this.hideModal();
        });
    }
    showModal(header, message, isConfirmation = false, callback) {
        this.modalHeader.textContent = header;
        this.modalBody.textContent = message;
        this.messageModal.style.display = 'flex';
        if (isConfirmation) {
            this.modalCloseBtn.classList.add('hidden');
            this.modalConfirmBtn.classList.remove('hidden');
            this.modalCancelBtn.classList.remove('hidden');
            this.confirmCallback = callback || null;
        }
        else {
            this.modalCloseBtn.classList.remove('hidden');
            this.modalConfirmBtn.classList.add('hidden');
            this.modalCancelBtn.classList.add('hidden');
            this.confirmCallback = null;
        }
    }
    hideModal() {
        this.messageModal.style.display = 'none';
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Initialize user media
                this.localStream = yield navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                this.localVideo.srcObject = this.localStream;
            }
            catch (err) {
                console.error('Error accessing media devices:', err);
                this.showModal('Media Error', 'Error accessing camera and microphone. Please check permissions.');
            }
        });
    }
    login() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.showModal('Input Error', 'Please enter a username');
            return;
        }
        // Connect to WebSocket server
        this.socket = new WebSocket('wss://localhost:3001');
        this.socket.onopen = () => {
            this.connectionStatus.textContent = 'Status: Connected';
            this.connectionStatus.classList.add('connected');
            this.connectionStatus.classList.remove('disconnected');
            // Register with the server
            const registerMsg = new sharedModels_1.RegisterMsg();
            registerMsg.data.userName = username;
            this.sendToServer(registerMsg);
        };
        this.socket.onclose = () => {
            this.connectionStatus.textContent = 'Status: Disconnected';
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
        };
        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            this.connectionStatus.textContent = 'Status: Connection Error';
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
        };
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
    }
    sendToServer(message) {
        console.log("sendToServer", message);
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
        else {
            console.error('Socket is not connected');
        }
    }
    handleMessage(message) {
        console.log('Received message:', message);
        switch (message.type) {
            case sharedModels_1.CallMessageType.register_result:
                this.handleRegisterResult(message);
                break;
            case sharedModels_1.CallMessageType.getContacts:
                this.handleContactsReceived(message);
                break;
            case sharedModels_1.CallMessageType.call:
                this.handleCallReceived(message);
                break;
            case sharedModels_1.CallMessageType.call_result:
                this.handleCallResult(message);
                break;
            case sharedModels_1.CallMessageType.needOffer:
                this.handleNeedOffer(message);
                break;
            case sharedModels_1.CallMessageType.joinResult:
                this.handleJoinResult(message);
                break;
            case sharedModels_1.CallMessageType.newParticipant:
                this.handleNewParticipant(message);
                break;
            case sharedModels_1.CallMessageType.participantLeft:
                this.handleParticipantLeft(message);
                break;
            case sharedModels_1.CallMessageType.conferenceClosed:
                this.handleConferenceClosed(message);
                break;
            case sharedModels_1.CallMessageType.rtc_offer:
                this.handleRTCOffer(message);
                break;
            case sharedModels_1.CallMessageType.rtc_answer:
                this.handleRTCAnswer(message);
                break;
            case sharedModels_1.CallMessageType.rtc_ice:
                this.handleRTCIce(message);
                break;
        }
    }
    handleRegisterResult(message) {
        this.participantId = message.data.participantId;
        console.log('Registered with participantId:', this.participantId);
        // Show main panel and hide login panel
        this.loginPanel.classList.add('hidden');
        this.mainPanel.classList.remove('hidden');
        // Get contacts
        this.getContacts();
    }
    getContacts() {
        const contactsMsg = {
            type: sharedModels_1.CallMessageType.getContacts,
            data: {}
        };
        this.sendToServer(contactsMsg);
    }
    handleContactsReceived(message) {
        // Clear existing contacts
        this.contactsList.innerHTML = '';
        // Add new contacts
        message.data.forEach((contact) => {
            const li = document.createElement('li');
            li.className = 'contact-item';
            const statusIndicator = document.createElement('span');
            statusIndicator.className = `status-indicator ${contact.status}`;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = contact.displayName || `User ${contact.participantId.substring(0, 8)}`;
            const callButton = document.createElement('button');
            callButton.textContent = 'Call';
            callButton.className = 'call-btn';
            callButton.disabled = this.isInCall;
            callButton.addEventListener('click', () => {
                this.callContact(contact);
            });
            li.appendChild(statusIndicator);
            li.appendChild(nameSpan);
            li.appendChild(callButton);
            this.contactsList.appendChild(li);
        });
    }
    callContact(contact) {
        const callMsg = new sharedModels_1.CallMsg();
        callMsg.data.participantId = contact.participantId;
        this.sendToServer(callMsg);
    }
    handleCallReceived(message) {
        this.showModal('Incoming Call', `Incoming call from ${message.data.displayName}. Accept?`, true, (accepted) => {
            if (accepted) {
                const joinMsg = new sharedModels_1.JoinMsg();
                joinMsg.data.conferenceRoomId = message.data.conferenceRoomId;
                this.sendToServer(joinMsg);
                this.conferenceRoomId = message.data.conferenceRoomId;
                this.isInCall = true;
                this.updateUIForCall();
            }
        });
    }
    handleCallResult(message) {
        if (message.data.error) {
            this.showModal('Call Error', `Call error: ${message.data.error}`);
            return;
        }
        this.conferenceRoomId = message.data.conferenceRoomId;
        this.isInCall = true;
        this.updateUIForCall();
    }
    handleNeedOffer(message) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("handleNeedOffer " + message.data.participantId);
            //server will send need offer to the leader of the conference room
            let pc = yield this.createPeerConnection(message.data.participantId);
            if (pc) {
                this.sendOffer(pc, message.data.participantId);
            }
        });
    }
    handleJoinResult(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (message.data.error) {
                this.showModal('Join Error', `Join error: ${message.data.error}`);
                this.isInCall = false;
                this.updateUIForCall();
                return;
            }
            console.log('Successfully joined conference room:', this.conferenceRoomId);
        });
    }
    handleNewParticipant(message) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('New participant joined:', message.data);
        });
    }
    handleParticipantLeft(message) {
        var _a, _b;
        const participantId = message.data.participantId;
        console.log('Participant left:', participantId);
        // Close peer connection
        if (this.peerConnections.has(participantId)) {
            (_a = this.peerConnections.get(participantId)) === null || _a === void 0 ? void 0 : _a.close();
            this.peerConnections.delete(participantId);
        }
        // Remove video element
        const videoEl = document.getElementById(`video-${participantId}`);
        if (videoEl) {
            (_b = videoEl.parentElement) === null || _b === void 0 ? void 0 : _b.remove();
        }
    }
    handleConferenceClosed(message) {
        this.showModal('Conference Closed', 'The conference has been closed');
        this.resetCallState();
    }
    resetCallState() {
        this.isInCall = false;
        this.conferenceRoomId = '';
        // Close all peer connections
        this.peerConnections.forEach((pc) => {
            pc.close();
        });
        this.peerConnections.clear();
        // Remove all remote videos
        const remoteVideos = document.querySelectorAll('.remote-video-wrapper');
        remoteVideos.forEach((videoEl) => {
            videoEl.remove();
        });
        this.updateUIForCall();
    }
    updateUIForCall() {
        // Update button states
        this.hangupBtn.disabled = !this.isInCall;
        // Update contact call buttons
        const callButtons = document.querySelectorAll('.call-btn');
        callButtons.forEach((btn) => {
            btn.disabled = this.isInCall;
        });
    }
    createPeerConnection(remotePeerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log("createPeerConnection");
            try {
                const remoteVideoWrapper = document.createElement('div');
                remoteVideoWrapper.className = 'video-wrapper remote-video-wrapper';
                const remoteVideo = document.createElement('video');
                remoteVideo.id = `video-${remotePeerId}`;
                remoteVideo.className = 'remote-video';
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.srcObject = new MediaStream();
                const participantName = document.createElement('div');
                participantName.className = 'participant-name';
                participantName.textContent = `Participant ${remotePeerId.substring(0, 8)}`;
                remoteVideoWrapper.appendChild(remoteVideo);
                remoteVideoWrapper.appendChild(participantName);
                this.videoContainer.appendChild(remoteVideoWrapper);
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' }
                    ]
                });
                // Add local stream tracks to the connection
                (_a = this.localStream) === null || _a === void 0 ? void 0 : _a.getTracks().forEach(track => {
                    pc.addTrack(track, this.localStream);
                });
                // Handle ICE candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        const iceMsg = {
                            type: sharedModels_1.CallMessageType.rtc_ice,
                            data: {
                                toParticipantId: remotePeerId,
                                fromParticipantId: this.participantId,
                                candidate: event.candidate
                            }
                        };
                        this.sendToServer(iceMsg);
                    }
                };
                // Handle remote stream
                pc.ontrack = (event) => {
                    console.log("*** RTCPeerConnection: event", event);
                    if (event.type == "track") {
                        remoteVideo.srcObject.addTrack(event.track);
                    }
                };
                // Save the connection
                this.peerConnections.set(remotePeerId, pc);
                return pc;
            }
            catch (err) {
                console.error('Error creating peer connection:', err);
                return null;
            }
        });
    }
    sendOffer(pc, toParticipantId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create and send offer
            const offer = yield pc.createOffer();
            yield pc.setLocalDescription(offer);
            const offerMsg = {
                type: sharedModels_1.CallMessageType.rtc_offer,
                data: {
                    toParticipantId: toParticipantId,
                    fromParticipantId: this.participantId,
                    sdp: pc.localDescription
                }
            };
            this.sendToServer(offerMsg);
        });
    }
    handleRTCOffer(message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fromParticipantId = message.data.fromParticipantId;
                // Create peer connection if it doesn't exist
                let pc = this.peerConnections.get(fromParticipantId);
                if (!pc) {
                    pc = yield this.createPeerConnection(fromParticipantId);
                    if (!pc) {
                        this.showModal('Peer Connection Error', 'Failed to create peer connection');
                        throw new Error('Failed to create peer connection');
                    }
                }
                // Set remote description
                yield pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
                // Create and send answer
                const answer = yield pc.createAnswer();
                yield pc.setLocalDescription(answer);
                const answerMsg = {
                    type: sharedModels_1.CallMessageType.rtc_answer,
                    data: {
                        toParticipantId: fromParticipantId,
                        fromParticipantId: this.participantId,
                        sdp: pc.localDescription
                    }
                };
                this.sendToServer(answerMsg);
            }
            catch (err) {
                console.error('Error handling offer:', err);
                this.showModal('WebRTC Error', 'Error handling WebRTC offer');
            }
        });
    }
    handleRTCAnswer(message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fromParticipantId = message.data.fromParticipantId;
                const pc = this.peerConnections.get(fromParticipantId);
                if (pc) {
                    yield pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
                }
            }
            catch (err) {
                console.error('Error handling answer:', err);
                this.showModal('WebRTC Error', 'Error handling WebRTC answer');
            }
        });
    }
    handleRTCIce(message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fromParticipantId = message.data.fromParticipantId;
                const pc = this.peerConnections.get(fromParticipantId);
                if (pc) {
                    yield pc.addIceCandidate(new RTCIceCandidate(message.data.candidate));
                }
            }
            catch (err) {
                console.error('Error handling ICE candidate:', err);
                this.showModal('WebRTC Error', 'Error handling ICE candidate');
            }
        });
    }
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.toggleVideoBtn.textContent = videoTrack.enabled ? 'Toggle Video' : 'Show Video';
            }
        }
    }
    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.toggleAudioBtn.textContent = audioTrack.enabled ? 'Toggle Audio' : 'Unmute';
            }
        }
    }
    hangup() {
        if (this.isInCall) {
            const leaveMsg = new sharedModels_1.LeaveMsg();
            leaveMsg.data.conferenceRoomId = this.conferenceRoomId;
            leaveMsg.data.participantId = this.participantId;
            this.sendToServer(leaveMsg);
            this.resetCallState();
        }
    }
}
// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    const app = new ConferenceApp();
    app.init();
});
