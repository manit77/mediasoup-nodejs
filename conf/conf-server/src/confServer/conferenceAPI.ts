import express from 'express';
import { AuthenticateMsg, AuthenticateResultMsg, WebRoutes } from '@conf/conf-models';
import { AuthUtils } from './authUtils.js';
import { ConferenceServer, ConferenceServerConfig } from './conferenceServer.js';
import { RoomCallBackData, RoomPeerCallBackData } from '@rooms/rooms-models';

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

        this.app.post(WebRoutes.onRoomClosed, (req, res) => {
            console.log(WebRoutes.onRoomClosed);

            let msg = req.body as RoomCallBackData;
            console.log(`roomId: ${msg.roomId} roomTrackingId: ${msg.trackingId}`);
        });

        this.app.post(WebRoutes.onPeerJoined, (req, res) => {
            console.log(WebRoutes.onPeerJoined);

            let msg = req.body as RoomPeerCallBackData;
            console.log(`peerId: ${msg.peerId} peerTrackingId: ${msg.peerTrackingId} roomId: ${msg.roomId} roomTrackingId: ${msg.roomTrackingId}`);
        });

        this.app.post(WebRoutes.onPeerLeft, (req, res) => {
            console.log(WebRoutes.onPeerLeft);

            let msg = req.body as RoomPeerCallBackData;
            console.log(`peerId: ${msg.peerId} peerTrackingId: ${msg.peerTrackingId} roomId: ${msg.roomId} roomTrackingId: ${msg.roomTrackingId}`);
        });

        this.app.post(WebRoutes.authenticate, async (req, res) => {
            console.log(WebRoutes.authenticate);

            let msgIn = req.body as AuthenticateMsg;
            let loginResult: AuthenticateResultMsg = this.authUtils.authenticate(msgIn);
            res.send(loginResult);
        });
    }
}