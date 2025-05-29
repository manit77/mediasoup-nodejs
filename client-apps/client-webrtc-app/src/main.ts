import { ConferenceCallManager, EventTypes } from "@conf/conf-client";
import {
    Contact,
    ConferenceClosedMsg,
    ParticipantLeftMsg,
    NewParticipantMsg,
    JoinResultMsg,
    InviteMsg,
    InviteResultMsg,
    RegisterResultMsg,
    ConferenceType,
} from "@conf/conf-models";

type confirmCallback = (accepted: boolean) => void;

class ConferenceApp {
    private confMgr = new ConferenceCallManager();
    private get isInCall(): boolean {
        return this.confMgr.isInConference();
    }

    // DOM Elements
    private loginPanel: HTMLElement;
    private mainPanel: HTMLElement;
    private usernameInput: HTMLInputElement;
    private loginBtn: HTMLButtonElement;
    private connectionStatus: HTMLElement;
    private userNameLabel: HTMLDivElement;
    private contactsList: HTMLElement;
    private refreshContactsBtn: HTMLElement;
    private localVideo: HTMLVideoElement;
    private videoContainer: HTMLElement;
    private toggleVideoBtn: HTMLElement;
    private toggleAudioBtn: HTMLElement;

    //conference controls
    private hangupBtn: HTMLButtonElement;

    //confirm modal
    private messageModal: HTMLElement;
    private modalHeader: HTMLElement;
    private modalBody: HTMLElement;
    private modalConfirmBtn: HTMLButtonElement;
    private modalCancelBtn: HTMLButtonElement;

    confModal: HTMLDivElement;
    confModalOkBtn: HTMLButtonElement;
    confModalCancelBtn: HTMLButtonElement;

    private modalJoinConference: HTMLDivElement;
    private modalJoinConferenceCancelButton: HTMLButtonElement;

    private newConferenceButton: HTMLButtonElement;
    private joinConferenceButton: HTMLButtonElement;

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
        this.initElements();
        this.addEventListeners();

