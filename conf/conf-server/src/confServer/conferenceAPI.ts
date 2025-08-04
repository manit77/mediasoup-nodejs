import express, { NextFunction, Request, Response } from 'express';
import { apiGetScheduledConferencePost, apiGetScheduledConferenceResult, ConferenceConfig, ConferenceScheduledInfo, GetConferenceScheduledResultMsg, GetConferencesMsg, GetConferencesScheduledResultMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, ParticipantRole, WebRoutes } from '@conf/conf-models';
import { ConferenceServer, ConferenceServerConfig } from './conferenceServer.js';
import { IAuthPayload } from '../models/models.js';
import { jwtSign, jwtVerify } from '../utils/jwtUtil.js';
import { AuthUserRoles, RoomCallBackMsg, RoomPeerCallBackMsg } from '@rooms/rooms-models';
import { ThirdPartyAPI } from '../thirdParty/thirdPartyAPI.js';
import { apiGetScheduledConferencesPost, apiGetScheduledConferencesResult } from '@conf/conf-models';
import { getDemoSchedules } from '../demoData/demoData.js';
import { fill, parseString } from '../utils/utils.js';
import { CacheManager } from '../utils/cacheManager.js';

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
            let clientData = msg.data.clientData;
            let participantGroup = "";
            if (!msg.data.displayName) {
                let errorMsg = new LoginResultMsg();
                errorMsg.data.error = "authentication failed";

                res.send(errorMsg);
                return;
            }

            if (this.config.conf_data_urls.loginGuestURL) {
                var result = await this.thirdPartyAPI.loginGuest(msg.data.displayName, msg.data.clientData);
                if (result.data.error) {
                    console.error(`loginGuestURL error ${this.config.conf_data_urls.loginGuestURL}`, result.data.error);
                    let errorMsg = new LoginResultMsg();
                    errorMsg.data.error = "authentication failed";

                    res.send(errorMsg);
                    return;
                }
                if (result.data.clientData) {
                    clientData = result.data.clientData;
                    participantGroup = parseString(result.data.clientData["participantGroup"]),
                    console.warn(`new clientData received.`, clientData);
                }
            }

            let authTokenPayload: IAuthPayload = {
                username: msg.data.displayName,
                participantGroup: participantGroup,
                role: ParticipantRole.guest
            };
            let authToken = jwtSign(this.config.conf_secret_key, authTokenPayload);

            let resultMsg = new LoginResultMsg();
            resultMsg.data.username = msg.data.displayName;
            resultMsg.data.displayName = msg.data.displayName;
            resultMsg.data.authToken = authToken;
            resultMsg.data.role = "guest";
            resultMsg.data.clientData = clientData;

            console.log(`send `, resultMsg);

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
            let participantGroup = "";

            if (msg.data.username && msg.data.password) {
                //use a third party service to send a username and password
                if (this.config.conf_data_urls.loginURL) {
                    //mock: post the username and password to external URL
                    var result = await this.thirdPartyAPI.login(msg.data.username, msg.data.password, msg.data.clientData);
                    if (result.data.error) {
                        console.error(`loginURL error ${this.config.conf_data_urls.loginURL}`, result.data.error);
                    } else {
                        console.log(`user authenticated.`, result);
                        isAuthenticated = true;
                        username = result.data.username;
                        displayName = result.data.displayName;
                        returnedClientData = result.data.clientData;
                        role = result.data.role;
                        participantGroup =  parseString(result.data.clientData["participantGroup"]);
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
                } catch (err) {
                    console.error(err);
                }
            } else {
                //invalid 
                console.error(`username and password is required.`);
            }

            if (isAuthenticated) {
                let authTokenPayload: IAuthPayload = {
                    username: username,
                    participantGroup: participantGroup,
                    role: role
                };

                let authToken = jwtSign(this.config.conf_secret_key, authTokenPayload);

                let resultMsg = new LoginResultMsg();
                resultMsg.data.username = msg.data.username;
                resultMsg.data.displayName = displayName;
                resultMsg.data.authToken = authToken;
                resultMsg.data.role = role;
                resultMsg.data.clientData = returnedClientData;

                console.log(`send  LoginResultMsg`, resultMsg);
                res.send(resultMsg);
                return;
            } else {
                console.warn(`return 401`);
                let errorMsg = new LoginResultMsg();
                errorMsg.data.error = "authentication failed";
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
            let cacheKey = WebRoutes.getConferencesScheduled + "_" + participantGroup;

            let cachedResults = this.cache.get(cacheKey);
            let resultMsg = new GetConferencesScheduledResultMsg();            
            if (cachedResults) {
                resultMsg.data.conferences = cachedResults;
                console.log(`${WebRoutes.getConferencesScheduled} from cache`);
            } else {
                if (this.config.conf_data_urls.getScheduledConferencesURL) {
                    //make a post to the url

                    let result = await this.thirdPartyAPI.getScheduledConferences(msg.data.clientData) as apiGetScheduledConferencesResult;
                    if (result.data.error) {
                        console.log(`getScheduledConferences error:`, result.data.error);
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

                    this.cache.set(cacheKey, resultMsg.data.conferences, this.config.conf_data_cache_timeoutsecs);

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
            let activeConferences = await this.confServer.getConferences(participantGroup);
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
            if (this.config.conf_data_urls.getScheduledConferencesURL) {
                //make a post to the url

                let result = await this.thirdPartyAPI.getScheduledConference(msg.data.id, msg.data.clientData) as apiGetScheduledConferenceResult;
                if (result.data.error) {
                    console.log(result.data.error);
                    return;
                }

                console.log(`getScheduledConference result:`, result, result.data.conference.config);

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
                resultMsg = new GetConferencesScheduledResultMsg();
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

    }

}