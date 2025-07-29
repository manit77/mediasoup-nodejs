import https from 'https';
import { randomUUID } from 'crypto';
import {
    CallMessageType,
    InviteMsg, InviteResultMsg,
    RegisterMsg, RegisterResultMsg, RejectMsg,
    AcceptMsg,
    ConferenceReadyMsg,
    AcceptResultMsg,
    LeaveMsg,
    InviteCancelledMsg,
    CreateConfMsg,
    CreateConfResultMsg,
    JoinConfMsg,
    JoinConfResultMsg,
    ConferenceRoomConfig,
    GetParticipantsResultMsg,
    ParticipantInfo,
    GetConferencesMsg,
    GetConferencesResultMsg,
    ConferenceClosedMsg,
    GetParticipantsMsg,
    ParticipantRole,
    ConferenceScheduledInfo
} from '@conf/conf-models';
import { Conference, IAuthPayload, Participant, SocketConnection } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { jwtSign, jwtVerify } from '../utils/jwtUtil.js';
import { AuthUserRoles, IMsg, RoomConfig } from '@rooms/rooms-models';
import express from 'express';
import { ThirdPartyAPI } from '../thirdParty/thirdPartyAPI.js';
import { getDemoSchedules } from '../demoData/demoData.js';
import { AbstractEventHandler } from '../utils/evenHandler.js';
import { consoleError, consoleLog, consoleWarn } from '../utils/utils.js';

export interface ConferenceServerConfig {
    conf_server_port: number,
    conf_reconnection_timeout: number,
    conf_secret_key: string,
    conf_max_peers_per_conf: number,
    conf_allow_guests: boolean;
    conf_token_expires_min: number,
    conf_callback_urls: {},
    conf_data_access_token: string,
    conf_data_urls: { getScheduledConferencesURL: string, getScheduledConferenceURL: string, loginURL: string },
    conf_socket_timeout_secs: 60,

    room_access_token: string,
    room_servers_uris: string[],

    cert_file_path: string,
    cert_key_path: string,
}

export enum ConferenceServerEventTypes {
    onSendMsg = 'onSendMsg',
}

export class ConferenceServer extends AbstractEventHandler<ConferenceServerEventTypes> {

    participants = new Map<string, Participant>();
    conferences = new Map<string, Conference>();
    config: ConferenceServerConfig;
    nextRoomURIIdx = 0;
    app: express.Express;
    httpServer: https.Server
    thirdParty: ThirdPartyAPI;

    constructor(args: { config: ConferenceServerConfig }) {
        super({ enableLogs: false });

        this.config = args.config;
        this.thirdParty = new ThirdPartyAPI(this.config);
    }

    terminateParticipant(participantId: string) {
        consoleLog(`terminateParticipant`, participantId);

        let participant = this.participants.get(participantId);
        if (participant) {
            // Remove from active participants map
            this.participants.delete(participant.participantId);
            consoleLog(`participant removed`, participant.participantId);

            if (participant.conference) {
                participant.conference.removeParticipant(participant.participantId);
            }

            consoleLog(`participant ${participant.participantId} disconnected. participants: ${this.participants.size} rooms: ${this.conferences.size}`);

            //update contacts
            this.broadCastParticipants(null);
        }
    }

    async handleMsgInWS(participantId: string, msgIn: IMsg) {
        try {

            consoleLog("msgIn: ", msgIn);

            if (!msgIn.type) {
                consoleError("message has no type");
                return;
            }
            let participant = this.participants.get(participantId);

            if (!participant) {
                consoleError(`participant not found.`);
                return;
            }
            let resultMsg: IMsg;

            switch (msgIn.type) {
                case CallMessageType.getParticipants:
                    resultMsg = await this.onGetParticipants(participant, msgIn);
                    break;
                case CallMessageType.getConferences:
                    resultMsg = await this.onGetConferences(participant, msgIn);
                    break;
                case CallMessageType.createConf:
                    resultMsg = await this.onCreateConference(participant, msgIn);
                    break;
                case CallMessageType.joinConf:
                    resultMsg = await this.onJoinConference(participant, msgIn);
                    break;
                case CallMessageType.invite:
                    resultMsg = await this.onInvite(participant, msgIn);
                    break;
                case CallMessageType.inviteCancelled:
                    resultMsg = await this.onInviteCancelled(participant, msgIn);
                    break;
                case CallMessageType.reject:
                    resultMsg = await this.onReject(participant, msgIn);
                    break;
                case CallMessageType.accept:
                    resultMsg = await this.onAccept(participant, msgIn);
                    break;
                case CallMessageType.leave:
                    resultMsg = await this.onLeave(participant, msgIn);
                    break;
            }
            return resultMsg;
        } catch (err) {
            consoleError(err);
        }

    }

