import express, { NextFunction, Request, Response } from 'express';
import { apiGetParticipantsOnlinePost, apiGetScheduledConferencePost, apiGetScheduledConferenceResult, apiMsgTypes, ConferenceConfig, ConferenceScheduledInfo, GetConferenceScheduledResultMsg, GetConferencesMsg, GetConferencesScheduledResultMsg, GetParticipantsResultMsg, isMsgErorr, LoginGuestMsg, LoginMsg, LoginResultMsg, ParticipantInfo, ParticipantRole, WebRoutes } from '@conf/conf-models';
import { ConferenceServer } from './conferenceServer.js';
import { IAuthPayload, Participant } from '../models/models.js';
import { jwtSign, jwtVerify } from '../utils/jwtUtil.js';
import { AuthUserRoles, RoomCallBackMsg, RoomPeerCallBackMsg } from '@rooms/rooms-models';
import { ThirdPartyAPI } from '../thirdParty/thirdPartyAPI.js';
import { apiGetScheduledConferencesPost, apiGetScheduledConferencesResult } from '@conf/conf-models';
import { getDemoSchedules } from '../demoData/demoData.js';
import { consoleError, fill, parseString } from '../utils/utils.js';
import { CacheManager } from '../utils/cacheManager.js';
import { ConferenceServerConfig, defaultClientConfig } from './models.js';

export class ConferenceAPI {
    thirdPartyAPI: ThirdPartyAPI;
    private app: express.Express;
    private config: ConferenceServerConfig;
    private confServer: ConferenceServer;
    private cache = new CacheManager();

    constructor(args: { app: express.Express, config: ConferenceServerConfig, confServer: ConferenceServer }) {
        this.app = args.app;
        this.config = args.config;
        this.confServer = args.confServer;
        this.thirdPartyAPI = new ThirdPartyAPI(args.config);
    }

    tokenCheck = (req: Request, res: Response, next: NextFunction) => {
        console.log(`tokenCheck: ${req.path}`);

        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log("Missing or invalid Authorization header");
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }
        const authtoken = authHeader.split(' ')[1];
        try {
            //store the auth token in the request obj
            //req.rooms_authtoken = authtoken;

            //this requires admin access
            if (!authtoken) {
                console.error("authToken required.");
                return res.status(401).json({ error: 'Missing or invalid authToken' });
            }


            let payload = jwtVerify(this.config.conf_secret_key, authtoken) as IAuthPayload;
            if (!payload) {
                console.error("invalid authToken.");
                return res.status(401).json({ error: 'invalid authToken.' });
            }

            req["IAuthPayload"] = payload;

            next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    };

