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
const conferenceCallManager_1 = require("./common/conferenceCallManager");
class ConferenceApp {
    get isInCall() {
        return this.confMgr.isInConference();
    }
    get isConnected() {
        return this.confMgr.isConnected;
    }
    constructor() {
        this.confMgr = new conferenceCallManager_1.ConferenceCallManager();
        this.initElements();
        this.addEventListeners();
        this.confMgr.onEvent = (eventType, msg) => {
            console.log("Client App EventType: " + eventType, msg);
            switch (eventType) {
                case "connected" /* EventTypes.connected */: {
                    this.connectionStatus.textContent = 'Connected';
                    this.connectionStatus.classList.add('connected');
                    this.connectionStatus.classList.remove('disconnected');
                    break;
                }
                case "disconnected" /* EventTypes.disconnected */: {
                    this.connectionStatus.textContent = 'Disconnected';
                    this.connectionStatus.classList.remove('connected');
                    this.connectionStatus.classList.add('disconnected');
                    break;
                }
                case "registerResult" /* EventTypes.registerResult */: {
                    this.handleRegisterResult(msg);
                    break;
                }
                case "contactsReceived" /* EventTypes.contactsReceived */: {
                    this.handleContactsReceived(msg);
                    break;
                }
                case "inviteReceived" /* EventTypes.inviteReceived */: {
                    this.handleInviteReceived(msg);
                    break;
                }
                case "joinResult" /* EventTypes.joinResult */: {
                    this.handleJoinResult(msg);
                    break;
                }
                case "inviteResult" /* EventTypes.inviteResult */: {
                    this.handleInviteResult(msg);
                    break;
                }
                case "newParticipant" /* EventTypes.newParticipant */: {
                    this.handleNewParticipant(msg);
                    break;
                }
                case "participantLeft" /* EventTypes.participantLeft */: {
                    this.handleParticipantLeft(msg);
                    break;
                }
                case "rejectReceived" /* EventTypes.rejectReceived */: {
                    this.handleRejectReceived(msg);
                    break;
                }
                case "confClosed" /* EventTypes.confClosed */: {
                    this.handleConferenceClosed(msg);
                    break;
                }
            }
        };
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            let uri = `${window.location.protocol == "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port}`;
            this.confMgr.connect(true, uri);
        });
    }
    initElements() {
        this.loginPanel = document.getElementById('loginPanel');
        this.mainPanel = document.getElementById('mainPanel');
        this.usernameInput = document.getElementById('username');
        this.loginBtn = document.getElementById('loginBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.userNameLabel = document.getElementById('userNameLabel');
        this.contactsList = document.getElementById('contactsList');
        this.refreshContactsBtn = document.getElementById('refreshContactsBtn');
        this.localVideo = document.getElementById('localVideo');
        this.videoContainer = document.getElementById('videoContainer');
        this.toggleVideoBtn = document.getElementById('toggleVideoBtn');
        this.toggleAudioBtn = document.getElementById('toggleAudioBtn');
        //conference controls
        this.hangupBtn = document.getElementById('hangupBtn');
        this.messageModal = document.getElementById('messageModal');
        this.modalHeader = document.getElementById('modalHeader');
        this.modalBody = document.getElementById('modalBody');
        this.modalConfirmBtn = document.getElementById('modalConfirmBtn');
        this.modalCancelBtn = document.getElementById('modalCancelBtn');
        this.modalNewConference = document.getElementById('confModal');
        this.modalNewConferenceOkButtton = document.getElementById('confModalCloseBtn');
        this.modalNewConferenceCloseButtton = document.getElementById('confModalCancelBtn');
        this.modalJoinConference = document.getElementById('confJoinModal');
        this.modalJoinConferenceCancelButton = document.getElementById('confJoinModalCancelButton');
        this.newConferenceButton = document.getElementById('newConferenceButton');
        this.joinConferenceButton = document.getElementById('joinConferenceButton');
    }
    addEventListeners() {
        console.log("addEventListeners");
        this.loginBtn.addEventListener('click', () => this.login());
        this.refreshContactsBtn.addEventListener('click', () => this.getContacts());
        this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.hangupBtn.addEventListener('click', () => this.hangupBtn_Click());
        //modal controls
        this.modalCancelBtn.addEventListener('click', () => this.hideModal());
        this.newConferenceButton.addEventListener("click", () => this.showNewConference());
        this.joinConferenceButton.addEventListener("click", () => this.showJoinConference());
        this.modalNewConferenceOkButtton.addEventListener("click", () => this.hideNewConference());
        this.modalNewConferenceCloseButtton.addEventListener("click", () => this.hideNewConference());
        this.modalJoinConferenceCancelButton.addEventListener("click", () => this.hideJoinConference());
    }
    initLocalMedia() {
        return __awaiter(this, void 0, void 0, function* () {
            this.localVideo.srcObject = yield this.confMgr.getUserMedia();
        });
    }
    login() {
        if (!this.confMgr.isConnected) {
            this.showModal("No connected", "server is not connected.");
            return;
        }
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.showModal('Input Error', 'Please enter a username');
            return;
        }
        this.confMgr.register(username);
    }
    showModal(header, message, callback) {
        console.log("showModal", header);
        this.modalHeader.textContent = header;
        this.modalBody.textContent = message;
        this.messageModal.style.display = 'flex';
        let clickOk = () => {
            if (callback) {
                callback(true);
            }
            this.hideModal();
            // Remove event listeners after action
            this.modalConfirmBtn.removeEventListener("click", clickOk);
            this.modalCancelBtn.removeEventListener("click", clickCancel);
        };
        let clickCancel = () => {
            if (callback) {
                callback(false);
            }
            this.hideModal();
            // Remove event listeners after action
            this.modalConfirmBtn.removeEventListener("click", clickOk);
            this.modalCancelBtn.removeEventListener("click", clickCancel);
        };
        this.modalConfirmBtn.addEventListener("click", clickOk);
        this.modalCancelBtn.addEventListener("click", clickCancel);
    }
    hideModal() {
        this.messageModal.style.display = 'none';
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
        }
        else {
            this.initLocalMedia();
            this.userNameLabel.innerText = msg.data.userName;
            // Show main panel and hide login panel
            this.loginPanel.classList.add('hidden');
            this.mainPanel.classList.remove('hidden');
            if (msg.data.conferenceRoomId) {
                //we logged into an existing conference
                //rejoin conference?                
                this.updateUIForCall();
            }
            // Get contacts
            this.getContacts();
        }
    }
    getContacts() {
        this.confMgr.getContacts();
    }
    handleContactsReceived(contacts) {
        console.log("handleContactsReceived", contacts);
        // Clear existing contacts
        this.contactsList.innerHTML = '';
        // Add new contacts
        contacts.forEach((contact) => {
            const li = document.createElement('li');
            li.className = 'contact-item';
            const statusIndicator = document.createElement('span');
            statusIndicator.className = `status-indicator ${contact.status}`;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = contact.displayName || `User ${contact.participantId.substring(0, 8)}`;
            const callButton = document.createElement('button');
            callButton.textContent = 'Call';
            callButton.className = 'call-btn';
            callButton.addEventListener('click', () => {
                this.contactClick(contact);
            });
            li.appendChild(statusIndicator);
            li.appendChild(nameSpan);
            li.appendChild(callButton);
            this.contactsList.appendChild(li);
        });
    }

    contactClick(contact) {
        this.confMgr.invite(contact);
    }

    handleInviteReceived(msg) {
        console.log("handleInviteReceived");
        this.showModal('Incoming Call', `Incoming call from ${msg.data.displayName}. Accept?`, (accepted) => {
            if (accepted) {
                this.confMgr.join(msg.data.conferenceRoomId);
            }
            else {
                this.confMgr.reject(msg.data.participantId, msg.data.conferenceRoomId);
            }
            this.updateUIForCall();
        });
    }
    handleRejectReceived(msg) {
        console.log("handleRejectReceived");
        //caller makes call
        //receiver rejects call
        //does the caller exit the meeting?
    }
    handleInviteResult(msg) {
        if (msg.data.error) {
            this.showModal('Call Error', `Call error: ${msg.data.error}`);
            return;
        }
        this.updateUIForCall();
    }
    handleJoinResult(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("handleJoinResult");
            if (msg.data.error) {
                this.showModal('Join Error', `Join error: ${msg.data.error}`);
                return;
            }
            this.confMgr.conferenceRoom.conferenceRoomId = msg.data.conferenceRoomId;
            console.log('joined conference room:', this.confMgr.conferenceRoom.conferenceRoomId);
            this.updateUIForCall();
        });
    }
    handleNewParticipant(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('handleNewParticipant:', msg.data);
            this.createVideoElement(msg.data.participantId, msg.data.displayName);
        });
    }
    handleParticipantLeft(msg) {
        console.log('handleParticipantLeft:', msg.data);
        const participantId = msg.data.participantId;
        console.log('Participant left:', participantId);
        this.removeVideoElement(participantId);
    }
    handleConferenceClosed(msg) {
        this.showModal('Conference Closed', 'The conference has been closed');
        this.resetCallState();
    }
    /**
     * leave the conference, remove all videos
     */
    resetCallState() {
        this.confMgr.leave();
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
    }
    createVideoElement(remotePeerId, displayName) {
        console.log("createVideoElement");
        if (!remotePeerId) {
            console.error("remotePeerId is required.");
            return;
        }
        let participant = this.confMgr.getParticipant(remotePeerId);
        const remoteVideoWrapper = document.createElement('div');
        remoteVideoWrapper.className = 'video-wrapper remote-video-wrapper';
        const remoteVideo = document.createElement('video');
        remoteVideo.id = `video-${remotePeerId}`;
        remoteVideo.className = 'remote-video';
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.srcObject = participant.mediaStream;
        const participantName = document.createElement('div');
        participantName.className = 'participant-name';
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
}
// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    const app = new ConferenceApp();
    app.init();
});
