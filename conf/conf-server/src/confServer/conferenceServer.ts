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
    ConferenceConfig,
    GetParticipantsResultMsg,
    ParticipantInfo,
    GetConferencesMsg,
    GetConferencesResultMsg,
    ConferenceClosedMsg,
    GetParticipantsMsg,
    ParticipantRole,
    ConferenceScheduledInfo,
    PresenterInfoMsg,
    conferenceType,
    LoggedOffMsg,
    TerminateConfMsg
} from '@conf/conf-models';
import { Conference, IAuthPayload, Participant, SocketConnection } from '../models/models.js';
import { RoomsAPI } from '../roomsAPI/roomsAPI.js';
import { jwtVerify } from '../utils/jwtUtil.js';
import { AuthUserRoles, IMsg, OkMsg, payloadTypeServer, RoomConfig } from '@rooms/rooms-models';
import express from 'express';
import { ThirdPartyAPI } from '../thirdParty/thirdPartyAPI.js';
import { getDemoSchedules } from '../demoData/demoData.js';
import { AbstractEventHandler } from '../utils/evenHandler.js';
import { consoleError, consoleLog, consoleWarn, copyWithDataParsing, fill, parseString, stringIsNullOrEmpty } from '../utils/utils.js';
import pkg_lodash from 'lodash';
import { ConferenceServerConfig, ConferenceServerEventTypes } from './models.js';
const { clone } = pkg_lodash;

export class ConferenceServer extends AbstractEventHandler<ConferenceServerEventTypes> {

    participants = new Map<string, Participant>();
    conferences = new Map<string, Conference>();
    config: ConferenceServerConfig;
    nextRoomURIIdx = 0;
    app: express.Express;
    httpServer: https.Server
    thirdParty: ThirdPartyAPI;
    dateCreated = new Date();

    constructor(args: { config: ConferenceServerConfig }) {
        super({ enableLogs: false });

        this.config = args.config;
        this.thirdParty = new ThirdPartyAPI(this.config);
        this.printStats();
    }

    printStats() {
        consoleWarn(`#### Conference Server Stats ####`);
        consoleWarn(`dateCreated: ${this.dateCreated}`);
        consoleWarn(`Conferences: `, this.conferences.size);
        this.conferences.forEach(c => consoleWarn(`roomName: ${c.roomName}, dateCreated: ${c.dateCreated}, id: ${c.id}`));
        consoleWarn(`Participants: `, this.participants.size);
        this.participants.forEach(p => consoleWarn(`displayName: ${p.displayName}, dateCreated: ${p.dateCreated}, id: ${p.participantId}`));
        consoleWarn(`#################################`);

        setTimeout(() => {
            this.printStats();
        }, 30000);
    }