        this.confMgr.onEvent = (eventType: EventTypes, msg?: any) => {
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
                } case EventTypes.joinResult: {
                    this.handleJoinResult(msg);
                    break;
                } case EventTypes.inviteResult: {
                    this.handleInviteResult(msg);
                    break;
                } case EventTypes.newParticipant: {
                    this.handleNewParticipant(msg);
                    break;
                } case EventTypes.participantLeft: {
                    this.handleParticipantLeft(msg);
                    break;
                } case EventTypes.rejectReceived: {
                    this.handleRejectReceived(msg);
                    break;
                } case EventTypes.confClosed: {
                    this.handleConferenceClosed(msg);
                    break;
                }
            }
        };

    }

    public async init() {
        let uri = `${window.location.protocol == "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port}`
        //client is responsible for getting the local stream
        //client is responsible for connecting
        this.confMgr.getUserMedia();
        this.confMgr.connect(true, uri);
    }

    private initElements() {
        this.loginPanel = document.getElementById('loginPanel') as HTMLElement;
        this.mainPanel = document.getElementById('mainPanel') as HTMLElement;
        this.usernameInput = document.getElementById('username') as HTMLInputElement;
        this.loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
        this.connectionStatus = document.getElementById('connectionStatus') as HTMLElement;
        this.userNameLabel = document.getElementById('userNameLabel') as HTMLDivElement;
        this.contactsList = document.getElementById('contactsList') as HTMLElement;
        this.refreshContactsBtn = document.getElementById('refreshContactsBtn') as HTMLElement;
        this.localVideo = document.getElementById('localVideo') as HTMLVideoElement;
        this.videoContainer = document.getElementById('videoContainer') as HTMLElement;
        this.toggleVideoBtn = document.getElementById('toggleVideoBtn') as HTMLElement;
        this.toggleAudioBtn = document.getElementById('toggleAudioBtn') as HTMLElement;

        //conference controls
        this.hangupBtn = document.getElementById('hangupBtn') as HTMLButtonElement;

        this.messageModal = document.getElementById('messageModal') as HTMLElement;
        this.modalHeader = document.getElementById('modalHeader') as HTMLElement;
        this.modalBody = document.getElementById('modalBody') as HTMLElement;
        this.modalConfirmBtn = document.getElementById('modalConfirmBtn') as HTMLButtonElement;
        this.modalCancelBtn = document.getElementById('modalCancelBtn') as HTMLButtonElement;

        this.confModal = document.getElementById('confModal') as HTMLDivElement;
        this.confModalOkBtn = document.getElementById('confModalOkBtn') as HTMLButtonElement;
        this.confModalCancelBtn = document.getElementById('confModalCancelBtn') as HTMLButtonElement;

        this.modalJoinConference = document.getElementById('confJoinModal') as HTMLDivElement;
        this.modalJoinConferenceCancelButton = document.getElementById('confJoinModalCancelButton') as HTMLButtonElement;

        this.newConferenceButton = document.getElementById('newConferenceButton') as HTMLButtonElement;
        this.joinConferenceButton = document.getElementById('joinConferenceButton') as HTMLButtonElement;

    }

    private addEventListeners() {
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

    private async initLocalMedia() {
        this.localVideo.srcObject = await this.confMgr.getUserMedia();
    }

    private login() {

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

    private showModal(header: string, message: string, callback?: (accepted: boolean) => void) {
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
        }

        this.modalConfirmBtn.addEventListener("click", clickOk);
        this.modalCancelBtn.addEventListener("click", clickCancel);


    }

    private hideModal() {
        this.messageModal.style.display = 'none';
    }

    private confModalShow() {
        console.log("showNewConference");
        this.confModal.style.display = "flex";
    }

    private confModalHide() {
        console.log("hideNewConference");
        this.confModal.style.display = "none";
    }

    private showJoinConference() {
        console.log("showJoinConference");
        this.modalJoinConference.style.display = "flex";

    }

    private hideJoinConference() {
        console.log("hideJoinConference");
        this.modalJoinConference.style.display = "none";
    }

    private handleRegisterResult(msg: RegisterResultMsg) {
        if (msg.data.error) {
            this.showModal("Login Failed", msg.data.error);
        } else {

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

    private getContacts() {
        this.confMgr.getContacts();
    }

    private handleContactsReceived(contacts: Contact[]) {
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
    private callContact(contact: Contact) {
        this.confMgr.invite(contact.participantId, ConferenceType.p2p, 2);
    }

    private handleInviteReceived(msg: InviteMsg) {
        console.log("handleInviteReceived");

        this.showModal(
            'Incoming Call',
            `Incoming call from ${msg.data.displayName}. Accept?`,
            (accepted: boolean) => {
                if (accepted) {
                    this.confMgr.acceptInvite(msg);
                } else {
                    this.confMgr.reject(msg);
                }
                this.updateUIForCall();
            }
        );
    }

    private handleRejectReceived(msg: InviteResultMsg) {
        console.log("handleRejectReceived");

        //caller makes call
        //receiver rejects call

        //does the caller exit the meeting?
    }

    private handleInviteResult(msg: InviteResultMsg) {
        if (msg.data.error) {
            this.showModal('Call Error', `Call error: ${msg.data.error}`);
            return;
        }
        this.updateUIForCall();
    }

    private async handleJoinResult(msg: JoinResultMsg) {
        console.log("handleJoinResult()");
        if (msg.data.error) {
            this.showModal('Join Error', `Join error: ${msg.data.error}`);
            return;
        }

        this.confMgr.conferenceRoom.conferenceRoomId = msg.data.conferenceRoomId;
        console.log('handleJoinResult() - joined conference room:', this.confMgr.conferenceRoom.conferenceRoomId);
        this.updateUIForCall();

    }

    private async handleNewParticipant(msg: NewParticipantMsg) {
        console.log('handleNewParticipant:', msg.data);
        this.createVideoElement(msg.data.participantId, msg.data.displayName);
    }

    private handleParticipantLeft(msg: ParticipantLeftMsg) {
        console.log('handleParticipantLeft:', msg.data);
        const participantId = msg.data.participantId;
        console.log('Participant left:', participantId);
        this.removeVideoElement(participantId);
    }

    private handleConferenceClosed(msg: ConferenceClosedMsg) {
        this.showModal('Conference Closed', 'The conference has been closed');
        this.resetCallState();
    }

    /**
     * leave the conference, remove all videos
     */
    private resetCallState() {
        this.confMgr.leave();

        // Remove all remote videos
        const remoteVideos = document.querySelectorAll('.remote-video-wrapper');
        remoteVideos.forEach((videoEl) => {
            videoEl.remove();
        });

        this.updateUIForCall();

    }

    private updateUIForCall() {
        // Update button states
        this.hangupBtn.disabled = !this.isInCall;
    }

    private createVideoElement(remotePeerId: string, displayName: string): HTMLVideoElement {
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

    private removeVideoElement(remotePeerId: string) {

        let id = `video-${remotePeerId}`;
        const remoteVideo = document.getElementById(id);
        const remoteVideoWrapper = remoteVideo.parentElement;
        remoteVideoWrapper.remove();

    }

    private toggleVideo() {
        this.confMgr.toggleVideo();
    }

    private toggleAudio() {
        this.confMgr.toggleAudio();
    }

    private hangupBtn_Click() {
        this.resetCallState();
    }

}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    const app = new ConferenceApp();
    app.init();
});