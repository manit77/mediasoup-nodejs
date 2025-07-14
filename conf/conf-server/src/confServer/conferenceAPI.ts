import express from 'express';
import { AuthenticateMsg, AuthenticateResultMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, WebRoutes } from '@conf/conf-models';
import { AuthUtils } from './authUtils.js';
import { ConferenceServer, ConferenceServerConfig } from './conferenceServer.js';
import { IAuthPayload } from '../models/models.js';
import { jwtSign } from '../utils/jwtUtil.js';
import { RoomCallBackMsg, RoomPeerCallBackMsg } from '@rooms/rooms-models';

const DSTR = "ConferenceAPI";

export class ConferenceAPI {
    authUtils: AuthUtils;

    constructor(private app: express.Express, private config: ConferenceServerConfig, private confServer: ConferenceServer) {
        this.authUtils = new AuthUtils(config);
    }

    start() {

        console.log(`start ConferenceAPI`);

        this.app.get("/hello", (req, res) => {
            console.log("/hello");

            res.send("ConferenceAPI");
        });

        console.log(`${WebRoutes.loginGuest}`);

        this.app.post(WebRoutes.loginGuest, (req, res) => {
            console.log(WebRoutes.loginGuest, req.body);

            let msg = req.body as LoginGuestMsg;
            if (msg.data.displayName) {
                let authTokenPayload: IAuthPayload = {
                    username: msg.data.displayName,
                    role: "guest"
                };
                let authToken = jwtSign(this.config.conf_secret_key, authTokenPayload);

                let resultMsg = new LoginResultMsg();
                resultMsg.data.username = msg.data.displayName;
                resultMsg.data.displayName = msg.data.displayName;
                resultMsg.data.authToken = authToken;
                resultMsg.data.role = "guest";

                console.log(`send `, resultMsg);

                res.send(resultMsg);

            } else {

                let errorMsg = new AuthenticateResultMsg();
                errorMsg.data.error = "authentication failed";
                res.send(errorMsg);
            }

        });

        console.log(`${WebRoutes.login}`);
        this.app.post(WebRoutes.login, (req, res) => {
            console.log(WebRoutes.login);
            console.warn(req.body);
            
            let msg = req.body as LoginMsg;            
            if (!msg.data.username || !msg.data.password) {
                console.error(`username and password is required.`);
                 let errorMsg = new AuthenticateResultMsg();
                errorMsg.data.error = "authentication failed";
                res.send(errorMsg);
                return;
            }

            if (msg.data.username && msg.data.password) {
                let authTokenPayload: IAuthPayload = {
                    username: msg.data.username,
                    role: "user"
                };
                let authToken = jwtSign(this.config.conf_secret_key, authTokenPayload);

                let resultMsg = new LoginResultMsg();
                resultMsg.data.username = msg.data.username;
                resultMsg.data.displayName = msg.data.username;
                resultMsg.data.authToken = authToken;
                resultMsg.data.role = "user";

                console.log(`send `, resultMsg);

                res.send(resultMsg);

            } else {

                let errorMsg = new AuthenticateResultMsg();
                errorMsg.data.error = "authentication failed";
                res.send(errorMsg);
            }

        });

        console.log(`${WebRoutes.onRoomClosed}`);
        this.app.post(WebRoutes.onRoomClosed, (req, res) => {
            console.log(WebRoutes.onRoomClosed);

            let msg = req.body as RoomCallBackMsg;
            console.log(`roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.trackingId}`);
        });

        console.log(`${WebRoutes.onPeerJoined}`);
        this.app.post(WebRoutes.onPeerJoined, (req, res) => {
            console.log(WebRoutes.onPeerJoined);

            let msg = req.body as RoomPeerCallBackMsg;
            console.log(`peerId: ${msg.data.peerId} peerTrackingId: ${msg.data.peerTrackingId} roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.roomTrackingId}`);
        });

        console.log(`${WebRoutes.onPeerLeft}`);
        this.app.post(WebRoutes.onPeerLeft, (req, res) => {
            console.log(WebRoutes.onPeerLeft);

            let msg = req.body as RoomPeerCallBackMsg;
            console.log(`peerId: ${msg.data.peerId} peerTrackingId: ${msg.data.peerTrackingId} roomId: ${msg.data.roomId} roomTrackingId: ${msg.data.roomTrackingId}`);
        });


    }
}