    send(partcipant: Participant, msg: any): boolean {
        consoleLog('send ', msg);
        try {
            this.fireEvent(ConferenceServerEventTypes.onSendMsg, partcipant, msg);
            //ws.send(JSON.stringify(msg));
            return true;
        } catch (err) {
            consoleLog(err);
            return false;
        }
    }

    createParticipant(username: string, displayName: string): Participant {

        let part = new Participant();
        part.participantId = "part-" + randomUUID().toString();
        part.displayName = displayName;
        part.username = username;
        this.participants.set(part.participantId, part);
        consoleLog("new participant created " + part.participantId);
        return part;
    }

    getOrCreateConference(conferenceId?: string, externalId?: string, roomName?: string, config?: ConferenceRoomConfig) {

        //find room by tracking id
        let conference: Conference;

        if (externalId) {
            conference = [...this.conferences.values()].find(c => c.externalId === externalId);
            if (conference) {
                consoleLog("conference found by externalId", externalId)
                return conference;
            }
        } else if (conferenceId) {
            conference = [...this.conferences.values()].find(c => c.id === conferenceId);
            if (conference) {
                consoleLog("conference found by externalId", externalId)
                return conference;
            }
        }

        conference = new Conference();
        conference.id = conferenceId ?? this.generateConferenceId();
        conference.externalId = externalId;
        conference.roomName = roomName;
        if (config) {
            conference.config = config;
        }

        if (conference.config.roomTimeoutSecs) {
            conference.timeoutSecs = conference.config.roomTimeoutSecs;
        } else {
            //default timeout is one hour
            conference.timeoutSecs = 60 * 60;
        }

        this.conferences.set(conference.id, conference);

        conference.onClose = (conf: Conference, participants: Participant[], reason: string) => {
            this.conferences.delete(conf.id);
            consoleLog(`conference removed. ${conf.id}`);

            //alert any existing participants the room is closed
            let msgClosed = new ConferenceClosedMsg();
            msgClosed.data.conferenceId = conf.id;
            msgClosed.data.reason = reason;
            participants.forEach(p => this.send(p, msgClosed));

            //broadcast rooms to existing participants
            this.broadCastConferenceRooms();
        };

        consoleLog(`conference created: ${conference.id} ${conference.roomName} `);

        return conference;
    }

    generateConferenceId() {
        return "conf-" + randomUUID().toString();
    }

    /**
     * registers a new peer, we expect the peer to be already authenticated
     * @param ws 
     * @param msgIn 
     */
    async onRegister(msgIn: RegisterMsg): Promise<IMsg> {
        consoleLog("onRegister " + msgIn.data.username);

        if (!msgIn.data.username) {
            consoleError("username is required.");

            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "username is required.";
            return errorMsg;
        }

        if (!msgIn.data.displayName) {
            consoleError("displayName is required.");

            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "displayName is required.";
            return errorMsg;
        }

        if (!msgIn.data.authToken) {
            consoleError("authToken is required.");

            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "authToken is required.";
            return errorMsg;
        }

        //check if user already exists
        let existingParticipant = [...this.participants.values()].find(p => p.username === msgIn.data.username)
        if (existingParticipant) {
            consoleError("username already registered.", existingParticipant.username, existingParticipant.participantId);

            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "username already registered";
            return errorMsg;
        }

        let participant: Participant = this.createParticipant(msgIn.data.username, msgIn.data.username);
        let authTokenObject: IAuthPayload;
        authTokenObject = jwtVerify(this.config.conf_secret_key, msgIn.data.authToken) as IAuthPayload;

        participant.role = authTokenObject.role;

        let msg = new RegisterResultMsg();
        msg.data = {
            username: authTokenObject.username,
            participantId: participant.participantId,
            role: authTokenObject.role ?? ParticipantRole.guest
        };

        this.broadCastParticipants(participant);

        return msg;
    }

