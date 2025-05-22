import express, { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
    AuthUserNewTokenMsg,
    RoomNewMsg,
    RoomNewTokenMsg,
    RoomServerAPIRoutes,
    RoomTerminateMsg,
} from "@rooms/rooms-models";
import { RoomServer, RoomServerConfig } from '../roomServer/roomServer.js';
import { AuthUserRoles } from '../models/tokenPayloads.js';
import * as roomUtils from "../roomServer/utils.js";

const DSTR = "RoomHTTPServer";

declare module 'express-serve-static-core' {
    interface Request {
        rooms_authtoken?: string; // Add your custom property
    }
}

export type RoomHTTPServerSecurityMap = {
    [key in RoomServerAPIRoutes]: AuthUserRoles[];
};

export let defaultHTTPServerSecurityMap: RoomHTTPServerSecurityMap = {} as any;
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newAuthUserToken] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newRoomToken] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newRoom] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.terminateRoom] = [AuthUserRoles.admin];

/**
 * these are admin functions of the room server
 */
export class RoomHTTPServer {

    //application server <----> room server
    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    constructor(private config: RoomServerConfig, private securityMap: RoomHTTPServerSecurityMap, private roomServer: RoomServer) {

    }

    tokenCheck = (req: Request, res: Response, next: NextFunction) => {
        console.log(`tokenCheck: ${req.path}`);

        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }
        const authtoken = authHeader.split(' ')[1];
        try {
            //store the auth token in the request obj
            req.rooms_authtoken = authtoken;

            //this requires admin access
            if (!authtoken) {
                console.error("authToken required.");
                return res.status(401).json({ error: 'Missing or invalid authToken' });
            }

            let payload = roomUtils.validateAuthUserToken(this.config.room_secretKey, authtoken);
            if (!payload) {
                console.error("invalid authToken.");
                return res.status(401).json({ error: 'invalid authToken.' });
            }

            let secMap = this.securityMap[req.path];
            if (!secMap || secMap != payload.role) {
                return res.status(401).json({ error: 'unauthorized.' });
            }

            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    };

    initHTTPServer(app: express.Express) {
        app.get("/hello", (req, res) => {
            res.send("RoomHTTPServer");
        });

        app.post(RoomServerAPIRoutes.newAuthUserToken, this.tokenCheck as any, async (req, res) => {

            console.log(RoomServerAPIRoutes.newAuthUserToken);
            let msgIn = req.body as AuthUserNewTokenMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = await this.roomServer.onAuthUserNewTokenMsg(msgIn)
            res.send(resultMsg);

        });

        app.post(RoomServerAPIRoutes.newRoomToken, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoomToken);
            let msgIn = req.body as RoomNewTokenMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = await this.roomServer.onRoomNewTokenMsg(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.newRoom, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoom);
            let msgIn = req.body as RoomNewMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            //creates a room without a peerId
            let resultMsg = await this.roomServer.onRoomNewMsg(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.terminateRoom, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.terminateRoom);
            let msgIn = req.body as RoomTerminateMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = this.roomServer.onRoomTerminateMsg(msgIn);
            res.send(resultMsg);
        });
    }

}