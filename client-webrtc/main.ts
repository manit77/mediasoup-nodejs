import {
    CallMessageType,
    RegisterMsg,
    GetContactsMsg,
    JoinMsg,
    LeaveMsg,
    Contact,
    ConferenceClosedMsg,
    ParticipantLeftMsg,
    NewParticipantMsg,
    JoinResultMsg,
    NeedOfferMsg,
    InviteMsg,
    InviteResultMsg,
    RegisterResultMsg
} from './sharedModels';
import { WebSocketManager } from './webSocketManager';

class ConferenceApp {
    private socket: WebSocketManager;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private participantId: string = '';
    private conferenceRoomId: string = '';
    private isInCall: boolean = false;
    private wsURI = 'wss://localhost:3001';

    private confirmCallback: ((accepted: boolean) => void) | null = null;

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
    private hangupBtn: HTMLButtonElement;
    private messageModal: HTMLElement;
    private modalHeader: HTMLElement;
    private modalBody: HTMLElement;
    private modalCloseBtn: HTMLButtonElement;
    private modalConfirmBtn: HTMLButtonElement;
    private modalCancelBtn: HTMLButtonElement;

    private modalNewConference: HTMLDivElement;
    private modalNewConferenceOkButtton: HTMLButtonElement;
    private modalNewConferenceCloseButtton: HTMLButtonElement;

    private modalJoinConference: HTMLDivElement;
    private modalJoinConferenceCancelButton: HTMLButtonElement;

    private newConferenceButton: HTMLButtonElement;
    private joinConferenceButton: HTMLButtonElement;

    constructor() {
        this.initElements();
        this.addEventListeners();
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
        this.hangupBtn = document.getElementById('hangupBtn') as HTMLButtonElement;
        this.messageModal = document.getElementById('messageModal') as HTMLElement;
        this.modalHeader = document.getElementById('modalHeader') as HTMLElement;
        this.modalBody = document.getElementById('modalBody') as HTMLElement;
        this.modalCloseBtn = document.getElementById('modalCloseBtn') as HTMLButtonElement;
        this.modalConfirmBtn = document.getElementById('modalConfirmBtn') as HTMLButtonElement;
        this.modalCancelBtn = document.getElementById('modalCancelBtn') as HTMLButtonElement;

        this.modalNewConference = document.getElementById('confModal') as HTMLDivElement;
        this.modalNewConferenceOkButtton = document.getElementById('confModalCloseBtn') as HTMLButtonElement;
        this.modalNewConferenceCloseButtton = document.getElementById('confModalCancelBtn') as HTMLButtonElement;

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

        this.newConferenceButton.addEventListener("click", () => this.showNewConference());
        this.joinConferenceButton.addEventListener("click", () => this.showJoinConference());

        this.modalNewConferenceOkButtton.addEventListener("click", () => this.hideNewConference());
        this.modalNewConferenceCloseButtton.addEventListener("click", () => this.hideNewConference());

        this.modalJoinConferenceCancelButton.addEventListener("click", () => this.hideJoinConference());

    }

    private showModal(header: string, message: string, isConfirmation: boolean = false, callback?: (accepted: boolean) => void) {
        this.modalHeader.textContent = header;
        this.modalBody.textContent = message;
        this.messageModal.style.display = 'flex';

        if (isConfirmation) {
            this.modalCloseBtn.classList.add('hidden');
            this.modalConfirmBtn.classList.remove('hidden');
            this.modalCancelBtn.classList.remove('hidden');
            this.confirmCallback = callback || null;
        } else {
            this.modalCloseBtn.classList.remove('hidden');
            this.modalConfirmBtn.classList.add('hidden');
            this.modalCancelBtn.classList.add('hidden');
            this.confirmCallback = null;
        }
    }

    private hideModal() {
        this.messageModal.style.display = 'none';
    }

    private showNewConference() {
        console.log("showNewConference");
        this.modalNewConference.style.display = "flex";

    }

    private hideNewConference() {
        console.log("hideNewConference");
        this.modalNewConference.style.display = "none";
    }

    private showJoinConference() {
        console.log("showJoinConference");
        this.modalJoinConference.style.display = "flex";

    }

    private hideJoinConference() {
        console.log("hideJoinConference");
        this.modalJoinConference.style.display = "none";

    }

    public async init() {
        try {
            // Initialize user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            this.localVideo.srcObject = this.localStream;
        } catch (err) {
            console.error('Error accessing media devices:', err);
            this.showModal('Media Error', 'Error accessing camera and microphone. Please check permissions.');
        }
    }