    async broadCastParticipants(exceptParticipant?: Participant) {

        console.warn("broadCastParticipants except", exceptParticipant);
        //broadcast to all participants of contacts        
        const allPartsInfo = [...this.participants.values()].map(p => ({
            participantId: p.participantId,
            displayName: p.displayName,
            status: "online"
        }) as ParticipantInfo);

        console.log('allPartsInfo[]', allPartsInfo);

        const allPartsExceptArr = [...this.participants.values()].filter(p => exceptParticipant && p.participantId != exceptParticipant.participantId);
        for (const p of allPartsExceptArr) {
            //do not send the participant info back to self
            const contactsMsg = new GetParticipantsResultMsg();
            contactsMsg.data.participants = allPartsInfo.filter(partInfo => partInfo.participantId != p.participantId);
            console.warn(`send contactsMsg to ${p.displayName}`, contactsMsg);
            this.send(p, contactsMsg);
        }

    }

    async broadCastConferenceRooms() {
        consoleLog("broadCastConferenceRooms");

        let msg = new GetConferencesResultMsg();
        msg.data.conferences = [...this.conferences.values()].filter(c => c.externalId).map(c => {
            let newc = {
                conferenceId: c.id,
                config: c.config,
                description: "",
                externalId: c.externalId,
                name: c.roomName
            } as ConferenceScheduledInfo;

            //remove the conference code
            newc.config.conferenceCode = "";

            return newc;
        });

        for (let [id, p] of this.participants.entries()) {
            this.send(p, msg);
        }
    }

    async onGetParticipants(participant: Participant, msgIn: GetParticipantsMsg): Promise<IMsg | null> {
        consoleLog("onGetParticipants");

        if (!participant) {
            consoleError("participant is required.");
            return;
        }

        if (participant.role === "guest") {
            consoleError("participant must be an authenticated user");
            return;
        }

        let msg = new GetParticipantsResultMsg();
        this.getParticipantsExceptPart(participant).forEach((p) => {
            msg.data.participants.push({
                displayName: p.displayName,
                participantId: p.participantId,
                status: "online"
            });
        });

        return msg;
    }

