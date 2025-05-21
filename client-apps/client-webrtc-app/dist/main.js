import { ConferenceCallManager, EventTypes } from "@conf/conf-client";
class ConferenceApp {
    get isInCall() {
        return this.confMgr.isInConference();
    }
    //  <div class="modal" id="confModal">
    //     <div class="modal-content">
    //         <div class="modal-header" id="confModalHeader">New Conference</div>
    //         <div class="modal-body">
    //             Title: <input id="confConfRoomTitle" type="text"><br>
    //             Date Start: <input id="confDateStartText" type="date"><br>
    //             Date End: <input id="confDateEndText" type="date"><br>
    //             Max Participants: <input id="confDateEndText" type="number" value="2"><br>
    //             Allow Conference Video: <input type="checkbox"> <br>
    //             Allow Conference Audio : <input type="checkbox"> <br>
    //             Allow Participant Video: <input type="checkbox"> <br>
    //             Allow Particpant Audio: <input type="checkbox"> <br>
    //             Invite Only: <input type="checkbox"> <br>
    //         </div>
    //         <div class="modal-footer">
    //             <button class="modal-close-btn" id="confModalOkBtn">OK</button>
    //             <button class="modal-close-btn" id="confModalCancelBtn">Cancel</button>
    //         </div>
    //     </div>
    // </div>
    constructor() {
        this.confMgr = new ConferenceCallManager();
        this.initElements();
        this.addEventListeners();
        this.confMgr.onEvent = (eventType, msg) => {
            console.log("Client App EventType: " + eventType, msg);
            switch (eventType) {
                case EventTypes.connected: {
                    this.connectionStatus.textContent = 'Connected';
                    this.connectionStatus.classList.add('connected');
                    this.connectionStatus.classList.remove('disconnected');
                    break;
                }
                case EventTypes.disconnected: {
                    this.connectionStatus.textContent = 'Disconnected';
                    this.connectionStatus.classList.remove('connected');
                    this.connectionStatus.classList.add('disconnected');
                    break;
                }
                case EventTypes.registerResult: {
                    this.handleRegisterResult(msg);
                    break;
                }
                case EventTypes.contactsReceived: {
                    this.handleContactsReceived(msg);
                    break;
                }
                case EventTypes.inviteReceived: {
                    this.handleInviteReceived(msg);
                    break;
                }
                case EventTypes.joinResult: {
                    this.handleJoinResult(msg);
                    break;
                }
                case EventTypes.inviteResult: {
                    this.handleInviteResult(msg);
                    break;
                }
                case EventTypes.newParticipant: {
                    this.handleNewParticipant(msg);
                    break;
                }
                case EventTypes.participantLeft: {
                    this.handleParticipantLeft(msg);
                    break;
                }
                case EventTypes.rejectReceived: {
                    this.handleRejectReceived(msg);
                    break;
                }
                case EventTypes.confClosed: {
                    this.handleConferenceClosed(msg);
                    break;
                }
            }
        };
    }
    async init() {
        let uri = `${window.location.protocol == "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port}`;
        //client is responsible for getting the local stream
        //client is responsible for connecting
        this.confMgr.getUserMedia();
        this.confMgr.connect(true, uri);
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
        this.confModal = document.getElementById('confModal');
        this.confModalOkBtn = document.getElementById('confModalOkBtn');
        this.confModalCancelBtn = document.getElementById('confModalCancelBtn');
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
        this.newConferenceButton.addEventListener("click", () => this.confModalShow());
        this.joinConferenceButton.addEventListener("click", () => this.showJoinConference());
        this.confModalOkBtn.addEventListener("click", () => {
            this.confModalHide();
        });
        this.confModalCancelBtn.addEventListener("click", () => this.confModalHide());
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
    confModalShow() {
        console.log("showNewConference");
        this.confModal.style.display = "flex";
    }
    confModalHide() {
        console.log("hideNewConference");
        this.confModal.style.display = "none";
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
                this.callContact(contact);
            });
            li.appendChild(statusIndicator);
            li.appendChild(nameSpan);
            li.appendChild(callButton);
            this.contactsList.appendChild(li);
        });
    }
    /**
     * this will initiate a webrtc call
     * @param contact
     */
    callContact(contact) {
        this.confMgr.invite(contact);
    }
    handleInviteReceived(msg) {
        console.log("handleInviteReceived");
        this.showModal('Incoming Call', `Incoming call from ${msg.data.displayName}. Accept?`, (accepted) => {
            if (accepted) {
                this.confMgr.acceptInvite(msg);
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
    async handleJoinResult(msg) {
        console.log("handleJoinResult()");
        if (msg.data.error) {
            this.showModal('Join Error', `Join error: ${msg.data.error}`);
            return;
        }
        this.confMgr.conferenceRoom.conferenceRoomId = msg.data.conferenceRoomId;
        console.log('handleJoinResult() - joined conference room:', this.confMgr.conferenceRoom.conferenceRoomId);
        this.updateUIForCall();
    }
    async handleNewParticipant(msg) {
        console.log('handleNewParticipant:', msg.data);
        this.createVideoElement(msg.data.participantId, msg.data.displayName);
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
        console.log("createVideoElement() ", remotePeerId);
        if (!remotePeerId) {
            console.error("remotePeerId is required.");
            return;
        }
        let participant = this.confMgr.getParticipant(remotePeerId);
        if (!participant) {
            console.error("participant not found.", remotePeerId);
            return;
        }
        const remoteVideoWrapper = document.createElement('div');
        remoteVideoWrapper.className = 'video-wrapper remote-video-wrapper';
        const remoteVideo = document.createElement('video');
        remoteVideo.id = `video-${remotePeerId}`;
        remoteVideo.className = 'remote-video';
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        if (participant.mediaStream) {
            remoteVideo.srcObject = participant.mediaStream;
        }
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