    private login() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.showModal('Input Error', 'Please enter a username');
            return;
        }

        // Connect to WebSocket server
        this.socket = new WebSocketManager();

        this.socket.addEventHandler("onopen", () => {
            this.connectionStatus.textContent = 'Connected';
            this.connectionStatus.classList.add('connected');
            this.connectionStatus.classList.remove('disconnected');

            // Register with the server
            const registerMsg: RegisterMsg = new RegisterMsg();
            registerMsg.data.userName = username;
            this.sendToServer(registerMsg);
        });

        this.socket.addEventHandler("onclose", () => {
            this.connectionStatus.textContent = 'Disconnected';
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
        });

        this.socket.addEventHandler("onerror", (error: any) => {
            console.error('WebSocket Error:', error);
            this.connectionStatus.textContent = 'Connection Error';
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
        });

        this.socket.addEventHandler("onmessage", (event: any) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        });

        this.socket.initialize(this.wsURI, true);
    }

    private sendToServer(message: any) {
        console.log("sendToServer " + message.type, message);
        if (this.socket) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }

    private handleMessage(message: any) {
        console.log('Received message ' + message.type, message);

        switch (message.type) {
            case CallMessageType.registerResult:
                this.handleRegisterResult(message);
                break;
            case CallMessageType.getContacts:
                this.handleContactsReceived(message);
                break;
            case CallMessageType.invite:
                this.handleInviteReceived(message);
                break;
            case CallMessageType.inviteResult:
                this.handleInviteResult(message);
                break;
            case CallMessageType.needOffer:
                this.handleNeedOffer(message);
                break;
            case CallMessageType.joinResult:
                this.handleJoinResult(message);
                break;
            case CallMessageType.newParticipant:
                this.handleNewParticipant(message);
                break;
            case CallMessageType.participantLeft:
                this.handleParticipantLeft(message);
                break;
            case CallMessageType.conferenceClosed:
                this.handleConferenceClosed(message);
                break;
            case CallMessageType.rtc_offer:
                this.handleRTCOffer(message);
                break;
            case CallMessageType.rtc_answer:
                this.handleRTCAnswer(message);
                break;
            case CallMessageType.rtc_ice:
                this.handleRTCIce(message);
                break;
        }
    }

    private handleRegisterResult(message: RegisterResultMsg) {
        if (message.data.error) {
            this.showModal("Login Failed", message.data.error, false);
        } else {
            this.userNameLabel.innerText = message.data.userName;
            this.participantId = message.data.participantId;
            console.log('Registered with participantId:', this.participantId, "conferenceRoomId:", message.data.conferenceRoomId);
            
            // Show main panel and hide login panel
            this.loginPanel.classList.add('hidden');
            this.mainPanel.classList.remove('hidden');

            if(message.data.conferenceRoomId) {
                //we logged into an existing conference
                //rejoin conference?
                this.conferenceRoomId = message.data.conferenceRoomId;
                this.updateUIForCall();
            }

            // Get contacts
            this.getContacts();

        }
    }

    private getContacts() {
        const contactsMsg = {
            type: CallMessageType.getContacts,
            data: {}
        };
        this.sendToServer(contactsMsg);
    }

    private handleContactsReceived(message: GetContactsMsg) {
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

            //disable only if already on a call with the contact
            //callButton.disabled = this.isInCall;

            callButton.addEventListener('click', () => {
                this.callContact(contact);
            });

            li.appendChild(statusIndicator);
            li.appendChild(nameSpan);
            li.appendChild(callButton);

            this.contactsList.appendChild(li);
        });
    }

    private callContact(contact: Contact) {
        const callMsg = new InviteMsg();
        callMsg.data.participantId = contact.participantId;
        this.sendToServer(callMsg);
    }

    private handleInviteReceived(message: any) {
        this.showModal(
            'Incoming Call',
            `Incoming call from ${message.data.displayName}. Accept?`,
            true,
            (accepted: boolean) => {
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

    private handleInviteResult(message: InviteResultMsg) {
        if (message.data.error) {
            this.showModal('Call Error', `Call error: ${message.data.error}`);
            return;
        }

        this.conferenceRoomId = message.data.conferenceRoomId;

        this.isInCall = true;
        this.updateUIForCall();
    }

    private async handleNeedOffer(message: NeedOfferMsg) {
        console.log("handleNeedOffer " + message.data.participantId);
        //server will send need offer to the leader of the conference room
        let pc = await this.createPeerConnection(message.data.participantId);
        if (pc) {
            this.sendOffer(pc, message.data.participantId);
        }
    }

    private async handleJoinResult(message: JoinResultMsg) {
        if (message.data.error) {
            this.showModal('Join Error', `Join error: ${message.data.error}`);
            this.isInCall = false;
            this.updateUIForCall();
            return;
        }

        console.log('Successfully joined conference room:', this.conferenceRoomId);
    }

    private async handleNewParticipant(message: NewParticipantMsg) {
        console.log('New participant joined:', message.data);
    }

    private handleParticipantLeft(message: ParticipantLeftMsg) {
        const participantId = message.data.participantId;
        console.log('Participant left:', participantId);

        // Close peer connection
        if (this.peerConnections.has(participantId)) {
            this.peerConnections.get(participantId)?.close();
            this.peerConnections.delete(participantId);
        }

        // Remove video element
        const videoEl = document.getElementById(`video-${participantId}`);
        if (videoEl) {
            videoEl.parentElement?.remove();
        }
    }

    private handleConferenceClosed(message: ConferenceClosedMsg) {
        this.showModal('Conference Closed', 'The conference has been closed');
        this.resetCallState();
    }

    private resetCallState() {
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

    private updateUIForCall() {
        // Update button states
        this.hangupBtn.disabled = !this.isInCall;

        //Update contact call buttons
        //const callButtons = document.querySelectorAll('.call-btn');
        //callButtons.forEach((btn) => {
        // (btn as HTMLButtonElement).disabled = this.isInCall;
        //});
    }

    private async createPeerConnection(remotePeerId: string): Promise<RTCPeerConnection> {
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
            this.localStream?.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const iceMsg = {
                        type: CallMessageType.rtc_ice,
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
            pc.ontrack = (event: RTCTrackEvent) => {

                console.log("*** RTCPeerConnection: event", event);
                if (event.type == "track") {
                    (remoteVideo.srcObject as MediaStream).addTrack(event.track);
                }

            };

            // Save the connection
            this.peerConnections.set(remotePeerId, pc);


            return pc;
        } catch (err) {
            console.error('Error creating peer connection:', err);
            return null;
        }
    }

    private async sendOffer(pc: RTCPeerConnection, toParticipantId: string) {
        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const offerMsg = {
            type: CallMessageType.rtc_offer,
            data: {
                toParticipantId: toParticipantId,
                fromParticipantId: this.participantId,
                sdp: pc.localDescription
            }
        };
        this.sendToServer(offerMsg);
    }

    private async handleRTCOffer(message: any) {
        try {
            const fromParticipantId = message.data.fromParticipantId;

            // Create peer connection if it doesn't exist
            let pc = this.peerConnections.get(fromParticipantId);
            if (!pc) {
                pc = await this.createPeerConnection(fromParticipantId);
                if (!pc) {
                    this.showModal('Peer Connection Error', 'Failed to create peer connection');
                    throw new Error('Failed to create peer connection');
                }
            }

            // Set remote description
            await pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const answerMsg = {
                type: CallMessageType.rtc_answer,
                data: {
                    toParticipantId: fromParticipantId,
                    fromParticipantId: this.participantId,
                    sdp: pc.localDescription
                }
            };
            this.sendToServer(answerMsg);
        } catch (err) {
            console.error('Error handling offer:', err);
            this.showModal('WebRTC Error', 'Error handling WebRTC offer');
        }
    }

    private async handleRTCAnswer(message: any) {
        try {
            const fromParticipantId = message.data.fromParticipantId;
            const pc = this.peerConnections.get(fromParticipantId);

            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
            }
        } catch (err) {
            console.error('Error handling answer:', err);
            this.showModal('WebRTC Error', 'Error handling WebRTC answer');
        }
    }

    private async handleRTCIce(message: any) {
        try {
            const fromParticipantId = message.data.fromParticipantId;
            const pc = this.peerConnections.get(fromParticipantId);

            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(message.data.candidate));
            }
        } catch (err) {
            console.error('Error handling ICE candidate:', err);
            this.showModal('WebRTC Error', 'Error handling ICE candidate');
        }
    }

    private toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.toggleVideoBtn.textContent = videoTrack.enabled ? 'Toggle Video' : 'Show Video';
            }
        }
    }

    private toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.toggleAudioBtn.textContent = audioTrack.enabled ? 'Toggle Audio' : 'Unmute';
            }
        }
    }

    private hangup() {
        if (this.isInCall) {
            const leaveMsg = new LeaveMsg();
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