    getParticipantByConn(connection: SocketConnection) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.connection == connection) {
                return participant;
            }
        }
        return null;
    }

    getParticipant(participantId: string) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.participantId == participantId) {
                return participant;
            }
        }
        return null;
    }

    getParticipantsExceptConn(conn: SocketConnection) {
        return [...this.participants.values()].filter(p => p.connection !== conn);
    }

    getParticipantsExceptPart(part: Participant) {
        return [...this.participants.values()].filter(p => p.participantId !== part.participantId);
    }

    /**
     * invite a peer to a p2p call
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    private async onInvite(participant: Participant, msgIn: InviteMsg) {
        consoleLog("onInvite");

        if (participant.conference) {
            consoleError("caller already in a conference room.");

            let errorMsg = new InviteResultMsg();
            errorMsg.data.conferenceId = participant.conference.id;
            errorMsg.data.error = "already in a conference room.";

            return errorMsg;
        }

        let remote = this.getParticipant(msgIn.data.participantId);
        if (!remote) {
            consoleError("remote participant not found.");

            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party not found.";

            return errorMsg;
        }

        if (remote.conference) {
            consoleError(`receiver is in another conference room. ${remote.conference.id}`);

            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "remote party is on another call.";

            return errorMsg;
        }

        if (participant.participantId === msgIn.data.participantId) {
            consoleError(`cannot invite self`);

            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "invalid participantId.";

            return errorMsg;
        }


        let conference = this.getOrCreateConference();
        conference.confType = "p2p";
        conference.addParticipant(participant);
        conference.minParticipants = 2;
        conference.startTimerMinParticipants(10); //call will timeout if minParticipants not met 

        //forward the call to the receiver
        let msg = new InviteMsg();
        msg.data.participantId = participant.participantId;
        msg.data.displayName = participant.displayName;
        msg.data.conferenceId = conference.id;
        msg.data.conferenceName = conference.roomName;
        msg.data.conferenceExternalId = conference.externalId;
        msg.data.conferenceType = conference.confType;

        if (!this.send(remote, msg)) {
            consoleError("failed to send invite to receiver");
            conference.close("remote peer not available");

            let errorMsg = new InviteResultMsg();
            //send InviteResult back to the caller
            errorMsg.data.conferenceId = conference.id;
            errorMsg.data.error = "invite failed.";

            return errorMsg;
        }

        let inviteResultMsg = new InviteResultMsg();
        //send InviteResult back to the caller
        inviteResultMsg.data.participantId = remote.participantId;
        inviteResultMsg.data.displayName = remote.displayName;
        inviteResultMsg.data.conferenceId = conference.id;
        inviteResultMsg.data.conferenceName = conference.roomName;
        inviteResultMsg.data.conferenceExternalId = conference.externalId;
        inviteResultMsg.data.conferenceType = conference.confType;

        return inviteResultMsg;

    }

    private async onInviteCancelled(participant: Participant, msgIn: InviteCancelledMsg) {
        consoleLog("onInviteCancel");

        let receiver = this.getParticipant(msgIn.data.participantId);
        if (!receiver) {
            consoleError("participant not found.");
            return;
        }

        let conf = this.conferences.get(msgIn.data.conferenceId);
        if (!conf) {
            consoleError("conference not found.");
            return;
        }

        if (participant.conference != conf) {
            consoleError("not the same conference room.");
            return;
        }

        if (conf.participants.size == 1) {
            consoleError("closing conference room");
            conf.close("");
        }

        let resultMsg = new InviteCancelledMsg();
        resultMsg.data.conferenceId = conf.id;
        resultMsg.data.participantId = participant.participantId;

        return resultMsg;
    }

    /**
     * the participant rejected an invite
     * send RejectMsg to remote participant
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    private async onReject(participant: Participant, msgIn: RejectMsg): Promise<IMsg | null> {
        consoleLog("onReject");
        let remoteParticipant = this.getParticipant(msgIn.data.toParticipantId);

        if (!remoteParticipant) {
            consoleError("onReject - remoteParticipant not found or not connected");
            return;
        }

        let conf = this.conferences.get(msgIn.data.conferenceId);
        if (!conf) {
            consoleError("onReject - conference not found.");
            return;
        }

        //the participant is not in the same conference room as the reject message
        if (conf !== remoteParticipant.conference) {
            consoleError("not the same confererence room");
            return;
        }

        //send the reject to the client
        this.send(remoteParticipant, msgIn);

        //the room was p2p, remove the particpant
        if (conf.confType == "p2p") {
            conf.removeParticipant(remoteParticipant.participantId);
        }

    }

    private async onAccept(participant: Participant, msgIn: AcceptMsg) {
        consoleLog("onAccept()");

        let conference = this.conferences.get(msgIn.data.conferenceId);

        if (!conference) {
            consoleError("ERROR: conference room does not exist");
            let msg = new AcceptResultMsg();
            msg.data.conferenceId = msgIn.data.conferenceId;
            msg.data.error = "unable to join conference";
            return msg;
        }

        if (!participant) {
            consoleError("onAccept - participant not found or not connected");
            return;
        }

        if (conference.status == "closed") {
            let msg = new AcceptResultMsg();
            msg.data.conferenceId = msgIn.data.conferenceId;
            msg.data.error = "conference is closed";
            return msg;
        }

        if (conference.status == "ready") {
            this.sendConferenceReady(conference, participant);
            return;
        }

        //wait for ready state
        let timeoutid = setTimeout(() => {
            consoleError("timeout waiting to join conference.");
            let msg = new AcceptResultMsg();
            msg.data.conferenceId = msgIn.data.conferenceId;
            msg.data.error = "timeout, unable to join conference";
            this.send(participant, msg);
        }, 5000);

        conference.addOnReadyListener(() => {
            consoleLog(`conference room ready ${conference.id}`);
            conference.addParticipant(participant);
            clearTimeout(timeoutid);

            //send the answer result back
            let msg = new AcceptResultMsg();
            msg.data.conferenceId = msgIn.data.conferenceId;
            this.send(participant, msg);
        });

        if (conference.status == "none") {
            if (await this.startRoom(conference)) {
                for (let p of conference.participants.values()) {
                    this.sendConferenceReady(conference, p);
                }
            }
        }
    }

    private async onCreateConference(participant: Participant, msgIn: CreateConfMsg) {
        consoleLog("onCreateConference");

        //must be admin or a user
        if (![ParticipantRole.admin, ParticipantRole.user].includes(participant.role as ParticipantRole)) {
            consoleError("participant must be an authenticated user");
            return;
        }

        //tracking id is required
        if (!msgIn.data.conferenceExternalId) {
            consoleError("conferenceExternalId is required.");
            return;
        }

        //get the config from the api endpoint
        let confConfig = msgIn.data.conferenceRoomConfig;
        if (!confConfig) {
            confConfig = new ConferenceRoomConfig();
        }
        let roomName = msgIn.data.roomName;

        if (msgIn.data.conferenceExternalId) {
            //tracking id was passed fetch config from external datasource
            if (this.config.conf_data_urls.getScheduledConferenceURL) {
                let resultMsg = await this.thirdParty.getScheduledConference(msgIn.data.conferenceExternalId, participant.clientData);
                if (resultMsg) {
                    confConfig.conferenceCode = resultMsg.data.conference.config.conferenceCode;
                    confConfig.guestsAllowCamera = resultMsg.data.conference.config.guestsAllowCamera;
                    confConfig.guestsAllowMic = resultMsg.data.conference.config.guestsAllowMic;
                    confConfig.guestsAllowed = resultMsg.data.conference.config.guestsAllowed;
                    confConfig.guestsMax = resultMsg.data.conference.config.guestsMax;
                    confConfig.guestsRequireConferenceCode = resultMsg.data.conference.config.conferenceCode ? true : false;
                    confConfig.roomTimeoutSecs = 0;
                    confConfig.usersMax = 0;

                    roomName = resultMsg.data.conference.name;
                }
            } else {
                //get from demo data                
                let demoSchedule = getDemoSchedules().find(s => s.externalId === msgIn.data.conferenceExternalId);
                if (demoSchedule) {
                    confConfig.conferenceCode = demoSchedule.config.conferenceCode;
                    confConfig.guestsAllowCamera = demoSchedule.config.guestsAllowCamera;
                    confConfig.guestsAllowMic = demoSchedule.config.guestsAllowMic;
                    confConfig.guestsAllowed = demoSchedule.config.guestsAllowed;
                    confConfig.guestsMax = demoSchedule.config.guestsMax;
                    confConfig.guestsRequireConferenceCode = demoSchedule.config.guestsRequireConferenceCode;
                    confConfig.roomTimeoutSecs = 0;
                    confConfig.usersMax = 0;

                    roomName = demoSchedule.name;
                }
            }

            if (participant.role === ParticipantRole.guest) {
                if (confConfig.guestsRequireConferenceCode && confConfig.conferenceCode != msgIn.data.conferenceCode) {
                    consoleError("invalid conference code");
                    let errorMsg = new CreateConfResultMsg();
                    errorMsg.data.error = "invalid conference code.";
                    return errorMsg;
                }
            }

            if (participant.role === ParticipantRole.user) {
                if (confConfig.usersRequireConferenceCode && confConfig.conferenceCode != msgIn.data.conferenceCode) {
                    consoleError("invalid conference code");
                    let errorMsg = new CreateConfResultMsg();
                    errorMsg.data.error = "invalid conference code.";
                    return errorMsg;
                }
            }

        }

        let conference = participant.conference;
        if (conference) {
            consoleLog("conference already created");
        } else {
            conference = this.getOrCreateConference(null, msgIn.data.conferenceExternalId, roomName, confConfig);
            conference.confType = "room";
            if (!await this.startRoom(conference)) {
                consoleError("unable to start a conference");
                let errorMsg = new CreateConfResultMsg();
                errorMsg.data.error = "unable to start the conference.";
                return errorMsg;
            }
        }

        let resultMsg = new CreateConfResultMsg();
        resultMsg.data.conferenceId = conference.id;
        resultMsg.data.externalId = conference.externalId;
        resultMsg.data.roomName = conference.roomName;

        return resultMsg;
    }

    /**
     * triggers when a particpants joins a conference
     * adds a new particpant to the conference
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    private async onJoinConference(participant: Participant, msgIn: JoinConfMsg) {
        consoleLog("onJoinConference");

        //conferenceId or externalId is required
        if (!msgIn.data.conferenceId && !msgIn.data.externalId) {
            consoleError("conferenceId or externalId is required.");

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "invalid room data.";
            return errorMsg;
        }

        //is user is already in a conference room throw an error
        if (participant.conference) {
            consoleError(`already in a conference room: ${participant.conference.id}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "already in a room.";

            return errorMsg;
        }

        let conference: Conference;
        if (msgIn.data.conferenceId) {
            conference = this.conferences.get(msgIn.data.conferenceId);
        } else if (msgIn.data.externalId) {
            conference = [...this.conferences.values()].find(c => c.externalId === msgIn.data.externalId);
        }

        if (!conference) {
            consoleError(`conference room not found ${msgIn.data.conferenceId}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "conference room not found.";
            return errorMsg;
        }

        //conferece must be in ready status
        if (conference.status !== "ready") {
            consoleError(`conference room not ready ${conference.id}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "conference room not ready.";

            return errorMsg;
        }

        //check the role
        if (!conference.config.guestsAllowed && participant.role == ParticipantRole.guest) {
            consoleError(`guests not allowed ${conference.id}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "guests not allowed.";

            return errorMsg;
        }

        //check the conference code
        if (participant.role == "guest" && conference.config.guestsRequireConferenceCode && conference.config.conferenceCode && conference.config.conferenceCode !== msgIn.data.conferenceCode) {
            consoleError(`invalid conference code: ${msgIn.data.conferenceCode}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "invalid conference code";

            return errorMsg;
        }

        if (participant.role == "user" && conference.config.usersRequireConferenceCode && conference.config.conferenceCode && conference.config.conferenceCode !== msgIn.data.conferenceCode) {
            consoleError(`invalid conference code: ${msgIn.data.conferenceCode}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "invalid conference code";

            return errorMsg;
        }

        //check the role
        if (!conference.config.guestsAllowed && ParticipantRole.guest === participant.role) {
            consoleError(`guest not allowed: ${participant.role}`);

            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "unauthorized";

            return errorMsg;
        }

        if (!conference.addParticipant(participant)) {
            let errorMsg = new JoinConfResultMsg();
            errorMsg.data.error = "unable to add you to the conference.";

            return errorMsg;
        }

        //do not send JoinConfResultMsg back, send the ConferenceReadyMsg
        this.sendConferenceReady(conference, participant);

        let resultMsg = new JoinConfResultMsg();
        resultMsg.data.conferenceId = conference.roomId;

        return resultMsg;
    }

    async sendConferenceReady(conference: Conference, participant: Participant) {
        consoleLog("conferenceReady");

        conference.addParticipant(participant);

        //send the room info the participant
        let roomsAPI = new RoomsAPI(conference.roomURI, this.config.room_access_token);

        //create an authtoken per user
        let authUserTokenResult = await roomsAPI.newAuthUserToken(participant.role as any);
        if (!authUserTokenResult || authUserTokenResult?.data?.error) {
            consoleError("failed to create new authUser token in rooms");
            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "error creating conference for user.";
            this.send(participant, errorMsg);
            return null;
        }

        consoleLog("authUserTokenResult", authUserTokenResult);

        let msg = new ConferenceReadyMsg()
        msg.data.conferenceId = conference.id;
        msg.data.conferenceName = conference.roomName;
        msg.data.conferenceExternalId = conference.externalId;
        msg.data.conferenceType = conference.confType;
        msg.data.participantId = participant.participantId;
        msg.data.displayName = participant.displayName;
        msg.data.conferenceRoomConfig = conference.config;

        msg.data.roomId = conference.roomId;
        msg.data.roomToken = conference.roomToken;
        msg.data.roomAuthToken = authUserTokenResult.data.authToken;
        msg.data.roomURI = conference.roomURI;
        msg.data.roomRtpCapabilities = conference.roomRtpCapabilities;

        this.send(participant, msg);
    }

    /**
     * creates a room in the room server
     * @param conference 
     * @returns 
     */
    async startRoom(conference: Conference) {
        consoleLog("startConference");

        if (conference.status != "none") {
            consoleLog("conference already started");
            return true;
        }

        conference.updateStatus("initializing");

        //we have 5 seconds to init a room
        let initTimerId = setTimeout(() => {
            consoleError("new room timeout, closing room");
            conference.close("room timed out");
        }, 5000);

        //caller sent an invite
        //receiver accepted the invite
        //send room ready to both parties
        let roomURI = this.getNextRoomServerURI();
        let roomsAPI = new RoomsAPI(roomURI, this.config.room_access_token);

        let roomTokenResult = await roomsAPI.newRoomToken();
        if (!roomTokenResult || roomTokenResult?.data?.error) {
            consoleError("failed to create new room token");
            clearTimeout(initTimerId);
            conference.close("failed to init new room");
            return false;
        }
        let roomToken = roomTokenResult.data.roomToken;
        let roomId = roomTokenResult.data.roomId;

        let roomConfig = new RoomConfig();
        if (conference.confType == "p2p") {
            roomConfig.maxPeers = 2;
        } else {
            roomConfig.maxPeers = conference.config.guestsMax + conference.config.usersMax;
        }
        roomConfig.maxRoomDurationMinutes = 60; //default to 1 hour.
        if (conference.timeoutSecs > 0) {
            roomConfig.maxRoomDurationMinutes = Math.ceil(conference.timeoutSecs / 60);
        }
        roomConfig.closeRoomOnPeerCount = 0; //close room when there are zero peers after the first peer joins
        roomConfig.timeOutNoParticipantsSecs = 60; //when the room sits idle with zero peers
        roomConfig.guestsAllowMic = conference.config.guestsAllowMic;
        roomConfig.guestsAllowCamera = conference.config.guestsAllowCamera;

        roomConfig.isRecorded = conference.config.isRecorded;

        let roomNewResult = await roomsAPI.newRoom(roomId, roomToken, conference.roomName, conference.id, roomConfig);
        if (!roomNewResult || roomNewResult?.data?.error) {
            consoleError("failed to create new room");

            clearTimeout(initTimerId);
            conference.close("failed to create new room");
            return false;
        }

        conference.roomId = roomId;
        conference.roomToken = roomToken;
        conference.roomURI = roomURI;
        conference.roomRtpCapabilities = roomNewResult.data.roomRtpCapabilities;
        conference.startTimer(); //start timeout timer

        conference.updateStatus("ready");
        clearTimeout(initTimerId);

        await this.broadCastConferenceRooms();
        return true;
    }

    private async onLeave(participant: Participant, msgIn: LeaveMsg): Promise<IMsg | null> {
        consoleLog("onLeave");
        let conf = this.conferences.get(msgIn.data.conferenceId);

        if (!conf) {
            consoleError("conference room not found.");
            return;
        }

        if (!conf.participants.get(participant.participantId)) {
            consoleError(`participant not found. ${participant.participantId}`);
            return;
        }

        conf.removeParticipant(participant.participantId);

        if (conf.confType == "p2p") {
            //if the conference was p2p, close the room if only one participant left
            if (conf.participants.size <= 1) {
                consoleWarn("closing conference room, no participants left.");
                conf.close("room closed.");
                return
            }
        }

        //forward leave to all other participants
        for (let p of conf.participants.values()) {
            let msg = new LeaveMsg();
            msg.data.conferenceId = conf.id;
            msg.data.participantId = participant.participantId;
            this.send(p, msg);
        }
    }

    private async onGetConferences(participant: Participant, msgIn: GetConferencesMsg) {
        consoleLog("onGetConferences");
        let returnMsg = new GetConferencesResultMsg();
        returnMsg.data.conferences = await this.getConferences();
        return returnMsg;
    }

    async getConferences(): Promise<ConferenceScheduledInfo[]> {
        //consoleLog("getConferences");
        return [...this.conferences.values()]
            .map(c => {
                let newc = {
                    conferenceId: c.id,
                    externalId: c.externalId,
                    config: c.config,
                    description: "",
                    name: c.roomName
                } as ConferenceScheduledInfo;

                //hide conference code
                newc.config.conferenceCode = "";

                return newc;
            });
    }

    /**
     * you can load balance the room server using simple round robin
     * @returns url of room server 
     */
    getNextRoomServerURI(): string {
        consoleLog("getNextRoomServerURI");
        let uri = this.config.room_servers_uris[this.nextRoomURIIdx];
        this.nextRoomURIIdx++;
        if (this.nextRoomURIIdx >= this.config.room_servers_uris.length) {
            this.nextRoomURIIdx = 0;
        }
        return uri;
    }

}