    start() {

        console.log(`start ConferenceAPI`);

        this.app.get("/hello", (req, res) => {
            console.log("/hello");

            res.send("ConferenceAPI");
        });

        console.log(`route: ${WebRoutes.loginGuest}`);
        this.app.post(WebRoutes.loginGuest, async (req, res) => {
            console.log(WebRoutes.loginGuest, req.body);

            let msg = req.body as LoginGuestMsg;
            let resultMsg = new LoginResultMsg();

            if (!msg.data.username) {
                let errorMsg = new LoginResultMsg();
                errorMsg.error = "authentication failed";

                res.send(errorMsg);
                return;
            }

            if (this.config.conf_data_urls.login_guest_url) {
                var result = await this.thirdPartyAPI.loginGuest(msg.data.username, msg.data.password, msg.data.clientData);
                if (!result?.data?.username) {
                    console.error(`login_guest_url error ${this.config.conf_data_urls.login_guest_url}`, result);
                    let errorMsg = new LoginResultMsg();
                    errorMsg.error = "authentication failed";

                    res.send(errorMsg);
                    return;
                }

                resultMsg.data.username = result.data.username;
                resultMsg.data.displayName = result.data.displayName;

                if (result.data.clientData) {
                    resultMsg.data.clientData = result.data.clientData;
                    resultMsg.data.participantGroup = result.data.participantGroup;
                    resultMsg.data.participantGroupName = result.data.participantGroupName;
                    resultMsg.data.conferenceGroup = result.data.conferenceGroup;
                }
            } else {
                //demo data
                resultMsg.data.clientData = msg.data.clientData;
                resultMsg.data.participantGroup = "demo";
                resultMsg.data.conferenceGroup = "demo";

            }

            let authTokenPayload: IAuthPayload = {
                externalId: result.data.externalId,
                username: msg.data.username,
                participantGroup: resultMsg.data.participantGroup,
                conferenceGroup: resultMsg.data.conferenceGroup,
                role: ParticipantRole.guest
            };
            let authToken = jwtSign(this.config.conf_secret_key, authTokenPayload);

            resultMsg.data.participantGroup = resultMsg.data.participantGroup;
            resultMsg.data.participantGroupName = resultMsg.data.participantGroupName;
            resultMsg.data.conferenceGroup = resultMsg.data.conferenceGroup;
            resultMsg.data.username = msg.data.username;
            resultMsg.data.displayName = resultMsg.data.displayName;
            resultMsg.data.authToken = authToken;
            resultMsg.data.role = "guest";
            resultMsg.data.clientData = resultMsg.data.clientData;

            console.log(`LoginResultMsg: `, resultMsg);

            res.send(resultMsg);

        });

        console.log(`route: ${WebRoutes.login}`);
        this.app.post(WebRoutes.login, async (req, res) => {
            console.log(WebRoutes.login);

            console.log(req.body);
            let msg = req.body as LoginMsg;
            let isAuthenticated = false;
            let username = "";
            let displayName = "";
            let returnedClientData: any = msg.data.clientData;
            let role: string = ParticipantRole.user;
            let participantGroup = "demo";
            let participantGroupName = "demo";
            let conferenceGroup = "demo";
            let externalId = "";

            if (msg.data.username && msg.data.password) {
                //use a third party service to send a username and password
                if (this.config.conf_data_urls.login_url) {
                    //mock: post the username and password to external URL
                    var result = await this.thirdPartyAPI.login(msg.data.username, msg.data.password, msg.data.clientData);
                    if (result?.data?.username) {
                        console.log(`user authenticated.`, result);
                        isAuthenticated = true;
                        username = result.data.username;
                        displayName = result.data.displayName;
                        returnedClientData = result.data.clientData;
                        role = result.data.role;
                        participantGroup = result.data.participantGroup;
                        participantGroupName = result.data.participantGroupName;
                        conferenceGroup = result.data.conferenceGroup;
                        externalId = result.data.externalId;

                    } else {
                        console.error(`login_url error ${this.config.conf_data_urls.login_url}`, result);
                    }
                } else {
                    //mock: this is a demo app with no database, login user in
                    isAuthenticated = true;
                    username = msg.data.username;
                    displayName = username;
                }

            } else if (msg.data.username && msg.data.authToken) {
                // verify authtoken generated by our app
                try {
                    let payload = jwtVerify(this.config.conf_secret_key, msg.data.authToken) as IAuthPayload;
                    if (payload.username === msg.data.username) {
                        isAuthenticated = true;
                        username = msg.data.username;
                        displayName = username;
                        role = payload.role;
                    }
                    if (this.confServer.config.conf_data_urls.get_user_url) {

                        if (payload.externalId) {
                            isAuthenticated = false;
                        } else {
                            var result = await this.thirdPartyAPI.getUser(payload.externalId, msg.data.clientData);
                            if (isMsgErorr(result)) {
                                console.error(`getUser error ${this.config.conf_data_urls.get_user_url}`, result.error ?? "unknown");
                            } else {
                                console.log(`getUser `, result);
                                isAuthenticated = true;
                                username = result.data.username;
                                displayName = result.data.displayName;
                                returnedClientData = result.data.clientData;
                                role = result.data.role;
                                participantGroup = result.data.participantGroup;
                                participantGroupName = result.data.participantGroupName;
                                conferenceGroup = result.data.conferenceGroup;
                                externalId = result.data.externalId;
                            }
                        }
                    } else {
                        isAuthenticated = true;
                        username = msg.data.username;
                        displayName = username;
                    }

                } catch (err) {
                    console.error(err);
                }
            } else {
                //invalid 
                console.error(`username and password is required.`);
            }

            if (isAuthenticated) {
                let authTokenPayload: IAuthPayload = {
                    externalId: externalId,
                    username: username,
                    participantGroup: participantGroup,
                    conferenceGroup: conferenceGroup,
                    role: role
                };

                let authToken = jwtSign(this.config.conf_secret_key, authTokenPayload);

                let resultMsg = new LoginResultMsg();
                resultMsg.data.participantGroup = participantGroup;
                resultMsg.data.participantGroupName = participantGroupName;
                resultMsg.data.conferenceGroup = conferenceGroup;
                resultMsg.data.username = msg.data.username;
                resultMsg.data.displayName = displayName;
                resultMsg.data.authToken = authToken;
                resultMsg.data.role = role;
                resultMsg.data.clientData = returnedClientData;

                console.log(`send  LoginResultMsg`, resultMsg);
                res.send(resultMsg);
                return;
            } else {
                console.log(`return 401`);
                let errorMsg = new LoginResultMsg();
                errorMsg.error = "authentication failed";
                res.status(401).send(errorMsg);
                return;
            }

        });

        console.log(`route: ${WebRoutes.getConferencesScheduled}`);
        this.app.post(WebRoutes.getConferencesScheduled, this.tokenCheck as any, async (req, res) => {
            //console.log(`${WebRoutes.getConferencesScheduled}`);
            let authPayload = req["IAuthPayload"] as IAuthPayload;

            let msg = req.body as apiGetScheduledConferencesPost;
            let participantGroup = parseString(authPayload.participantGroup);
            let conferenceGroup = parseString(authPayload.conferenceGroup);
            let cacheKey = WebRoutes.getConferencesScheduled + "_" + participantGroup + "_" + conferenceGroup;

            let cachedResults = this.cache.get(cacheKey);
            let resultMsg = new GetConferencesScheduledResultMsg();
            if (cachedResults) {
                resultMsg.data.conferences = cachedResults;
                console.log(`${WebRoutes.getConferencesScheduled} from cache ${cacheKey}`);
            } else {
                if (this.config.conf_data_urls.get_scheduled_conferences_url) {
                    //make a post to the url

                    let result = await this.thirdPartyAPI.getScheduledConferences(msg.data.clientData) as apiGetScheduledConferencesResult;
                    if (isMsgErorr(result)) {
                        consoleError(`getScheduledConferences error:`, result.error ?? "unknown");
                        res.status(500).end();
                        return;
                    }

                    //hide the conference code                
                    resultMsg.data.conferences = result.data.conferences.filter(s => !s.config.isPrivate).map(s => {
                        let clone = new ConferenceScheduledInfo()
                        clone.externalId = s.id;
                        fill(s, clone);
                        fill(s.config, clone.config);
                        delete clone.config.conferenceCode;
                        return clone;
                    });

                    if (resultMsg.data.conferences.length > 0) {
                        this.cache.set(cacheKey, resultMsg.data.conferences, this.config.conf_data_cache_timeout_secs);
                    }

                } else {
                    //get from demo data
                    //console.log(`${WebRoutes.getConferencesScheduled}`);

                    //map and delete the conference code
                    resultMsg = new GetConferencesScheduledResultMsg();
                    resultMsg.data.conferences = getDemoSchedules().filter(s => s.config.isPrivate === false).map(s => {
                        let clone = {
                            ...s,
                            config: { ...s.config }
                        };
                        delete clone.config.conferenceCode;
                        return clone;
                    });
                }
            }

            //get active rooms
            let activeConferences = await this.confServer.getConferences(participantGroup, conferenceGroup);
            resultMsg.data.conferences.forEach(c => {
                c.conferenceId = activeConferences.find(ac => ac.externalId === c.externalId)?.conferenceId ?? "";
                return c;
            });

            res.send(resultMsg);

        });

        console.log(`route: ${WebRoutes.getConferenceScheduled}`);
        this.app.post(WebRoutes.getConferenceScheduled, this.tokenCheck as any, async (req, res) => {
            console.log(`${WebRoutes.getConferenceScheduled}`);

            let resultMsg = new GetConferenceScheduledResultMsg();

            let msg = req.body as apiGetScheduledConferencePost;
            if (this.config.conf_data_urls.get_scheduled_conferences_url) {
                //make a post to the url

                let result = await this.thirdPartyAPI.getScheduledConference(msg.data.id, msg.data.clientData) as apiGetScheduledConferenceResult;
                if (isMsgErorr(result)) {
                    consoleError(`Error: ${result.error ?? "error on getScheduledConference"}`);
                    res.status(500).end();
                    return;
                }

                //console.log(`getScheduledConference result:`, result, result.data.conference.config);

                //hide the conference code
                let conf = new ConferenceScheduledInfo();
                conf.externalId = result.data.conference.id;
                fill(result.data, conf);
                fill(result.data.conference.config, conf.config)
                //hide the conference code
                delete conf.config.conferenceCode; //result.data.conference.config.conferenceCode;                

                resultMsg.data.conference = conf;

            } else {
                //get from demo data
                //console.log(`${WebRoutes.getConferencesScheduled}`);

                //map and delete the conference code
                resultMsg = new GetConferenceScheduledResultMsg();
                resultMsg.data.conference = getDemoSchedules().filter(s => s.externalId === msg.data.id).map(s => {
                    let clone = new ConferenceScheduledInfo();
                    fill(s, clone);
                    fill(s.config, clone.config);
                    delete clone.config.conferenceCode;
                    return clone;
                })[0];
            }

            res.send(resultMsg);

        });

        console.log(`route: ${WebRoutes.onRoomClosed}`);
        this.app.post(WebRoutes.onRoomClosed, this.tokenCheck as any, (req, res) => {
            console.log(WebRoutes.onRoomClosed);

            let msg = req.body as RoomCallBackMsg;
            console.log(`roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.roomTrackingId}`);

            let conf = this.confServer.conferences.get(msg.data.roomTrackingId);
            if (conf) {
                conf.close("room closed");
            }
            res.status(200).send();

        });

        console.log(`route: ${WebRoutes.onPeerJoined}`);
        this.app.post(WebRoutes.onPeerJoined, this.tokenCheck as any, (req, res) => {
            console.log(WebRoutes.onPeerJoined);

            let msg = req.body as RoomPeerCallBackMsg;
            console.log(`peerId: ${msg.data.peerId} peerTrackingId: ${msg.data.peerTrackingId} roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.roomTrackingId}`);
        });

        console.log(`route: ${WebRoutes.onPeerLeft}`);
        this.app.post(WebRoutes.onPeerLeft, this.tokenCheck as any, (req, res) => {
            console.log(WebRoutes.onPeerLeft);

            let msg = req.body as RoomPeerCallBackMsg;
            console.log(`peerId: ${msg.data.peerId} peerTrackingId: ${msg.data.peerTrackingId} roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.roomTrackingId}`);
        });

        console.log(`route: ${WebRoutes.getParticipantsOnline}`);
        this.app.post(WebRoutes.getParticipantsOnline, this.tokenCheck as any, async (req, res) => {
            //console.log(`${WebRoutes.getParticipantsOnline}`);
            let authPayload = req["IAuthPayload"] as IAuthPayload;
            //let msg = req.body as apiGetParticipantsOnlinePost;
            let participantGroup = parseString(authPayload.participantGroup);
            let username = parseString(authPayload.username);

            let resultMsg = new GetParticipantsResultMsg();

            let participants = this.confServer.getParticipants(participantGroup);
            resultMsg.data.participants = [];
            for (let p of participants.filter(p => p.username !== username)) {
                resultMsg.data.participants.push({
                    displayName: p.displayName,
                    participantId: p.participantId,
                    status: p.conference ? "busy" : "online"
                });
            }

            res.send(resultMsg);
        });

        console.log(`route: ${WebRoutes.getClientConfig}`);
        this.app.post(WebRoutes.getClientConfig, async (req, res) => {
            console.log(`${WebRoutes.getClientConfig}`);

            if (this.confServer.config.conf_data_urls.get_client_config_url) {
                let msg = req.body;
                let result = await this.thirdPartyAPI.getClientConfig(msg.data.clientData);
                if (isMsgErorr(result)) {
                    consoleError(`error: ${result.error ?? "error getting config"}`);
                    res.status(500).end();
                    return;
                }

                res.send(result);

            } else {
                res.send({
                    type: apiMsgTypes.getClientConfigResult,
                    data: {
                        config: defaultClientConfig
                    }
                });
            }
        });

    }

}