    terminateParticipant(participantId: string) {
        consoleWarn(`terminateParticipant`, participantId);

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
            this.broadCastParticipants(participant.participantGroup);
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
            let resultMsg: IMsg | null | undefined;

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
                case CallMessageType.presenterInfo:
                    resultMsg = await this.onPresenterInfo(participant, msgIn);
                    break;
                case CallMessageType.terminateConf:
                    resultMsg = await this.onTerminateConf(participant, msgIn);
                    break;

            }
            return resultMsg;
        } catch (err) {
            consoleError(err);
        }

    }

    send(participant: Participant, msg: any): boolean {
        consoleLog('send ', msg);
        try {
            this.fireEvent(ConferenceServerEventTypes.onSendMsg, participant, msg);
            //ws.send(JSON.stringify(msg));
            return true;
        } catch (err) {
            consoleLog(err);
            return false;
        }
    }

    createParticipant(username: string, displayName: string, participantGroup: string): Participant {

        let part = new Participant();
        part.participantId = "part-" + randomUUID().toString();
        part.displayName = displayName;
        part.username = username;
        part.participantGroup = participantGroup;
        this.participants.set(part.participantId, part);
        consoleLog("new participant created " + part.participantId);
        return part;
    }

    getOrCreateConference(args: {
        confType: conferenceType,
        participantGroup: string,
        minParticipants?: number,
        minParticipantsTimeoutSec?: number,
        noUserTimeoutSec?: number,
        conferenceId?: string,
        externalId?: string,
        roomName: string,
        leader?: Participant,
        config?: ConferenceConfig
    }) {

        //find room by tracking id
        let conference: Conference;

        if (args.externalId) {
            conference = [...this.conferences.values()].find(c => c.externalId === args.externalId);
        }

        if (!conference && args.conferenceId) {
            conference = [...this.conferences.values()].find(c => c.id === args.conferenceId);
        }

        //existing room found
        if (conference) {
            consoleLog("conference found by externalId", args.externalId);
            //first part that creates the conference is the leader
            if (!conference.leader) {
                conference.leader = args.leader;
            }
          
            return conference;
        }


        conference = new Conference();
        conference.id = stringIsNullOrEmpty(args.conferenceId) ? this.generateConferenceId() : args.conferenceId;
        conference.externalId = args.externalId ?? "";
        conference.roomName = args.roomName ?? "";
        conference.minParticipants = args.minParticipants ?? conference.minParticipants;
        conference.minParticipantsTimeoutSec = args.minParticipantsTimeoutSec ?? conference.minParticipantsTimeoutSec;
        conference.participantGroup = args.participantGroup ?? "";
        conference.confType = args.confType;

        conference.leader = args.leader;        

        //copy the configs from the args to the conference
        if (args.config) {
            fill(args.config, conference.config);
        }
     

        conference.timeoutSecs = conference.config.roomTimeoutSecs ?? conference.timeoutSecs;
        conference.noUserTimeoutSec = args.noUserTimeoutSec ?? conference.noUserTimeoutSec;

        this.conferences.set(conference.id, conference);

        conference.onClose = (conf: Conference, participants: Participant[], reason: string) => {
            this.conferences.delete(conf.id);
            consoleWarn(`conference removed. ${conf.id}, existing participants ${participants.length}`);

            //alert any existing participants the room is closed
            let msgClosed = new ConferenceClosedMsg();
            msgClosed.data.conferenceId = conf.id;
            msgClosed.data.reason = reason;

            participants.forEach(p => {
                consoleWarn(`send close to part ${p.displayName}`);
                this.send(p, msgClosed);
            });

            //broadcast rooms to existing participants
            this.broadCastConferenceRooms(conf.participantGroup);

            this.taskCloseRoom(conf.roomId, conf.roomURI);
        };

        consoleLog(`conference created: ${conference.id} ${conference.roomName} `);

        //start timers
        conference.startTimers();

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
        msgIn = fill(msgIn, new RegisterMsg());

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

            //if in conference
            if (existingParticipant.conference) {
                let errorMsg = new RegisterResultMsg();
                errorMsg.data.error = "already logged in from another location.";
                return errorMsg;
            }

            //if not in conference, logoff and terminate the connection

            //send log off to participant
            let loggedOffMsg = new LoggedOffMsg();
            loggedOffMsg.data.reason = "Logged in from another location.";
            this.send(existingParticipant, loggedOffMsg);

            this.terminateParticipant(existingParticipant.participantId);
        }

        
        if (this.config.conf_require_participant_group && !msgIn.data.participantGroup) {
            let errorMsg = new RegisterResultMsg();
            errorMsg.data.error = "participant group is required.";
            return errorMsg;
        }

        let participant: Participant = this.createParticipant(msgIn.data.username, msgIn.data.username, msgIn.data.participantGroup);
        participant.clientData = msgIn.data.clientData;

        let authTokenObject: IAuthPayload;
        authTokenObject = jwtVerify(this.config.conf_secret_key, msgIn.data.authToken) as IAuthPayload;

        participant.role = authTokenObject.role;

        let msg = new RegisterResultMsg();
        msg.data = {
            username: authTokenObject.username,
            participantId: participant.participantId,
            role: stringIsNullOrEmpty(authTokenObject.role) ? ParticipantRole.guest : authTokenObject.role
        };

        this.broadCastParticipantsExcept(participant);

        return msg;
    }

    async broadCastParticipantsExcept(exceptParticipant: Participant) {

        console.log("broadCastParticipants except", exceptParticipant);
        //broadcast to all participants of contacts        
        const allPartsInfo = [...this.participants.values()].filter(p => p.participantGroup === exceptParticipant.participantGroup).map(p => ({
            participantId: p.participantId,
            displayName: p.displayName,
            status: "online"
        }) as ParticipantInfo);

        console.log('allPartsInfo[]', allPartsInfo);

        const allPartsExceptArr = [...this.participants.values()].filter(p => p.participantGroup === exceptParticipant.participantGroup && p.participantId != exceptParticipant.participantId);
        for (const p of allPartsExceptArr) {
            //do not send the participant info back to self
            const contactsMsg = new GetParticipantsResultMsg();
            contactsMsg.data.participants = allPartsInfo.filter(partInfo => partInfo.participantId != p.participantId);
            console.log(`send contactsMsg to ${p.displayName}`, contactsMsg);
            this.send(p, contactsMsg);
        }

    }

    async broadCastParticipants(partcipantGroup: string) {

        console.log("broadCastParticipants ", partcipantGroup);
        //broadcast to all participants of contacts        
        const allPartsInfo = [...this.participants.values()].filter(p => p.participantGroup === partcipantGroup).map(p => ({
            participantId: p.participantId,
            displayName: p.displayName,
            status: "online"
        }) as ParticipantInfo);

        console.log('allPartsInfo[]', allPartsInfo);

        const allPartsExceptArr = [...this.participants.values()].filter(p => p.participantGroup === partcipantGroup);
        for (const p of allPartsExceptArr) {
            //do not send the participant info back to self
            const contactsMsg = new GetParticipantsResultMsg();
            contactsMsg.data.participants = allPartsInfo.filter(partInfo => partInfo.participantId != p.participantId);
            console.log(`send contactsMsg to ${p.displayName}`, contactsMsg);
            this.send(p, contactsMsg);
        }

    }

    async broadCastConferenceRooms(participantGroup: string) {
        consoleLog("broadCastConferenceRooms");

        let msg = new GetConferencesResultMsg();
        msg.data.conferences = [...this.conferences.values()].filter(c => c.externalId && c.participantGroup === participantGroup).map(c => {
            let newc = {
                conferenceId: c.id,
                config: clone(c.config),
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

    // getParticipantByConn(connection: SocketConnection) {
    //     // Check active participants first
    //     for (const [key, participant] of this.participants.entries()) {
    //         if (participant.connection == connection) {
    //             return participant;
    //         }
    //     }
    //     return null;
    // }

    getParticipant(participantId: string) {
        // Check active participants first
        for (const [key, participant] of this.participants.entries()) {
            if (participant.participantId == participantId) {
                return participant;
            }
        }
        return null;
    }

    // getParticipantsExceptConn(conn: SocketConnection) {
    //     return [...this.participants.values()].filter(p => p.connection !== conn);
    // }

    getParticipantsExceptPart(part: Participant) {
        return [...this.participants.values()].filter(p => p.participantGroup === part.participantGroup && p.participantId !== part.participantId);
    }

    /**
     * invite a peer to a p2p call
     * @param ws 
     * @param msgIn 
     * @returns 
     */
    private async onInvite(participant: Participant, msgIn: InviteMsg) {
        consoleLog("onInvite");
        msgIn = fill(msgIn, new InviteMsg());

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

        if (participant.participantGroup !== remote.participantGroup) {
            consoleError(`not in the same participant group.`);

            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "invalid participantId.";

            return errorMsg;
        }

        if (participant.participantId === msgIn.data.participantId) {
            consoleError(`cannot invite self`);

            let errorMsg = new InviteResultMsg();
            errorMsg.data.error = "invalid participantId.";

            return errorMsg;
        }

        let conference = this.getOrCreateConference({
            participantGroup: participant.participantGroup,
            roomName: `call with ${participant.displayName} and ${remote.displayName}`,
            confType: "p2p",
            minParticipants: 2, //close the roomm if both particpants are not in the room within 1 minute 
            minParticipantsTimeoutSec: 60
        });
        conference.addParticipant(participant);

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
        msgIn = fill(msgIn, new InviteCancelledMsg());


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
            conf.close("invite cancelled");
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
        msgIn = fill(msgIn, new RejectMsg());

        let remoteParticipant = this.getParticipant(msgIn.data.toParticipantId);

        if (!remoteParticipant) {
            consoleError("onReject - remoteParticipant not found or not connected");
            return;
        }

        if (participant.participantGroup !== remoteParticipant.participantGroup) {
            consoleError("onReject - not the same participant group.");
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
        msgIn = fill(msgIn, new AcceptMsg());

        let conference = this.conferences.get(msgIn.data.conferenceId);

        if (!conference) {
            consoleError("ERROR: conference room does not exist");
            let msg = new AcceptResultMsg();
            msg.data.conferenceId = msgIn.data.conferenceId;
            msg.data.error = "unable to join conference";
            return msg;
        }

        if (conference.participantGroup != participant.participantGroup) {
            consoleError("ERROR: not the same participant group.");
            let msg = new AcceptResultMsg();
            msg.data.conferenceId = msgIn.data.conferenceId;
            msg.data.error = "unable to join conference";
            return msg;
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
        msgIn = copyWithDataParsing(msgIn, new CreateConfMsg());

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
        let confConfig = new ConferenceConfig();
        let roomName = msgIn.data.roomName;

        if (msgIn.data.conferenceExternalId) {
            //tracking id was passed fetch config from external datasource
            if (this.config.conf_data_urls.getScheduledConferenceURL) {
                let resultMsg = await this.thirdParty.getScheduledConference(msgIn.data.conferenceExternalId, participant.clientData);
                if (!resultMsg) {
                    consoleError(`could not get conference ${msgIn.data.conferenceExternalId} with clientData:`, participant.clientData);
                    let errorMsg = new CreateConfResultMsg();
                    errorMsg.data.error = "could not get conference configs.";
                    return errorMsg;
                }

                consoleLog(`getScheduledConference:`, resultMsg);
                if (resultMsg.data.error) {
                    consoleError(resultMsg.data.error);
                    let errorMsg = new CreateConfResultMsg();
                    errorMsg.data.error = "error getting conference configs.";
                    return errorMsg;
                }

                if (resultMsg.data.conference.config) {
                    consoleWarn(`conferenceConfig:`, resultMsg.data.conference.config)
                    fill(resultMsg.data.conference.config, confConfig);
                    roomName = resultMsg.data.conference.name;
                }
            } else {
                //get from demo data                
                let demoSchedule = getDemoSchedules().find(s => s.externalId === msgIn.data.conferenceExternalId);
                if (demoSchedule) {
                    fill(demoSchedule.config, confConfig);
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
            conference = this.getOrCreateConference({
                participantGroup: participant.participantGroup,
                confType: "room",
                conferenceId: "",
                minParticipants: 2,
                minParticipantsTimeoutSec: 5 * 60, //if no one joins for 5 minutes close the room
                externalId: msgIn.data.conferenceExternalId,
                roomName: roomName,
                leader: participant,
                config: confConfig,
            });

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
        msgIn = copyWithDataParsing(msgIn, new JoinConfMsg());

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

        if (conference.participantGroup != participant.participantGroup) {
            consoleError("ERROR: not the same participant group.");
            let msg = new JoinConfResultMsg();
            msg.data.conferenceId = msgIn.data.conferenceId;
            msg.data.error = "unable to join conference";
            return msg;
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
        resultMsg.data.leaderId = conference.leader?.participantId
        resultMsg.data.presenterId = conference.presenter?.participantId;

        return resultMsg;
    }

    async sendConferenceReady(conference: Conference, participant: Participant) {
        consoleLog("conferenceReady");

        conference.addParticipant(participant);

        //send the room info the participant
        let roomsAPI = new RoomsAPI(conference.roomURI, this.config.room_access_token);

        //create an authtoken per user
        let authUserTokenResult = await roomsAPI.newAuthUserToken(participant.username, participant.role as any);
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
        msg.data.leaderId = conference.leader?.participantId;
        msg.data.presenterId = conference.presenter?.participantId;

        //p2p info
        msg.data.participantId = participant.participantId;
        msg.data.displayName = participant.displayName;

        msg.data.conferenceConfig = conference.config;

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
        roomConfig.maxRoomDurationMinutes = 6 * 60; //default to 6 hours.
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
        conference.startTimers();

        conference.updateStatus("ready");
        clearTimeout(initTimerId);

        await this.broadCastConferenceRooms(conference.participantGroup);
        return true;
    }

    async onPresenterInfo(participant: Participant, msgIn: PresenterInfoMsg) {
        consoleLog("onPresenterInfo");

        if (!participant.conference) {
            consoleError(`not in conference`);
        }

        if (msgIn.data.status == "on") {            
            participant.conference.presenter = participant;
        } else if (participant == participant.conference.presenter) {
            participant.conference.presenter = null;
        }

        msgIn.data.participantId = participant.participantId;
        //forward leave to all other participants
        for (let p of participant.conference.participants.values()) {
            if (p != participant) {
                this.send(p, msgIn);
            }
        }
        return null;
    }

    private async onLeave(participant: Participant, msgIn: LeaveMsg): Promise<IMsg | null> {
        consoleLog("onLeave");

        msgIn = fill(msgIn, new LeaveMsg());

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
                consoleWarn("peer left, closing conference room for p2p.");
                conf.close("peer left, closing conference room.");
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
        return new OkMsg(payloadTypeServer.ok);
    }

    private async onTerminateConf(participant: Participant, msgIn: TerminateConfMsg): Promise<IMsg | null> {
        consoleLog("onTerminateConf");

        msgIn = fill(msgIn, new LeaveMsg());

        let conf = participant.conference;

        if (!conf) {
            consoleError("participant not in conference.");
            return;
        }

        if (conf.id !== msgIn.data.conferenceId) {
            consoleError("not the same conference.");
            return;
        }

        if (!(participant.role === AuthUserRoles.user || participant.role === AuthUserRoles.admin)) {
            consoleError("not allowed to terminate conf");
            return;
        }

        if (conf.leader !== participant) {
            consoleError("only conf leader is allowed to terminate conf");
            return;
        }

        this.taskCloseRoom(conf.roomId, conf.roomURI);

        conf.close("closed by user");

        return new OkMsg(payloadTypeServer.ok);

    }

    private async onGetConferences(participant: Participant, msgIn: GetConferencesMsg) {
        consoleLog("onGetConferences");
        //msgIn = fill(msgIn, new GetConferencesMsg());

        let returnMsg = new GetConferencesResultMsg();
        returnMsg.data.conferences = await this.getConferences(participant.participantGroup);
        return returnMsg;
    }

    async getConferences(participantGroup: string): Promise<ConferenceScheduledInfo[]> {
        //consoleLog("getConferences");
        return [...this.conferences.values()].filter(c => !c.config.isPrivate && c.participantGroup === participantGroup)
            .map(c => {
                let newc = {
                    conferenceId: c.id,
                    externalId: c.externalId,
                    config: clone(c.config),
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

    /**
     * in case the clients didnt shutdown the room, close the room in 30 seconds
     * @param roomId 
     * @param roomURI 
     */
    taskCloseRoom(roomId: string, roomURI: string) {
        if (roomId) {
            setTimeout(() => {
                consoleLog(`terminating room`);
                let roomsAPI = new RoomsAPI(roomURI, this.config.room_access_token);
                roomsAPI.terminateRoom(roomId)
            }, 30 * 1000);
        }
    }

}