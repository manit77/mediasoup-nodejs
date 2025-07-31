import express from 'express';
import { apiGetScheduledConferencePost, apiGetScheduledConferenceResult, ConferenceRoomConfig, ConferenceScheduledInfo, GetConferenceScheduledResultMsg, GetConferencesScheduledResultMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, ParticipantRole, WebRoutes } from '@conf/conf-models';
import { ConferenceServer, ConferenceServerConfig } from './conferenceServer.js';
import { IAuthPayload } from '../models/models.js';
import { jwtSign, jwtVerify } from '../utils/jwtUtil.js';
import { AuthUserRoles, RoomCallBackMsg, RoomPeerCallBackMsg } from '@rooms/rooms-models';
import { ThirdPartyAPI } from '../thirdParty/thirdPartyAPI.js';
import { apiGetScheduledConferencesPost, apiGetScheduledConferencesResult } from '@conf/conf-models';
import { getDemoSchedules } from '../demoData/demoData.js';

export class ConferenceAPI {
    thirdPartyAPI: ThirdPartyAPI;
    private app: express.Express;
    private config: ConferenceServerConfig;
    private confServer: ConferenceServer;

    constructor(args: { app: express.Express, config: ConferenceServerConfig, confServer: ConferenceServer }) {
        this.app = args.app;
        this.config = args.config;
        this.confServer = args.confServer;
        this.thirdPartyAPI = new ThirdPartyAPI(args.config);
    }

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
            let clientData = {};

            if (!msg.data.displayName) {
                let errorMsg = new LoginResultMsg();
                errorMsg.data.error = "authentication failed";

                res.send(errorMsg);
                return;
            }

            if (this.config.conf_data_urls.loginGuestURL) {
                var result = await this.thirdPartyAPI.loginGuest(msg.data.displayName, msg.data.clientData);
                if (result.data.error) {
                    console.error(`loginURL error ${this.config.conf_data_urls.loginURL}`);
                    let errorMsg = new LoginResultMsg();
                    errorMsg.data.error = "authentication failed";

                    res.send(errorMsg);
                    return;
                }

                clientData = result.data.clientData;
            }

            let authTokenPayload: IAuthPayload = {
                username: msg.data.displayName,
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
            let isAuthenticated = false;
            let username = "";
            let displayName = "";
            let returnedClientData: any = { appData: "demo data" };
            let role: string = ParticipantRole.user;
            let msg = req.body as LoginMsg;
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
        this.app.post(WebRoutes.getConferencesScheduled, async (req, res) => {
            //console.log(`${WebRoutes.getConferencesScheduled}`);

            let resultMsg = new GetConferencesScheduledResultMsg();

            if (this.config.conf_data_urls.getScheduledConferencesURL) {
                //make a post to the url
                let msg = req.body as apiGetScheduledConferencesPost;
                let result = await this.thirdPartyAPI.getScheduledConferences(msg.data.clientData) as apiGetScheduledConferencesResult;
                if (result.data.error) {
                    console.log(`getScheduledConferences error:`, result.data.error);
                    return;
                }

                //hide the conference code                
                resultMsg.data.conferences = result.data.conferences.filter(s => !s.config.isPrivate).map(s => {
                    let clone = new ConferenceScheduledInfo()
                    clone.description = s.description;
                    clone.externalId = s.id;
                    clone.name = s.name;
                    clone.config.conferenceCode = "";
                    clone.config.guestsAllowCamera = s.config.guestsAllowCamera;
                    clone.config.guestsAllowMic = s.config.guestsAllowMic;
                    clone.config.guestsAllowed = s.config.guestsAllowed;
                    clone.config.guestsMax = s.config.guestsMax;
                    return clone;
                });

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

            //get active rooms
            let activeConferences = await this.confServer.getConferences();
            resultMsg.data.conferences.forEach(c => {
                c.conferenceId = activeConferences.find(ac => ac.externalId === c.externalId)?.conferenceId ?? "";
                return c;
            });

            res.send(resultMsg);

        });

        console.log(`route: ${WebRoutes.getConferenceScheduled}`);
        this.app.post(WebRoutes.getConferenceScheduled, async (req, res) => {
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

                //hide the conference code                

                let conf = new ConferenceScheduledInfo()
                conf.description = result.data.conference.description;
                conf.externalId = result.data.conference.id;
                conf.name = result.data.conference.name;
                conf.config.conferenceCode = "";
                conf.config.guestsAllowCamera = result.data.conference.config.guestsAllowCamera;
                conf.config.guestsAllowMic = result.data.conference.config.guestsAllowMic;
                conf.config.guestsAllowed = result.data.conference.config.guestsAllowed;
                conf.config.guestsMax = result.data.conference.config.guestsMax;

                resultMsg.data.conference = conf;

                res.send(resultMsg);

            } else {
                //get from demo data
                //console.log(`${WebRoutes.getConferencesScheduled}`);

                //map and delete the conference code
                resultMsg = new GetConferencesScheduledResultMsg();
                resultMsg.data.conference = getDemoSchedules().filter(s => s.externalId === msg.data.id).map(s => {
                    let clone = {
                        ...s,
                        config: { ...s.config }
                    };
                    delete clone.config.conferenceCode;
                    return clone;
                })[0];
            }

            res.send(resultMsg);

        });

        console.log(`route: ${WebRoutes.onRoomClosed}`);
        this.app.post(WebRoutes.onRoomClosed, (req, res) => {
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
        this.app.post(WebRoutes.onPeerJoined, (req, res) => {
            console.log(WebRoutes.onPeerJoined);

            let msg = req.body as RoomPeerCallBackMsg;
            console.log(`peerId: ${msg.data.peerId} peerTrackingId: ${msg.data.peerTrackingId} roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.roomTrackingId}`);
        });

        console.log(`route: ${WebRoutes.onPeerLeft}`);
        this.app.post(WebRoutes.onPeerLeft, (req, res) => {
            console.log(WebRoutes.onPeerLeft);

            let msg = req.body as RoomPeerCallBackMsg;
            console.log(`peerId: ${msg.data.peerId} peerTrackingId: ${msg.data.peerTrackingId} roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.roomTrackingId}`);
        });

    }

}